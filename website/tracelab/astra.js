import { copy } from './astra-copy.js';
import {mountOverlayNavigation} from './astra-navigation.js';
import {mountDotFields} from './astra-dots.js';
import {mountEvidenceEffects} from './astra-effects.js';

const storageKey = 'tracelab-locale';
const records = [
  { id: 'prototype', title: 'prototypeTitle', text: 'prototypeText', type: 'typePhoto', date: '2026-10-01T12:00:00Z', source: 'lab-photo-018' },
  { id: 'test', title: 'testTitle', text: 'testText', type: 'typeTest', date: '2026-10-02T12:00:00Z', source: 'test-log-024' },
  { id: 'decision', title: 'decisionTitle', text: 'decisionText', type: 'typeNote', date: '2026-10-03T12:00:00Z', source: 'decision-note-011' },
];
let locale = 'ru';
try { const saved = localStorage.getItem(storageKey); if (Object.hasOwn(copy, saved)) locale = saved; } catch {}
const state = { tab: 'graph', filter: 'all', selected: 'prototype' };
const tr = key => copy[locale][key] ?? copy.ru[key] ?? key;
const navigation=mountOverlayNavigation({dialog:document.querySelector('#astra-navigation'),trigger:document.querySelector('[data-menu]'),localeText:tr});
const date = value => {
  const parsed = new Date(value);
  // Some embedded Chromium builds lack Kazakh month names in their ICU data.
  if (locale === 'kk') {
    const months = ['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'];
    return `${parsed.getUTCDate()} ${months[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()} ж.`;
  }
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ru-RU', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(parsed);
};
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

function updateDetails() {
  const record = records.find(item => item.id === state.selected);
  document.querySelectorAll('[data-detail-title]').forEach(el => { el.textContent = tr(record.title); });
  document.querySelectorAll('[data-detail-date]').forEach(el => { el.textContent = `${tr('dateLabel')}: ${date(record.date)}`; });
  document.querySelectorAll('[data-detail-source]').forEach(el => { el.textContent = record.source; });
  document.querySelectorAll('[data-detail-text]').forEach(el => { el.textContent = tr(record.text); });
  document.querySelectorAll('[data-record]').forEach(el => { el.setAttribute('aria-pressed', String(el.dataset.record === state.selected)); });
}
function renderRecords() {
  const visible = records.filter(record => state.filter === 'all' || record.id === state.filter);
  document.querySelectorAll('[data-timeline]').forEach(el => {
    el.innerHTML = visible.map(record=>`<button type="button" class="a-timeline-record" data-record="${record.id}"><time datetime="${record.date}">${escape(date(record.date))}</time><strong>${escape(tr(record.title))}</strong><span>${escape(tr('source'))}: ${record.source}</span></button>`).join('');
  });
  document.querySelectorAll('[data-materials]').forEach(el => {
    el.innerHTML = records.map(record=>`<button type="button" class="a-material-card" data-record="${record.id}"><span class="a-tag">${escape(tr(record.type))}</span><strong>${escape(tr(record.title))}</strong><small>${record.source}</small></button>`).join('');
  });
  document.querySelectorAll('[data-filter]').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.filter === state.filter)));
  updateDetails();
}
function applyLocale(next, persist = false) {
  if (!Object.hasOwn(copy,next)) return;
  locale = next;
  document.documentElement.lang = locale;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label',tr(el.dataset.i18nLabel)); });
  document.querySelectorAll('[data-locale]').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.locale === locale)));
  document.title = `${tr(document.body.dataset.titleKey)} — Iznera`;
  document.querySelector('meta[name="description"]')?.setAttribute('content',tr(document.body.dataset.descriptionKey));
  navigation.refreshLabels();
  renderRecords();
  if (persist) { try { localStorage.setItem(storageKey,locale); } catch {} }
}
function selectTab(tab, focus = false) {
  if (!['graph','timeline','materials'].includes(tab)) return;
  state.tab = tab;
  document.querySelectorAll('[data-tab]').forEach(el => {
    const active = el.dataset.tab === tab;
    el.setAttribute('aria-selected',String(active));
    el.tabIndex = active ? 0 : -1;
    if (active && focus) el.focus();
  });
  document.querySelectorAll('[role="tabpanel"]').forEach(el => { el.hidden = el.id !== `demo-panel-${tab}`; });
}
document.addEventListener('click', event => {
  const localeButton = event.target.closest('[data-locale]');
  if (localeButton) { applyLocale(localeButton.dataset.locale,true); return; }
  const tab = event.target.closest('[data-tab]');
  if (tab) { selectTab(tab.dataset.tab); return; }
  const record = event.target.closest('[data-record]');
  if (record) { state.selected = record.dataset.record; updateDetails(); return; }
  const filter = event.target.closest('[data-filter]');
  if (filter) { state.filter = filter.dataset.filter; if (state.filter !== 'all') state.selected = state.filter; renderRecords(); return; }
  if (event.target.closest('[data-reset]')) { state.filter='all'; state.selected='prototype'; renderRecords(); }
});
document.addEventListener('keydown', event => {
  const tab = event.target.closest('[data-tab]');
  if (!tab || !['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = ['graph','timeline','materials'];
  const index = tabs.indexOf(state.tab);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
  selectTab(tabs[next],true);
});
window.addEventListener('storage', event => { if (event.key === storageKey && Object.hasOwn(copy,event.newValue)) applyLocale(event.newValue); });
applyLocale(locale);
let disposeMotion=null;
function mountMotion(){if(disposeMotion)return;const dots=mountDotFields(),effects=mountEvidenceEffects();disposeMotion=()=>{dots();effects();};}
mountMotion();
window.addEventListener('pagehide',()=>{navigation.close({immediate:true,restoreFocus:false});disposeMotion?.();disposeMotion=null;});
window.addEventListener('pageshow',()=>mountMotion());
