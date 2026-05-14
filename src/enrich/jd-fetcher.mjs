/**
 * JD Fetcher — Paso 2 del Sprint 1
 *
 * Para cada job que pasó Level 1, va a buscar la descripción completa.
 * Estrategia: fetch HTML → extrae texto relevante → guarda en job.jd_raw
 *
 * Limitaciones conocidas:
 * - LinkedIn bloquea scraping → skip silencioso
 * - Algunos ATS requieren autenticación → skip con nota
 * - Rate limiting: 1 request cada 800ms por defecto
 */

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function extractTextFromHtml(html) {
  // Elimina scripts, styles, nav, footer — deja solo contenido
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 6000); // max chars para no exceder contexto de Claude
}

function isSkippableUrl(url) {
  const skippable = ["linkedin.com", "glassdoor.com", "adzuna.ca/details"];
  return skippable.some(s => url.includes(s));
}

async function fetchJd(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobOps-OS/1.0; job research bot)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const html = await res.text();
    const text = extractTextFromHtml(html);
    if (text.length < 100) return { ok: false, reason: "content_too_short" };
    return { ok: true, text };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, reason: err.name === "AbortError" ? "timeout" : err.message };
  }
}

export async function fetchJobDescriptions(jobs, { rateLimitMs = 800, maxJobs = 30 } = {}) {
  const results = [];
  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  const batch = jobs.slice(0, maxJobs);

  for (const job of batch) {
    const url = job.apply_url;

    if (!url) {
      results.push({ ...job, jd_fetch: { status: "skipped", reason: "no_url" } });
      skipped++;
      continue;
    }

    if (isSkippableUrl(url)) {
      // Para Adzuna usamos description_snippet si existe como fallback
      const snippet = job.description_snippet || job.raw?.description || "";
      results.push({
        ...job,
        jd_raw: snippet || null,
        jd_fetch: { status: "skipped", reason: "blocked_source", snippet_used: !!snippet }
      });
      skipped++;
      continue;
    }

    await sleep(rateLimitMs);

    const result = await fetchJd(url);
    if (result.ok) {
      results.push({ ...job, jd_raw: result.text, jd_fetch: { status: "ok" } });
      fetched++;
    } else {
      // Fallback: usar snippet si hay
      const snippet = job.description_snippet || job.raw?.description || "";
      results.push({
        ...job,
        jd_raw: snippet || null,
        jd_fetch: { status: "failed", reason: result.reason, snippet_used: !!snippet }
      });
      failed++;
    }
  }

  console.error(`  JD fetch: ${fetched} ok, ${skipped} skipped, ${failed} failed / ${batch.length} total`);
  return results;
}
