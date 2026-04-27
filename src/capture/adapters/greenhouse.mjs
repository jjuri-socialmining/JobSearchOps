export async function captureFromSource(source) {
  const boardTokens = Array.isArray(source.board_tokens) ? source.board_tokens : [];
  const jobs = [];

  for (const boardToken of boardTokens) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`;
    const response = await fetch(url);
    const payload = await response.json();
    for (const record of payload.jobs || []) {
      jobs.push({
        organization: record?.company_name || source.name || boardToken,
        title: record.title || "",
        location: record?.location?.name || "",
        posted_at: record.updated_at || "",
        apply_url: record.absolute_url || "",
        source_url: url,
        region: "British Columbia",
        raw: record
      });
    }
  }

  return jobs;
}
