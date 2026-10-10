import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copy } from './astra-copy.js';

const execute = promisify(execFile);
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(sourceDirectory, '../..');
const routes = ['', 'features', 'about', 'faq', 'privacy-policy', 'contact', 'pricing', 'demo', 'research', 'materials', 'workspace'];
const marker = 'tracelab-test-private-environment-7d063abd';
const builds = [];
let temporaryDirectory;

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'tracelab-astra-test-'));
  for (const [name, base] of [['localhost', ''], ['pages', '/TraceLab']]) {
    const directory = path.join(temporaryDirectory, name);
    const result = await execute(process.execPath, ['website/tracelab/build.mjs'], {
      cwd: repositoryDirectory,
      env: {
        ...process.env,
        BASE_PATH: base,
        OUTPUT_DIR: directory,
        TRACELAB_PRIVATE_TEST_CANARY: marker,
        DATABASE_URL: `postgresql://test:${marker}@127.0.0.1:1/not-a-real-database`,
        SECRETS_ENCRYPTION_KEY: marker,
      },
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    assert.ok(!`${result.stdout}${result.stderr}`.includes(marker), 'build logs must not expose environment values');
    const html = new Map(await Promise.all(routes.map(async route => [route, await readFile(path.join(directory, route, 'index.html'), 'utf8')])));
    builds.push({ base, directory, html });
  }
});

after(async () => {
  if (!temporaryDirectory) return;
  const resolved = path.resolve(temporaryDirectory);
  assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
  assert.ok(path.basename(resolved).startsWith('tracelab-astra-test-'));
  await rm(resolved, { recursive: true, force: true });
});

function visibleText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function attributes(html, attribute) {
  const expression = new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, 'g');
  return [...html.matchAll(expression)].map(match => match[2].replace(/&amp;/g, '&'));
}

async function filesUnder(directory, relative = '') {
  const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => {
    const name = path.join(relative, entry.name);
    return entry.isDirectory() ? filesUnder(directory, name) : [name];
  }));
  return groups.flat();
}

async function assertLocalTarget(build, reference, fromPath) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return;
  const resolved = new URL(reference, `https://tracelab-test.invalid${fromPath}`);
  if (build.base) assert.ok(resolved.pathname.startsWith(`${build.base}/`), `reference escapes Pages base: ${reference} in ${fromPath}`);
  const relative = decodeURIComponent(resolved.pathname.slice(build.base.length)).replace(/^\/+/, '');
  const target = path.resolve(build.directory, relative);
  const within = path.relative(build.directory, target);
  assert.ok(!within.startsWith('..') && !path.isAbsolute(within), `reference escapes output: ${reference}`);
  const info = await stat(target).catch(() => null);
  assert.ok(info, `missing target ${reference} in ${fromPath}`);
  if (info.isDirectory()) assert.ok((await stat(path.join(target, 'index.html'))).isFile(), `route has no index.html: ${reference}`);
}

test('local and Pages builds produce complete requested routes rather than redirect stubs', () => {
  for (const build of builds) for (const [route, html] of build.html) {
    assert.match(html, /<!doctype html>/i, `${build.base}/${route}: HTML document`);
    assert.match(html, /<title>[^<]+TraceLab[^<]*<\/title>/i, `${build.base}/${route}: product title`);
    assert.match(html, /<main\b[^>]*\bid=["']main["']/i, `${build.base}/${route}: main landmark`);
    assert.equal([...html.matchAll(/<h1\b/gi)].length, 1, `${build.base}/${route}: one main heading`);
    assert.doesNotMatch(html, /http-equiv=["']refresh["']/i, `${build.base}/${route}: must not be a legacy redirect`);
  }
});

test('homepage retains the requested Russian hero and exposes RU, EN and KK selection', () => {
  for (const build of builds) {
    const html = build.html.get('');
    const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '';
    assert.equal(visibleText(heading), 'История робота. Логика каждого решения.');
    for (const locale of ['ru', 'en', 'kk']) assert.match(html, new RegExp(`<button\\b[^>]*\\bdata-locale=["']${locale}["']`, 'i'));
  }
});

test('RU, EN and KK provide nonempty translations for every rendered copy and metadata key', () => {
  const locales = ['ru', 'en', 'kk'];
  assert.deepEqual(Object.keys(copy).sort(), [...locales].sort());
  const expectedKeys = Object.keys(copy.ru).sort();
  assert.ok(expectedKeys.length > 0, 'translation dictionary is populated');
  for (const locale of locales) {
    assert.deepEqual(Object.keys(copy[locale]).sort(), expectedKeys, `${locale}: translation key parity`);
    for (const key of expectedKeys) {
      assert.equal(typeof copy[locale][key], 'string', `${locale}.${key}: text value`);
      assert.ok(copy[locale][key].trim().length > 0, `${locale}.${key}: nonempty translation`);
    }
  }
  for (const build of builds) for (const [route, html] of build.html) {
    if (route === 'workspace') continue;
    const keys = ['data-i18n', 'data-i18n-label', 'data-title-key', 'data-description-key'].flatMap(attribute => attributes(html, attribute));
    assert.ok(keys.length > 0, `${route}: rendered translations`);
    for (const key of keys) for (const locale of locales) assert.ok(Object.hasOwn(copy[locale], key), `${route}: unknown ${locale} copy key ${key}`);
  }
});

test('demo tabs identify their panels and provide one initial keyboard entry point', () => {
  for (const build of builds) for (const route of ['', 'demo']) {
    const html = build.html.get(route);
    assert.match(html, /\bdata-demo(?:\s|>|=)/, `${route}: interactive example`);
    const tags = [...html.matchAll(/<[a-z][\w-]*\b[^>]*>/gi)].map(match => match[0]);
    const tabs = tags.filter(tag => attributes(tag, 'role')[0] === 'tab');
    const panels = tags.filter(tag => attributes(tag, 'role')[0] === 'tabpanel');
    assert.equal(tabs.length, 3, `${route}: graph, timeline and materials tabs`);
    assert.equal(panels.length, tabs.length, `${route}: corresponding panels`);
    assert.equal(tabs.filter(tag => attributes(tag, 'aria-selected')[0] === 'true').length, 1, `${route}: one selected tab`);
    assert.equal(tabs.filter(tag => attributes(tag, 'tabindex')[0] === '0').length, 1, `${route}: one tabbable tab`);
    for (const tab of tabs) {
      const id = attributes(tab, 'id')[0];
      const target = attributes(tab, 'aria-controls')[0];
      const selected = attributes(tab, 'aria-selected')[0] === 'true';
      assert.ok(id && target, `${route}: tab identity and panel target`);
      const panel = panels.find(tag => attributes(tag, 'id')[0] === target);
      assert.ok(panel, `${route}: panel ${target} exists`);
      assert.equal(attributes(panel, 'aria-labelledby')[0], id, `${route}: panel references its tab`);
      assert.equal(attributes(tab, 'tabindex')[0], selected ? '0' : '-1');
      assert.equal(/\bhidden(?:\s|>|=)/.test(panel), !selected, `${route}: only the active panel is initially visible`);
    }
  }
});

test('graph and timeline actions keep visitors on their current local workspace project', () => {
  for (const build of builds) {
    const hrefs = attributes(build.html.get(''), 'href');
    for (const view of ['graph', 'timeline']) {
      assert.ok(hrefs.includes(`${build.base}/workspace/?view=${view}`), `homepage needs a stable ${view} action`);
    }
    for (const href of hrefs.filter(value => value.startsWith(`${build.base}/workspace/`))) {
      const parameters = new URL(href, 'https://tracelab-test.invalid').searchParams;
      assert.equal(parameters.has('record'), false, 'marketing actions must not select a visitor record');
      assert.equal(parameters.has('project'), false, 'marketing actions must not switch a visitor project');
      assert.notEqual(parameters.get('view'), 'models', 'the static workspace has no models route');
    }
  }
});

test('Astra assets exist and marketing pages load the new stylesheet and interaction module', async () => {
  for (const build of builds) {
    for (const file of ['astra.css', 'astra.js', 'astra-copy.js']) assert.ok((await stat(path.join(build.directory, file))).isFile());
    for (const [route, html] of build.html) {
      if (route === 'workspace') continue;
      assert.ok(attributes(html, 'href').some(value => value.split('?')[0] === `${build.base}/astra.css`), `${route}: new stylesheet is connected`);
      assert.ok(attributes(html, 'src').some(value => value.split('?')[0] === `${build.base}/astra.js`), `${route}: language and interaction module is connected`);
    }
  }
});

test('published route, image, stylesheet, script and font references resolve under both base paths', async () => {
  for (const build of builds) {
    for (const [route, html] of build.html) {
      const fromPath = `${build.base}/${route ? `${route}/` : ''}`;
      for (const reference of [...attributes(html, 'href'), ...attributes(html, 'src')]) await assertLocalTarget(build, reference, fromPath);
    }
    for (const filename of await filesUnder(build.directory)) {
      const extension = path.extname(filename);
      if (!['.css', '.js'].includes(extension)) continue;
      const text = await readFile(path.join(build.directory, filename), 'utf8');
      const references = extension === '.css'
        ? [...text.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g)].map(match => match[1])
        : [...text.matchAll(/\bfrom\s*(["'])((?:\.{1,2}\/|\/)[^"']+)\1/g)].map(match => match[2]);
      for (const reference of references) await assertLocalTarget(build, reference, `${build.base}/${filename.split(path.sep).join('/')}`);
    }
  }
});

test('the real workspace preserves existing views, persistence, editing and export controls', async () => {
  const source = await readFile(path.join(sourceDirectory, 'workspace.js'), 'utf8');
  for (const build of builds) {
    const html = build.html.get('workspace');
    assert.match(html, /\bdata-workspace(?:\s|>|=)/);
    for (const view of ['graph', 'timeline', 'tests', 'history', 'study']) assert.match(html, new RegExp(`data-view=["']${view}["']`));
    for (const id of ['ws-project', 'ws-view', 'ws-inspector', 'ws-add-record', 'ws-connect', 'ws-import', 'ws-export-json', 'ws-export-html', 'ws-storage']) {
      assert.match(html, new RegExp(`\\bid=["']${id}["']`));
    }
    const builtSource = await readFile(path.join(build.directory, 'workspace.js'), 'utf8');
    assert.equal(builtSource.replace(/(\.\/[^'"\s]+\.js)\?v=[a-f\d]+/g, '$1'), source, 'build must preserve workspace interactions apart from import cache versions');
    const builtStore = await readFile(path.join(build.directory, 'workspace-store.js'), 'utf8');
    assert.equal(builtStore, await readFile(path.join(sourceDirectory, 'workspace-store.js'), 'utf8'), 'published data store must be unchanged');
  }
});

test('static publication does not contain environment values, credentials files or server source trees', async () => {
  for (const build of builds) for (const filename of await filesUnder(build.directory)) {
    assert.doesNotMatch(filename, /(?:^|[\\/])(?:\.env(?:\.[^\\/]*)?|\.git|node_modules|src|drizzle)(?:[\\/]|$)/i, `unexpected private/server build artifact: ${filename}`);
    if (/\.(?:html?|css|js|mjs|json|md|txt|csv|svg)$/i.test(filename)) {
      const text = await readFile(path.join(build.directory, filename), 'utf8');
      assert.ok(!text.includes(marker), `${filename}: private build environment leaked`);
    }
  }
});
