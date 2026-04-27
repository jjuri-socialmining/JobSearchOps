import fs from "node:fs";
import { loadConfig } from "../src/lib/config-loader.mjs";
import { parseArgs, writeJson } from "../src/lib/file-utils.mjs";
import { enrichJobs } from "../src/enrich/ai-enrichment.mjs";
import { scoreJobs } from "../src/score/job-score.mjs";

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function shouldRefreshEnrichment(captureFile, enrichFile) {
  if (!fileExists(captureFile)) {
    return false;
  }
  if (!fileExists(enrichFile)) {
    return true;
  }
  return fs.statSync(captureFile).mtimeMs > fs.statSync(enrichFile).mtimeMs;
}

const args = parseArgs(process.argv.slice(2));
const pipeline = loadConfig(args.pipeline || "config/pipeline.yaml");
const scoring = loadConfig(args.scoring || pipeline.score?.scoring_config || "config/scoring.yaml");
const captureFile = pipeline.capture?.output_file;
const enrichFile = pipeline.enrich?.output_file;
const inputFile = args.input || (shouldRefreshEnrichment(captureFile, enrichFile) ? captureFile : enrichFile);
const outputFile = args.output || pipeline.score?.output_file;
const payload = JSON.parse(fs.readFileSync(inputFile, "utf8"));
const scoredInputJobs = inputFile === captureFile ? enrichJobs(payload.jobs || []) : payload.jobs || [];
const jobs = scoreJobs(scoredInputJobs, scoring);

if (!args.input && inputFile === captureFile && enrichFile) {
  writeJson(enrichFile, {
    ...payload,
    enriched_at: new Date().toISOString(),
    jobs: scoredInputJobs
  });
}

writeJson(outputFile, {
  ...payload,
  scored_at: new Date().toISOString(),
  jobs
});

writeJson("tmp/jobops-pipeline/latest-summary.json", {
  generated_at: new Date().toISOString(),
  source: payload.source || "unknown",
  keywords_used: payload.keywords_used || [],
  capture_file: pipeline.capture?.output_file,
  enrich_file: pipeline.enrich?.output_file,
  score_file: outputFile,
  job_count: jobs.length,
  decisions: jobs.reduce((acc, job) => {
    const key = job.decision?.status || "NO_DECISION";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})
});

console.log(JSON.stringify({
  step: "score",
  input_file: inputFile,
  output_file: outputFile,
  job_count: jobs.length
}, null, 2));
