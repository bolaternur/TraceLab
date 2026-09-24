const NUMERIC_FIELDS = ["retrieval_seconds", "supporting_evidence_seconds", "documentation_seconds"];
const BINARY_FIELDS = ["decision_evidence_linked", "task_success"];

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ""; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length < 1) return [];
  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()])));
}

export function median(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function numeric(row, key) {
  if (row[key] == null || row[key] === "") return null;
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : null;
}

function binary(row, key) {
  const raw = String(row[key] ?? "").toLowerCase();
  if (["1", "true", "yes", "y"].includes(raw)) return 1;
  if (["0", "false", "no", "n"].includes(raw)) return 0;
  return null;
}

function conditionSummary(rows) {
  const out = { n: rows.length, numeric: {}, binary: {} };
  for (const key of NUMERIC_FIELDS) out.numeric[key] = median(rows.map((r) => numeric(r, key)).filter((x) => x != null));
  for (const key of BINARY_FIELDS) {
    const vals = rows.map((r) => binary(r, key)).filter((x) => x != null);
    out.binary[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return out;
}

export function summarizeStudy(rows) {
  const valid = rows.filter((r) => ["baseline", "tracelab"].includes(String(r.condition).toLowerCase()));
  const baseline = valid.filter((r) => String(r.condition).toLowerCase() === "baseline");
  const tracelab = valid.filter((r) => String(r.condition).toLowerCase() === "tracelab");
  const map = new Map();
  for (const row of valid) {
    const key = `${row.participant_code ?? ""}::${row.task_id ?? ""}`;
    const entry = map.get(key) ?? {};
    entry[String(row.condition).toLowerCase()] = row;
    map.set(key, entry);
  }
  const pairs = [...map.values()].filter((x) => x.baseline && x.tracelab);
  const pairedDelta = {};
  for (const key of NUMERIC_FIELDS) {
    pairedDelta[key] = median(pairs.map((pair) => {
      const before = numeric(pair.baseline, key);
      const after = numeric(pair.tracelab, key);
      return before == null || after == null ? null : after - before;
    }).filter((x) => x != null));
  }
  return {
    rows: valid.length,
    baseline: conditionSummary(baseline),
    tracelab: conditionSummary(tracelab),
    matchedPairs: pairs.length,
    pairedDelta,
  };
}

function f(value, suffix = "") {
  return value == null ? "not measured" : `${Number(value.toFixed(2))}${suffix}`;
}

export function renderMarkdown(summary, sourceName = "pilot measurements") {
  const lines = [
    "# TraceLab RKNP pilot summary",
    "",
    `Source: ${sourceName}`,
    `Valid observations: ${summary.rows} · matched participant/task pairs: ${summary.matchedPairs}`,
    "",
    "> This report is descriptive. It does not claim causality or statistical significance by itself. Keep raw data, protocol, sample size and limitations with every competition result.",
    "",
    "| Outcome | Baseline median/rate | TraceLab median/rate | Paired median Δ (TraceLab − baseline) |",
    "|---|---:|---:|---:|",
  ];
  const labels = {
    retrieval_seconds: "Retrieve old decision (s)",
    supporting_evidence_seconds: "Locate supporting evidence (s)",
    documentation_seconds: "Manual documentation time (s)",
  };
  for (const key of NUMERIC_FIELDS) lines.push(`| ${labels[key]} | ${f(summary.baseline.numeric[key])} | ${f(summary.tracelab.numeric[key])} | ${f(summary.pairedDelta[key])} |`);
  lines.push(`| Decision evidence linked | ${f(summary.baseline.binary.decision_evidence_linked == null ? null : summary.baseline.binary.decision_evidence_linked * 100, "%")} | ${f(summary.tracelab.binary.decision_evidence_linked == null ? null : summary.tracelab.binary.decision_evidence_linked * 100, "%")} | — |`);
  lines.push(`| Retrieval task success | ${f(summary.baseline.binary.task_success == null ? null : summary.baseline.binary.task_success * 100, "%")} | ${f(summary.tracelab.binary.task_success == null ? null : summary.tracelab.binary.task_success * 100, "%")} | — |`);
  lines.push("", "Negative Δ for time outcomes means the TraceLab condition was faster on the matched observations.");
  return lines.join("\n") + "\n";
}
