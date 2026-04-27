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

function decodeCdata(value) {
  return String(value || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function extractTag(xml, tagName) {
  const match = String(xml || "").match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return decodeCdata(match?.[1] || "");
}

function parseItems(xml) {
  return [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
}

function mapItem(itemXml, source) {
  const title = stripHtml(extractTag(itemXml, "title"));
  const link = stripHtml(extractTag(itemXml, "link"));
  const description = stripHtml(extractTag(itemXml, "description"));
  const pubDate = stripHtml(extractTag(itemXml, "pubDate"));
  const category = stripHtml(extractTag(itemXml, "category"));

  const organizationMatch = description.match(/Employer:\s*([^|]+?)(?:Location:|Category:|$)/i);
  const locationMatch = description.match(/Location:\s*([^|]+?)(?:Category:|$)/i);

  return {
    organization: stripHtml(organizationMatch?.[1] || source.name),
    title,
    location: stripHtml(locationMatch?.[1] || ""),
    remote_mode: "",
    posted_at: pubDate,
    compensation: "",
    description_snippet: description || category,
    apply_url: link,
    source_url: source.endpoint_url || source.page_url || "",
    region: "British Columbia",
    raw: {
      rss_item: itemXml,
      category,
      description,
      pubDate
    }
  };
}

export async function captureFromSource(source) {
  const endpointUrl = source.endpoint_url || "https://www.civicjobs.ca/rss/province.php?id=BC";
  const response = await fetchWithRetry(endpointUrl);
  const xml = await response.text();
  return parseItems(xml)
    .map((itemXml) => mapItem(itemXml, source))
    .filter((job) => job.title && job.apply_url);
}
