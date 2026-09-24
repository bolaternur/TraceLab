const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const roots = ["src", "tests"];
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filePath);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(filePath);
  }
}

for (const root of roots) {
  if (fs.existsSync(root)) walk(root);
}

const failures = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const output = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  });
  const errors = (output.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    failures.push({
      file,
      errors: errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")),
    });
  }
}

if (failures.length) {
  for (const failure of failures) {
    console.error(failure.file);
    for (const error of failure.errors) console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`TypeScript transpile/syntax pass: ${files.length} TS/TSX files, 0 syntax errors.`);
