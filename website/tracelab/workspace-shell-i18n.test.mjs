import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceContent } from './workspace-surface.mjs';
import { shellKeys, shellMessages, shellT, applyWorkspaceShellLocale } from './workspace-shell-i18n.js';
import { setWorkspaceLocale } from './workspace-i18n.js';

test('shell semantic keys cover all static text and accessible attributes in every locale', () => {
  const used = [...workspaceContent.matchAll(/data-ws-(?:key|label|title|placeholder)="([^"]+)"/g)].map(match => match[1]);
  assert.ok(used.length > 100);
  for (const locale of ['ru', 'en', 'kk']) {
    assert.deepEqual(Object.keys(shellMessages[locale]), shellKeys);
    for (const key of used) assert.ok(shellT(key, {}, locale).trim(), `${locale}:${key}`);
  }
  assert.throws(() => shellT('missing.key'), /Missing shell translation/);
  // Form controls keep stable persisted values and direct label associations.
  assert.match(workspaceContent, /<option value="draft" data-ws-key="decision.draft">/);
  assert.match(workspaceContent, /<label for="ws-record-rationale"><span data-ws-key="decision.why">/);
  assert.match(workspaceContent, /name="rationale"/);
});

test('switching shell language changes only marked interface text and keeps input drafts intact', () => {
  const title = { dataset: { wsKey: 'shell.title' }, textContent: '', setAttribute() {} };
  const search = { dataset: { wsPlaceholder: 'filter.searchHint' }, value: 'Авторский текст <not translated>', attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
  const close = { dataset: { wsLabel: 'inspector.close', wsTitle: 'inspector.close' }, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
  const fakeDocument = { querySelectorAll(selector) { return ({ '[data-ws-key]': [title], '[data-ws-placeholder]': [search], '[data-ws-label]': [close], '[data-ws-title]': [close] })[selector] ?? []; } };
  for (const locale of ['ru', 'en', 'kk']) {
    setWorkspaceLocale(locale);
    applyWorkspaceShellLocale(fakeDocument);
    assert.equal(title.textContent, shellT('shell.title'));
    assert.equal(search.attributes.placeholder, shellT('filter.searchHint'));
    assert.equal(close.attributes['aria-label'], shellT('inspector.close'));
    assert.equal(close.attributes.title, shellT('inspector.close'));
    assert.equal(search.value, 'Авторский текст <not translated>');
  }
});
