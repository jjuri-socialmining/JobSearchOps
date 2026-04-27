import fs from "node:fs";
import { resolveRepoPath, writeJson, writeText } from "../src/lib/file-utils.mjs";
import { loadConfig } from "../src/lib/config-loader.mjs";

function readText(relativePath) {
  return fs.readFileSync(resolveRepoPath(relativePath), "utf8");
}

function extractSourcesBlock(promptText) {
  const startMatch = promptText.match(/^## Fuentes[^\n]*$/m);
  if (!startMatch || startMatch.index == null) {
    return "";
  }
  const rest = promptText.slice(startMatch.index + startMatch[0].length);
  const endMatch = rest.match(/\n##\s+/);
  return (endMatch ? rest.slice(0, endMatch.index) : rest)
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

function parseSources(block) {
  const lines = block.split("\n");
  const groups = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const headingMatch = line.match(/^\d+\.\s+(.*)$/);
    if (headingMatch) {
      current = { label: headingMatch[1].trim(), urls: [] };
      groups.push(current);
      continue;
    }
    const urlMatch = line.match(/^-\s+(https?:\/\/\S+)/);
    if (urlMatch && current) {
      current.urls.push(urlMatch[1]);
    }
  }

  return groups;
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function inferAdapterForUrl(url) {
  const normalized = normalizeUrl(url);
  if (/^https?:\/\/(?:www\.)?canada\.ca\//i.test(normalized)) {
    return {
      adapter: "canada-ca",
      method: "canada-ca-page-discovery",
      type: "federal-jobs-page",
      priority: 92
    };
  }

  if (/ca\.indeed\.com/i.test(normalized)) {
    // Indeed blocks automated HTML/RSS access. Route to adzuna adapter which covers Indeed data.
    return {
      adapter: "adzuna",
      method: "json-api",
      type: "job-board",
      priority: 88
    };
  }

  return {
    adapter: "generic-careers-page",
    method: "html-link-discovery",
    type: "prompt-registry-page",
    priority: 60
  };
}

function inferDisplayNameForUrl(url) {
  const normalized = normalizeUrl(url);
  if (/ca\.indeed\.com/i.test(normalized)) {
    return "Indeed";
  }
  if (/linkedin\.com\/jobs/i.test(normalized)) {
    return "LinkedIn Jobs";
  }
  if (/glassdoor\.ca/i.test(normalized)) {
    return "Glassdoor";
  }
  if (/monster\.ca/i.test(normalized)) {
    return "Monster";
  }
  if (/bcgovinternaljobpostings\.gov\.bc\.ca/i.test(normalized)) {
    return "BC Government Careers";
  }
  if (/civicjobs\.ca/i.test(normalized)) {
    return "CivicJobs.ca";
  }
  if (/emploisfp-psjobs\.cfp-psc\.gc\.ca/i.test(normalized)) {
    return "GC Jobs";
  }
  if (/treasury-board-secretariat/i.test(normalized)) {
    return "TBS Operations Jobs";
  }
  if (/canada\.ca/i.test(normalized)) {
    return "Canada.ca Jobs";
  }
  return normalized.replace(/^https?:\/\/(?:www\.)?/i, "").split("/")[0];
}

function inferSearchUrlTemplate(url) {
  const normalized = normalizeUrl(url);
  if (/ca\.indeed\.com/i.test(normalized)) {
    return "https://ca.indeed.com/jobs?q={q}&l=British%20Columbia";
  }
  if (/linkedin\.com\/jobs/i.test(normalized)) {
    return "https://www.linkedin.com/jobs/search/?keywords={q}&location=British%20Columbia%2C%20Canada";
  }
  if (/glassdoor\.ca/i.test(normalized)) {
    return "https://www.glassdoor.ca/Job/jobs.htm?sc.keyword={q}&locT=C&locId=1108";
  }
  if (/monster\.ca/i.test(normalized)) {
    return "https://www.monster.ca/jobs/search/?q={q}&where=British-Columbia";
  }
  return "";
}

function configuredUrls(config) {
  const urls = new Set();
  for (const source of config.sources || []) {
    if (source.page_url) {
      urls.add(normalizeUrl(source.page_url));
    }
    if (source.public_board_url) {
      urls.add(normalizeUrl(source.public_board_url));
    }
    for (const item of source.sources || []) {
      if (item.page_url) {
        urls.add(normalizeUrl(item.page_url));
      }
      if (item.endpoint_url) {
        urls.add(normalizeUrl(item.endpoint_url));
      }
    }
    for (const item of source.endpoints || []) {
      if (item.endpoint_url) {
        urls.add(normalizeUrl(item.endpoint_url));
      }
    }
  }
  return urls;
}

const promptFile = process.env.JOBOPS_PROMPT_FILE || "prompts/jobops/2026-03-26 - job-offers-scout-simple-bc.prompt.md";
const promptText = readText(promptFile);
const block = extractSourcesBlock(promptText);
const groups = parseSources(block);
const sourcesConfig = loadConfig("config/sources.yaml");
const knownUrls = configuredUrls(sourcesConfig);

const payload = {
  generated_at: new Date().toISOString(),
  prompt_file: promptFile,
  groups: groups.map((group) => ({
    label: group.label,
    urls: group.urls.map((url) => ({
      url,
      present_in_node_runtime: knownUrls.has(normalizeUrl(url))
    }))
  }))
};

const runtimeRegistry = {
  generated_at: payload.generated_at,
  prompt_file: promptFile,
  sources: groups.flatMap((group, groupIndex) =>
    group.urls
      .filter((url) => !knownUrls.has(normalizeUrl(url)))
      .map((url, urlIndex) => {
        const adapterProfile = inferAdapterForUrl(url);
        const displayName = inferDisplayNameForUrl(url);
        const searchUrlTemplate = inferSearchUrlTemplate(url);
        return {
          id: `prompt-${slugify(url)}`,
          name: `${group.label} - ${url}`,
          display_name: displayName,
          adapter: adapterProfile.adapter,
          type: adapterProfile.type,
          enabled: true,
          priority: adapterProfile.priority,
          prompt_group_label: group.label,
          prompt_group_order: groupIndex + 1,
          prompt_url_order: urlIndex + 1,
          summary_source: slugify(group.label || "prompt-source"),
          method: adapterProfile.method,
          page_url: url,
          ...(adapterProfile.adapter === "adzuna" ? {
            country: "ca",
            location: "New Westminster, British Columbia",
            radius_km: 80,
            search_query: "manager",
            results_per_page: 50,
            max_pages: 3
          } : {}),
          search_url_template: searchUrlTemplate || undefined,
          keywords_profile: "level_1_keywords",
          excluded_title_keywords_profile: "level_1_excluded_title_keywords",
          excluded_exact_titles_profile: "level_1_excluded_exact_titles",
          excluded_organizations_profile: "level_1_excluded_organizations",
          excluded_post_keywords_profile: "level_1_excluded_post_keywords",
          excluded_work_options_profile: "level_1_excluded_work_options",
          notes: `Auto-registered from prompt group "${group.label}". Adapter selected by domain routing: ${adapterProfile.adapter}.`
        };
      })
  )
};

const mdLines = [
  "# JobOps Search Pages",
  "",
  `- generated_at: ${payload.generated_at}`,
  `- prompt_file: ${promptFile}`,
  `- auto_registered_source_count: ${runtimeRegistry.sources.length}`,
  "",
  "Estas paginas vienen del bloque `## Fuentes` del prompt.",
  "La columna `present_in_node_runtime` indica si la URL ya esta reflejada en la configuracion real de `config/sources.yaml`.",
  "La columna `auto_registered_runtime` indica si la URL fue promovida automaticamente al runtime mediante `automation/sources/jobops-runtime-registry.json`.",
  ""
];

for (const group of payload.groups) {
  mdLines.push(`## ${group.label}`);
  mdLines.push("");
  mdLines.push("| URL | present_in_node_runtime | auto_registered_runtime |");
  mdLines.push("| --- | --- | --- |");
  for (const item of group.urls) {
    const autoRegistered = runtimeRegistry.sources.some((source) => normalizeUrl(source.page_url) === normalizeUrl(item.url));
    mdLines.push(`| ${item.url} | ${item.present_in_node_runtime ? "si" : "no"} | ${autoRegistered ? "si" : "no"} |`);
  }
  mdLines.push("");
}

writeJson("automation/sources/jobops-prompt-sources.json", payload);
writeJson("automation/sources/jobops-runtime-registry.json", runtimeRegistry);
writeText("automation/docs/jobops-search-pages.md", `${mdLines.join("\n")}\n`);

console.log(JSON.stringify({
  step: "sync-prompt-sources",
  prompt_file: promptFile,
  group_count: payload.groups.length,
  output_json: "automation/sources/jobops-prompt-sources.json",
  runtime_registry_json: "automation/sources/jobops-runtime-registry.json",
  auto_registered_source_count: runtimeRegistry.sources.length,
  output_md: "automation/docs/jobops-search-pages.md"
}, null, 2));
