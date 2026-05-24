/**
 * WAT Tool: jobops-check-open
 * Verifies whether each job posting URL is still open.
 * Updates latest-scored.json in place with is_open: true | false | null
 *
 * bc-gov    → GET + HTML pattern check
 * adzuna-bc → GET; if final URL still on adzuna.ca check pattern; if redirected to employer → open
 * civicjobs → null (Cloudflare 403, not checkable)
 * others    → null
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot   = path.resolve(__dirname, "..");
const SCORED_PATH = path.join(repoRoot, "tmp/jobops-pipeline/latest-scored.json");
const RATE_MS    = 350;
const TIMEOUT_MS = 8000;

const CLOSED_PATTERNS = [
  /this job posting is now closed/i,
  /posting closed/i,
  /unfortunately,?\s*this job is no longer available/i,
  /this job is no longer available/i,
  /job has been filled/i,
  /no longer accepting applications/i,
  /position has been filled/i,
  /this position is closed/i,
  /this listing has expired/i,
  /job has expired/i,
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkUrl(url, sourceId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "JobOps-OS/1.0 (+status-check)" },
    });
    clearTimeout(timer);

    if (res.status === 404 || res.status === 410) return false;
    if (!res.ok) return null;

    const finalUrl = res.url || url;
    const body = await res.text();

    if (sourceId === "adzuna-bc") {
      // Only trust pattern check when we stayed on adzuna.ca
      // If redirected to employer site, the patterns might match incidentally
      const stayedOnAdzuna = finalUrl.includes("adzuna.ca") || finalUrl.includes("adzuna.com");
      if (stayedOnAdzuna) {
        for (const pat of CLOSED_PATTERNS) {
          if (pat.test(body)) return false;
        }
        return true;
      }
      // Redirected to employer ATS — assume active
      return true;
    }

    // bc-gov and any other checkable source
    for (const pat of CLOSED_PATTERNS) {
      if (pat.test(body)) return false;
    }
    return true;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

if (!fs.existsSync(SCORED_PATH)) {
  console.error("[check-open] latest-scored.json not found — run jobops:full first");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(SCORED_PATH, "utf8"));
const jobs  = data.jobs || [];

const CHECKABLE = new Set(["bc-gov", "adzuna-bc"]);
const toCheck   = jobs.filter(j => CHECKABLE.has(j.source_id) && j.apply_url);
const skipped   = jobs.filter(j => !CHECKABLE.has(j.source_id));

// Mark unchecked sources as null
for (const j of skipped) j.is_open = null;

console.error(`[check-open] ${toCheck.length} URLs to check · ${skipped.length} skipped (civicjobs/other — not verifiable)`);

let open = 0, closed = 0, unknown = 0;

for (let i = 0; i < toCheck.length; i++) {
  const job    = toCheck[i];
  const result = await checkUrl(job.apply_url, job.source_id);
  job.is_open  = result;

  if (result === true)  open++;
  else if (result === false) closed++;
  else unknown++;

  const icon = result === true ? "✓" : result === false ? "✗ CERRADA" : "?";
  console.error(`  [${i + 1}/${toCheck.length}] ${icon} — ${(job.title || "").slice(0, 55)}`);

  if (i < toCheck.length - 1) await sleep(RATE_MS);
}

fs.writeFileSync(SCORED_PATH, JSON.stringify(data, null, 2), "utf8");
console.error(`[check-open] open:${open}  cerradas:${closed}  sin verificar:${unknown}`);
