import { toJobOffersRow } from "../lib/job-normalizer.mjs";
import { writeJson } from "../lib/file-utils.mjs";

export function buildSheetsPayload(jobs) {
  return {
    exported_at: new Date().toISOString(),
    columns: Object.keys(toJobOffersRow(jobs[0] || {
      captured_at: new Date().toISOString(),
      normalized: {},
      enrichment: {},
      score: {},
      decision: {}
    })),
    rows: jobs.map(toJobOffersRow)
  };
}

export function storeToSheetsPayload(jobs, outputFile) {
  const payload = buildSheetsPayload(jobs);
  if (outputFile) {
    writeJson(outputFile, payload);
  }
  return payload;
}
