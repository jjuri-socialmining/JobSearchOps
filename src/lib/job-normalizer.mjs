import { decisionLabelEs } from "../decision/decision-status.mjs";

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function toIsoNow() {
  return new Date().toISOString();
}

export function getByPath(value, path) {
  if (!path) {
    return value;
  }
  return String(path)
    .split(".")
    .reduce((current, key) => (current && current[key] !== undefined ? current[key] : undefined), value);
}

export function normalizeJob(job, source) {
  const organization = job.organization || source.name || source.id;
  const title = job.title || "";
  const capturedAt = job.captured_at || toIsoNow();
  return {
    source_id: source.id,
    source_name: source.name,
    source_type: source.type || "",
    organization,
    title,
    location: job.location || "",
    remote_mode: job.remote_mode || "",
    posted_at: job.posted_at || "",
    compensation: job.compensation || "",
    description_snippet: job.description_snippet || "",
    apply_url: job.apply_url || "",
    source_url: job.source_url || source.page_url || "",
    capture_method: source.method || source.adapter,
    captured_at: capturedAt,
    normalized: {
      alias: slugify(`${organization}-${title}-${capturedAt.slice(0, 10)}`),
      region: job.region || source.region || "",
      tags: Array.isArray(job.tags) ? job.tags : []
    },
    enrichment: job.enrichment || {},
    score: job.score || {},
    decision: job.decision || {},
    raw: job.raw ?? job
  };
}

export function normalizeJobs(jobs, source) {
  return jobs
    .map((job) => normalizeJob(job, source))
    .filter((job) => job.title && job.organization && job.apply_url);
}

export function toJobOffersRow(job) {
  return {
    Version: "1",
    "Schema Version": "joboffers.v1",
    Alias: job.normalized?.alias || "",
    Date: new Date(job.captured_at).toISOString().slice(0, 10),
    Posted: job.posted_at || "",
    Industry: job.enrichment?.industry || "",
    "N Applicants": job.enrichment?.applicants || "",
    Ranking: String(job.score?.total ?? ""),
    Prioridad: job.score?.priority || "",
    Veredicto: job.decision?.label || decisionLabelEs(job.decision?.status),
    "Organización": job.organization || "",
    "Título": job.title || "",
    "Ubicación / Modalidad": [job.location, job.remote_mode].filter(Boolean).join(" / "),
    "Compensación": job.compensation || "",
    "Por qué mirar esto primero": job.decision?.why_now || "",
    "Qué te falta validar antes de invertir tiempo": job.decision?.open_questions || "",
    Link: job.apply_url || ""
  };
}
