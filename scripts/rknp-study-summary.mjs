import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv, renderMarkdown, summarizeStudy } from "./rknp-study-lib.mjs";

const input = process.argv[2] ?? "docs/rknp/pilot_measurements_template.csv";
const output = process.argv[3] ?? "docs/rknp/PILOT_RESULTS.generated.md";
const raw = await readFile(input, "utf8");
const rows = parseCsv(raw);
if (!rows.length) {
  console.error(`No pilot observations found in ${input}. Fill the CSV with real measurements first.`);
  process.exitCode = 2;
} else {
  const report = renderMarkdown(summarizeStudy(rows), path.basename(input));
  await writeFile(output, report, "utf8");
  console.log(`Wrote descriptive RKNP study summary to ${output}`);
}
