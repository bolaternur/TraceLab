/* Iznera workspace views. Imported text is always rendered with textContent. */
const NS = 'http://www.w3.org/2000/svg';
import { t, recordType, getWorkspaceLocale, formatDate, formatNumber, formatPercent, formatDayKey, formatDayLabel } from './workspace-i18n.js';
let graphSerial = 0;
const graphViewports = new Map();
const noop = () => {};


function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function recordsOf(project) { return Array.isArray(project?.records) ? project.records : []; }
function linksOf(project) {
  const ids = new Set(recordsOf(project).map(record => record.id));
  return (Array.isArray(project?.links) ? project.links : [])
    .filter(link => link.status !== 'rejected' && ids.has(link.from) && ids.has(link.to));
}
function matches(record, query = '', kind = 'all') {
  const needle = String(query || '').trim().toLocaleLowerCase(getWorkspaceLocale());
  return (!kind || kind === 'all' || record.kind === kind) && (!needle ||
    [record.title, record.body, record.rationale, record.id, record.author].some(value => String(value || '').toLocaleLowerCase(getWorkspaceLocale()).includes(needle)));
}
function sorted(records, order = 'oldest') {
  return [...records].sort((a, b) => {
    const left = Date.parse(a.createdAt); const right = Date.parse(b.createdAt);
    if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : String(a.id).localeCompare(String(b.id));
    if (!Number.isFinite(right)) return -1;
    return (order === 'newest' ? right - left : left - right) || String(a.id).localeCompare(String(b.id));
  });
}
function empty(container, title, body) {
  container.replaceChildren();
  const block = el('div', 'wv-empty');
  block.append(el('h3', '', title), el('p', '', body));
  container.append(block);
  return noop;
}
function button(label, className, handler) {
  const node = el('button', className, label); node.type = 'button';
  if (handler) node.addEventListener('click', handler);
  return node;
}
function disclosureTable(headers, rows, caption, label = t('common.table')) {
  const details = el('details', 'wv-table-disclosure');
  details.append(el('summary', '', label));
  const scroller = el('div', 'wv-table-scroll');
  const table = el('table', 'wv-table');
  table.append(el('caption', '', caption));
  const head = el('thead'); const headRow = el('tr');
  headers.forEach(header => { const cell = el('th', '', header); cell.scope = 'col'; headRow.append(cell); });
  head.append(headRow); table.append(head);
  const body = el('tbody');
  rows.forEach(row => {
    const tr = el('tr');
    row.forEach((value, index) => { const cell = el(index === 0 ? 'th' : 'td', '', value); if (!index) cell.scope = 'row'; tr.append(cell); });
    body.append(tr);
  });
  table.append(body); scroller.append(table); details.append(scroller);
  return details;
}
function shortLines(value, width = 24, maxLines = 2) {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  const lines = []; let line = '';
  words.forEach(word => {
    if ((line + ' ' + word).trim().length > width && line) { lines.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  });
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines).map(item => item.length > width ? item.slice(0, width - 1) + '…' : item);
  if (lines.length > maxLines) visible[maxLines - 1] = visible[maxLines - 1].slice(0, width - 1) + '…';
  return visible.length ? visible : [t('common.untitled')];
}

/* The longest established path forms a readable two-row chain; other records
   occupy the remaining slots. The algorithm also handles cycles and orphans. */
function graphOrder(records, links) {
  const byId = new Map(records.map(record => [record.id, record]));
  const next = new Map(records.map(record => [record.id, []]));
  const incoming = new Map(records.map(record => [record.id, 0]));
  links.filter(link => link.status !== 'suggested').forEach(link => {
    next.get(link.from).push(link.to); incoming.set(link.to, incoming.get(link.to) + 1);
  });
  const memo = new Map();
  function path(id, visited = new Set()) {
    if (visited.has(id)) return [];
    if (memo.has(id)) return memo.get(id);
    const trail = new Set(visited); trail.add(id);
    let tail = [];
    for (const target of next.get(id) || []) { const candidate = path(target, trail); if (candidate.length > tail.length) tail = candidate; }
    const result = [id, ...tail]; memo.set(id, result); return result;
  }
  const roots = records.filter(record => incoming.get(record.id) === 0);
  let spine = [];
  for (const record of roots.length ? roots : records) { const candidate = path(record.id); if (candidate.length > spine.length) spine = candidate; }
  const unique = [...new Set(spine)].filter(id => byId.has(id));
  const rest = sorted(records).filter(record => !unique.includes(record.id));
  return [...unique.map(id => byId.get(id)), ...rest];
}

export function renderGraph(container, project, { selectedId = null, query = '', kind = 'all', onSelect = noop } = {}) {
  const all = recordsOf(project);
  const visible = all.filter(record => matches(record, query, kind));
  if (!visible.length) return empty(container, all.length ? t('graph.noMatches') : t('graph.emptyTitle'),
    all.length ? t('graph.changeFilters') : t('graph.emptyText'));
  container.replaceChildren();
  const ids = new Set(visible.map(record => record.id));
  const links = linksOf(project).filter(link => ids.has(link.from) && ids.has(link.to));
  if (!ids.has(selectedId)) selectedId = null;
  const neighbors = new Set([selectedId]);
  links.forEach(link => { if (link.from === selectedId) neighbors.add(link.to); if (link.to === selectedId) neighbors.add(link.from); });
  const ordered = graphOrder(visible, links);
  const columns = Math.min(4, Math.max(1, ordered.length));
  const gapX = 52, gapY = 92, nodeWidth = 196, nodeHeight = 110, pad = 34;
  const width = pad * 2 + columns * nodeWidth + (columns - 1) * gapX;
  const rows = Math.ceil(ordered.length / columns);
  const height = Math.max(380, pad * 2 + rows * nodeHeight + (rows - 1) * gapY);
  const positions = new Map();
  ordered.forEach((record, index) => {
    const row = Math.floor(index / columns); const col = row % 2 ? columns - 1 - index % columns : index % columns;
    positions.set(record.id, { x: pad + col * (nodeWidth + gapX), y: pad + row * (nodeHeight + gapY), row, col });
  });
  const wrap = el('div', 'wv-graph');
  const viewportKey = `${project?.id || 'project'}|${kind}|${query}`;
  const previousViewport = graphViewports.get(viewportKey);
  const toolbar = el('div', 'wv-graph-toolbar');
  const legend = el('div', 'wv-graph-legend');
  legend.append(el('span', 'wv-established-key', t('relation.accepted')));
  if (links.some(link => link.status === 'suggested')) legend.append(el('span', 'wv-suggested-key', t('relation.suggested')));
  toolbar.append(legend);
  const controls = el('div', 'wv-zoom-controls');
  const zoomStatus = el('span', 'wv-zoom-status'); zoomStatus.setAttribute('aria-live', 'polite');
  const scroller = el('div', 'wv-graph-scroll'); scroller.tabIndex = 0;
  scroller.setAttribute('aria-label', t('graph.region'));
  const diagram = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'wv-graph-svg', role: 'group', 'aria-label': t('graph.counts', { records: visible.length, links: links.length }) });
  diagram.append(svg('title', {}, t('graph.title', { name: project?.name || t('common.untitled') })));
  const graphId = ++graphSerial;
  const defs = svg('defs');
  for (const mode of ['accepted', 'suggested', 'active']) {
    const marker = svg('marker', { id: `wv-arrow-${graphId}-${mode}`, viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    marker.append(svg('path', { d: 'M 1 1 L 7 4 L 1 7', class: `wv-arrow wv-arrow-${mode}` })); defs.append(marker);
  }
  diagram.append(defs);
  for (const link of links) {
    const a = positions.get(link.from); const b = positions.get(link.to);
    const suggested = link.status === 'suggested'; const active = selectedId && (link.from === selectedId || link.to === selectedId);
    let pathData, lx, ly;
    if (a.row === b.row) {
      const forward = b.x > a.x;
      const x1 = a.x + (forward ? nodeWidth : 0); const x2 = b.x + (forward ? 0 : nodeWidth);
      const y1 = a.y + nodeHeight / 2; const y2 = b.y + nodeHeight / 2;
      if (Math.abs(a.col - b.col) === 1) { pathData = `M ${x1} ${y1} L ${x2} ${y2}`; lx = (x1 + x2) / 2; ly = y1 - 10; }
      else { const routeY = Math.max(12, a.y - 18); pathData = `M ${a.x + nodeWidth / 2} ${a.y} V ${routeY} H ${b.x + nodeWidth / 2} V ${b.y}`; lx = (a.x + b.x + nodeWidth) / 2; ly = routeY - 5; }
    } else {
      const down = b.y > a.y; const x1 = a.x + nodeWidth / 2; const x2 = b.x + nodeWidth / 2;
      const y1 = a.y + (down ? nodeHeight : 0); const y2 = b.y + (down ? 0 : nodeHeight);
      const routeY = (y1 + y2) / 2;
      pathData = `M ${x1} ${y1} V ${routeY} H ${x2} V ${y2}`; lx = (x1 + x2) / 2; ly = routeY - 8;
    }
    const edge = svg('g', { class: `wv-edge${suggested ? ' is-suggested' : ''}${active ? ' is-active' : ''}${selectedId && !active ? ' is-muted' : ''}` });
    edge.append(svg('title', {}, `${link.from} → ${link.to}: ${link.label || t('relation.generic')}${suggested ? `. ${t('relation.suggested')}` : ''}`));
    edge.append(svg('path', { d: pathData, 'marker-end': `url(#wv-arrow-${graphId}-${active ? 'active' : suggested ? 'suggested' : 'accepted'})` }));
    /* Short horizontal gaps carry arrows only. Full relation labels remain in
       the textual connection list, rather than overlapping node titles. */
    if (a.row !== b.row || Math.abs(a.col - b.col) > 1) {
      const label = String(link.label || t('relation.generic'));
      edge.append(svg('text', { x: lx, y: ly, 'text-anchor': 'middle', class: 'wv-edge-label' }, label.length > 34 ? label.slice(0, 33) + '…' : label));
    }
    diagram.append(edge);
  }
  ordered.forEach(record => {
    const { x, y } = positions.get(record.id);
    const node = svg('g', { transform: `translate(${x} ${y})`, class: `wv-node wv-node-${record.kind}${record.id === selectedId ? ' is-selected' : ''}${neighbors.has(record.id) && record.id !== selectedId ? ' is-neighbor' : ''}${selectedId && !neighbors.has(record.id) ? ' is-muted' : ''}`, tabindex: 0, role: 'button', 'aria-pressed': String(record.id === selectedId), 'aria-label': `${record.id}. ${recordType(record.kind)}. ${record.title}` });
    node.append(svg('title', {}, `${record.id} · ${record.title}`));
    node.append(svg('rect', { width: nodeWidth, height: nodeHeight, rx: 12, class: 'wv-node-bg' }));
    const visibleId = String(record.id).length > 17 ? String(record.id).slice(0, 14) + '…' : String(record.id);
    const idText = svg('text', { x: 15, y: 25, class: 'wv-node-id' }, visibleId);
    idText.append(svg('title', {}, String(record.id)));
    node.append(idText);
    node.append(svg('text', { x: nodeWidth - 15, y: 25, class: 'wv-node-kind', 'text-anchor': 'end' }, recordType(record.kind)));
    const title = svg('text', { x: 15, y: 53, class: 'wv-node-title' });
    shortLines(record.title, 20).forEach((line, index) => title.append(svg('tspan', { x: 15, dy: index ? 18 : 0 }, line)));
    node.append(title);
    const extra = record.kind === 'test' && Number(record.trials) > 0 ? `${formatNumber(record.successes)} / ${formatNumber(record.trials)} ${record.unit || t('tests.attempts')}` : record.revision || record.sourceType || '';
    if (extra) node.append(svg('text', { x: 15, y: 95, class: 'wv-node-detail' }, String(extra).slice(0, 28)));
    node.addEventListener('click', () => onSelect(record.id));
    node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(record.id); } });
    diagram.append(node);
  });
  let zoom = previousViewport?.zoom || 1;
  function rememberViewport() {
    graphViewports.set(viewportKey, { zoom, left: scroller.scrollLeft, top: scroller.scrollTop });
    if (graphViewports.size > 40) graphViewports.delete(graphViewports.keys().next().value);
  }
  function setZoom(value, center = true) {
    const previousWidth = diagram.getBoundingClientRect().width || width;
    const relativeCenter = (scroller.scrollLeft + scroller.clientWidth / 2) / previousWidth;
    zoom = Math.max(0.8, Math.min(1.8, value));
    diagram.style.width = `${Math.round(width * zoom)}px`;
    diagram.style.height = `${Math.round(height * zoom)}px`;
    diagram.style.setProperty('--wv-label-scale', String(1 / Math.min(1, zoom)));
    zoomStatus.textContent = formatPercent(zoom);
    zoomOut.disabled = zoom <= 0.801; zoomIn.disabled = zoom >= 1.799;
    if (center) scroller.scrollLeft = Math.max(0, relativeCenter * width * zoom - scroller.clientWidth / 2);
    rememberViewport();
  }
  const zoomOut = button('', 'wv-zoom-button', () => setZoom(zoom - 0.2)); zoomOut.setAttribute('aria-label', t('common.zoomOut'));
  const zoomIn = button('', 'wv-zoom-button', () => setZoom(zoom + 0.2)); zoomIn.setAttribute('aria-label', t('common.zoomIn'));
  for (const [control, plus] of [[zoomOut, false], [zoomIn, true]]) {
    const icon = svg('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true', class: 'wv-zoom-icon' });
    icon.append(svg('line', { x1: 4, y1: 10, x2: 16, y2: 10 }));
    if (plus) icon.append(svg('line', { x1: 10, y1: 4, x2: 10, y2: 16 }));
    control.append(icon);
  }
  const fit = button(t('common.fit'), 'wv-fit-button', () => { setZoom(Math.min(1, scroller.clientWidth / width), false); scroller.scrollLeft = 0; scroller.scrollTop = 0; rememberViewport(); });
  controls.append(zoomOut, zoomStatus, zoomIn, fit); toolbar.append(controls);
  scroller.append(diagram); wrap.append(toolbar, scroller);
  wrap.append(el('p', 'wv-graph-help', t('graph.help')));
  const list = el('details', 'wv-graph-list');
  list.append(el('summary', '', t('graph.listCount', { count: visible.length })));
  const listBody = el('div', 'wv-graph-list-body');
  ordered.forEach(record => {
    const row = el('div', `wv-graph-list-row${record.id === selectedId ? ' is-selected' : ''}`);
    const select = button('', 'wv-record-button', () => onSelect(record.id));
    select.setAttribute('aria-pressed', String(record.id === selectedId));
    select.append(el('span', 'wv-record-id', record.id), el('span', '', record.title)); row.append(select);
    const outgoing = links.filter(link => link.from === record.id);
    outgoing.forEach(link => { const relation = el('p', 'wv-relation'); relation.append(el('span', '', `→ ${link.to} · ${link.label || t('relation.generic')}`)); if (link.status === 'suggested') relation.append(el('span', 'wv-unconfirmed', t('relation.suggested'))); row.append(relation); });
    if (!outgoing.length) row.append(el('p', 'wv-relation', t('relation.noneOutgoing')));
    listBody.append(row);
  });
  list.append(listBody);
  const mobileQuery = typeof matchMedia === 'function' ? matchMedia('(max-width: 700px)') : null;
  if (mobileQuery?.matches) list.open = true;
  const updateMobileList = event => { if (event.matches) list.open = true; };
  mobileQuery?.addEventListener('change', updateMobileList);
  wrap.append(list); container.append(wrap);
  setZoom(zoom, false);
  if (previousViewport) { scroller.scrollLeft = previousViewport.left; scroller.scrollTop = previousViewport.top; }
  scroller.addEventListener('scroll', rememberViewport, { passive: true });
  rememberViewport();
  return () => { rememberViewport(); scroller.removeEventListener('scroll', rememberViewport); mobileQuery?.removeEventListener('change', updateMobileList); };
}

export function renderTestChart(container, project, { onSelect = noop } = {}) {
  const allTests = sorted(recordsOf(project).filter(record => record.kind === 'test'));
  const tests = allTests.filter(record => record.successes !== null && record.successes !== '' && Number.isInteger(Number(record.trials)) && Number(record.trials) > 0 && Number.isInteger(Number(record.successes)) && Number(record.successes) >= 0 && Number(record.successes) <= Number(record.trials));
  const countedIds = new Set(tests.map(record => record.id));
  const measuredTests = allTests.filter(record => !countedIds.has(record.id) && record.measuredValue !== null && record.measuredValue !== undefined && record.measuredValue !== '' && Number.isFinite(Number(record.measuredValue)));
  if (!allTests.length) return empty(container, t('tests.emptyTitle'), t('tests.emptyText'));
  container.replaceChildren();
  const chart = el('div', 'wv-test-chart');
  chart.append(el('p', 'wv-chart-note', (project?.dataKind === 'synthetic' || project?.educationalOrigin) ? t('tests.educational') : t('tests.context')));
  const ticks = el('div', 'wv-bar-ticks'); ticks.setAttribute('aria-hidden', 'true');
  [0, 25, 50, 75, 100].forEach(value => ticks.append(el('span', '', formatPercent(value / 100)))); if (tests.length) chart.append(ticks);
  tests.forEach(record => {
    const percent = Number(record.successes) / Number(record.trials) * 100;
    const row = button('', 'wv-test-row', () => onSelect(record.id));
    row.setAttribute('aria-label', t('tests.open', { title: record.title, successes: record.successes, trials: record.trials }));
    const head = el('span', 'wv-test-row-head');
    const title = el('span', 'wv-test-title'); title.append(el('span', 'wv-record-id', record.id), el('span', '', record.title));
    head.append(title, el('strong', 'wv-test-value', t('tests.ratio', { successes: record.successes, trials: record.trials }))); row.append(head);
    const track = el('span', 'wv-test-track'); track.setAttribute('aria-hidden', 'true');
    const fill = el('span', 'wv-test-fill'); fill.style.width = `${percent}%`; track.append(fill); row.append(track);
    const foot = el('span', 'wv-test-row-foot');
    foot.append(el('span', '', t('tests.successRatio', { percent: formatPercent(percent / 100) })), el('span', '', t('tests.unit', { unit: record.unit || t('tests.attempt') })));
    row.append(foot);
    if (record.conditions) row.append(el('span', 'wv-test-context', t('tests.conditions', { conditions: record.conditions })));
    if (record.criterion) row.append(el('span', 'wv-test-context', t('tests.criterion', { criterion: record.criterion })));
    chart.append(row);
  });
  if (tests.length) chart.append(disclosureTable([t('record.test'), t('tests.successHeader'), t('tests.ratioHeader'), t('tests.unitHeader'), t('tests.contextHeader')], tests.map(record => [
    `${record.id} · ${record.title}`, t('tests.ratio', { successes: record.successes, trials: record.trials }), formatPercent(Number(record.successes) / Number(record.trials)), record.unit || t('tests.attempt'), [record.conditions, record.criterion].filter(Boolean).join(' · ') || t('common.unavailable'),
  ]), t('tests.tableCaption')));
  if (measuredTests.length) {
    const measurementScroll = el('div', 'wv-table-scroll wv-measurement-scroll');
    const measurementTable = el('table', 'wv-table wv-measurement-table');
    measurementTable.append(el('caption', '', t('tests.measurementsCaption')));
    const head = el('thead'); const headRow = el('tr');
    [t('record.test'), t('tests.valueHeader'), t('tests.unitHeader'), t('tests.conditionsHeader'), t('tests.criterionHeader')].forEach(label => { const cell = el('th', '', label); cell.scope = 'col'; headRow.append(cell); });
    head.append(headRow); measurementTable.append(head);
    const body = el('tbody');
    measuredTests.forEach(record => {
      const row = el('tr'); const identity = el('th'); identity.scope = 'row';
      const select = button('', 'wv-measurement-select', () => onSelect(record.id));
      select.append(el('span', 'wv-record-id', record.id), el('span', '', record.title)); identity.append(select); row.append(identity);
      [formatNumber(record.measuredValue, { maximumFractionDigits: 12 }), record.unit || t('common.unavailable'), record.conditions || t('common.unavailable'), record.criterion || t('common.unavailable')].forEach(value => row.append(el('td', '', value)));
      body.append(row);
    });
    measurementTable.append(body); measurementScroll.append(measurementTable); chart.append(measurementScroll);
  }
  const measuredIds = new Set([...tests, ...measuredTests].map(record => record.id));
  const qualitative = allTests.filter(record => !measuredIds.has(record.id));
  if (qualitative.length) {
    chart.append(el('h3', '', t('tests.qualitativeTitle')));
    for (const record of qualitative) {
      const row = button('', 'wv-test-row', () => onSelect(record.id));
      row.append(el('strong', 'wv-test-title', record.title), el('span', 'wv-test-context', record.body || t('tests.qualitativeEmpty')));
      if (record.conditions) row.append(el('span', 'wv-test-context', t('tests.conditions', { conditions: record.conditions })));
      if (record.criterion) row.append(el('span', 'wv-test-context', t('tests.criterion', { criterion: record.criterion })));
      chart.append(row);
    }
  }
  container.append(chart); return noop;
}

function niceMaximum(value) {
  if (value <= 0) return 60;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const raw = value / magnitude;
  return (raw <= 1 ? 1 : raw <= 2 ? 2 : raw <= 5 ? 5 : 10) * magnitude;
}
export function renderStudyChart(container, project) {
  const raw = Array.isArray(project?.studyRows) ? project.studyRows : [];
  const rows = raw.filter(row => row.baselineSeconds !== null && row.baselineSeconds !== '' && row.traceSeconds !== null && row.traceSeconds !== '' && Number.isFinite(Number(row.baselineSeconds)) && Number(row.baselineSeconds) >= 0 && Number.isFinite(Number(row.traceSeconds)) && Number(row.traceSeconds) >= 0);
  if (!rows.length) return empty(container, t('study.emptyTitle'), t('study.emptyText'));
  container.replaceChildren();
  const chart = el('div', 'wv-study-chart');
  chart.append(el('p', 'wv-chart-note', (project?.dataKind === 'synthetic' || project?.educationalOrigin) ? t('study.educational') : t('study.context')));
  const legend = el('div', 'wv-study-legend'); legend.append(el('span', 'wv-baseline-key', t('study.baseline')), el('span', 'wv-trace-key', t('study.trace'))); chart.append(legend);
  const plot = el('div', 'wv-study-scroll');
  const left = 100, right = 42, top = 32, rowHeight = 51, bottom = 54, width = 750;
  const height = top + rows.length * rowHeight + bottom;
  const maximum = niceMaximum(Math.max(...rows.flatMap(row => [Number(row.baselineSeconds), Number(row.traceSeconds)])) * 1.05);
  const x = value => left + Number(value) / maximum * (width - left - right);
  const diagram = svg('svg', { class: 'wv-study-svg', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': t('study.chartLabel', { count: rows.length }) });
  diagram.append(svg('title', {}, t('study.chartTitle')));
  for (let index = 0; index <= 4; index++) {
    const value = maximum * index / 4; const position = x(value);
    diagram.append(svg('line', { x1: position, x2: position, y1: top - 10, y2: height - bottom + 5, class: 'wv-chart-grid' }));
    diagram.append(svg('text', { x: position, y: height - bottom + 25, 'text-anchor': 'middle', class: 'wv-chart-axis' }, formatNumber(value)));
  }
  rows.forEach((row, index) => {
    const y = top + index * rowHeight + rowHeight / 2;
    diagram.append(svg('text', { x: left - 14, y: y + 4, 'text-anchor': 'end', class: 'wv-chart-participant' }, String(row.participantCode || row.id || t('study.participant', { count: index + 1 })).slice(0, 16)));
    const pair = svg('g'); pair.append(svg('title', {}, t('study.pair', { code: row.participantCode || row.id, baseline: Number(row.baselineSeconds), trace: Number(row.traceSeconds) })));
    pair.append(svg('line', { x1: x(row.baselineSeconds), x2: x(row.traceSeconds), y1: y, y2: y, class: 'wv-study-pair' }));
    pair.append(svg('circle', { cx: x(row.baselineSeconds), cy: y, r: 5, class: 'wv-baseline-dot' }));
    pair.append(svg('circle', { cx: x(row.traceSeconds), cy: y, r: 5, class: 'wv-trace-dot' }));
    diagram.append(pair);
  });
  diagram.append(svg('text', { x: (left + width - right) / 2, y: height - 7, 'text-anchor': 'middle', class: 'wv-chart-axis' }, t('study.axis')));
  plot.append(diagram); chart.append(plot);
  const table = disclosureTable([t('study.participantHeader'), t('study.baselineHeader'), t('study.traceHeader'), t('study.differenceHeader')], rows.map(row => [row.participantCode || row.id, formatNumber(Number(row.baselineSeconds)), formatNumber(Number(row.traceSeconds)), formatNumber(Number(row.traceSeconds) - Number(row.baselineSeconds))]), t('study.tableCaption'));
  table.open = true; chart.append(table);
  if (rows.length !== raw.length) chart.append(el('p', 'wv-chart-note', t('study.skipped', { count: raw.length - rows.length })));
  container.append(chart); return noop;
}

export function timelineGroups(records, { order = 'newest', now = new Date() } = {}) {
  const groups = new Map();
  for (const record of sorted(records, order)) {
    const key = formatDayKey(record.createdAt);
    if (!groups.has(key)) groups.set(key, { key, label: formatDayLabel(record.createdAt, now), records: [] });
    groups.get(key).records.push(record);
  }
  return [...groups.values()];
}

export function renderTimeline(container, project, { selectedId = null, query = '', kind = 'all', onSelect = noop, order = 'newest', now = new Date() } = {}) {
  const all = recordsOf(project); const records = all.filter(record => matches(record, query, kind));
  if (!records.length) return empty(container, all.length ? t('timeline.noMatches') : t('timeline.emptyTitle'), all.length ? t('graph.changeFilters') : t('timeline.emptyText'));
  container.replaceChildren();
  for (const group of timelineGroups(records, { order, now })) {
    const section = el('section', 'wv-timeline-group');
    section.dataset.day = group.key;
    section.append(el('h3', 'wv-timeline-group-title', group.label));
    const timeline = el('ol', 'wv-timeline');
    group.records.forEach(record => {
    const item = el('li', `wv-timeline-item${record.id === selectedId ? ' is-selected' : ''}`);
    const select = button('', 'wv-timeline-button', () => onSelect(record.id)); select.setAttribute('aria-pressed', String(record.id === selectedId));select.dataset.recordId=record.id;
    const time = el('time', 'wv-timeline-date', formatDate(record.createdAt));
    if (!Number.isNaN(Date.parse(record.createdAt))) time.dateTime = record.createdAt;
    const main = el('span', 'wv-timeline-main');
    const meta = el('span', 'wv-timeline-meta');const identifier=el('span', 'wv-record-id', record.id.length>16?record.id.slice(0,8):record.id);identifier.title=record.id;meta.append(identifier, el('span', '', recordType(record.kind)));
    main.append(meta, el('strong', 'wv-timeline-title', record.title));
    if (record.body) main.append(el('span', 'wv-timeline-body', record.body));
    if (record.author) main.append(el('span', 'wv-timeline-author', record.author));
    select.append(time, main); item.append(select); timeline.append(item);
  });
    section.append(timeline); container.append(section);
  }
  return noop;
}
