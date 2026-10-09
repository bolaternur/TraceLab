import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceStore, STORAGE_KEY, LIMITS } from './workspace-store.js';

const DATE = '2026-10-09T10:00:00.000Z';

function mockStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    failWrite: false,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { if (this.failWrite) throw new Error('QuotaExceededError'); values.set(key, String(value)); },
    values,
  };
}

function makeStore(extra = {}) {
  let counter = 0;
  return createWorkspaceStore({ storage: null, eventTarget: null, now: () => DATE, idFactory: prefix => `${prefix}-${++counter}`, ...extra });
}

function personal(store) {
  store.createProject({ name: 'Мой захват', description: 'Личные записи команды' });
  return store.getProject();
}

function record(overrides = {}) {
  return { kind: 'source', title: 'Модель', body: 'Исходная CAD-модель', author: 'Участник P-01', ...overrides };
}

function nativeFixture() {
  const note = (id, entityType, entityId, field, body, createdAt, provenance = 'student') => ({ id, entityType, entityId, field, body, createdAt, provenance, sourceMethod: provenance === 'student' ? 'manual' : 'ai', authorUserId: 'USER-EXACT-ID' });
  return {
    manifest: { type: 'team_data', product: 'TraceLab', generatedAt: DATE, sourceEntityIds: ['SOURCE-RAW'], studentContentIds: ['NOTE-OLD', 'NOTE-NEW'], generatedContentIds: ['NOTE-GENERATED'] },
    sourceEvents: [{ id: 'SOURCE-RAW', title: 'Коммит захвата', summary: 'Изменена поверхность', provider: 'github', eventType: 'push', occurredAt: '2026-09-10T12:00:00Z', actorUserId: 'USER-EXACT-ID', projectId: 'PROJECT-RAW', subsystemId: 'SUBSYSTEM-RAW', iterationId: 'ITER-RAW' }],
    iterations: [{ id: 'ITER-RAW', title: 'Проверка v02', problemOrGoal: 'Удержание детали', changeSummary: 'Мягкая поверхность', state: 'tested', outcome: 'Повторить', openedAt: '2026-09-10T12:10:00Z', closedAt: null, createdBy: 'USER-EXACT-ID', projectId: 'PROJECT-RAW' }],
    tests: [{ id: 'TEST-RAW', title: 'Подъём', targetType: 'iteration', targetLabel: 'v02', question: 'Удерживается ли деталь?', procedure: 'Десять подъёмов', metricName: 'Успешные попытки', trials: 10, successes: 7, value: '0.07500', units: 'с', environment: '180 г; 20 см', passCriteria: 'Без срыва', observations: 'Три срыва', outcome: 'repeat', performedAt: '2026-09-10T13:00:00Z', createdBy: 'USER-EXACT-ID', iterationId: 'ITER-RAW', projectId: 'PROJECT-RAW' }],
    decisions: [{ id: 'DEC-RAW', title: 'Продолжить проверку', disposition: 'iterate', status: 'recorded', alternatives: ['Изменить материал', 'Изменить усилие'], decidedAt: '2026-09-10T14:00:00Z', authorUserId: null, iterationId: 'ITER-RAW' }],
    annotations: [
      note('NOTE-OLD', 'decision', 'DEC-RAW', 'rationale', 'Предыдущая причина', '2026-09-10T14:05:00Z'),
      note('NOTE-NEW', 'decision', 'DEC-RAW', 'rationale', 'Последняя авторская причина', '2026-09-10T14:10:00Z'),
      note('NOTE-GENERATED', 'decision', 'DEC-RAW', 'rationale', 'Сгенерированная причина не становится авторской', '2026-09-10T14:20:00Z', 'generated'),
      note('NOTE-NEXT', 'decision', 'DEC-RAW', 'next_step', 'Проверить вторую массу', '2026-09-10T14:15:00Z'),
      note('NOTE-UNATTACHED', 'artifact', 'ARTIFACT-MISSING', 'note', 'Пояснение к отсутствующему файлу', '2026-09-10T14:30:00Z'),
    ],
    relations: [
      { id: 'REL-1', fromType: 'source_event', fromId: 'SOURCE-RAW', toType: 'iteration', toId: 'ITER-RAW', relationType: 'SUPPORTS', status: 'suggested', origin: 'ai' },
      { id: 'REL-2', fromType: 'test', fromId: 'TEST-RAW', toType: 'iteration', toId: 'ITER-RAW', relationType: 'TESTS', status: 'rejected', origin: 'system' },
      { id: 'REL-3', fromType: 'test', fromId: 'TEST-RAW', toType: 'decision', toId: 'DEC-RAW', relationType: 'SUPPORTS', status: 'accepted', origin: 'manual' },
      { id: 'REL-4', fromType: 'source_event', fromId: 'SOURCE-RAW', toType: 'iteration', toId: 'ITER-RAW', relationType: 'RELATED_TO', status: 'accepted', origin: 'external_tool' },
      { id: 'REL-MISSING', fromType: 'source_event', fromId: 'SOURCE-RAW', toType: 'artifact', toId: 'ARTIFACT-MISSING', relationType: 'SUPPORTS', status: 'accepted', origin: 'manual' },
    ],
  };
}

test('seed is explicitly synthetic, read-only, linked, and has no pilot observations', () => {
  const store = makeStore();
  const project = store.getProject();
  assert.equal(project.dataKind, 'synthetic');
  assert.equal(project.educationalOrigin, true);
  assert.equal(project.records.length, 8);
  assert.equal(project.links.length, 7);
  assert.deepEqual(project.records.filter(item => item.kind === 'test').map(item => [item.id, item.trials, item.successes]), [['TEST-01', 10, 6], ['TEST-02', 10, 9]]);
  assert.deepEqual(project.studyRows, []);
  assert.ok(project.links.every(link => link.status === 'accepted' && link.origin === 'educational'));
  assert.throws(() => store.addRecord(record()), /только для просмотра/);
  assert.throws(() => store.updateRecord('SRC-01', { title: 'Изменено' }), /только для просмотра/);
  assert.throws(() => store.addLink({ from: 'SRC-01', to: 'TEST-02' }), /только для просмотра/);
  assert.throws(() => store.removeLink('LINK-01'), /только для просмотра/);
  assert.throws(() => store.addStudyRow({ participantCode: 'P-01', baselineSeconds: 15, traceSeconds: 10 }), /только для просмотра/);
  assert.throws(() => { project.records[0].title = 'Mutation'; }, TypeError);
});

test('personal project mutation preserves authored fields and immutable old snapshots', () => {
  const store = makeStore();
  personal(store);
  const before = store.getState();
  let notifications = 0;
  const unsubscribe = store.subscribe(state => { notifications += 1; assert.equal(state, store.getState()); });
  const id = store.addRecord(record({ kind: 'test', trials: 7, successes: 0, unit: 'подъёмы', conditions: '180 г; 20 см', criterion: 'Без срыва', measuredValue: 0 }));
  assert.equal(store.getProject().records[0].createdAt, DATE);
  assert.equal(store.getProject().records[0].unit, 'подъёмы');
  assert.equal(store.getProject().records[0].conditions, '180 г; 20 см');
  assert.equal(store.getProject().records[0].criterion, 'Без срыва');
  assert.equal(store.getProject().records[0].measuredValue, 0);
  store.updateRecord(id, { successes: 4, title: 'Повторили испытание' });
  assert.equal(store.getProject().records[0].successes, 4);
  assert.equal(before.projects.find(project => project.dataKind === 'personal').records.length, 0);
  assert.equal(notifications, 2);
  unsubscribe();
  store.updateRecord(id, { body: 'Уточнённое наблюдение' });
  assert.equal(notifications, 2);
});

test('invalid values fail atomically with readable errors', () => {
  const store = makeStore();
  personal(store);
  const before = store.exportProject();
  for (const fields of [
    { kind: 'test', trials: 0, successes: 0 },
    { kind: 'test', trials: 1.2, successes: 1 },
    { kind: 'test', trials: 2, successes: 3 },
    { kind: 'test', trials: 2, successes: -1 },
    { kind: 'test', trials: 2 },
    { kind: 'test', successes: 1 },
    { measuredValue: Infinity },
    { measuredValue: NaN },
    { measuredValue: -0.1 },
    { kind: 'other' },
    { title: ' ' },
    { title: 'a'.repeat(241) },
    { createdAt: '2026-02-30T12:00:00Z' },
    { createdAt: 'not a date' },
  ]) {
    assert.throws(() => store.addRecord(record(fields)), /[А-Яа-я]/);
    assert.equal(store.exportProject(), before);
  }
  assert.throws(() => store.addStudyRow({ participantCode: 'P-01', baselineSeconds: Infinity, traceSeconds: 1 }), /конечное/);
  assert.throws(() => store.addStudyRow({ participantCode: '', baselineSeconds: 0, traceSeconds: 1 }), /пустым/);
  const id = store.addRecord(record({ id: 'SRC-PERSONAL' }));
  assert.throws(() => store.updateRecord(id, { id: 'OTHER' }), /нельзя изменить/);
  assert.throws(() => store.updateRecord('MISSING', { title: 'Other' }), /не найдена/);
});

test('links require unique identifiers, existing endpoints, and one relation per directed pair', () => {
  const store = makeStore();
  personal(store);
  const from = store.addRecord(record({ id: 'PERSONAL-SRC' }));
  const to = store.addRecord(record({ id: 'PERSONAL-ITER', kind: 'iteration' }));
  assert.throws(() => store.addRecord(record({ id: from })), /уже существует/);
  assert.throws(() => store.addLink({ id: from, from, to }), /уже существует/);
  assert.throws(() => store.addLink({ from, to: 'MISSING' }), /отсутствующую запись/);
  assert.throws(() => store.addLink({ from, to: from }), /разные записи/);
  const link = store.addLink({ from, to, label: 'Исходный материал', status: 'suggested' });
  assert.equal(store.getProject().links[0].status, 'suggested');
  assert.equal(store.getProject().links[0].origin, 'local');
  assert.throws(() => store.addLink({ from, to, status: 'accepted' }), /уже существует/);
  assert.throws(() => store.removeLink('MISSING'), /не найдена/);
  store.removeLink(link);
  assert.equal(store.getProject().links.length, 0);
  store.addLink({ from, to, status: 'rejected', origin: 'imported' });
  assert.equal(store.getProject().links[0].status, 'rejected');
});

test('different manual relation types coexist while normalized duplicate types fail atomically', () => {
  const store = makeStore();
  personal(store);
  const from = store.addRecord(record({ id: 'SRC-TYPED' }));
  const to = store.addRecord(record({ id: 'DEC-TYPED', kind: 'decision' }));
  store.addLink({ from, to, relationType: 'SUPPORTS', label: 'Поддерживает решение' });
  store.addLink({ from, to, relationType: 'RELATED_TO', label: 'Связанный материал', status: 'suggested' });
  store.addLink({ from, to, label: 'Связь без указанного типа' });
  assert.deepEqual(store.getProject().links.map(link => link.relationType || ''), ['SUPPORTS', 'RELATED_TO', '']);
  const before = store.getState();
  assert.throws(() => store.addLink({ from, to, relationType: ' SUPPORTS ', status: 'suggested' }), /уже существует/);
  assert.throws(() => store.addLink({ from, to, relationType: '' }), /уже существует/);
  assert.throws(() => store.addLink({ from, to }), /уже существует/);
  assert.equal(store.getState(), before);
  store.addLink({ from: to, to: from, relationType: 'SUPPORTS' });
  const copy = makeStore();
  copy.importProject(store.exportProject());
  assert.deepEqual(copy.getProject().links, store.getProject().links);
});

test('study observations are paired, finite and do not silently duplicate participants', () => {
  const store = makeStore();
  personal(store);
  const id = store.addStudyRow({ participantCode: 'P-01/task-A', baselineSeconds: 12.5, traceSeconds: 0 });
  assert.deepEqual(store.getProject().studyRows[0], { id, participantCode: 'P-01/task-A', baselineSeconds: 12.5, traceSeconds: 0 });
  assert.throws(() => store.addStudyRow({ participantCode: 'P-01/task-A', baselineSeconds: 5, traceSeconds: 1 }), /уже есть пара/);
  assert.throws(() => store.addRecord(record({ id })), /уже существует/);
});

test('export-import roundtrip retains personal data and creates a separate project', () => {
  const store = makeStore();
  personal(store);
  const a = store.addRecord(record({ id: 'SRC-OWN', sourceType: 'CAD', revision: 'v1' }));
  const b = store.addRecord(record({ id: 'TEST-OWN', kind: 'test', trials: 10, successes: 8, unit: 'попытки', conditions: '20 см', criterion: 'Удержание' }));
  store.addLink({ from: a, to: b, status: 'suggested', origin: 'imported' });
  store.addStudyRow({ participantCode: 'P-02', baselineSeconds: 20, traceSeconds: 16 });
  const original = store.getProject();
  const importedId = store.importProject(store.exportProject());
  assert.notEqual(importedId, original.id);
  assert.deepEqual(store.getProject(), { ...original, id: importedId });
  assert.equal(store.getState().projects.length, 3);
  assert.ok(store.getState().projects.some(project => project.id === original.id));
  const simple = makeStore();
  simple.importProject(JSON.stringify(original));
  assert.deepEqual(simple.getProject().records, original.records);
  assert.equal(simple.getProject().dataKind, 'personal');
});

test('import strips unknown fields and prototype-pollution keys', () => {
  const store = makeStore();
  const input = JSON.parse(`{"schemaVersion":1,"__proto__":{"polluted":true},"project":{"id":"IMPORT-1","name":"Импорт","dataKind":"personal","constructor":{"prototype":{"polluted":true}},"records":[{"id":"R-1","kind":"source","title":"Материал","createdAt":"${DATE}","__proto__":{"polluted":true},"unexpected":"removed"}],"links":[],"studyRows":[],"unexpected":"removed"}}`);
  store.importProject(JSON.stringify(input));
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(store.getProject(), 'constructor'), false);
  assert.equal(Object.hasOwn(store.getProject(), 'unexpected'), false);
  assert.equal(Object.hasOwn(store.getProject().records[0], '__proto__'), false);
  assert.equal(Object.hasOwn(store.getProject().records[0], 'unexpected'), false);
  const inherited = Object.create({ kind: 'source', title: 'Inherited' });
  assert.throws(() => store.addRecord(inherited), /формат объекта/);
});

test('malformed, unsupported, duplicate, orphaned and oversized imports fail atomically', () => {
  const store = makeStore();
  const before = store.getState();
  const project = JSON.parse(store.exportProject()).project;
  const badCopies = [
    { ...project, records: [project.records[0], project.records[0]] },
    { ...project, records: Array.from({ length: LIMITS.records + 1 }, (_, index) => ({ ...project.records[0], id: `R-${index}` })) },
    { ...project, links: [{ id: 'ORPHAN', from: 'SRC-01', to: 'MISSING' }] },
    { ...project, links: [{ id: 'LINK', from: 'SRC-01', to: 'TEST-01', status: 'automatic' }] },
    { ...project, studyRows: [{ id: 'SRC-01', participantCode: 'P-1', baselineSeconds: 1, traceSeconds: 0 }] },
    { ...project, records: [{ ...project.records[0], id: '__proto__' }] },
  ];
  for (const candidate of badCopies) {
    assert.throws(() => store.importProject(JSON.stringify(candidate)), /[А-Яа-я]/);
    assert.equal(store.getState(), before);
  }
  assert.throws(() => store.importProject('{ bad JSON'), /некорректный JSON/);
  assert.throws(() => store.importProject(JSON.stringify({ schemaVersion: 2, project })), /не поддерживается/);
  assert.throws(() => store.importProject(' '.repeat(LIMITS.importBytes + 1)), /слишком большой/);
  assert.throws(() => store.importProject('я'.repeat(LIMITS.importBytes / 2 + 1)), /слишком большой/);
});

test('browser storage persists a complete workspace across new instances', () => {
  const storage = mockStorage();
  const store = makeStore({ storage });
  assert.equal(store.storageStatus, 'persistent');
  personal(store);
  const id = store.addRecord(record());
  const restored = makeStore({ storage });
  assert.equal(restored.storageStatus, 'persistent');
  assert.deepEqual(restored.getState(), store.getState());
  assert.equal(restored.getProject().records[0].id, id);
  assert.ok(storage.values.has(STORAGE_KEY));
});

test('unavailable or corrupt storage falls back visibly and does not erase its previous copy', () => {
  const inaccessible = createWorkspaceStore({ storage: { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } }, eventTarget: null });
  assert.equal(inaccessible.storageStatus, 'memory');
  personal(inaccessible);
  inaccessible.addRecord(record());
  assert.equal(inaccessible.getProject().records.length, 1);
  const corrupt = mockStorage({ [STORAGE_KEY]: 'broken data that must remain' });
  const isolated = makeStore({ storage: corrupt });
  assert.equal(isolated.storageStatus, 'memory');
  personal(isolated);
  isolated.addRecord(record());
  assert.equal(corrupt.getItem(STORAGE_KEY), 'broken data that must remain');
  assert.match(isolated.storageMessage, /не перезаписана/);
});

test('write failures preserve current data in memory and permit a JSON backup', () => {
  const storage = mockStorage();
  const store = makeStore({ storage });
  personal(store);
  const persistentCopy = storage.getItem(STORAGE_KEY);
  storage.failWrite = true;
  store.addRecord(record());
  assert.equal(store.storageStatus, 'memory');
  assert.equal(store.getProject().records.length, 1);
  assert.equal(JSON.parse(store.exportProject()).project.records.length, 1);
  assert.equal(storage.getItem(STORAGE_KEY), persistentCopy);
  assert.match(store.storageMessage, /выгрузите JSON/);
});

test('resetDemo restores only the canonical demo and preserves all personal projects', () => {
  const store = makeStore();
  const created = personal(store).id;
  store.addRecord(record());
  const before = store.getProject();
  store.resetDemo();
  assert.equal(store.getProject().dataKind, 'synthetic');
  assert.deepEqual(store.getState().projects.find(project => project.id === created), before);
  store.selectProject(created);
  assert.equal(store.getProject().records.length, 1);
  assert.throws(() => store.selectProject('MISSING'), /не найден/);
});

test('cross-tab changes refresh valid state and preserve personal projects on stale/deleted storage', () => {
  let handler;
  const eventTarget = { addEventListener(type, listener) { assert.equal(type, 'storage'); handler = listener; } };
  const storage = mockStorage();
  const first = makeStore({ storage, eventTarget });
  const second = makeStore({ storage });
  personal(second);
  second.addRecord(record());
  let notified = 0;
  first.subscribe(() => { notified += 1; });
  handler({ key: STORAGE_KEY, newValue: storage.getItem(STORAGE_KEY), storageArea: storage });
  assert.deepEqual(first.getState(), second.getState());
  assert.equal(notified, 1);
  const stale = makeStore().getState();
  handler({ key: STORAGE_KEY, newValue: JSON.stringify(stale), storageArea: storage });
  assert.equal(first.storageStatus, 'memory');
  assert.equal(first.getProject().records.length, 1);
  const third = makeStore({ storage, eventTarget });
  handler({ key: null, newValue: null, storageArea: storage });
  assert.equal(third.storageStatus, 'memory');
  assert.equal(third.getProject().records.length, 1);
});

test('native team_data import preserves identifiers, counts, numeric strings, dates, and authors', () => {
  const store = makeStore();
  const fixture = nativeFixture();
  store.importProject(JSON.stringify(fixture));
  const project = store.getProject();
  assert.equal(project.name, 'Импорт из TraceLab');
  assert.equal(project.dataKind, 'personal');
  assert.deepEqual(project.studyRows, []);
  assert.deepEqual(project.importManifest, fixture.manifest);
  const source = project.records.find(item => item.id === 'SOURCE-RAW');
  assert.equal(source.kind, 'source');
  assert.equal(source.author, 'USER-EXACT-ID');
  assert.equal(source.createdAt, '2026-09-10T12:00:00.000Z');
  assert.deepEqual(source.nativeRef, { entityType: 'source_event', projectId: 'PROJECT-RAW', subsystemId: 'SUBSYSTEM-RAW', iterationId: 'ITER-RAW' });
  const testRecord = project.records.find(item => item.id === 'TEST-RAW');
  assert.equal(testRecord.measuredValue, 0.075);
  assert.equal(testRecord.trials, 10);
  assert.equal(testRecord.successes, 7);
  assert.equal(testRecord.unit, 'с');
  assert.equal(testRecord.conditions, '180 г; 20 см');
  assert.equal(testRecord.criterion, 'Без срыва');
  assert.match(testRecord.body, /Десять подъёмов/);
  assert.equal(project.records.find(item => item.id === 'DEC-RAW').author, 'Автор не указан');
});

test('native import retains latest student rationale and every annotation without promoting generated text', () => {
  const store = makeStore();
  store.importProject(JSON.stringify(nativeFixture()));
  const project = store.getProject();
  const decision = project.records.find(item => item.id === 'DEC-RAW');
  assert.equal(decision.rationale, 'Последняя авторская причина');
  assert.match(decision.body, /Проверить вторую массу/);
  assert.doesNotMatch(decision.body, /Сгенерированная причина/);
  assert.equal(decision.annotationHistory.length, 4);
  assert.equal(project.annotationHistory.length, 5);
  assert.ok(decision.annotationHistory.some(note => note.id === 'NOTE-GENERATED' && note.provenance === 'generated'));
  assert.ok(project.importWarnings.some(warning => /отсутствующим сущностям: 1/.test(warning)));
  const exported = store.exportProject();
  const imported = makeStore();
  imported.importProject(exported);
  assert.deepEqual(imported.getProject().annotationHistory, project.annotationHistory);
  assert.deepEqual(imported.getProject().importManifest, project.importManifest);
});

test('native suggested/rejected relations remain unaccepted, different types coexist, and structural links are explicit', () => {
  const store = makeStore();
  store.importProject(JSON.stringify(nativeFixture()));
  const links = store.getProject().links;
  assert.equal(links.find(link => link.id === 'REL-1').status, 'suggested');
  assert.equal(links.find(link => link.id === 'REL-1').origin, 'ai');
  assert.equal(links.find(link => link.id === 'REL-2').status, 'rejected');
  assert.equal(links.filter(link => link.from === 'TEST-RAW' && link.to === 'ITER-RAW').length, 1);
  assert.equal(links.filter(link => link.from === 'SOURCE-RAW' && link.to === 'ITER-RAW').length, 2);
  assert.equal(links.find(link => link.id === 'REL-4').origin, 'external_tool');
  assert.equal(links.some(link => link.id === 'REL-MISSING'), false);
  const structural = links.find(link => link.from === 'DEC-RAW' && link.to === 'ITER-RAW');
  assert.equal(structural.origin, 'imported');
  assert.equal(structural.status, 'accepted');
  assert.equal(structural.relationType, 'RESPONDS_TO');
  assert.match(structural.label, /Структура исходного проекта/);
  assert.ok(store.getProject().importWarnings.some(warning => /отсутствующими узлами: 1/.test(warning)));
});

test('personal_contribution import permits missing iterations/relations and does not invent referenced versions', () => {
  const fixture = nativeFixture();
  fixture.manifest.type = 'personal_contribution';
  delete fixture.iterations;
  delete fixture.relations;
  fixture.tests[0].trials = null;
  fixture.tests[0].successes = null;
  fixture.tests[0].value = '12.25';
  const store = makeStore();
  store.importProject(JSON.stringify(fixture));
  assert.equal(store.getProject().records.length, 3);
  assert.equal(store.getProject().links.length, 0);
  assert.equal(store.getProject().records.some(record => record.id === 'ITER-RAW'), false);
  assert.equal(store.getProject().records.find(record => record.id === 'TEST-RAW').measuredValue, 12.25);
  assert.ok(store.getProject().importWarnings.some(warning => /отсутствующими узлами: 3/.test(warning)));
});

test('invalid native values, dates, relation statuses, and annotation IDs fail without changing existing data', () => {
  const store = makeStore();
  const before = store.getState();
  const mutations = [
    fixture => { fixture.tests[0].value = 'NaN'; },
    fixture => { fixture.tests[0].value = '-1'; },
    fixture => { fixture.tests[0].value = 'Infinity'; },
    fixture => { fixture.tests[0].successes = 11; },
    fixture => { fixture.sourceEvents[0].occurredAt = null; },
    fixture => { fixture.relations[0].status = 'proven'; },
    fixture => { fixture.annotations.push(fixture.annotations[0]); },
    fixture => { fixture.manifest.type = 'unknown'; },
  ];
  for (const mutate of mutations) {
    const fixture = nativeFixture();
    mutate(fixture);
    assert.throws(() => store.importProject(JSON.stringify(fixture)), /[А-Яа-я]/);
    assert.equal(store.getState(), before);
  }
});

test('educational provenance remains durable in editable copies, storage and JSON roundtrips', () => {
  const storage = mockStorage();
  const store = makeStore({ storage });
  const copy = JSON.parse(store.exportProject());
  copy.project.dataKind = 'personal';
  copy.project.name = 'Моя копия учебного примера';
  copy.project.educationalOrigin = true;
  store.importProject(JSON.stringify(copy));
  const copiedId = store.getProject().id;
  store.updateRecord('DEC-01', { rationale: 'Уточнение к учебному примеру' });
  store.addStudyRow({ participantCode: 'EXAMPLE-P-01', baselineSeconds: 12, traceSeconds: 7 });
  assert.equal(store.getProject().dataKind, 'personal');
  assert.equal(store.getProject().educationalOrigin, true);
  const restored = makeStore({ storage });
  assert.equal(restored.getProject().id, copiedId);
  assert.equal(restored.getProject().educationalOrigin, true);
  const imported = makeStore();
  imported.importProject(restored.exportProject());
  assert.equal(imported.getProject().educationalOrigin, true);
  assert.equal(imported.getProject().records.find(record => record.id === 'DEC-01').rationale, 'Уточнение к учебному примеру');
  assert.equal(imported.getProject().studyRows.length, 1);
  imported.resetDemo();
  assert.equal(imported.getState().projects.filter(project => project.educationalOrigin).length, 2);
  const fresh = makeStore();
  fresh.createProject({ name: 'Учебная практика', educationalOrigin: true });
  assert.equal(fresh.getProject().educationalOrigin, true);
  assert.throws(() => fresh.createProject({ name: 'Bad flag', educationalOrigin: 'false' }), /true или false/);
  const synthetic = JSON.parse(makeStore().exportProject());
  synthetic.project.educationalOrigin = false;
  fresh.importProject(JSON.stringify(synthetic));
  assert.equal(fresh.getProject().educationalOrigin, true);
});

test('moving demo nodes only changes layout and leaves evidence read-only and immutable', () => {
  const store = makeStore();
  const before = store.getProject();
  let notifications = 0;
  store.subscribe(() => { notifications += 1; });
  store.setNodePosition('SRC-01', { x: -150.5, y: 320, ignored: 'not retained' });
  const moved = store.getProject();
  assert.deepEqual(moved.nodePositions, { 'SRC-01': { x: -150.5, y: 320 } });
  assert.deepEqual(moved.records, before.records);
  assert.deepEqual(moved.links, before.links);
  assert.equal(moved.dataKind, 'synthetic');
  assert.equal(moved.educationalOrigin, true);
  assert.equal(Object.hasOwn(before, 'nodePositions'), false);
  assert.throws(() => { moved.nodePositions['SRC-01'].x = 0; }, TypeError);
  assert.throws(() => store.updateRecord('SRC-01', { title: 'Нельзя' }), /только для просмотра/);
  assert.throws(() => store.addLink({ from: 'SRC-01', to: 'DEC-02' }), /только для просмотра/);
  assert.equal(notifications, 1);
  store.setNodePosition('SRC-01', { x: -150.5, y: 320 });
  assert.equal(notifications, 1);
});

test('graph positions survive browser reload and JSON transfer with educational provenance', () => {
  const storage = mockStorage();
  const store = makeStore({ storage });
  store.setNodePosition('SRC-01', { x: -100000, y: 100000 });
  store.setNodePosition('DEC-01', { x: 0, y: -48.25 });
  const restored = makeStore({ storage });
  assert.deepEqual(restored.getState(), store.getState());
  const transferred = makeStore();
  transferred.importProject(restored.exportProject());
  assert.deepEqual(transferred.getProject().nodePositions, restored.getProject().nodePositions);
  assert.deepEqual(transferred.getProject().records, restored.getProject().records);
  assert.equal(transferred.getProject().educationalOrigin, true);
  const editable = JSON.parse(restored.exportProject());
  editable.project.dataKind = 'personal';
  transferred.importProject(JSON.stringify(editable));
  transferred.setNodePosition('DEC-01', { x: 222, y: 333 });
  const ownCopy = transferred.getProject();
  assert.equal(ownCopy.educationalOrigin, true);
  assert.deepEqual(ownCopy.nodePositions['SRC-01'], { x: -100000, y: 100000 });
  assert.deepEqual(ownCopy.nodePositions['DEC-01'], { x: 222, y: 333 });
});

test('invalid positions and orphaned imported layout fail atomically', () => {
  const store = makeStore();
  store.setNodePosition('SRC-01', { x: 10, y: 20 });
  const before = store.getState();
  for (const position of [
    { x: NaN, y: 0 }, { x: Infinity, y: 0 }, { x: -Infinity, y: 0 },
    { x: 100001, y: 0 }, { x: 0, y: -100001 },
    { x: '1', y: 0 }, { x: 1 }, { x: null, y: 0 }, [],
  ]) {
    assert.throws(() => store.setNodePosition('SRC-01', position), /[А-Яа-я]/);
    assert.equal(store.getState(), before);
  }
  assert.throws(() => store.setNodePosition('MISSING', { x: 0, y: 0 }), /не найден/);
  assert.equal(store.getState(), before);
  const project = JSON.parse(store.exportProject()).project;
  for (const nodePositions of [
    { MISSING: { x: 1, y: 2 } },
    { 'SRC-01': { x: 1, y: null } },
    { 'SRC-01': { x: 0, y: 100001 } },
    [], null,
  ]) {
    assert.throws(() => store.importProject(JSON.stringify({ ...project, nodePositions })), /[А-Яа-я]/);
    assert.equal(store.getState(), before);
  }
});

test('position imports retain only record IDs and coordinates and strip prototype metadata', () => {
  const store = makeStore();
  const input = JSON.parse(store.exportProject());
  input.project.nodePositions = JSON.parse('{"SRC-01":{"x":1,"y":2,"extra":"removed","__proto__":{"polluted":true}},"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true}}');
  store.importProject(JSON.stringify(input));
  assert.deepEqual(store.getProject().nodePositions, { 'SRC-01': { x: 1, y: 2 } });
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(store.getProject().nodePositions, '__proto__'), false);
  assert.equal(Object.hasOwn(store.getProject().nodePositions, 'constructor'), false);
});

test('layout reset removes positions only while demo reset preserves personal graph layouts', () => {
  const store = makeStore();
  store.setNodePosition('SRC-01', { x: 1, y: 2 });
  const movedDemo = store.getProject();
  store.resetNodePositions();
  assert.equal(Object.hasOwn(store.getProject(), 'nodePositions'), false);
  assert.deepEqual(store.getProject().records, movedDemo.records);
  assert.deepEqual(store.getProject().links, movedDemo.links);
  store.setNodePosition('SRC-01', { x: 30, y: 40 });
  personal(store);
  const recordId = store.addRecord(record());
  store.setNodePosition(recordId, { x: 50, y: 60 });
  const personalBefore = store.getProject();
  store.resetDemo();
  assert.equal(Object.hasOwn(store.getProject(), 'nodePositions'), false);
  assert.deepEqual(store.getState().projects.find(project => project.id === personalBefore.id), personalBefore);
  store.selectProject(personalBefore.id);
  store.resetNodePositions();
  const expected = { ...personalBefore };
  delete expected.nodePositions;
  assert.deepEqual(store.getProject(), expected);
});

test('cross-tab synchronization transfers layout without changing graph data', () => {
  let handler;
  const storage = mockStorage();
  const first = makeStore({ storage, eventTarget: { addEventListener(type, listener) { assert.equal(type, 'storage'); handler = listener; } } });
  const second = makeStore({ storage });
  second.setNodePosition('TEST-01', { x: 123, y: -45 });
  handler({ key: STORAGE_KEY, newValue: storage.getItem(STORAGE_KEY), storageArea: storage });
  assert.deepEqual(first.getState(), second.getState());
  assert.deepEqual(first.getProject().nodePositions, { 'TEST-01': { x: 123, y: -45 } });
  assert.equal(first.storageStatus, 'persistent');
});

test('native source exports do not fabricate positions from unrelated extra fields', () => {
  const store = makeStore();
  const fixture = nativeFixture();
  fixture.nodePositions = { 'SOURCE-RAW': { x: 1, y: 2 } };
  store.importProject(JSON.stringify(fixture));
  assert.equal(Object.hasOwn(store.getProject(), 'nodePositions'), false);
});
