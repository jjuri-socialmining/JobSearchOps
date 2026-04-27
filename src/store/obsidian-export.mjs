import { toJobOffersRow } from "../lib/job-normalizer.mjs";
import { writeText } from "../lib/file-utils.mjs";

function buildMarkdownTable(rows) {
  if (!rows.length) {
    return "| Estado | Nota |\n| --- | --- |\n| sin resultados | No hubo ofertas capturadas |\n";
  }
  const columns = Object.keys(rows[0]);
  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => {
    const values = columns.map((column) => String(row[column] ?? "").replaceAll("|", "\\|").replaceAll("\n", " "));
    return `| ${values.join(" | ")} |`;
  });
  return `${header}\n${separator}\n${body.join("\n")}\n`;
}

export function exportObsidianMarkdown(jobs, outputFile) {
  const rows = jobs.map(toJobOffersRow);
  const markdown = [
    "# JobOps Capture Export",
    "",
    `- generated_at: ${new Date().toISOString()}`,
    `- job_count: ${jobs.length}`,
    "",
    buildMarkdownTable(rows)
  ].join("\n");
  if (outputFile) {
    writeText(outputFile, markdown);
  }
  return markdown;
}
