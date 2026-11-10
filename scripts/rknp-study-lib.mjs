const NUMERIC_FIELDS = ["retrieval_seconds", "supporting_evidence_seconds", "documentation_seconds"];
const BINARY_FIELDS = ["decision_evidence_linked", "task_success"];
const REQUIRED_IDENTIFIERS = ["team_code", "participant_code", "task_id"];

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
  return quantile(clean, 0.5);
}

// Linear interpolation at (n - 1) * p (R-7); quartiles describe spread, not uncertainty.
function quantile(sorted, p) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower] * (1 - fraction) + sorted[Math.ceil(index)] * fraction;
}

function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return { n: sorted.length, median: quantile(sorted, 0.5), q1, q3, iqr: q1 == null ? null : q3 - q1 };
}

const textValue = (value) => String(value ?? "").trim();

function numeric(row, key) {
  const raw = textValue(row[key]);
  if (!raw) return { status: "missing", value: null };
  const value = Number(raw);
  const valid = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) && Number.isFinite(value) && value >= 0;
  return { status: valid ? "valid" : "invalid", value: valid ? value : null };
}

function binary(row, key) {
  const raw = textValue(row[key]).toLowerCase();
  if (!raw) return { status: "missing", value: null };
  if (["1", "true", "yes", "y"].includes(raw)) return { status: "valid", value: 1 };
  if (["0", "false", "no", "n"].includes(raw)) return { status: "valid", value: 0 };
  return { status: "invalid", value: null };
}

function statuses(values) {
  return {
    missing: values.filter((x) => x.status === "missing").length,
    invalid: values.filter((x) => x.status === "invalid").length,
  };
}

function conditionSummary(entries) {
  const out = { n: entries.length, numeric: {}, binary: {}, numericStats: {}, binaryStats: {} };
  for (const key of NUMERIC_FIELDS) {
    const measurements = entries.map((entry) => entry.metrics[key]);
    const stats = { ...distribution(measurements.filter((x) => x.status === "valid").map((x) => x.value)), ...statuses(measurements) };
    out.numeric[key] = stats.median;
    out.numericStats[key] = stats;
  }
  for (const key of BINARY_FIELDS) {
    const measurements = entries.map((entry) => entry.metrics[key]);
    const values = measurements.filter((x) => x.status === "valid").map((x) => x.value);
    const successes = values.reduce((a, b) => a + b, 0);
    const rate = values.length ? successes / values.length : null;
    out.binary[key] = rate;
    out.binaryStats[key] = { n: values.length, successes, rate, ...statuses(measurements) };
  }
  return out;
}

export function summarizeStudy(rows) {
  const groups = new Map();
  const discarded = [];
  const ambiguousGroups = [];
  const invalidMeasurements = [];
  for (const [index, row] of rows.entries()) {
    // Keep the existing tracelab output key for callers and historical exports.
    const rawCondition = textValue(row.condition).toLowerCase();
    const condition = rawCondition === "iznera" ? "tracelab" : rawCondition;
    if (!["baseline", "tracelab"].includes(condition)) {
      discarded.push({ row: index + 1, reason: "invalid_condition" });
      continue;
    }
    const missing = REQUIRED_IDENTIFIERS.filter((key) => !textValue(row[key]));
    if (missing.length) {
      discarded.push({ row: index + 1, reason: "missing_identifier", fields: missing });
      continue;
    }
    const pairId = textValue(row.pair_id);
    // Explicit pair_id links predeclared equivalent task variants; task_id remains required for audit.
    // attempt_id is shared by the two conditions of a repeated attempt, never a session identifier.
    const key = JSON.stringify([
      textValue(row.team_code), textValue(row.participant_code),
      pairId ? "pair" : "task", pairId || textValue(row.task_id), textValue(row.attempt_id),
    ]);
    const metrics = Object.fromEntries([
      ...NUMERIC_FIELDS.map((field) => [field, numeric(row, field)]),
      ...BINARY_FIELDS.map((field) => [field, binary(row, field)]),
    ]);
    for (const [field, value] of Object.entries(metrics)) {
      if (value.status === "invalid") invalidMeasurements.push({ row: index + 1, field });
    }
    const entry = { row: index + 1, condition, metrics };
    const group = groups.get(key) ?? { baseline: [], tracelab: [] };
    group[condition].push(entry);
    groups.set(key, group);
  }

  const accepted = [];
  const pairs = [];
  const unpaired = [];
  for (const group of groups.values()) {
    const entries = [...group.baseline, ...group.tracelab];
    if (group.baseline.length > 1 || group.tracelab.length > 1) {
      const indexes = entries.map((entry) => entry.row).sort((a, b) => a - b);
      ambiguousGroups.push({ rows: indexes });
      for (const entry of entries) discarded.push({ row: entry.row, reason: "ambiguous_duplicate" });
      continue;
    }
    const measured = entries.filter((entry) => {
      if (Object.values(entry.metrics).some((metric) => metric.status === "valid")) return true;
      discarded.push({ row: entry.row, reason: "no_valid_outcome" });
      return false;
    });
    accepted.push(...measured);
    if (measured.length === 2) {
      pairs.push({ baseline: measured.find((entry) => entry.condition === "baseline"), tracelab: measured.find((entry) => entry.condition === "tracelab") });
    } else {
      unpaired.push(...measured.map((entry) => ({ row: entry.row, condition: entry.condition })));
    }
  }

  const pairedDelta = {};
  const pairedDeltaStats = {};
  for (const key of NUMERIC_FIELDS) {
    const differences = pairs.map((pair) => {
      const before = pair.baseline.metrics[key];
      const after = pair.tracelab.metrics[key];
      if (before.status === "invalid" || after.status === "invalid") return { status: "invalid", value: null };
      if (before.status === "missing" || after.status === "missing") return { status: "missing", value: null };
      return { status: "valid", value: after.value - before.value };
    });
    const stats = { ...distribution(differences.filter((x) => x.status === "valid").map((x) => x.value)), ...statuses(differences) };
    pairedDelta[key] = stats.median;
    pairedDeltaStats[key] = stats;
  }
  discarded.sort((a, b) => a.row - b.row);
  unpaired.sort((a, b) => a.row - b.row);
  return {
    rows: accepted.length,
    baseline: conditionSummary(accepted.filter((entry) => entry.condition === "baseline")),
    tracelab: conditionSummary(accepted.filter((entry) => entry.condition === "tracelab")),
    matchedPairs: pairs.length,
    pairedDelta,
    pairedDeltaStats,
    diagnostics: {
      inputRows: rows.length, discardedRows: discarded.length, unpairedRows: unpaired.length,
      discarded, unpaired, ambiguousGroups, invalidMeasurements,
    },
  };
}

function f(value, suffix = "") {
  return value == null ? "not measured" : `${Number(value.toFixed(2))}${suffix}`;
}

function numericCell(stats) {
  return `${f(stats.median)}; Q1–Q3 ${f(stats.q1)}–${f(stats.q3)}; IQR ${f(stats.iqr)}; n=${stats.n}`;
}

function binaryCell(stats) {
  return `${f(stats.rate == null ? null : stats.rate * 100, "%")}; ${stats.successes}/${stats.n} valid observations`;
}

export function renderMarkdown(summary, sourceName = "pilot measurements") {
  const labels = {
    retrieval_seconds: "Retrieve old decision (s)",
    supporting_evidence_seconds: "Locate supporting evidence (s)",
    documentation_seconds: "Manual documentation time (s)",
    decision_evidence_linked: "Decision evidence linked",
    task_success: "Retrieval task success",
  };
  const lines = [
    "# Iznera RKNP pilot summary", "",
    `Source: ${sourceName}`,
    `Accepted observations with at least one valid outcome: ${summary.rows} · matched observation pairs: ${summary.matchedPairs}`,
    "",
    "> This report is descriptive. It does not claim causality or statistical significance by itself. Keep raw data, protocol, sample size and limitations with every competition result.",
    "",
    "Pairs use team + participant + predeclared pair_id (otherwise task_id) + attempt_id. A matched pair can have incomplete outcomes; each outcome below has its own valid n. Repeated attempts are observations, not independent participants.",
    "",
    "| Outcome | Baseline median/rate; valid n | Iznera median/rate; valid n | Paired median Δ (Iznera − baseline); valid n |",
    "|---|---:|---:|---:|",
  ];
  for (const key of NUMERIC_FIELDS) {
    const before = summary.baseline.numericStats?.[key];
    const after = summary.tracelab.numericStats?.[key];
    const delta = summary.pairedDeltaStats?.[key];
    lines.push(`| ${labels[key]} | ${before ? numericCell(before) : f(summary.baseline.numeric[key])} | ${after ? numericCell(after) : f(summary.tracelab.numeric[key])} | ${delta ? numericCell(delta) : f(summary.pairedDelta[key])} |`);
  }
  for (const key of BINARY_FIELDS) {
    const before = summary.baseline.binaryStats?.[key];
    const after = summary.tracelab.binaryStats?.[key];
    lines.push(`| ${labels[key]} | ${before ? binaryCell(before) : f(summary.baseline.binary[key] == null ? null : summary.baseline.binary[key] * 100, "%")} | ${after ? binaryCell(after) : f(summary.tracelab.binary[key] == null ? null : summary.tracelab.binary[key] * 100, "%")} | — |`);
  }
  lines.push("", "Negative Δ for time outcomes means the Iznera condition was faster on those measured pairs. Time summaries include recorded durations from successes and failures; assess task_success separately and retain the stopping rule in the protocol.", "", "Quartiles use linear interpolation at (n − 1) × p. IQR = Q3 − Q1; neither is a confidence interval. Missing or invalid values are excluded, never imputed as zero. Binary rates use all valid condition observations and are not paired effect estimates.");
  if (summary.diagnostics) {
    const diagnostics = summary.diagnostics;
    lines.push("", "## Data quality", "",
      `Input rows: ${diagnostics.inputRows}; discarded rows: ${diagnostics.discardedRows}; accepted but unpaired rows: ${diagnostics.unpairedRows}; ambiguous pairing groups: ${diagnostics.ambiguousGroups.length}.`,
      "",
      "| Outcome | Baseline missing / invalid | Iznera missing / invalid | Matched pairs missing / invalid |",
      "|---|---:|---:|---:|");
    for (const key of [...NUMERIC_FIELDS, ...BINARY_FIELDS]) {
      const before = summary.baseline.numericStats?.[key] ?? summary.baseline.binaryStats?.[key];
      const after = summary.tracelab.numericStats?.[key] ?? summary.tracelab.binaryStats?.[key];
      const delta = summary.pairedDeltaStats?.[key];
      lines.push(`| ${labels[key]} | ${before ? `${before.missing} / ${before.invalid}` : "—"} | ${after ? `${after.missing} / ${after.invalid}` : "—"} | ${delta ? `${delta.missing} / ${delta.invalid}` : "—"} |`);
    }
    lines.push("", "Missing/invalid counts above refer to accepted observations. For pairs, invalid takes precedence over missing. Data-row numbers below are 1-based after the CSV header.");
    for (const item of diagnostics.discarded) lines.push(`- Discarded data row ${item.row}: ${item.reason}${item.fields ? ` (${item.fields.join(", ")})` : ""}.`);
    for (const item of diagnostics.unpaired) lines.push(`- Unpaired data row ${item.row}: ${item.condition === "tracelab" ? "iznera" : item.condition}; no unique measured counterpart.`);
    for (const item of diagnostics.ambiguousGroups) lines.push(`- Ambiguous group, data rows ${item.rows.join(", ")}: all rows excluded; resolve from source records or predeclared attempt IDs.`);
    for (const item of diagnostics.invalidMeasurements) lines.push(`- Invalid measurement at data row ${item.row}: ${item.field}.`);
  }
  return lines.join("\n") + "\n";
}
