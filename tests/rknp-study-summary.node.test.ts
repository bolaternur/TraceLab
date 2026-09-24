import test from "node:test";
import assert from "node:assert/strict";
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
  const report = renderMarkdown(summary, "test.csv");
  assert.match(report, /descriptive/i);
  assert.match(report, /does not claim causality or statistical significance/i);
});

test("CSV parser preserves quoted notes with commas", () => {
  const rows = parseCsv('a,b,notes\n1,2,"same task, same student"\n');
  assert.equal(rows[0].notes, "same task, same student");
});
