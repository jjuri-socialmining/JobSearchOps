import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Carga .env desde JobSearchOps/ sin importar desde dónde se ejecuta npm
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

import { loadConfig } from "../src/lib/config-loader.mjs";
import { runCapture } from "../src/capture/source-runner.mjs";
import { enrichJobs } from "../src/enrich/ai-enrichment.mjs";
import { fetchJobDescriptions } from "../src/enrich/jd-fetcher.mjs";
import { summarizeJobDescriptions } from "../src/enrich/jd-summarizer.mjs";
import { scoreJobs } from "../src/score/job-score.mjs";
import { storeToSheetsPayload } from "../src/store/sheets-store.mjs";
import { exportObsidianMarkdown } from "../src/store/obsidian-export.mjs";
import { writeOpportunityInventory } from "../src/handoff/write-inventory.mjs";
import { writeJson, writeText } from "../src/lib/file-utils.mjs";

const pipeline = loadConfig("config/pipeline.yaml");
const scoring = loadConfig(pipeline.score?.scoring_config || "config/scoring.yaml");

const capturePayload = await runCapture({
  sourcesConfigPath: pipeline.capture?.sources_config,
  outputFile: pipeline.capture?.output_file
});

// --- enrich heurístico (señales internas) ---
const enrichedJobs = enrichJobs(capturePayload.jobs || []);

// --- JD fetch: busca descripción completa por oferta ---
console.error(`\n[pipeline] JD fetch para ${enrichedJobs.length} jobs...`);
const fetchedJobs = await fetchJobDescriptions(enrichedJobs, {
  rateLimitMs: pipeline.enrich?.jd_fetch_rate_ms ?? 800,
  maxJobs: pipeline.enrich?.jd_fetch_max ?? 50
});

// --- JD summarizer: Claude genera resumen operativo ---
console.error(`\n[pipeline] JD summarize...`);
const summarizedJobs = await summarizeJobDescriptions(fetchedJobs, {
  rateLimitMs: pipeline.enrich?.jd_summarize_rate_ms ?? 500
});

writeJson(pipeline.enrich?.output_file, {
  ...capturePayload,
  enriched_at: new Date().toISOString(),
  jobs: summarizedJobs
});

const scoredJobs = scoreJobs(summarizedJobs, scoring);
writeJson(pipeline.score?.output_file, {
  ...capturePayload,
  scored_at: new Date().toISOString(),
  jobs: scoredJobs
});

if (pipeline.store?.sheets?.enabled !== false) {
  storeToSheetsPayload(scoredJobs, pipeline.store?.sheets?.output_file);
} else {
  storeToSheetsPayload(scoredJobs, pipeline.store?.sheets?.output_file);
}

if (pipeline.store?.obsidian?.enabled !== false) {
  exportObsidianMarkdown(scoredJobs, pipeline.store?.obsidian?.output_file);
}

const summary = {
  generated_at: new Date().toISOString(),
  source: capturePayload.source || "unknown",
  keywords_used: capturePayload.keywords_used || [],
  exclusions_used: capturePayload.exclusions_used || {},
  capture_file: pipeline.capture?.output_file,
  enrich_file: pipeline.enrich?.output_file,
  score_file: pipeline.score?.output_file,
  sheets_file: pipeline.store?.sheets?.output_file,
  obsidian_file: pipeline.store?.obsidian?.output_file,
  source_runs: capturePayload.source_runs || [],
  job_count: scoredJobs.length,
  decisions: scoredJobs.reduce((acc, job) => {
    const key = job.decision?.status || "SIN_DECISION";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})
};

writeJson("tmp/jobops-pipeline/latest-summary.json", summary);

// --- snapshot histórico: cada corrida queda auditada en runs/ ---
const runId = new Date().toISOString().replace(/[-:]/g, "").replace("T", "T").slice(0, 16) + "Z";
const source = (capturePayload.source || "multi-source").replace(/\s+/g, "_").toLowerCase();
const runDir = `tmp/jobops-pipeline/runs/${runId}-${source}-full`;

writeJson(`${runDir}/summary.json`, summary);
writeJson(`${runDir}/scored.json`, { ...capturePayload, scored_at: summary.generated_at, jobs: scoredJobs });
writeText(`${runDir}/decisions.md`, [
  `# Run ${runId}`,
  ``,
  `- source: ${source}`,
  `- generated_at: ${summary.generated_at}`,
  `- job_count: ${summary.job_count}`,
  `- sources: ${summary.source_runs.map(r => `${r.source_id}(${r.job_count_after_filters})`).join(", ")}`,
  ``,
  `## Decisions`,
  ...Object.entries(summary.decisions).map(([k, v]) => `- ${k}: ${v}`),
  ``,
  `## Jobs`,
  `| Score | Priority | Title | Organization | Status |`,
  `| --- | --- | --- | --- | --- |`,
  ...scoredJobs.map(j =>
    `| ${j.score?.total ?? ""} | ${j.score?.priority ?? ""} | ${j.title} | ${j.organization} | ${j.decision?.status ?? ""} |`
  )
].join("\n"));

// --- handoff → JobOffersOps ---
const handoffResult = writeOpportunityInventory(scoredJobs, pipeline, runId);
if (handoffResult) {
  console.error(`\n[pipeline] Handoff → ${handoffResult.path}`);
  console.error(`  ${handoffResult.count} jobs incluidos, ${handoffResult.discarded_blacklist} descartados por blacklist`);
  summary.handoff = handoffResult;
}

console.log(JSON.stringify(summary, null, 2));
console.log(`\n✓ Run snapshot saved → ${runDir}/`);
if (handoffResult) {
  console.log(`✓ Opportunity inventory → JobOffersOps/intake/opportunity-inventory.json`);
  console.log(`  Siguiente paso: npm run jobops:qc`);
}
