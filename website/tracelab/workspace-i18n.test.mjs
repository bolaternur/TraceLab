import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  workspaceKeys, workspaceMessages, missingWorkspaceKeys, setWorkspaceLocale,
  getWorkspaceLocale, getWorkspaceTimeZone, t, recordType, formatDate,
  formatNumber, formatPercent, formatDayKey, formatDayLabel,
} from './workspace-i18n.js';
import { timelineGroups, renderGraph, renderTimeline, renderTestChart, renderStudyChart } from './workspace-views.js';
import { renderCanvas } from './workspace-canvas.js';

test('all workspace locales cover semantic keys and retain matching interpolation parameters', async () => {
  assert.deepEqual(missingWorkspaceKeys(), []);
  const parameters = value => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map(match => match[1]).sort();
  for (const locale of ['ru', 'en', 'kk']) {
    assert.deepEqual(Object.keys(workspaceMessages[locale]), workspaceKeys);
    for (const key of workspaceKeys) assert.deepEqual(parameters(workspaceMessages[locale][key]), parameters(workspaceMessages.ru[key]), `${locale}:${key}`);
  }
  const incomplete = { ...workspaceMessages, kk: { ...workspaceMessages.kk, 'canvas.title': '' } };
  assert.deepEqual(missingWorkspaceKeys(incomplete), ['kk:canvas.title']);
  for (const filename of ['workspace-views.js', 'workspace-canvas.js']) {
    const source = await readFile(new URL(filename, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\bt\('([^']+)'/g)) assert.ok(workspaceKeys.includes(match[1]), `${filename}:${match[1]}`);
  }
});

test('locale changes retain the chosen time zone and invalid preferences do not partially apply', () => {
  setWorkspaceLocale('ru', 'Asia/Qyzylorda');
  setWorkspaceLocale('en');
  assert.equal(getWorkspaceLocale(), 'en');
  assert.equal(getWorkspaceTimeZone(), 'Asia/Qyzylorda');
  assert.throws(() => setWorkspaceLocale('kk', 'Not/AZone'), RangeError);
  assert.equal(getWorkspaceLocale(), 'en');
  assert.equal(getWorkspaceTimeZone(), 'Asia/Qyzylorda');
  assert.throws(() => setWorkspaceLocale('unknown', 'UTC'), RangeError);
  assert.throws(() => t('missing.key'), /Missing workspace translation/);
  assert.throws(() => t('canvas.fromPort'), /Missing workspace translation parameter/);
});

test('shared date and day formatting use the explicit team zone rather than the host zone', () => {
  const value = '2026-10-25T21:15:00.000Z';
  const now = '2026-10-26T06:00:00.000Z';
  setWorkspaceLocale('en', 'Asia/Qyzylorda');
  assert.equal(formatDayKey(value), '2026-10-26');
  assert.equal(formatDayLabel(value, now), 'Today');
  assert.equal(formatDate(value), new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qyzylorda', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)));
  setWorkspaceLocale('en', 'UTC');
  assert.equal(formatDayKey(value), '2026-10-25');
  assert.equal(formatDayLabel(value, now), 'Yesterday');
  assert.equal(formatDate(null), 'Date not provided');
  assert.equal(formatDayKey('not-a-date'), 'unknown');
  setWorkspaceLocale('kk', 'UTC');
  assert.equal(formatDayLabel(now, now), 'Бүгін');
});

test('numbers and labels localize while parameter text remains exactly as authored', () => {
  const authored = 'Автордың сөзі: <script>example</script> $& {title}';
  for (const [locale, intl] of [['ru', 'ru-RU'], ['en', 'en-GB'], ['kk', 'kk-KZ']]) {
    setWorkspaceLocale(locale, 'UTC');
    assert.equal(formatNumber(1234.5), new Intl.NumberFormat(intl, { maximumFractionDigits: 2 }).format(1234.5));
    assert.equal(formatPercent(0.175), new Intl.NumberFormat(intl, { style: 'percent', maximumFractionDigits: 1 }).format(0.175));
    assert.ok(t('canvas.fromPort', { title: authored }).includes(authored));
    assert.equal(recordType('decision'), workspaceMessages[locale]['record.decision']);
    assert.equal(recordType('unknown'), workspaceMessages[locale]['record.generic']);
  }
});

test('timeline is newest-first, supports oldest-first, groups by team day, and keeps unknown dates last', () => {
  setWorkspaceLocale('en', 'Asia/Qyzylorda');
  const records = [
    { id: 'old', createdAt: '2026-10-24T12:00:00Z' },
    { id: 'new', createdAt: '2026-10-26T04:00:00Z' },
    { id: 'unknown', createdAt: 'invalid' },
    { id: 'late-evening', createdAt: '2026-10-25T21:15:00Z' },
  ];
  const before = JSON.stringify(records);
  const newest = timelineGroups(records, { now: '2026-10-26T06:00:00Z' });
  assert.deepEqual(newest[0].records.map(record => record.id), ['new', 'late-evening']);
  assert.equal(newest[0].label, 'Today');
  assert.equal(newest.at(-1).key, 'unknown');
  assert.deepEqual(timelineGroups(records, { order: 'oldest' }).flatMap(group => group.records.map(record => record.id)), ['old', 'late-evening', 'new', 'unknown']);
  assert.equal(JSON.stringify(records), before);
});

test('timeline groups by authored subsystem or accepted iteration context without promoting suggestions',()=>{
  setWorkspaceLocale('en','UTC');
  const records=[{id:'version',kind:'iteration',title:'Grip v2',subsystem:'Intake',createdAt:'2026-10-30T08:00:00Z'},
    {id:'test',kind:'test',subsystem:'Intake',createdAt:'2026-10-31T09:00:00Z'},
    {id:'proposal',kind:'source',createdAt:'2026-10-31T10:00:00Z'}];
  const project={records,links:[{from:'test',to:'version',status:'accepted'},{from:'proposal',to:'version',status:'suggested'}]};
  const grouped=timelineGroups(records,{grouping:'iteration',project});
  assert.equal(grouped.find(group=>group.key==='version').label,'Grip v2');
  assert.deepEqual(grouped.find(group=>group.key==='version').records.map(record=>record.id),['test','version']);
  assert.deepEqual(grouped.find(group=>group.key==='unassigned').records.map(record=>record.id),['proposal']);
  const subsystems=timelineGroups(records,{grouping:'subsystem',project});
  assert.equal(subsystems.find(group=>group.key==='Intake').records.length,2);
  assert.equal(subsystems.find(group=>group.key==='unassigned').label,'No subsystem');
  // Context can include an iteration outside the visible date range.
  assert.equal(timelineGroups([records[1]],{grouping:'iteration',project})[0].label,'Grip v2');
});

// A narrow DOM adapter exercises rendering and selection without adding a browser
// framework dependency. Browser layout, focus and touch checks remain separate.
class Node {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.handlers = {};
    this.style = { setProperty() {} };
    this.className = '';
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.clientWidth = 1000;
    this.clientHeight = 700;
    this.scrollLeft = 0;
    this.scrollTop = 0;
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(' '); }
  get firstElementChild() { return this.children[0]; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.text = ''; this.children = [...nodes]; }
  insertBefore(node, before) { const index = this.children.indexOf(before); this.children.splice(index < 0 ? this.children.length : index, 0, node); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  removeEventListener(name) { delete this.handlers[name]; }
  getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight, x: 0, y: 0 }; }
  all() { return [this, ...this.children.flatMap(child => child.all())]; }
}

test('empty test and study views offer localized creation actions only when supplied',()=>{
  const prior=globalThis.document;globalThis.document={createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag)};
  try{
    for(const locale of ['ru','en','kk']){
      setWorkspaceLocale(locale,'UTC');
      for(const render of [renderTestChart,renderStudyChart]){
        const container=new Node('div');let created=0;
        render(container,{records:[],studyRows:[]},{onCreate:()=>created++});
        const action=container.all().find(node=>node.className==='wv-empty-action');assert.ok(action);assert.ok(action.textContent.length>5);action.handlers.click();assert.equal(created,1);
        render(container,{records:[],studyRows:[]});assert.equal(container.all().some(node=>node.className==='wv-empty-action'),false);
      }
    }
  }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('large timelines render bounded pages, retain scroll on detail refresh, and open deep-linked records',()=>{
  const oldDocument=globalThis.document;
  globalThis.document={createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag)};
  try{
    setWorkspaceLocale('en','UTC');
    const project={id:'large-timeline-fixture',links:[],records:Array.from({length:1000},(_,index)=>({id:'record-'+index,kind:'source',title:'Fixture '+index,body:'Original evidence',createdAt:new Date(Date.UTC(2026,0,1,0,index)).toISOString()}))};
    const original=JSON.stringify(project),container=new Node('div');
    let cleanup=renderTimeline(container,project);
    const items=()=>container.all().filter(node=>node.className.includes('wv-timeline-item'));
    assert.equal(items().length,100);
    container.all().find(node=>node.className==='wv-timeline-more').handlers.click();
    assert.equal(items().length,200);container.scrollTop=360;cleanup();
    cleanup=renderTimeline(container,project);
    assert.equal(items().length,200);assert.equal(container.scrollTop,360);cleanup();
    renderTimeline(container,project,{selectedId:'record-0'});
    assert.equal(items().length,1000);assert.equal(container.all().filter(node=>node.className.includes('is-selected')).length,1);
    assert.equal(JSON.stringify(project),original);
  }finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});

test('record UUIDs stay internal while graph, timeline and test selection use human-readable titles', () => {
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag) };
  try {
    setWorkspaceLocale('ru', 'Asia/Qyzylorda');
    const sourceId = '11111111-1111-4111-8111-111111111111';
    const testId = '22222222-2222-4222-8222-222222222222';
    const measuredId = '33333333-3333-4333-8333-333333333333';
    const project = { id: 'project', name: 'Проверка', records: [
      { id: sourceId, kind: 'source', title: 'Прототип захвата', body: 'Наблюдение автора', createdAt: '2026-10-29T08:00:00Z' },
      { id: testId, kind: 'test', title: 'Проверка удержания', trials: 20, successes: 17, createdAt: '2026-10-29T09:00:00Z' },
      { id: measuredId, kind: 'test', title: 'Замер нагрузки', measuredValue: 12.5, unit: 'N', createdAt: '2026-10-29T10:00:00Z' },
    ], links: [{ id: '44444444-4444-4444-8444-444444444444', from: sourceId, to: testId, label: 'Проверен в испытании', status: 'accepted' }], studyRows: [{ id: '55555555-5555-4555-8555-555555555555', baselineSeconds: 30, traceSeconds: 24 }] };
    const before = JSON.stringify(project);
    for (const render of [renderGraph, renderTimeline, renderTestChart, renderCanvas]) {
      const container = new Node('div'); let selected;
      const cleanup = render(container, project, { onSelect: id => { selected = id; } });
      const text = container.textContent;
      assert.ok(text.includes('Проверка удержания'));
      if (render !== renderTimeline) assert.ok(text.includes('17'));
      const presentation = container.all().map(node => [node.textContent, node.attributes['aria-label'] || '', node.title || ''].join(' ')).join(' ');
      for (const id of [sourceId, testId, measuredId, project.links[0].id]) assert.ok(!presentation.includes(id), `${render.name} exposes ${id}`);
      const selectable = container.all().find(node => node.handlers.click && (node.className.includes('timeline-button') || node.className.includes('test-row') || node.className.includes('record-button') || node.attributes.class?.includes('wv-node')));
      assert.ok(selectable, `${render.name} retains record selection`);
      selectable.handlers.click();
      assert.ok(project.records.some(record => record.id === selected), `${render.name} preserves internal identity`);
      cleanup?.();
    }
    const study = new Node('div');
    renderStudyChart(study, project);
    assert.ok(study.textContent.includes(t('study.participant', {count:1})));
    assert.ok(!study.textContent.includes(project.studyRows[0].id));
    assert.equal(JSON.stringify(project), before);
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});

test('all locales render real timeline, test, research and canvas labels without rewriting records', () => {
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag) };
  try {
    const project = {
      id: 'LOCAL-QA', name: 'Авторское название', dataKind: 'personal', educationalOrigin: true,
      records: [
        { id: 'source', kind: 'source', title: 'Моё наблюдение', body: 'Қатысушының өз сөзі', author: 'Author label', createdAt: '2026-10-25T21:15:00Z' },
        { id: 'qualitative', kind: 'test', title: 'Qualitative title', body: 'Без чисел, своими словами', createdAt: '2026-10-26T02:00:00Z', conditions: '180 г' },
        { id: 'test', kind: 'test', title: 'Authored test title', trials: 20, successes: 17, createdAt: '2026-10-26T04:00:00Z' },
      ],
      links: [{ id: 'LINK', from: 'source', to: 'test', label: 'Авторское название связи', status: 'suggested' }],
      studyRows: [{ participantCode: 'P-01', baselineSeconds: 30.5, traceSeconds: 24.25 }],
    };
    const before = JSON.stringify(project);
    for (const locale of ['ru', 'en', 'kk']) {
      setWorkspaceLocale(locale, 'Asia/Qyzylorda');
      const timeline = new Node('div');
      let selected;
      renderTimeline(timeline, project, { now: '2026-10-26T06:00:00Z', onSelect: id => { selected = id; } });
      assert.ok(timeline.textContent.includes(t('timeline.today')));
      assert.ok(timeline.textContent.includes('Қатысушының өз сөзі'));
      timeline.all().find(node => node.tagName === 'button').handlers.click();
      assert.equal(selected, 'test');
      const tests = new Node('div');
      renderTestChart(tests, project);
      assert.ok(tests.textContent.includes(t('tests.qualitativeTitle')));
      assert.ok(tests.textContent.includes('Без чисел, своими словами'));
      assert.ok(tests.textContent.includes(t('tests.educational')));
      const study = new Node('div');
      renderStudyChart(study, project);
      assert.ok(study.textContent.includes(t('study.educational')));
      const canvas = new Node('div');
      const cleanup = renderCanvas(canvas, project);
      assert.ok(canvas.textContent.includes(t('canvas.title')));
      assert.ok(canvas.textContent.includes('Моё наблюдение'));
      assert.ok(canvas.all().some(node => node.attributes['aria-label'] === t('canvas.controls')));
      cleanup();
      const graph = new Node('div');
      const cleanupGraph = renderGraph(graph, project);
      assert.ok(graph.textContent.includes(t('graph.help')));
      assert.ok(graph.textContent.includes('Авторское название связи'));
      cleanupGraph();
    }
    assert.equal(JSON.stringify(project), before);
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});
