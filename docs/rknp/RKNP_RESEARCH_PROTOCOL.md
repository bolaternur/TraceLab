# Iznera — RKNP research protocol

## Research question
Can passive engineering-provenance capture combined with short student-authored rationale reduce documentation effort while improving retrieval of design rationale and supporting evidence in student engineering teams?

## Hypotheses
- **H0:** Adding Iznera does not materially change retrieval time, evidence-link coverage, or documentation effort.
- **H1:** Adding Iznera reduces retrieval/documentation time and increases the share of decisions linked to evidence.

## Experimental design
Use a matched before/after study with the same teams during real engineering work. Keep GitHub, CAD, chat, workshop practices, and competition context unchanged. The main independent variable is whether the Iznera evidence layer is available.

For retrieval tasks, use matched historical questions of similar difficulty. Define the task matches and stopping rule before collecting outcomes. When possible, randomize task order so participants do not always complete the baseline condition first. Record condition order and learning effects as limitations.

### Primary outcomes
1. Time to retrieve a 2–3 month old design decision.
2. Time to locate the test or artifact supporting that decision.
3. Decision evidence-link rate.
4. Manual documentation time per meaningful engineering change.
5. Portfolio/evidence preparation time.

### Secondary outcomes
- Distributed contributor rate.
- Passive capture share.
- Number of unresolved evidence clusters.
- Use of prior-season evidence during real engineering decisions.

## Data integrity
- Never invent improvement percentages.
- Record participant/team codes instead of student names in research exports.
- Keep raw competition/team evidence private.
- Record exact dates, sample size, task definition, and missing data.
- Report negative or null results.
- Separate current process-health metrics from causal before/after findings.

## Analysis
For small pilot samples, report median and interquartile range for time measures, paired before/after differences, and percentages for evidence-link outcomes. Show individual paired points where possible rather than only averages. If the sample is large enough, add a paired non-parametric test and confidence interval, but do not overstate statistical significance from a small convenience sample.

### Measurement file and pairing

`pilot_measurements_template.csv` intentionally contains only column headers. It contains no observations or demonstrated results. Add one row per real condition observation; retain raw source records and record dates and session IDs. The summary command refuses to create a report when there are no valid observations.

- `team_code`, `participant_code`, `condition`, and `task_id` are required. Participant codes are scoped to teams. Conditions are `baseline` and `iznera`; historical `tracelab` means the Iznera condition.
- For the same task in both conditions, use the same `task_id`. For different but prospectively matched task variants (for example Q01 and Q02), record each actual task ID and give both rows the same `pair_id`. Document the matching rationale before outcomes are observed. A `pair_id` does not establish equivalent difficulty by itself.
- If repeating a matched task, give each planned repetition its own `attempt_id`, shared by the two conditions. The pairing key is team + participant + (`pair_id`, otherwise `task_id`) + `attempt_id`. A session ID or date does not identify a match.
- Do not add IDs after inspecting outcomes just to force a match. More than one row for either condition under the same pairing key makes the entire group ambiguous. The summary excludes all rows in that group and reports their data-row numbers; resolve only against source records. A blank repeated row also makes the group ambiguous.
- If only one side has a pair/attempt ID, or its counterpart is absent or contains no valid outcome, the measured row remains unpaired. It contributes only to its condition summaries. Repeated attempts are observations, not independent participants; report unique participants and teams separately when interpreting the study.

### Valid measurements and denominators

Time outcomes must be finite nonnegative decimal seconds. An observed zero is valid; an empty or whitespace cell means missing. Negative durations and nonnumeric values are invalid. Binary outcomes accept `1/0`, `true/false`, `yes/no`, or `y/n` (case-insensitive). Missing or invalid binary cells are never failures or successes by default. Record unsuccessful retrieval as `task_success=0`; record its actual elapsed time under the prospectively defined stopping rule, or leave time missing when it was not measured. The automatic time summaries include recorded durations for both successful and unsuccessful tasks, so they must be interpreted with the success rates and stopping rule.

Rows with invalid conditions, missing required identifiers, ambiguous duplicates, or no valid outcome are discarded and diagnosed. A partially measured row can contribute to each outcome it actually measures; it is not counted in other outcomes' valid n. `rows` and condition-level `n` count accepted observations with at least one valid outcome, not participants or complete observations. `matchedPairs` counts uniquely matched measurement-bearing observations; each paired time outcome requires valid values on both sides and reports its own n.

The generated report provides per-outcome valid n, missing/invalid counts, median, Q1, Q3 and IQR for times and paired time differences. Quartiles use linear interpolation at `(n - 1) × p` (R-7); IQR is Q3 minus Q1. With one value the IQR is zero, which does not establish precision. Binary rates show successes divided by valid observations and are condition summaries, not paired effect estimates. Discarded and unpaired data-row numbers are included in the data-quality section. No significance tests or improvement percentages are inferred by the script.

Run `npm run research:summary -- path/to/real_measurements.csv path/to/report.md` from the repository root. Exit code 2 means there were no valid observations and no report was written; an existing output file is unchanged. Always inspect the diagnostics before sharing a report. This CSV summarizes retrieval time, evidence-location time, documentation time, evidence-link presence and task success only. Portfolio preparation time and the secondary outcomes above need separately specified collection and analysis; their absence is not a zero result.

## Minimum pilot sequence
1. Recruit 3–5 student engineering/robotics teams if possible.
2. Observe their current workflow before showing Iznera.
3. Run baseline retrieval/documentation tasks.
4. Use Iznera during real work for multiple weeks.
5. Repeat matched tasks.
6. Export anonymized measurements.
7. Analyze both benefits and failure cases.

## RKNP story
Problem → measurable research question → engineered system → controlled/matched evaluation → measured results → limitations → practical impact.

This is stronger than presenting Iznera only as a startup or a polished website.
