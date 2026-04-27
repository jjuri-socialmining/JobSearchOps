import { getByPath } from "../../lib/job-normalizer.mjs";

function mapRecord(record, endpoint) {
  const fieldMap = endpoint.field_map || {};
  return {
    organization: getByPath(record, fieldMap.organization || "organization") || endpoint.name || "Workday Source",
    title: getByPath(record, fieldMap.title || "title"),
    location: getByPath(record, fieldMap.location || "location"),
    remote_mode: getByPath(record, fieldMap.remote_mode || "remote_mode") || "",
    posted_at: getByPath(record, fieldMap.posted_at || "posted_at") || "",
    compensation: getByPath(record, fieldMap.compensation || "compensation") || "",
    description_snippet: getByPath(record, fieldMap.description || "description") || "",
    apply_url: getByPath(record, fieldMap.apply_url || "apply_url") || "",
    source_url: endpoint.endpoint_url || "",
    region: endpoint.region || "British Columbia",
    raw: record
  };
}

export async function captureFromSource(source) {
  const endpoints = Array.isArray(source.endpoints) ? source.endpoints : [];
  const jobs = [];

  for (const endpoint of endpoints) {
    if (!endpoint.endpoint_url) {
      continue;
    }
    const response = await fetch(endpoint.endpoint_url);
    const payload = await response.json();
    const records = getByPath(payload, endpoint.list_path || "jobPostings") || [];
    for (const record of records) {
      jobs.push(mapRecord(record, endpoint));
    }
  }

  return jobs;
}
