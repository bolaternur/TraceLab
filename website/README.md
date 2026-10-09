# TraceLab presentation

Russian product and competition site adapted from the selected Powder Framer template, with a working local workspace at `/workspace/`.

The workspace restores evidence graph connections, timeline/replay, test charts, decisions/search, local record editing and manual links. It saves projects in browser localStorage, exports project JSON and HTML, and imports both its own backups and native TraceLab `team_data`/`personal_contribution` JSON. Native authors, dates, annotation provenance and accepted/suggested/rejected relation status are preserved; missing entities are reported rather than fabricated. Paired research measurements can be entered manually or imported from CSV with headers `participant_code,baseline_seconds,trace_seconds`.

The workbench occupies the full browser viewport. Drag nodes to arrange them, pan the canvas, and connect an output port to another record's input. A directed relation form provides a keyboard alternative. Close or resize the inspector to give the canvas more space. Node coordinates persist in browser storage and project JSON; reset layout leaves evidence intact. Editing synthetic evidence creates an explicitly marked personal copy automatically.

The seeded gripper example is synthetic and read-only. Editable copies retain their educational origin in the interface and backups. No pilot observations are seeded. Browser data is specific to the device/browser/origin: export JSON before clearing storage or moving from localhost to GitHub Pages. Shared database, authentication, roles, attachment uploads and synchronization require the original server application.

Build: `BASE_PATH=/TraceLab OUTPUT_DIR=dist node tracelab/build.mjs` (Node 24; no dependencies). GitHub Actions publishes only the generated static presentation. The main TraceLab application still requires its documented backend and database.

Validate the data layer: `node --test tracelab/workspace-store.test.mjs`.

Assets retain their original provenance in `tracelab/assets/PROVENANCE.json`.
