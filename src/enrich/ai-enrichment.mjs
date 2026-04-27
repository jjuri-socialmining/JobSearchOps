function inferIndustry(job) {
  const haystack = `${job.organization} ${job.title} ${job.description_snippet}`.toLowerCase();
  if (haystack.includes("energy") || haystack.includes("hydro")) {
    return "energy";
  }
  if (haystack.includes("government") || haystack.includes("ministry") || haystack.includes("public service")) {
    return "public-sector";
  }
  if (haystack.includes("software") || haystack.includes("developer") || haystack.includes("engineering")) {
    return "technology";
  }
  if (haystack.includes("housing") || haystack.includes("community")) {
    return "social-impact";
  }
  return "";
}

function deriveSignals(job) {
  const title = job.title.toLowerCase();
  const location = `${job.location} ${job.remote_mode}`.toLowerCase();
  return {
    title_match: /(manager|lead|program|operations|strategy|analyst)/.test(title) ? 1 : 0.5,
    location_fit: /(british columbia|bc|vancouver|victoria|remote|canada)/.test(location) ? 1 : 0.3,
    compensation_signal: job.compensation ? 1 : 0.2,
    source_quality: /(government|ats-api|company-page|crown-corporation)/.test(job.source_type) ? 1 : 0.4,
    seniority_fit: /(senior|lead|manager|principal)/.test(title) ? 1 : 0.6,
    clarity_of_scope: job.description_snippet || job.apply_url ? 0.8 : 0.3
  };
}

function deriveOpenQuestions(job) {
  const questions = [];
  if (!job.compensation) {
    questions.push("Validar compensacion");
  }
  if (!job.remote_mode) {
    questions.push("Confirmar modalidad");
  }
  if (!job.posted_at) {
    questions.push("Confirmar vigencia");
  }
  return questions.join("; ");
}

export function enrichJobs(jobs) {
  return jobs.map((job) => ({
    ...job,
    enrichment: {
      ...job.enrichment,
      industry: inferIndustry(job),
      signals: deriveSignals(job),
      applicants: job.enrichment?.applicants || "",
      summary: `${job.organization} - ${job.title}`.trim(),
      open_questions: deriveOpenQuestions(job)
    }
  }));
}
