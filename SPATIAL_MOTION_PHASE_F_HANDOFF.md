# TraceLab Spatial Workbench — Phase F Motion & Interaction Polish Handoff

Date: 2026-09-04

## Scope

Phase F does not add new product capabilities or alter backend/domain semantics. It makes the existing Spatial Home, Evidence Trace, Engineering Timeline, and Spatial Capture behave as one restrained spatial system.

## What changed

### Shared motion policy

A single typed policy now defines TraceLab motion timing and easing:

- micro: 130 ms
- selection: 140 ms
- standard: 200 ms
- panel: 220 ms
- camera: 270 ms
- route surface: 160 ms
- relationship: 300 ms
- easing: `[0.2, 0, 0, 1]`

`prefers-reduced-motion` collapses spatial durations to zero where motion is not required for understanding.

Primary files:

- `src/components/spatial-motion/policy.ts`
- `src/components/spatial-motion/presence.tsx`
- `src/components/spatial-motion/input.ts`
- `src/components/spatial-motion/route-surface.tsx`

### Inspector and bottom-sheet continuity

- Workbench, Trace, and Timeline inspector content changes use a restrained shared fade/4 px spatial swap instead of flashing abruptly.
- Workbench and Timeline mobile inspectors use the same bottom-sheet primitive.
- Capture overlay shares the same panel timing/easing.
- Mobile Trace keeps its focused-card model but now animates selected relation detail through the same shared content-swap primitive.

### Camera continuity and user interruption

Home and Trace now share camera timing for fit/focus/restore. Manual canvas movement immediately interrupts scripted interpolation by freezing the current viewport with zero-duration movement before the user's gesture continues.

Keyboard/input behavior is normalized:

- Space: hand/pan mode
- F / 0: fit surface
- 1: 100% zoom
- Enter: focus selected object where applicable
- Esc: restore previous spatial layer / clear focus
- editable inputs are ignored by global canvas shortcuts

Timeline intentionally preserves native scrolling rather than pretending to be React Flow.

### Route continuity

Only the three spatial lenses receive the small route transition:

- `/app`
- `/app/timeline`
- `/app/graph`

The transition is limited to opacity + 6 px and at most 160 ms. Settings, exports, inbox, organization, etc. remain ordinary pages and are not given cinematic page motion.

### CSS / high-frequency interaction hardening

- shared CSS motion variables added
- spatial `transition-all` is forbidden by the static audit
- decorative hover lift/scale/translate is forbidden on high-frequency spatial surfaces
- capture type cards transition only the properties they actually change
- no perpetual edge animation, shimmer, bounce, or glass blur was introduced
- reduced-motion CSS variables resolve to 0 ms

## Product invariants preserved

Phase F does not change:

- PostgreSQL / Drizzle data model
- authentication or team authorization
- evidence provenance
- competition policy
- source-event relations
- test / decision semantics
- IndexedDB outbox ordering
- EXIF stripping
- capture server mutations
- export behavior

## Fresh verification on the final source tree

`npm run frontend:verify`:

- frontend contracts: **74 / 74 PASS**
- pure model tests: **31 / 31 PASS**
- static accessibility/motion audit: **145 source files PASS**
- TypeScript/TSX syntax-transpile: **155 files, 0 syntax errors**

The npm registry probe still fails in this environment with:

```text
EAI_AGAIN registry.npmjs.org
```

Therefore this environment cannot honestly verify dependency installation or the framework-level gates below:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Run those on a machine with npm registry access before deployment.

## Handoff hygiene

The packaged project must not contain:

- `.env`
- `.env.local`
- `node_modules`
- `.next`
- `coverage`
- `*.log`
- `*.tsbuildinfo`
- private key files

`.env.example` intentionally contains only the local example PostgreSQL URL.

## Local upgrade from Phase E

Preserve your working environment first:

```bash
cp ~/Documents/tracelab_frontend_build/.env /tmp/tracelab.env
cp ~/Documents/tracelab_frontend_build/.env.local /tmp/tracelab.env.local
```

Keep your PostgreSQL container/database. Do not recreate or delete it.

After unpacking Phase F, restore the environment files:

```bash
cp /tmp/tracelab.env ~/Documents/tracelab_frontend_build/.env
cp /tmp/tracelab.env.local ~/Documents/tracelab_frontend_build/.env.local
```

Then run:

```bash
cd ~/Documents/tracelab_frontend_build
npm install
npm run frontend:verify
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

Check the three spatial lenses first:

```text
/app
/app/timeline
/app/graph
```

Then check Capture from `/app` on both desktop and mobile width.

## Manual browser QA checklist

At minimum test:

- 1366×768
- 1440×900
- 1920×1080
- tablet portrait/landscape
- phone portrait

For Home and Trace:

1. pan with wheel/trackpad
2. Space + drag
3. focus a node/workboard
4. start a focus transition and immediately drag the canvas; manual control must win
5. Esc back to previous viewport
6. use F/0 and 1
7. open/close inspector repeatedly
8. enable reduced motion at OS/browser level and repeat

For Timeline:

1. switch Month / Day / Detail
2. focus evidence through a deep link
3. move Timeline → Trace → Timeline while preserving evidence focus
4. verify mobile chronological mode rather than a miniature desktop canvas

For Capture:

1. open chooser from Workbench
2. change kinds repeatedly
3. select/replace photo and verify preview cleanup
4. test offline save and later sync
5. confirm the destination board gives only the short structural acknowledgement

## Next recommended phase

The next phase should be visual/browser QA and runtime hardening on a machine where full npm/Next.js gates can execute. Do not add another large subsystem until the real browser and type/build gates are green.
