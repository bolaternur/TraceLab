import { spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('public/_presentation');
const build = spawnSync(process.execPath, ['website/tracelab/build.mjs'], {
  env: { ...process.env, BASE_PATH: '', OUTPUT_DIR: output }, stdio: 'inherit', windowsHide: true,
});
if (build.status !== 0) process.exit(build.status || 1);
async function markPages(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await markPages(file);
    else if (entry.name.endsWith('.html')) {
      let html = await readFile(file, 'utf8');
      html = html.replace('<body', '<body data-runtime="server"');
      if (!html.includes('data-workspace')) html = html.replace('</body>', '<script type="module" src="/product-entry.js"></script></body>');
      await writeFile(file, html);
    }
  }
}
await markPages(output);
for (const file of ['workspace-server.js', 'product-entry.js','workspace-outbox.js','offline-capture.html','offline-capture.js','offline-capture.css']) {
  await copyFile(path.resolve('website/tracelab', file), path.join(output, file));
}
console.log('Astra presentation and workspace prepared for the single Next.js application. Static demo build remains separate.');
