import { getByPath } from "../../lib/job-normalizer.mjs";

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsoluteUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function truncate(value, maxLength = 240) {
  const clean = String(value || "").trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength - 3).trim()}...`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "JobOps-OS/1.0 (+generic-careers-page)"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

function discoverHtmlJobs(pageUrl, html, source, fallbackName) {
  const pageTitle = stripHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const metaDescription = stripHtml((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) || [])[1] || "");
  const firstText = truncate(stripHtml(html).slice(0, 1200), 320);
  const organization = fallbackName || source.name;
  const jobs = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html))) {
    const href = toAbsoluteUrl(pageUrl, match[1]);
    const title = stripHtml(match[2]);
    const signature = `${href}::${title}`.toLowerCase();
    if (!href || !title || seen.has(signature)) {
      continue;
    }
    seen.add(signature);

    const haystack = `${href} ${title}`.toLowerCase();
    if (!/(job|jobs|career|careers|opportunit|apply|posting|vacan|position|recruit)/.test(haystack)) {
      continue;
    }

    jobs.push({
      organization,
      title,
      location: source.region || "Canada",
      remote_mode: "",
      posted_at: "",
      compensation: "",
      description_snippet: truncate(metaDescription || firstText, 320),
      apply_url: href,
      source_url: pageUrl,
      region: source.region || "Canada",
      raw: {
        discovery_type: "html-link",
        page_title: pageTitle,
        page_url: pageUrl
      }
    });

    if (jobs.length >= 20) {
      break;
    }
  }

  if (!jobs.length) {
    jobs.push({
      organization,
      title: pageTitle || `Registered source page - ${organization}`,
      location: source.region || "Canada",
      remote_mode: "",
      posted_at: "",
      compensation: "",
      description_snippet: truncate(metaDescription || firstText, 320),
      apply_url: pageUrl,
      source_url: pageUrl,
      region: source.region || "Canada",
      raw: {
        discovery_type: "html-page-fallback",
        page_title: pageTitle,
        page_url: pageUrl
      }
    });
  }

  return jobs;
}

function mapManualJob(job, source, fallbackName) {
  return {
    organization: job.organization || fallbackName || source.name,
    title: job.title || "",
    location: job.location || "",
    remote_mode: job.remote_mode || "",
    posted_at: job.posted_at || "",
    compensation: job.compensation || "",
    description_snippet: job.description_snippet || "",
    apply_url: job.apply_url || "",
    source_url: job.source_url || source.page_url || "",
    region: job.region || "British Columbia",
    raw: job
  };
}

function mapRemoteRecord(record, item, source) {
  const fieldMap = item.field_map || {};
  return {
    organization: getByPath(record, fieldMap.organization || "organization") || item.name || source.name,
    title: getByPath(record, fieldMap.title || "title"),
    location: getByPath(record, fieldMap.location || "location"),
    remote_mode: getByPath(record, fieldMap.remote_mode || "remote_mode") || "",
    posted_at: getByPath(record, fieldMap.posted_at || "posted_at") || "",
    compensation: getByPath(record, fieldMap.compensation || "compensation") || "",
    description_snippet: getByPath(record, fieldMap.description || "description") || "",
    apply_url: getByPath(record, fieldMap.apply_url || "apply_url") || "",
    source_url: item.endpoint_url || source.page_url || "",
    region: item.region || "British Columbia",
    raw: record
  };
}

export async function captureFromSource(source) {
  const jobs = [];

  if (source.page_url && !Array.isArray(source.sources) && !Array.isArray(source.manual_jobs)) {
    const html = await fetchText(source.page_url);
    jobs.push(...discoverHtmlJobs(source.page_url, html, source));
  }

  if (Array.isArray(source.manual_jobs)) {
    for (const job of source.manual_jobs) {
      jobs.push(mapManualJob(job, source));
    }
  }

  if (Array.isArray(source.sources)) {
    for (const item of source.sources) {
      if (Array.isArray(item.manual_jobs)) {
        for (const job of item.manual_jobs) {
          jobs.push(mapManualJob(job, source, item.name));
        }
      }
      if (item.endpoint_url) {
        const response = await fetch(item.endpoint_url);
        const payload = await response.json();
        const records = getByPath(payload, item.list_path || "jobs") || [];
        for (const record of records) {
          jobs.push(mapRemoteRecord(record, item, source));
        }
        continue;
      }
      if (item.page_url) {
        const html = await fetchText(item.page_url);
        jobs.push(...discoverHtmlJobs(item.page_url, html, source, item.name));
      }
    }
  }

  return jobs;
}
