import ts from "typescript";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// A lower bound: detects JSX text and visible string attributes, not dynamic
// messages, API responses or strings assembled in helpers. Never a coverage %.
const findings = [];
const userAttributes = new Set(["title", "subtitle", "label", "description", "placeholder", "alt", "aria-label"]);
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await scan(file); continue; }
    if (!file.endsWith(".tsx")) continue;
    const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function report(node, text) {
      if (!/[A-Za-z]{2}/.test(text)) return;
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      findings.push({ file: file.replaceAll("\\", "/"), line, text: text.trim().replace(/\s+/g, " ").slice(0, 100) });
    }
    function visit(node) {
      if (ts.isJsxText(node)) report(node, node.text);
      if (ts.isJsxAttribute(node) && userAttributes.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) report(node, node.initializer.text);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
await scan("src/app");
await scan("src/components");
if (process.argv.includes("--json")) console.log(JSON.stringify(findings, null, 2));
else {
  console.log("Hardcoded UI strings requiring review: " + findings.length);
  for (const item of findings.slice(0, 25)) console.log(item.file + ":" + item.line + " " + item.text);
  if (findings.length > 25) console.log("Use --json for the complete inventory.");
  console.log("This scan is a lower bound, not proof of complete localization.");
}
process.exitCode = findings.length ? 1 : 0;
