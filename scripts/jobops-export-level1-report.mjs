import fs from "node:fs";
import { loadConfig } from "../src/lib/config-loader.mjs";
import { resolveRepoPath, writeJson, writeText } from "../src/lib/file-utils.mjs";
import { toJobOffersRow } from "../src/lib/job-normalizer.mjs";

function timestampForRunId(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function datePrefix(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function ensureDir(relativeDir) {
  fs.mkdirSync(resolveRepoPath(relativeDir), { recursive: true });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolveRepoPath(relativePath), "utf8"));
}

function fileExists(relativePath) {
  return fs.existsSync(resolveRepoPath(relativePath));
}

function copyRelativeFile(sourceRelativePath, targetRelativePath) {
  fs.copyFileSync(resolveRepoPath(sourceRelativePath), resolveRepoPath(targetRelativePath));
}

function collapseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripHtml(value) {
  return collapseWhitespace(
    String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

function truncate(value, maxLength) {
  const clean = collapseWhitespace(value);
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength - 3).trim()}...`;
}

function extractDetailField(html, label) {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<h5[^>]*>${safeLabel}<\\/h5>\\s*<(?:p|h5)[^>]*>([\\s\\S]*?)<\\/(?:p|h5)>`, "i");
  const match = html.match(regex);
  return stripHtml(match?.[1] || "");
}

function extractDescription(html) {
  const match = html.match(/<h3>Description<\/h3>\s*<div class="description">([\s\S]*?)<\/div>\s*<h3>/i);
  return match?.[1] || "";
}

function extractFirstStrongSection(descriptionHtml, sectionName) {
  const safeName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<strong>${safeName}<\\/strong><br\\s*\\/?>\\s*([\\s\\S]*?)<\\/(?:p|ul)>`, "i");
  const match = descriptionHtml.match(regex);
  return stripHtml(match?.[1] || "");
}

function extractBulletHighlights(descriptionHtml) {
  const items = [...descriptionHtml.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  return items.slice(0, 3);
}

async function fetchJobDetail(job) {
  if (!job.apply_url) {
    return null;
  }

  try {
    const response = await fetch(job.apply_url);
    if (!response.ok) {
      return null;
    }
    const html = await response.text();
    const descriptionHtml = extractDescription(html);
    return {
      salary: extractDetailField(html, "Salary"),
      workOption: extractDetailField(html, "Work Option"),
      location: extractDetailField(html, "Location(s)"),
      branch: extractDetailField(html, "Ministry Branch/Division"),
      jobType: stripHtml((html.match(/<p class="jobtype">Job Type: <strong>([\s\S]*?)<\/strong>/i) || [])[1] || ""),
      category: stripHtml((html.match(/<p class="jobcategory">Job Category: <strong>([\s\S]*?)<\/strong>/i) || [])[1] || ""),
      team: extractFirstStrongSection(descriptionHtml, "The Team"),
      role: extractFirstStrongSection(descriptionHtml, "The Role"),
      aboutPosition: extractFirstStrongSection(descriptionHtml, "About this Position:"),
      bullets: extractBulletHighlights(descriptionHtml)
    };
  } catch {
    return null;
  }
}

function summarizeOpportunity(job, detail) {
  const components = [];
  const salary = detail?.salary ? `Salario ${detail.salary}.` : "";
  const role = detail?.role ? truncate(detail.role, 170) : "";
  const branch = detail?.branch ? `Area: ${detail.branch}.` : "";
  const category = detail?.category ? `Categoria: ${detail.category}.` : "";
  const position = detail?.aboutPosition ? truncate(detail.aboutPosition, 110) : "";
  const bullets = Array.isArray(detail?.bullets) ? detail.bullets.slice(0, 2).join(" ") : "";

  components.push(salary);
  components.push(branch);
  components.push(category);
  components.push(role);
  components.push(position);
  components.push(bullets);

  const fallback = [
    collapseWhitespace(job.title),
    collapseWhitespace(job.organization),
    collapseWhitespace(job.location),
    collapseWhitespace(job.remote_mode)
  ].filter(Boolean).join(". ");

  return truncate(components.filter(Boolean).join(" "), 500) || truncate(fallback, 500);
}

function whyAttention(job, detail) {
  const reasons = [];
  const title = collapseWhitespace(job.title).toLowerCase();
  if (detail?.salary) {
    reasons.push("hay banda salarial visible");
  }
  if (/(portfolio|program|project|operations|business operations|policy|commercial|risk|compliance)/.test(title)) {
    reasons.push("encaja con la pista profesional objetivo");
  }
  if (/(remote|hybrid)/i.test(detail?.workOption || job.remote_mode || "")) {
    reasons.push("ofrece modalidad flexible");
  }
  if (detail?.branch) {
    reasons.push(`tiene impacto en ${collapseWhitespace(detail.branch).toLowerCase()}`);
  }
  if (detail?.bullets?.length) {
    reasons.push("expone requisitos diferenciadores claros");
  }

  const text = reasons.length
    ? `Poner atencion porque ${reasons.join(", ")}.`
    : "Poner atencion por encaje general con la ruta de desarrollo profesional.";
  return truncate(text, 180);
}

function professionalDevelopmentIntensity(job, detail) {
  const title = collapseWhitespace(job.title).toLowerCase();
  const score = Number(job.score?.total || 0);
  if (/(director|executive|band 5|band 4|senior manager|portfolio manager)/.test(title) || score >= 88 || detail?.salary) {
    return "Muy alta";
  }
  if (/(manager|program manager|project manager|operations manager|audit manager|policy manager)/.test(title) || score >= 80) {
    return "Alta";
  }
  if (score >= 70) {
    return "Media";
  }
  return "Exploratoria";
}

function triageSortValue(job) {
  const title = collapseWhitespace(job.title).toLowerCase();
  let bonus = 0;
  if (/(portfolio manager|program manager|project manager|operations manager|business operations)/.test(title)) {
    bonus += 12;
  }
  if (/(senior manager|director|executive|band 4|band 5)/.test(title)) {
    bonus += 8;
  }
  if (/(hybrid|remote)/i.test(`${job.remote_mode || ""} ${job.location || ""}`)) {
    bonus += 4;
  }
  return Number(job.score?.total || 0) + bonus;
}

function companyNoteLink(organization) {
  const clean = collapseWhitespace(organization).replace(/[\[\]]/g, "");
  return `[[~ ${clean}]]`;
}

function sourceLabel(job) {
  return collapseWhitespace(job.source_display_name || job.source_name || job.source_id || "");
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildPromptOrderMap() {
  const order = new Map();
  let index = 1;

  for (const relativePath of ["automation/sources/jobops-prompt-sources.json", "automation/sources/jobops-runtime-registry.json"]) {
    if (!fileExists(relativePath)) {
      continue;
    }
    const payload = readJson(relativePath);
    if (Array.isArray(payload.groups)) {
      for (const group of payload.groups) {
        for (const item of group.urls || []) {
          const url = normalizeUrl(item.url || item);
          if (url && !order.has(url)) {
            order.set(url, index++);
          }
        }
      }
      continue;
    }
    if (Array.isArray(payload.sources)) {
      const sorted = [...payload.sources].sort((left, right) => {
        const leftGroup = Number(left.prompt_group_order || 0);
        const rightGroup = Number(right.prompt_group_order || 0);
        if (leftGroup !== rightGroup) {
          return leftGroup - rightGroup;
        }
        return Number(left.prompt_url_order || 0) - Number(right.prompt_url_order || 0);
      });
      for (const item of sorted) {
        const url = normalizeUrl(item.page_url || item.public_board_url || item.endpoint_url || "");
        if (url && !order.has(url)) {
          order.set(url, index++);
        }
      }
    }
  }

  return order;
}

function sourceSortKey(item, promptOrderMap) {
  const candidateUrls = [
    item.source_access_url,
    item.source_url,
    item.source_navigation_url,
    item.page_url,
    item.public_board_url,
    item.endpoint_url
  ]
    .map((value) => normalizeUrl(value))
    .filter(Boolean);

  for (const url of candidateUrls) {
    if (promptOrderMap.has(url)) {
      return promptOrderMap.get(url);
    }
  }

  const explicitGroup = Number(item.prompt_group_order || 0);
  const explicitUrl = Number(item.prompt_url_order || 0);
  if (explicitGroup > 0) {
    return explicitGroup * 100 + (explicitUrl > 0 ? explicitUrl : 99);
  }

  return 9999;
}

function buildMarkdownTable(rows) {
  if (!rows.length) {
    return "| Estado | Nota |\n| --- | --- |\n| sin resultados | No hubo ofertas capturadas |\n";
  }
  const columns = Object.keys(rows[0]);
  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => {
    const values = columns.map((column) => String(row[column] ?? "").replaceAll("|", "\\|").replaceAll("\n", " "));
    return `| ${values.join(" | ")} |`;
  });
  return `${header}\n${separator}\n${body.join("\n")}\n`;
}

function buildSourceDiagnostics(sourceRuns, promptOrderMap) {
  function formatSourceLink(item) {
    const label = item.source_display_name || item.source_name || item.source_id || "";
    const navigationUrl = String(item.source_navigation_url || item.source_access_url || "").trim();
    if (!navigationUrl) {
      return label;
    }
    return `[${label}](${navigationUrl})`;
  }

  const rows = [...(Array.isArray(sourceRuns) ? sourceRuns : [])]
    .sort((left, right) => sourceSortKey(left, promptOrderMap) - sourceSortKey(right, promptOrderMap))
    .map((item) => ({
    Fuente: formatSourceLink(item),
    Estado: item.status || "",
    Config: item.configured ? "si" : "no",
    "Capture Method": item.capture_method || "",
    "Jobs Raw": item.job_count_raw ?? 0,
    "Jobs Final": item.job_count_after_filters ?? 0,
    Filtradas: item.filtered_out_count ?? 0,
    "LLM Tokens": item.llm_tokens_total == null ? "n/a" : item.llm_tokens_total,
    Nota: item.status_note || ""
  }));
  return buildMarkdownTable(rows);
}

function buildSourceSections(jobs, promptOrderMap) {
  const groups = new Map();
  for (const job of jobs) {
    const key = job.source_display_name || job.source_name || job.source_id || "Unknown Source";
    if (!groups.has(key)) {
      groups.set(key, { representative: job, jobs: [] });
    }
    groups.get(key).jobs.push(job);
  }

  const sections = [];
  for (const [sourceName, group] of [...groups.entries()].sort((left, right) =>
    sourceSortKey(left[1].representative, promptOrderMap) - sourceSortKey(right[1].representative, promptOrderMap)
  )) {
    const rows = group.jobs
      .map((job) => toJobOffersRow(job))
      .sort((left, right) => Number(right.Ranking || 0) - Number(left.Ranking || 0));
    sections.push(`## ${sourceName}`);
    sections.push("");
    sections.push(buildMarkdownTable(rows));
  }
  return sections.join("\n");
}

async function buildExpressTriage(jobs, promptOrderMap) {
  const triagedJobs = [...jobs].sort((left, right) => {
    const leftOrder = sourceSortKey(left, promptOrderMap);
    const rightOrder = sourceSortKey(right, promptOrderMap);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftSource = String(left.source_display_name || left.source_name || left.source_id || "");
    const rightSource = String(right.source_display_name || right.source_name || right.source_id || "");
    if (leftSource !== rightSource) {
      return leftSource.localeCompare(rightSource);
    }

    return triageSortValue(right) - triageSortValue(left);
  });
  const detailsByAlias = {};

  for (const job of triagedJobs) {
    detailsByAlias[job.normalized?.alias || job.apply_url || job.title] = await fetchJobDetail(job);
  }

  const rows = [
    "| Num | Fuente | Titulo | Resumen | Organizacion | Link | Posted |",
    "| --- | --- | --- | --- | --- | --- | --- |"
  ];

  triagedJobs.forEach((job, index) => {
    const detail = detailsByAlias[job.normalized?.alias || job.apply_url || job.title];
    const fuente = sourceLabel(job);
    const title = collapseWhitespace(job.title).replace(/\|/g, "\\|");
    const summary = `${summarizeOpportunity(job, detail)} ${whyAttention(job, detail)}`.replace(/\|/g, "\\|");
    const organization = companyNoteLink(job.organization).replace(/\|/g, "\\|");
    const link = job.apply_url ? `[Oferta](${job.apply_url})` : "";
    const posted = collapseWhitespace(job.posted_at);
    rows.push(`| ${index + 1} | ${fuente} | ${title} | ${summary} | ${organization} | ${link} | ${posted} |`);
  });

  return rows.join("\n");
}

const pipeline = loadConfig("config/pipeline.yaml");
const captureFile = pipeline.capture?.output_file || "tmp/jobops-pipeline/latest-capture.json";
const scoredFile = pipeline.score?.output_file || "tmp/jobops-pipeline/latest-scored.json";
const summaryFile = "tmp/jobops-pipeline/latest-summary.json";

const scoredPayload = readJson(scoredFile);
const currentSummary = fs.existsSync(resolveRepoPath(summaryFile)) ? readJson(summaryFile) : {};
const now = new Date();
const source = scoredPayload.source || currentSummary.source || "unknown-source";
const runId = timestampForRunId(now);
const runDir = `tmp/jobops-pipeline/runs/${runId}-${source}-level1`;
const uniqueMdName = `${datePrefix(now)} - ${source} - level1-joboffers.md`;
const uniqueMdFile = `${runDir}/${uniqueMdName}`;
const latestMdFile = "tmp/jobops-pipeline/latest-level1-jobs.md";
const jobs = Array.isArray(scoredPayload.jobs) ? scoredPayload.jobs : [];
const promptOrderMap = buildPromptOrderMap();

ensureDir(runDir);

const sourceDiagnosticsMarkdown = buildSourceDiagnostics(scoredPayload.source_runs || currentSummary.source_runs || [], promptOrderMap);
const sourceSectionsMarkdown = buildSourceSections(jobs, promptOrderMap);
const expressTriageMarkdown = await buildExpressTriage(jobs, promptOrderMap);
const metadataLines = [
  "# Latest JobOps Level 1 Jobs",
  "",
  `- source: ${source}`,
  `- run_id: ${runId}`,
  `- report_md_file: ${uniqueMdFile}`,
  "",
  `# ${datePrefix(now)} - JobOps Level 1 - ${source}`,
  "",
  `- run_id: ${runId}`,
  `- source: ${source}`,
  `- keywords_used: ${(scoredPayload.keywords_used || []).join("; ")}`,
  `- excluded_title_keywords: ${(scoredPayload.exclusions_used?.excluded_title_keywords || []).join("; ")}`,
  `- excluded_exact_titles: ${(scoredPayload.exclusions_used?.excluded_exact_titles || []).join("; ")}`,
  `- excluded_organizations: ${(scoredPayload.exclusions_used?.excluded_organizations || []).join("; ")}`,
  `- excluded_post_keywords: ${(scoredPayload.exclusions_used?.excluded_post_keywords || []).join("; ")}`,
  `- excluded_work_options: ${(scoredPayload.exclusions_used?.excluded_work_options || []).join("; ")}`,
  `- job_count: ${jobs.length}`
].join("\n");
const reportMarkdown = [
  "# Latest JobOps Level 1 Jobs",
  "",
  ...(source === "multi-source"
    ? [
        "## Seguimiento Por Fuente",
        "",
        sourceDiagnosticsMarkdown,
        "",
        "## Express Triage",
        "",
        expressTriageMarkdown,
        "",
        "## Ofertas Por Fuente",
        "",
        sourceSectionsMarkdown,
        "",
        metadataLines
      ]
    : [
        "## Express Triage",
        "",
        expressTriageMarkdown,
        "",
        "## Seguimiento Por Fuente",
        "",
        sourceDiagnosticsMarkdown,
        "",
        "## Ofertas Por Fuente",
        "",
        sourceSectionsMarkdown,
        "",
        metadataLines
      ])
].join("\n");

writeText(uniqueMdFile, reportMarkdown);
writeText(latestMdFile, reportMarkdown);
writeText("tmp/jobops-pipeline/latest-all-sites-jobs.md", reportMarkdown);

copyRelativeFile(captureFile, `${runDir}/latest-capture.json`);
copyRelativeFile(scoredFile, `${runDir}/latest-scored.json`);

const updatedSummary = {
  ...currentSummary,
  generated_at: new Date().toISOString(),
  source,
  run_id: runId,
  run_dir: runDir,
  report_md_file: uniqueMdFile,
  latest_md_file: latestMdFile
};

writeJson(`${runDir}/latest-summary.json`, updatedSummary);
writeJson(summaryFile, updatedSummary);

console.log(JSON.stringify({
  step: "export-level1-report",
  source,
  run_id: runId,
  report_md_file: uniqueMdFile,
  latest_md_file: latestMdFile,
  job_count: jobs.length
}, null, 2));
