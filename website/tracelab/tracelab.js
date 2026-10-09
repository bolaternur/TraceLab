const stages = [
  { kind:'Материал', date:'12 сентября · 14:20', title:'С чего началось изменение', description:'Команда заметила: деталь выскальзывает из захвата. Сохранили исходную модель и запись наблюдения, чтобы проверить причину.', details:[['Источник','Модель захвата v01'],['Автор записи','Участник А · учебный профиль']], status:'Материал связан с испытанием', sourceTitle:'Испытание TEST-01', source:'На исходном захвате провели 10 попыток подъёма одной и той же детали. Масса — 180 г, высота подъёма — 20 см. Успешны 6 из 10 попыток. Все значения учебные.' },
  { kind:'Испытание', date:'12 сентября · 15:10', title:'Проверили исходный захват', description:'Деталь выскользнула в четырёх попытках. Команда сохранила результат, условия испытания и ссылку на проверенную версию модели.', details:[['Условия','180 г · подъём на 20 см'],['Результат','6 успешных попыток из 10'],['Связанная версия','gripper-v01.step']], status:'Испытание связано с исходной моделью', sourceTitle:'Материал SRC-01', source:'Исходная модель gripper-v01.step, версия 01. Наблюдение автора: «Во время подъёма контактная поверхность не удерживает деталь». Учебная запись участника А.' },
  { kind:'Решение', date:'12 сентября · 16:35', title:'Почему изменили поверхность', description:'Добавить мягкие накладки и увеличить площадь контакта. Основание — срывы детали в испытании TEST-01. Это пояснение автора, а не автоматически придуманный вывод.', details:[['Основание','TEST-01 · 4 срыва из 10'],['Автор решения','Участник Б · учебный профиль'],['Альтернатива','Увеличить усилие захвата']], status:'Решение ссылается на испытание TEST-01', sourceTitle:'Пояснение DEC-01', source:'«Сначала меняем контактную поверхность. Увеличение усилия может повредить деталь; для этой альтернативы пока нет отдельного испытания». Иллюстративное объяснение участника Б.' },
  { kind:'Новая версия', date:'14 сентября · 11:40', title:'Что проверили после изменения', description:'В модели v02 добавили накладки. Повторили подъём с той же деталью и высотой, связав новое испытание с решением и изменённой моделью.', details:[['Новая модель','gripper-v02.step'],['Повторный тест','9 успешных попыток из 10'],['Связанное решение','DEC-01 · изменить поверхность']], status:'Новая версия связана с решением и повторным тестом', sourceTitle:'Испытание TEST-02', source:'Повторили 10 попыток: масса 180 г, высота 20 см. Успешны 9 попыток. Это вымышленные данные для демонстрации связей, а не измеренный эффект TraceLab.' }
];

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#site-nav');
function closeMenu() { nav?.removeAttribute('data-open'); menuButton?.setAttribute('aria-expanded','false'); menuButton?.setAttribute('aria-label','Открыть меню'); }
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label',open ? 'Закрыть меню' : 'Открыть меню');
  nav.dataset.open = String(open);
});
nav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') { closeMenu(); menuButton.focus(); } });

for (const widget of document.querySelectorAll('[data-trace]')) {
  const tabs = [...widget.querySelectorAll('[data-stage]')];
  const panel = widget.querySelector('.trace-content');
  const sourceButton = widget.querySelector('#record-source');
  const detail = widget.querySelector('#source-detail');
  const replay = widget.querySelector('[data-replay]');
  let current = 0;
  let timer = null;
  function stopReplay(completed = false) {
    clearInterval(timer); timer = null;
    replay.setAttribute('aria-pressed','false');
    replay.querySelector('span').textContent = completed ? 'Повторить историю' : 'Пройти историю';
  }
  function selectStage(index, focus = false) {
    current = index;
    const stage = stages[index];
    tabs.forEach((tab, position) => { tab.setAttribute('aria-selected',String(position === index)); tab.tabIndex = position === index ? 0 : -1; });
    panel.setAttribute('aria-labelledby',tabs[index].id);
    widget.querySelector('#record-kind').textContent = stage.kind;
    widget.querySelector('#record-date').textContent = stage.date;
    widget.querySelector('#record-title').textContent = stage.title;
    widget.querySelector('#record-description').textContent = stage.description;
    widget.querySelector('#record-details').innerHTML = stage.details.map(([label,value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
    widget.querySelector('#trace-status').textContent = stage.status;
    detail.hidden = true;
    sourceButton.setAttribute('aria-expanded','false');
    panel.classList.remove('is-updating');
    requestAnimationFrame(() => panel.classList.add('is-updating'));
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab,index) => {
    tab.addEventListener('click', () => { stopReplay(); selectStage(index); });
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); stopReplay(); selectStage(next,true); }
    });
  });
  sourceButton.setAttribute('aria-controls','source-detail');
  sourceButton.setAttribute('aria-expanded','false');
  sourceButton.addEventListener('click', () => {
    stopReplay();
    const stage = stages[current];
    detail.innerHTML = `<strong>${escapeHtml(stage.sourceTitle)}</strong><p>${escapeHtml(stage.source)}</p>`;
    detail.hidden = !detail.hidden;
    sourceButton.setAttribute('aria-expanded',String(!detail.hidden));
  });
  replay.setAttribute('aria-pressed','false');
  replay.addEventListener('click', () => {
    if (timer) { stopReplay(); return; }
    selectStage(0);
    replay.setAttribute('aria-pressed','true');
    replay.querySelector('span').textContent = 'Остановить';
    timer = setInterval(() => { if (current >= stages.length - 1) stopReplay(true); else selectStage(current + 1); },3000);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopReplay(); });
}

document.querySelector('[data-missing]')?.addEventListener('click', () => {
  const result = document.querySelector('#missing-result');
  result.hidden = false;
  document.querySelector('[data-missing]').setAttribute('aria-expanded','true');
});

const sample = { project:'Захват', dataKind:'synthetic-educational-example', disclaimer:'Участники, даты и измерения вымышлены. Эти данные не являются результатами исследования TraceLab.', stages, links:[['SRC-01','TEST-01'],['TEST-01','DEC-01'],['DEC-01','gripper-v02.step'],['gripper-v02.step','TEST-02']] };
for (const button of document.querySelectorAll('[data-export]')) {
  button.addEventListener('click', () => {
    const kind = button.dataset.export;
    let content;
    if (kind === 'json') content = JSON.stringify(sample,null,2);
    else content = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TraceLab — учебный пример</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:800px;padding:32px;margin:auto;color:#202520}h1,h2{line-height:1.2}section{border-top:1px solid #ddd;padding:24px 0}dt{font-weight:bold}dd{margin:0 0 12px}aside{background:#f1f4ed;padding:16px}table{border-collapse:collapse}td,th{padding:12px;border:1px solid #ccc;text-align:left}</style><h1>История изменения захвата</h1><aside>${escapeHtml(sample.disclaimer)}</aside>${stages.map(stage => `<section><h2>${escapeHtml(stage.kind)}: ${escapeHtml(stage.title)}</h2><p>${escapeHtml(stage.description)}</p><dl>${stage.details.map(([label,value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl><h3>${escapeHtml(stage.sourceTitle)}</h3><p>${escapeHtml(stage.source)}</p></section>`).join('')}<section><h2>Связи исходных записей</h2><table><thead><tr><th>Откуда</th><th>Куда</th></tr></thead><tbody>${sample.links.map(([from,to]) => `<tr><td>${escapeHtml(from)}</td><td>${escapeHtml(to)}</td></tr>`).join('')}</tbody></table></section></html>`;
    const file = new Blob([content],{ type:kind === 'json' ? 'application/json;charset=utf-8' : 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `tracelab-educational-example.${kind}`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
    document.querySelector('#export-status').textContent = `Учебный пример выгружен в ${kind.toUpperCase()}. Пометка о вымышленных данных сохранена.`;
  });
}
