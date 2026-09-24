# TraceLab — RKNP research protocol

## Research question
Can passive engineering-provenance capture combined with short student-authored rationale reduce documentation effort while improving retrieval of design rationale and supporting evidence in student engineering teams?

## Hypotheses
- **H0:** Adding TraceLab does not materially change retrieval time, evidence-link coverage, or documentation effort.
- **H1:** Adding TraceLab reduces retrieval/documentation time and increases the share of decisions linked to evidence.

## Experimental design
Use a matched before/after study with the same teams during real engineering work. Keep GitHub, CAD, chat, workshop practices, and competition context unchanged. The main independent variable is whether the TraceLab evidence layer is available.

For retrieval tasks, use matched historical questions of similar difficulty. When possible, randomize task order so participants do not always complete the baseline condition first.

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

## Minimum pilot sequence
1. Recruit 3–5 student engineering/robotics teams if possible.
2. Observe their current workflow before showing TraceLab.
3. Run baseline retrieval/documentation tasks.
4. Use TraceLab during real work for multiple weeks.
5. Repeat matched tasks.
6. Export anonymized measurements.
7. Analyze both benefits and failure cases.

## RKNP story
Problem → measurable research question → engineered system → controlled/matched evaluation → measured results → limitations → practical impact.

This is stronger than presenting TraceLab only as a startup or a polished website.
