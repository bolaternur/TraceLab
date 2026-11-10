import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv, renderMarkdown, summarizeStudy } from "./rknp-study-lib.mjs";

const input = process.argv[2] ?? "docs/rknp/pilot_measurements_template.csv";
const output = process.argv[3] ?? "docs/rknp/PILOT_RESULTS.generated.md";
const raw = await readFile(input, "utf8");
const summary = summarizeStudy(parseCsv(raw));
if (!summary.rows) {
  console.error(`No valid pilot observations found in ${input}. Record real measurements with team, participant and task identifiers first.`);
  console.error(`Input rows: ${summary.diagnostics.inputRows}; discarded rows: ${summary.diagnostics.discardedRows}. No report written; any existing output is unchanged.`);
  for (const item of summary.diagnostics.discarded) console.error(`Data row ${item.row}: ${item.reason}${item.fields ? ` (${item.fields.join(", ")})` : ""}.`);
  process.exitCode = 2;
} else {
  await writeFile(output, renderMarkdown(summary, path.basename(input)), "utf8");
  console.log(`Wrote descriptive RKNP study summary to ${output}`);
  console.log(`Accepted: ${summary.rows}; discarded: ${summary.diagnostics.discardedRows}; unpaired: ${summary.diagnostics.unpairedRows}. Review per-outcome valid n and data-quality diagnostics in the report.`);
}
