// Report-only alias of the guarded, fresh local fixture database runner.
if(process.argv.length>2)throw new Error('This alias accepts no options; use test-isolated-db.mjs for an allowlisted subset.');
process.argv.push('tests/workspace-report.db.test.ts');
await import('./test-isolated-db.mjs');
