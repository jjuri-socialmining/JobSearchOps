import { getByPath } from "../../lib/job-normalizer.mjs";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url, options = {}) {
  const attempts = Number(options.attempts || 3);
  const retryDelayMs = Number(options.retryDelayMs || 750);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
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

function mapRecord(record, source) {
  const fieldMap = source.field_map || {};
  return {
    organization: getByPath(record, fieldMap.organization || "organization") || "BC Government",
    title: getByPath(record, fieldMap.title || "title"),
    location: getByPath(record, fieldMap.location || "location"),
    remote_mode: getByPath(record, fieldMap.remote_mode || "remote_mode") || "",
    posted_at: getByPath(record, fieldMap.posted_at || "posted_at") || "",
    compensation: getByPath(record, fieldMap.compensation || "compensation") || "",
    description_snippet: getByPath(record, fieldMap.description || "description") || "",
    apply_url: getByPath(record, fieldMap.apply_url || "apply_url") || "",
    source_url: getByPath(record, fieldMap.source_url || "source_url") || source.page_url || "",
    region: "British Columbia",
    raw: record
  };
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(
    String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/ *\n */g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function matchesKeywords(job, source) {
  const keywords = Array.isArray(source.keywords_any) ? source.keywords_any : [];
  if (!keywords.length) {
    return true;
  }

  const haystack = `${job.title} ${job.organization} ${job.location}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(String(keyword || "").toLowerCase()));
}

function mapPublicBoardRow(columns, source) {
  const boardUrl = source.public_board_url || source.page_url || "";
  const organization = stripTags(columns[0]);
  const requisition = stripTags(columns[1]);
  const keyHtml = columns[2] || "";
  const titleMatch = keyHtml.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  const title = stripTags(titleMatch?.[2] || "");
  const applyUrl = titleMatch ? new URL(titleMatch[1], boardUrl).href : "";

  return {
    organization: organization || "BC Government",
    title,
    location: stripTags(columns[5]),
    remote_mode: stripTags(columns[4]),
    posted_at: stripTags(columns[6]),
    compensation: "",
    description_snippet: stripTags(keyHtml),
    apply_url: applyUrl,
    source_url: boardUrl,
    region: "British Columbia",
    raw: {
      requisition,
      organization,
      remote_mode: stripTags(columns[4]),
      location: stripTags(columns[5]),
      posted_at: stripTags(columns[6]),
      closed_at: stripTags(columns[7]),
      key_html: keyHtml
    }
  };
}

function parsePublicBoard(html, source) {
  const rows = [];
  const rowMatches = String(html || "").match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const rowHtml of rowMatches) {
    const columns = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (columns.length < 8) {
      continue;
    }

    const job = mapPublicBoardRow(columns, source);
    if (!job.title || !job.apply_url) {
      continue;
    }
    rows.push(job);
  }

  return rows;
}

function findNextPageUrl(html, currentUrl) {
  const base = new URL(currentUrl);

  // Look for pagination links: rel="next", text "Next", ">", or "»"
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const [, href, text] = match;
    const cleanText = text.replace(/<[^>]+>/g, "").trim().toLowerCase();
    if (cleanText === "next" || cleanText === ">" || cleanText === "»" || cleanText === "next page") {
      try {
        return new URL(href, base).href;
      } catch {
        // ignore malformed href
      }
    }
  }

  // Look for rel="next" on link tags
  const relNextMatch = html.match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']next["']/i);
  if (relNextMatch) {
    try {
      return new URL(relNextMatch[1], base).href;
    } catch {
      // ignore
    }
  }

  return null;
}

export async function captureFromSource(source) {
  if (source.endpoint_url) {
    const response = await fetchWithRetry(source.endpoint_url);
    const payload = await response.json();
    const listPath = source.list_path || "jobs";
    const records = getByPath(payload, listPath) || [];
    return records.map((record) => mapRecord(record, source));
  }

  if (!source.public_board_url) {
    return [];
  }

  // The external RMS quick-search flow redirects anonymous searches to login.
  // For Level 1 capture we use the public BC board and filter titles locally.
  // Paginate through all available pages.
  const maxPages = Number(source.max_pages || 0) || 50;
  const jobs = [];
  const visited = new Set();
  let currentUrl = source.public_board_url;

  for (let page = 1; page <= maxPages; page += 1) {
    if (visited.has(currentUrl)) {
      break;
    }
    visited.add(currentUrl);

    const response = await fetchWithRetry(currentUrl);
    const html = await response.text();
    const pageJobs = parsePublicBoard(html, source);
    jobs.push(...pageJobs);

    const nextUrl = findNextPageUrl(html, currentUrl);
    if (!nextUrl || visited.has(nextUrl)) {
      break;
    }
    currentUrl = nextUrl;

    // Brief pause between pages to be polite
    await sleep(500);
  }

  return jobs;
}
