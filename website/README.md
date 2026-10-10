# TraceLab presentation

Product and competition site with the requested Astrax-inspired TraceLab design, ported from the Framer iteration into normal repository source. Marketing pages and the interactive example support Russian, English and Kazakh. The real browser-local workspace remains at `/workspace/`; its existing records, data schema and features are preserved.

## Local preview (Windows, macOS, Linux)

From the repository root run `npm --prefix website run dev`, then open `http://localhost:3000/`. Node 24 is sufficient; no dependency installation, database or Framer account is needed. The server binds only to `127.0.0.1` and serves only `website/dist`, not repository files. Stop with Ctrl+C. After changing source, rebuild with `npm --prefix website run build` and refresh the browser. Set `PORT` to choose another local port.

Run `npm --prefix website test` for the existing workspace data tests plus the new local/GitHub Pages integration checks. The Pages build retains `BASE_PATH=/TraceLab` support.

The new design is implemented in `tracelab/astra-pages.mjs`, `astra.css`, `astra.js` and `astra-copy.js`, without a Framer runtime, external fonts or extra animation packages. Motion respects reduced-motion settings. The home example uses explicitly fictional records and does not read or write real workspace data. Workspace links preserve the currently selected project.

The language switch translates the presentation and its example, not user-authored records or the separate workspace interface. Source documents remain in their original language. The older Next.js server application and any private data are not part of this static preview.

The workspace restores evidence graph connections, timeline/replay, test charts, decisions/search, local record editing and manual links. It saves projects in browser localStorage, exports project JSON and HTML, and imports both its own backups and native TraceLab `team_data`/`personal_contribution` JSON. Native authors, dates, annotation provenance and accepted/suggested/rejected relation status are preserved; missing entities are reported rather than fabricated. Paired research measurements can be entered manually or imported from CSV with headers `participant_code,baseline_seconds,trace_seconds`.

The workbench occupies the full browser viewport. Drag nodes to arrange them, pan the canvas, and connect an output port to another record's input. A directed relation form provides a keyboard alternative. Close or resize the inspector to give the canvas more space. Node coordinates persist in browser storage and project JSON; reset layout leaves evidence intact. Editing synthetic evidence creates an explicitly marked personal copy automatically.

The seeded gripper example is synthetic and read-only. Editable copies retain their educational origin in the interface and backups. No pilot observations are seeded. Browser data is specific to the device/browser/origin: export JSON before clearing storage or moving from localhost to GitHub Pages. Shared database, authentication, roles, attachment uploads and synchronization require the original server application.

Build: `BASE_PATH=/TraceLab OUTPUT_DIR=dist node tracelab/build.mjs` (Node 24; no dependencies). GitHub Actions publishes only the generated static presentation. The main TraceLab application still requires its documented backend and database.

Validate the data layer: `node --test tracelab/workspace-store.test.mjs`.

Assets retain their original provenance in `tracelab/assets/PROVENANCE.json`.
