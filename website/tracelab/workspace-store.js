/**
 * Browser-only workspace for the static Iznera site.
 * This is separate from the authenticated application and its database.
 * Exported snapshots are immutable; all writes are validated before committing.
 */
export const STORAGE_KEY = 'tracelab.workspace.v1';
export const LIMITS = Object.freeze({
  projects: 20, records: 500, links: 1000, studyRows: 1000, annotations: 2000, recordVersions: 2000,
  importBytes: 2 * 1024 * 1024, stateCharacters: 5 * 1024 * 1024,
});

const DEMO_ID = 'SYNTHETIC-GRIPPER';
const kinds = new Set(['source', 'iteration', 'test', 'decision']);
const statuses = new Set(['accepted', 'suggested', 'rejected']);
const dataKinds = new Set(['synthetic', 'personal']);
const authorOrigins = new Set(['local-unverified', 'imported-unverified', 'legacy-unverified', 'synthetic']);
const versionMethods = new Set(['manual-create', 'manual-edit', 'legacy-snapshot', 'imported-snapshot', 'conflict-edit']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const fail = message => { throw new Error(message); };

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}: нужен объект.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(`${label}: неподдерживаемый формат объекта.`);
  return value;
}

function string(value, label, maximum, required = false) {
  if (typeof value !== 'string') fail(`${label}: введите текст.`);
  const normalized = value.trim();
  if (required && !normalized) fail(`${label}: поле не может быть пустым.`);
  if (normalized.length > maximum) fail(`${label}: максимум ${maximum} символов.`);
  return normalized;
}

function identifier(value, label = 'Идентификатор') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(value)) {
    fail(`${label}: используйте 1–80 латинских букв, цифр, точек, дефисов, двоеточий или подчёркиваний.`);
  }
  return value;
}

function number(value, label, { integer = false, positive = false, maximum = 1e12 } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum ||
    (integer && !Number.isInteger(value)) || (positive && value === 0)) {
    const description = integer ? (positive ? 'целое положительное число' : 'целое неотрицательное число') : 'конечное неотрицательное число';
    fail(`${label}: требуется ${description} не больше ${maximum}.`);
  }
  return value;
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    fail('Дата записи: требуется дата и время в формате ISO 8601 с часовым поясом.');
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail('Дата записи: некорректная дата.');
  // Date.parse normalizes some impossible calendar dates, so check the local date separately.
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    fail('Дата записи: такого дня в календаре нет.');
  }
  return new Date(parsed).toISOString();
}

function optionalString(target, input, key, label, maximum) {
  if (own(input, key) && input[key] !== undefined && input[key] !== null) {
    target[key] = string(input[key], label, maximum);
  }
}

function normalizeAnnotation(input) {
  object(input, 'Авторская заметка');
  const result = {
    id: identifier(own(input, 'id') ? input.id : undefined, 'Идентификатор заметки'),
    entityType: string(own(input, 'entityType') ? input.entityType : undefined, 'Тип записи заметки', 80, true),
    entityId: identifier(own(input, 'entityId') ? input.entityId : undefined, 'Запись заметки'),
    field: string(own(input, 'field') ? input.field : undefined, 'Поле заметки', 100, true),
    body: string(own(input, 'body') ? input.body : '', 'Текст заметки', 12000),
    // A missing source account ID stays absent; a translated label is not an ID.
    authorUserId: own(input, 'authorUserId') && input.authorUserId != null ? string(input.authorUserId, 'Автор заметки', 160) : null,
    createdAt: timestamp(own(input, 'createdAt') ? input.createdAt : undefined),
  };
  optionalString(result, input, 'provenance', 'Происхождение заметки', 80);
  optionalString(result, input, 'sourceMethod', 'Способ создания заметки', 80);
  optionalString(result, input, 'originalAuthorLabel', 'Исходное имя автора заметки', 160);
  if (own(input, 'supersedesId') && input.supersedesId != null) result.supersedesId = identifier(input.supersedesId, 'Предыдущая версия заметки');
  return result;
}

function normalizeManifest(input) {
  object(input, 'Манифест импорта');
  if (input.product !== 'TraceLab' || !['team_data', 'personal_contribution'].includes(input.type)) {
    fail('Манифест импорта: поддерживаются выгрузки Iznera team_data и personal_contribution.');
  }
  const result = { product: 'TraceLab', type: input.type, generatedAt: timestamp(input.generatedAt) };
  for (const key of ['sourceEntityIds', 'studentContentIds', 'generatedContentIds']) {
    result[key] = limitedArray(own(input, key) ? input[key] : [], 'Идентификаторы манифеста', LIMITS.annotations).map(value => identifier(value));
  }
  return result;
}

function normalizeRecordContent(input, { requireDecisionWhy = false } = {}) {
  object(input, 'Запись');
  if (!own(input, 'kind') || !kinds.has(input.kind)) fail('Тип записи: выберите материал, версию, испытание или решение.');
  const result = {
    id: identifier(own(input, 'id') ? input.id : undefined, 'Идентификатор записи'),
    kind: input.kind,
    title: string(own(input, 'title') ? input.title : undefined, 'Название записи', 240, true),
    body: string(own(input, 'body') ? input.body : '', 'Описание записи', 12000),
    author: string(own(input, 'author') ? input.author : '', 'Автор записи', 160),
    createdAt: timestamp(own(input, 'createdAt') ? input.createdAt : undefined),
  };
  for (const [key, label, maximum] of [
    ['sourceType', 'Тип материала', 80], ['revision', 'Версия', 80], ['unit', 'Единица измерения', 80],
    ['rationale', 'Обоснование', 12000], ['criterion', 'Критерий испытания', 1000], ['conditions', 'Условия испытания', 2000],
  ]) optionalString(result, input, key, label, maximum);
  result.originalAuthorLabel = string(own(input, 'originalAuthorLabel') ? input.originalAuthorLabel : result.author, 'Исходное имя автора', 160);
  result.authorProvenance = own(input, 'authorProvenance') ? input.authorProvenance : own(input, 'nativeRef') ? 'imported-unverified' : 'legacy-unverified';
  if (!authorOrigins.has(result.authorProvenance)) fail('Происхождение автора: имя из локальной записи не является проверенным аккаунтом.');
  if (result.kind === 'decision') {
    // Old JSON did not have a lifecycle field. Keep its incomplete decisions as
    // explicit drafts; a new mutation must opt into draft rather than imply completion.
    result.status = own(input, 'status') ? input.status : (requireDecisionWhy || result.rationale ? 'closed' : 'draft');
    if (!['draft', 'closed'].includes(result.status)) fail('Статус решения: выберите draft или closed.');
    if (result.status === 'closed' && !result.rationale) fail('Для завершённого решения нужно авторское объяснение «Почему?». Неполное решение можно сохранить только как draft.');
  }
  if (result.kind === 'iteration') {
    // Old versions did not have a closeout contract. Preserve them as drafts;
    // never infer a completed engineering cycle from an imported description.
    result.status = own(input, 'status') ? input.status : 'draft';
    if (!['draft', 'closed'].includes(result.status)) fail('Статус версии: выберите draft или closed.');
    optionalString(result, input, 'nextStep', 'Следующий шаг', 2000);
    if (own(input, 'outcome') && input.outcome !== '' && input.outcome !== undefined && input.outcome !== null) {
      if (!['kept', 'reverted', 'iterate', 'deferred', 'rejected'].includes(input.outcome)) fail('Итог версии: выберите дальнейшее действие.');
      result.outcome = input.outcome;
    }
    if (result.status === 'closed' && (!result.body || !result.rationale || !result.outcome)) {
      fail('Для завершённой версии нужны описание изменения, авторское «Почему?» и итог. Неполную версию сохраните как draft.');
    }
  }
  if (own(input, 'measuredValue') && input.measuredValue !== undefined && input.measuredValue !== null) {
    result.measuredValue = number(input.measuredValue, 'Измеренное значение');
  }
  const hasTrials = own(input, 'trials') && input.trials !== undefined && input.trials !== null;
  const hasSuccesses = own(input, 'successes') && input.successes !== undefined && input.successes !== null;
  if (hasTrials !== hasSuccesses) fail('Испытание: укажите вместе число попыток и число успешных попыток.');
  if (hasTrials) {
    if (input.kind !== 'test') fail('Число попыток можно указать только для испытания.');
    result.trials = number(input.trials, 'Число попыток', { integer: true, positive: true, maximum: 1000000 });
    result.successes = number(input.successes, 'Успешные попытки', { integer: true, maximum: result.trials });
  }
  if (own(input, 'annotationHistory')) {
    result.annotationHistory = limitedArray(input.annotationHistory, 'История заметок записи', LIMITS.annotations).map(normalizeAnnotation);
  }
  if (own(input, 'nativeRef')) {
    const reference = object(input.nativeRef, 'Исходная запись');
    result.nativeRef = { entityType: string(reference.entityType, 'Исходный тип записи', 80, true) };
    for (const key of ['projectId', 'subsystemId', 'iterationId']) {
      if (own(reference, key) && reference[key] != null) result.nativeRef[key] = identifier(reference[key], 'Исходный идентификатор');
    }
  }
  return result;
}

function normalizeRecordHistory(input, current) {
  object(input, 'История версий записи');
  if (input.schemaVersion !== 1) fail('Версия истории записи не поддерживается.');
  const seen = new Set();
  const versions = limitedArray(input.versions, 'Версии записи', LIMITS.recordVersions).map((entry, index) => {
    object(entry, 'Версия записи');
    const id = identifier(entry.id, 'Идентификатор версии');
    if (seen.has(id)) fail(`Повторяется идентификатор версии «${id}».`);
    const previousVersionId = entry.previousVersionId === null ? null : identifier(entry.previousVersionId, 'Предыдущая версия');
    if ((index === 0 && previousVersionId !== null) || (index > 0 && !seen.has(previousVersionId))) fail('История записи ссылается на отсутствующую предыдущую версию.');
    if (!authorOrigins.has(entry.provenance) || !versionMethods.has(entry.sourceMethod)) fail('Версия записи: неизвестное происхождение или способ изменения.');
    object(entry.snapshot, 'Снимок версии');
    if (own(entry.snapshot, 'recordHistory')) fail('Снимок версии не может содержать вложенную историю.');
    const snapshot = normalizeRecordContent(entry.snapshot);
    if (snapshot.id !== current.id || snapshot.originalAuthorLabel !== current.originalAuthorLabel) fail('История относится к другой записи или изменяет исходное имя автора.');
    seen.add(id);
    return { id, previousVersionId, recordedAt: timestamp(entry.recordedAt), provenance: entry.provenance, sourceMethod: entry.sourceMethod, snapshot };
  });
  const currentVersionId = identifier(input.currentVersionId, 'Текущая версия');
  const selected = versions.find(version => version.id === currentVersionId);
  if (!selected || JSON.stringify(selected.snapshot) !== JSON.stringify(current)) fail('Текущая запись не совпадает с сохранённой версией.');
  const conflictVersionIds = limitedArray(own(input, 'conflictVersionIds') ? input.conflictVersionIds : [], 'Конфликтные версии', LIMITS.recordVersions).map(value => identifier(value, 'Конфликтная версия'));
  if (new Set(conflictVersionIds).size !== conflictVersionIds.length || conflictVersionIds.some(id => !seen.has(id) || id === currentVersionId)) fail('История содержит некорректную ссылку на конфликтную версию.');
  return { schemaVersion: 1, currentVersionId, versions, conflictVersionIds };
}

function normalizeRecord(input) {
  const result = normalizeRecordContent(input);
  if (own(input, 'recordHistory')) result.recordHistory = normalizeRecordHistory(input.recordHistory, result);
  return result;
}

function recordHistory(record, recordedAt, sourceMethod = 'legacy-snapshot') {
  if (record.recordHistory) return copy(record.recordHistory);
  return {
    schemaVersion: 1, currentVersionId: 'ORIGINAL', conflictVersionIds: [],
    versions: [{
      id: 'ORIGINAL', previousVersionId: null, recordedAt,
      provenance: record.authorProvenance, sourceMethod,
      snapshot: normalizeRecordContent(record),
    }],
  };
}

function preservesRecordHistory(previous, next, exceptProjectId, exceptRecordId) {
  return previous.projects.filter(project => project.dataKind === 'personal').every(project => {
    const incoming = next.projects.find(item => item.id === project.id);
    return incoming && project.records.every(record => {
      if (project.id === exceptProjectId && record.id === exceptRecordId) return true;
      const incomingRecord = incoming.records.find(item => item.id === record.id);
      if (!incomingRecord) return false;
      if (!record.recordHistory) {
        const original = JSON.stringify(normalizeRecordContent(record));
        return original === JSON.stringify(normalizeRecordContent(incomingRecord)) || incomingRecord.recordHistory?.versions.some(version => JSON.stringify(version.snapshot) === original);
      }
      return record.recordHistory.versions.every(version => incomingRecord?.recordHistory?.versions.some(candidate => candidate.id === version.id && JSON.stringify(candidate) === JSON.stringify(version)));
    });
  });
}

function normalizeLink(input) {
  object(input, 'Связь');
  const status = own(input, 'status') ? input.status : 'accepted';
  const origin = string(own(input, 'origin') ? input.origin : 'local', 'Источник связи', 80, true);
  if (!statuses.has(status)) fail('Статус связи: допустимы accepted, suggested или rejected.');
  const result = {
    id: identifier(own(input, 'id') ? input.id : undefined, 'Идентификатор связи'),
    from: identifier(own(input, 'from') ? input.from : undefined, 'Начало связи'),
    to: identifier(own(input, 'to') ? input.to : undefined, 'Конец связи'),
    label: string(own(input, 'label') ? input.label : '', 'Описание связи', 240),
    status, origin,
  };
  if (result.from === result.to) fail('Связь должна соединять две разные записи.');
  optionalString(result, input, 'relationType', 'Тип связи', 100);
  return result;
}

function normalizeStudyRow(input) {
  object(input, 'Измерение');
  return {
    id: identifier(own(input, 'id') ? input.id : undefined, 'Идентификатор измерения'),
    participantCode: string(own(input, 'participantCode') ? input.participantCode : undefined, 'Код участника', 80, true),
    baselineSeconds: number(own(input, 'baselineSeconds') ? input.baselineSeconds : undefined, 'Время без Iznera, секунды'),
    traceSeconds: number(own(input, 'traceSeconds') ? input.traceSeconds : undefined, 'Время с Iznera, секунды'),
  };
}

function limitedArray(value, label, maximum) {
  if (!Array.isArray(value)) fail(`${label}: нужен массив.`);
  if (value.length > maximum) fail(`${label}: максимум ${maximum} элементов.`);
  return value;
}

function normalizeNodePosition(input) {
  object(input, 'Положение узла');
  const result = {};
  for (const coordinate of ['x', 'y']) {
    const value = own(input, coordinate) ? input[coordinate] : undefined;
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100000) {
      fail(`Положение узла: координата ${coordinate} должна быть конечным числом от −100000 до 100000.`);
    }
    result[coordinate] = value;
  }
  return result;
}

function normalizeNodePositions(input, recordIds) {
  object(input, 'Расположение графа');
  // Only record identifiers and x/y coordinates form the layout. Prototype-shaped
  // metadata is discarded; it can never become part of another object's prototype.
  const entries = Object.entries(input).filter(([id]) => recordIds.has(id) || !['__proto__', 'constructor', 'prototype'].includes(id));
  if (entries.length > LIMITS.records) fail(`Расположение графа: максимум ${LIMITS.records} узлов.`);
  const result = {};
  for (const [id, position] of entries) {
    identifier(id, 'Узел графа');
    if (!recordIds.has(id)) fail(`Положение узла «${id}» ссылается на отсутствующую запись.`);
    result[id] = normalizeNodePosition(position);
  }
  return result;
}

function normalizeProject(input) {
  object(input, 'Проект');
  const dataKind = own(input, 'dataKind') ? input.dataKind : 'personal';
  if (!dataKinds.has(dataKind)) fail('Тип данных проекта: допустимы personal или synthetic.');
  const result = {
    id: identifier(own(input, 'id') ? input.id : undefined, 'Идентификатор проекта'),
    name: string(own(input, 'name') ? input.name : undefined, 'Название проекта', 120, true),
    description: string(own(input, 'description') ? input.description : '', 'Описание проекта', 2000),
    dataKind,
    records: limitedArray(own(input, 'records') ? input.records : [], 'Записи', LIMITS.records).map(normalizeRecord),
    links: limitedArray(own(input, 'links') ? input.links : [], 'Связи', LIMITS.links).map(normalizeLink),
    studyRows: limitedArray(own(input, 'studyRows') ? input.studyRows : [], 'Измерения', LIMITS.studyRows).map(normalizeStudyRow),
  };
  if (own(input, 'educationalOrigin')) {
    if (typeof input.educationalOrigin !== 'boolean') fail('Происхождение учебных данных: требуется true или false.');
    result.educationalOrigin = input.educationalOrigin;
  }
  // This flag survives editable copies, persistence, and every export/import roundtrip.
  if (dataKind === 'synthetic') result.educationalOrigin = true;
  if (own(input, 'importManifest')) result.importManifest = normalizeManifest(input.importManifest);
  if (own(input, 'importWarnings')) result.importWarnings = limitedArray(input.importWarnings, 'Примечания импорта', 20).map(value => string(value, 'Примечание импорта', 1000, true));
  if (own(input, 'annotationHistory')) {
    result.annotationHistory = limitedArray(input.annotationHistory, 'История заметок проекта', LIMITS.annotations).map(normalizeAnnotation);
    const noteIds = new Set();
    for (const note of result.annotationHistory) {
      if (noteIds.has(note.id)) fail(`Повторяется идентификатор заметки «${note.id}».`);
      noteIds.add(note.id);
    }
  }
  const allIds = new Set();
  for (const item of [...result.records, ...result.links, ...result.studyRows]) {
    if (allIds.has(item.id)) fail(`Повторяется идентификатор «${item.id}». Идентификаторы в проекте должны быть уникальными.`);
    allIds.add(item.id);
  }
  const recordIds = new Set(result.records.map(record => record.id));
  if (own(input, 'hiddenRecordIds')) {
    const hidden = limitedArray(input.hiddenRecordIds, 'Скрытые записи графа', LIMITS.records).map(id => identifier(id, 'Скрытая запись'));
    if (new Set(hidden).size !== hidden.length || hidden.some(id => !recordIds.has(id))) fail('Список скрытых записей содержит повтор или отсутствующую запись.');
    result.hiddenRecordIds = hidden;
  }
  if (own(input, 'nodePositions')) result.nodePositions = normalizeNodePositions(input.nodePositions, recordIds);
  const endpoints = new Set();
  for (const link of result.links) {
    if (!recordIds.has(link.from) || !recordIds.has(link.to)) fail(`Связь «${link.id}» ссылается на отсутствующую запись.`);
    const pair = `${link.from}\u0000${link.to}\u0000${link.relationType || ''}`;
    if (endpoints.has(pair)) fail(`Связь «${link.from} → ${link.to}» уже существует.`);
    endpoints.add(pair);
  }
  const participants = new Set();
  for (const row of result.studyRows) {
    if (participants.has(row.participantCode)) fail(`Для участника «${row.participantCode}» уже есть пара измерений. Используйте другой код для нового задания.`);
    participants.add(row.participantCode);
  }
  // Every project must remain transferable through its own pretty-printed JSON export.
  if (new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, project: result }, null, 2)).length > LIMITS.importBytes) {
    fail('Проект превышает 2 MiB. Сократите текст или число записей, чтобы его можно было выгрузить и импортировать.');
  }
  return result;
}

function normalizeState(input) {
  object(input, 'Рабочее пространство');
  if (!own(input, 'schemaVersion') || input.schemaVersion !== 1) fail('Версия данных не поддерживается. Нужна schemaVersion: 1.');
  const projects = limitedArray(input.projects, 'Проекты', LIMITS.projects).map(normalizeProject);
  if (projects.length === 0) fail('Рабочее пространство должно содержать хотя бы один проект.');
  const ids = new Set();
  for (const project of projects) {
    if (ids.has(project.id)) fail(`Повторяется идентификатор проекта «${project.id}».`);
    ids.add(project.id);
  }
  const activeProjectId = identifier(input.activeProjectId, 'Активный проект');
  if (!ids.has(activeProjectId)) fail('Активный проект не найден в рабочем пространстве.');
  const result = { schemaVersion: 1, activeProjectId, projects };
  if (JSON.stringify(result).length > LIMITS.stateCharacters) fail('Рабочее пространство слишком большое. Выгрузите данные и создайте меньше записей.');
  return result;
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const copy = value => JSON.parse(JSON.stringify(value));

function demoProject() {
  const authorA = 'Участник А · учебный профиль';
  const authorB = 'Участник Б · учебный профиль';
  const records = [
    { id: 'SRC-01', kind: 'source', title: 'Исходная модель захвата', body: 'Учебный материал gripper-v01.step. При подъёме деталь выскальзывает из захвата. Это описание иллюстративного сценария, а не загруженный CAD-файл.', author: authorA, createdAt: '2026-09-12T09:20:00.000Z', sourceType: 'CAD', revision: 'v01' },
    { id: 'ITER-01', kind: 'iteration', title: 'Захват v01: исходная поверхность', body: 'Сохранили исходную конструкцию перед испытанием. Контактная поверхность без мягких накладок.', author: authorA, createdAt: '2026-09-12T09:30:00.000Z', revision: 'v01' },
    { id: 'TEST-01', kind: 'test', title: 'Первое испытание: 6 из 10', body: 'В четырёх учебных попытках деталь выскользнула. Результат относится к версии v01.', author: authorA, createdAt: '2026-09-12T10:10:00.000Z', trials: 10, successes: 6, unit: 'успешные попытки', conditions: 'Деталь 180 г; подъём на 20 см; 10 попыток.', criterion: 'Деталь удерживается в течение всего подъёма.' },
    { id: 'SRC-02', kind: 'source', title: 'Наблюдение: деталь выскальзывает', body: 'Учебная карточка фотонаблюдения после первого испытания. Реальный снимок не предоставлен; карточка показывает место такого материала в истории.', author: authorA, createdAt: '2026-09-12T10:15:00.000Z', sourceType: 'Фото / наблюдение' },
    { id: 'DEC-01', kind: 'decision', title: 'Изменить контактную поверхность', body: 'Добавить мягкие накладки и увеличить площадь контакта.', rationale: 'Основание — четыре срыва в TEST-01. Сначала изменяем поверхность: увеличение усилия может повредить деталь и требует отдельного испытания. Это учебное объяснение автора.', author: authorB, createdAt: '2026-09-12T11:35:00.000Z' },
    { id: 'ITER-02', kind: 'iteration', title: 'Захват v02: мягкие накладки', body: 'В учебной модели gripper-v02.step увеличили площадь контакта и добавили накладки по решению DEC-01.', author: authorA, createdAt: '2026-09-14T06:40:00.000Z', revision: 'v02' },
    { id: 'TEST-02', kind: 'test', title: 'Повторное испытание: 9 из 10', body: 'Повторили подъём той же детали с той же высотой. Значения вымышлены и не измеряют пользу Iznera.', author: authorA, createdAt: '2026-09-14T07:10:00.000Z', trials: 10, successes: 9, unit: 'успешные попытки', conditions: 'Деталь 180 г; подъём на 20 см; 10 попыток.', criterion: 'Деталь удерживается в течение всего подъёма.' },
    { id: 'DEC-02', kind: 'decision', title: 'Сохранить v02 для следующей проверки', body: 'В учебном сценарии оставили новую поверхность и запланировали испытание с другой массой.', rationale: 'TEST-02 показывает 9 из 10 успешных попыток в указанных условиях. Этого недостаточно, чтобы утверждать надёжность на других деталях или причинный эффект продукта.', author: authorB, createdAt: '2026-09-14T07:30:00.000Z' },
  ];
  const pairs = [
    ['SRC-01', 'ITER-01', 'материал исходной версии'],
    ['ITER-01', 'TEST-01', 'проверена эта версия'],
    ['SRC-02', 'TEST-01', 'наблюдение испытания'],
    ['TEST-01', 'DEC-01', 'основание решения'],
    ['DEC-01', 'ITER-02', 'реализовано в версии'],
    ['ITER-02', 'TEST-02', 'проверена новая версия'],
    ['TEST-02', 'DEC-02', 'основание следующего решения'],
  ];
  return normalizeProject({
    id: DEMO_ID, name: 'Захват · учебный пример',
    description: 'Вымышленный инженерный сценарий: участники, даты и измерения синтетические. Это пример связей материалов, испытаний и решений, а не результаты исследования Iznera.',
    dataKind: 'synthetic', records,
    links: pairs.map(([from, to, label], index) => ({ id: `LINK-${String(index + 1).padStart(2, '0')}`, from, to, label, status: 'accepted', origin: 'educational' })),
    studyRows: [],
  });
}

function initialState() {
  return { schemaVersion: 1, activeProjectId: DEMO_ID, projects: [demoProject()] };
}

function parseJson(text, label) {
  if (typeof text !== 'string') fail(`${label}: нужен текст JSON.`);
  if (text.length > LIMITS.importBytes || new TextEncoder().encode(text).length > LIMITS.importBytes) {
    fail(`${label}: файл слишком большой. Максимум 2 MiB.`);
  }
  try { return JSON.parse(text); } catch { fail(`${label}: некорректный JSON.`); }
}

function nativeText(value, label, maximum = 12000) {
  return value == null ? '' : string(value, label, maximum);
}

function nativeNumber(value, label) {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) fail(`${label}: некорректное числовое значение.`);
    return number(Number(text), label);
  }
  return number(value, label);
}

/** Adapt the existing application's documented JSON export, without fabricating missing entities. */
function nativeProject(input) {
  const importManifest = normalizeManifest(input.manifest);
  const groups = [
    ['sourceEvents', 'source_event', 'source', 'Материал', 'occurredAt', 'actorUserId'],
    ['iterations', 'iteration', 'iteration', 'Версия', 'openedAt', 'createdBy'],
    ['tests', 'test', 'test', 'Испытание', 'performedAt', 'createdBy'],
    ['decisions', 'decision', 'decision', 'Решение', 'decidedAt', 'authorUserId'],
  ];
  const annotations = limitedArray(own(input, 'annotations') ? input.annotations : [], 'Заметки импорта', LIMITS.annotations).map(normalizeAnnotation);
  const noteIds = new Set();
  for (const note of annotations) {
    if (noteIds.has(note.id)) fail(`Повторяется идентификатор заметки «${note.id}».`);
    noteIds.add(note.id);
  }
  const notesByEntity = new Map();
  for (const note of annotations) {
    const key = `${note.entityType}\u0000${note.entityId}`;
    if (!notesByEntity.has(key)) notesByEntity.set(key, []);
    notesByEntity.get(key).push(note);
  }
  const records = [];
  const nativeRows = new Map();
  const noteLabels = { problem: 'Проблема', change: 'Изменение', next_step: 'Следующий шаг', note: 'Заметка', reflection: 'Рефлексия' };

  for (const [arrayKey, entityType, kind, label, dateKey, authorKey] of groups) {
    const rows = limitedArray(own(input, arrayKey) ? input[arrayKey] : [], `Импорт: ${arrayKey}`, LIMITS.records);
    for (const row of rows) {
      object(row, `Импорт: ${label}`);
      const id = identifier(row.id, `Идентификатор: ${label}`);
      if (nativeRows.has(id)) fail(`Повторяется идентификатор записи «${id}».`);
      const title = nativeText(row.title, 'Название исходной записи', 240) || `${label} ${id}`;
      const author = nativeText(row[authorKey], 'Автор исходной записи', 160) || 'Автор не указан';
      const record = { id, kind, title, body: '', author, createdAt: timestamp(row[dateKey]), nativeRef: { entityType } };
      for (const key of ['projectId', 'subsystemId', 'iterationId']) {
        if (own(row, key) && row[key] != null) record.nativeRef[key] = identifier(row[key], 'Идентификатор исходного проекта');
      }
      const fragments = [];
      const fragment = (heading, value) => {
        const text = nativeText(value, `Импорт: ${heading}`);
        if (text) fragments.push(`${heading}: ${text}`);
      };
      if (kind === 'source') {
        record.body = nativeText(row.summary, 'Описание материала');
        record.sourceType = [nativeText(row.provider, 'Провайдер материала', 40), nativeText(row.eventType, 'Событие материала', 40)].filter(Boolean).join(' · ');
      } else if (kind === 'iteration') {
        fragment('Проблема / цель', row.problemOrGoal);
        fragment('Изменение', row.changeSummary);
        fragment('Состояние', row.state);
        fragment('Итог', row.outcome);
        if (row.closedAt != null) fragment('Дата завершения', timestamp(row.closedAt));
      } else if (kind === 'test') {
        for (const [key, heading] of [
          ['targetLabel', 'Объект испытания'], ['question', 'Вопрос'], ['hypothesis', 'Гипотеза'],
          ['procedure', 'Процедура'], ['independentVariable', 'Изменяемый параметр'],
          ['metricName', 'Показатель'], ['observations', 'Наблюдения'], ['outcome', 'Итог'],
        ]) fragment(heading, row[key]);
        record.unit = nativeText(row.units, 'Единица измерения', 80);
        record.conditions = nativeText(row.environment, 'Условия испытания', 2000);
        record.criterion = nativeText(row.passCriteria, 'Критерий испытания', 1000);
        if (row.trials != null || row.successes != null) { record.trials = row.trials; record.successes = row.successes; }
        if (row.value != null) record.measuredValue = nativeNumber(row.value, 'Измеренное значение');
      } else {
        fragment('Принятое решение', row.disposition);
        fragment('Статус', row.status);
        if (row.alternatives != null) {
          const alternatives = limitedArray(row.alternatives, 'Альтернативы решения', 100).map(value => string(value, 'Альтернатива', 1000));
          if (alternatives.length) fragment('Рассмотренные альтернативы', alternatives.join('; '));
        }
      }
      if (fragments.length) record.body = fragments.join('\n\n');
      const history = notesByEntity.get(`${entityType}\u0000${id}`) || [];
      record.annotationHistory = [...history].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const latestStudentFields = new Map();
      for (const note of [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
        if (note.provenance === 'student' && !latestStudentFields.has(note.field)) latestStudentFields.set(note.field, note);
      }
      for (const [field, note] of latestStudentFields) {
        if (field === 'rationale') record.rationale = note.body;
        else if (note.body) {
          const heading = noteLabels[field] || field;
          record.body += `${record.body ? '\n\n' : ''}${heading} (авторская заметка ${note.authorUserId || note.originalAuthorLabel || 'Автор не указан'}): ${note.body}`;
        }
      }
      records.push(normalizeRecord(record));
      nativeRows.set(id, row);
    }
  }
  if (records.length > LIMITS.records) fail(`Импорт содержит слишком много записей. Максимум ${LIMITS.records}.`);

  const links = [];
  const recordIds = new Set(records.map(record => record.id));
  const usedIds = new Set(recordIds);
  const signatures = new Set();
  let skippedLinks = 0;
  const relationLabels = {
    SUPPORTS: 'Поддерживает материалом', TESTS: 'Проверяет версию', RESPONDS_TO: 'Отвечает на проблему',
    BASED_ON: 'Основано на', LEADS_TO: 'Приводит к', IMPLEMENTS: 'Реализует решение',
  };
  for (const row of limitedArray(own(input, 'relations') ? input.relations : [], 'Связи импорта', LIMITS.links)) {
    object(row, 'Связь импорта');
    const relationType = string(row.relationType, 'Тип исходной связи', 100, true);
    const link = normalizeLink({ id: row.id, from: row.fromId, to: row.toId, label: relationLabels[relationType] || relationType, relationType, origin: row.origin, status: row.status });
    if (usedIds.has(link.id)) fail(`Повторяется идентификатор «${link.id}».`);
    usedIds.add(link.id);
    if (!recordIds.has(link.from) || !recordIds.has(link.to)) { skippedLinks += 1; continue; }
    const signature = `${link.from}\u0000${link.to}\u0000${relationType}`;
    if (signatures.has(signature)) fail(`Исходная связь «${link.from} → ${link.to}» типа ${relationType} повторяется.`);
    signatures.add(signature);
    links.push(link);
  }
  let structuralCounter = 0;
  for (const record of records) {
    if (record.kind === 'iteration') continue;
    const target = nativeRows.get(record.id).iterationId;
    if (!target) continue;
    if (!recordIds.has(target) || !records.some(item => item.id === target && item.kind === 'iteration')) { skippedLinks += 1; continue; }
    const relationType = record.kind === 'test' ? 'TESTS' : record.kind === 'decision' ? 'RESPONDS_TO' : 'SUPPORTS';
    const signature = `${record.id}\u0000${target}\u0000${relationType}`;
    // An explicit suggested/rejected relation takes precedence over the structural convenience link.
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    let id;
    do { id = `STRUCTURAL-${++structuralCounter}`; } while (usedIds.has(id));
    usedIds.add(id);
    links.push({ id, from: record.id, to: target, label: `Структура исходного проекта: ${relationLabels[relationType].toLowerCase()}`, relationType, origin: 'imported', status: 'accepted' });
  }

  const attachedAnnotationIds = new Set(records.flatMap(record => record.annotationHistory.map(note => note.id)));
  const unattached = annotations.filter(note => !attachedAnnotationIds.has(note.id)).length;
  const importWarnings = [
    'Данные импортированы из JSON Iznera. Авторство, статусы и значения сохранены; достоверность измерений этим импортом не проверяется.',
    'В исходном JSON нет названий проектов, имён участников и бинарных файлов CAD или фото. Идентификаторы сохранены, недостающие материалы не созданы.',
  ];
  if (skippedLinks) importWarnings.push(`Не отображены связи с отсутствующими узлами: ${skippedLinks}. В эту выгрузку соответствующие сущности не вошли.`);
  if (unattached) importWarnings.push(`Заметки к отсутствующим сущностям: ${unattached}. Их текст и происхождение сохранены в истории заметок JSON.`);
  return normalizeProject({
    id: 'NATIVE-IMPORT', name: 'Импорт из Iznera', dataKind: 'personal',
    description: 'Локальная копия данных из выгрузки Iznera. Сохраняет исходные идентификаторы, даты, авторские заметки и статусы связей. Это не подтверждение результатов пилота.',
    records, links, studyRows: [], importManifest, importWarnings, annotationHistory: annotations,
  });
}

/** Factory for isolated tests; production views import the singleton below. */
export function createWorkspaceStore(options = {}) {
  let storage;
  let storageStatus = 'memory';
  let storageMessage = 'Данные хранятся только в памяти этой вкладки. Выгрузите JSON, чтобы сохранить их.';
  const eventTarget = own(options, 'eventTarget') ? options.eventTarget : globalThis.window;
  const now = options.now || (() => new Date().toISOString());
  let counter = 0;
  const makeId = options.idFactory || (prefix => {
    const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${++counter}`;
    return `${prefix}-${suffix}`;
  });
  const listeners = new Set();
  let state = freeze(initialState());
  let canWriteStorage = true;
  let persistedValue = null;

  function persistent() {
    storageStatus = 'persistent';
    storageMessage = 'Данные сохранены в этом браузере. JSON подходит для резервной копии и переноса.';
  }

  function memory(message) {
    storageStatus = 'memory';
    storageMessage = message || 'Браузер не разрешил сохранение. Данные доступны в этой вкладке; выгрузите JSON перед закрытием.';
  }

  try {
    storage = own(options, 'storage') ? options.storage : globalThis.localStorage;
    if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw !== null) {
        if (typeof raw !== 'string' || raw.length > LIMITS.stateCharacters) fail('Сохранённое пространство слишком большое.');
        let parsed;
        try { parsed = JSON.parse(raw); } catch { fail('Сохранённые данные повреждены.'); }
        state = freeze(normalizeState(parsed));
      }
      persistedValue = JSON.stringify(state);
      storage.setItem(STORAGE_KEY, persistedValue);
      persistent();
    }
  } catch {
    // Do not overwrite unrecognized/corrupt data. Continue with an isolated demo in memory.
    canWriteStorage = false;
    memory('Не удалось прочитать или сохранить данные браузера. Предыдущая копия не перезаписана; новые изменения доступны в памяти этой вкладки.');
  }

  function notify() {
    for (const listener of [...listeners]) {
      try { listener(state); } catch (error) { globalThis.console?.error?.('Iznera: ошибка обновления интерфейса.', error); }
    }
  }

  function commit(next, expectedStoredValue = persistedValue) {
    const normalized = freeze(normalizeState(next));
    state = normalized;
    if (storage && canWriteStorage) {
      try {
        // localStorage has no compare-and-swap transaction. Detect an intervening
        // write before replacing it; keep this tab's full snapshot exportable.
        if (storage.getItem(STORAGE_KEY) !== expectedStoredValue) {
          canWriteStorage = false;
          memory('Другая вкладка сохранила изменения одновременно. Её копия не перезаписана; эта версия доступна в памяти. Выгрузите JSON перед закрытием.');
        } else {
          persistedValue = JSON.stringify(state);
          storage.setItem(STORAGE_KEY, persistedValue);
          persistent();
        }
      }
      catch { canWriteStorage = false; memory(); }
    }
    notify();
  }

  function getProject() {
    return state.projects.find(project => project.id === state.activeProjectId);
  }

  function mutableProject() {
    const project = getProject();
    if (project.dataKind === 'synthetic') fail('Учебный пример доступен только для просмотра. Создайте свой проект или импортируйте личные данные.');
    return copy(project);
  }

  function replaceProject(project) {
    commit({ ...state, projects: state.projects.map(item => item.id === project.id ? project : item) });
  }

  function uniqueId(prefix, used, custom) {
    if (custom !== undefined) {
      const id = identifier(custom);
      if (used.has(id)) fail(`Идентификатор «${id}» уже существует.`);
      return id;
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const id = identifier(makeId(prefix));
      if (!used.has(id)) return id;
    }
    fail('Не удалось создать уникальный идентификатор. Повторите действие.');
  }

  function projectItemIds(project) {
    return new Set([...project.records, ...project.links, ...project.studyRows].map(item => item.id));
  }

  function appendProject(project) {
    if (state.projects.length >= LIMITS.projects) fail(`Достигнут лимит: ${LIMITS.projects} проектов. Сохраните JSON текущих проектов.`);
    commit({ ...state, activeProjectId: project.id, projects: [...state.projects, project] });
    return project.id;
  }

  function addStudyRows(rows) {
    const inputs = limitedArray(rows, 'Измерения для добавления', LIMITS.studyRows);
    const project = mutableProject();
    if (project.studyRows.length + inputs.length > LIMITS.studyRows) fail(`В проекте может быть не больше ${LIMITS.studyRows} пар измерений.`);
    if (!inputs.length) return [];
    const used = projectItemIds(project);
    const ids = [];
    for (const fields of inputs) {
      object(fields, 'Новое измерение');
      const id = uniqueId('STUDY', used, own(fields, 'id') ? fields.id : undefined);
      const row = normalizeStudyRow({ ...fields, id });
      used.add(id);
      ids.push(id);
      project.studyRows.push(row);
    }
    // normalizeProject also rejects duplicate participant/task codes across the
    // whole batch. Nothing is committed until every row and the full state pass.
    replaceProject(project);
    return ids;
  }

  const api = {
    getState: () => state,
    getProject,
    get storageStatus() { return storageStatus; },
    get storageMessage() { return storageMessage; },
    subscribe(listener) {
      if (typeof listener !== 'function') fail('Подписчик должен быть функцией.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    createProject(fields) {
      object(fields, 'Новый проект');
      const id = uniqueId('PROJECT', new Set(state.projects.map(project => project.id)));
      const project = {
        id, name: own(fields, 'name') ? fields.name : undefined,
        description: own(fields, 'description') ? fields.description : '',
        dataKind: 'personal', records: [], links: [], studyRows: [],
      };
      if (own(fields, 'educationalOrigin')) project.educationalOrigin = fields.educationalOrigin;
      return appendProject(normalizeProject(project));
    },
    selectProject(id) {
      identifier(id, 'Проект');
      if (!state.projects.some(project => project.id === id)) fail('Проект не найден.');
      if (state.activeProjectId !== id) commit({ ...state, activeProjectId: id });
    },
    setNodePosition(id, position) {
      identifier(id, 'Узел графа');
      const project = copy(getProject());
      if (!project.records.some(record => record.id === id)) fail('Узел графа не найден.');
      const normalized = normalizeNodePosition(position);
      const previous = project.nodePositions?.[id];
      if (previous?.x === normalized.x && previous?.y === normalized.y) return;
      // Layout changes are safe for the synthetic example: authored evidence is untouched.
      project.nodePositions = { ...project.nodePositions, [id]: normalized };
      replaceProject(project);
    },
    resetNodePositions() {
      const project = copy(getProject());
      if (!own(project, 'nodePositions')) return;
      delete project.nodePositions;
      replaceProject(project);
    },
    hideRecord(id) {
      identifier(id, 'Запись');
      const project = mutableProject();
      if (!project.records.some(record => record.id === id)) fail('Запись не найдена.');
      if (project.hiddenRecordIds?.includes(id)) return;
      project.hiddenRecordIds = [...(project.hiddenRecordIds || []), id];
      replaceProject(project);
    },
    restoreRecord(id) {
      identifier(id, 'Запись');
      const project = mutableProject();
      if (!project.records.some(record => record.id === id)) fail('Запись не найдена.');
      if (!project.hiddenRecordIds?.includes(id)) return;
      project.hiddenRecordIds = project.hiddenRecordIds.filter(hidden => hidden !== id);
      replaceProject(project);
    },
    addRecord(fields) {
      object(fields, 'Новая запись');
      const project = mutableProject();
      if (project.records.length >= LIMITS.records) fail(`В проекте может быть не больше ${LIMITS.records} записей.`);
      const id = uniqueId('RECORD', projectItemIds(project), own(fields, 'id') ? fields.id : undefined);
      const recordedAt = timestamp(now());
      const record = normalizeRecordContent({
        ...fields, id, createdAt: own(fields, 'createdAt') ? fields.createdAt : recordedAt,
        originalAuthorLabel: own(fields, 'author') ? fields.author : '', authorProvenance: 'local-unverified',
      }, { requireDecisionWhy: true });
      if (own(fields, 'recordHistory')) fail('Историю версий можно перенести через импорт JSON, но нельзя задать при создании записи.');
      record.recordHistory = recordHistory(record, recordedAt, 'manual-create');
      project.records.push(record);
      replaceProject(project);
      return id;
    },
    updateRecord(id, fields) {
      identifier(id, 'Запись');
      object(fields, 'Изменения записи');
      if (own(fields, 'id') && fields.id !== id) fail('Идентификатор существующей записи нельзя изменить.');
      for (const key of ['recordHistory', 'originalAuthorLabel', 'authorProvenance', 'annotationHistory', 'nativeRef']) {
        if (own(fields, key)) fail('Исходное авторство, происхождение и сохранённую историю нельзя перезаписать при редактировании записи.');
      }
      const project = mutableProject();
      const index = project.records.findIndex(record => record.id === id);
      if (index === -1) fail('Запись не найдена.');
      const base = project.records[index];
      const proposed = normalizeRecordContent({
        ...base, ...fields, id,
        authorProvenance: own(fields, 'author') && fields.author !== base.author ? 'local-unverified' : base.authorProvenance,
      }, { requireDecisionWhy: true });
      if (JSON.stringify(proposed) === JSON.stringify(normalizeRecordContent(base))) return;
      const recordedAt = timestamp(now());
      let nextState = state;
      let expectedStoredValue = persistedValue;
      if (storage && canWriteStorage) {
        try {
          const raw = storage.getItem(STORAGE_KEY);
          if (raw !== persistedValue) {
            if (typeof raw !== 'string' || raw.length > LIMITS.stateCharacters) fail('Некорректное обновление другой вкладки.');
            nextState = normalizeState(JSON.parse(raw));
            expectedStoredValue = raw;
          }
        } catch {
          canWriteStorage = false;
          memory('Не удалось проверить копию другой вкладки. Изменения сохраняются в памяти; выгрузите JSON перед закрытием.');
        }
      }
      if (!preservesRecordHistory(state, nextState, project.id, id)) {
        canWriteStorage = false;
        memory('В другой вкладке обнаружена неполная история. Её копия не изменена; ваши записи сохранены в памяти. Выгрузите JSON перед закрытием.');
        nextState = state;
      }
      const incomingProject = nextState.projects.find(item => item.id === project.id);
      const incoming = incomingProject?.records.find(item => item.id === id);
      // A removed project/record must not cause a stale tab to recreate it or
      // overwrite newer data. Its proposed edit stays in this tab's export.
      if (!incoming) {
        canWriteStorage = false;
        memory('В другой вкладке нет этой записи. Её текущая копия не изменена; ваша правка сохранена в памяти. Выгрузите JSON перед закрытием.');
        nextState = state;
      }
      const current = incoming || base;
      const baseHistory = recordHistory(base, recordedAt, base.nativeRef ? 'imported-snapshot' : 'legacy-snapshot');
      const currentHistory = recordHistory(current, recordedAt, current.nativeRef ? 'imported-snapshot' : 'legacy-snapshot');
      // Identical legacy snapshots can have different observed-at times in two
      // tabs. Reuse the persisted root rather than fabricate an edit conflict.
      if (!base.recordHistory && JSON.stringify(baseHistory.versions[0].snapshot) === JSON.stringify(currentHistory.versions[0].snapshot)) {
        baseHistory.versions[0] = copy(currentHistory.versions[0]);
      }
      const versions = [...baseHistory.versions];
      for (const version of currentHistory.versions) {
        const existing = versions.find(item => item.id === version.id);
        if (existing && JSON.stringify(existing) !== JSON.stringify(version)) fail('Конфликт идентификаторов истории: сохранённые версии различаются. Выгрузите обе копии JSON.');
        if (!existing) versions.push(version);
      }
      const conflict = JSON.stringify(normalizeRecordContent(current)) !== JSON.stringify(normalizeRecordContent(base));
      const versionId = uniqueId('VERSION', new Set(versions.map(version => version.id)));
      versions.push({
        id: versionId, previousVersionId: conflict ? baseHistory.currentVersionId : currentHistory.currentVersionId,
        recordedAt, provenance: 'local-unverified', sourceMethod: conflict ? 'conflict-edit' : 'manual-edit', snapshot: proposed,
      });
      const conflicts = new Set([...baseHistory.conflictVersionIds, ...currentHistory.conflictVersionIds]);
      if (conflict) conflicts.add(versionId);
      const currentVersionId = conflict ? currentHistory.currentVersionId : versionId;
      conflicts.delete(currentVersionId);
      const updated = {
        ...(conflict ? normalizeRecordContent(current) : proposed),
        recordHistory: { schemaVersion: 1, currentVersionId, versions, conflictVersionIds: [...conflicts] },
      };
      const target = copy(incoming ? incomingProject : project);
      target.records[target.records.findIndex(record => record.id === id)] = updated;
      commit({ ...nextState, activeProjectId: project.id, projects: nextState.projects.map(item => item.id === project.id ? target : item) }, expectedStoredValue);
      if (conflict) {
        const error = new Error('Запись изменена в другой вкладке. Обе версии сохранены в истории; текущая запись не заменена. Сравните версии перед новой правкой.');
        error.code = 'RECORD_VERSION_CONFLICT';
        error.recordId = id;
        error.versionId = versionId;
        throw error;
      }
    },
    addLink(fields) {
      object(fields, 'Новая связь');
      const project = mutableProject();
      if (project.links.length >= LIMITS.links) fail(`В проекте может быть не больше ${LIMITS.links} связей.`);
      const id = uniqueId('LINK', projectItemIds(project), own(fields, 'id') ? fields.id : undefined);
      const link = normalizeLink({ ...fields, id });
      if (project.links.some(existing => existing.from === link.from && existing.to === link.to && (existing.relationType || '') === (link.relationType || ''))) {
        fail('Связь этого типа между этими записями уже существует.');
      }
      project.links.push(link);
      replaceProject(project);
      return id;
    },
    removeLink(id) {
      identifier(id, 'Связь');
      const project = mutableProject();
      if (!project.links.some(link => link.id === id)) fail('Связь не найдена.');
      project.links = project.links.filter(link => link.id !== id);
      replaceProject(project);
    },
    addStudyRow(fields) {
      return addStudyRows([fields])[0];
    },
    addStudyRows,
    importProject(jsonText) {
      const input = object(parseJson(jsonText, 'Импорт'), 'Импорт');
      if (own(input, 'schemaVersion') && input.schemaVersion !== 1) fail('Версия JSON не поддерживается. Нужна schemaVersion: 1.');
      const candidate = own(input, 'project') ? input.project : input;
      const imported = own(input, 'manifest') && input.manifest?.product === 'TraceLab' ? nativeProject(input) : normalizeProject(candidate);
      // Always add a new project; importing never replaces existing personal data.
      imported.id = uniqueId('PROJECT', new Set(state.projects.map(project => project.id)));
      return appendProject(imported);
    },
    exportProject() {
      return JSON.stringify({ schemaVersion: 1, project: getProject() }, null, 2);
    },
    resetDemo() {
      const personal = state.projects.filter(project => project.id !== DEMO_ID);
      const nextProjects = [demoProject(), ...personal];
      if (nextProjects.length > LIMITS.projects) fail('Нет места для учебного примера: достигнут лимит проектов. Личные проекты сохранены.');
      commit({ schemaVersion: 1, activeProjectId: DEMO_ID, projects: nextProjects });
    },
  };

  eventTarget?.addEventListener?.('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (storage && event.storageArea && event.storageArea !== storage) return;
    // A failed local write must not be silently overwritten by another tab.
    if (!canWriteStorage) return;
    if (event.newValue === null) {
      canWriteStorage = false;
      memory('Копия в браузере была удалена в другой вкладке. Ваши данные остались здесь; выгрузите JSON перед закрытием.');
      notify();
      return;
    }
    try {
      if (typeof event.newValue !== 'string' || event.newValue.length > LIMITS.stateCharacters) fail('Некорректное обновление.');
      const next = freeze(normalizeState(JSON.parse(event.newValue)));
      const nextIds = new Set(next.projects.map(project => project.id));
      if (state.projects.some(project => project.dataKind === 'personal' && !nextIds.has(project.id)) || !preservesRecordHistory(state, next)) {
        canWriteStorage = false;
        memory('В другой вкладке обнаружена более ранняя копия или потеря истории версий. Личные проекты сохранены в памяти этой вкладки; выгрузите JSON.');
      } else {
        state = next;
        persistedValue = event.newValue;
        persistent();
      }
      notify();
    } catch {
      canWriteStorage = false;
      memory('Другая вкладка передала некорректные данные. Текущая копия сохранена в памяти; выгрузите JSON.');
      notify();
    }
  });

  return Object.freeze(api);
}

export const store = createWorkspaceStore();
export default store;
