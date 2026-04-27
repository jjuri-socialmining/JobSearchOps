import { loadConfig } from "../src/lib/config-loader.mjs";
import { parseArgs } from "../src/lib/file-utils.mjs";
import { runCapture } from "../src/capture/source-runner.mjs";

const args = parseArgs(process.argv.slice(2));
const pipeline = loadConfig(args.pipeline || "config/pipeline.yaml");
const outputFile = args.output || pipeline.capture?.output_file;
const result = await runCapture({
  sourcesConfigPath: args.sources || pipeline.capture?.sources_config,
  outputFile,
  sourceId: args.source
});

console.log(JSON.stringify({
  step: "capture",
  source_count: result.source_count,
  job_count: result.job_count,
  output_file: outputFile,
  errors: result.errors
}, null, 2));
