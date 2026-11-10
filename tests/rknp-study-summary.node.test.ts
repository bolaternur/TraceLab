import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseCsv, renderMarkdown, summarizeStudy } from "../scripts/rknp-study-lib.mjs";

test("RKNP study summary computes paired descriptive deltas without inventing significance", () => {
  const csv = `session_id,date,team_code,participant_code,condition,task_id,target_age_days,retrieval_seconds,supporting_evidence_seconds,documentation_seconds,decision_evidence_linked,task_success,notes\n1,2026-09-01,A,P1,baseline,T1,60,120,80,90,0,1,\n2,2026-09-02,A,P1,tracelab,T1,60,30,15,35,1,1,\n3,2026-09-01,A,P2,baseline,T1,60,100,60,70,0,1,\n4,2026-09-02,A,P2,tracelab,T1,60,20,10,30,1,1,\n`;
  const summary = summarizeStudy(parseCsv(csv));
  assert.equal(summary.matchedPairs, 2);
  assert.equal(summary.baseline.numeric.retrieval_seconds, 110);
  assert.equal(summary.tracelab.numeric.retrieval_seconds, 25);
  assert.equal(summary.pairedDelta.retrieval_seconds, -85);
  assert.equal(summary.baseline.binary.decision_evidence_linked, 0);
  assert.equal(summary.tracelab.binary.decision_evidence_linked, 1);
  assert.deepEqual(summary.baseline.numericStats.retrieval_seconds, { n: 2, median: 110, q1: 105, q3: 115, iqr: 10, missing: 0, invalid: 0 });
  assert.deepEqual(summary.pairedDeltaStats.retrieval_seconds, { n: 2, median: -85, q1: -87.5, q3: -82.5, iqr: 5, missing: 0, invalid: 0 });
  const report = renderMarkdown(summary, "test.csv");
  assert.match(report, /descriptive/i);
  assert.match(report, /does not claim causality or statistical significance/i);
});

test("CSV parser preserves quoted notes with commas", () => {
  const rows = parseCsv('a,b,notes\n1,2,"same task, same student"\n');
  assert.equal(rows[0].notes, "same task, same student");
});

test("Iznera research condition preserves compatibility with earlier measurements", () => {
  const csv = "session_id,date,team_code,participant_code,condition,task_id,target_age_days,retrieval_seconds,supporting_evidence_seconds,documentation_seconds,decision_evidence_linked,task_success,notes\n1,2026-10-01,A,P1,baseline,T1,30,60,40,50,0,1,\n2,2026-10-02,A,P1,iznera,T1,30,20,10,15,1,1,\n";
  const renamed = summarizeStudy(parseCsv(csv));
  const legacy = summarizeStudy(parseCsv(csv.replace(",iznera,", ",tracelab,")));
  assert.equal(renamed.matchedPairs, 1);
  assert.deepEqual(renamed.tracelab, legacy.tracelab);
  assert.deepEqual(renamed.pairedDelta, legacy.pairedDelta);
  assert.match(renderMarkdown(renamed, "test.csv"), /Iznera/);
});

const measurement = (overrides: Record<string, string> = {}) => ({
  team_code: "A", participant_code: "P1", condition: "baseline", task_id: "T1",
  retrieval_seconds: "120", supporting_evidence_seconds: "", documentation_seconds: "",
  decision_evidence_linked: "", task_success: "1", ...overrides,
});

test("participant codes from different teams never create a false pair", () => {
  const summary = summarizeStudy([
    measurement(),
    measurement({ team_code: "B", condition: "iznera", retrieval_seconds: "20" }),
  ]);
  assert.equal(summary.rows, 2);
  assert.equal(summary.matchedPairs, 0);
  assert.equal(summary.pairedDelta.retrieval_seconds, null);
  assert.equal(summary.diagnostics.unpairedRows, 2);
  const paired = summarizeStudy([
    measurement(), measurement({ condition: "iznera", retrieval_seconds: "100" }),
    measurement({ team_code: "B", retrieval_seconds: "80" }),
    measurement({ team_code: "B", condition: "iznera", retrieval_seconds: "20" }),
  ]);
  assert.equal(paired.matchedPairs, 2);
  assert.equal(paired.pairedDelta.retrieval_seconds, -40);
});

test("tuple pairing keys cannot collide when codes contain delimiters", () => {
  const summary = summarizeStudy([
    measurement({ team_code: "A::B", participant_code: "C" }),
    measurement({ team_code: "A", participant_code: "B::C", condition: "iznera" }),
  ]);
  assert.equal(summary.matchedPairs, 0);
  assert.equal(summary.diagnostics.discardedRows, 0);
});

test("ambiguous repeated observations exclude the whole group without last-row wins", () => {
  const rows = [measurement(), measurement({ retrieval_seconds: "100" }), measurement({ condition: "iznera", retrieval_seconds: "20" })];
  for (const observations of [rows, [...rows].reverse()]) {
    const summary = summarizeStudy(observations);
    assert.equal(summary.rows, 0);
    assert.equal(summary.matchedPairs, 0);
    assert.equal(summary.baseline.numeric.retrieval_seconds, null);
    assert.equal(summary.diagnostics.discardedRows, 3);
    assert.deepEqual(summary.diagnostics.ambiguousGroups, [{ rows: [1, 2, 3] }]);
    assert.ok(summary.diagnostics.discarded.every((item) => item.reason === "ambiguous_duplicate"));
  }
  // A partially entered repeat cannot silently make the complete repeat look unique.
  const incomplete = summarizeStudy([measurement(), measurement({ retrieval_seconds: "", task_success: "" }), measurement({ condition: "iznera" })]);
  assert.equal(incomplete.rows, 0);
  assert.equal(incomplete.diagnostics.ambiguousGroups.length, 1);
});

test("explicit attempt IDs preserve repeated matched observations", () => {
  const summary = summarizeStudy([
    measurement({ attempt_id: "1" }),
    measurement({ attempt_id: "1", condition: "iznera", retrieval_seconds: "100" }),
    measurement({ attempt_id: "2", retrieval_seconds: "90" }),
    measurement({ attempt_id: "2", condition: "iznera", retrieval_seconds: "30" }),
  ]);
  assert.equal(summary.rows, 4);
  assert.equal(summary.matchedPairs, 2);
  assert.equal(summary.pairedDelta.retrieval_seconds, -40);
  assert.equal(summary.pairedDeltaStats.retrieval_seconds.n, 2);
  assert.equal(summary.diagnostics.ambiguousGroups.length, 0);
  assert.match(renderMarkdown(summary), /not independent participants/);
});

test("matched task variants require a predeclared pair ID shared by both conditions", () => {
  const baseline = measurement({ task_id: "Q01" });
  const after = measurement({ task_id: "Q02", condition: "iznera", retrieval_seconds: "30" });
  assert.equal(summarizeStudy([baseline, after]).matchedPairs, 0);
  const paired = summarizeStudy([{ ...baseline, pair_id: "retrieval-1" }, { ...after, pair_id: "retrieval-1" }]);
  assert.equal(paired.matchedPairs, 1);
  assert.equal(paired.pairedDelta.retrieval_seconds, -90);
  assert.equal(summarizeStudy([{ ...baseline, pair_id: "retrieval-1" }, after]).matchedPairs, 0);
  assert.equal(summarizeStudy([{ ...baseline, pair_id: "retrieval-1", attempt_id: "1" }, { ...after, pair_id: "retrieval-1", attempt_id: "2" }]).matchedPairs, 0);
  assert.equal(summarizeStudy([{ ...baseline, pair_id: "Q02" }, after]).matchedPairs, 0);
});

test("missing, invalid and zero values have distinct denominators for every outcome", () => {
  const summary = summarizeStudy([
    measurement({ retrieval_seconds: " ", supporting_evidence_seconds: "5", documentation_seconds: "-1", decision_evidence_linked: "0", task_success: "0" }),
    measurement({ condition: "iznera", retrieval_seconds: "0", supporting_evidence_seconds: "bad", documentation_seconds: "10", decision_evidence_linked: "2", task_success: " YES " }),
    measurement({ participant_code: "P2", retrieval_seconds: "12", supporting_evidence_seconds: "4", documentation_seconds: "8", decision_evidence_linked: " TRUE ", task_success: "" }),
    measurement({ participant_code: "P2", condition: "iznera", retrieval_seconds: "6", supporting_evidence_seconds: "2", documentation_seconds: "4", decision_evidence_linked: "false", task_success: "no" }),
  ]);
  assert.equal(summary.rows, 4);
  assert.equal(summary.matchedPairs, 2);
  assert.deepEqual(summary.baseline.numericStats.retrieval_seconds, { n: 1, median: 12, q1: 12, q3: 12, iqr: 0, missing: 1, invalid: 0 });
  assert.equal(summary.tracelab.numericStats.retrieval_seconds.n, 2);
  assert.equal(summary.tracelab.numeric.retrieval_seconds, 3);
  assert.equal(summary.pairedDelta.retrieval_seconds, -6);
  assert.equal(summary.pairedDeltaStats.retrieval_seconds.n, 1);
  assert.equal(summary.pairedDeltaStats.retrieval_seconds.missing, 1);
  assert.equal(summary.pairedDeltaStats.supporting_evidence_seconds.invalid, 1);
  assert.equal(summary.pairedDeltaStats.documentation_seconds.invalid, 1);
  assert.equal(summary.baseline.binary.decision_evidence_linked, 0.5);
  assert.deepEqual(summary.tracelab.binaryStats.decision_evidence_linked, { n: 1, successes: 0, rate: 0, missing: 0, invalid: 1 });
  assert.deepEqual(summary.baseline.binaryStats.task_success, { n: 1, successes: 0, rate: 0, missing: 1, invalid: 0 });
  assert.equal(summary.tracelab.binary.task_success, 0.5);
  assert.equal(summary.diagnostics.invalidMeasurements.length, 3);
  const report = renderMarkdown(summary);
  assert.match(report, /n=1/);
  assert.match(report, /IQR/);
  assert.match(report, /never imputed as zero/);
  assert.match(report, /Invalid measurement at data row 2: supporting_evidence_seconds/);
});

test("identity failures and rows without any valid outcome are discarded, not counted", () => {
  const summary = summarizeStudy([
    measurement({ condition: "unknown" }),
    measurement({ team_code: " " }),
    measurement({ participant_code: "" }),
    measurement({ task_id: "", pair_id: "declared-pair" }),
    measurement({ retrieval_seconds: "", task_success: "" }),
    measurement({ participant_code: "P2", retrieval_seconds: "-5", task_success: "invalid" }),
    measurement({ condition: "  BASELINE ", participant_code: "P3", retrieval_seconds: "0", task_success: "0" }),
  ]);
  assert.equal(summary.rows, 1);
  assert.equal(summary.baseline.n, 1);
  assert.equal(summary.tracelab.n, 0);
  assert.equal(summary.diagnostics.inputRows, 7);
  assert.equal(summary.diagnostics.discardedRows, 6);
  assert.equal(summary.diagnostics.unpairedRows, 1);
  assert.equal(summary.baseline.numeric.retrieval_seconds, 0);
  assert.equal(summary.baseline.binary.task_success, 0);
  assert.deepEqual(summary.diagnostics.discarded.map((item) => item.reason), ["invalid_condition", "missing_identifier", "missing_identifier", "missing_identifier", "no_valid_outcome", "no_valid_outcome"]);
});

test("Iznera and legacy tracelab rows are the same condition when detecting duplicates", () => {
  const summary = summarizeStudy([measurement(), measurement({ condition: " iznera " }), measurement({ condition: "TRACELAB" })]);
  assert.equal(summary.rows, 0);
  assert.equal(summary.diagnostics.ambiguousGroups.length, 1);
});

test("blank and nondecimal durations never become zero observations", () => {
  for (const value of ["", " ", "NaN", "Infinity", "-2", "0x10", "0b11"]) {
    const summary = summarizeStudy([measurement({ retrieval_seconds: value, task_success: "" })]);
    assert.equal(summary.rows, 0, value);
    assert.equal(summary.baseline.numeric.retrieval_seconds, null, value);
  }
});

test("the distributed template is blank and the CLI refuses to create empty results", async () => {
  const template = fileURLToPath(new URL("../docs/rknp/pilot_measurements_template.csv", import.meta.url));
  const csv = await readFile(template, "utf8");
  assert.equal(parseCsv(csv).length, 0);
  assert.match(csv, /task_id,pair_id,attempt_id/);
  assert.equal(summarizeStudy(parseCsv(csv)).rows, 0);
  const directory = await mkdtemp(path.join(tmpdir(), "iznera-study-test-"));
  try {
    const output = path.join(directory, "report.md");
    const cli = fileURLToPath(new URL("../scripts/rknp-study-summary.mjs", import.meta.url));
    const empty = spawnSync(process.execPath, [cli, template, output], { encoding: "utf8", windowsHide: true });
    assert.equal(empty.status, 2, empty.stderr);
    assert.match(empty.stderr, /No valid pilot observations/);
    await assert.rejects(readFile(output), { code: "ENOENT" });
    const invalidInput = path.join(directory, "invalid.csv");
    await writeFile(invalidInput, "team_code,participant_code,condition,task_id,retrieval_seconds\nA,P1,baseline,T1,\n");
    await writeFile(output, "Existing report must not be silently replaced");
    const invalid = spawnSync(process.execPath, [cli, invalidInput, output], { encoding: "utf8", windowsHide: true });
    assert.equal(invalid.status, 2, invalid.stderr);
    assert.match(invalid.stderr, /no_valid_outcome/);
    assert.match(invalid.stderr, /existing output is unchanged/);
    assert.equal(await readFile(output, "utf8"), "Existing report must not be silently replaced");
    const input = path.join(directory, "measured.csv");
    await writeFile(input, "team_code,participant_code,condition,task_id,retrieval_seconds,task_success\nA,P1,baseline,T1,120,1\nA,P1,iznera,T1,30,1\n");
    const measured = spawnSync(process.execPath, [cli, input, output], { encoding: "utf8", windowsHide: true });
    assert.equal(measured.status, 0, measured.stderr);
    assert.match(await readFile(output, "utf8"), /matched observation pairs: 1/);
    assert.match(await readFile(output, "utf8"), /-90/);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("iznera-study-test-"));
    await rm(directory, { recursive: true, force: true });
  }
});

test("renderMarkdown still accepts the legacy summary shape", () => {
  const summary = { rows: 0, baseline: { n: 0, numeric: {}, binary: {} }, tracelab: { n: 0, numeric: {}, binary: {} }, matchedPairs: 0, pairedDelta: {} };
  assert.match(renderMarkdown(summary), /not measured/);
});
