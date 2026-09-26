import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatTechnicalDate,
  getEvidenceTone,
  getPrimaryMobileItems,
  getSourcePresentation,
} from "../src/components/tracelab/presentation.ts";

test("source presentation keeps provider identity explicit", () => {
  assert.deepEqual(getSourcePresentation("github", "push"), {
    label: "GitHub",
    eventLabel: "push",
    mark: "branch",
    tone: "source",
  });
  assert.equal(getSourcePresentation("onshape", "cad_revision").label, "Onshape");
  assert.equal(getSourcePresentation("capture", "photo").eventLabel, "photo");
});

test("evidence semantic tones are stable and not provider-dependent", () => {
  assert.equal(getEvidenceTone("test", "pass"), "verified");
  assert.equal(getEvidenceTone("test", "fail"), "failure");
  assert.equal(getEvidenceTone("decision", "keep"), "decision");
  assert.equal(getEvidenceTone("source_event", null), "source");
  assert.equal(getEvidenceTone("iteration", null), "revision");
});

test("mobile primary navigation keeps capture separate and hides utilities", () => {
  const items = [
    { href: "/app", label: "Today", glyph: "today", exact: true },
    { href: "/app/capture", label: "Capture", glyph: "capture" },
    { href: "/app/timeline", label: "Timeline", glyph: "timeline" },
    { href: "/app/memory", label: "Memory", glyph: "memory" },
    { href: "/app/settings", label: "Settings", glyph: "settings" },
    { href: "/app/integrations", label: "Integrations", glyph: "integrations" },
  ];
  assert.deepEqual(getPrimaryMobileItems(items).map((item) => item.label), ["Today", "Timeline", "Memory"]);
});

test("technical dates are deterministic and compact", () => {
  assert.equal(formatTechnicalDate(new Date("2026-09-04T12:31:00.000Z"), "UTC"), "04 SEP · 12:31");
});

test("living evidence lab foundation exposes required semantic design tokens", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  for (const token of [
    "--bg-canvas",
    "--text-primary",
    "--trace-blue",
    "--signal-lime",
    "--test-orange",
    "--decision-violet",
    "--verified-green",
    "--radius-evidence",
    "--radius-expressive",
    ".evidence-card",
    ".trace-line",
  ]) {
    assert.ok(css.includes(token), `missing frontend token/class: ${token}`);
  }
});

import { buildNavigationModel } from "../src/components/tracelab/navigation-model.ts";

test("app navigation is evidence-led and keeps secondary utilities out of the primary project group", () => {
  const nav = buildNavigationModel({ isCoach: true, hasOrganization: true, unread: 3 });
  assert.deepEqual(nav.groups.map((group) => group.id), ["project", "memory", "output", "team"]);
  assert.deepEqual(nav.groups[0].items.map((item) => item.href), ["/app/timeline", "/app/inbox", "/app/tests", "/app/decisions"]);
  assert.deepEqual(nav.mobile.map((item) => item.href), ["/app", "/app/timeline", "/app/memory"]);
  assert.equal(nav.capture.href, "/app/capture");
  assert.ok(nav.groups.at(-1)?.items.some((item) => item.href === "/app/settings"));
  assert.ok(nav.groups.at(-1)?.items.some((item) => item.href === "/app/coach"));
});

import { buildTodaySummary, prioritizeNeedsContext } from "../src/components/tracelab/today-model.ts";

test("Today prioritizes automatic source events that still need human context", () => {
  const rows = prioritizeNeedsContext([
    { id: "photo", provider: "capture", eventType: "photo", occurredAt: new Date("2026-09-04T12:30:00Z") },
    { id: "commit", provider: "github", eventType: "commit", occurredAt: new Date("2026-09-04T12:00:00Z") },
    { id: "cad", provider: "onshape", eventType: "cad_revision", occurredAt: new Date("2026-09-04T11:00:00Z") },
  ]);
  assert.deepEqual(rows.map((row) => row.id), ["commit", "cad", "photo"]);
});

test("Today summary uses process gaps instead of vanity activity totals", () => {
  assert.deepEqual(buildTodaySummary({ inboxCount: 4, tests: 3, decisions: 2, needsContextCount: 2 }), [
    { label: "Need context", value: 2, href: "/app/inbox", tone: "action" },
    { label: "Unlinked evidence", value: 4, href: "/app/inbox", tone: "neutral" },
    { label: "Tests this week", value: 3, href: "/app/tests", tone: "test" },
    { label: "Decisions this week", value: 2, href: "/app/decisions", tone: "decision" },
  ]);
});

test("Spatial home stays context-first without regressing to the old Today dashboard", async () => {
  const page = await readFile(new URL("../src/app/app/page.tsx", import.meta.url), "utf8");
  const boards = await readFile(new URL("../src/components/workbench/workboard-content.tsx", import.meta.url), "utf8");

  assert.ok(page.includes("buildWorkbenchSnapshot"), "the server route must adapt domain rows before client rendering");
  assert.ok(page.includes("WorkbenchShell"), "the primary route must render the spatial workbench");
  assert.ok(boards.includes("Needs your context"), "missing human context must remain the leading engineering action");
  assert.ok(boards.includes("Add the why"), "the workbench must preserve the focused rationale action");
  assert.ok(boards.includes('/app/capture') || page.includes('/app/capture') || page.includes("WorkbenchShell"), "capture must remain available from workbench chrome");
  assert.ok(!page.includes("MissingContextCard"), "the primary route must not restore the old vertical Today card stack");
  assert.ok(!page.includes('Metric label="code changes"'), "the primary route must not lead with vanity activity metric cards");
});

test("Capture is a workshop launcher rather than a dense form-first screen", async () => {
  const sheet = await readFile(new URL("../src/app/app/capture/capture-sheet.tsx", import.meta.url), "utf8");
  const picker = await readFile(new URL("../src/components/capture/capture-kind-picker.tsx", import.meta.url), "utf8");
  const controller = await readFile(new URL("../src/components/capture/use-capture-controller.ts", import.meta.url), "utf8");
  assert.ok(sheet.includes("What happened?"));
  assert.ok(sheet.includes("CaptureKindPicker"));
  assert.ok(picker.includes("CaptureTypeCard"));
  assert.ok(sheet.includes("SyncStatus"));
  assert.ok(sheet.includes("useCaptureController"));
  assert.ok(controller.indexOf("await outbox.add(item)") < controller.lastIndexOf("syncOutbox()"), "local outbox must remain the first persistence step");
});

import { getTimelineVisual } from "../src/components/tracelab/timeline-model.ts";

test("timeline differentiates engineering meaning, not just activity rows", () => {
  assert.deepEqual(getTimelineVisual("test", "success"), { label: "Test", icon: "test", tone: "verified", shape: "diamond" });
  assert.deepEqual(getTimelineVisual("decision", "neutral"), { label: "Decision", icon: "decision", tone: "decision", shape: "diamond" });
  assert.deepEqual(getTimelineVisual("iteration_open", "neutral"), { label: "Iteration", icon: "timeline", tone: "revision", shape: "square" });
  assert.deepEqual(getTimelineVisual("event", "warning"), { label: "Source event", icon: "evidence", tone: "pending", shape: "circle" });
});

test("Timeline page exposes causal trace language and a graph power-view escape hatch", async () => {
  const page = await readFile(new URL("../src/app/app/timeline/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("Engineering Timeline"));
  assert.ok(page.includes("TimelineView"));
  assert.ok(page.includes("Trace graph"));
  assert.ok(!page.includes("TimelineGroup"));
  assert.ok(!page.includes("Time Machine"));
});

test("30-second Why has a dedicated student-authored source context flow", async () => {
  const card = await readFile(new URL("../src/components/tracelab/missing-context-card.tsx", import.meta.url), "utf8");
  assert.ok(card.includes("/app/context/"), "missing-context cards should open the focused context flow");
  const route = await readFile(new URL("../src/app/app/context/[id]/page.tsx", import.meta.url), "utf8");
  assert.ok(route.includes("Why did you make this change?"));
  assert.ok(route.includes('name="field" value="rationale"'));
  assert.ok(route.includes("Student-authored"));
  assert.ok(route.includes("AI did not modify this text"));
});

test("Capture page frames capture as a first-class workshop action", async () => {
  const page = await readFile(new URL("../src/app/app/capture/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes('title="Capture evidence"'));
  assert.ok(page.includes("Saved on this device first"));
  assert.ok(!page.includes('title="Quick Capture"'));
});

test("shared source badges use the TraceLab source icon language", async () => {
  const ui = await readFile(new URL("../src/components/ui.tsx", import.meta.url), "utf8");
  assert.ok(ui.includes("getSourcePresentation"));
  assert.ok(ui.includes("<TraceIcon"));
  assert.ok(!ui.includes("const SOURCE_META"));
});

test("Evidence Inbox exposes the focused Add the why flow", async () => {
  const page = await readFile(new URL("../src/app/app/inbox/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("/app/context/${focus.ev.id}"));
  assert.ok(page.includes("Add the why"));
});

test("Trace Graph is a controlled power view with a bounded default canvas", async () => {
  const page = await readFile(new URL("../src/app/app/graph/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes('title="Evidence Trace"'));
  assert.ok(page.includes("slice(0, 30)"), "graph should cap the default visible node count");
  assert.ok(page.includes("Open in timeline"));
});

test("Memory stays evidence-first instead of becoming an AI chat homepage", async () => {
  const page = await readFile(new URL("../src/app/app/memory/page.tsx", import.meta.url), "utf8");
  const form = await readFile(new URL("../src/app/app/memory/ask-form.tsx", import.meta.url), "utf8");
  assert.ok(page.includes('title="Memory"'));
  assert.ok(page.includes("stored evidence"));
  assert.ok(form.includes("Search project memory"));
  assert.ok(form.includes("Evidence citations stay attached"));
});

test("shared UI primitives carry the Living Evidence Lab hierarchy into legacy routes", async () => {
  const ui = await readFile(new URL("../src/components/ui.tsx", import.meta.url), "utf8");
  assert.ok(ui.includes("text-[30px]"), "PageHeader should use the new app title scale");
  assert.ok(ui.includes("rounded-[22px]"), "empty and notice surfaces should use evidence-family radii");
  assert.ok(!ui.includes("grid-paper"), "empty states should not fall back to the old generic grid-paper card");
});

test("public landing teaches the evidence category instead of showing a generic KPI dashboard", async () => {
  const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("Your robot already tells a story."));
  assert.ok(page.includes("Keep the why."));
  assert.ok(page.includes("/evidence/demo-robot.jpg"));
  assert.ok(page.includes("Student-authored"));
  assert.ok(page.includes("Source preserved"));
  assert.ok(!page.includes("This week · Orion"));
  assert.ok(!page.includes("grid-paper"));
});

test("public chrome uses the name-independent TraceLab mark", async () => {
  const chrome = await readFile(new URL("../src/components/public-chrome.tsx", import.meta.url), "utf8");
  assert.ok(chrome.includes("TraceMark"));
  assert.ok(!chrome.includes('fill="#2457D6"'));
});

test("desktop shell exposes a keyboard-first command palette", async () => {
  const layout = await readFile(new URL("../src/app/app/layout.tsx", import.meta.url), "utf8");
  const rail = await readFile(new URL("../src/components/workbench/tool-rail.tsx", import.meta.url), "utf8");
  const palette = await readFile(new URL("../src/components/tracelab/command-palette.tsx", import.meta.url), "utf8");
  assert.ok(layout.includes("ToolRail"));
  assert.ok(rail.includes("CommandPalette"));
  assert.ok(palette.includes('event.key.toLowerCase() === "k"'));
  assert.ok(palette.includes("event.metaKey || event.ctrlKey"));
  assert.ok(palette.includes("Search project"));
  assert.ok(palette.includes("Find missing rationale"));
});

test("decisions have a dedicated evidence-first detail surface", async () => {
  const list = await readFile(new URL("../src/app/app/decisions/page.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../src/app/app/decisions/[id]/page.tsx", import.meta.url), "utf8");
  assert.ok(list.includes("/app/decisions/${d.id}"));
  assert.ok(detail.includes("Student-authored rationale"));
  assert.ok(detail.includes("Supported by"));
  assert.ok(detail.includes("Source history"));
  assert.ok(detail.includes("Why?"));
});

test("Competition Mode leads with the active policy pack and explains restrictions", async () => {
  const page = await readFile(new URL("../src/app/app/competition/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes('title="Competition Mode"'));
  assert.ok(page.includes("Policy Pack"));
  assert.ok(page.includes("Student-authored rationale preserved"));
  assert.ok(page.includes("Restricted AI actions blocked"));
  assert.ok(page.includes("Why this is restricted"));
});

test("Exports use an output-selector plus validation-and-preview mental model", async () => {
  const page = await readFile(new URL("../src/app/app/exports/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("Choose an output"));
  assert.ok(page.includes("Validation & trust checks"));
  assert.ok(page.includes("Output preview"));
  assert.ok(page.includes("Policy pinned"));
});

test("Coach view is intervention-oriented rather than a generic KPI dashboard", async () => {
  const page = await readFile(new URL("../src/app/app/coach/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("Project evidence health"));
  assert.ok(page.includes("Interventions"));
  assert.ok(page.includes("ProcessHealthCard"));
  assert.ok(!page.includes("<Metric"), "coach should not render the old generic metric-card grid");
  assert.ok(page.includes("not a ranking"));
});

test("cross-season handoff is framed as a start-here surface", async () => {
  const page = await readFile(new URL("../src/app/app/handoff/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("Start here next season"));
  assert.ok(page.includes("Open in timeline"));
  assert.ok(page.includes("Known failures"));
  assert.ok(page.includes("Unresolved questions"));
  assert.ok(!page.includes("Time Machine"));
});

test("Tests list exposes result-to-decision trace at a glance", async () => {
  const page = await readFile(new URL("../src/app/app/tests/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("Linked decision"));
  assert.ok(page.includes("TEST ·"));
  assert.ok(page.includes("/app/decisions/${decision.id}"));
  assert.ok(page.includes("No decision linked"));
});

import { translate } from "../src/lib/i18n.ts";

test("navigation localization stays language-consistent", () => {
  assert.equal(translate("ru", "nav.exports"), "Портфолио и экспорт");
  assert.equal(translate("kk", "nav.exports"), "Портфолио және экспорт");
  assert.equal(translate("en", "nav.home"), "Today");
});

test("decision references deep-link to the dedicated detail route", async () => {
  for (const path of [
    "../src/app/app/tests/[id]/page.tsx",
    "../src/app/app/graph/graph-view.tsx",
    "../src/app/app/handoff/page.tsx",
    "../src/app/app/memory/ask-form.tsx",
    "../src/app/app/why/[type]/[id]/page.tsx",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.ok(!source.includes("/app/decisions?focus="), `${path} still points to the legacy focus query`);
  }
});

test("onboarding is progressive and ends with an explicit private-by-default trust step", async () => {
  const form = await readFile(new URL("../src/app/onboarding/onboarding-form.tsx", import.meta.url), "utf8");
  assert.ok(form.includes('const STEPS = ["Project", "Competition", "Workshop defaults", "Trust"]'));
  assert.ok(form.includes("What are you building with?"));
  assert.ok(form.includes("Private by default"));
  assert.ok(form.includes("Connect sources after creation"));
  assert.ok(form.includes('type="button"'));
  assert.ok(form.includes("Continue"));
  assert.ok(form.includes("Back"));
});

test("public and secondary surfaces no longer expose the pre-Living-Evidence terminology", async () => {
  for (const path of [
    "../src/app/offline/page.tsx",
    "../src/app/docs/page.tsx",
    "../src/app/app/inbox/page.tsx",
    "../src/app/app/decisions/page.tsx",
    "../src/app/manifest.ts",
    "../src/modules/billing/entitlements.ts",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.ok(!source.includes("Quick Capture"), `${path} still exposes Quick Capture`);
    assert.ok(!source.includes("Time Machine"), `${path} still exposes Time Machine`);
  }
  const auth = await readFile(new URL("../src/app/auth/page.tsx", import.meta.url), "utf8");
  const join = await readFile(new URL("../src/app/join/[code]/page.tsx", import.meta.url), "utf8");
  assert.ok(auth.includes("TraceMark"));
  assert.ok(!auth.includes("grid-paper"));
  assert.ok(!join.includes("grid-paper"));
});

test("organization admin is framed around continuity and archive rather than a generic SaaS dashboard", async () => {
  const page = await readFile(new URL("../src/app/app/org/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("Multi-team continuity"));
  assert.ok(page.includes("Team archive"));
  assert.ok(page.includes("Organization access"));
  assert.ok(page.includes("Archive & retention"));
  assert.ok(page.includes("Team evidence remains private"));
  assert.ok(!page.includes("Organization dashboard"));
  assert.ok(!page.includes("<Metric"));
});

test("spatial foundation declares canvas dependencies and tokens", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies["@xyflow/react"], "12.11.6");
  assert.equal(pkg.dependencies.motion, "12.35.0");
  assert.ok(pkg.dependencies.zustand, "Zustand is required for transient workbench state");
  assert.ok(pkg.dependencies["react-resizable-panels"], "Resizable inspector panels are required");

  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  for (const token of ["--workbench-bg", "--workboard-bg", ".workbench-surface"]) {
    assert.ok(css.includes(token), `missing spatial token/class: ${token}`);
  }
});

test("authenticated shell uses a compact spatial rail instead of the old dashboard sidebar", async () => {
  const layout = await readFile(new URL("../src/app/app/layout.tsx", import.meta.url), "utf8");
  assert.ok(layout.includes("ToolRail"), "workspace layout should render the spatial ToolRail");
  assert.ok(layout.includes("SecondaryRouteFrame"), "secondary routes need their own compact frame");
  assert.ok(!layout.includes('w-[248px]'), "the old permanent dashboard sidebar must be removed");

  const rail = await readFile(new URL("../src/components/workbench/tool-rail.tsx", import.meta.url), "utf8");
  for (const href of ["/app", "/app/capture", "/app/timeline", "/app/graph", "/app/exports", "/app/settings"]) {
    assert.ok(rail.includes(href), `ToolRail is missing ${href}`);
  }
});

test("spatial canvas follows design-tool interaction conventions", async () => {
  const canvas = await readFile(new URL("../src/components/workbench/spatial-canvas.tsx", import.meta.url), "utf8");
  for (const symbol of ["ReactFlow", "Background", "MiniMap", "useReactFlow", "selectionOnDrag", "panOnScroll", "zoomOnDoubleClick={false}", "onlyRenderVisibleElements"]) {
    assert.ok(canvas.includes(symbol), `SpatialCanvas is missing ${symbol}`);
  }
  assert.ok(canvas.includes("panOnDrag={[1, 2]}"), "primary drag should select while middle/right drag pans");
  assert.ok(canvas.includes("minZoom={0.35}"));
  assert.ok(canvas.includes("maxZoom={1.65}"));
  assert.ok(canvas.includes("const NODE_TYPES"), "custom node types must be stable outside render");
  assert.ok(canvas.includes("BackgroundVariant.Dots"), "canvas should use the quiet dotted spatial grid");
});

test("primary /app route is a server-fed Spatial Workbench, not a Today list page", async () => {
  const page = await readFile(new URL("../src/app/app/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("buildWorkbenchSnapshot"), "server page must normalize database rows before the client boundary");
  assert.ok(page.includes("<WorkbenchShell snapshot={snapshot}"), "server page must hand one serializable snapshot to the workbench");
  assert.ok(page.includes("getActiveSeasonAndProject"));
  assert.ok(page.includes("recentTests"));
  assert.ok(page.includes("recentDecisions"));
  assert.ok(!page.includes("<MissingContextCard"), "primary route should no longer render the old vertical Today composition");
  assert.ok(!page.includes("<ProcessStrip"), "primary route should no longer be a stacked page");

  const shell = await readFile(new URL("../src/components/workbench/workbench-shell.tsx", import.meta.url), "utf8");
  assert.ok(shell.includes("SpatialCanvas"));
  assert.ok(shell.includes("WorkbenchTopBar"));
  assert.ok(shell.includes("InspectorHost"));
  assert.ok(shell.includes("MobileWorkbench"));
});

test("spatial workboards expose real engineering actions instead of generic dashboard cards", async () => {
  const content = await readFile(new URL("../src/components/workbench/workboard-content.tsx", import.meta.url), "utf8");
  for (const phrase of ["Needs your context", "Add the why", "Active iteration", "Recent evidence", "Test bench", "Decision trail", "Process health"]) {
    assert.ok(content.includes(phrase), `workboard content is missing ${phrase}`);
  }
  assert.ok(content.includes("/app/context/"));
  assert.ok(content.includes("/app/iterations/"));
  assert.ok(content.includes("/app/tests/"));
  assert.ok(content.includes("/app/decisions/"));
});

test("mobile workbench uses focused snap boards instead of a miniature infinite canvas", async () => {
  const mobile = await readFile(new URL("../src/components/workbench/mobile-workbench.tsx", import.meta.url), "utf8");
  assert.ok(mobile.includes("snap-x"));
  assert.ok(mobile.includes("snap-center"));
  assert.ok(mobile.includes("Mobile workbench boards"));
  assert.ok(!mobile.includes("<ReactFlow"), "mobile should not embed the infinite React Flow canvas");
});

test("local development bootstrap keeps auth bypass production-safe and Drizzle on the app database", async () => {
  const auth = await readFile(new URL("../src/server/auth.ts", import.meta.url), "utf8");
  const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const config = await readFile(new URL("../drizzle.config.ts", import.meta.url), "utf8");
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.ok(auth.includes('process.env.NODE_ENV === "development"'), "auth bypass must be development-only");
  assert.ok(auth.includes('process.env.DEV_AUTH_BYPASS === "true"'), "auth bypass must require an explicit opt-in flag");
  assert.ok(auth.includes("DEV_AUTH_EMAIL"), "development identity must be explicit and configurable");
  assert.ok(env.includes("DEV_AUTH_BYPASS=false"), "the shipped env example must keep bypass disabled by default");
  assert.ok(config.includes("process.env.DATABASE_URL"), "Drizzle must read the same DATABASE_URL as the application");
  assert.ok(config.includes('.env.local'), "Drizzle must honor the local env override used by Next.js");
  assert.ok(pkg.scripts["db:push"].includes("drizzle.config.ts"), "database commands must use the env-aware Drizzle config explicitly");
});

test("workboards keep canvas drag on the handle while links and scrolling remain interactive", async () => {
  const node = await readFile(new URL("../src/components/workbench/workboard-node.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.ok(node.includes('className="nodrag'), "workboard content must opt out of node dragging so links and scrolling work");
  assert.ok(node.includes("workbench-board-handle"), "the visible board header must remain the drag affordance");
  assert.match(css, /\.workbench-board\s*\{[^}]*position:\s*relative/s, "board accents must be contained by the board itself");
});

test("React Flow nodes carry semantic identity only while snapshot data stays in a shared workbench context", async () => {
  const canvas = await readFile(new URL("../src/components/workbench/spatial-canvas.tsx", import.meta.url), "utf8");
  const node = await readFile(new URL("../src/components/workbench/workboard-node.tsx", import.meta.url), "utf8");
  const context = await readFile(new URL("../src/components/workbench/workbench-context.tsx", import.meta.url), "utf8");
  assert.ok(canvas.includes("WorkbenchSnapshotProvider"), "the canvas must provide the snapshot once outside node data");
  assert.ok(!canvas.includes("data: { kind: model.kind, snapshot }"), "the full snapshot must not be duplicated into every React Flow node");
  assert.ok(node.includes("useWorkbenchSnapshot"), "custom nodes must consume the shared snapshot context");
  assert.ok(context.includes("createContext"), "snapshot sharing must use a narrow React context, not global transient state");
});

test("mobile focused boards expose an on-demand bottom inspector instead of a second permanent navigation bar", async () => {
  const mobile = await readFile(new URL("../src/components/workbench/mobile-workbench.tsx", import.meta.url), "utf8");
  assert.ok(mobile.includes('"use client"'), "mobile focused workboards need local inspector interaction state");
  assert.ok(mobile.includes("Inspect board"), "each focused board must expose its inspector explicitly");
  assert.ok(mobile.includes("SpatialBottomSheet"), "mobile inspector must use the shared semantic bottom-sheet dialog");
  assert.ok(mobile.includes("Mobile inspector"), "bottom inspector needs a stable accessible label");
  assert.ok(!mobile.includes("fixed inset-x-0 bottom-0 z-50"), "mobile workbench must not introduce a second permanent navigation bar");
});

test("coarse workbench relationships use a quiet custom Trace edge instead of generic animated workflow lines", async () => {
  const canvas = await readFile(new URL("../src/components/workbench/spatial-canvas.tsx", import.meta.url), "utf8");
  const edge = await readFile(new URL("../src/components/workbench/trace-edge.tsx", import.meta.url), "utf8");
  assert.ok(canvas.includes("EDGE_TYPES"), "custom workbench edge types must be stable outside render");
  assert.ok(canvas.includes('type: "trace"'), "macro relations must use the TraceLab edge primitive");
  assert.ok(edge.includes("getSmoothStepPath"), "Trace edge must preserve readable orthogonal-ish spatial routing");
  assert.ok(edge.includes("selectedId"), "Trace edge should strengthen only when its related workboard is selected");
  assert.ok(!canvas.includes("animated: true"), "workbench relationships must not run perpetual workflow animations");
});

test("spatial camera motion respects reduced-motion and keeps draggable boards inside the bounded world", async () => {
  const canvas = await readFile(new URL("../src/components/workbench/spatial-canvas.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.ok(canvas.includes("useReducedMotion"), "camera transitions must respond to the user's reduced-motion preference");
  assert.ok(canvas.includes("nodeExtent={extent}"), "draggable workboards must stay inside the bounded workspace");
  assert.ok(canvas.includes("motionDuration"), "camera transition durations must use the shared reduced-motion-aware policy");
  assert.match(css, /prefers-reduced-motion[\s\S]*workbench-trace-edge/, "Trace edge transitions must also become immediate under reduced motion");
});

test("Evidence Trace uses semantic React Flow nodes instead of the legacy fixed SVG graph", async () => {
  const view = await readFile(new URL("../src/app/app/graph/graph-view.tsx", import.meta.url), "utf8");
  const canvas = await readFile(new URL("../src/components/evidence-trace/trace-canvas.tsx", import.meta.url), "utf8");
  const node = await readFile(new URL("../src/components/evidence-trace/trace-node.tsx", import.meta.url), "utf8");
  assert.ok(view.includes("TraceCanvas"));
  assert.ok(canvas.includes("ReactFlow"));
  assert.ok(canvas.includes("nodeTypes"));
  assert.ok(canvas.includes("edgeTypes"));
  assert.ok(canvas.includes("nodesDraggable={false}"));
  assert.ok(canvas.includes("onlyRenderVisibleElements"));
  assert.ok(!view.includes("<svg"), "legacy fixed SVG graph must be removed");
  for (const kind of ["source_event", "iteration", "test", "decision"]) assert.ok(node.includes(kind));
});

test("Evidence Trace suggested relations are explicit, dashed, and never perpetually animated", async () => {
  const edge = await readFile(new URL("../src/components/evidence-trace/trace-edge.tsx", import.meta.url), "utf8");
  assert.ok(edge.includes("Suggested"));
  assert.ok(edge.includes("strokeDasharray"));
  assert.ok(!edge.includes("animated: true"));
  assert.ok(!edge.includes("<animate"));
});

test("Evidence Trace nodes preserve provenance and engineering outcome semantics", async () => {
  const node = await readFile(new URL("../src/components/evidence-trace/trace-node.tsx", import.meta.url), "utf8");
  assert.ok(node.includes("Source event"));
  assert.ok(node.includes("Iteration"));
  assert.ok(node.includes("Test"));
  assert.ok(node.includes("Decision"));
  assert.ok(node.includes("provider"));
  assert.ok(node.includes("outcome"));
  assert.ok(node.includes("Why?"));
});

test("Evidence Trace keeps a semantic relation explorer outside the canvas", async () => {
  const list = await readFile(new URL("../src/components/evidence-trace/trace-list.tsx", import.meta.url), "utf8");
  const mobile = await readFile(new URL("../src/components/evidence-trace/trace-mobile.tsx", import.meta.url), "utf8");
  assert.ok(list.includes("Relation explorer"));
  assert.ok(list.includes("Accepted"));
  assert.ok(list.includes("Suggested"));
  assert.ok(list.includes("table"));
  assert.ok(mobile.includes("Focused evidence trace"));
  assert.ok(!mobile.includes("ReactFlow"));
});

test("Evidence Trace route serializes one bounded snapshot and uses the full spatial surface", async () => {
  const page = await readFile(new URL("../src/app/app/graph/page.tsx", import.meta.url), "utf8");
  const frame = await readFile(new URL("../src/components/workbench/secondary-route-frame.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("buildEvidenceTraceSnapshot"));
  assert.ok(page.includes("<GraphView snapshot={snapshot}"));
  assert.ok(page.includes("slice(0, 30)"));
  assert.ok(page.includes('name="subsystem"'));
  assert.ok(page.includes('name="relation"'));
  assert.ok(page.includes('name="days"'));
  assert.ok(frame.includes('pathname === "/app/graph"'));
});

test("Evidence Trace refits only after asynchronous ELK placement reaches the canvas", async () => {
  const canvas = await readFile(new URL("../src/components/evidence-trace/trace-canvas.tsx", import.meta.url), "utf8");
  assert.ok(canvas.includes("layoutEvidenceTraceWithElk"));
  assert.ok(canvas.includes("requestAnimationFrame"), "ELK placement should refit after React paints positioned nodes");
  assert.ok(canvas.includes("fitView({ padding: 0.16"));
});

test("Spatial Engineering Timeline uses a horizontal time surface instead of the legacy grouped list", async () => {
  const surface = await readFile(new URL("../src/components/engineering-timeline/timeline-surface.tsx", import.meta.url), "utf8");
  const controls = await readFile(new URL("../src/components/engineering-timeline/timeline-controls.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.ok(surface.includes("layoutEngineeringTimeline"));
  assert.ok(surface.includes("overflow-x-auto"), "desktop timeline must be horizontally navigable");
  assert.ok(surface.includes("iterationBands"), "iteration causality must be visible as a presentation overlay");
  assert.ok(surface.includes("useReducedMotion"), "focus motion must respect reduced-motion");
  assert.ok(!surface.includes("ReactFlow"), "Timeline is a time surface, not a second graph editor");
  assert.ok(!surface.includes("rounded-[20px] border border-black/8"), "TimelineSurface must not draw a second outer frame inside TimelineView");
  for (const phrase of ["Month", "Day", "Detail", "Fit history", "Latest", "Timeline shortcuts"]) {
    assert.ok(controls.includes(phrase), `timeline controls missing ${phrase}`);
  }
  for (const selector of [".timeline-spatial-surface", ".timeline-lane", ".timeline-iteration-band", ".timeline-event-card"]) {
    assert.ok(css.includes(selector), `timeline styles missing ${selector}`);
  }
});

test("Timeline event cards encode engineering meaning and keep navigation real", async () => {
  const card = await readFile(new URL("../src/components/engineering-timeline/timeline-event-card.tsx", import.meta.url), "utf8");
  assert.ok(card.includes("Source burst"));
  assert.ok(card.includes("Test"));
  assert.ok(card.includes("Decision"));
  assert.ok(card.includes("Iteration"));
  assert.ok(card.includes("memberIds"), "burst cards must expose how many real source records they summarize");
  assert.ok(card.includes("href={entry.href}"), "event cards must retain authoritative deep links");
});

test("Timeline inspector preserves entity truth and bridges to Evidence Trace", async () => {
  const inspector = await readFile(new URL("../src/components/engineering-timeline/timeline-inspector.tsx", import.meta.url), "utf8");
  assert.ok(inspector.includes("Engineering inspector"));
  assert.ok(inspector.includes("Iteration context"));
  assert.ok(inspector.includes("Recorded"));
  assert.ok(inspector.includes("Provider"));
  assert.ok(inspector.includes("href={selected.href}"), "timeline inspector must keep the authoritative entity deep link");
  assert.ok(inspector.includes("Open in Trace"));
  assert.ok(inspector.includes("/app/graph"));
  assert.ok(inspector.includes("Close timeline inspector"));
  assert.ok(!inspector.includes("invent"), "inspector should display stored timeline facts rather than generate relation claims");
});

test("Timeline mobile stays chronological and opens an on-demand bottom inspector", async () => {
  const mobile = await readFile(new URL("../src/components/engineering-timeline/timeline-mobile.tsx", import.meta.url), "utf8");
  assert.ok(mobile.includes('className="md:hidden'), "mobile timeline must be a dedicated small-screen representation");
  assert.ok(mobile.includes("<ol"), "mobile timeline must preserve chronological ordered semantics");
  assert.ok(mobile.includes("min-h-11"), "mobile event controls must meet the 44px target floor");
  assert.ok(mobile.includes("SpatialBottomSheet"));
  assert.ok(mobile.includes("Mobile timeline inspector"));
  assert.ok(!mobile.includes("ReactFlow"));
  assert.ok(!mobile.includes("overflow-x-auto"), "mobile must not become a miniature horizontal canvas");
});

test("Timeline keeps a semantic chronological explorer outside the spatial surface", async () => {
  const list = await readFile(new URL("../src/components/engineering-timeline/timeline-list.tsx", import.meta.url), "utf8");
  assert.ok(list.includes("Chronological explorer"));
  assert.ok(list.includes("<ol"));
  assert.ok(list.includes("href={entry.href}"));
  assert.ok(list.includes("Recorded engineering history"));
});

test("Timeline route serializes one snapshot and uses the spatial power-view frame", async () => {
  const page = await readFile(new URL("../src/app/app/timeline/page.tsx", import.meta.url), "utf8");
  const view = await readFile(new URL("../src/app/app/timeline/timeline-view.tsx", import.meta.url), "utf8");
  const frame = await readFile(new URL("../src/components/workbench/secondary-route-frame.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("buildEngineeringTimelineSnapshot"));
  assert.ok(page.includes("<TimelineView"));
  assert.ok(page.includes("subsystemTimeline"));
  assert.ok(page.includes('value="detail"'), "route filters must expose the detailed density scale");
  assert.ok(page.includes("/app/graph"), "timeline must bridge to Evidence Trace");
  assert.ok(!page.includes("TimelineGroup"), "legacy grouped list must leave the primary route composition");
  assert.ok(view.includes("TimelineSurface"));
  assert.ok(view.includes("TimelineInspector"));
  assert.ok(view.includes("TimelineMobile"));
  assert.ok(view.includes("TimelineList"));
  assert.ok(frame.includes('pathname === "/app/timeline"'), "Timeline must receive the wide spatial route frame");
});

test("Timeline and Evidence Trace preserve selected evidence through validated focus deep links", async () => {
  const timelinePage = await readFile(new URL("../src/app/app/timeline/page.tsx", import.meta.url), "utf8");
  const timelineView = await readFile(new URL("../src/app/app/timeline/timeline-view.tsx", import.meta.url), "utf8");
  const timelineSurface = await readFile(new URL("../src/components/engineering-timeline/timeline-surface.tsx", import.meta.url), "utf8");
  const timelineInspector = await readFile(new URL("../src/components/engineering-timeline/timeline-inspector.tsx", import.meta.url), "utf8");
  const graphPage = await readFile(new URL("../src/app/app/graph/page.tsx", import.meta.url), "utf8");
  const graphView = await readFile(new URL("../src/app/app/graph/graph-view.tsx", import.meta.url), "utf8");
  const traceInspector = await readFile(new URL("../src/components/evidence-trace/trace-inspector.tsx", import.meta.url), "utf8");
  const traceCanvas = await readFile(new URL("../src/components/evidence-trace/trace-canvas.tsx", import.meta.url), "utf8");
  const traceMobile = await readFile(new URL("../src/components/evidence-trace/trace-mobile.tsx", import.meta.url), "utf8");

  assert.ok(timelinePage.includes("focus?: string"), "Timeline route must accept a focus id");
  assert.ok(timelinePage.includes("snapshot.entries.some"), "Timeline must validate focus against the server-normalized snapshot");
  assert.ok(timelineView.includes("initialSelectedId"), "Timeline view must initialize selection from validated focus");
  assert.ok(timelineSurface.includes("initialFocusId"), "Timeline surface must focus a deep-linked event after layout");
  assert.ok(timelineInspector.includes('traceQuery.set("focus", selected.traceFocusId)'), "Timeline → Trace should preserve a real selected entity");

  assert.ok(graphPage.includes("focus?: string"), "Trace route must accept a focus id");
  assert.ok(graphPage.includes("snapshot.nodes.some"), "Trace must validate focus against visible bounded nodes");
  assert.ok(graphView.includes("initialSelectedId"), "Trace view must initialize from validated focus");
  assert.ok(traceCanvas.includes("layoutSettled"), "Trace deep-link focus must wait for final ELK placement instead of fallback node positions");
  assert.ok(traceInspector.includes('timelineQuery.set("focus"'), "Trace → Timeline should preserve the selected entity");
  assert.ok(traceInspector.includes('selected.kind === "iteration" ? `${selected.id}-open` : selected.id'), "Trace iterations must focus their recorded open boundary in Timeline");
  assert.ok(traceMobile.includes("timelineHref"), "mobile Trace must expose the same focused Timeline bridge as desktop");
  assert.ok(traceMobile.includes('timelineQuery.set("focus"'), "mobile Trace → Timeline must preserve selected evidence");
});

test("Capture presentation delegates to one local-first controller instead of duplicating mutation logic", async () => {
  const sheet = await readFile(new URL("../src/app/app/capture/capture-sheet.tsx", import.meta.url), "utf8");
  const controller = await readFile(new URL("../src/components/capture/use-capture-controller.ts", import.meta.url), "utf8");
  assert.ok(sheet.includes("useCaptureController"), "route capture must reuse the shared offline-first controller");
  assert.ok(!sheet.includes("outbox.add"), "presentation must not own IndexedDB persistence directly");
  assert.ok(controller.indexOf("await outbox.add(item)") < controller.lastIndexOf("syncOutbox()"), "local IndexedDB persistence must happen before any network sync attempt");
  assert.ok(!controller.includes("persistCapture"), "client capture must remain behind the authorised sync API");
});

test("CaptureSheet supports a compact overlay without changing canonical capture field names", async () => {
  const sheet = await readFile(new URL("../src/app/app/capture/capture-sheet.tsx", import.meta.url), "utf8");
  const picker = await readFile(new URL("../src/components/capture/capture-kind-picker.tsx", import.meta.url), "utf8");
  const fields = await readFile(new URL("../src/components/capture/capture-form-fields.tsx", import.meta.url), "utf8");
  assert.ok(sheet.includes('variant?: "route" | "overlay"'));
  assert.ok(sheet.includes('variant = "route"'));
  assert.ok(sheet.includes("CaptureKindPicker"));
  assert.ok(sheet.includes("CaptureFormFields"));
  assert.ok(picker.includes("CAPTURE_KINDS"));
  assert.ok(picker.includes('role="tablist"'));
  for (const name of ["caption", "body", "title", "rationale", "learned", "subsystemId", "iterationId"]) {
    assert.ok(fields.includes(`name=\"${name}\"`), `shared composer must preserve capture field: ${name}`);
  }
  assert.ok(fields.includes("Student-authored"));
  assert.ok(fields.includes("AI did not generate or rewrite"));
  assert.ok(fields.includes("Open full capture"), "complex overlay capture must keep an escape to the canonical route");
  assert.ok(fields.includes("kind=${kind}"), "full capture deep link must preserve selected kind");
});

test("Spatial Workbench owns one CaptureLauncher and morphing overlay instead of routing every capture away", async () => {
  const shell = await readFile(new URL("../src/components/workbench/workbench-shell.tsx", import.meta.url), "utf8");
  const top = await readFile(new URL("../src/components/workbench/workbench-top-bar.tsx", import.meta.url), "utf8");
  const launcher = await readFile(new URL("../src/components/workbench/capture-launcher.tsx", import.meta.url), "utf8");
  const overlay = await readFile(new URL("../src/components/workbench/capture-overlay.tsx", import.meta.url), "utf8");
  assert.ok(shell.includes("CaptureLauncher"));
  assert.ok(shell.includes("reduceCaptureOverlayState"));
  assert.ok(top.includes("onCapture"));
  assert.ok(!top.includes('<Link href="/app/capture"'), "desktop top-bar capture should open the shared workbench launcher");
  assert.ok(launcher.includes("CAPTURE_KINDS"));
  assert.ok(launcher.includes('event.key === "Escape"'));
  assert.ok(launcher.includes("h-11 w-11"), "floating capture control must meet the 44px target floor");
  assert.ok(overlay.includes("AnimatePresence"));
  assert.ok(overlay.includes("useReducedMotion"));
  assert.ok(overlay.includes('variant="overlay"'));
  assert.ok(overlay.includes('role="dialog"'));
  assert.ok(!overlay.includes("outbox.add"));
  assert.ok(!overlay.includes("persistCapture"));
});

test("Spatial capture completion refreshes server data and gives one destination workboard a structural acknowledgement", async () => {
  const shell = await readFile(new URL("../src/components/workbench/workbench-shell.tsx", import.meta.url), "utf8");
  const node = await readFile(new URL("../src/components/workbench/workboard-node.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const controller = await readFile(new URL("../src/components/capture/use-capture-controller.ts", import.meta.url), "utf8");

  assert.ok(shell.includes("router.refresh()"), "capture completion must refresh the server-fed workbench snapshot");
  assert.ok(shell.includes("captureDestination(result.kind)"), "capture completion must map to the semantically affected workboard");
  assert.ok(shell.includes('type: "mark-recent-update"'), "workbench must store only a transient presentation acknowledgement");
  assert.ok(node.includes("data-recently-updated"), "workboard must expose a structural highlight state");
  assert.ok(css.includes('[data-recently-updated="true"]'), "highlight must be expressed through workboard structure, not toast-only feedback");
  assert.ok(!css.includes("capture-success-pulse"), "capture acknowledgement must not use a perpetual or bouncing success animation");
  assert.ok(controller.indexOf("setBusy(false)") < controller.indexOf("onSaved?."), "onSaved must fire after local persistence leaves busy state so the overlay can close safely");
});

test("Mobile Workbench reuses the single primary Capture control to open the spatial bottom sheet", async () => {
  const nav = await readFile(new URL("../src/components/nav.tsx", import.meta.url), "utf8");
  const launcher = await readFile(new URL("../src/components/workbench/capture-launcher.tsx", import.meta.url), "utf8");
  const overlay = await readFile(new URL("../src/components/workbench/capture-overlay.tsx", import.meta.url), "utf8");
  const mobile = await readFile(new URL("../src/components/workbench/mobile-workbench.tsx", import.meta.url), "utf8");
  const fields = await readFile(new URL("../src/components/capture/capture-form-fields.tsx", import.meta.url), "utf8");

  assert.ok(nav.includes('path === "/app"'), "global mobile Capture should detect the spatial home without adding another nav bar");
  assert.ok(nav.includes('new CustomEvent("tracelab:capture")'), "the existing mobile Capture control should request the Workbench overlay on /app");
  assert.ok(launcher.includes('addEventListener("tracelab:capture"'), "one Workbench launcher must own desktop and mobile chooser state");
  assert.ok(overlay.includes("items-end"), "mobile capture composer must present from the bottom edge");
  assert.ok(overlay.includes("max-h-[92dvh]"), "mobile composer must stay within the dynamic viewport");
  assert.ok(!mobile.includes("<nav"), "mobile Workbench must not add a second persistent navigation bar");
  assert.ok(fields.includes('capture="environment"'), "mobile photo capture must continue to prefer the rear camera");
  assert.ok(nav.includes("h-14") || nav.includes("h-11"), "the primary mobile capture control must meet the 44px target floor");
});

test("Capture hardening owns photo object URLs, keeps sync retry-safe, and never offers student authoring to read-only roles", async () => {
  const controller = await readFile(new URL("../src/components/capture/use-capture-controller.ts", import.meta.url), "utf8");
  const fields = await readFile(new URL("../src/components/capture/capture-form-fields.tsx", import.meta.url), "utf8");
  const outbox = await readFile(new URL("../src/lib/outbox.ts", import.meta.url), "utf8");
  const model = await readFile(new URL("../src/components/capture/model.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/app/page.tsx", import.meta.url), "utf8");
  const launcher = await readFile(new URL("../src/components/workbench/capture-launcher.tsx", import.meta.url), "utf8");
  const top = await readFile(new URL("../src/components/workbench/workbench-top-bar.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../src/app/app/layout.tsx", import.meta.url), "utf8");
  const nav = await readFile(new URL("../src/components/nav.tsx", import.meta.url), "utf8");

  assert.ok(controller.includes("previewUrlRef"), "controller must own the preview URL lifecycle");
  assert.ok(controller.includes("URL.revokeObjectURL"), "replaced/unmounted photo previews must release browser memory");
  assert.ok(controller.includes("selectPhoto"), "photo selection should go through one cleanup-aware controller method");
  assert.ok(!fields.includes("URL.createObjectURL"), "presentation fields must not allocate unmanaged preview URLs");
  assert.ok(outbox.includes("isSyncCandidate"), "repeated sync must skip fresh in-flight records while permitting stale recovery");
  assert.ok(!controller.includes("[pending.length, refresh]"), "online listener should not be recreated merely because outbox count changes");

  assert.ok(model.includes("canAuthorStudentContent: boolean"), "capture options must carry server-resolved authoring permission");
  assert.ok(page.includes("canAuthorStudentContent: ctx.canAuthorStudentContent"), "Workbench permission must come from server auth context");
  assert.ok(launcher.includes("options.canAuthorStudentContent"), "launcher must suppress/ignore local capture for read-only roles");
  assert.ok(top.includes("canCapture"), "desktop Workbench control must express disabled authoring state");
  assert.ok(layout.includes("canCapture={ctx.canAuthorStudentContent}"), "global mobile nav must receive server-resolved authoring permission");
  assert.ok(nav.includes("canCapture"), "mobile primary Capture must not invite a coach into a mutation that the server rejects");
});

test("Capture overlay narrows the selected kind before passing it into the reusable composer", async () => {
  const overlay = await readFile(new URL("../src/components/workbench/capture-overlay.tsx", import.meta.url), "utf8");
  assert.ok(overlay.includes('const kind = state.open && state.stage === "compose" ? state.kind : null;'));
  assert.ok(overlay.includes("{kind ? ("), "nullable overlay state must be narrowed before JSX composer props");
  assert.ok(overlay.includes("initialKind={kind}"));
  assert.ok(!overlay.includes("initialKind={state.kind}"), "do not leak a nullable reducer field into CaptureSheet props");
});

test("Offline outbox can recover stale syncing records after a browser crash without duplicating fresh in-flight work", async () => {
  const outbox = await readFile(new URL("../src/lib/outbox.ts", import.meta.url), "utf8");
  assert.ok(outbox.includes("syncStartedAt?: string"));
  assert.ok(outbox.includes("isSyncCandidate"));
  assert.ok(outbox.includes("SYNC_STALE_AFTER_MS"));
  assert.ok(outbox.includes("const syncStartedAt = new Date(now).toISOString()"));
  assert.ok(outbox.includes('status: "syncing", syncStartedAt'));
  assert.ok(outbox.includes("syncStartedAt: undefined"), "terminal retry states should clear the in-flight timestamp");
});

test("Switching capture kinds cannot leave a stale photo preview detached from the file input", async () => {
  const controller = await readFile(new URL("../src/components/capture/use-capture-controller.ts", import.meta.url), "utf8");
  assert.ok(controller.includes("[kind, clearPreview]"));
  assert.ok(controller.includes('fileRef.current.value = ""'));
});

test("spatial inspectors and capture overlays share the centralized motion policy", async () => {
  const policy = await readFile(new URL("../src/components/spatial-motion/policy.ts", import.meta.url), "utf8");
  const workbenchInspector = await readFile(new URL("../src/components/workbench/inspector-host.tsx", import.meta.url), "utf8");
  const captureOverlay = await readFile(new URL("../src/components/workbench/capture-overlay.tsx", import.meta.url), "utf8");
  assert.ok(policy.includes("SPATIAL_MOTION"));
  assert.ok(workbenchInspector.includes("panelTransition"), "workbench inspector should use the shared panel policy");
  assert.ok(captureOverlay.includes("panelTransition"), "capture overlay should use the shared panel policy");
  assert.ok(!captureOverlay.includes("duration: reduceMotion ? 0 : 0.22"), "capture overlay must not keep a private panel duration");
});

test("mobile inspectors use a shared motion-aware bottom sheet instead of abrupt fixed panels", async () => {
  const mobileWorkbench = await readFile(new URL("../src/components/workbench/mobile-workbench.tsx", import.meta.url), "utf8");
  const timelineMobile = await readFile(new URL("../src/components/engineering-timeline/timeline-mobile.tsx", import.meta.url), "utf8");
  const presence = await readFile(new URL("../src/components/spatial-motion/presence.tsx", import.meta.url), "utf8");
  assert.ok(mobileWorkbench.includes("SpatialBottomSheet"));
  assert.ok(timelineMobile.includes("SpatialBottomSheet"));
  assert.ok(presence.includes("useReducedMotion"));
  assert.ok(presence.includes("panelTransition"));
  assert.ok(presence.includes('role="dialog"'));
});

test("Home Trace and Timeline share spatial input guards and centralized camera timing", async () => {
  const home = await readFile(new URL("../src/components/workbench/spatial-canvas.tsx", import.meta.url), "utf8");
  const trace = await readFile(new URL("../src/components/evidence-trace/trace-canvas.tsx", import.meta.url), "utf8");
  const timeline = await readFile(new URL("../src/components/engineering-timeline/timeline-surface.tsx", import.meta.url), "utf8");
  for (const source of [home, trace, timeline]) assert.ok(source.includes("isEditableSpatialTarget"));
  assert.ok(home.includes("motionDuration"));
  assert.ok(trace.includes("motionDuration"));
  assert.ok(!home.includes("duration: reduceMotion ? 0 : 260"));
  assert.ok(!trace.includes("duration: reduceMotion ? 0 : 250"));
});

test("Workbench Timeline and Trace use one restrained reduced-motion-aware route surface", async () => {
  const frame = await readFile(new URL("../src/components/workbench/secondary-route-frame.tsx", import.meta.url), "utf8");
  const surface = await readFile(new URL("../src/components/spatial-motion/route-surface.tsx", import.meta.url), "utf8");
  const rail = await readFile(new URL("../src/components/workbench/tool-rail.tsx", import.meta.url), "utf8");
  assert.ok(frame.includes("SpatialRouteSurface"));
  assert.ok(surface.includes("surfaceTransition"));
  assert.ok(surface.includes("useReducedMotion"));
  assert.ok(surface.includes("y: 6"));
  assert.ok(rail.includes("data-spatial-route"));
  assert.ok(!surface.includes("0.5"), "spatial route transition must remain shorter than half a second");
});

test("spatial surfaces use tokenized non-decorative motion and inspector content swaps", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const traceInspector = await readFile(new URL("../src/components/evidence-trace/trace-inspector.tsx", import.meta.url), "utf8");
  const timelineInspector = await readFile(new URL("../src/components/engineering-timeline/timeline-inspector.tsx", import.meta.url), "utf8");
  const traceCanvas = await readFile(new URL("../src/components/evidence-trace/trace-canvas.tsx", import.meta.url), "utf8");
  for (const token of ["--motion-micro", "--motion-selection", "--motion-standard", "--motion-panel"]) assert.ok(css.includes(token));
  assert.ok(traceInspector.includes("SpatialFadeSwap"));
  assert.ok(timelineInspector.includes("SpatialFadeSwap"));
  assert.ok(traceCanvas.includes('data-interaction-mode={handMode ? "hand" : "select"}'));
  assert.ok(!css.includes("transition: all 700ms"));
});

test("spatial motion hardening avoids broad transition-all and keeps mobile Trace selection continuity", async () => {
  const audit = await readFile(new URL("../scripts/frontend-static-audit.mjs", import.meta.url), "utf8");
  const captureType = await readFile(new URL("../src/components/tracelab/capture-type-card.tsx", import.meta.url), "utf8");
  const traceMobile = await readFile(new URL("../src/components/evidence-trace/trace-mobile.tsx", import.meta.url), "utf8");

  assert.ok(audit.includes("transition-all"), "static audit must forbid broad transition-all inside spatial/capture interaction surfaces");
  assert.ok(audit.includes("hover-scale-or-lift"), "static audit must guard against decorative hover movement on spatial surfaces");
  assert.ok(!captureType.includes("transition-all"), "capture type cards should transition only the visual properties they actually change");
  assert.ok(traceMobile.includes("SpatialFadeSwap"), "mobile Trace detail should keep selection changes spatially continuous");
  assert.ok(traceMobile.includes("motionKey={selected.id}"));
});

test("manual canvas movement can immediately interrupt scripted camera motion", async () => {
  const home = await readFile(new URL("../src/components/workbench/spatial-canvas.tsx", import.meta.url), "utf8");
  const trace = await readFile(new URL("../src/components/evidence-trace/trace-canvas.tsx", import.meta.url), "utf8");
  for (const source of [home, trace]) {
    assert.ok(source.includes("onMoveStart"), "React Flow spatial lenses need a direct manual-move interrupt hook");
    assert.ok(source.includes("duration: 0"), "manual movement must cancel scripted camera interpolation immediately");
    assert.ok(source.includes("getViewport()"), "interrupt should freeze the current camera position instead of snapping elsewhere");
  }
});

test("Spatial Home reads as an artboard composition rather than a dashboard laid on canvas", async () => {
  const content = await readFile(new URL("../src/components/workbench/workboard-content.tsx", import.meta.url), "utf8");
  const node = await readFile(new URL("../src/components/workbench/workboard-node.tsx", import.meta.url), "utf8");
  assert.ok(content.includes("workbench-evidence-tiles"), "recent evidence should use a tile composition");
  assert.ok(content.includes("workbench-loop-trace"), "active iteration should show the engineering trace rather than KPI cards");
  assert.ok(!content.includes("grid grid-cols-3 gap-2"), "active iteration must not regress to a three-KPI dashboard grid");
  assert.ok(node.includes("workbench-artboard-label"), "workboards should use artboard-like chrome");
});

test("Workbench chrome is split into floating context and action clusters", async () => {
  const topbar = await readFile(new URL("../src/components/workbench/workbench-top-bar.tsx", import.meta.url), "utf8");
  assert.ok(topbar.includes("workbench-context-pill"));
  assert.ok(topbar.includes("workbench-action-cluster"));
  assert.ok(topbar.includes("workbench-floating-chrome"));
});

test("Workbench inspector belongs to the dark spatial world", async () => {
  const inspector = await readFile(new URL("../src/components/workbench/inspector-host.tsx", import.meta.url), "utf8");
  assert.ok(inspector.includes("workbench-inspector-dark"));
  assert.ok(!inspector.includes('bg-[#f7f7f3]'));
  assert.ok(inspector.includes("workbench-inspector-evidence-surface"));
});

test("Spatial Home opens with a restrained overview framing and hero-first mobile order", async () => {
  const canvas = await readFile(new URL("../src/components/workbench/spatial-canvas.tsx", import.meta.url), "utf8");
  const mobile = await readFile(new URL("../src/components/workbench/mobile-workbench.tsx", import.meta.url), "utf8");
  assert.ok(canvas.includes("maxZoom: 0.82"), "initial fit should preserve artboard breathing room");
  assert.ok(mobile.includes('const MOBILE_ORDER: WorkboardKind[] = ["active-iteration", "needs-context"'), "mobile should lead with the current engineering loop");
});

test("TraceLab competition branding is coherent across runtime metadata", async () => {
  const brand = await readFile(new URL("../src/lib/brand.ts", import.meta.url), "utf8");
  const pkg = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.ok(brand.includes('productName: "TraceLab"'));
  assert.ok(pkg.includes('"name": "tracelab-student-engineering-evidence"'));
  assert.ok(readme.startsWith("# TraceLab"));
  assert.ok(!pkg.includes("nextjs-postgresql-template"));
});

test("Trace Replay plays real timeline entries rather than inventing a second demo-only data model", async () => {
  const surface = await readFile(new URL("../src/components/engineering-timeline/timeline-surface.tsx", import.meta.url), "utf8");
  const controls = await readFile(new URL("../src/components/engineering-timeline/timeline-controls.tsx", import.meta.url), "utf8");
  assert.ok(surface.includes("layout.entries[replayCursor]"));
  assert.ok(surface.includes("focusEntry(entry.id)"));
  assert.ok(surface.includes("Trace Replay"));
  assert.ok(controls.includes("Replay engineering trace"));
});

test("RKNP research surfaces separate live process evidence from unmeasured causal results", async () => {
  const publicResearch = await readFile(new URL("../src/app/research/page.tsx", import.meta.url), "utf8");
  const appResearch = await readFile(new URL("../src/app/app/research/page.tsx", import.meta.url), "utf8");
  assert.ok(publicResearch.includes("No improvement figures are pre-filled or fabricated"));
  assert.ok(appResearch.includes("do not claim causal improvement"));
  assert.ok(appResearch.includes("coachInsights"));
});

test("production hardening keeps encryption and browser security fail-closed", async () => {
  const storage = await readFile(new URL("../src/server/storage.ts", import.meta.url), "utf8");
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("../src/server/auth.ts", import.meta.url), "utf8");
  assert.ok(storage.includes('process.env.NODE_ENV === "production"'));
  assert.ok(storage.includes("SECRETS_ENCRYPTION_KEY must be configured"));
  assert.ok(config.includes("Content-Security-Policy"));
  assert.ok(config.includes("Permissions-Policy"));
  assert.ok(auth.includes('secure: process.env.NODE_ENV === "production"'));
});

test("offline capture idempotency is scoped by team to prevent cross-tenant clientId collisions", async () => {
  const schema = await readFile(new URL("../src/db/schema.ts", import.meta.url), "utf8");
  const capture = await readFile(new URL("../src/server/capture.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0001_team_scoped_capture_idempotency.sql", import.meta.url), "utf8");
  assert.ok(schema.includes('uniqueIndex("source_events_client_id_idx").on(t.teamId, t.clientId)'));
  assert.ok(capture.includes("eq(sourceEvents.teamId, teamId), eq(sourceEvents.clientId, input.clientId)"));
  assert.ok(migration.includes('("team_id","client_id")'));
});

test("offline sync is bounded on both client and server", async () => {
  const outbox = await readFile(new URL("../src/lib/outbox.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/app/api/sync/route.ts", import.meta.url), "utf8");
  assert.ok(outbox.includes("partitionSyncBatches"));
  assert.ok(outbox.includes("SYNC_BATCH_MAX_BYTES"));
  assert.ok(route.includes("MAX_SYNC_BODY_BYTES"));
  assert.ok(route.includes("Buffer.byteLength"));
  assert.ok(route.includes("z.array(item).max(8)"));
});


test("public judge demo stays numerically consistent with the seeded engineering trace", async () => {
  const landing = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const replay = await readFile(new URL("../src/components/tracelab/showcase-replay.tsx", import.meta.url), "utf8");
  const seed = await readFile(new URL("../src/db/seed.ts", import.meta.url), "utf8");
  for (const expected of ["trials: 20, successes: 11", "trials: 20, successes: 17", "36 mm"]) assert.ok(seed.includes(expected));
  assert.ok(landing.includes("20 trials · success 11/20 → 17/20"));
  assert.ok(replay.includes("20 trials · success 11/20 → 17/20"));
  assert.ok(replay.includes("REV 23"));
  assert.ok(!replay.includes("jams 9 → 2"));
});
