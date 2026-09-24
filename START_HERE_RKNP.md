# TraceLab — START HERE for RKNP Daryn

## 1. Run the hardened checkpoint

Preserve your existing `.env`, `.env.local`, PostgreSQL database and browser data. Then from this folder:

```bash
npm install
npm run db:migrate
npm run frontend:verify
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

Keep the generated `package-lock.json` after install.

## 2. Judge routes

- `/showcase` — 60-second trilingual TraceLab story. Use this first when a judge asks “what does it do?”
- `/research` — research question, hypothesis, experimental design and metrics.
- `/app` — real Spatial Evidence Workbench.
- `/app/timeline` — real Engineering Timeline with **Trace Replay** (`R` toggles replay).
- `/app/graph` — Evidence Trace / causal relations.
- `/app/research` — live process evidence for the active team; do not present it as causal pilot results.

Demo account after `npm run db:seed`:

```text
lead@trace.demo / demo1234
```

## 3. 3-minute defense order

1. **Problem** — engineering files survive; the reason behind decisions disappears.
2. **Showcase** — Source → Student Why → Test → Decision → Why? → next-season memory.
3. **Real workspace** — show that these are actual first-class evidence objects, not slides.
4. **Trace Replay** — replay the real timeline.
5. **Research** — explain the matched baseline vs TraceLab study and the predeclared outcomes.
6. **Trust** — student authorship remains separate from source facts and machine suggestions.

Full script: `docs/rknp/RKNP_JUDGE_DEMO.md`.

## 4. What you must collect before the competition

Do not invent impact percentages. Fill `docs/rknp/pilot_measurements_template.csv` with real observations from pilot teams, then run:

```bash
npm run research:summary -- docs/rknp/your_real_pilot.csv docs/rknp/PILOT_RESULTS.generated.md
```

At minimum try to measure:

- time to retrieve an old design decision;
- time to locate its supporting test/evidence;
- manual documentation time;
- whether a decision is evidence-linked;
- task success;
- sample size, dates and limitations.

## 5. One sentence to remember

**TraceLab preserves not only what students built, but the source-linked evidence of how and why they built it.**
