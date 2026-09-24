import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const srcRoot = join(root, "src");
const failures = [];
const warnings = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (/\.(tsx|ts|css)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const files = await walk(srcRoot);
const texts = new Map();
for (const file of files) texts.set(file, await readFile(file, "utf8"));

for (const [file, text] of texts) {
  const rel = relative(root, file);
  if (file.endsWith(".tsx")) {
    for (const match of text.matchAll(/<img\b([^>]*)>/g)) {
      if (!/\balt\s*=/.test(match[1])) failures.push(`${rel}: img is missing alt text`);
    }

    for (const match of text.matchAll(/<a\b([^>]*)target=["']_blank["']([^>]*)>/g)) {
      const attrs = `${match[1]} ${match[2]}`;
      if (!/rel=["'][^"']*noopener/.test(attrs) || !/rel=["'][^"']*noreferrer/.test(attrs)) failures.push(`${rel}: target=_blank link must include rel="noreferrer noopener"`);
    }

    for (const match of text.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const attrs = match[1];
      const body = match[2];
      const iconOnly = /<TraceIcon\b/.test(body) && !/>\s*[A-Za-z0-9][^<{]*</.test(body) && !/\{[^}]*["'][A-Za-z]/.test(body);
      if (iconOnly && !/aria-label=|title=/.test(attrs)) failures.push(`${rel}: icon-only button needs aria-label or title`);
    }

    for (const line of text.split("\n")) {
      if (line.includes("outline-none") && !line.includes("focus-visible:ring") && !line.includes("className=\"input")) failures.push(`${rel}: outline-none used without a visible focus replacement`);
    }
  }
}

const css = texts.get(join(srcRoot, "app/globals.css")) ?? "";
for (const requirement of ["@media (prefers-reduced-motion: reduce)", ".skip-link", "*:focus-visible", "min-height: 2.75rem"]) {
  if (!css.includes(requirement)) failures.push(`src/app/globals.css: missing accessibility foundation ${requirement}`);
}

const rootLayout = texts.get(join(srcRoot, "app/layout.tsx")) ?? "";
if (!rootLayout.includes('href="#main"') || !rootLayout.includes("skip-link")) failures.push("src/app/layout.tsx: skip link is missing");

const appLayout = texts.get(join(srcRoot, "app/app/layout.tsx")) ?? "";
const secondaryRouteFrame = texts.get(join(srcRoot, "components/workbench/secondary-route-frame.tsx")) ?? "";
if (!appLayout.includes('id="main"') && !secondaryRouteFrame.includes('id="main"')) failures.push("workspace shell: main landmark is missing");


const commandPalette = texts.get(join(srcRoot, "components/tracelab/command-palette.tsx")) ?? "";
if (commandPalette.includes('className="fade-in')) failures.push("src/components/tracelab/command-palette.tsx: keyboard-triggered command palette must not use entrance motion");

const motionHighFrequencyBans = [
  ["components/tracelab/capture-type-card.tsx", "hover:-translate-y-px"],
  ["components/ui.tsx", "hover:-translate-y-px"],
  ["app/app/layout.tsx", "group-hover:-rotate-2"],
];
for (const [suffix, banned] of motionHighFrequencyBans) {
  const entry = [...texts.entries()].find(([file]) => file.endsWith(suffix));
  if (entry?.[1].includes(banned)) failures.push(`${suffix}: remove high-frequency decorative motion ${banned}`);
}
if (/\.evidence-card:hover\s*\{[^}]*transform:/s.test(css)) failures.push("src/app/globals.css: evidence-card hover should not translate on high-frequency review surfaces");
if (/\.trace-button:hover,\s*\.btn:hover\s*\{[^}]*transform:/s.test(css)) failures.push("src/app/globals.css: button hover should not translate; reserve transform feedback for active press");


const spatialInteractionSuffixes = [
  "components/workbench/",
  "components/evidence-trace/",
  "components/engineering-timeline/",
  "components/spatial-motion/",
  "components/tracelab/capture-type-card.tsx",
];
const hoverMotionPatternName = "hover-scale-or-lift";
for (const [file, text] of texts) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (!spatialInteractionSuffixes.some((suffix) => rel.includes(suffix))) continue;
  if (text.includes("transition-all")) failures.push(`${rel}: broad transition-all is forbidden on spatial/capture interaction surfaces`);
  if (/hover:[^"'\s]*(?:scale|translate)|hover:[^"'\n]*(?:scale-|translate-)/.test(text)) {
    failures.push(`${rel}: ${hoverMotionPatternName} is forbidden on high-frequency spatial interactions`);
  }
}

const designCssBans = ["backdrop-filter: blur(40", "linear-gradient(135deg, #7c3aed", "#8b5cf6"];
for (const banned of designCssBans) if (css.includes(banned)) warnings.push(`src/app/globals.css: review possible generic SaaS visual pattern: ${banned}`);

const spatialCssBans = ["backdrop-filter", "animation-iteration-count: infinite"];
for (const banned of spatialCssBans) {
  const workbenchCss = css.slice(css.indexOf("Spatial Evidence Workbench"));
  if (workbenchCss.includes(banned)) failures.push(`src/app/globals.css: spatial workbench must not use ${banned}`);
}
if (/\.workbench-board:hover\s*\{[^}]*(transform|translate|scale)/s.test(css)) failures.push("src/app/globals.css: workboard hover must not move or scale");



// Phase G: keep the Spatial Home artboard-first rather than letting it regress into dashboard chrome.
const workboardContent = texts.get(join(srcRoot, "components/workbench/workboard-content.tsx")) ?? "";
const workboardNode = texts.get(join(srcRoot, "components/workbench/workboard-node.tsx")) ?? "";
const workbenchTopbar = texts.get(join(srcRoot, "components/workbench/workbench-top-bar.tsx")) ?? "";
const workbenchInspector = texts.get(join(srcRoot, "components/workbench/inspector-host.tsx")) ?? "";
if (workboardContent.includes("grid grid-cols-3 gap-2")) failures.push("Spatial Home: KPI-card grids are forbidden inside the Active Iteration artboard");
if (!workboardContent.includes("workbench-loop-trace") || !workboardContent.includes("workbench-evidence-tiles")) failures.push("Spatial Home: evidence-loop/tile composition primitives are missing");
if (css.includes(".workbench-board::before")) failures.push("Spatial Home: full-height workboard accent stripes are forbidden; use restrained artboard labels");
if (!workboardNode.includes("workbench-artboard-label")) failures.push("Spatial Home: workboards must expose restrained artboard labels");
if (!workbenchTopbar.includes("workbench-context-pill") || !workbenchTopbar.includes("workbench-action-cluster")) failures.push("Spatial Home: full-width toolbar regression; floating chrome must stay split");
if (!workbenchInspector.includes("workbench-inspector-dark")) failures.push("Spatial Home: inspector must remain visually inside the dark spatial world");
if (failures.length) {
  console.error(`Frontend static audit failed (${failures.length} finding${failures.length === 1 ? "" : "s"}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Frontend static audit passed across ${files.length} source files.`);
}
if (warnings.length) {
  console.warn("Warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}
