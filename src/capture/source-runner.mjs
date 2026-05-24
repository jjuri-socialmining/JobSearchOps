import fs from "node:fs";
import { loadConfig } from "../lib/config-loader.mjs";
import { normalizeJobs } from "../lib/job-normalizer.mjs";
import { writeJson } from "../lib/file-utils.mjs";
import { upsert as historyUpsert, getStats as historyGetStats, getHistory, flush as historyFlush } from "../lib/job-history.mjs";
import { analyzeDismissals } from "../lib/dismissal-learner.mjs";
import { captureFromSource as captureBcGov } from "./adapters/bc-gov.mjs";
import { captureFromSource as captureGreenhouse } from "./adapters/greenhouse.mjs";
import { captureFromSource as captureLever } from "./adapters/lever.mjs";
import { captureFromSource as captureWorkday } from "./adapters/workday.mjs";
import { captureFromSource as captureGenericCareersPage } from "./adapters/generic-careers-page.mjs";
import { captureFromSource as captureCivicJobs } from "./adapters/civicjobs.mjs";
import { captureFromSource as captureCanadaCa } from "./adapters/canada-ca.mjs";
import { captureFromSource as captureIndeed } from "./adapters/indeed.mjs";
import { captureFromSource as captureAdzuna } from "./adapters/adzuna.mjs";

const adapterRegistry = {
  "bc-gov": captureBcGov,
  greenhouse: captureGreenhouse,
  lever: captureLever,
  workday: captureWorkday,
  "generic-careers-page": captureGenericCareersPage,
  civicjobs: captureCivicJobs,
  "canada-ca": captureCanadaCa,
  indeed: captureIndeed,
  adzuna: captureAdzuna
};

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function deriveSourceAccessUrl(source) {
  return source.public_board_url || source.page_url || source.endpoint_url || "";
}

function deriveSourceNavigationUrl(source) {
  const template = String(source.search_url_template || "").trim();
  const keywords = Array.isArray(source.keywords_any) ? source.keywords_any.filter(Boolean) : [];
  if (template) {
    const query = encodeURIComponent(keywords.join(" "));
    return template.replaceAll("{q}", query).replaceAll("{query}", query);
  }
  return deriveSourceAccessUrl(source);
}

function deriveSourceDisplayName(source) {
  return String(source.display_name || source.name || source.id || "").trim();
}

function parseDelimitedList(value) {
  return String(value || "")
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePostedDate(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const usDateMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (usDateMatch) {
    const [, month, day, year] = usDateMatch;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinMaxPostedDays(job, maxPostedDays) {
  if (!Number.isFinite(maxPostedDays) || maxPostedDays <= 0) {
    return true;
  }
  const postedDate = parsePostedDate(job.posted_at);
  if (!postedDate) {
    return true;
  }
  const now = new Date();
  const diffMs = now.getTime() - postedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= maxPostedDays;
}

function inferSourceConfigurationState(source) {
  if (source.id === "bc-gov") {
    if (source.endpoint_url || source.public_board_url) {
      return { configured: true, note: "configured" };
    }
    return { configured: false, note: "missing endpoint_url/public_board_url" };
  }

  if (source.adapter === "greenhouse") {
    const count = Array.isArray(source.board_tokens) ? source.board_tokens.filter(Boolean).length : 0;
    return count
      ? { configured: true, note: `${count} board token(s)` }
      : { configured: false, note: "missing board_tokens" };
  }

  if (source.adapter === "lever") {
    const count = Array.isArray(source.sites) ? source.sites.filter(Boolean).length : 0;
    return count
      ? { configured: true, note: `${count} site handle(s)` }
      : { configured: false, note: "missing sites" };
  }

  if (source.adapter === "workday") {
    const count = Array.isArray(source.endpoints)
      ? source.endpoints.filter((item) => item && item.endpoint_url).length
      : 0;
    return count
      ? { configured: true, note: `${count} endpoint(s)` }
      : { configured: false, note: "missing endpoints" };
  }

  if (source.adapter === "civicjobs") {
    if (source.endpoint_url || source.page_url) {
      return { configured: true, note: "configured civicjobs rss" };
    }
    return { configured: false, note: "missing endpoint_url/page_url" };
  }

  if (source.adapter === "canada-ca") {
    if (source.page_url) {
      return { configured: true, note: "configured canada.ca page discovery" };
    }
    return { configured: false, note: "missing page_url" };
  }

  if (source.adapter === "indeed") {
    if (source.endpoint_url || source.page_url) {
      return { configured: true, note: "configured indeed rss" };
    }
    return { configured: false, note: "missing endpoint_url" };
  }

  if (source.adapter === "adzuna") {
    const appId = source.app_id || process.env.ADZUNA_APP_ID || "";
    const appKey = source.app_key || process.env.ADZUNA_APP_KEY || "";
    if (appId && appKey) {
      return { configured: true, note: "configured adzuna api" };
    }
    return { configured: false, note: "missing ADZUNA_APP_ID / ADZUNA_APP_KEY — register free at https://developer.adzuna.com" };
  }

  if (source.adapter === "generic-careers-page") {
    const manualCount = Array.isArray(source.manual_jobs) ? source.manual_jobs.length : 0;
    const sourceCount = Array.isArray(source.sources) ? source.sources.length : 0;
    const pageConfigured = Boolean(source.page_url);
    return manualCount || sourceCount || pageConfigured
      ? { configured: true, note: pageConfigured && !manualCount && !sourceCount ? "configured page_url html discovery" : `${manualCount + sourceCount} configured source item(s)` }
      : { configured: false, note: "missing manual_jobs/sources" };
  }

  return { configured: true, note: "configuration not inferred" };
}

function loadKeywordsConfig() {
  const keywordsPath = "config/keywords.yaml";
  const keywordsConfig = fs.existsSync(keywordsPath) ? loadConfig(keywordsPath) : {};
  const includeOverride = String(process.env.JOBOPS_LEVEL1_KEYWORDS || "").trim();
  const excludedAnyOverride = String(process.env.JOBOPS_EXCLUDED_ANY_KEYWORDS || "").trim();
  const excludedPostOverride = String(process.env.JOBOPS_EXCLUDED_POST_KEYWORDS || "").trim();
  if (includeOverride) {
    keywordsConfig.level_1_keywords = parseDelimitedList(includeOverride);
  }
  if (excludedAnyOverride) {
    const parsed = parseDelimitedList(excludedAnyOverride);
    keywordsConfig.level_1_excluded_title_keywords = [
      ...(Array.isArray(keywordsConfig.level_1_excluded_title_keywords) ? keywordsConfig.level_1_excluded_title_keywords : []),
      ...parsed
    ];
    keywordsConfig.level_1_excluded_post_keywords = [
      ...(Array.isArray(keywordsConfig.level_1_excluded_post_keywords) ? keywordsConfig.level_1_excluded_post_keywords : []),
      ...parsed
    ];
  }
  if (excludedPostOverride) {
    keywordsConfig.level_1_excluded_post_keywords = parseDelimitedList(excludedPostOverride);
  }
  return keywordsConfig;
}

function loadPromptRuntimeRegistry() {
  const registryPath = "automation/sources/jobops-runtime-registry.json";
  if (!fs.existsSync(registryPath)) {
    return [];
  }

  try {
    const payload = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    return Array.isArray(payload.sources) ? payload.sources : [];
  } catch {
    return [];
  }
}

function loadPromptScopedUrls() {
  const promptSourcesPath = "automation/sources/jobops-prompt-sources.json";
  if (!fs.existsSync(promptSourcesPath)) {
    return new Set();
  }

  try {
    const payload = JSON.parse(fs.readFileSync(promptSourcesPath, "utf8"));
    const urls = new Set();
    for (const group of payload.groups || []) {
      for (const item of group.urls || []) {
        const url = normalizeUrl(item?.url || item);
        if (url) {
          urls.add(url);
        }
      }
    }
    return urls;
  } catch {
    return new Set();
  }
}

function mergeSources(baseSources, runtimeSources) {
  const merged = [...(Array.isArray(baseSources) ? baseSources : [])];
  const knownIds = new Set(merged.map((item) => String(item?.id || "").trim()).filter(Boolean));
  const knownUrls = new Set(
    merged
      .flatMap((item) => [item?.page_url, item?.public_board_url, item?.endpoint_url])
      .map(normalizeUrl)
      .filter(Boolean)
  );

  for (const source of runtimeSources) {
    const sourceId = String(source?.id || "").trim();
    const sourceUrl = normalizeUrl(source?.page_url || source?.public_board_url || source?.endpoint_url || "");
    if ((sourceId && knownIds.has(sourceId)) || (sourceUrl && knownUrls.has(sourceUrl))) {
      continue;
    }
    merged.push(source);
    if (sourceId) {
      knownIds.add(sourceId);
    }
    if (sourceUrl) {
      knownUrls.add(sourceUrl);
    }
  }

  return merged;
}

function sourceMatchesPromptScope(source, promptUrls) {
  const candidates = [
    source.page_url,
    source.public_board_url,
    source.endpoint_url,
    ...(Array.isArray(source.sources) ? source.sources.flatMap((item) => [item?.page_url, item?.endpoint_url]) : []),
    ...(Array.isArray(source.endpoints) ? source.endpoints.flatMap((item) => [item?.endpoint_url]) : [])
  ]
    .map(normalizeUrl)
    .filter(Boolean);

  return candidates.some((url) => promptUrls.has(url));
}

function resolveSourceKeywords(source, keywordsConfig) {
  const profileKeywords = Array.isArray(keywordsConfig[source.keywords_profile]) ? keywordsConfig[source.keywords_profile] : [];
  const explicitKeywords = Array.isArray(source.keywords_any) ? source.keywords_any : [];
  const merged = [...explicitKeywords, ...profileKeywords].filter(Boolean);
  return [...new Set(merged)];
}

function resolveSourceExclusions(source, keywordsConfig) {
  if (String(process.env.JOBOPS_DISABLE_EXCLUSIONS || "").trim() === "1") {
    return {
      excluded_title_keywords: [],
      excluded_exact_titles: [],
      excluded_organizations: [],
      excluded_post_keywords: [],
      excluded_work_options: []
    };
  }

  const titleKeywords = Array.isArray(keywordsConfig[source.excluded_title_keywords_profile])
    ? keywordsConfig[source.excluded_title_keywords_profile]
    : Array.isArray(source.excluded_title_keywords)
      ? source.excluded_title_keywords
      : [];
  const exactTitles = Array.isArray(keywordsConfig[source.excluded_exact_titles_profile])
    ? keywordsConfig[source.excluded_exact_titles_profile]
    : Array.isArray(source.excluded_exact_titles)
      ? source.excluded_exact_titles
      : [];
  const organizations = Array.isArray(keywordsConfig[source.excluded_organizations_profile])
    ? keywordsConfig[source.excluded_organizations_profile]
    : Array.isArray(source.excluded_organizations)
      ? source.excluded_organizations
      : [];
  const postKeywords = Array.isArray(keywordsConfig[source.excluded_post_keywords_profile])
    ? keywordsConfig[source.excluded_post_keywords_profile]
    : Array.isArray(source.excluded_post_keywords)
      ? source.excluded_post_keywords
      : [];
  const workOptions = Array.isArray(keywordsConfig[source.excluded_work_options_profile])
    ? keywordsConfig[source.excluded_work_options_profile]
    : Array.isArray(source.excluded_work_options)
      ? source.excluded_work_options
      : [];

  return {
    excluded_title_keywords: [...new Set(titleKeywords.filter(Boolean))],
    excluded_exact_titles: [...new Set(exactTitles.filter(Boolean))],
    excluded_organizations: [...new Set(organizations.filter(Boolean))],
    excluded_post_keywords: [...new Set(postKeywords.filter(Boolean))],
    excluded_work_options: [...new Set(workOptions.filter(Boolean))]
  };
}

function matchesIncludeKeywords(job, source) {
  const keywords = Array.isArray(source.keywords_any) ? source.keywords_any : [];
  if (!keywords.length) {
    return true;
  }
  const haystack = `${job.title} ${job.organization} ${job.location} ${job.description_snippet || ""} ${job.source_url || ""}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(String(keyword || "").toLowerCase()));
}

function shouldExcludeJob(job, source) {
  const title = String(job.title || "").toLowerCase();
  const organization = String(job.organization || "").toLowerCase();
  const workOption = String(job.remote_mode || "").toLowerCase();
  const postText = [
    job.description_snippet,
    job.compensation,
    job.location,
    job.remote_mode,
    job.raw?.key_html,
    JSON.stringify(job.raw || {})
  ].join(" ").toLowerCase();

  const titleKeywordMatch = (source.excluded_title_keywords || []).some((keyword) =>
    title.includes(String(keyword || "").toLowerCase())
  );
  if (titleKeywordMatch) {
    return true;
  }

  const exactTitleMatch = (source.excluded_exact_titles || []).some(
    (item) => title === String(item || "").toLowerCase()
  );
  if (exactTitleMatch) {
    return true;
  }

  const organizationMatch = (source.excluded_organizations || []).some((item) =>
    organization.includes(String(item || "").toLowerCase())
  );
  if (organizationMatch) {
    return true;
  }

  const postKeywordMatch = (source.excluded_post_keywords || []).some((keyword) =>
    postText.includes(String(keyword || "").toLowerCase())
  );
  if (postKeywordMatch) {
    return true;
  }

  const excludedWorkOptionMatch = (source.excluded_work_options || []).some((item) =>
    workOption.includes(String(item || "").toLowerCase())
  );
  return excludedWorkOptionMatch;
}

export async function runCapture({ sourcesConfigPath = "config/sources.yaml", outputFile, sourceId } = {}) {
  const config = loadConfig(sourcesConfigPath);
  const keywordsConfig = loadKeywordsConfig();
  const maxPostedDays = Number(process.env.JOBOPS_MAX_POSTED_DAYS || 0);
  const sourceScope = String(process.env.JOBOPS_SOURCE_SCOPE || "").trim().toLowerCase();
  const promptScopedUrls = sourceScope === "prompt" ? loadPromptScopedUrls() : new Set();
  const sources = mergeSources(config.sources || [], loadPromptRuntimeRegistry());
  const selectedSources = sources.filter((source) => {
    if (sourceId && source.id !== sourceId) {
      return false;
    }
    if (sourceScope === "prompt" && promptScopedUrls.size > 0 && !sourceMatchesPromptScope(source, promptScopedUrls)) {
      return false;
    }
    return source.enabled !== false;
  }).map((source) => ({
    ...source,
    keywords_any: resolveSourceKeywords(source, keywordsConfig),
    ...resolveSourceExclusions(source, keywordsConfig)
  }));

  const captured = [];
  const errors = [];
  const sourceRuns = [];

  for (const source of selectedSources) {
    const adapter = adapterRegistry[source.adapter];
    if (!adapter) {
      errors.push({ source_id: source.id, error: `Unknown adapter: ${source.adapter}` });
      sourceRuns.push({
        source_id: source.id,
        source_name: source.name,
        source_display_name: deriveSourceDisplayName(source),
        source_access_url: deriveSourceAccessUrl(source),
        source_navigation_url: deriveSourceNavigationUrl(source),
        prompt_group_label: source.prompt_group_label || "",
        prompt_group_order: Number(source.prompt_group_order || 0) || null,
        prompt_url_order: Number(source.prompt_url_order || 0) || null,
        adapter: source.adapter,
        capture_method: source.method || source.adapter,
        configured: false,
        status: "ERROR",
        status_note: `Unknown adapter: ${source.adapter}`,
        job_count_raw: 0,
        job_count_after_filters: 0,
        filtered_out_count: 0,
        llm_tokens_total: null
      });
      continue;
    }

    const configState = inferSourceConfigurationState(source);
    if (!configState.configured) {
      sourceRuns.push({
        source_id: source.id,
        source_name: source.name,
        source_display_name: deriveSourceDisplayName(source),
        source_access_url: deriveSourceAccessUrl(source),
        source_navigation_url: deriveSourceNavigationUrl(source),
        prompt_group_label: source.prompt_group_label || "",
        prompt_group_order: Number(source.prompt_group_order || 0) || null,
        prompt_url_order: Number(source.prompt_url_order || 0) || null,
        adapter: source.adapter,
        capture_method: source.method || source.adapter,
        configured: false,
        status: "SKIPPED_UNCONFIGURED",
        status_note: configState.note,
        job_count_raw: 0,
        job_count_after_filters: 0,
        filtered_out_count: 0,
        llm_tokens_total: null
      });
      continue;
    }

    try {
      const jobs = await adapter(source);
      const filteredJobs = jobs.filter((job) => matchesIncludeKeywords(job, source) && !shouldExcludeJob(job, source) && isWithinMaxPostedDays(job, maxPostedDays));
      const normalizedJobs = normalizeJobs(filteredJobs, source).map((job) => ({
        ...job,
        source_priority: source.priority || 0
      }));
      captured.push(
        ...normalizedJobs
      );
      sourceRuns.push({
        source_id: source.id,
        source_name: source.name,
        source_display_name: deriveSourceDisplayName(source),
        source_access_url: deriveSourceAccessUrl(source),
        source_navigation_url: deriveSourceNavigationUrl(source),
        prompt_group_label: source.prompt_group_label || "",
        prompt_group_order: Number(source.prompt_group_order || 0) || null,
        prompt_url_order: Number(source.prompt_url_order || 0) || null,
        adapter: source.adapter,
        capture_method: source.method || source.adapter,
        configured: true,
        status: normalizedJobs.length ? "CAPTURED" : "NO_RESULTS",
        status_note: configState.note,
        job_count_raw: jobs.length,
        job_count_after_filters: normalizedJobs.length,
        filtered_out_count: Math.max(jobs.length - filteredJobs.length, 0),
        llm_tokens_total: null
      });
    } catch (error) {
      errors.push({ source_id: source.id, error: error.message });
      sourceRuns.push({
        source_id: source.id,
        source_name: source.name,
        source_display_name: deriveSourceDisplayName(source),
        source_access_url: deriveSourceAccessUrl(source),
        source_navigation_url: deriveSourceNavigationUrl(source),
        prompt_group_label: source.prompt_group_label || "",
        prompt_group_order: Number(source.prompt_group_order || 0) || null,
        prompt_url_order: Number(source.prompt_url_order || 0) || null,
        adapter: source.adapter,
        capture_method: source.method || source.adapter,
        configured: true,
        status: "ERROR",
        status_note: error.message,
        job_count_raw: 0,
        job_count_after_filters: 0,
        filtered_out_count: 0,
        llm_tokens_total: null
      });
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    source_count: selectedSources.length,
    source: selectedSources.length === 1 ? selectedSources[0].summary_source || selectedSources[0].id : "multi-source",
    keywords_used: [...new Set(selectedSources.flatMap((source) => source.keywords_any || []))],
    exclusions_used: {
      excluded_title_keywords: [...new Set(selectedSources.flatMap((source) => source.excluded_title_keywords || []))],
      excluded_exact_titles: [...new Set(selectedSources.flatMap((source) => source.excluded_exact_titles || []))],
      excluded_organizations: [...new Set(selectedSources.flatMap((source) => source.excluded_organizations || []))],
      excluded_post_keywords: [...new Set(selectedSources.flatMap((source) => source.excluded_post_keywords || []))],
      excluded_work_options: [...new Set(selectedSources.flatMap((source) => source.excluded_work_options || []))]
    },
    runtime_filters: {
      max_posted_days: Number.isFinite(maxPostedDays) && maxPostedDays > 0 ? maxPostedDays : null
    },
    source_runs: sourceRuns,
    job_count: captured.length,
    errors,
    jobs: captured
  };

  if (outputFile) {
    writeJson(outputFile, payload);
  }

  // Update persistent job history with this capture run
  for (const job of captured) {
    historyUpsert(job);
  }
  historyFlush();

  const histStats = historyGetStats();
  console.error(`[history] ${histStats.total} total · ${histStats.seen} seen · ${histStats.dismissed} dismissed`);

  // Auto-run dismissal learner when enough dismissals have accumulated
  if (histStats.dismissed > 3 && process.env.ANTHROPIC_API_KEY) {
    console.error(`[dismissal-learner] ${histStats.dismissed} dismissals found — analyzing patterns…`);
    const dismissed = getHistory().filter(j => j.status === 'dismissed');
    try {
      const insights = await analyzeDismissals(dismissed);
      if (insights) {
        console.error('[dismissal-learner] insights:');
        console.error(JSON.stringify(insights, null, 2));
      }
    } catch (err) {
      console.error('[dismissal-learner] error:', err.message);
    }
  }

  return payload;
}
