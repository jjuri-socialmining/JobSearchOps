import { discoverCanadaCaJobs } from "../../../Tools/job-source-adapters/canada-ca.adapter.mjs";

export async function captureFromSource(source) {
  return discoverCanadaCaJobs(source);
}
