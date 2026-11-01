import { mediaText as t, mediaErrorText } from './workspace-media-copy.js';
import { formatNumber } from './workspace-i18n.js';

export const UPLOAD_QUEUE_LIMITS = Object.freeze({ files: 20, bytes: 100 * 1024 * 1024, imageBytes: 15 * 1024 * 1024, documentBytes: 10 * 1024 * 1024 });
const isImage = file => /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
const isDocument = file => /\.(pdf|csv)$/i.test(file.name);
export function uploadSelectionError(file) {
  if (!file?.size) return 'empty_file';
  if (!isImage(file) && !isDocument(file)) return 'unsupported_file';
  return file.size > (isDocument(file) ? UPLOAD_QUEUE_LIMITS.documentBytes : UPLOAD_QUEUE_LIMITS.imageBytes) ? 'file_too_large' : null;
}

/** One active transfer, frozen request metadata on retry, no private file persistence in localStorage. */
export function createMediaUploadQueue({ teamId, projectId, transport, onChange = () => {}, uuid = () => crypto.randomUUID(), now = () => new Date().toISOString() }) {
  const entries = [];
  let active = null, disposed = false, draining = null;
  const notify = () => { if (!disposed) onChange(entries); };
  const total = () => entries.reduce((size, entry) => size + entry.size, 0);
  const find = id => entries.find(entry => entry.id === id);
  function add(files) {
    const rejected = [], added = [];
    for (const file of files) {
      const error = uploadSelectionError(file) || (entries.length >= UPLOAD_QUEUE_LIMITS.files || total() + file.size > UPLOAD_QUEUE_LIMITS.bytes ? 'queue_limit' : null);
      if (error) { rejected.push({ name: file.name, code: error }); continue; }
      const entry = { id: uuid(), file, size: file.size, name: file.name.replace(/\.[^.]+$/, '').slice(0, 160), caption: '', alt: '', kind: isDocument(file) ? 'document' : 'photo', state: 'selected', progress: 0, errorCode: null, pending: null, occurredAt: now(), clientPrivacyEdit: null, result: null };
      entries.push(entry); added.push(entry);
    }
    notify(); return { added, rejected };
  }
  function update(id, values) {
    const entry = find(id);
    if (!entry || entry.pending || entry.state !== 'selected') return false;
    for (const key of ['name', 'caption', 'alt', 'kind']) if (typeof values[key] === 'string') entry[key] = values[key];
    return true;
  }
  function replaceFile(id, file) {
    const entry = find(id);
    if (!entry || entry.pending || entry.state !== 'selected') return false;
    const error = uploadSelectionError(file) || (total() - entry.size + file.size > UPLOAD_QUEUE_LIMITS.bytes ? 'queue_limit' : null);
    if (error) return false;
    entry.file = file; entry.size = file.size; entry.clientPrivacyEdit = 'local-crop-redaction'; notify(); return true;
  }
  function remove(id) {
    const entry = find(id);
    if (!entry || !['selected', 'error', 'cancelled'].includes(entry.state)) return false;
    entries.splice(entries.indexOf(entry), 1); entry.file = null; entry.pending = null; notify(); return true;
  }
  function cancel(id) {
    const entry = find(id);
    if (!entry || entry.state === 'saved') return;
    if (active?.entry === entry) active.controller.abort();
    else { entry.state = 'cancelled'; entry.errorCode = 'upload_cancelled'; notify(); }
  }
  async function drain() {
    if (draining) return draining;
    draining = (async () => {
      for (;;) {
        const entry = entries.find(item => item.state === 'queued');
        if (disposed || !entry) break;
        const controller = new AbortController(); active = { entry, controller };
        if (!entry.pending) entry.pending = { file: entry.file, metadata: { teamId, projectId, requestId: entry.id, occurredAt: entry.occurredAt, name: entry.name.trim(), filename: entry.file.name, kind: entry.kind, caption: entry.caption, alt: entry.alt, ...(entry.clientPrivacyEdit ? { clientPrivacyEdit: entry.clientPrivacyEdit } : {}) } };
        entry.state = 'uploading'; entry.progress = 0; entry.errorCode = null; notify();
        try {
          const result = await transport(entry.pending.file, entry.pending.metadata, { signal: controller.signal, onProgress: (value, processing = false) => {
            if (disposed || controller.signal.aborted) return;
            entry.progress = Math.max(0, Math.min(95, value)); entry.state = processing ? 'processing' : 'uploading'; notify();
          } });
          entry.state = 'saved'; entry.progress = 100; entry.result = result; entry.file = null; entry.pending = null;
        } catch (error) {
          entry.state = controller.signal.aborted ? 'cancelled' : 'error'; entry.errorCode = controller.signal.aborted ? 'upload_cancelled' : typeof error?.code === 'string' ? error.code : 'upload_failed';
        } finally { active = null; notify(); }
        if (entry.errorCode === 'offline' || entry.errorCode === 'unauthenticated' || entry.errorCode === 'forbidden') break;
      }
    })();
    try { await draining; } finally { draining = null; }
  }
  return {
    entries, add, update, replaceFile, remove, cancel,
    start() { for (const entry of entries) if (entry.state === 'selected') entry.state = 'queued'; notify(); return drain(); },
    retry(id) { const entry = find(id); if (!entry || !['error', 'cancelled'].includes(entry.state)) return Promise.resolve(); entry.state = 'queued'; notify(); return drain(); },
    dispose() { disposed = true; active?.controller.abort(); for (const entry of entries) { entry.file = null; entry.pending = null; } },
  };
}

export function sendMediaUpload(file, metadata, { signal, onProgress }) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(Object.assign(new Error('upload_cancelled'), { code: 'upload_cancelled' })); return; }
    if (!navigator.onLine) { reject(Object.assign(new Error('offline'), { code: 'offline' })); return; }
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const finish = (error, result) => { signal.removeEventListener('abort', abort); error ? reject(Object.assign(new Error(error), { code: error })) : resolve(result); };
    request.open('POST', '/api/workspace/media'); request.timeout = 120000;
    request.setRequestHeader('Content-Type', 'application/octet-stream'); request.setRequestHeader('X-TraceLab-Metadata', encodeURIComponent(JSON.stringify(metadata)));
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded / event.total * 95, event.loaded === event.total); };
    request.onerror = () => finish('upload_failed'); request.ontimeout = () => finish('upload_timeout'); request.onabort = () => finish('upload_cancelled');
    request.onload = () => { let data; try { data = JSON.parse(request.responseText); } catch { finish('upload_failed'); return; }
      if (request.status < 200 || request.status >= 300) finish(data.error?.code || 'upload_failed'); else finish(null, data); };
    signal.addEventListener('abort', abort, { once: true }); request.send(file);
  });
}

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const button = (label, callback) => { const node = el('button', 'wm-button', label); node.type = 'button'; node.onclick = callback; return node; };
export function openMediaUploadQueue({ teamId, projectId, initialFiles = [], signal, onClosed = () => {} }) {
  const previousFocus = document.activeElement, modal = el('dialog', 'wm-dialog wm-upload-dialog'), form = el('form', 'wm-form');
  const title = el('h2', '', t('batchUpload')); title.id = 'wm-upload-title'; modal.setAttribute('aria-labelledby', title.id);
  const explanation = el('p', 'wm-meta', t('batchHint')), drop = el('div', 'wm-drop'), tools = el('div', 'wm-tools'), list = el('div', 'wm-upload-list');
  const picker = el('input'); picker.type = 'file'; picker.accept = '.jpg,.jpeg,.png,.webp,.pdf,.csv'; picker.multiple = true; picker.hidden = true;
  const camera = el('input'); camera.type = 'file'; camera.accept = 'image/*'; camera.capture = 'environment'; camera.hidden = true;
  const choose = button(t('chooseFiles'), () => picker.click()), capture = button(t('camera'), () => camera.click());
  const notice = el('p', 'wm-status'), summary = el('p', 'wm-status'); notice.setAttribute('role', 'status'); summary.setAttribute('role', 'status');
  const start = button(t('uploadSelected'), () => {}); start.type = 'submit';
  const close = button(t('close'), () => modal.close()); tools.append(start, close);
  const previews = new Map(), rows = new Map(), editorAbort = new AbortController(); let closed = false, editing = false;
  const queue = createMediaUploadQueue({ teamId, projectId, transport: sendMediaUpload, onChange: paint });
  function add(files) { const result = queue.add(Array.from(files || [])); notice.textContent = result.rejected.map(item => item.name + ': ' + (item.code === 'queue_limit' ? t('queueLimit') : mediaErrorText(item.code))).join(' · '); }
  function previewFor(entry) {
    const current = previews.get(entry.id);
    if (current?.file === entry.file || !entry.file) return current?.url || null;
    if (current) URL.revokeObjectURL(current.url);
    if (!isImage(entry.file)) { previews.delete(entry.id); return null; }
    const url = URL.createObjectURL(entry.file); previews.set(entry.id, { file: entry.file, url }); return url;
  }
  function field(parent, entry, key, label, max, textarea = false) {
    const wrap = el('label', 'wm-field', label), input = el(textarea ? 'textarea' : 'input'); input.value = entry[key]; input.maxLength = max; input.required = key === 'name';
    input.addEventListener('input', () => queue.update(entry.id, { [key]: input.value })); wrap.append(input); parent.append(wrap); return input;
  }
  function makeRow(entry) {
    const row = el('article', 'wm-upload-row'), overview = el('div', 'wm-upload-overview'), preview = el('div', 'wm-upload-preview'), body = el('div', 'wm-upload-fields');
    const filename = el('p', 'wm-upload-filename', entry.file.name), bytes = el('p', 'wm-meta'), state = el('p', 'wm-status'), progress = el('progress'); progress.max = 100; progress.setAttribute('aria-label', entry.file.name);
    const name = field(body, entry, 'name', t('name'), 160), caption = field(body, entry, 'caption', t('caption'), 5000, true);
    const details = el('details', 'wm-upload-details'); details.append(el('summary', '', t('extraDetails')));
    const alt = field(details, entry, 'alt', t('alt'), 500), kindWrap = el('label', 'wm-field', t('type')), kind = el('select');
    for (const value of isDocument(entry.file) ? ['document'] : ['photo', 'drawing', 'render']) { const option = el('option', '', t(value)); option.value = value; kind.append(option); }
    kind.value = entry.kind; kind.onchange = () => queue.update(entry.id, { kind: kind.value }); kindWrap.append(kind); details.append(kindWrap); body.append(details);
    const controls = el('div', 'wm-tools'), retry = button(t('retry'), () => queue.retry(entry.id)), cancel = button(t('cancelUpload'), () => queue.cancel(entry.id)), remove = button(t('removeSelection'), () => { queue.remove(entry.id); });
    const edit = button(t('editPhoto'), async () => {
      editing = true; paint(); notice.textContent = '';
      try {
        const { editPrivatePhoto } = await import('./workspace-media-editor.js');
        const blob = await editPrivatePhoto(entry.file, editorAbort.signal);
        if (blob && !closed) { const file = new File([blob], entry.file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
          if (!queue.replaceFile(entry.id, file)) notice.textContent = t('editedTooLarge'); }
      } catch { if (!closed) notice.textContent = t('error'); }
      finally { editing = false; paint(); }
    });
    edit.hidden = !isImage(entry.file); controls.append(edit, retry, cancel, remove); overview.append(preview, body); row.append(filename, bytes, overview, state, progress, controls); list.append(row);
    return { row, bytes, preview, state, progress, name, caption, alt, kind, edit, retry, cancel, remove, file: null };
  }
  function paint() {
    if (closed) return;
    for (const [id, value] of rows) if (!queue.entries.some(entry => entry.id === id)) { value.row.remove(); rows.delete(id); const preview = previews.get(id); if (preview) URL.revokeObjectURL(preview.url); previews.delete(id); }
    for (const entry of queue.entries) {
      let value = rows.get(entry.id); if (!value) { value = makeRow(entry); rows.set(entry.id, value); }
      const editable = entry.state === 'selected' && !entry.pending && !editing;
      for (const input of [value.name, value.caption, value.alt, value.kind, value.edit, value.remove]) input.disabled = !editable;
      value.remove.disabled = editing || !['selected', 'error', 'cancelled'].includes(entry.state);
      value.retry.hidden = !['error', 'cancelled'].includes(entry.state); value.retry.disabled = editing;
      value.cancel.hidden = !['queued', 'uploading', 'processing'].includes(entry.state);
      value.progress.hidden = !['uploading', 'processing', 'saved'].includes(entry.state); value.progress.value = entry.progress;
      value.bytes.textContent = `${formatNumber(entry.size / 1048576)} MiB${entry.clientPrivacyEdit ? ' · ' + t('localEdited') : ''}`;
      value.state.textContent = entry.state === 'saved' ? t('saved') : entry.state === 'cancelled' ? t('cancelled') : entry.state === 'error' ? entry.errorCode === 'offline' ? t('offline') : mediaErrorText(entry.errorCode) : t({ selected: 'selectedFile', queued: 'queuedFile', uploading: 'sending', processing: 'processing' }[entry.state]);
      const url = previewFor(entry); if (url && value.file !== url) { const image = el('img'); image.src = url; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; value.preview.replaceChildren(image); value.file = url; }
      else if (!url && !value.preview.firstChild) value.preview.append(el('span', 'wm-file-kind', entry.file?.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'CSV'));
    }
    const saved = queue.entries.filter(entry => entry.state === 'saved').length;
    summary.textContent = queue.entries.length ? `${t('filesSelected')}: ${formatNumber(queue.entries.length)} · ${t('filesSaved')}: ${formatNumber(saved)}` : t('selectFile');
    start.disabled = editing || !queue.entries.some(entry => ['selected', 'queued'].includes(entry.state)); choose.disabled = capture.disabled = editing;
  }
  function finish() {
    if (closed) return; closed = true; const results = queue.entries.filter(entry => entry.state === 'saved').map(entry => entry.result);
    signal?.removeEventListener('abort', abort); editorAbort.abort(); queue.dispose(); for (const preview of previews.values()) URL.revokeObjectURL(preview.url); previews.clear(); modal.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); void onClosed(results);
  }
  const abort = () => { if (modal.open) modal.close(); else finish(); };
  picker.onchange = () => { add(picker.files); picker.value = ''; }; camera.onchange = () => { add(camera.files); camera.value = ''; };
  drop.ondragover = event => { event.preventDefault(); drop.dataset.drag = 'true'; }; drop.ondragleave = () => delete drop.dataset.drag;
  drop.ondrop = event => { event.preventDefault(); delete drop.dataset.drag; if (!editing) add(event.dataTransfer?.files); };
  form.onsubmit = event => { event.preventDefault(); if (!editing) void queue.start(); };
  modal.addEventListener('close', finish, { once: true }); signal?.addEventListener('abort', abort, { once: true });
  drop.append(el('p', 'wm-meta', t('dropFiles')), choose, capture, picker, camera);
  form.append(title, explanation, drop, el('p', 'wm-meta', t('privacy')), notice, list, summary, tools, el('p', 'wm-meta', t('queueCloseHint'))); modal.append(form); document.body.append(modal); add(initialFiles); modal.showModal();
  return { close: abort };
}
