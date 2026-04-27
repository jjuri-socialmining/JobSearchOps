import fs from "node:fs";
import { loadConfig } from "../src/lib/config-loader.mjs";
import { runCapture } from "../src/capture/source-runner.mjs";
import { enrichJobs } from "../src/enrich/ai-enrichment.mjs";
import { scoreJobs } from "../src/score/job-score.mjs";
import { storeToSheetsPayload } from "../src/store/sheets-store.mjs";
import { exportObsidianMarkdown } from "../src/store/obsidian-export.mjs";
import { writeJson } from "../src/lib/file-utils.mjs";

const pipeline = loadConfig("config/pipeline.yaml");
const scoring = loadConfig(pipeline.score?.scoring_config || "config/scoring.yaml");

const capturePayload = await runCapture({
  sourcesConfigPath: pipeline.capture?.sources_config,
  outputFile: pipeline.capture?.output_file
});

const enrichedJobs = enrichJobs(capturePayload.jobs || []);
writeJson(pipeline.enrich?.output_file, {
  ...capturePayload,
  enriched_at: new Date().toISOString(),
  jobs: enrichedJobs
});

const scoredJobs = scoreJobs(enrichedJobs, scoring);
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
console.log(JSON.stringify(summary, null, 2));
