/**
 * JD Summarizer — Paso 3 del Sprint 1
 *
 * Usa Claude para generar un resumen operativo de cada job description.
 * Output: job.jd_summary con estructura definida en opportunity-inventory.schema.json
 *
 * Comportamiento:
 * - Si no hay jd_raw ni snippet → jd_summary null, first_read_fit = "UNKNOWN"
 * - Si hay contenido → Claude genera resumen estructurado
 * - Rate limiting: 1 llamada cada 500ms para no quemar cuota
 * - Si ANTHROPIC_API_KEY no está → modo heurístico (sin Claude)
 */

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const SYSTEM_PROMPT = `Eres un asistente de búsqueda laboral especializado.
Tu tarea es analizar descripciones de trabajo y generar un resumen operativo estructurado.
Responde SIEMPRE en JSON válido, sin texto adicional.`;

function buildUserPrompt(job) {
  const content = job.jd_raw || job.description_snippet || "";
  return `Analiza esta oferta de trabajo y genera un resumen operativo en JSON.

Candidato objetivo: profesional con experiencia en gestión de operaciones, programas y proyectos.
Sector preferido: gobierno BC, sector público, tecnología, operaciones corporativas.
Ubicación: British Columbia, Canadá. Remoto/híbrido preferido.

Oferta:
- Título: ${job.title}
- Organización: ${job.organization}
- Ubicación: ${job.location || "no especificada"}
- Compensación: ${job.compensation || "no especificada"}
- URL: ${job.apply_url}

Descripción:
${content.slice(0, 4000)}

Responde con este JSON exacto (sin markdown, sin explicaciones):
{
  "what_the_role_does": "una oración concisa de qué hace este rol en esta organización",
  "positive_signals": ["señal 1", "señal 2", "señal 3"],
  "alert_signals": ["alerta 1", "alerta 2"],
  "first_read_fit": "STRONG|POSSIBLE|WEAK|UNKNOWN"
}

Criterio para first_read_fit:
- STRONG: scope directivo, sector público BC, compensación adecuada, remoto/híbrido
- POSSIBLE: encaje parcial, faltan datos importantes, sector privado relevante
- WEAK: señales bajas, sector muy diferente, compensación baja o no especificada
- UNKNOWN: descripción insuficiente para decidir`;
}

async function summarizeWithClaude(job, apiKey) {
  const content = job.jd_raw || job.description_snippet || "";
  if (!content || content.length < 50) {
    return {
      what_the_role_does: "Descripción no disponible.",
      positive_signals: [],
      alert_signals: ["Sin descripción para analizar"],
      first_read_fit: "UNKNOWN"
    };
  }

  const body = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(job) }]
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    return JSON.parse(text);
  } catch {
    // Si Claude devuelve algo que no es JSON puro, intentar extraer
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Invalid JSON from Claude: ${text.slice(0, 100)}`);
  }
}

function heuristicSummary(job) {
  // Modo sin Claude: resumen básico basado en título + org + señales del scoring
  const positives = [];
  const alerts = [];

  const title = (job.title || "").toLowerCase();
  const org = (job.organization || "").toLowerCase();
  const location = (job.location || "").toLowerCase();

  if (org.includes("bc government") || org.includes("ministry") || org.includes("province")) {
    positives.push("Sector público BC");
  }
  if (org.includes("city of") || org.includes("municipality") || org.includes("civic")) {
    positives.push("Gobierno municipal BC");
  }
  if (location.includes("remote") || location.includes("hybrid")) {
    positives.push("Modalidad remota o híbrida");
  }
  if (title.includes("senior") || title.includes("band 3") || title.includes("band 4")) {
    positives.push("Nivel senior / directivo");
  }
  if (!job.compensation) alerts.push("Compensación no especificada");
  if (!location) alerts.push("Ubicación no especificada");

  const score = job.score?.total ?? 0;
  const fit = score >= 80 ? "STRONG" : score >= 60 ? "POSSIBLE" : "WEAK";

  return {
    what_the_role_does: `${job.title} en ${job.organization}. Descripción completa disponible en: ${job.apply_url}`,
    positive_signals: positives,
    alert_signals: alerts,
    first_read_fit: fit
  };
}

export async function summarizeJobDescriptions(jobs, { rateLimitMs = 500 } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const useClaude = !!apiKey;

  if (!useClaude) {
    console.error("  JD summarizer: ANTHROPIC_API_KEY no encontrada → modo heurístico");
  } else {
    console.error(`  JD summarizer: usando Claude (haiku) para ${jobs.length} jobs`);
  }

  const results = [];
  let claudeOk = 0;
  let heuristic = 0;
  let errors = 0;

  for (const job of jobs) {
    if (useClaude) {
      await sleep(rateLimitMs);
      try {
        const summary = await summarizeWithClaude(job, apiKey);
        results.push({ ...job, jd_summary: summary });
        claudeOk++;
      } catch (err) {
        console.error(`  [summarizer] error ${job.title}: ${err.message}`);
        results.push({ ...job, jd_summary: heuristicSummary(job) });
        errors++;
      }
    } else {
      results.push({ ...job, jd_summary: heuristicSummary(job) });
      heuristic++;
    }
  }

  if (useClaude) {
    console.error(`  JD summarizer: ${claudeOk} claude ok, ${errors} fallback heurístico`);
  } else {
    console.error(`  JD summarizer: ${heuristic} heurísticos`);
  }

  return results;
}
