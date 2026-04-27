function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url, options = {}) {
  const attempts = Number(options.attempts || 3);
  const retryDelayMs = Number(options.retryDelayMs || 1000);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 120)}` : ""}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  throw lastError || new Error("fetch failed");
}

function buildSearchUrl(source, page = 1) {
  const appId = source.app_id || process.env.ADZUNA_APP_ID || "";
  const appKey = source.app_key || process.env.ADZUNA_APP_KEY || "";

  if (!appId || !appKey) {
    throw new Error(
      "Adzuna credentials missing. Set ADZUNA_APP_ID and ADZUNA_APP_KEY env vars, " +
      "or add app_id/app_key to the source config in sources.yaml. " +
      "Register free at https://developer.adzuna.com"
    );
  }

  const country = source.country || "ca";
  const keywords = Array.isArray(source.keywords_any) ? source.keywords_any : [];
  const searchQuery = source.search_query || keywords[0] || "manager";
  const location = source.location || "New Westminster, British Columbia";
  const distanceKm = source.radius_km != null ? String(source.radius_km) : "80";
  const resultsPerPage = String(source.results_per_page || 50);

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: resultsPerPage,
    what: searchQuery,
    where: location,
    distance: distanceKm,
    sort_by: "date",
    full_time: "1"
  });

  return `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;
}

function mapJob(item, source) {
  const organization = item.company?.display_name || "";
  const title = item.title || "";
  const location = item.location?.display_name || source.location || "British Columbia";
  const postedAt = item.created || "";
  const salary = item.salary_min && item.salary_max
    ? `$${Math.round(item.salary_min).toLocaleString()} – $${Math.round(item.salary_max).toLocaleString()} CAD/yr`
    : item.salary_min
      ? `from $${Math.round(item.salary_min).toLocaleString()} CAD/yr`
      : "";
  const applyUrl = item.redirect_url || item.source_url || "";
  const description = item.description || "";

  return {
    organization,
    title,
    location,
    remote_mode: "",
    posted_at: postedAt,
    compensation: salary,
    description_snippet: description.slice(0, 500),
    apply_url: applyUrl,
    source_url: source.page_url || "https://www.adzuna.ca",
    region: "British Columbia",
    raw: item
  };
}

export async function captureFromSource(source) {
  const maxPages = Number(source.max_pages || 3);
  const jobs = [];
  const seenUrls = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    const url = buildSearchUrl(source, page);

    let data;
    try {
      const response = await fetchWithRetry(url);
      data = await response.json();
    } catch (error) {
      if (page === 1) {
        throw error;
      }
      break;
    }

    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      break;
    }

    for (const item of results) {
      const job = mapJob(item, source);
      if (!job.title || !job.apply_url || seenUrls.has(job.apply_url)) {
        continue;
      }
      seenUrls.add(job.apply_url);
      jobs.push(job);
    }

    // Stop if we got fewer results than requested (last page)
    const resultsPerPage = Number(source.results_per_page || 50);
    if (results.length < resultsPerPage) {
      break;
    }

    if (page < maxPages) {
      await sleep(500);
    }
  }

  return jobs;
}
