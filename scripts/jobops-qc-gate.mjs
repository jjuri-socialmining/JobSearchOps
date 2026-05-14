/**
 * QC Gate — Paso 4 del Sprint 1
 *
 * Lee el opportunity-inventory.json generado por el pipeline.
 * Presenta cada job con su jd_summary para que revises.
 * Genera qc-report.md para Obsidian y permite aprobar o marcar mejoras.
 *
 * Uso:
 *   node scripts/jobops-qc-gate.mjs              → genera reporte y pregunta
 *   node scripts/jobops-qc-gate.mjs --approve     → aprueba el inventory actual
 *   node scripts/jobops-qc-gate.mjs --report-only → solo genera el reporte md
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function resolve(rel) {
  return path.resolve(repoRoot, rel);
}

const args = process.argv.slice(2);
const autoApprove = args.includes("--approve");
const reportOnly = args.includes("--report-only");

// --- cargar inventory ---
const inventoryPath = resolve("../JobOffersOps/intake/opportunity-inventory.json");
if (!fs.existsSync(inventoryPath)) {
  console.error("❌ No hay opportunity-inventory.json. Corre primero: npm run jobops:full");
  process.exit(1);
}

const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const jobs = inventory.opportunities || [];

// --- generar reporte md ---
const fitEmoji = { STRONG: "🟢", POSSIBLE: "🟡", WEAK: "🔴", UNKNOWN: "⚪" };

const lines = [
  `# QC Gate — ${inventory.run_id}`,
  ``,
  `- generated_at: ${inventory.generated_at}`,
  `- qc_status: **${inventory.qc_status}**`,
  `- total jobs: ${jobs.length}`,
  `- descartados por blacklist: ${inventory.stats?.discarded_blacklist ?? 0}`,
  ``,
  `## Revisar: ¿hay algo que NO debería estar?`,
  ``,
  `Si ves un job irrelevante, agregá el patrón a:`,
  `- \`shared/training/qc-decisions.json\` → applied_to_config: false`,
  `- Después corré \`npm run jobops:full\` nuevamente`,
  ``,
  `## Jobs capturados`,
  ``,
  `| Fit | Score | Título | Organización | Ubicación | Qué hace | Señales |`,
  `| --- | --- | --- | --- | --- | --- | --- |`,
  ...jobs.map(j => {
    const s = j.jd_summary;
    const fit = s?.first_read_fit || "UNKNOWN";
    const emoji = fitEmoji[fit] || "⚪";
    const what = s?.what_the_role_does || "—";
    const positives = (s?.positive_signals || []).slice(0, 2).join(", ") || "—";
    const alerts = (s?.alert_signals || []).slice(0, 1).join(", ") || "";
    const signals = alerts ? `✓ ${positives} ⚠ ${alerts}` : `✓ ${positives}`;
    return `| ${emoji} ${fit} | ${j.level1_score} | [${j.title}](${j.apply_url}) | ${j.organization} | ${j.location || "—"} | ${what.slice(0, 80)} | ${signals} |`;
  }),
  ``,
  `## Jobs por fit`,
  ``,
  ...["STRONG", "POSSIBLE", "WEAK", "UNKNOWN"].map(fit => {
    const group = jobs.filter(j => (j.jd_summary?.first_read_fit || "UNKNOWN") === fit);
    if (!group.length) return null;
    return [
      `### ${fitEmoji[fit]} ${fit} (${group.length})`,
      ``,
      ...group.map(j => `- **${j.title}** — ${j.organization} | Score: ${j.level1_score} | [ver oferta](${j.apply_url})`),
      ``
    ].join("\n");
  }).filter(Boolean),
  `## Para aprobar`,
  ``,
  `\`\`\`bash`,
  `node scripts/jobops-qc-gate.mjs --approve`,
  `\`\`\``,
  ``
];

const reportMd = lines.join("\n");
const reportPath = resolve("tmp/jobops-pipeline/latest-qc-report.md");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, reportMd, "utf8");
console.log(`✓ QC report → tmp/jobops-pipeline/latest-qc-report.md`);

// --- también en el run snapshot si existe ---
const runDir = resolve(`tmp/jobops-pipeline/runs/${inventory.run_id}-multi-source-full`);
if (fs.existsSync(runDir)) {
  fs.writeFileSync(path.join(runDir, "qc-report.md"), reportMd, "utf8");
}

if (reportOnly) process.exit(0);

// --- consola: resumen rápido ---
console.log(`\n📋 QC Summary — ${jobs.length} jobs`);
for (const fit of ["STRONG", "POSSIBLE", "WEAK", "UNKNOWN"]) {
  const count = jobs.filter(j => (j.jd_summary?.first_read_fit || "UNKNOWN") === fit).length;
  if (count) console.log(`  ${fitEmoji[fit]} ${fit}: ${count}`);
}

const strong = jobs.filter(j => j.jd_summary?.first_read_fit === "STRONG");
if (strong.length) {
  console.log(`\n🟢 STRONG fits:`);
  for (const j of strong) {
    console.log(`  · ${j.title} — ${j.organization}`);
    if (j.jd_summary?.what_the_role_does) {
      console.log(`    ${j.jd_summary.what_the_role_does.slice(0, 100)}`);
    }
  }
}

// --- aprobar o pedir confirmación ---
if (autoApprove) {
  inventory.qc_status = "approved";
  fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + "\n", "utf8");
  console.log(`\n✅ Inventory aprobado → JobOffersOps puede procesar`);
  process.exit(0);
}

if (process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`\n¿Aprobás este inventory? (s/n): `, answer => {
    rl.close();
    if (answer.toLowerCase() === "s" || answer.toLowerCase() === "si") {
      inventory.qc_status = "approved";
      fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + "\n", "utf8");
      console.log(`✅ Inventory aprobado → JobOffersOps puede procesar`);
    } else {
      console.log(`⏸  Inventory en pending_review. Mejorá los filtros y volvé a correr jobops:full`);
    }
  });
} else {
  console.log(`\nReporte generado. Para aprobar: node scripts/jobops-qc-gate.mjs --approve`);
}
