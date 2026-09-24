# TraceLab Frontend Pre-Build Specification — v2

> Consolidated revision: original pre-build specification + 2026 resource acquisition plan.
> Date: 2026-09-04
> Major v2 updates: Base UI-first implementation, no new Vaul, internal TraceLab registry, license guardrails, exact resource acquisition list, real-evidence data pack, stricter component QA.

---

# TraceLab / Student Engineering Evidence Platform
## Frontend Pre-Build Specification & Research Pack

**Date:** 2026-09-04  
**Status:** Ready-for-visual-exploration / pre-implementation  
**Scope:** Frontend only. Preserve existing domain/server logic unless a frontend contract proves it must change.  
**Design source of truth:** `DESIGN (1).md` / **Living Evidence Lab**

---

# 0. Executive decision

The uploaded repository should **not** be rewritten from scratch.

It is a strong behavioral/domain foundation and a weak-to-moderate visual foundation. The correct strategy is:

> **Keep the product engine. Replace the presentation architecture.**

Preserve:

- Next.js 16 App Router architecture;
- React 19;
- Drizzle/PostgreSQL domain model;
- team/role/tenant gates;
- append-only source evidence;
- versioned annotations;
- iterations, tests, decisions and typed relationships;
- policy engine and student-owned mode;
- offline IndexedDB outbox and idempotent sync;
- EXIF/GPS stripping flow;
- integrations and export behavior;
- existing server actions/queries whenever possible;
- deterministic memory/Why? behavior.

Refactor or replace:

- global visual tokens;
- app shell;
- navigation IA;
- icon system;
- component primitives;
- evidence-domain components;
- Today / home hierarchy;
- Capture UI;
- Timeline visual language;
- Evidence Inbox interaction layer;
- Graph renderer/layout;
- inspectors/drawers;
- empty/loading/error/offline states;
- marketing site;
- motion system;
- visual/accessibility QA infrastructure.

The frontend must stop looking like a generic functional dashboard and become the **Living Evidence Lab**: a digital engineering workbench that remembers.

---

# 1. What the product UI must communicate

The product is not a notebook editor, LMS, task manager, CRM, Kanban app, or AI chat wrapper.

Its repeated interaction model is:

```text
REAL WORK
   ↓
MISSING WHY
   ↓
LINKED EVIDENCE
   ↓
TEST / DECISION
   ↓
NEXT ITERATION
   ↓
RETRIEVABLE MEMORY
```

Every major screen must reinforce one or more of those relationships.

The strongest signature should not be a gradient, mascot, logo, or gimmick. It should be the **Trace Line** and the way source → rationale → evidence → decision relationships appear throughout the product.

Core emotional target:

- serious enough for engineering;
- calm enough for long sessions;
- fast enough for a robotics pit/workshop;
- tactile and alive without becoming toy-like;
- youthful without becoming childish;
- trustworthy enough for schools/coaches/competitions;
- visually recognizable without the logo.

---

# 2. Repository audit

## 2.1 Existing stack

Uploaded repo currently uses:

- Next.js `16.2.6`
- React `19.2.6`
- TypeScript `5.9.3`
- Tailwind CSS `4.1.17`
- Drizzle ORM `0.45.2`
- PostgreSQL
- Zod `4.5.4`
- Vitest `5`

The repo is intentionally light on frontend dependencies. That is an advantage: there is no legacy UI framework to remove.

## 2.2 Existing route coverage

The app already exposes rich product surfaces including:

- `/app`
- `/app/capture`
- `/app/inbox`
- `/app/iterations`
- `/app/tests`
- `/app/decisions`
- `/app/timeline`
- `/app/graph`
- `/app/search`
- `/app/memory`
- `/app/failures`
- `/app/handoff`
- `/app/contribution`
- `/app/competition`
- `/app/exports`
- `/app/integrations`
- `/app/members`
- `/app/coach`
- `/app/org`
- `/app/notifications`
- `/app/settings`
- `/app/why/[type]/[id]`

This means the frontend job is primarily **information architecture + interaction design + component system + visual system**, not feature invention.

## 2.3 Existing frontend strengths

- Server Components are already used heavily.
- Domain semantics are explicit in code.
- Source/provenance/policy concepts already exist.
- Offline capture is real rather than mocked.
- Graph has an accessible list fallback.
- There is already a reduced-motion CSS fallback.
- There is already a skip link and focus treatment.
- Mobile navigation exists.
- Most pages use reusable helper components.

## 2.4 Existing frontend weaknesses

### Global visual system

Current CSS is a functional MVP system:

- blueprint blue `#2457D6` rather than Trace Blue `#4169FF`;
- generic gray/cool surface palette;
- 4/6/10 px radii rather than the intended 8–12 / 16–20 / 24–32 families;
- system fonts rather than Instrument Sans + IBM Plex Mono;
- generic `.card`, `.btn`, `.badge` classes;
- visual state primarily expressed with border/background changes.

### Navigation

Current sidebar exposes too many product concepts at the first level. `Failures`, `Handoff`, `Contribution`, `Graph`, `Timeline`, `Memory`, `Search`, etc. appear as parallel destinations. This makes the product feel feature-led rather than evidence-led.

Current icons are Unicode glyphs (`▣`, `◉`, `⚗`, `◆`, etc.). They are useful placeholders but not a production icon language.

### Today page

The current home page leads with five metric cards:

- code changes;
- CAD revisions;
- photos;
- tests;
- engineering decisions.

This directly conflicts with the design contract: **Today is not a KPI dashboard**. The primary object must be missing human context, not activity counts.

### Capture

The existing Capture component has excellent logic but looks like a form. It needs to become a fast workshop interaction:

- capture first;
- context second;
- one strong question;
- progressive disclosure;
- intentional local/offline state;
- mobile bottom sheet/full-screen mode.

### Graph

The current graph is a hand-built SVG with fixed four-column layout. It is a good prototype, but it will not scale to the intended evidence graph:

- no robust automatic directed layout;
- no collision/edge routing strategy;
- fixed node dimensions;
- limited focus mode;
- no semantic edge labels on focus/hover;
- hard to evolve toward controlled 20–30 node relationship views.

### Component architecture

`src/components/ui.tsx` mixes low-level primitives and domain components. It should be split so that generic primitives remain small and the product identity lives in dedicated evidence components.

## 2.5 Baseline reproducibility issue

The uploaded ZIP contains `package.json` but no `package-lock.json` and no installed `node_modules`. The repo README instructs `npm install`, so this is probably only an archive omission, but it means the exact dependency graph cannot currently be reproduced from the ZIP alone.

Before implementation, commit a lockfile and make the baseline CI green. Do not mix visual refactor work with dependency-resolution uncertainty.

---

# 3. Final frontend architecture decision

## 3.1 Foundation

**Keep:** Next.js 16 + React 19 + Tailwind 4.

**Add:** shadcn-owned component wrappers using **Base UI** primitives.

Reasoning:

- Base UI is headless, accessible, Tailwind-compatible, React-compatible and has no visual opinion.
- shadcn made Base UI the default for new projects in July 2026.
- This lets us own every component while relying on battle-tested focus, keyboard, ARIA and popup behavior.
- It avoids the visual gravity and theming complexity of MUI/Material Web.
- It lets Material 3 Expressive be a *design language*, not a component framework.

### Important RSC rule

Do not force client boundaries into server pages just to use a Base UI `render` callback.

For simple navigational elements:

- use server-safe `<Link>` elements styled through shared variants/classes;
- reserve Base UI primitives for actual interactive behavior;
- keep client islands narrow.

That prevents the design system from accidentally turning the app into a client-rendered shell.

## 3.2 Styling model

Use Tailwind 4 with semantic CSS custom properties.

Do **not** scatter raw hex colors or arbitrary radii inside JSX.

Layers:

```text
Foundation tokens
  ↓
Semantic tokens
  ↓
Primitive variants
  ↓
Evidence-domain components
  ↓
Screens
```

## 3.3 Component primitive base

Recommended primitive foundation:

- Base UI / shadcn: Button behavior where needed, Dialog, Drawer, Popover, Tooltip, Menu, Select, Combobox, Checkbox, Radio, Switch, Tabs, Toast, etc.
- Native HTML first for simple server-rendered controls.
- Shared visual variants independent from primitive implementation.

Avoid a “one library owns the whole UI” mindset. Base UI handles interaction/accessibility; TraceLab owns visual identity and domain semantics.

## 3.4 Motion

Use `motion` (`motion/react`) only for relationship/state transitions that CSS cannot express well.

CSS transitions remain the default for:

- hover colors;
- focus rings;
- simple opacity;
- small border/surface state changes.

Motion is for:

- Trace Line creation;
- card → inspector continuity;
- capture save snap;
- selected graph node focus;
- superseded decision transition;
- panel/drawer choreography;
- relationship highlights.

## 3.5 Evidence graph

Use:

- `@xyflow/react`
- `elkjs`

React Flow provides interaction/viewport/node infrastructure. ELK provides deterministic directed layout.

Do not use a free-floating force simulation.

Default graph direction: **left → right**.

Visible graph default should remain around 20–30 meaningful nodes. Cluster noisy source events.

## 3.6 Icons

Use `@phosphor-icons/react` as the base family, preferably Regular/Medium weight.

Why:

- technical but not thin/fragile;
- multiple weights;
- broad set;
- supports custom icons on the same 256×256 grid;
- has SSR-oriented import path for React Server Components.

Create custom evidence glyphs for:

- source event;
- revision;
- test;
- result;
- decision;
- rationale;
- superseded decision;
- relationship;
- policy restriction;
- offline evidence.

Do not mix Phosphor, Lucide, Material Symbols and emoji in production UI.

## 3.7 Large lists

Add `@tanstack/react-virtual` **only when evidence lists actually cross a performance threshold**.

Do not virtualize small lists preemptively because it complicates focus, dynamic heights and scroll restoration.

## 3.8 PWA / offline

Do not replace the existing IndexedDB outbox during the visual refactor.

The current implementation already provides important product semantics:

- stable client IDs;
- idempotent server sync;
- original local timestamp preservation;
- client-side image recompression;
- EXIF/GPS stripping;
- failed/pending state.

Treat that as product infrastructure.

Serwist is worth evaluating later if the app needs richer route/app-shell caching, but migrating the service worker and capture UI at the same time creates unnecessary risk.

## 3.9 Forms

Keep native forms + Server Actions + Zod as default.

Add `react-hook-form` only for genuinely state-heavy client forms. The 30-second Why and quick capture should remain simple enough not to require a form framework in many cases.

## 3.10 Charts

Do not add a chart library for the first frontend pass.

When structured test charts become necessary, evaluate a thin chart layer or D3-based implementation. Charts exist to explain a test or process gap, not to decorate a dashboard.

---

# 4. Design system v2 — Living Evidence Lab

## 4.1 Core visual tokens

### Light theme

```css
--bg-canvas:        #F6F7F2;
--bg-surface:       #FFFFFF;
--bg-subtle:        #EFF1EC;
--text-primary:     #111315;
--text-secondary:   #5E625D;
--text-tertiary:    #858983;
--border-subtle:    #E3E5DF;
--border-default:   #D5D8D1;
--border-strong:    #B8BCB4;

--trace-blue:       #4169FF;
--trace-blue-hover: #3157EB;
--trace-blue-soft:  #E9EEFF;
--signal-lime:      #C8F36D;
--signal-lime-soft: #F0F9D7;
--test-orange:      #F5A63C;
--decision-violet:  #7567F8;
--verified-green:   #378A62;
--failure-red:      #D9574F;
--pending-yellow:   #D8EA58;
--neutral-evidence: #8A8E88;
```

### Radius families

```text
Utility controls:       8–12 px
Evidence objects:      16–20 px
Expressive surfaces:   24–32 px
```

Use expressive radii only for hero interactions such as Capture, Add the Why and primary onboarding.

## 4.2 Typography

Primary:

- **Instrument Sans** — navigation, body, titles, buttons, forms, marketing.

Technical metadata:

- **IBM Plex Mono** — commit hashes, test IDs, revision IDs, timestamps, source labels, policy versions, sync state.

Load with `next/font` where possible.

Avoid making the UI “developer-console-like” by overusing mono. Mono is metadata, not body text.

## 4.3 Trace Line

The Trace Line is the repeated brand/interface motif.

Default:

- 1.5 px desktop;
- 2 px mobile;
- neutral color by default;
- semantic color only when relation state matters;
- rounded endpoints;
- arrows/edge labels only when needed for causality.

Use in:

- Today connection events;
- Timeline;
- Graph;
- Why? view;
- iteration detail;
- landing hero;
- export provenance preview;
- onboarding diagrams.

## 4.4 Surface hierarchy

Prefer border + surface contrast over deep shadows.

Shadows are reserved for temporary floating layers:

- menus;
- popovers;
- inspector when detached;
- mobile bottom sheet;
- command palette.

Evidence objects should feel placed on a workbench, not floating as glass cards.

## 4.5 Photography

Use real robotics/engineering artifacts:

- mechanism closeups;
- hands changing parts;
- scratched prototypes;
- wheels/gears;
- calipers;
- test rigs;
- wiring;
- 3D prints;
- CAD crops;
- telemetry;
- failed prototypes;
- before/after revisions.

Avoid stock smiling students, futuristic labs, fake holograms and generated robot art.

Image overlays should look like evidence metadata:

```text
PHOTO · 21:18
INTAKE / REV 04
linked to D-033
```

---

# 5. Information architecture v2

## Desktop sidebar

```text
TODAY

+ CAPTURE

PROJECT
  Timeline
  Evidence
  Tests
  Decisions

MEMORY
  Search
  Seasons

OUTPUT
  Portfolio
  Export

────────────
Team
Integrations
Settings
```

Secondary capabilities are not deleted. They move into the right domain context:

- Inbox → Evidence / Today queue;
- Iterations → Timeline/Evidence filters and detail routes;
- Graph → power view toggle from Timeline/Evidence;
- Failures → Memory/Search saved view;
- Handoff → Output/Season transition;
- Contribution → private profile/output view;
- Competition → global policy state / Export / settings context;
- Notifications → utility rail/inbox, not primary taxonomy;
- Coach/Org → role-aware workspace switch or dedicated secondary area.

## Mobile bottom navigation

Preferred:

```text
Today        Timeline        Memory
                ◉
             CAPTURE
```

Capture is the central expressive action.

Settings/integrations do not belong in bottom navigation.

## Desktop workspace

Default structure:

```text
┌────────────┬────────────────────────────────┬──────────────┐
│ Sidebar    │ Main evidence workspace        │ Inspector    │
│ 240        │ fluid                          │ 320–400      │
└────────────┴────────────────────────────────┴──────────────┘
```

Inspector is contextual and collapsible. Opening details must not destroy scroll/location context.

---

# 6. Screen blueprints

## 6.1 Today — highest priority

### Goal

Answer:

> What happened, and where is human context missing?

### Hierarchy

1. date / project context;
2. **Needs your context** queue;
3. one-tap Capture;
4. recent captured evidence;
5. newly connected evidence;
6. meaningful gaps only when useful;
7. offline/sync state only when relevant.

### Remove from top

Do not lead with five activity metrics.

Counts can exist as quiet metadata inside filters or summaries, but they are not the product story.

### Hero card

A `MissingContextCard` should show source facts already known, then ask one human question:

```text
GITHUB · 4 MIN AGO
84F2AE · drivetrain-control
+42  −18

Why did you make this change?

[ Add the why → ]
```

The emotional magic moment is: **“we didn’t have to rewrite all of this.”**

## 6.2 Capture

### Mobile launcher

```text
What happened?

[ Photo ]   [ Test ]
[ Decision ] [ Quick note ]
[ Import file ]
```

### Pattern

- mobile bottom sheet or full-screen mode;
- immediate camera for Photo;
- no long metadata form;
- known team/season/subsystem context auto-attached;
- advanced fields hidden behind “Add details”;
- safe-area aware;
- keyboard cannot cover all source context;
- save local first when offline;
- visible `Saved on device` → `Waiting to sync` → `Synced` transition.

### Quick Test

First capture:

- what are you testing?;
- measurement/result;
- optional photo/file.

Later enrichment:

- procedure;
- conclusion;
- linked decision;
- next step.

### Quick Decision

First:

> What did you decide?

Then:

> What evidence made you choose this?

Evidence linking may happen after the initial save.

## 6.3 30-second Why

This is the **signature interaction**.

Always show source facts first. Never ask the student to retype what GitHub/Onshape/test metadata already knows.

Main prompt:

> Why did you make this change?

Support:

> What were you trying to improve or fix?

Input:

- text;
- voice dictation;
- small structured chips if genuinely useful;
- optional evidence links.

Never show AI-generated rationale choices.

Completion:

```text
✓ Context saved

Link evidence?
T-024 · Motor acceleration test
+ Add another

[ Done ]
```

Target: normal completion in 20–40 seconds; comfortably below 45 seconds median.

## 6.4 Engineering Timeline — signature desktop screen

This becomes the main “understanding” surface.

It must show **causality and iteration**, not just chronological activity.

Recommended visual grammar:

```text
SEP 02
  ○ Problem: intake jams
  │
  □ REV 04 — roller spacing changed
  │   └─ student rationale
  │
  ◇ T-024 — 8 trials
  │   17/20 success
  │
  ◆ D-018 — keep 36 mm
  │
  □ REV 05 — guard updated
```

Capabilities:

- group source noise into meaningful iteration blocks;
- filters: All / Decisions / Tests / Revisions / Sources / Missing rationale;
- advanced filter drawer for subsystem, author, source, date, evidence state;
- sticky time/subsystem context when useful;
- click opens right inspector;
- keyboard up/down to traverse items;
- preserve list position on inspector close;
- URL-focusable entities for share/reload;
- compact summaries for burst activity instead of hundreds of equal cards.

## 6.5 Evidence Inbox / Evidence

Keep existing batch triage logic; redesign interaction.

Structure:

- triage toolbar;
- filter/search row;
- grouped unlinked source events;
- selection mode;
- contextual inspector;
- single/batch actions: Link, Start iteration, Archive, Sensitive;
- deterministic grouping suggestions clearly labeled as suggestions.

Do not let the inbox become email-like noise.

## 6.6 Iteration detail

Think “engineering change object,” not document page.

Recommended composition:

```text
ITERATION · I-018                       OPEN
Intake roller spacing

Problem / goal
Student rationale

TRACE
Source → revision → test → decision

Evidence
[photos] [commit] [test]

Outcome / next step

Source history / authorship / versions  → inspector
```

The trace is more important than a rich text editor.

## 6.7 Tests

Test cards must foreground result and relation:

```text
TEST · T-024                         SUPPORTED
Motor acceleration test
Mean deviation: 1.2°

8 runs · telemetry.csv
Linked to D-018
```

Charts only if they clarify engineering meaning.

Prefer direct labels, units and before/after comparison.

## 6.8 Decisions

Decision card must make state and support obvious:

- keep / revert / iterate / defer;
- rationale authorship;
- supporting/contradicting tests;
- superseded-by lineage;
- provenance one click away.

Superseded decisions should remain visible, gently recessed, never deleted from history.

## 6.9 Evidence Graph

Power view, not default home.

Directed left-to-right structure:

```text
PROBLEM      CHANGE       TEST        DECISION
  ○──────────□────────────◇────────────◆
              │
              ├──────────◇
              └────□
```

Interaction:

- select node → center/focus;
- first-order relations highlighted;
- unrelated nodes dim;
- relationship label appears;
- inspector opens;
- `Open in timeline` action;
- list/text fallback always available;
- keyboard traversal;
- no more than ~30 visible nodes by default;
- cluster source-event bursts.

## 6.10 Memory / Search

Deterministic evidence retrieval first.

Search result anatomy:

- answer/result title;
- exact source evidence snippets/objects;
- season/subsystem/time;
- confidence / missing evidence where relevant;
- direct trace links.

If AI is enabled later:

> Based on 4 project sources

and each factual claim must link back to evidence.

Never show a big standalone AI chat as the app identity.

## 6.11 Competition / Policy

Policy is a visible system state, not a hidden permissions layer.

Use explicit message:

> AI rewrite is unavailable in this competition mode because it could alter student-authored engineering evidence.

not simply:

> Disabled

Show:

- competition profile;
- season;
- policy version/date;
- last review state;
- restricted action explanation;
- provenance behavior;
- export checks.

## 6.12 Export

Use a three-stage composition:

```text
1. Select evidence
2. Resolve trust/policy checks
3. Preview/output
```

`ExportCheck` should explicitly show:

- missing provenance;
- prohibited AI involvement;
- missing student-authored rationale;
- unavailable source;
- privacy/PII concerns;
- competition structural limits.

## 6.13 Coach

Show process gaps, never student volume ranking.

Useful signals:

- decisions without evidence;
- tests without conclusions;
- missing rationale trend;
- unresolved hypotheses;
- source sync health;
- continuity gaps.

Do not display “top contributor,” raw commit leaderboard or productivity score.

## 6.14 Landing page

Hero copy direction:

> # Your robot already tells a story.  
> # Keep the why.

Supporting:

> Capture builds, tests and decisions from the tools your team already uses — then connect them into evidence you can actually come back to.

CTA:

- `Start a pilot`
- `See a project trace →`

Hero visual is not a laptop mockup. It is an interactive evidence trace containing one real prototype/robot photo.

Suggested story sequence:

1. Your evidence is everywhere.
2. Work normally.
3. Add the why, not another report.
4. Every iteration becomes traceable.
5. Remember why you built it this way.
6. Evidence without replacing student thinking.
7. One evidence base. Many outputs.
8. Next year’s team starts where this one finished.
9. Trust proof points.
10. Join the pilot.

---

# 7. Component architecture

## 7.1 Proposed folder shape

```text
src/components/
  primitives/
    button.tsx
    icon-button.tsx
    input.tsx
    textarea.tsx
    select.tsx
    combobox.tsx
    checkbox.tsx
    radio.tsx
    switch.tsx
    tooltip.tsx
    popover.tsx
    menu.tsx
    dialog.tsx
    drawer.tsx
    tabs.tsx
    toast.tsx
    skeleton.tsx
    divider.tsx
    avatar.tsx

  app-shell/
    sidebar.tsx
    mobile-nav.tsx
    project-switcher.tsx
    utility-rail.tsx
    command-palette.tsx
    inspector-shell.tsx

  evidence/
    evidence-card.tsx
    source-event-card.tsx
    missing-context-card.tsx
    test-card.tsx
    decision-card.tsx
    rationale-card.tsx
    evidence-inspector.tsx
    evidence-citation.tsx
    provenance-badge.tsx
    source-badge.tsx
    relationship-chip.tsx
    source-history.tsx

  capture/
    capture-launcher.tsx
    capture-sheet.tsx
    capture-photo.tsx
    capture-test.tsx
    capture-decision.tsx
    rationale-prompt.tsx
    voice-input.tsx
    sync-status.tsx

  timeline/
    engineering-timeline.tsx
    timeline-group.tsx
    timeline-event.tsx
    trace-connector.tsx

  graph/
    evidence-graph.tsx
    evidence-node.tsx
    evidence-edge.tsx
    graph-inspector.tsx
    graph-controls.tsx

  policy/
    competition-mode.tsx
    policy-badge.tsx
    restricted-action.tsx
    policy-details.tsx

  output/
    output-selector.tsx
    export-check.tsx
    export-preview.tsx

  feedback/
    empty-state.tsx
    error-state.tsx
    offline-state.tsx
    loading-state.tsx
```

## 7.2 Domain component rule

Never encode all product semantics into a single generic `<Card type="...">` with dozens of variants.

`TestCard`, `DecisionCard`, `SourceEventCard`, and `MissingContextCard` deserve dedicated semantics and tests.

The visual system may share subparts, but the domain model must remain explicit.

## 7.3 EvidenceCard state matrix

Every meaningful evidence object should define these states:

- default;
- hover;
- focused;
- selected;
- pending rationale;
- linked;
- unsupported/unlinked;
- superseded;
- offline;
- syncing;
- sync error;
- restricted;
- read-only.

Do not encode every state using border color alone.

---

# 8. Motion specification

Motion explains **state and relationship**; it is not decoration.

## Timing

```text
Micro feedback:                   100–160 ms
Standard transition:              180–240 ms
Panel / inspector:                220–300 ms
Expressive relationship motion:   280–420 ms
```

Avoid 700–1000 ms transitions in core workflows.

## Signature motions

### Capture save

Short mechanical snap:

- button compresses 0.98 → 1;
- state label transitions to Saved;
- optional small Trace Line pulse toward local sync indicator.

No confetti.

### Link creation

Trace Line visibly extends from source to target in ~300–380 ms.

### Evidence → inspector

Use shared layout continuity rather than a sudden modal replace.

### Decision supersession

Old decision reduces visual emphasis while the new decision becomes active. History stays readable.

### Graph focus

Selected node settles into emphasis, neighbors remain, unrelated nodes fade. Avoid zoom-spin spectacle.

## Reduced motion

Respect `prefers-reduced-motion` and Motion `useReducedMotion`.

Replace line drawing and spatial slides with instant state changes or short opacity fades.

---

# 9. Accessibility contract

Target WCAG 2.2 AA for product UI.

Mandatory:

- visible 2 px minimum focus ring;
- 44×44 px minimum touch targets, 48×48 preferred for primary mobile actions;
- state never communicated by color alone;
- keyboard navigation for sidebar, filters, command palette, evidence traversal, inspector and rationale save;
- Esc closes temporary layers;
- focus returns to origin after closing drawer/dialog;
- graph has a textual equivalent;
- image evidence has meaningful context/alt behavior;
- tooltip content cannot be the only source of information;
- reduced motion mode;
- 200% zoom resilience;
- text contrast AA;
- form errors linked to fields;
- offline/sync messages use `aria-live` intentionally, not noisily.

### QA infrastructure

Add Storybook for primitives and domain components.

Stories should cover state matrices, not only happy-path default renders.

Enable:

- Storybook a11y addon / axe;
- interaction tests for keyboard behavior;
- visual regression for high-value components/screens;
- viewport stories for mobile/tablet/desktop;
- light and workshop-dark modes.

---

# 10. Responsive contract

Breakpoints:

```text
xs   <480
sm   480–767
md   768–1023
lg   1024–1279
xl   1280–1535
2xl  1536+
```

## Desktop

- 240 px sidebar;
- 320–400 px optional inspector;
- fluid main workspace;
- 1180–1320 px readable max width where appropriate;
- dense utility UI, but not cramped.

## Tablet

- sidebar collapses;
- inspector becomes drawer;
- Timeline remains first-class;
- graph controls simplify;
- Capture remains easy to reach.

## Mobile

- single-column;
- 16–20 px horizontal padding;
- central Capture action;
- bottom sheets for context/enrichment;
- no desktop table squeezed into viewport;
- quick capture and Why are first-class rather than degraded desktop forms.

---

# 11. Recommended dependency set

## Adopt now for frontend rebuild

```text
@base-ui/react
motion
@xyflow/react
elkjs
@phosphor-icons/react
```

Use shadcn CLI to copy/own selected wrappers; do not install dozens of unused components.

Development/QA:

```text
storybook
@storybook/addon-a11y
Storybook Vitest integration
Playwright (for critical end-to-end UI flows)
```

## Optional / threshold-based

```text
@tanstack/react-virtual   # only for genuinely large lists
dexie                     # only if offline storage becomes substantially more complex
Serwist                   # later, for richer PWA/app-shell caching
```

## Avoid in the first pass

- MUI as the app component system;
- `@material/web` as the React UI base;
- Vaul as a new drawer dependency when Base UI Drawer exists;
- GSAP for core product UI;
- Three.js;
- BlockNote/Notion editor as a product center;
- generic dashboard/chart kits;
- free-force graph layout;
- full CRM/project-management templates;
- arbitrary animation component packs.

---

# 12. Public repository/reference matrix

## Tier A — directly useful implementation references

### Cal.com Developer Starter Kit
https://github.com/calcom/developer-starter-kit

Study:

- Next.js 16 / React 19 / Tailwind 4 component ownership;
- server-first architecture;
- primitives copied into repo;
- CSS token discipline;
- keeping UI source local rather than SDK-locked.

Use as an **engineering-pattern reference**, not a visual clone.

### OpenStatus Template
https://github.com/openstatusHQ/openstatus-template

Study:

- high-level component composition;
- ActionCard / SectionCard / FormCard / EmptyState patterns;
- shadcn ownership.

Do not copy its metric-dashboard worldview into Today.

### Papermark
https://github.com/papermark/papermark

Study:

- mature Next.js + Tailwind + shadcn structure;
- document/export surfaces;
- polished app shell patterns.

### React Flow / xyflow
https://github.com/xyflow/xyflow

Use directly for evidence graph infrastructure; MIT.

### Phosphor Icons
https://github.com/phosphor-icons/react

Use directly for base icon family; MIT.

## Tier B — study UX patterns, not foundation

### Twenty
https://github.com/twentyhq/twenty

Study:

- object-centric record pages;
- dense structured data UI;
- inspector/detail interaction;
- keyboard/power-user patterns.

Do not inherit CRM taxonomy or enterprise heaviness.

### Plane
https://github.com/makeplane/plane

Study:

- navigation density;
- filters;
- keyboard interaction;
- command patterns.

Do not copy issue/Kanban metaphors.

### OpenStatus
https://github.com/openstatusHQ/openstatus

Study:

- Drizzle + Next + Tailwind + shadcn organization;
- operational states;
- reliability UX.

License is AGPL, so treat as a reference unless licensing is deliberately accepted.

### Documenso
https://github.com/documenso/documenso

Study:

- trust-heavy flows;
- document/export checks;
- status/provenance presentation.

## Tier C — competitor / concept reference only

### FTC TeamForge
https://github.com/incredibotsftc/teamforge

Useful for:

- FTC terminology;
- team/season onboarding;
- offline expectations;
- understanding competitor breadth.

Do **not** use it as the product UI model: its dashboard/Kanban/notebook/team-management center is specifically what TraceLab must differentiate from.

It is AGPL-3.0 and its README explicitly frames commercial use as prohibited, so do not copy code into a commercial product without proper legal analysis.

---

# 13. Product/site references and exactly what to borrow

## Material 3 Expressive

Borrow:

- expressive containment;
- large accessible touch targets;
- stateful shape changes;
- tactile but purposeful motion;
- clear primary action hierarchy.

Do not borrow:

- every surface becoming a huge pill;
- color everywhere;
- consumer-phone density on desktop engineering screens.

## Linear

Borrow:

- disciplined desktop shell;
- keyboard navigation;
- progressive disclosure;
- inspector behavior;
- hover/focus craft;
- compact secondary UI.

Do not become a dark issue tracker.

## Teenage Engineering

Borrow:

- engineering-object identity;
- technical labels;
- part/revision metadata;
- industrial photography;
- restrained tactile playfulness.

Avoid tiny controls and extreme minimalism.

## Attio

Borrow:

- object-centric mental model;
- structured record/details;
- fast command/search patterns;
- strong relationship context.

## Tandem / engineering knowledge graph products

Borrow:

- explicit decision ↔ test ↔ revision semantics;
- graph/timeline traceability;
- passive capture as a core workflow;
- cross-project/season memory mindset.

Translate adult PLM vocabulary into student-friendly terms.

## Granola-like principle

Borrow the human-first relationship with AI:

- automation around human input;
- calm AI presence;
- AI is contextual, not the product’s visual center.

## Hack Club

Borrow:

- student-maker authenticity;
- real things being built;
- project-centered photography;
- energy and confidence.

Keep campaign chaos out of the core app.

---

# 14. Community/forum signals

Community discussion is not authoritative, but it supports two useful conclusions:

1. Teams that expect heavy customization tend to prefer the shadcn ownership model because the source lives inside the app rather than behind a strongly opinionated theme API.
2. There is a real tradeoff: owning component code means maintaining it. Therefore the correct solution is not “copy random shadcn blocks forever”; it is to create a **small internal component system with strict ownership and Storybook coverage**.

For TraceLab, that tradeoff is worth it because distinct visual identity is a product requirement, not decoration.

---

# 15. What not to copy from the internet

Do not import a full “SaaS dashboard” template.

Reject UI kits that lead toward:

- left sidebar + four KPI cards + bento widgets;
- purple/blue gradient hero;
- glass panels;
- giant Ask AI input;
- generic activity feed;
- Kanban core;
- student leaderboard;
- Notion clone;
- fake AI-generated 3D robot;
- “productivity score”;
- floating node spaghetti graph;
- every card having 24–32 px rounding;
- every interaction bouncing.

The internet should supply **implementation techniques**, not the product identity.

---

# 16. Pre-development work order

## Gate 0 — baseline and repository hygiene

Before touching visual code:

- choose/confirm package manager;
- commit a lockfile;
- run existing CI locally;
- capture baseline screenshots of every important route;
- record current responsive behavior;
- preserve offline capture tests;
- create a frontend refactor branch.

## Gate 1 — design foundations

Build and freeze:

- semantic token schema;
- light/dark tokens;
- typography loading;
- spacing/radii;
- icon rules;
- focus ring;
- motion tokens;
- responsive container rules.

## Gate 2 — primitives in Storybook

Implement only needed primitives and all states:

- Button / IconButton;
- Input / Textarea / Select / Combobox;
- Tooltip / Popover / Menu;
- Dialog / Drawer / BottomSheet;
- Tabs / SegmentedControl;
- Toast / Banner / Skeleton;
- badges/chips.

Run a11y tests immediately.

## Gate 3 — evidence-domain component library

Create:

- SourceBadge;
- ProvenanceBadge;
- PolicyBadge;
- SyncBadge;
- EvidenceCard family;
- MissingContextCard;
- TimelineEvent;
- RelationshipChip;
- EvidenceCitation;
- Inspector patterns.

No page rebuild until these states are coherent.

## Gate 4 — shell and navigation

Replace app shell while preserving route behavior.

Implement:

- new IA;
- project switcher;
- desktop sidebar;
- mobile central Capture;
- contextual inspector;
- command palette.

## Gate 5 — vertical slice

Build one complete “magic” journey before polishing every route:

```text
Today
 → missing GitHub context
 → Add the Why
 → link test
 → decision
 → Timeline
 → Why?/source history
```

This slice must be excellent on desktop and mobile.

## Gate 6 — core screens

Order:

1. Today
2. Capture
3. 30-second Why
4. Timeline
5. Evidence/Inbox
6. Iteration
7. Tests
8. Decisions
9. Graph
10. Memory/Search
11. Competition/Export
12. Coach/Org

## Gate 7 — landing

Build marketing only after real product screens are visually credible. Reuse actual product semantics and screenshots.

## Gate 8 — hardening

- visual regression;
- keyboard audit;
- touch audit;
- reduced motion;
- 320/375/390/768/1024/1440/1920 widths;
- offline capture test;
- slow network test;
- empty/error state audit;
- contrast;
- dark workshop mode;
- performance budget;
- RSC/client-boundary audit.

---

# 17. Performance rules

- Server Components by default.
- Client islands only where interaction requires them.
- Do not turn the entire shell into `"use client"`.
- Import icon components through RSC/SSR-safe entry points where applicable.
- Lazy-load graph infrastructure on graph/power views.
- Do not ship ELK/React Flow to Today if no graph is visible.
- Use `LazyMotion`/feature loading if Motion bundle grows materially.
- Prefer CSS transitions for simple effects.
- Optimize engineering photos with Next/Image where compatible with provenance needs.
- Preserve original source metadata separately from display thumbnails.
- Avoid unnecessary chart libraries.
- Virtualize only after measurement.

Suggested UI targets:

- immediate interactive feedback <100 ms where local;
- no layout shift when inspector opens;
- capture usable on modest school phones;
- critical mobile capture path robust on weak networks;
- no animation blocks input.

---

# 18. Content and microcopy rules

Voice:

- direct;
- respectful;
- concise;
- technically clear;
- not childish;
- not corporate;
- not overexcited.

Good:

> Why did you make this change?

Bad:

> Tell us more about the thinking behind your engineering modification!

Good:

> Saved on device

Bad:

> Don’t worry! We’ll upload this magical moment later ✨

Good:

> Based on 4 project sources

Good:

> I can’t find enough evidence to answer this reliably.

Never use vague trust theater such as `100% authentic` unless the system can actually prove it.

---

# 19. Required real-world assets before final visual polish

Generic “Material 3 skills” are **not required** to start. Official M3 principles plus the existing DESIGN.md are already enough to define the system.

The most valuable additional inputs from the team would be:

1. 8–20 real robotics/engineering photos that can legally be used in prototypes/marketing;
2. a few authentic GitHub commit examples;
3. 2–3 real test result examples;
4. 2–3 real engineering decision/rationale examples;
5. actual team/subsystem names for realistic demo data;
6. any existing logo/brand sketches if the codename visual needs temporary branding;
7. screenshots/Figma frames of any interface direction you absolutely want to preserve;
8. any curated `SKILL.md` for Material 3, Motion, accessibility, or a design system if you already trust it.

If a generic M3 skill conflicts with the TraceLab design contract, the TraceLab design contract wins.

---

# 20. Definition of Ready for coding

Frontend development can start when these are true:

- [ ] Design source of truth accepted: Living Evidence Lab.
- [ ] Repository baseline installs reproducibly from a lockfile.
- [ ] Existing CI is green or failures are documented before visual edits.
- [ ] Core IA is frozen for the first frontend pass.
- [ ] Token names are frozen.
- [ ] Primitive strategy is frozen: Base UI/shadcn + native server-safe elements.
- [ ] Icon family is frozen.
- [ ] Motion timings are frozen.
- [ ] Today wire hierarchy is frozen.
- [ ] Capture/Why mobile flow is frozen.
- [ ] Timeline visual grammar is frozen.
- [ ] Graph strategy is frozen: React Flow + ELK, controlled DAG.
- [ ] Evidence state matrix exists.
- [ ] Storybook/a11y plan exists.
- [ ] Offline behavior is treated as a protected product contract.
- [ ] No AGPL competitor code will be copied into the product by accident.
- [ ] Realistic demo evidence is available.

At that point implementation should be a controlled frontend refactor rather than open-ended “make it prettier” work.

---

# 21. Recommended first implementation PRs

Keep changes reviewable.

```text
PR 01  frontend foundation: fonts + tokens + semantic Tailwind theme
PR 02  primitives + Storybook + a11y harness
PR 03  evidence badges/cards + state stories
PR 04  app shell + desktop/mobile navigation + inspector
PR 05  Today redesign
PR 06  Capture + offline state redesign
PR 07  30-second Why flow
PR 08  Timeline redesign
PR 09  Evidence/Inbox + Iteration polish
PR 10  Tests + Decisions
PR 11  Evidence Graph → React Flow + ELK
PR 12  Memory/Search + Why/source history
PR 13  Competition + Export
PR 14  Coach/Org secondary surfaces
PR 15  landing page
PR 16  visual/a11y/performance hardening
```

Do not combine all of this in one giant AI-generated rewrite.

---

# 22. Final design direction in one paragraph

**TraceLab should feel like Material 3 Expressive was reinterpreted for a robotics engineering lab, then disciplined with Linear-grade desktop hierarchy, given Teenage Engineering-style technical character, Attio-like object clarity and Tandem-like evidence relationships.** The app is light-first and warm, with Trace Blue for action, Signal Lime used sparingly, real engineering media, Instrument Sans for human UI and IBM Plex Mono for technical lineage. Its signature surface is the Engineering Timeline; its signature interaction is Add the Why; its signature visual motif is the Trace Line; and its strongest trust feature is that authorship, provenance, policy and offline state are always legible.

---

# 23. Research links

Official / implementation foundations:

- https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- https://base-ui.com/react/overview/about
- https://base-ui.com/react/overview/accessibility
- https://motion.dev/docs/react
- https://reactflow.dev/learn/layouting/layouting
- https://storybook.js.org/docs/writing-tests
- https://storybook.js.org/docs/writing-tests/accessibility-testing
- https://serwist.pages.dev/docs/next/getting-started

Public code references:

- https://github.com/calcom/developer-starter-kit
- https://github.com/openstatusHQ/openstatus-template
- https://github.com/papermark/papermark
- https://github.com/xyflow/xyflow
- https://github.com/phosphor-icons/react
- https://github.com/twentyhq/twenty
- https://github.com/makeplane/plane
- https://github.com/openstatusHQ/openstatus
- https://github.com/incredibotsftc/teamforge

Product/UX references:

- https://m3.material.io/
- https://linear.app/
- https://attio.com/
- https://teenage.engineering/
- https://hackclub.com/
- https://tandem.inc/

---

# 24. Handoff to the build agent

When implementation begins, the agent should receive this instruction before any code changes:

> Preserve the existing TraceLab domain/server/offline behavior. Treat DESIGN.md and this frontend pre-build specification as the visual/interaction contract. Do not redesign the product into a generic SaaS dashboard, project manager, notebook editor or AI chat. Build foundations and domain components first, then implement the Today → Add the Why → evidence link → Timeline vertical slice. Keep Server Components as default, use narrow client islands, make provenance/policy/offline state explicit, and verify each stage with Storybook/a11y/visual tests before moving to the next screen.



---

# APPENDIX — FRONTEND RESOURCE ACQUISITION PACK

# TraceLab — Frontend Resource Acquisition Pack

> **Status:** pre-development acquisition guide
> **Date:** 2026-09-04
> **Purpose:** exact resources to collect before the TraceLab frontend rebuild
> **Source of truth:** `DESIGN.md` + Product PRD + existing `student-engineering-evidence-platform` repo
> **Design direction:** Living Evidence Lab

---

# 0. Executive decision

Do **not** collect a giant folder of random dashboards or visual-effect libraries.

The strongest build strategy is:

1. keep the existing TraceLab domain/backend/offline/policy implementation,
2. replace the presentation architecture,
3. use Material 3 Expressive as a **design language**, not as a runtime component kit,
4. use shadcn + Base UI as owned accessible primitives,
5. use a small number of MIT-licensed component/reference repositories for solved interaction mechanics,
6. build TraceLab-specific domain components ourselves,
7. make Timeline + 30-second Why + provenance the visual identity,
8. create an internal TraceLab shadcn registry after primitives stabilize.

The resource pack below is intentionally selective. More code is not better; the goal is the highest signal-to-noise ratio.

---

# 1. SEND THESE TO ME — highest-value pack

## P0 — already supplied

### A. TraceLab current repository
Already supplied:

`student-engineering-evidence-platform.zip`

**Do not resend unless you change it.**

This remains the product-engine/backend/domain source of truth.

---

## P1 — download and send these repositories as ZIPs

### 1. Cal.com Developer Starter Kit — MUST HAVE

Repository:
https://github.com/calcom/developer-starter-kit

Download:
https://github.com/calcom/developer-starter-kit/archive/refs/heads/main.zip

Why:
- current Next.js 16 App Router architecture,
- React 19,
- Tailwind CSS v4,
- Server Components / Server Actions,
- copied/owned UI primitives rather than opaque package styling,
- very small compared with Cal.com itself,
- excellent reference for a clean 2026 React/Next frontend structure.

What I will inspect/copy as *patterns*:
- `src/components/ui/`
- app shell organization,
- server/client component boundaries,
- Tailwind v4 token organization,
- form composition,
- component ergonomics.

What I will NOT copy:
- scheduling-specific product UI,
- brand styling,
- Cal.com domain logic.

Priority: **10/10**

---

### 2. ReUI — MUST HAVE

Repository:
https://github.com/keenthemes/reui

Download:
https://github.com/keenthemes/reui/archive/refs/heads/main.zip

License: MIT (verify the LICENSE in the downloaded snapshot before any direct source reuse).

Why:
- 1000+ shadcn-compatible examples,
- Base UI variants,
- unusually useful high-level primitives missing from base shadcn,
- production mechanics for timeline, filters, file upload, tree, stepper, resizable surfaces, data grid,
- copy-and-own model.

The important part is **not** the dashboard styling. The important part is solved component mechanics.

Target components for TraceLab:
- `timeline`
- `file-upload`
- `filters`
- `tree`
- `stepper`
- `resizable`
- `scroll-area`
- `drawer`
- `sheet`
- `combobox`
- `command`
- `empty`
- `item`
- `sortable` only if Evidence Inbox batching needs it
- `data-grid` only for coach/admin surfaces

Do NOT import:
- generic dashboard cards,
- Kanban,
- Gantt,
- decorative layouts,
- their palette as our design system.

Priority: **10/10**

---

### 3. Kibo UI — HIGHLY RECOMMENDED

Repository:
https://github.com/shadcnblocks/kibo

Download:
https://github.com/shadcnblocks/kibo/archive/refs/heads/main.zip

License: MIT.

Why:
Kibo is useful specifically because it supplies higher-level, composable components rather than another set of buttons.

Target mechanics:
- Dropzone / file intake,
- Image Crop,
- Tree,
- Status,
- Relative Time,
- Tags,
- Code Block / source metadata presentation,
- potentially table helpers.

TraceLab use:
- CapturePhoto,
- evidence attachments,
- local redaction/crop before upload,
- source-history tree,
- technical metadata,
- sync/provenance states.

Priority: **8.5/10**

---

### 4. OpenStatus `data-table-filters` — HIGHLY RECOMMENDED

Repository:
https://github.com/openstatusHQ/data-table-filters

Download:
https://github.com/openstatusHQ/data-table-filters/archive/refs/heads/main.zip

License: MIT.

Why:
This is a focused repo, not a generic dashboard.
It combines:
- TanStack Table,
- shadcn/ui,
- cmdk,
- `nuqs`,
- faceted filters,
- sorting,
- infinite scroll,
- URL-synchronized filter state.

TraceLab use:
- Evidence Inbox advanced filtering,
- Timeline filters,
- Tests / Decisions dense views,
- Coach dashboard drill-down,
- Export evidence selection.

We will **not** force table UI into core Timeline/Today. We will reuse filter/state mechanics.

Priority: **9/10**

---

### 5. Emil Kowalski — Skills for Design Engineers — MUST HAVE SKILL PACK

Repository:
https://github.com/emilkowalski/skills

Download:
https://github.com/emilkowalski/skills/archive/refs/heads/main.zip

License: MIT.

Why:
These skills encode design-engineering judgment learned from products/teams such as Vercel and Linear, especially around interaction feel and animation decisions.

I want the whole `skills/` directory, especially skills covering:
- design engineering,
- animation review,
- improving animations,
- finding useful animation opportunities,
- animation vocabulary,
- UI-library choice,
- prototyping / polish.

TraceLab use:
- enforce motion quality,
- stop AI-default animation mistakes,
- polish Capture save,
- shared-element Evidence → Inspector transition,
- Trace Line relationship animation,
- drawer / mobile interactions,
- hover/focus feedback.

Priority: **10/10**

---

## P1.5 — one small official skill folder

### 6. Official shadcn skill — MUST HAVE OR INSTALL DIRECTLY

Repository:
https://github.com/shadcn-ui/ui

Exact folder:
`skills/shadcn/`

Exact entry file:
https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/SKILL.md

You do **not** need to send the full 100k+ star shadcn repo if it is inconvenient.
The useful thing for our coding-agent workflow is the `skills/shadcn` folder.

Why:
- current 2026 shadcn CLI conventions,
- Base UI vs Radix rules,
- registry authoring,
- composition rules,
- semantic theming,
- project-aware component lookup,
- prevents agents from guessing old APIs.

Priority: **10/10**

---

## P2 — optional, only if we want Stitch-assisted visual exploration

### 7. Google Stitch Skills

Repository:
https://github.com/google-labs-code/stitch-skills

Download:
https://github.com/google-labs-code/stitch-skills/archive/refs/heads/main.zip

Useful plugins/skills:
- `stitch-design`
- `generate-design`
- `manage-design-system`
- `extract-design-md`
- `taste-design`
- `stitch-build`
- `react-components`
- `shadcn-ui`

Use this only if we are actually going to use Google Stitch during the design iteration loop.
It is **not required** to build the frontend.

Priority: **6.5/10**, or **9/10 if Stitch is part of the workflow**.

---

# 2. MORE IMPORTANT THAN ANOTHER REPOSITORY: REAL ENGINEERING DATA PACK

If the goal is the **best possible** frontend rather than a polished fake demo, real TraceLab content is more valuable than a 6th UI repo.

Please send any subset you can provide.

## A. Robot / engineering media
Recommended: 8–20 images.

Best subjects:
- intake mechanism,
- drivetrain,
- wheels/gears,
- wiring,
- prototype failures,
- before/after rebuild,
- CAD screenshots,
- test setup,
- telemetry screenshot,
- handwritten annotations,
- hands/tools working on hardware.

Avoid polished stock images. Imperfect real evidence is better.

Folder suggestion:

```text
sample-evidence/
  photos/
    intake-rev04.jpg
    drivetrain-test.jpg
    wiring-rework.jpg
    failed-print.jpg
```

## B. Sample GitHub evidence
10–25 realistic commits are enough.

For each, ideally:
- short hash,
- timestamp,
- author display name,
- commit message,
- files changed,
- + / - lines,
- subsystem.

Can be exported as JSON/CSV/text. It does not need to be connected to GitHub live.

## C. Tests
3–8 realistic test records.

Example shape:

```json
{
  "id": "T-024",
  "title": "Motor acceleration test",
  "subsystem": "drivetrain",
  "metric": "heading deviation",
  "unit": "deg",
  "runs": [4.7, 3.2, 2.1, 1.2],
  "criterion": "<= 1.5 deg",
  "result": "pass",
  "linkedRevision": "REV-07"
}
```

## D. Decisions
3–8 realistic decisions.

Example:

```json
{
  "id": "D-018",
  "title": "Keep revised acceleration curve",
  "why": "Reduced wheel slip while keeping cycle time acceptable.",
  "linkedEvidence": ["T-024", "REV-07"],
  "outcome": "keep"
}
```

## E. A few authentic student rationales
5–15 examples, short and imperfect.

They should sound like actual student reasoning—not marketing copy.
These are critical to designing hierarchy between:
- source facts,
- student rationale,
- tests,
- system-derived relationships.

## F. Team context
Optional but helpful:
- example team name/number,
- current season,
- 4–8 subsystem names,
- competition type,
- sample member names/initials (fictional is fine),
- typical workshop phone width/device if known.

---

# 3. RESOURCES I WILL INSTALL MYSELF — DO NOT DOWNLOAD/SEND

These should be package dependencies, not ZIP references.

## Runtime / foundation

### Base UI
Package:
`@base-ui/react`

Role:
- accessible headless primitives,
- Drawer,
- Dialog,
- Menu,
- Popover,
- Combobox,
- Select,
- Tooltip,
- etc.

Reason:
Shadcn now defaults to Base UI for new projects; Base UI gives us behavior without forcing visual identity.

### shadcn CLI
Use current `shadcn` CLI and owned source components.

We will use semantic TraceLab tokens rather than raw default shadcn styling.

### Motion
Package:
`motion`

Role:
- layout/shared-element transitions,
- springs,
- gestures,
- reduced-motion handling.

### React Flow
Package:
`@xyflow/react`

Role:
- evidence graph interaction mechanics,
- keyboard support,
- custom nodes/edges,
- viewport/focus behavior.

### ELK.js
Package:
`elkjs`

Role:
- directed/layered layout,
- ports,
- edge-crossing reduction.

License note:
ELK.js currently declares `EPL-2.0 OR GPL-3.0-or-later`. Treat it as a dependency and keep license notices/compliance in the dependency inventory; do not paste its source into TraceLab.

### Phosphor
Package:
`@phosphor-icons/react`

Role:
- default icon family.

We will create TraceLab custom evidence symbols separately on a compatible consistent grid/style.

### nuqs
Package:
`nuqs`

Role:
- URL state for Timeline/Search/Graph filters,
- shareable focused views,
- back-button-safe UI state.

### Storybook
Role:
- isolated product-component development,
- state matrix,
- responsive stories,
- documentation.

### Storybook a11y
Package:
`@storybook/addon-a11y`

Role:
- axe-based accessibility checks per story.

### Visual regression
Use Storybook visual tests / Chromatic or the project's preferred screenshot CI.

### Serwist — only after existing offline behavior is baseline-tested
Package family:
`serwist` / `@serwist/next`

Role:
- app shell/service worker/PWA lifecycle.

Important:
Do **not** replace the existing IndexedDB capture outbox just because Serwist exists.
Serwist can complement it.

### TanStack Table / Virtual
Use only where density warrants them.

Do not virtualize or table-ify core surfaces prematurely.

---

# 4. 2026 CORRECTIONS — THINGS WE SHOULD NOT ADOPT

## 4.1 Material Web runtime components — NO

Use Material 3 Expressive as a **design reference / design language**.
Do not base the implementation on Material Web components.

Reason:
Material Web is in maintenance mode; TraceLab needs custom visual identity and long-lived component ownership.

## 4.2 Vaul — NO NEW DEPENDENCY

Do not introduce Vaul for drawers.

Reason:
The upstream Vaul repo is marked unmaintained.
Modern Base UI has its own Drawer and recent mobile/virtual-keyboard improvements.

## 4.3 MUI — NO as primary design system

MUI is capable, but wrong for this product because:
- too much default visual gravity,
- harder to make Living Evidence Lab truly ownable,
- we already use Tailwind 4,
- Base UI gives primitives without style lock-in.

## 4.4 Random animation libraries — NO

No Magic UI / Aceternity-style decorative layer as product foundation.
No WebGL just to look “premium.”
No particle fields.
No gradient blobs.
No endless cursor tricks.

Motion must explain:
- capture,
- relationship creation,
- context changes,
- provenance,
- hierarchy,
- focus.

## 4.5 Generic dashboard templates — NO as design source

A dashboard starter may solve wiring or table mechanics, but it must not dictate TraceLab's information architecture.

Today is not:
- KPI tiles,
- a donut chart,
- streaks,
- productivity points,
- activity rankings.

---

# 5. “TAKE CODE / TAKE PATTERN / LOOK ONLY” MATRIX

| Resource | Classification | What to use | What not to do |
|---|---|---|---|
| TraceLab current ZIP | Keep product engine | domain/offline/policy/data/routes | preserve old generic presentation |
| shadcn + Base UI | Take code / foundation | primitives + behavior | ship default shadcn look |
| Cal Dev Starter | Take patterns / selective code after license check | Next16/RSC/Tailwind4/component structure | copy scheduling UI |
| ReUI | Selective code | timeline/filter/upload/tree mechanics | import dashboard identity wholesale |
| Kibo UI | Selective code | dropzone/crop/status/tree/meta | install everything |
| data-table-filters | Selective code | faceted filters/nuqs/TanStack mechanics | turn Timeline into a table |
| Emil Skills | Use as agent rules | motion/design judgment | treat as product source code |
| shadcn official skill | Use as agent rules | current CLI/registry/composition | rely on stale shadcn memory |
| Google Stitch skills | Optional tool workflow | design exploration/translation | make Stitch output the source of truth |
| React Flow | Runtime dependency | graph behavior | free-floating physics spaghetti |
| ELK.js | Runtime dependency | layered graph layout | paste its source into app |
| Phosphor | Runtime dependency | icons | rely on icons instead of text for evidence types |
| Storybook | Dev dependency | component state matrix | treat snapshots as complete UX QA |
| Serwist | Optional runtime | service worker/PWA shell | replace working domain outbox blindly |
| Twenty | LOOK ONLY | object-centric UX/inspector ideas | copy source without license diligence |
| Attio | LOOK ONLY | object workflows/search/detail | imitate CRM visual identity |
| Linear | LOOK ONLY | shell/keyboard/progressive disclosure | clone issue tracker UI |
| Teenage Engineering | LOOK ONLY | technical visual character | sacrifice usability for industrial styling |
| Material 3 Expressive | LOOK ONLY / design language | shape/motion/hierarchy/accessibility | use every expressive shape everywhere |
| Granola | LOOK ONLY | calm human-first AI | make AI the homepage |
| Tandem/Rationale/Spectir | LOOK ONLY | traceability relationships | import adult PLM vocabulary |

---

# 6. LICENSE GUARDRAILS

This project should keep a simple provenance ledger for third-party code we directly adapt.

For every copied/adapted component, record:

```text
Source repo:
Source URL:
Commit SHA:
Source path:
License:
What was adapted:
TraceLab destination:
Date:
```

## Safe/low-friction sources identified
At the time of research:
- ReUI — MIT
- Kibo UI — MIT
- OpenStatus data-table-filters — MIT
- Emil Kowalski skills — MIT
- React Flow — MIT
- Phosphor React — MIT
- Serwist — MIT
- shadcn/ui — open-source copy-and-own system; verify snapshot LICENSE as normal

## Study-only unless separately verified
Do not copy code from a repository merely because its UI looks good.
Large apps may be AGPL, open-core, mixed-license, or use directory-specific licensing.

Especially keep the following in **reference-only mode** unless we explicitly review the exact source and license before reuse:
- OpenStatus main application,
- Plane,
- Formbricks,
- Dub,
- FTC TeamForge,
- Twenty,
- any commercial component pack.

---

# 7. TRACE LAB INTERNAL COMPONENT REGISTRY — NEW PLAN

Once the primitives are stable, create our own local shadcn-compatible registry.

Proposed namespace:

```text
@tracelab
```

Possible registry items:

```text
@tracelab/base
@tracelab/evidence-card
@tracelab/source-event-card
@tracelab/test-card
@tracelab/decision-card
@tracelab/rationale-card
@tracelab/missing-context-card
@tracelab/provenance-badge
@tracelab/policy-badge
@tracelab/sync-badge
@tracelab/relationship-chip
@tracelab/evidence-inspector
@tracelab/timeline-event
@tracelab/trace-connector
@tracelab/capture-launcher
@tracelab/rationale-prompt
```

Why this matters:
- AI agents stop inventing slightly different cards,
- every screen consumes the same design semantics,
- tokens/components become portable,
- future competition adapters stay visually coherent,
- component QA happens once,
- later contributors can install the exact TraceLab pattern instead of improvising.

`@tracelab/base` should contain or configure:
- CSS variables / semantic tokens,
- typography,
- radii,
- motion tokens,
- focus ring,
- base Button/Input/Field/Drawer/etc.,
- icon conventions,
- dark theme variables,
- reduced-motion behavior.

---

# 8. EXACT TRACE LAB COMPONENT STACK

## 8.1 Primitive layer

```text
Button
IconButton
Input
Textarea
Field
Select
Combobox
Checkbox
RadioGroup
Switch
Chip
Badge
Tooltip
Popover
DropdownMenu
Dialog
Drawer
Sheet
Tabs
SegmentedControl
Toast
Banner
Skeleton
Separator
Avatar
ScrollArea
Command
```

Base implementation:
**shadcn + Base UI**.

## 8.2 Domain layer

Must remain custom TraceLab code:

```text
EvidenceCard
SourceEventCard
TestCard
DecisionCard
RationaleCard
MissingContextCard
TraceEdge
TraceConnector
TimelineEvent
TimelineGroup
EvidenceNode
EvidenceInspector
ProvenanceBadge
SourceBadge
PolicyBadge
SyncBadge
SeasonBadge
RelationshipChip
EvidenceCitation
SourceHistoryPanel
CaptureLauncher
CapturePhoto
CaptureTest
CaptureDecision
RationalePrompt
VoiceRationaleInput
ExportCheck
ProcessHealthCard
```

Do not implement all of these as `Card` with different props.
Evidence semantics deserve dedicated components and state machines.

---

# 9. COMPONENT SOURCING BY SCREEN

## Today
Use:
- shadcn/Base UI primitives,
- custom `MissingContextCard`,
- custom compact Event rows,
- ReUI only for mechanical subpatterns if useful.

Do not use generic `MetricCard` as the page's first visual.

## Capture
Use mechanics from:
- Base UI Drawer,
- ReUI File Upload,
- Kibo Dropzone/Image Crop,
- native camera/file APIs,
- current TraceLab IndexedDB outbox.

TraceLab-specific layer:
- CaptureLauncher,
- quick source context,
- `Saved on device` / `Waiting to sync` / `Synced` states,
- image privacy/redaction flow.

## 30-second Why
Use:
- Base UI Drawer on mobile,
- Dialog/Inspector or inline focus surface on desktop,
- Motion shared layout if it improves continuity.

Must custom-build:
- immutable Source Context block,
- `Student-authored` provenance treatment,
- rationale input,
- optional evidence-link follow-up.

## Timeline
Possible mechanics from:
- ReUI Timeline,
- nuqs filters,
- TanStack Virtual later if needed.

But signature TraceLab `EngineeringTimeline` is custom.
It must represent causality/iterations, not a generic activity feed.

## Evidence Graph
Runtime:
- React Flow,
- ELK.js.

Custom:
- node shapes,
- TraceEdge semantics,
- focused relation state,
- inspector,
- timeline fallback.

## Evidence Inbox
Useful sources:
- OpenStatus data-table-filters,
- ReUI filters/sortable,
- Base UI Combobox/Command.

Custom:
- evidence grouping,
- unresolved-context state,
- sensitive flag,
- `Start iteration` behavior.

## Memory/Search
Use:
- Base UI Command/Combobox,
- nuqs,
- current server-side deterministic search.

Custom:
- source citation block,
- confidence/coverage state,
- evidence path preview.

## Tests
Use:
- native semantic data UI,
- optional Recharts for simple line/scatter/before-after charts,
- TanStack Table only for repeated trial rows if useful.

## Export
Reference:
- Papermark / document products visually,
- but build policy/provenance selection around TraceLab's own data model.

---

# 10. MATERIAL 3 EXPRESSIVE — WHAT WE ACTUALLY TAKE

Take:
- strong action hierarchy,
- contrasted shapes,
- adaptive layouts,
- accessible touch sizing,
- spring/physics-informed motion,
- expressive container only where importance warrants it,
- state transformation,
- shape morphing sparingly.

Do not take:
- every card with giant radius,
- consumer Android aesthetic everywhere,
- random colored containers,
- mobile-first decorative density on desktop,
- Material icons as mandatory identity.

TraceLab rule:

> Expressive where the human action matters; disciplined where engineering evidence is dense.

Best expressive candidates:
- `Capture`,
- `Add the why`,
- successful evidence linkage,
- onboarding/first activation,
- a focused decision trace.

Everything else should be calmer.

---

# 11. MOTION RESOURCE POLICY

Primary runtime library:
`motion`.

Agent judgment:
Emil Kowalski design-engineering skills.

TraceLab timing budget:

```text
micro feedback         100–160ms
standard transition    180–240ms
panel / inspector      220–300ms
relationship animation 280–420ms
```

Required signature transitions:
1. Capture saved — mechanical snap, subtle.
2. Local → synced — badge state transition, no celebration.
3. Add Why — source card smoothly becomes rationale surface.
4. Evidence link — Trace Line draws between objects.
5. Evidence → Inspector — shared spatial continuity.
6. Graph focus — unrelated evidence dims quickly.
7. Superseded decision — old decision recedes, new becomes primary.

Never:
- confetti,
- bounce every hover,
- 800ms modal entrances,
- fake AI typing theatre,
- scroll-jacking.

---

# 12. STORYBOOK MATRIX TO BUILD BEFORE FULL PAGE WORK

Every domain component should get explicit stories.

Example `EvidenceCard` stories:

```text
Default
Hover
KeyboardFocus
Selected
StudentAuthored
ImportedSource
AIGeneratedExplicit
MissingRationale
Linked
Unlinked
Superseded
OfflineSaved
WaitingForSync
SyncError
RestrictedByPolicy
ReadOnlyCoach
LongTitle
LongMetadata
MobileNarrow
DarkTheme
ReducedMotion
```

Required automated checks:
- axe accessibility,
- keyboard interaction,
- light/dark screenshot,
- 390 px screenshot,
- desktop screenshot,
- reduced motion sanity,
- no color-only state communication.

This is how we stop screen-by-screen visual drift.

---

# 13. DESIGN TOKEN PLAN

Do not scatter raw hexes across components.

Semantic categories:

```text
canvas
surface
surface-subtle
surface-elevated
text-primary
text-secondary
text-tertiary
border-subtle
border-default
border-strong

action-primary
action-primary-hover
action-primary-soft

source
test
decision
verified
failure
pending
policy
sync-local
sync-error

radius-utility
radius-control
radius-evidence
radius-expressive

motion-micro
motion-standard
motion-panel
motion-relationship
```

Core visual constants from DESIGN.md remain:

```text
Lab Paper       #F6F7F2
Surface         #FFFFFF
Carbon          #111315
Trace Blue      #4169FF
Signal Lime     #C8F36D
Test Orange     #F5A63C
Decision Violet #7567F8
Verified Green  #378A62
```

But code should consume semantic variables, not hex names.

---

# 14. WHAT NOT TO SEND ME

Do not waste time downloading:

- Material Web repo,
- MUI repo,
- React Flow entire repo,
- Motion entire repo,
- Storybook entire repo,
- Phosphor entire repo,
- Serwist entire repo,
- TanStack repos,
- random 1000-dashboard template collections,
- Aceternity/MagicUI libraries,
- Three.js demos,
- full Twenty repo unless you specifically want me to audit a local snapshot,
- full Plane/OpenStatus/Formbricks/Dub repos for copying,
- dozens of landing-page templates.

For normal dependencies I can work from package docs/install them directly during development.

---

# 15. OPTIONAL VISUAL REFERENCE PACK

If you want to steer taste even more precisely, send **screenshots**, not whole repos.

Ideal 8–15 screenshots total:

### Linear
- sidebar/nav density,
- issue detail inspector,
- command palette,
- focused list/detail state.

### Material 3 Expressive
- expressive primary actions,
- shape families,
- mobile bottom/nav behavior,
- motion/state examples.

### Teenage Engineering
- technical labeling,
- object photography,
- visual rhythm,
- industrial metadata.

### Attio
- object detail,
- relationship UI,
- search/command interaction.

### Granola
- calm writing/input surface,
- restrained AI presence.

But screenshots are optional because these public products can be researched directly.

---

# 16. FIRST BUILD GATE AFTER YOU SEND THE PACK

Before visual coding:

## Gate A — reproducible baseline
- restore/generate lockfile,
- install dependencies,
- lint,
- typecheck,
- existing tests,
- production build.

If any old test/build fails, record it before refactor.

## Gate B — architecture map
Confirm:
- server/client boundaries,
- existing domain actions,
- offline outbox API,
- graph data structure,
- policy API,
- provenance API.

## Gate C — visual foundation
Build:
- tokens,
- fonts,
- themes,
- icon adapter,
- primitive components,
- focus/accessibility baseline,
- Storybook.

## Gate D — vertical slice
Build in this exact order:

```text
AppShell
→ Today
→ MissingContextCard
→ CaptureLauncher
→ Capture Photo/Test/Decision
→ 30-second Why
→ source/provenance display
→ offline/sync states
→ compact Engineering Timeline
```

Only when that feels excellent:

```text
Full Timeline
→ Inspector
→ Evidence Inbox
→ Evidence Graph
→ Tests
→ Decisions
→ Memory/Search
→ Export
→ Coach/Admin
→ Landing
```

This sequence optimizes for the product's actual magic moment rather than page count.

---

# 17. DEFINITION OF “FRONTEND READY TO BUILD”

We are ready when we have:

- [x] Master Strategy
- [x] PRD / UX
- [x] DESIGN.md
- [x] current app ZIP
- [ ] current repo dependency lockfile restored during build
- [ ] Cal developer starter ZIP (recommended)
- [ ] ReUI ZIP (recommended)
- [ ] Kibo ZIP (recommended)
- [ ] data-table-filters ZIP (recommended)
- [ ] Emil skills ZIP (strongly recommended)
- [ ] official shadcn skill folder (strongly recommended)
- [ ] real engineering sample data/media (highest-value content input)
- [ ] optional Stitch skills if using Stitch

Important: we do **not** need all optional items to start. The true minimum beyond what is already uploaded is:

1. ReUI,
2. Emil Skills,
3. real engineering evidence samples.

Cal starter / Kibo / data-table-filters significantly improve speed and reference coverage.

---

# 18. COPY-PASTE DOWNLOAD CHECKLIST FOR THE USER

Download these ZIPs and attach them in the next message:

```text
1. https://github.com/calcom/developer-starter-kit/archive/refs/heads/main.zip
2. https://github.com/keenthemes/reui/archive/refs/heads/main.zip
3. https://github.com/shadcnblocks/kibo/archive/refs/heads/main.zip
4. https://github.com/openstatusHQ/data-table-filters/archive/refs/heads/main.zip
5. https://github.com/emilkowalski/skills/archive/refs/heads/main.zip
```

Also attach either:

```text
6A. the folder `skills/shadcn/` from https://github.com/shadcn-ui/ui
```

or simply the whole repo only if that is easier.

Optional:

```text
7. https://github.com/google-labs-code/stitch-skills/archive/refs/heads/main.zip
```

And, if available:

```text
8. sample-evidence.zip
   ├── robot / mechanism photos
   ├── commits.json or commits.csv
   ├── tests.json
   ├── decisions.json
   └── rationales.txt/json
```

Once these are supplied, there is no reason to do another broad resource search before starting implementation. New libraries should be introduced only when a concrete TraceLab component exposes a gap.

---

# 19. FINAL RESOURCE PRINCIPLE

The frontend should not be a collage of ReUI + shadcn + Material + Linear.

Those resources solve *mechanics*.

TraceLab's actual identity comes from:

```text
REAL WORK
   ↓
MISSING WHY
   ↓
STUDENT RATIONALE
   ↓
EVIDENCE
   ↓
TEST / RESULT
   ↓
DECISION
   ↓
NEXT ITERATION
```

The Trace Line, evidence semantics, technical metadata, provenance, policy legibility, mobile capture, and real engineering artifacts must make the product recognizable even when the logo is removed.

That—not the component library—is the frontend moat.
