import { DECISION_STATUS, decisionLabelEs, deriveDecision } from "../decision/decision-status.mjs";

function computeWeightedScore(signals, weights) {
  let totalWeight = 0;
  let weightedTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const signal = Number(signals[key] ?? 0);
    totalWeight += weight;
    weightedTotal += signal * weight;
  }
  if (!totalWeight) {
    return 0;
  }
  return Math.round((weightedTotal / totalWeight) * 100);
}

function parseSalaryCad(compensation) {
  const text = String(compensation || "").toLowerCase();
  if (!text.trim()) {
    return { known: false, maxAnnualCad: null, reason: "missing" };
  }
  if (/(hour|hourly|\/hr|\/hour)/.test(text)) {
    return { known: false, maxAnnualCad: null, reason: "hourly" };
  }

  const values = [];
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*k\b/g)) {
    values.push(Math.round(Number(match[1]) * 1000));
  }
  for (const match of text.matchAll(/\b(\d{2,3})(?:,\d{3})+\b/g)) {
    values.push(Number(match[0].replaceAll(",", "")));
  }

  if (!values.length) {
    return { known: false, maxAnnualCad: null, reason: "unparsed" };
  }

  return {
    known: true,
    maxAnnualCad: Math.max(...values),
    reason: "annual"
  };
}

function isRemoteFriendly(job) {
  const text = `${job.remote_mode || ""} ${job.location || ""}`.toLowerCase();
  return /(remote|hybrid|flexible)/.test(text);
}

function evaluateLocation(job, hardFilters) {
  const location = String(job.location || "");
  const remoteFriendly = isRemoteFriendly(job);
  const locationText = location.toLowerCase();
  const preferredLocations = Array.isArray(hardFilters.preferred_locations) ? hardFilters.preferred_locations : [];
  const locationMarkers = [...preferredLocations, "british columbia", " bc ", "vancouver island"].map((item) => String(item).toLowerCase());
  const outsideBcMarkers = [
    "ontario",
    "toronto",
    "alberta",
    "calgary",
    "edmonton",
    "quebec",
    "montreal",
    "nova scotia",
    "halifax",
    "manitoba",
    "winnipeg",
    "saskatchewan",
    "regina",
    "new brunswick",
    "ottawa"
  ];

  if (!locationText.trim()) {
    return { known: false, discard: false, reason: "missing_location" };
  }
  if (remoteFriendly) {
    return { known: true, discard: false, reason: "remote_or_hybrid" };
  }
  if (locationMarkers.some((marker) => marker && locationText.includes(marker.trim()))) {
    return { known: true, discard: false, reason: "preferred_or_bc" };
  }
  if (outsideBcMarkers.some((marker) => locationText.includes(marker))) {
    return { known: true, discard: true, reason: "outside_bc" };
  }
  return { known: false, discard: false, reason: "unclear_location" };
}

function evaluateHardFilters(job, hardFilters) {
  const minimumSalaryCad = Number(hardFilters.minimum_salary_cad || 0);
  const salary = parseSalaryCad(job.compensation);
  const location = evaluateLocation(job, hardFilters);
  const openQuestions = [];

  if (salary.known && salary.maxAnnualCad < minimumSalaryCad) {
    return {
      status: DECISION_STATUS.DISCARD,
      reasons: [`Salario maximo conocido por debajo de CAD ${minimumSalaryCad}.`],
      openQuestions
    };
  }

  if (location.discard) {
    return {
      status: DECISION_STATUS.DISCARD,
      reasons: ["Ubicacion claramente fuera de BC sin modalidad remota."],
      openQuestions
    };
  }

  if (!salary.known) {
    openQuestions.push("Validar compensacion real");
  }
  if (!location.known) {
    openQuestions.push("Validar ubicacion real");
  }

  return {
    status: openQuestions.length ? DECISION_STATUS.REVIEW : null,
    reasons: [],
    openQuestions
  };
}

function priorityFromScore(total) {
  if (total >= 75) {
    return "alta";
  }
  if (total >= 55) {
    return "media";
  }
  return "baja";
}

export function scoreJobs(jobs, scoringConfig) {
  const thresholds = scoringConfig.thresholds || { apply: 75, clarify: 55 };
  const weights = scoringConfig.weighted_criteria || {};
  const hardFilters = scoringConfig.hard_filters || {};
  return jobs.map((job) => {
    const total = computeWeightedScore(job.enrichment?.signals || {}, weights);
    const priority = priorityFromScore(total);
    const hardFilterResult = evaluateHardFilters(job, hardFilters);
    const openQuestions = [...new Set([
      ...String(job.enrichment?.open_questions || "")
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean),
      ...hardFilterResult.openQuestions
    ])].join("; ");
    const decisionStatus = deriveDecision({
      totalScore: total,
      thresholds,
      openQuestions,
      hardFilterStatus: hardFilterResult.status
    });
    const whyNow =
      decisionStatus === DECISION_STATUS.DISCARD
        ? hardFilterResult.reasons[0] || "La senal actual es baja frente a otras opciones."
        : decisionStatus === DECISION_STATUS.REVIEW
          ? "Hay senal inicial, pero faltan datos criticos antes de decidir."
          : total >= thresholds.apply
        ? "Alta senal de encaje por fuente, titulo y ubicacion."
        : total >= thresholds.clarify
          ? "Tiene potencial, pero faltan datos para invertir tiempo."
          : "La senal actual es baja frente a otras opciones.";

    return {
      ...job,
      score: {
        ...job.score,
        total,
        priority
      },
      decision: {
        ...job.decision,
        status: decisionStatus,
        label: decisionLabelEs(decisionStatus),
        why_now: whyNow,
        open_questions: openQuestions
      }
    };
  });
}
