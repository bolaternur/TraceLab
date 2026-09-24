# TraceLab Spatial Capture — Phase E Handoff

**Checkpoint:** Spatial Workbench A+B+C+D+E  
**Date:** 2026-09-04  
**Phase goal:** Move capture from a separate form-first route into the Spatial Workbench while preserving TraceLab's existing offline-first, server-authoritative evidence pipeline.

## What Phase E changes

Phase E adds one reusable capture system shared by the canonical `/app/capture` route and the Spatial Workbench.

On desktop `/app`:

```text
Workbench
  → Capture button / floating Capture control
  → compact kind chooser
  → Photo | Problem | Test | Decision | Reflection
  → morphing capture composer
  → IndexedDB durable write
  → best-effort `/api/sync`
  → router.refresh()
  → semantic workboard acknowledgement
```

On mobile `/app`, the existing primary Capture control opens the same chooser/composer as a bottom-edge sheet. No second mobile navigation bar and no React Flow canvas is mounted merely to capture evidence.

The full `/app/capture?kind=&iteration=&subsystem=` route remains canonical and remains the escape hatch for expanded Test/Decision details.

## What was intentionally preserved

The following authoritative behavior was not duplicated or bypassed:

- `persistCapture()` server authorization and validation
- student/coach authoring rules
- stable `clientId` idempotency
- team/project/season ownership checks
- source-event provenance
- Test and Decision entity creation
- relation creation
- `/api/sync` as the client sync boundary
- client-side image re-encode/orientation handling
- server-side JPEG metadata / EXIF stripping
- existing PostgreSQL schema and evidence records

Phase E is primarily a presentation and client-resilience refactor.

## Capture architecture

### Pure model

`src/components/capture/model.ts`

Owns:

- the five existing capture kinds
- prompts and descriptions
- minimal client validation
- semantic destination mapping after save
- exact `clientId` sync-state resolution
- server-resolved `canAuthorStudentContent` workspace capability

### Overlay state

`src/components/capture/state.ts`

Keeps chooser/composer/saving state explicit. A close request is ignored while the durable local write is in progress.

### Shared local-first controller

`src/components/capture/use-capture-controller.ts`

The controller is the only client owner of:

- network state
- IndexedDB outbox state
- retry/sync requests
- submit busy state
- capture toast state
- photo preview object URL lifecycle
- photo input ref

The durable ordering is:

```text
prepare image when present
→ create stable clientId
→ outbox.add(item)
→ local capture now survives network loss
→ attempt sync only after local persistence
```

`CaptureSheet`, Workbench overlay, and presentation components do not call `persistCapture()` directly.

## Exact local/synced semantics

Phase E does not infer the just-saved capture state from aggregate sync counts.

After a sync attempt it checks whether that exact `clientId` still exists in IndexedDB:

```text
clientId absent from outbox → synced
clientId still in outbox    → local
```

This matters when several captures are being retried and only some of them fail.

`onSaved` receives:

```ts
{
  clientId: string;
  kind: CaptureKind;
  syncState: "synced" | "local";
}
```

A network failure after the IndexedDB write therefore still produces a successful local save result instead of pretending the evidence was lost.

## Crash-safe sync recovery

The outbox now records optional `syncStartedAt` metadata.

Fresh `syncing` records are not resent by repeated sync calls. A record left in `syncing` because a browser/tab crashed becomes eligible for retry after `SYNC_STALE_AFTER_MS` (60 seconds).

This avoids both failure modes:

- duplicate rapid resend of genuine in-flight work
- a capture remaining permanently stuck in `syncing` after a browser crash

The field is optional and the IndexedDB object-store shape is unchanged, so no IndexedDB migration is required.

## Photo preview lifecycle

Object URLs are now owned by the controller rather than presentation fields.

The previous preview URL is revoked when:

- a new photo replaces it
- the capture is successfully persisted/reset
- the user switches away from the Photo kind
- the capture component unmounts

The file input is also cleared after persistence so a stale preview cannot become detached from stale file state.

## Workbench integration

New components:

- `src/components/workbench/capture-launcher.tsx`
- `src/components/workbench/capture-overlay.tsx`
- `src/components/capture/capture-kind-picker.tsx`
- `src/components/capture/capture-form-fields.tsx`
- `src/components/capture/use-capture-controller.ts`
- `src/components/capture/model.ts`
- `src/components/capture/state.ts`

Updated workbench integration:

- `src/components/workbench/workbench-shell.tsx`
- `src/components/workbench/workbench-top-bar.tsx`
- `src/components/workbench/workboard-node.tsx`
- `src/components/workbench/state.ts`
- `src/components/nav.tsx`
- `src/app/app/page.tsx`
- `src/app/app/layout.tsx`

## Post-save visual behavior

Capture kinds map to semantic workboards:

```text
Photo      → Recent evidence
Problem    → Recent evidence
Reflection → Recent evidence
Test       → Test bench
Decision   → Decision trail
```

After a local save completes:

1. overlay leaves its busy state
2. overlay closes
3. `router.refresh()` requests a fresh server-normalized Workbench snapshot
4. exactly one related workboard gets a short structural border/accent acknowledgement
5. acknowledgement clears after 1.2 seconds

There is no success bounce, perpetual pulse, shimmer, or animated background.

## Authoring permissions

Workbench capture availability comes from `requireTeam()`:

```ts
ctx.canAuthorStudentContent
```

The server-resolved value is carried into `CaptureWorkspaceOptions`.

For read-only/coach roles:

- desktop Workbench Capture is disabled
- floating Workbench launcher is not mounted
- mobile primary Capture is disabled instead of inviting a mutation that the server will reject
- canonical `/app/capture` continues to display its existing read-only warning

Server authorization remains the final enforcement layer.

## Mobile behavior

Mobile deliberately does not use a miniature infinite canvas for capture.

The existing bottom primary navigation owns one 56px Capture target. On `/app` it opens the shared Workbench capture flow; on other routes it links to canonical `/app/capture`.

The composer:

- presents from the bottom edge
- is constrained to `92dvh`
- keeps 44px+ primary controls
- preserves `capture="environment"` for photo input
- uses the same IndexedDB/controller path as desktop

## Verification on the final Phase E source tree

The latest dependency-free verification completed with:

```text
Frontend contract tests: 67 / 67 PASS
Pure model tests:         28 / 28 PASS
Static a11y/motion audit: 141 source files PASS
TS/TSX syntax pass:       150 files, 0 syntax errors
```

The test suite now includes specific regression coverage for:

- local-first capture ownership
- route/overlay field compatibility
- mobile single-Capture architecture
- authoring permissions
- exact per-client sync state
- photo object URL cleanup
- stale `syncing` recovery after browser crash
- capture-kind switching clearing stale photo state

## Full framework/build verification limitation

A fresh npm registry probe on this environment failed with:

```text
EAI_AGAIN registry.npmjs.org
```

Therefore this handoff does **not** claim that the following commands were executed successfully in this container:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Run those commands on the development machine with working npm access before treating the branch as production-build verified.

## Upgrade from Phase D without losing local data

PostgreSQL and IndexedDB data are external to the ZIP. Do not delete the PostgreSQL container/volume and do not clear browser site data.

Recommended upgrade:

```bash
cd ~/Documents
cp tracelab_frontend_build/.env /tmp/tracelab.env
cp tracelab_frontend_build/.env.local /tmp/tracelab.env.local
mv tracelab_frontend_build tracelab_frontend_build_phase_d
unzip TraceLab_Spatial_Workbench_Phase_E_Spatial_Capture_2026-09-04.zip
cp /tmp/tracelab.env tracelab_frontend_build/.env
cp /tmp/tracelab.env.local tracelab_frontend_build/.env.local
cd tracelab_frontend_build
npm install
npm run frontend:verify
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

No new Phase E runtime package was added; `package.json` changed only to include the spatial capture model test in `frontend:model`.

## Pages to browser-QA locally

After the framework gate is green, inspect at minimum:

```text
/app
/app/capture
/app/capture?kind=photo
/app/capture?kind=test
/app/capture?kind=decision
```

Test desktop and phone-width behavior for:

- chooser → composer transitions
- Escape while idle vs saving
- offline save
- reconnect retry
- photo replace
- Photo → Test kind switch
- read-only coach role
- post-save workboard refresh/highlight

## Third-party source status

Phase E did not adapt additional third-party source files. It uses Motion and the existing TraceLab stack already recorded in the repository provenance ledger, so `docs/frontend/THIRD_PARTY_SOURCE_LEDGER.md` did not require a new source-code entry for this phase.

## Phase boundary

Phase E stops at capture creation and workbench acknowledgement. It does not add relation editing, timeline editing, or AI-generated rationale.

A natural next subsystem is **Phase F: Spatial Evidence Inbox / Relationship Triage**, where newly captured and imported evidence can be linked, contextualized, and resolved without returning to list-first UI.

## Packaging hygiene

The handoff archive is intentionally created without local runtime state or build/cache artifacts. Before packaging, the tree was checked to exclude:

- `.env`
- `.env.local`
- `node_modules/`
- `.next/`
- `coverage/`
- `*.log`
- `*.tsbuildinfo`
- private key material (`*.pem`, `*.key`)

`*.tsbuildinfo` is now ignored by `.gitignore` so local typecheck/build runs do not pollute future handoffs.
