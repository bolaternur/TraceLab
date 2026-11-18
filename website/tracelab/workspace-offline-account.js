import { clearOfflineContext, createOutbox } from './workspace-outbox.js';
import { downloadOfflineBackup } from './workspace-outbox-backup.js';

export const offlineAccountCopy = Object.freeze({
  ru: { title: 'Черновики на этом устройстве', intro: 'Перед выходом выберите, что сделать с ещё не отправленными записями.', count: 'Ожидают отправки', owner: 'Они принадлежат текущему аккаунту. Другой аккаунт не увидит и не отправит их в свою команду. На общем устройстве сохранённые локальные файлы могут быть доступны человеку с доступом к браузеру.', backup: 'Скачать полную копию ZIP', backupHint: 'ZIP содержит тексты и сами фото. Храните его приватно. Для восстановления распакуйте архив: manifest.json и папка photos. Это не резервная копия всей команды.', downloading: 'Готовим копию…', downloaded: 'Архив передан браузеру. Убедитесь, что скачивание завершилось, прежде чем удалять черновики.', keep: 'Выйти и оставить черновики', discard: 'Выйти и удалить с устройства', confirm: 'Я понимаю: неотправленные черновики будут удалены с этого устройства без возможности восстановления. Сохранённые в команде материалы останутся.', cancel: 'Вернуться', error: 'Не удалось прочитать или скачать черновики. Сохраните их на устройстве и повторите позже.', unavailable: 'Локальное хранилище недоступно. Выход сохранит имеющиеся черновики; удалить их безопасно сейчас нельзя.' },
  en: { title: 'Drafts on this device', intro: 'Before signing out, choose what happens to records that have not been sent.', count: 'Waiting to send', owner: 'These drafts belong to the current account. Another account cannot view them or send them to its team. On a shared device, someone with access to the browser may be able to access local files.', backup: 'Download complete ZIP backup', backupHint: 'The ZIP includes text and the actual photos. Keep it private. Extract manifest.json and the photos folder to recover them. This is not a full team backup.', downloading: 'Preparing backup…', downloaded: 'The archive was passed to your browser. Check that the download finished before deleting drafts.', keep: 'Sign out and keep drafts', discard: 'Sign out and delete from device', confirm: 'I understand: unsent drafts will be permanently deleted from this device. Materials already saved to the team remain.', cancel: 'Go back', error: 'Could not read or download drafts. Keep them on this device and try again later.', unavailable: 'Local storage is unavailable. Signing out will keep existing drafts; they cannot be safely deleted now.' },
  kk: { title: 'Осы құрылғыдағы жазбалар', intro: 'Шығар алдында әлі жіберілмеген жазбалармен не істеу керегін таңдаңыз.', count: 'Жіберуді күтуде', owner: 'Бұл жазбалар ағымдағы аккаунтқа тиесілі. Басқа аккаунт оларды көрмейді және өз командасына жібере алмайды. Ортақ құрылғыда браузерге қол жеткізе алатын адам жергілікті файлдарға қол жеткізуі мүмкін.', backup: 'Толық ZIP көшірмесін жүктеу', backupHint: 'ZIP ішінде мәтіндер мен фотолардың өзі бар. Оны құпия сақтаңыз. Қалпына келтіру үшін manifest.json мен photos қалтасын архивтен шығарыңыз. Бұл бүкіл команданың резервтік көшірмесі емес.', downloading: 'Көшірме дайындалуда…', downloaded: 'Архив браузерге берілді. Жазбаларды жоймас бұрын жүктеудің аяқталғанын тексеріңіз.', keep: 'Шығу және жазбаларды сақтау', discard: 'Шығу және құрылғыдан жою', confirm: 'Түсінемін: жіберілмеген жазбалар осы құрылғыдан біржола жойылады. Командада сақталған материалдар қалады.', cancel: 'Кері оралу', error: 'Жазбаларды оқу не жүктеу мүмкін болмады. Оларды құрылғыда сақтап, кейін қайталаңыз.', unavailable: 'Жергілікті қойма қолжетімсіз. Шыққанда бар жазбалар сақталады; оларды қазір қауіпсіз жою мүмкін емес.' },
});
const backupPrivacy={ru:'Исходные фото в архиве могут содержать EXIF/GPS и видимые личные сведения.',en:'Original photos in the archive may include EXIF/GPS and visible personal information.',kk:'Архивтегі бастапқы фотоларда EXIF/GPS және көрінетін жеке мәліметтер болуы мүмкін.'};

/** This is a local choice only; it never sends drafts or signs out by itself. */
export async function prepareOfflineSignout({ userId, locale = 'ru' }, { box = createOutbox() } = {}) {
  const copy = offlineAccountCopy[locale] || offlineAccountCopy.ru; let rows, unavailable = false;
  try { rows = await box.list(userId); } catch { rows = []; unavailable = true; }
  if (!rows.length && !unavailable) return { choice: 'keep', count: 0 };
  return new Promise(resolve => {
    const focus = document.activeElement, modal = document.createElement('dialog'); modal.className = 'wm-dialog ws-offline-signout';
    const node = (tag, text, className = '') => { const value = document.createElement(tag); value.textContent = text; value.className = className; return value; };
    const title = node('h2', copy.title); title.id = 'ws-offline-signout-title'; modal.setAttribute('aria-labelledby', title.id);
    const status = node('p', '', 'wm-status'); status.setAttribute('role', 'status');
    const tools = node('div', '', 'wm-tools'), keep = node('button', copy.keep, 'wm-button'), discard = node('button', copy.discard, 'wm-button'), cancel = node('button', copy.cancel, 'wm-button'), backup = node('button', copy.backup, 'wm-button');
    for (const control of [keep, discard, cancel, backup]) control.type = 'button';
    const label = node('label', '', 'ws-offline-discard'), confirm = document.createElement('input'); confirm.type = 'checkbox'; label.append(confirm, node('span', copy.confirm)); discard.disabled = true;
    let closed = false, preparing = false;
    function finish(result) { if (closed) return; closed = true; modal.close(); modal.remove(); if (focus instanceof HTMLElement && focus.isConnected) focus.focus(); resolve(result); }
    keep.onclick = () => finish({ choice: 'keep', count: rows.length }); discard.onclick = () => { if (confirm.checked && !unavailable) finish({ choice: 'discard', count: rows.length }); }; cancel.onclick = () => finish(null);
    confirm.onchange = () => { discard.disabled = !confirm.checked; };
    backup.onclick = async () => { preparing = true; backup.disabled = true; keep.disabled = discard.disabled = cancel.disabled = true; status.textContent = copy.downloading;
      try { await downloadOfflineBackup(rows, userId); status.textContent = copy.downloaded; } catch { status.textContent = copy.error; }
      finally { preparing = false; backup.disabled = false; keep.disabled = cancel.disabled = false; discard.disabled = !confirm.checked; } };
    tools.append(keep, discard, cancel); modal.append(title, node('p', copy.intro), node('p', copy.owner, 'wm-meta'));
    if (unavailable) { modal.append(node('p', copy.unavailable, 'wm-status')); backup.hidden = label.hidden = discard.hidden = true; }
    else modal.append(node('p', copy.count + ': ' + new Intl.NumberFormat(locale).format(rows.length)), backup, node('p', copy.backupHint+' '+(backupPrivacy[locale]||backupPrivacy.ru), 'wm-meta'), label);
    modal.append(status, tools); modal.addEventListener('cancel', event => { event.preventDefault(); if (!preparing) finish(null); }); document.body.append(modal); modal.showModal();
  });
}

/** Run only after a successful server signout. Deletion is explicitly chosen and owner-scoped. */
export async function finishOfflineSignout({ userId, choice = 'keep' }, { box = createOutbox(), clearContext = clearOfflineContext } = {}) {
  await clearContext();
  try { localStorage.setItem('iznera.offline-context-cleared.v1', String(Date.now())); } catch { /* Focus refresh remains available when browser storage is restricted. */ }
  globalThis.navigator?.serviceWorker?.controller?.postMessage('clear-private-data');
  if (choice === 'discard') return box.discardAll(userId);
  return 0;
}
