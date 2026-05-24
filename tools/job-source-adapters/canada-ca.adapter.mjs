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
      const response = await fetch(url, {
        headers: {
          "user-agent": "JobOps-OS/1.0 (+canada-ca-adapter)"
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
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

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, maxLength = 320) {
  const clean = stripHtml(value);
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength - 3).trim()}...`;
}

function toAbsoluteUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function canonicalOrganization(url) {
  const text = String(url || "").toLowerCase();
  if (text.includes("treasury-board-secretariat")) {
    return "Treasury Board of Canada Secretariat";
  }
  return "Government of Canada";
}

function pickMainContent(html) {
  const mainMatch = String(html || "").match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
  return mainMatch?.[1] || String(html || "");
}

function extractPageMetadata(html, pageUrl) {
  const pageTitle = stripHtml((String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const metaDescription = stripHtml(
    (String(html || "").match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) || [])[1] || ""
  );
  return {
    page_title: pageTitle,
    meta_description: metaDescription,
    organization: canonicalOrganization(pageUrl)
  };
}

function extractLinksFromContent(contentHtml, pageUrl) {
  const links = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(contentHtml))) {
    const href = toAbsoluteUrl(pageUrl, match[1]);
    const text = stripHtml(match[2]);
    const signature = `${href}::${text}`.toLowerCase();
    if (!href || !text || seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    links.push({ href, text });
  }

  return links;
}

function scoreCandidate(link) {
  const haystack = `${link.text} ${link.href}`.toLowerCase();
  let score = 0;
  if (/job|jobs|opportunit|careers|career|recruit|position|vacan/.test(haystack)) {
    score += 4;
  }
  if (/operations|management|manager|program|project|commercial|risk|policy|contracts|procurement/.test(haystack)) {
    score += 5;
  }
  if (/jobs\.gc\.ca|canada\.ca/.test(haystack)) {
    score += 2;
  }
  if (/apply|selection|inventory|poster|poster proces|job opportunities/.test(haystack)) {
    score += 1;
  }
  return score;
}

function mapCandidatesToJobs(candidates, source, metadata) {
  return candidates.map((candidate) => ({
    organization: metadata.organization || source.name,
    title: candidate.text,
    location: source.region || "Canada",
    remote_mode: "",
    posted_at: "",
    compensation: "",
    description_snippet: truncate(metadata.meta_description || metadata.page_title),
    apply_url: candidate.href,
    source_url: source.page_url || "",
    region: source.region || "Canada",
    raw: {
      discovery_type: "canada-ca-link",
      page_title: metadata.page_title,
      page_url: source.page_url || "",
      link_score: candidate.score
    }
  }));
}

export async function discoverCanadaCaJobs(source) {
  const pageUrl = source.page_url;
  if (!pageUrl) {
    throw new Error("Missing page_url for canada-ca source");
  }

  const response = await fetchWithRetry(pageUrl, source.fetch || {});
  const html = await response.text();
  const mainContent = pickMainContent(html);
  const metadata = extractPageMetadata(html, pageUrl);
  const links = extractLinksFromContent(mainContent, pageUrl);
  const candidates = links
    .map((link) => ({ ...link, score: scoreCandidate(link) }))
    .filter((link) => link.score >= 4)
    .sort((left, right) => right.score - left.score)
    .slice(0, Number(source.max_candidates || 25));

  if (!candidates.length) {
    return [];
  }

  return mapCandidatesToJobs(candidates, source, metadata);
}
