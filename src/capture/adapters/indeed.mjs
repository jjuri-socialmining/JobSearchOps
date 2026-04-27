function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeCdata(value) {
  return String(value || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function extractTag(xml, tagName) {
  const match = String(xml || "").match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return decodeCdata(match?.[1] || "");
}

function extractAttr(xml, tagName, attrName) {
  const match = String(xml || "").match(new RegExp(`<${tagName}[^>]+${attrName}=["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url, options = {}) {
  const attempts = Number(options.attempts || 3);
  const retryDelayMs = Number(options.retryDelayMs || 1000);
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; JobOpsBot/1.0; +https://jobsearchops.local)",
    "Accept": "application/rss+xml, application/xml, text/xml, */*"
  };
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers });
      if (response.status === 403) {
        throw new Error(`HTTP 403 — Indeed blocked the request. Try later or reduce request frequency.`);
      }
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

function parseItems(xml) {
  return [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
}

function extractOrganizationFromDescription(html) {
  // Indeed description HTML contains <b>Company Name</b> near the top or in a table cell
  const boldMatch = html.match(/<b>([^<]{2,80})<\/b>/i);
  if (boldMatch) {
    return stripHtml(boldMatch[1]);
  }
  return "";
}

function extractLocationFromDescription(html) {
  // Look for location patterns like "Vancouver, BC" or city names
  const text = stripHtml(html);
  const locationMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*BC(?:\s+[A-Z]\d[A-Z]\s*\d[A-Z]\d)?)/);
  if (locationMatch) {
    return locationMatch[1];
  }
  return "";
}

function extractSalaryFromDescription(html) {
  const text = stripHtml(html);
  const salaryMatch = text.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\s+a?\s*(?:year|month|hour|hr|annual))?/i);
  return salaryMatch?.[0] || "";
}

function mapItem(itemXml, source) {
  const title = stripHtml(extractTag(itemXml, "title"));
  const link = stripHtml(extractTag(itemXml, "link"));
  const descriptionHtml = extractTag(itemXml, "description");
  const description = stripHtml(descriptionHtml);
  const pubDate = stripHtml(extractTag(itemXml, "pubDate"));

  // <source url="...">Company Name</source> is the most reliable company field
  const companyFromSourceTag = stripHtml(extractTag(itemXml, "source"));
  const companyFromDescription = extractOrganizationFromDescription(descriptionHtml);
  const organization = companyFromSourceTag || companyFromDescription || source.name;

  const location = extractLocationFromDescription(descriptionHtml) || source.location || "British Columbia";
  const compensation = extractSalaryFromDescription(descriptionHtml);

  // Clean up the apply link — strip Indeed redirect wrappers
  const applyUrl = link;

  return {
    organization,
    title,
    location,
    remote_mode: "",
    posted_at: pubDate,
    compensation,
    description_snippet: description.slice(0, 500),
    apply_url: applyUrl,
    source_url: source.page_url || "https://ca.indeed.com",
    region: "British Columbia",
    raw: {
      descriptionHtml,
      pubDate,
      itemXml
    }
  };
}

function buildRssUrl(source, start = 0) {
  const baseEndpoint = (source.endpoint_url || "https://ca.indeed.com/rss").split("?")[0];
  const keywords = Array.isArray(source.keywords_any) ? source.keywords_any : [];

  // Use a configured search query, or fall back to the first keyword, or "manager"
  const searchQuery = source.search_query || keywords[0] || "manager";
  const location = source.location || "New Westminster, BC";
  const radius = source.radius_km != null ? String(source.radius_km) : "100";

  const params = new URLSearchParams({ q: searchQuery, l: location, sort: "date", radius });
  if (start > 0) {
    params.set("start", String(start));
  }

  return `${baseEndpoint}?${params.toString()}`;
}

export async function captureFromSource(_source) {
  throw new Error(
    "Indeed blocks all automated server-side access (HTTP 403/404). " +
    "Use adapter 'adzuna' as a replacement — it covers Indeed data and requires free API keys from https://developer.adzuna.com. " +
    "See config/sources.yaml for the adzuna-bc source."
  );
}

export async function captureFromSourceRss(source) {
  const maxPages = Number(source.max_pages || 5);
  const pageSize = 10; // Indeed RSS always returns 10 items per page
  const jobs = [];
  const seenLinks = new Set();

  for (let page = 0; page < maxPages; page += 1) {
    const start = page * pageSize;
    const url = buildRssUrl(source, start);

    let xml;
    try {
      const response = await fetchWithRetry(url);
      xml = await response.text();
    } catch (error) {
      // If the first page fails re-throw so source-runner records the error.
      // If a subsequent page fails, stop pagination gracefully.
      if (page === 0) {
        throw error;
      }
      break;
    }

    const items = parseItems(xml);
    if (!items.length) {
      break;
    }

    for (const itemXml of items) {
      const job = mapItem(itemXml, source);
      if (!job.title || !job.apply_url || seenLinks.has(job.apply_url)) {
        continue;
      }
      seenLinks.add(job.apply_url);
      jobs.push(job);
    }

    // Indeed RSS pages cap at ~100 total results. Stop when we get fewer than a full page.
    if (items.length < pageSize) {
      break;
    }

    // Polite delay between pages
    if (page < maxPages - 1) {
      await sleep(600);
    }
  }

  return jobs;
}
