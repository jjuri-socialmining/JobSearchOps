export async function captureFromSource(source) {
  const sites = Array.isArray(source.sites) ? source.sites : [];
  const jobs = [];

  for (const site of sites) {
    const url = `https://api.lever.co/v0/postings/${site}?mode=json`;
    const response = await fetch(url);
    const payload = await response.json();
    for (const record of payload || []) {
      jobs.push({
        organization: record?.categories?.team || site,
        title: record.text || "",
        location: record?.categories?.location || "",
        remote_mode: record?.categories?.commitment || "",
        posted_at: record.createdAt || "",
        apply_url: record.hostedUrl || record.applyUrl || "",
        source_url: url,
        region: "British Columbia",
        raw: record
      });
    }
  }

  return jobs;
}
