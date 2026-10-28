/* TraceLab's local workbench: positions and camera are UI state, not evidence. */
const NS = 'http://www.w3.org/2000/svg';
import { t, recordType, getWorkspaceLocale, formatNumber, formatPercent } from './workspace-i18n.js';
const NODE_WIDTH = 250;
const NODE_HEIGHT = 156;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const cameras = new Map();
const sessionPositions = new Map();
const doubleClicks = new Map();
const sessionControls = new Map();
let instanceCounter = 0;
const noop = () => {};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finitePosition = value => Number.isFinite(value?.x) && Number.isFinite(value?.y);

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}
function vector(tag, attributes = {}, text = '') {
  const node = document.createElementNS(NS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (text !== '') node.textContent = text;
  return node;
}
function icon(name) {
  const svg = vector('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'wc-icon' });
  const paths = {
    plus: 'M5 12h14M12 5v14', minus: 'M5 12h14',
    fit: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5M9 9h6v6H9z',
    layout: 'M3 4h7v6H3zM14 4h7v6h-7zM3 14h7v6H3zM14 14h7v6h-7z',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
    unlock: 'M7 10V7a5 5 0 0 1 9-3M5 10h14v11H5zM12 14v3',
    map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16',
    list: 'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',
    help: 'M9.2 8.5a3 3 0 1 1 5.5 1.6c-1.2 1-2.7 1.5-2.7 3.4M12 17h.01',
    close: 'm6 6 12 12M18 6 6 18', trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
  };
  if (name === 'help') svg.append(vector('circle', { cx: 12, cy: 12, r: 10 }));
  svg.append(vector('path', { d: paths[name] || paths.arrow }));
  return svg;
}
function button(label, name, action, title = label) {
  const control = element('button', 'wc-button');
  control.type = 'button'; control.title = title; control.setAttribute('aria-label', title);
  if (name) control.append(icon(name));
  if (label) control.append(element('span', '', label));
  control.addEventListener('click', action);
  return control;
}
function matches(record, query, kind) {
  const text = String(query || '').trim().toLocaleLowerCase(getWorkspaceLocale());
  return (kind === 'all' || !kind || record.kind === kind) && (!text || [record.id, record.title, record.body, record.author, record.rationale].some(value => String(value || '').toLocaleLowerCase(getWorkspaceLocale()).includes(text)));
}
function defaultPositions(records) {
  const positions = {};
  const columns = { source: 0, iteration: 1, test: 2, decision: 3 };
  const counts = [0, 0, 0, 0];
  [...records].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id))).forEach(record => {
    const column = columns[record.kind] ?? 0;
    positions[record.id] = { x: column * 350, y: counts[column]++ * 230 };
  });
  return positions;
}
function readCamera(key) {
  if (cameras.has(key)) return { ...cameras.get(key) };
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (finitePosition(value) && Number.isFinite(value.zoom)) return { x: value.x, y: value.y, zoom: clamp(value.zoom, MIN_ZOOM, MAX_ZOOM) };
  } catch { /* A blocked or full storage does not disable the canvas. */ }
  return null;
}

/**
 * Render a movable, directed evidence canvas. Callbacks change project data;
 * the canvas never labels a relation or claims evidence on its own.
 */
export function renderCanvas(container, project, {
  selectedId = null, query = '', kind = 'all', onSelect = noop,
  onConnect = noop, onMove = noop, onRemoveLink = noop,
  onResetLayout, onError = noop,
} = {}) {
  const records = Array.isArray(project?.records) ? project.records : [];
  const visible = records.filter(record => matches(record, query, kind));
  const recordsById = new Map(records.map(record => [record.id, record]));
  const visibleIds = new Set(visible.map(record => record.id));
  const links = (Array.isArray(project?.links) ? project.links : []).filter(link => link.status !== 'rejected' && visibleIds.has(link.from) && visibleIds.has(link.to));
  const projectKey = String(project?.id || 'unassigned');
  const cameraKey = `tracelab:canvas-viewport:v1:${projectKey}`;
  const defaultLayout = defaultPositions(records);
  const priorPositions = sessionPositions.get(projectKey) || {};
  const positions = {};
  records.forEach(record => {
    const saved = project?.nodePositions?.[record.id];
    const fallback = priorPositions[record.id];
    positions[record.id] = { ...(finitePosition(saved) ? saved : finitePosition(fallback) ? fallback : defaultLayout[record.id]) };
  });
  let camera = readCamera(cameraKey) || { x: 0, y: 0, zoom: 1 };
  let hadCamera = Boolean(readCamera(cameraKey));
  let alive = true;
  const mobileMedia = typeof matchMedia === 'function' ? matchMedia('(max-width: 700px)') : null;
  let mobile = Boolean(mobileMedia?.matches);
  const previousControls = sessionControls.get(projectKey)?.[mobile ? 'mobile' : 'desktop'] || {};
  let locked = Boolean(previousControls.locked);
  let handMode = false;
  let pendingFrom = null;
  let gesture = null;
  let frame = 0;
  const pointers = new Map();
  const nodeElements = new Map();
  const edgeElements = new Map();
  const disposals = [];
  const instance = ++instanceCounter;
  const surface = element('div', 'wc-surface');
  surface.classList.toggle('is-locked', locked);
  surface.tabIndex = 0;
  surface.setAttribute('role', 'region');
  surface.setAttribute('aria-label', t('canvas.region'));
  const world = element('div', 'wc-world');
  const edgeLayer = vector('svg', { class: 'wc-edges', 'aria-label': t('canvas.connections') });
  const definitions = vector('defs');
  for (const [name, color] of [['accepted', '#899b83'], ['suggested', '#c9b493'], ['active', '#d3e6b7']]) {
    const marker = vector('marker', { id: `wc-arrow-${instance}-${name}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto', markerUnits: 'userSpaceOnUse' });
    marker.append(vector('path', { d: 'M1 1 9 5 1 9', fill: 'none', stroke: color, 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    definitions.append(marker);
  }
  edgeLayer.append(definitions);
  const pendingPath = vector('path', { class: 'wc-pending-path', hidden: 'hidden', 'marker-end': `url(#wc-arrow-${instance}-active)` });
  edgeLayer.append(pendingPath); world.append(edgeLayer); surface.append(world);

  const hint = element('div', 'wc-hint');
  hint.append(element('span', 'wc-hint-title', t('canvas.title')), element('span', 'wc-hint-copy', t('canvas.hint')));
  const counts = element('span', 'wc-count', t('graph.counts', { records: visible.length, links: links.length }));
  hint.append(counts); surface.append(hint);
  const status = element('p', 'wc-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); surface.append(status);
  const controls = element('div', 'wc-controls'); controls.setAttribute('role', 'toolbar'); controls.setAttribute('aria-label', t('canvas.controls'));
  const zoomOut = button('', 'minus', () => zoomAt(camera.zoom / 1.2), t('common.zoomOut'));
  const zoomStatus = button(formatPercent(1), '', () => zoomAt(1), t('common.zoomReset')); zoomStatus.classList.add('wc-zoom-status');
  const zoomIn = button('', 'plus', () => zoomAt(camera.zoom * 1.2), t('common.zoomIn'));
  const fitControl = button(t('common.fit'), 'fit', () => fitVisible(), t('canvas.fit'));
  const lockControl = button('', 'unlock', () => {
    locked = !locked; surface.classList.toggle('is-locked', locked); lockControl.replaceChildren(icon(locked ? 'lock' : 'unlock'));
    lockControl.setAttribute('aria-pressed', String(locked)); lockControl.title = locked ? t('canvas.unlock') : t('canvas.lock');
    lockControl.setAttribute('aria-label', lockControl.title); announce(locked ? t('canvas.locked') : t('canvas.unlocked'));
  }, t('canvas.lock'));
  if (locked) { lockControl.replaceChildren(icon('lock')); lockControl.title = t('canvas.unlock'); lockControl.setAttribute('aria-label', lockControl.title); }
  lockControl.setAttribute('aria-pressed', String(locked));
  const layoutControl = button('', 'layout', resetLayout, t('canvas.layout'));
  const listControl = button('', 'list', () => toggleOverlay(listPanel, listControl), t('canvas.openList'));
  const mapControl = button('', 'map', () => {
    minimap.hidden = !minimap.hidden; mapControl.setAttribute('aria-pressed', String(!minimap.hidden)); if (!minimap.hidden) drawMinimap();
  }, t('canvas.toggleMap'));
  const helpControl = button('', 'help', () => toggleOverlay(helpPanel, helpControl), t('canvas.openHelp'));
  controls.append(zoomOut, zoomStatus, zoomIn, fitControl, lockControl, layoutControl, listControl, mapControl, helpControl);
  surface.append(controls);
  const edgePanel = element('div', 'wc-edge-panel'); edgePanel.hidden = true; surface.append(edgePanel);
  const listPanel = element('section', 'wc-overlay wc-list-panel'); listPanel.hidden = previousControls.listOpen === undefined ? !mobile : !previousControls.listOpen;
  listPanel.setAttribute('aria-label', t('canvas.list'));
  const listHeader = element('div', 'wc-overlay-header'); listHeader.append(element('h3', '', t('canvas.list')), button('', 'close', () => closeOverlay(listPanel, listControl), t('canvas.closeList'))); listPanel.append(listHeader);
  const listBody = element('div', 'wc-list-body'); listPanel.append(listBody); surface.append(listPanel);
  const helpPanel = element('section', 'wc-overlay wc-help-panel'); helpPanel.hidden = !previousControls.helpOpen; helpPanel.setAttribute('aria-label', t('canvas.help'));
  const helpHeader = element('div', 'wc-overlay-header'); helpHeader.append(element('h3', '', t('canvas.help')), button('', 'close', () => closeOverlay(helpPanel, helpControl), t('canvas.closeHelp'))); helpPanel.append(helpHeader);
  helpPanel.append(element('p', '', t('canvas.moveHelp')));
  helpPanel.append(element('p', '', t('canvas.connectHelp')));
  const shortcuts = element('dl', 'wc-shortcuts');
  [[t('canvas.arrows'), t('canvas.move10')], [t('canvas.shiftArrows'), t('canvas.move50')], ['Enter', t('canvas.openRecord')], [t('canvas.space'), t('canvas.pan')], ['F / 0', t('common.fit')], ['1', t('common.zoomReset')], ['Esc', t('canvas.cancel')]].forEach(([key, description]) => { shortcuts.append(element('dt', '', key), element('dd', '', description)); });
  helpPanel.append(shortcuts); surface.append(helpPanel);
  const minimap = element('div', 'wc-minimap'); minimap.setAttribute('aria-label', t('canvas.minimap'));
  minimap.hidden = previousControls.mapOpen === undefined ? typeof matchMedia === 'function' && matchMedia('(max-width: 420px)').matches : !previousControls.mapOpen;
  mapControl.setAttribute('aria-pressed', String(!minimap.hidden));
  const minimapSvg = vector('svg', { class: 'wc-minimap-svg', viewBox: '0 0 160 100', 'aria-hidden': 'true' });
  const minimapLabel = element('span', 'wc-minimap-label', t('canvas.overview')); minimap.append(minimapSvg, minimapLabel); surface.append(minimap);
  let minimapBounds = { minX: 0, minY: 0, width: 1, height: 1, scale: 1, offsetX: 0, offsetY: 0 };

  const neighbors = new Set(selectedId ? [selectedId] : []);
  links.forEach(link => { if (link.from === selectedId) neighbors.add(link.to); if (link.to === selectedId) neighbors.add(link.from); });
  links.forEach(link => {
    const group = vector('g', { class: `wc-edge${link.status === 'suggested' ? ' is-suggested' : ''}${link.from === selectedId || link.to === selectedId ? ' is-related' : ''}`, 'data-link-id': link.id });
    const title = `${link.from} → ${link.to}: ${link.label || t('relation.generic')}${link.status === 'suggested' ? `. ${t('relation.suggested')}` : ''}`;
    const path = vector('path', { class: 'wc-edge-line', 'marker-end': `url(#wc-arrow-${instance}-${link.from === selectedId || link.to === selectedId ? 'active' : link.status === 'suggested' ? 'suggested' : 'accepted'})` });
    const target = vector('path', { class: 'wc-edge-target', tabindex: 0, role: 'button', 'aria-label': title, 'data-link-id': link.id });
    const label = vector('text', { class: 'wc-edge-label', 'text-anchor': 'middle' }); label.textContent = String(link.label || t('relation.generic'));
    group.append(vector('title', {}, title), path, target, label); edgeLayer.insertBefore(group, pendingPath);
    edgeElements.set(link.id, { group, path, target, label, link });
    target.addEventListener('click', event => { event.stopPropagation(); selectLink(link.id); });
    target.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectLink(link.id); }
    });
  });

  visible.forEach((record, index) => {
    const node = element('article', `wc-node wc-node-${record.kind}${record.id === selectedId ? ' is-selected' : ''}${selectedId && !neighbors.has(record.id) ? ' is-muted' : ''}`);
    node.dataset.recordId = record.id; node.tabIndex = 0; node.setAttribute('role', 'group'); node.setAttribute('aria-roledescription', t('canvas.recordRole'));
    node.setAttribute('aria-label', t('canvas.recordLabel', { type: recordType(record.kind), title: record.title }));
    if (record.id === selectedId) node.setAttribute('aria-current', 'true');
    const header = element('div', 'wc-node-meta'); header.append(element('span', 'wc-node-kind', recordType(record.kind)), element('span', 'wc-node-id', record.id));
    const title = element('h3', 'wc-node-title', record.title); title.id = `wc-${instance}-record-${index}`; title.title = record.title;
    const detail = element('p', 'wc-node-detail');
    if (record.kind === 'test' && Number(record.trials) > 0 && Number.isInteger(Number(record.successes))) detail.textContent = t('canvas.testResult', { successes: Number(record.successes), trials: Number(record.trials) });
    else if (record.kind === 'test' && record.measuredValue !== null && record.measuredValue !== undefined && record.measuredValue !== '') detail.textContent = `${formatNumber(Number(record.measuredValue), { maximumFractionDigits: 12 })} ${record.unit || t('common.unitMissing')}`;
    else detail.textContent = record.revision || record.sourceType || (record.kind === 'decision' ? record.rationale ? t('canvas.whySaved') : t('canvas.whyMissing') : record.author || t('common.authorMissing'));
    node.append(header, title, detail);
    ['in', 'out'].forEach(port => {
      const handle = element('button', `wc-port wc-port-${port}`); handle.type = 'button'; handle.dataset.recordId = record.id; handle.dataset.port = port;
      handle.title = port === 'out' ? t('canvas.fromPort', { title: record.title }) : t('canvas.toPort', { title: record.title });
      handle.setAttribute('aria-label', handle.title); handle.append(element('span', 'wc-port-dot'));
      handle.addEventListener('click', event => {
        event.stopPropagation();
        if (port === 'out') startConnection(record.id); else if (pendingFrom) finishConnection(record.id); else announce(t('canvas.chooseSource'));
      });
      node.append(handle);
    });
    node.addEventListener('keydown', event => {
      if (event.target.closest('.wc-port')) return;
      if (event.key === 'Enter') { event.preventDefault(); pendingFrom ? finishConnection(record.id) : selectRecord(record.id); }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (locked) { announce(t('canvas.lockedHint')); return; }
        const distance = event.shiftKey ? 50 : 10;
        const position = positions[record.id];
        position.x = clamp(position.x + (event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0), -100000, 100000);
        position.y = clamp(position.y + (event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0), -100000, 100000);
        draw(); commitMove(record.id);
      }
    });
    world.append(node); nodeElements.set(record.id, node);
    const listRow = element('div', 'wc-list-row');
    const select = button('', '', () => { focusRecord(record.id); selectRecord(record.id); }); select.className = 'wc-record-button'; select.dataset.recordId = record.id;
    select.append(element('span', 'wc-list-meta', `${recordType(record.kind)} · ${record.id}`), element('strong', '', record.title));
    listRow.append(select);
    const outgoing = links.filter(link => link.from === record.id);
    outgoing.forEach(link => {
      const relation = element('button', 'wc-list-link', `${t('relation.to', { title: recordsById.get(link.to)?.title || link.to, label: link.label || t('relation.generic') })}${link.status === 'suggested' ? ` · ${t('relation.suggested')}` : ''}`);
      relation.type = 'button'; relation.dataset.linkId = link.id; relation.addEventListener('click', () => selectLink(link.id)); listRow.append(relation);
    });
    if (!outgoing.length) listRow.append(element('p', 'wc-list-muted', t('relation.noneOutgoing')));
    listBody.append(listRow);
  });
  if (!visible.length) {
    const empty = element('div', 'wc-empty');
    empty.append(element('h3', '', records.length ? t('graph.noMatches') : t('graph.emptyTitle')), element('p', '', records.length ? t('graph.changeFilters') : t('graph.emptyText')));
    surface.append(empty); minimap.hidden = true;
  }
  container.replaceChildren(surface);

  function announce(message) { status.textContent = message; status.classList.toggle('is-visible', Boolean(message)); }
  function rememberCamera() {
    cameras.set(cameraKey, { ...camera });
    if (cameras.size > 50) cameras.delete(cameras.keys().next().value);
    try { localStorage.setItem(cameraKey, JSON.stringify(camera)); } catch { /* In-session camera remains available. */ }
  }
  function rememberPositions() {
    sessionPositions.set(projectKey, Object.fromEntries(Object.entries(positions).map(([id, value]) => [id, { ...value }])));
    if (sessionPositions.size > 30) sessionPositions.delete(sessionPositions.keys().next().value);
  }
  function localPoint(event) {
    const rect = surface.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function worldPoint(point) { return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom }; }
  function dimensions() { return { width: Math.max(1, surface.clientWidth), height: Math.max(1, surface.clientHeight) }; }
  function bounds() {
    if (!visible.length) return { minX: 0, minY: 0, maxX: NODE_WIDTH, maxY: NODE_HEIGHT, width: NODE_WIDTH, height: NODE_HEIGHT };
    let minX = Math.min(...visible.map(record => positions[record.id].x)); let minY = Math.min(...visible.map(record => positions[record.id].y));
    let maxX = Math.max(...visible.map(record => positions[record.id].x + NODE_WIDTH)); let maxY = Math.max(...visible.map(record => positions[record.id].y + NODE_HEIGHT));
    links.forEach(link => {
      const route = linkRoute(link); if (!route) return;
      const xs = cubicExtrema(route.from.x, route.control1.x, route.control2.x, route.to.x);
      const ys = cubicExtrema(route.from.y, route.control1.y, route.control2.y, route.to.y);
      minX = Math.min(minX, ...xs.map(value => value - 9)); minY = Math.min(minY, ...ys.map(value => value - 9));
      maxX = Math.max(maxX, ...xs.map(value => value + 9)); maxY = Math.max(maxY, ...ys.map(value => value + 9));
    });
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }
  function curveGeometry(from, to) {
    const distance = to.x < from.x ? Math.min(110, Math.max(55, Math.abs(to.x - from.x) * 0.18)) : Math.max(55, (to.x - from.x) * 0.45);
    const control1 = { x: from.x + distance, y: from.y }, control2 = { x: to.x - distance, y: to.y };
    return { from, to, control1, control2, path: `M${from.x} ${from.y} C${control1.x} ${control1.y},${control2.x} ${control2.y},${to.x} ${to.y}` };
  }
  function curve(from, to) { return curveGeometry(from, to).path; }
  function linkRoute(link) {
    const a = positions[link.from], b = positions[link.to]; if (!a || !b) return null;
    return curveGeometry({ x: a.x + NODE_WIDTH + 4, y: a.y + NODE_HEIGHT / 2 }, { x: b.x - 4, y: b.y + NODE_HEIGHT / 2 });
  }
  function cubicExtrema(p0, p1, p2, p3) {
    const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 3 * p0 - 6 * p1 + 3 * p2, c = -3 * p0 + 3 * p1;
    const roots = []; const epsilon = 1e-9;
    if (Math.abs(a) < epsilon) { if (Math.abs(b) > epsilon) roots.push(-c / (2 * b)); }
    else {
      const discriminant = 4 * b * b - 12 * a * c;
      if (discriminant >= 0) { const square = Math.sqrt(discriminant); roots.push((-2 * b + square) / (6 * a), (-2 * b - square) / (6 * a)); }
    }
    return [p0, p3, ...roots.filter(t => t > 0 && t < 1).map(t => ((a * t + b) * t + c) * t + p0)];
  }
  function fitEdgeLabel(entry, available) {
    const full = String(entry.link.label || t('relation.generic')), limit = Math.max(0, Math.floor(available));
    if (entry.labelLimit === limit && entry.labelFull === full) return;
    entry.labelLimit = limit; entry.labelFull = full;
    const measure = text => { entry.label.textContent = text; try { return entry.label.getComputedTextLength(); } catch { return text.length * 7; } };
    if (limit < 20) { entry.label.textContent = ''; return; }
    if (measure(full) <= limit) return;
    let low = 0, high = full.length;
    while (low < high) { const middle = Math.ceil((low + high) / 2); if (measure(full.slice(0, middle).trimEnd() + '…') <= limit) low = middle; else high = middle - 1; }
    entry.label.textContent = low ? full.slice(0, low).trimEnd() + '…' : '';
  }
  function drawEdges() {
    edgeElements.forEach(entry => {
      const { path, target, label, link } = entry; const route = linkRoute(link); if (!route) return;
      const { from, to } = route; path.setAttribute('d', route.path); target.setAttribute('d', route.path);
      const midX = (from.x + to.x) / 2; const midY = (from.y + to.y) / 2;
      label.setAttribute('x', midX); label.setAttribute('y', midY - 11);
      fitEdgeLabel(entry, to.x > from.x ? to.x - from.x - 22 : 240);
    });
  }
  function draw() {
    if (!alive) return;
    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    surface.style.setProperty('--wc-zoom', String(camera.zoom));
    surface.style.backgroundSize = `${24 * camera.zoom}px ${24 * camera.zoom}px`;
    surface.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
    nodeElements.forEach((node, id) => { node.style.transform = `translate(${positions[id].x}px, ${positions[id].y}px)`; });
    zoomStatus.firstElementChild.textContent = formatPercent(camera.zoom);
    zoomOut.disabled = camera.zoom <= MIN_ZOOM + 0.001; zoomIn.disabled = camera.zoom >= MAX_ZOOM - 0.001;
    drawEdges(); if (!minimap.hidden) drawMinimap();
  }
  function scheduleDraw() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); }); }
  function zoomAt(value, anchor) {
    const size = dimensions(); const point = anchor || { x: size.width / 2, y: size.height / 2 };
    const fixed = worldPoint(point); const zoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
    camera = { x: point.x - fixed.x * zoom, y: point.y - fixed.y * zoom, zoom };
    draw(); rememberCamera();
  }
  function fitVisible() {
    const size = dimensions(); const area = bounds();
    const horizontal = size.width < 500 ? 25 : 64;
    const vertical = size.height < 450 ? 64 : 90;
    const zoom = clamp(Math.min((size.width - horizontal * 2) / area.width, (size.height - vertical * 2) / area.height, 1), MIN_ZOOM, MAX_ZOOM);
    camera = { x: size.width / 2 - (area.minX + area.width / 2) * zoom, y: size.height / 2 - (area.minY + area.height / 2) * zoom, zoom };
    hadCamera = true; draw(); rememberCamera();
  }
  function focusRecord(id) {
    const position = positions[id]; if (!position) return;
    const size = dimensions(); const zoom = Math.max(camera.zoom, Math.min(1, size.width / (NODE_WIDTH + 100)));
    camera = { x: size.width / 2 - (position.x + NODE_WIDTH / 2) * zoom, y: size.height / 2 - (position.y + NODE_HEIGHT / 2) * zoom, zoom };
    draw(); rememberCamera();
  }
  function selectRecord(id) {
    clearLink(); rememberCamera(); rememberPositions();
    const previous = doubleClicks.get(projectKey); const now = performance.now();
    if (previous?.id === id && now - previous.at < 420) focusRecord(id);
    doubleClicks.set(projectKey, { id, at: now });
    try { onSelect(id); } catch (error) { onError(error); }
  }
  function commitMove(id) {
    rememberPositions(); rememberCamera();
    try { onMove(id, { ...positions[id] }); } catch (error) { onError(error); }
  }
  function resetLayout() {
    records.forEach(record => { positions[record.id] = { ...defaultLayout[record.id] }; });
    rememberPositions(); fitVisible();
    try {
      if (typeof onResetLayout === 'function') onResetLayout();
    } catch (error) { onError(error); }
  }
  function startConnection(id) {
    pendingFrom = id; clearLink(); surface.classList.add('is-connecting');
    nodeElements.forEach((node, nodeId) => { node.classList.toggle('is-connection-source', nodeId === id); node.classList.toggle('is-connection-target', nodeId !== id); });
    announce(t('canvas.startConnection', { title: recordsById.get(id)?.title || id }));
  }
  function updatePending(point) {
    if (!pendingFrom) return;
    const position = positions[pendingFrom];
    pendingPath.removeAttribute('hidden'); pendingPath.setAttribute('d', curve({ x: position.x + NODE_WIDTH + 4, y: position.y + NODE_HEIGHT / 2 }, worldPoint(point)));
  }
  function cancelConnection() {
    pendingFrom = null; pendingPath.setAttribute('hidden', 'hidden'); surface.classList.remove('is-connecting');
    nodeElements.forEach(node => { node.classList.remove('is-connection-source', 'is-connection-target'); });
    announce('');
  }
  function finishConnection(to) {
    if (!pendingFrom || !recordsById.has(to)) return;
    if (pendingFrom === to) { announce(t('canvas.selfConnection')); return; }
    const from = pendingFrom; cancelConnection(); rememberCamera();
    try { onConnect({ from, to }); } catch (error) { onError(error); }
  }
  function clearLink() {
    edgePanel.hidden = true; edgeElements.forEach(({ group }) => group.classList.remove('is-selected'));
  }
  function selectLink(id) {
    const link = links.find(item => item.id === id); if (!link) return;
    cancelConnection(); edgeElements.forEach(({ group }, key) => group.classList.toggle('is-selected', key === id));
    const source = recordsById.get(link.from); const target = recordsById.get(link.to);
    edgePanel.replaceChildren();
    const heading = element('div', 'wc-edge-heading'); heading.append(element('strong', '', link.label || t('relation.generic')), button('', 'close', clearLink, t('relation.close'))); edgePanel.append(heading);
    edgePanel.append(element('p', '', `${source?.title || link.from} → ${target?.title || link.to}`));
    edgePanel.append(element('span', 'wc-edge-status', link.status === 'suggested' ? t('relation.suggested') : t('relation.accepted')));
    const remove = button(t('relation.remove'), 'trash', () => requestRemoveLink(id)); remove.classList.add('wc-remove-link'); edgePanel.append(remove); edgePanel.hidden = false;
  }
  function requestRemoveLink(id) {
    if (!links.some(link => link.id === id)) return;
    clearLink(); rememberCamera();
    try { onRemoveLink(id); } catch (error) { onError(error); }
  }
  function toggleOverlay(panel, control) {
    const open = panel.hidden; listPanel.hidden = true; helpPanel.hidden = true;
    listControl.setAttribute('aria-expanded', 'false'); helpControl.setAttribute('aria-expanded', 'false');
    panel.hidden = !open; control.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector('button')?.focus();
  }
  function closeOverlay(panel, control) { panel.hidden = true; control.setAttribute('aria-expanded', 'false'); control.focus(); }
  listControl.setAttribute('aria-expanded', String(!listPanel.hidden)); helpControl.setAttribute('aria-expanded', String(!helpPanel.hidden));
  function rememberControls() {
    const current = sessionControls.get(projectKey) || {};
    sessionControls.set(projectKey, { ...current, mobile, [mobile ? 'mobile' : 'desktop']: { locked, listOpen: !listPanel.hidden, helpOpen: !helpPanel.hidden, mapOpen: !minimap.hidden } });
    if (sessionControls.size > 30) sessionControls.delete(sessionControls.keys().next().value);
  }
  function changeDeviceClass(event) {
    rememberControls(); mobile = event.matches;
    const next = sessionControls.get(projectKey)?.[mobile ? 'mobile' : 'desktop'] || {};
    listPanel.hidden = next.listOpen === undefined ? !mobile : !next.listOpen;
    helpPanel.hidden = !next.helpOpen;
    minimap.hidden = next.mapOpen === undefined ? typeof matchMedia === 'function' && matchMedia('(max-width: 420px)').matches : !next.mapOpen;
    locked = Boolean(next.locked); surface.classList.toggle('is-locked', locked);
    lockControl.replaceChildren(icon(locked ? 'lock' : 'unlock')); lockControl.setAttribute('aria-pressed', String(locked));
    lockControl.title = locked ? t('canvas.unlock') : t('canvas.lock'); lockControl.setAttribute('aria-label', lockControl.title);
    listControl.setAttribute('aria-expanded', String(!listPanel.hidden)); helpControl.setAttribute('aria-expanded', String(!helpPanel.hidden)); mapControl.setAttribute('aria-pressed', String(!minimap.hidden));
    rememberControls(); draw();
  }
  function drawMinimap() {
    const area = bounds(); const padding = 10;
    const scale = Math.min((160 - padding * 2) / Math.max(1, area.width), (100 - padding * 2) / Math.max(1, area.height));
    const offsetX = (160 - area.width * scale) / 2; const offsetY = (100 - area.height * scale) / 2;
    minimapBounds = { ...area, scale, offsetX, offsetY };
    minimapSvg.replaceChildren();
    visible.forEach(record => {
      const position = positions[record.id];
      minimapSvg.append(vector('rect', { x: offsetX + (position.x - area.minX) * scale, y: offsetY + (position.y - area.minY) * scale, width: NODE_WIDTH * scale, height: NODE_HEIGHT * scale, rx: 1.5, class: `wc-minimap-node${record.id === selectedId ? ' is-selected' : ''}` }));
    });
    const size = dimensions();
    minimapSvg.append(vector('rect', { x: offsetX + (-camera.x / camera.zoom - area.minX) * scale, y: offsetY + (-camera.y / camera.zoom - area.minY) * scale, width: size.width / camera.zoom * scale, height: size.height / camera.zoom * scale, class: 'wc-minimap-camera' }));
  }

  function releaseCapture(event) { try { if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId); } catch { /* The element can already have been removed by a callback. */ } }
  function pointerDown(event) {
    if (event.target.closest('.wc-controls,.wc-overlay,.wc-edge-panel,.wc-minimap,.wc-hint,.wc-status')) return;
    if (event.button !== 0 && event.button !== 1) return;
    const point = localPoint(event); pointers.set(event.pointerId, point);
    if (event.pointerType === 'touch' && pointers.size === 2) {
      if (gesture?.type === 'node') positions[gesture.id] = { ...gesture.origin };
      cancelConnection();
      const pair = [...pointers.values()]; const middle = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
      gesture = { type: 'pinch', distance: Math.max(1, Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y)), anchor: worldPoint(middle), zoom: camera.zoom };
      surface.setPointerCapture(event.pointerId); event.preventDefault(); draw(); return;
    }
    const handle = event.target.closest('.wc-port'); const node = event.target.closest('.wc-node');
    const edge = event.target.closest('.wc-edge-target');
    if (edge && event.button === 0 && !handMode) { pointers.delete(event.pointerId); return; }
    if (handle && event.button === 0 && !handMode) {
      handle.focus({ preventScroll: true });
      if (handle.dataset.port === 'out') {
        startConnection(handle.dataset.recordId); gesture = { type: 'connect', start: point, source: handle, moved: false };
      } else { pointers.delete(event.pointerId); return; }
    } else if (node && event.button === 0 && !handMode) {
      node.focus({ preventScroll: true });
      if (pendingFrom) { gesture = { type: 'target', id: node.dataset.recordId, start: point, moved: false }; }
      else { gesture = { type: locked ? 'select' : 'node', id: node.dataset.recordId, origin: { ...positions[node.dataset.recordId] }, start: point, moved: false }; }
    } else {
      gesture = { type: 'pan', start: point, origin: { ...camera }, moved: false }; surface.classList.add('is-panning');
    }
    try { surface.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
    event.preventDefault();
  }
  function pointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    const point = localPoint(event); pointers.set(event.pointerId, point);
    if (!gesture) return;
    if (gesture.type === 'pinch') {
      const pair = [...pointers.values()]; if (pair.length < 2) return;
      const middle = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
      const zoom = clamp(gesture.zoom * Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y) / gesture.distance, MIN_ZOOM, MAX_ZOOM);
      camera = { x: middle.x - gesture.anchor.x * zoom, y: middle.y - gesture.anchor.y * zoom, zoom }; scheduleDraw(); return;
    }
    const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
    gesture.moved ||= Math.hypot(dx, dy) > 4;
    if (gesture.type === 'node') {
      positions[gesture.id] = { x: clamp(gesture.origin.x + dx / camera.zoom, -100000, 100000), y: clamp(gesture.origin.y + dy / camera.zoom, -100000, 100000) }; scheduleDraw();
    } else if (gesture.type === 'pan') { camera.x = gesture.origin.x + dx; camera.y = gesture.origin.y + dy; scheduleDraw(); }
    else if (gesture.type === 'connect') updatePending(point);
  }
  function pointerUp(event) {
    if (!pointers.has(event.pointerId)) return;
    const current = gesture; pointers.delete(event.pointerId); releaseCapture(event);
    if (current?.type === 'pinch') {
      if (pointers.size === 1) {
        const point = [...pointers.values()][0]; gesture = { type: 'pan', start: point, origin: { ...camera }, moved: true };
      } else gesture = null;
      rememberCamera(); draw(); return;
    }
    gesture = null; surface.classList.remove('is-panning');
    if (!current) return;
    if (current.type === 'node') {
      draw(); if (current.moved) commitMove(current.id); else selectRecord(current.id);
    } else if (current.type === 'select') { if (!current.moved) selectRecord(current.id); }
    else if (current.type === 'target') { if (!current.moved) finishConnection(current.id); }
    else if (current.type === 'pan') { rememberCamera(); if (!current.moved) { cancelConnection(); clearLink(); try { onSelect(null); } catch (error) { onError(error); } } }
    else if (current.type === 'connect') {
      if (current.moved) {
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.wc-node');
        if (target && surface.contains(target)) finishConnection(target.dataset.recordId);
        else { pendingPath.setAttribute('hidden', 'hidden'); announce(t('canvas.chooseTarget')); }
      }
    }
  }
  function pointerCancel(event) {
    const current = gesture; pointers.delete(event.pointerId); releaseCapture(event); gesture = null;
    if (current?.type === 'node') positions[current.id] = { ...current.origin };
    cancelConnection(); surface.classList.remove('is-panning'); draw();
  }
  function wheel(event) {
    if (event.target.closest('.wc-overlay,.wc-edge-panel,.wc-controls')) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) zoomAt(camera.zoom * Math.exp(-clamp(event.deltaY, -350, 350) * 0.002), localPoint(event));
    else {
      camera.x -= event.shiftKey ? event.deltaY : event.deltaX;
      camera.y -= event.shiftKey ? event.deltaX : event.deltaY;
      draw(); rememberCamera();
    }
  }
  function keyDown(event) {
    if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key === 'Escape') {
      event.preventDefault(); cancelConnection(); clearLink(); listPanel.hidden = true; helpPanel.hidden = true;
      listControl.setAttribute('aria-expanded', 'false'); helpControl.setAttribute('aria-expanded', 'false'); surface.focus();
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space' && !event.target.closest('button')) { event.preventDefault(); handMode = true; surface.classList.add('is-hand-mode'); }
    if (event.key === 'f' || event.key === 'F' || event.key === '0') { event.preventDefault(); fitVisible(); }
    if (event.key === '1') { event.preventDefault(); zoomAt(1); }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(camera.zoom * 1.2); }
    if (event.key === '-') { event.preventDefault(); zoomAt(camera.zoom / 1.2); }
  }
  function keyUp(event) { if (event.code === 'Space') { handMode = false; surface.classList.remove('is-hand-mode'); } }
  function loseFocus() { handMode = false; surface.classList.remove('is-hand-mode'); }
  function minimapPointer(event) {
    event.preventDefault(); event.stopPropagation();
    const rectangle = minimapSvg.getBoundingClientRect();
    const x = (event.clientX - rectangle.left) / rectangle.width * 160;
    const y = (event.clientY - rectangle.top) / rectangle.height * 100;
    const area = minimapBounds; const point = { x: (x - area.offsetX) / area.scale + area.minX, y: (y - area.offsetY) / area.scale + area.minY };
    const size = dimensions(); camera.x = size.width / 2 - point.x * camera.zoom; camera.y = size.height / 2 - point.y * camera.zoom; draw(); rememberCamera();
  }
  function listen(target, name, listener, options) {
    target.addEventListener(name, listener, options); disposals.push(() => target.removeEventListener(name, listener, options));
  }
  listen(surface, 'pointerdown', pointerDown); listen(surface, 'pointermove', pointerMove); listen(surface, 'pointerup', pointerUp); listen(surface, 'pointercancel', pointerCancel);
  listen(surface, 'wheel', wheel, { passive: false }); listen(surface, 'keydown', keyDown); listen(surface, 'keyup', keyUp); listen(surface, 'blur', loseFocus);
  listen(minimapSvg, 'pointerdown', minimapPointer);
  if (mobileMedia) listen(mobileMedia, 'change', changeDeviceClass);
  document.fonts?.ready.then(() => { if (alive) { edgeElements.forEach(entry => { entry.labelLimit = undefined; }); draw(); } });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!hadCamera && surface.clientWidth > 0 && surface.clientHeight > 0) fitVisible(); else draw(); }) : null;
  observer?.observe(surface);
  if (hadCamera) draw(); else fitVisible();
  return () => {
    rememberCamera(); rememberPositions(); alive = false;
    rememberControls();
    if (frame) cancelAnimationFrame(frame); observer?.disconnect(); disposals.forEach(dispose => dispose());
    pointers.clear(); gesture = null;
  };
}
