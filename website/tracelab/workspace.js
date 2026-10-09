import { store } from './workspace-store.js';
import { renderGraph,renderTestChart,renderStudyChart,renderTimeline } from './workspace-views.js';

const host=document.querySelector('[data-workspace]');
const labels={source:'Материал',iteration:'Итерация',test:'Испытание',decision:'Решение'};
const allowedViews=['graph','timeline','tests','history','study'];
const searchParams=new URLSearchParams(location.search);
let activeView=allowedViews.includes(searchParams.get('view'))?searchParams.get('view'):'graph';
let selectedId=searchParams.get('record')||'DEC-01';
let cleanup=()=>{};
let replayTimer=null;
let editingId=null;
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const dateLabel=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Дата не указана':date.toLocaleString('ru',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
function feedback(message,error=false){const element=$('#ws-feedback');element.textContent=message;element.dataset.error=String(error);}
function guarded(action){try{action();}catch(error){feedback(error.message||'Не удалось выполнить действие.',true);}}
function personalProject(){if(store.getProject().dataKind==='synthetic'){feedback('Создайте свой проект или используйте учебный пример как основу, чтобы добавлять записи.',true);return false;}return true;}
function filteredRecords(project){const query=$('#ws-search').value.trim().toLocaleLowerCase('ru');const kind=$('#ws-kind').value;return project.records.filter(record=>(kind==='all'||record.kind===kind)&&(!query||[record.id,record.title,record.body,record.author,record.rationale].join(' ').toLocaleLowerCase('ru').includes(query)));}
function selectRecord(id){
  const active=document.activeElement;
  const selectors=['.wv-node','.wv-record-button','.wv-test-row','.wv-measurement-select','.wv-timeline-button','.ws-record-list button'];
  const controlSelector=selectors.find(selector=>active?.matches?.(selector));
  const fromInspector=Boolean(active?.closest?.('#ws-inspector'));
  selectedId=id;const url=new URL(location.href);url.searchParams.set('record',id);history.replaceState(null,'',url);render();
  const replacement=controlSelector?[...document.querySelectorAll(controlSelector)].find(control=>control.getAttribute('aria-label')?.startsWith(id+'.')||control.getAttribute('aria-label')?.startsWith(id+':')||control.querySelector('.wv-record-id')?.textContent===id||control.dataset.selectRecord===id):null;
  if(replacement)replacement.focus({preventScroll:true});
  else if(fromInspector){const heading=$('#ws-inspector h2');heading.tabIndex=-1;heading.focus({preventScroll:true});}
}
function stopReplay(){clearInterval(replayTimer);replayTimer=null;const button=$('#ws-replay');button.textContent='Воспроизвести историю';button.setAttribute('aria-pressed','false');}
function switchView(view,focus=false){stopReplay();activeView=view;const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState(null,'',url);render();if(focus)$(`[data-view="${view}"]`).focus();}
function renderInspector(project){
  const inspector=$('#ws-inspector');
  const record=project.records.find(item=>item.id===selectedId);
  if(!record){inspector.innerHTML='<h2>Выберите запись</h2><p>Нажмите узел графа, событие хронологии или строку испытания. Здесь появятся источник, авторское объяснение и связанные записи.</p>';return;}
  const links=project.links.filter(link=>(link.from===record.id||link.to===record.id)&&link.status!=='rejected');
  const accepted=links.filter(link=>!link.status||link.status==='accepted');
  const related=links.map(link=>({link,record:project.records.find(item=>item.id===(link.from===record.id?link.to:link.from))})).filter(item=>item.record);
  const tests=accepted.map(link=>project.records.find(item=>item.id===(link.from===record.id?link.to:link.from))).filter(item=>item?.kind==='test');
  const result=record.kind==='test'&&Number.isFinite(record.trials)&&Number.isFinite(record.successes)?`${record.successes} из ${record.trials} (${Math.round(record.successes/record.trials*100)}%)`:'';
  const rationale=record.rationale?.trim();
  const why=record.kind==='decision'?`<section class="ws-evidence-note"><strong>Почему принято это решение?</strong><p>${rationale?escape(rationale):'Авторское объяснение не добавлено.'}</p><p>${tests.length?`Связанные испытания: ${tests.map(test=>escape(test.id)).join(', ')}.`:'Связанное испытание не указано. Основание пока не задокументировано полностью.'}</p></section>`:'';
  const notes=record.annotationHistory?.length?`<details class="ws-note-history"><summary>История заметок · ${record.annotationHistory.length}</summary>${record.annotationHistory.map(note=>`<article><p>${escape(note.body)}</p><small>${escape(note.field)} · ${escape(note.authorUserId)} · ${escape(dateLabel(note.createdAt))}<br>Происхождение: ${escape(note.provenance||'не указано')} · ${escape(note.sourceMethod||'не указано')}</small></article>`).join('')}</details>`:'';
  inspector.innerHTML=`<div class="ws-record-id">${escape(labels[record.kind])} · ${escape(record.id)}</div><h2>${escape(record.title)}</h2><p>${escape(record.body||'Описание ещё не добавлено.')}</p><dl><div><dt>Автор</dt><dd>${escape(record.author||'Автор не указан')}</dd></div><div><dt>Дата</dt><dd>${escape(dateLabel(record.createdAt))}</dd></div>${record.revision?`<div><dt>Версия</dt><dd>${escape(record.revision)}</dd></div>`:''}${result?`<div><dt>Результат</dt><dd>${escape(result)}</dd></div>`:''}${Number.isFinite(record.measuredValue)?`<div><dt>Измерение</dt><dd>${escape(record.measuredValue)} ${escape(record.unit||'единица не указана')}</dd></div>`:''}</dl>${record.conditions?`<h3>Условия и процедура</h3><p>${escape(record.conditions)}</p>`:''}${record.criterion?`<h3>Критерий успеха</h3><p>${escape(record.criterion)}</p>`:''}${why}<h3>Связанные записи</h3>${related.length?related.map(item=>`<button class="ws-related-button" type="button" data-select-record="${escape(item.record.id)}"><strong>${escape(item.record.title)}</strong><span>${escape(item.record.id)} · ${escape(item.link.label)}${item.link.status==='suggested'?' · предложенная связь':''}</span></button>`).join(''):'<p>Связи пока не добавлены.</p>'}${project.dataKind!=='synthetic'?`<button class="ws-text-action ws-edit-record" type="button" data-edit-record="${escape(record.id)}">Изменить запись</button><form id="ws-link-form"><h3>Добавить связь</h3><label for="ws-link-target">Связать выбранную запись с<select id="ws-link-target" name="to" required><option value="">Выберите запись</option>${project.records.filter(item=>item.id!==record.id).map(item=>`<option value="${escape(item.id)}">${escape(item.title)} · ${escape(labels[item.kind])}</option>`).join('')}</select></label><label for="ws-link-label">Что означает связь<input id="ws-link-label" name="label" maxlength="160" required value="Подтверждает"></label><button class="button light-outline" type="submit">Сохранить связь</button></form>`:''}`;
  if(notes)inspector.insertAdjacentHTML('beforeend',notes);
  inspector.querySelector('#ws-link-form')?.addEventListener('submit',event=>{event.preventDefault();const fields=new FormData(event.target);guarded(()=>{store.addLink({from:record.id,to:String(fields.get('to')),label:String(fields.get('label')),status:'accepted',origin:'local'});feedback('Связь сохранена в проекте.');});});
}
function renderHistory(project){
  const records=filteredRecords(project).sort((left,right)=>new Date(right.createdAt)-new Date(left.createdAt));
  const view=$('#ws-view');
  if(!records.length){view.innerHTML='<div class="ws-empty"><h2>Подходящих записей нет</h2><p>Измените запрос или фильтр. В новом проекте начните с материала, испытания или решения.</p></div>';return;}
  view.innerHTML=`<div class="ws-record-list">${records.map(record=>`<button type="button" data-select-record="${escape(record.id)}" aria-current="${String(record.id===selectedId)}"><div><strong>${escape(record.title)}</strong><small>${escape(record.id)} · ${escape(record.author||'Автор не указан')} · ${escape(dateLabel(record.createdAt))}</small><small>${escape((record.rationale||record.body||'Описание пока не добавлено.').slice(0,180))}</small></div><span class="ws-record-kind">${escape(labels[record.kind])}</span></button>`).join('')}</div>`;
}
function render(){
  if(!host)return;
  cleanup();cleanup=()=>{};
  const state=store.getState();const project=store.getProject();
  $('#ws-project').innerHTML=state.projects.map(item=>`<option value="${escape(item.id)}" ${item.id===project.id?'selected':''}>${escape(item.name)}</option>`).join('');
  const synthetic=project.dataKind==='synthetic';
  $('#ws-data-kind').textContent=synthetic?'Учебный пример · вымышленные данные':'Локальный проект · ваши записи и импортированные данные';
  $('#ws-storage').textContent=store.storageStatus==='persistent'?'Сохранено в этом браузере':'Хранение в памяти · скачайте JSON';
  $('#ws-context').textContent=synthetic?'Участники, даты и результаты 6/10 → 9/10 вымышлены. Выберите запись, чтобы увидеть её связи и авторское объяснение. Для своих данных создайте проект или импортируйте JSON.':`Записи хранятся на этом устройстве. ${store.storageMessage||'Скачивайте JSON для резервной копии или переноса проекта.'}`;
  if(!synthetic&&project.educationalOrigin)$('#ws-context').textContent+=' Проект создан из учебного примера: исходные записи и числа вымышлены. Замените их своими данными.';
  $('#ws-import-notes').hidden=!project.importWarnings?.length;
  $('#ws-import-notes').textContent=(project.importWarnings||[]).join('\n');
  $('#ws-counts').textContent=`${project.records.length} записей · ${project.records.filter(item=>item.kind==='test').length} испытаний · ${project.records.filter(item=>item.kind==='decision').length} решений`;
  $('#ws-copy-project').hidden=!synthetic;
  $('#ws-add-record').disabled=synthetic;
  $('#ws-add-record').title=synthetic?'Сначала создайте свой проект или скопируйте пример':'';
  $('#ws-add-study').disabled=synthetic;
  $('#ws-import-csv').disabled=synthetic;
  for(const button of document.querySelectorAll('[data-view]')){const active=button.dataset.view===activeView;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  $('#ws-panel').setAttribute('aria-labelledby',`ws-tab-${activeView}`);
  $('#ws-timeline-actions').hidden=activeView!=='timeline';
  $('#ws-study-actions').hidden=activeView!=='study';
  $('.ws-search-label').hidden=activeView==='tests'||activeView==='study';
  $('#ws-kind').closest('label').hidden=activeView==='tests'||activeView==='study';
  $('.ws-workarea').dataset.wide=String(activeView==='study');
  const options={selectedId,query:$('#ws-search').value.trim(),kind:$('#ws-kind').value,onSelect:selectRecord};
  if(activeView==='graph')cleanup=renderGraph($('#ws-view'),project,options)||(()=>{});
  else if(activeView==='timeline')cleanup=renderTimeline($('#ws-view'),project,options)||(()=>{});
  else if(activeView==='tests')cleanup=renderTestChart($('#ws-view'),project,{onSelect:selectRecord})||(()=>{});
  else if(activeView==='study')cleanup=renderStudyChart($('#ws-view'),project)||(()=>{});
  else renderHistory(project);
  renderInspector(project);
}
function localDate(value=new Date()){const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function configureRecordFields(){const kind=$('#ws-record-kind').value;$('#ws-test-fields').hidden=kind!=='test';$('#ws-decision-fields').hidden=kind!=='decision';}
function openRecord(id=null){
  if(!personalProject())return;
  editingId=id;const project=store.getProject();const record=project.records.find(item=>item.id===id);
  const form=$('#ws-record-form');form.reset();form.querySelector('.ws-form-error').textContent='';
  $('#ws-record-form-title').textContent=record?'Изменить запись':'Добавить запись';
  $('#ws-record-kind').disabled=Boolean(record);
  if(record){for(const [key,value] of Object.entries(record)){const field=form.elements.namedItem(key);if(field&&value!==undefined)field.value=String(value);}}
  $('#ws-record-date').value=localDate(record?.createdAt);
  $('#ws-record-related').innerHTML='<option value="">Свяжу позже</option>'+project.records.filter(item=>item.id!==id).map(item=>`<option value="${escape(item.id)}">${escape(item.title)} · ${escape(labels[item.kind])}</option>`).join('');
  $('#ws-record-related').closest('label').hidden=Boolean(record);
  configureRecordFields();$('#ws-record-dialog').showModal();
}
function download(content,type,filename){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportReport(){
  const project=store.getProject();
  const disclaimer=project.dataKind==='synthetic'?'Учебные данные: участники, даты и измерения вымышлены. Это не результаты исследования TraceLab.':project.educationalOrigin?'Проект создан на основе учебного примера. Исходные участники, даты и измерения вымышлены. Пользовательские изменения не проверены.':'Локальные данные проекта, введённые или импортированные пользователем. Этот отчёт не подтверждает достоверность или исследовательский эффект.';
  const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(project.name)} — TraceLab</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:auto;padding:32px;color:#202620}h1,h2{line-height:1.25}section{padding:22px 0;border-top:1px solid #ccc}aside{padding:20px;background:#f0f4ed}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #ccc}p{white-space:pre-wrap}small{color:#465246}</style><h1>${escape(project.name)}</h1><p>${escape(project.description)}</p><aside>${escape(disclaimer)}</aside><h2>Записи</h2>${project.records.map(record=>`<section><small>${escape(labels[record.kind])} · ${escape(record.id)} · ${escape(record.createdAt)} · ${escape(record.author)}</small><h2>${escape(record.title)}</h2><p>${escape(record.body)}</p>${record.rationale?`<h3>Авторское объяснение</h3><p>${escape(record.rationale)}</p>`:''}${Number.isFinite(record.trials)?`<p>Результат: ${escape(record.successes)} из ${escape(record.trials)} попыток.</p>`:''}${Number.isFinite(record.measuredValue)?`<p>Измерение: ${escape(record.measuredValue)} ${escape(record.unit||"единица не указана")}</p>`:""}${record.conditions?`<p>Условия: ${escape(record.conditions)}</p>`:''}${record.criterion?`<p>Критерий: ${escape(record.criterion)}</p>`:''}</section>`).join('')}<h2>Связи</h2><table><thead><tr><th>От записи</th><th>К записи</th><th>Значение</th><th>Статус</th></tr></thead><tbody>${project.links.map(link=>`<tr><td>${escape(link.from)}</td><td>${escape(link.to)}</td><td>${escape(link.label)}</td><td>${escape(link.status||'accepted')}</td></tr>`).join('')}</tbody></table><h2>Парные замеры исследования</h2>${project.studyRows.length?`<table><thead><tr><th>Код</th><th>До, с</th><th>С TraceLab, с</th></tr></thead><tbody>${project.studyRows.map(row=>`<tr><td>${escape(row.participantCode)}</td><td>${escape(row.baselineSeconds)}</td><td>${escape(row.traceSeconds)}</td></tr>`).join('')}</tbody></table>`:'<p>Замеры не добавлены.</p>'}</html>`;
  download(html,'text/html;charset=utf-8','tracelab-project-report.html');feedback('HTML-отчёт скачан с записями, связями и пометкой о происхождении данных.');
}
function parseCsv(text){
  if(text.length>2*1024*1024)throw new Error('CSV слишком большой. Максимум — 2 MiB.');
  const rows=[];let row=[],value='',quoted=false;
  for(let index=0;index<=text.length;index++){const character=text[index]??'\n';if(character==='"'){if(quoted&&text[index+1]==='"'){value+='"';index++;}else quoted=!quoted;}else if((character===','||character===';'||character==='\n')&&!quoted){row.push(value.replace(/\r$/,'').trim());value='';if(character==='\n'){if(row.some(item=>item))rows.push(row);row=[];}}else value+=character;}
  if(quoted)throw new Error('В CSV не закрыты кавычки.');
  const headers=(rows.shift()||[]).map(value=>value.replace(/^\uFEFF/,'').toLowerCase());
  const code=headers.indexOf('participant_code'),baseline=headers.indexOf('baseline_seconds'),trace=headers.indexOf('trace_seconds');
  if([code,baseline,trace].some(index=>index<0))throw new Error('Нужны столбцы participant_code, baseline_seconds и trace_seconds. Скачайте шаблон CSV.');
  if(!rows.length)throw new Error('В CSV нет измерений.');
  if(rows.length+store.getProject().studyRows.length>1000)throw new Error('Максимум — 1000 парных замеров в проекте.');
  const codes=new Set(store.getProject().studyRows.map(row=>row.participantCode));
  for(const [index,cells] of rows.entries()){const participant=cells[code]||'';if(codes.has(participant))throw new Error(`Код участника повторяется в строке ${index+2}. Используйте уникальный код для каждой пары.`);codes.add(participant);}
  return rows.map((cells,index)=>{const participantCode=cells[code]||'',baselineSeconds=Number(cells[baseline]),traceSeconds=Number(cells[trace]);if(!participantCode||participantCode.length>80||!cells[baseline]||!cells[trace]||!Number.isFinite(baselineSeconds)||baselineSeconds<0||!Number.isFinite(traceSeconds)||traceSeconds<0)throw new Error(`Проверьте код и неотрицательные числа в строке ${index+2}.`);return {participantCode,baselineSeconds,traceSeconds};});
}

if(host){
  const requestedProject=searchParams.get('project');
  if(requestedProject&&store.getState().projects.some(project=>project.id===requestedProject))store.selectProject(requestedProject);
  for(const button of document.querySelectorAll('[data-view]')){
    button.addEventListener('click',()=>switchView(button.dataset.view));
    button.addEventListener('keydown',event=>{const index=allowedViews.indexOf(button.dataset.view);let next;if(event.key==='ArrowRight')next=(index+1)%allowedViews.length;if(event.key==='ArrowLeft')next=(index+allowedViews.length-1)%allowedViews.length;if(event.key==='Home')next=0;if(event.key==='End')next=allowedViews.length-1;if(next!==undefined){event.preventDefault();switchView(allowedViews[next],true);}});
  }
  $('#ws-project').addEventListener('change',event=>guarded(()=>{stopReplay();selectedId=null;store.selectProject(event.target.value);feedback('Открыт выбранный проект.');}));
  $('#ws-search').addEventListener('input',()=>{stopReplay();render();});
  $('#ws-kind').addEventListener('change',()=>{stopReplay();render();});
  $('#ws-panel').addEventListener('click',event=>{const related=event.target.closest('[data-select-record]');const edit=event.target.closest('[data-edit-record]');if(related)selectRecord(related.dataset.selectRecord);if(edit)openRecord(edit.dataset.editRecord);});
  $('#ws-create-project').addEventListener('click',()=>{$('#ws-project-form').reset();$('#ws-project-form .ws-form-error').textContent='';$('#ws-project-dialog').showModal();});
  $('#ws-project-form').addEventListener('submit',event=>{event.preventDefault();const fields=new FormData(event.target);try{const id=store.createProject({name:String(fields.get('name')),description:String(fields.get('description'))});selectedId=null;store.selectProject(id);$('#ws-project-dialog').close();feedback('Проект создан. Теперь добавьте первую запись.');}catch(error){event.target.querySelector('.ws-form-error').textContent=error.message;}});
  $('#ws-copy-project').addEventListener('click',()=>guarded(()=>{const project=store.getProject();const id=store.importProject(JSON.stringify({...project,name:'Мой проект — на основе учебного примера',dataKind:'personal',educationalOrigin:true}));store.selectProject(id);selectedId=store.getProject().records.find(record=>record.kind==='decision')?.id||null;render();feedback('Создана отдельная редактируемая копия. Исходные числа учебные; замените их своими измерениями.');}));
  $('#ws-add-record').addEventListener('click',()=>openRecord());
  $('#ws-record-kind').addEventListener('change',configureRecordFields);
  $('#ws-record-form').addEventListener('submit',event=>{
    event.preventDefault();const form=event.target,fields=new FormData(form);
    try{const existing=store.getProject().records.find(record=>record.id===editingId);const kind=existing?.kind||String(fields.get('kind'));const values={kind,title:String(fields.get('title')),body:String(fields.get('body')),author:String(fields.get('author')||'Автор не указан'),createdAt:new Date(String(fields.get('createdAt'))).toISOString(),revision:String(fields.get('revision')||'')};
      if(kind==='decision')values.rationale=String(fields.get('rationale')||'');
      if(kind==='test'){for(const key of ['trials','successes','measuredValue']){const value=String(fields.get(key)||'').trim();values[key]=value!==''?Number(value):null;}for(const key of ['unit','conditions','criterion'])values[key]=String(fields.get(key)||'');}
      if(existing){store.updateRecord(existing.id,values);selectedId=existing.id;}else{selectedId=store.addRecord(values);const related=String(fields.get('related')||'');if(related)store.addLink({from:related,to:selectedId,label:kind==='decision'?'Основание решения':'Следующий этап',status:'accepted',origin:'local'});}
      $('#ws-record-dialog').close();render();feedback('Запись сохранена. Граф, хронология и диаграммы обновлены.');
    }catch(error){form.querySelector('.ws-form-error').textContent=error.message||'Проверьте заполненные поля.';}
  });
  for(const dialog of document.querySelectorAll('.ws-dialog'))dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  $('#ws-import').addEventListener('click',()=>$('#ws-import-file').click());
  $('#ws-import-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('JSON слишком большой. Максимум — 2 MiB.');const id=store.importProject(await file.text());selectedId=null;store.selectProject(id);feedback('Проект импортирован. Старые проекты сохранены.');}catch(error){feedback(error.message,true);}finally{event.target.value='';}});
  $('#ws-export-json').addEventListener('click',()=>guarded(()=>{download(store.exportProject(),'application/json;charset=utf-8','tracelab-project.json');feedback('JSON проекта скачан. Он содержит записи, связи и происхождение данных.');}));
  $('#ws-export-html').addEventListener('click',()=>guarded(exportReport));
  $('#ws-add-study').addEventListener('click',()=>{if(!personalProject())return;$('#ws-study-form').reset();$('#ws-study-form .ws-form-error').textContent='';$('#ws-study-dialog').showModal();});
  $('#ws-study-form').addEventListener('submit',event=>{event.preventDefault();const fields=new FormData(event.target);try{store.addStudyRow({participantCode:String(fields.get('participantCode')),baselineSeconds:Number(fields.get('baselineSeconds')),traceSeconds:Number(fields.get('traceSeconds'))});$('#ws-study-dialog').close();feedback('Парный замер добавлен. Диаграмма обновлена.');}catch(error){event.target.querySelector('.ws-form-error').textContent=error.message;}});
  $('#ws-import-csv').addEventListener('click',()=>{if(personalProject())$('#ws-csv-file').click();});
  $('#ws-csv-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('CSV слишком большой. Максимум — 2 MiB.');const rows=parseCsv(await file.text());for(const row of rows)store.addStudyRow(row);feedback(`Импортировано парных замеров: ${rows.length}.`);}catch(error){feedback(error.message,true);}finally{event.target.value='';}});
  $('#ws-replay').addEventListener('click',()=>{if(replayTimer){stopReplay();return;}const sequence=filteredRecords(store.getProject()).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));if(!sequence.length){feedback('Для воспроизведения нужны записи.');return;}let index=0;selectedId=sequence[0].id;render();$('#ws-replay').textContent='Остановить воспроизведение';$('#ws-replay').setAttribute('aria-pressed','true');replayTimer=setInterval(()=>{index++;if(index>=sequence.length){stopReplay();feedback('История просмотрена до последней записи.');return;}selectedId=sequence[index].id;render();$('#ws-replay').textContent='Остановить воспроизведение';$('#ws-replay').setAttribute('aria-pressed','true');},2200);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopReplay();});
  store.subscribe(()=>{const project=store.getProject();const url=new URL(location.href);url.searchParams.set('project',project.id);if(!project.records.some(record=>record.id===selectedId))url.searchParams.delete('record');history.replaceState(null,'',url);stopReplay();render();});
  render();
}
