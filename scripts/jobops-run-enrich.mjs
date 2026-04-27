import fs from "node:fs";
import { loadConfig } from "../src/lib/config-loader.mjs";
import { parseArgs, writeJson } from "../src/lib/file-utils.mjs";
import { enrichJobs } from "../src/enrich/ai-enrichment.mjs";

const args = parseArgs(process.argv.slice(2));
const pipeline = loadConfig(args.pipeline || "config/pipeline.yaml");
const inputFile = args.input || pipeline.capture?.output_file;
const outputFile = args.output || pipeline.enrich?.output_file;
const payload = JSON.parse(fs.readFileSync(inputFile, "utf8"));
const jobs = enrichJobs(payload.jobs || []);

writeJson(outputFile, {
  ...payload,
  enriched_at: new Date().toISOString(),
  jobs
});

console.log(JSON.stringify({
  step: "enrich",
  input_file: inputFile,
  output_file: outputFile,
  job_count: jobs.length
}, null, 2));
