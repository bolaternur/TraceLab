import { store as localStore } from './workspace-store.js';
import { createServerWorkspace } from './workspace-server.js';
import { renderTestChart,renderStudyChart,renderTimeline } from './workspace-views.js';
import { renderCanvas } from './workspace-canvas.js';
import { mountProductControls, previewServerImport as showImportPreview } from './workspace-product-controls.js';
import { setWorkspaceLocale, getWorkspaceLocale, formatDate, formatNumber, formatPercent, recordType } from './workspace-i18n.js';
import { createOutbox, setOfflineContext } from './workspace-outbox.js';
import { applyWorkspaceShellLocale, shellT, workspaceErrorText } from './workspace-shell-i18n.js';
import {mountHistoryFilters,readHistoryFilters,filterHistoryRecords} from './workspace-filters.js';
import {appendRecordHistory,appendConflictingDrafts} from './workspace-record-history.js';

const host=document.querySelector('[data-workspace]');
const serverMode=document.body.dataset.runtime==='server'&&!location.pathname.startsWith('/demo/');
let store=localStore;
const outbox=createOutbox();
try{const preference=localStorage.getItem('tracelab-locale');if(['ru','en','kk'].includes(preference))setWorkspaceLocale(preference);}catch{}
if(serverMode){
  try{store=await createServerWorkspace();}
  catch(error){host.innerHTML='';const notice=document.createElement('section');notice.className='ws-empty';const heading=document.createElement('h1');heading.textContent=shellT('error.unavailable');const message=document.createElement('p');message.textContent=workspaceErrorText(error);const retry=document.createElement('button');retry.className='ws-app-primary';retry.textContent=shellT('common.retry');retry.onclick=()=>location.reload();const home=document.createElement('a');home.href='/';home.textContent=shellT('common.home');notice.append(heading,message,retry,home);host.append(notice);throw error;}
}
let initialLocale=serverMode?store.serverContext.user.locale:'ru';
try{initialLocale=localStorage.getItem('tracelab-locale')||initialLocale;}catch{}
setWorkspaceLocale(['ru','en','kk'].includes(initialLocale)?initialLocale:'ru',serverMode?store.serverContext.team.timezone:Intl.DateTimeFormat().resolvedOptions().timeZone);
const allowedViews=['graph','timeline','tests','history','study','gallery','models','sources','inbox','chat'];
const searchParams=new URLSearchParams(location.search);
let activeView=allowedViews.includes(searchParams.get('view'))?searchParams.get('view'):'graph';
let selectedId=searchParams.get('record')||'DEC-01';
let cleanup=()=>{};
let replayTimer=null;
let editingId=null;
let inspectorOpen=false;
let inspectorWidth=360;
let connectionOrigin=null;
let historyFilters;
try{const panels=JSON.parse(localStorage.getItem('tracelab.workspace.panels.v1')||'{}');inspectorOpen=panels.open===true&&innerWidth>800;inspectorWidth=Math.max(280,Math.min(520,Number(panels.width)||360));}catch{/* Browser storage may be unavailable. */}
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const dateLabel=formatDate;
const previewServerImport=input=>showImportPreview(store,input,id=>{selectedId=null;render();feedback(shellT('feedback.importedTeam'));});
function offlineContext(){const context=store.serverContext;return{userId:context.user.id,displayName:context.user.displayName,teamId:context.team.id,teamName:context.team.name,projectId:context.activeProjectId,projectName:store.getProject().name};}
async function syncOutbox(){if(!serverMode)return;try{const result=await outbox.flush(store.serverContext.user.id);if(result.sent){await store.refresh();feedback(shellT('feedback.outboxSent',{count:result.sent}));}if(result.pending)feedback(shellT('feedback.outboxPending',{count:result.pending}),true);}catch{/* Drafts remain in the owner-scoped outbox for explicit retry. */}}
function feedback(message,error=false){const element=$('#ws-feedback');element.textContent=message;element.title=message;element.dataset.error=String(error);}
async function guarded(action){try{return await action();}catch(error){feedback(workspaceErrorText(error),true);}}
async function preserveCanvasFocus(action){const active=document.activeElement;const recordId=active?.dataset?.recordId;const label=active?.getAttribute('aria-label');const port=active?.dataset?.port;await action();const replacement=recordId?[...document.querySelectorAll(port?'.wc-port':'.wc-node')].find(control=>control.dataset.recordId===recordId&&(!port||control.dataset.port===port)):[...document.querySelectorAll('.wc-button')].find(control=>label&&control.getAttribute('aria-label')===label);replacement?.focus({preventScroll:true});}
async function copyExample(){const project=store.getProject();const id=await store.importProject(JSON.stringify({...project,name:shellT('project.copyName'),dataKind:'personal',educationalOrigin:true}));await store.selectProject(id);feedback(shellT('feedback.copied'));return id;}
async function personalProject(){if(store.getProject().dataKind==='synthetic')await copyExample();return true;}
function setInspector(open){inspectorOpen=open;host.dataset.inspectorOpen=String(open);$('#ws-toggle-inspector').dataset.wsLabel=open?'toolbar.hideInspector':'toolbar.showInspector';$('#ws-toggle-inspector').dataset.wsTitle=open?'toolbar.hideInspector':'toolbar.showInspector';$('#ws-toggle-inspector').setAttribute('aria-expanded',String(open));$('#ws-toggle-inspector').setAttribute('aria-label',open?shellT('toolbar.hideInspector'):shellT('toolbar.showInspector'));$('#ws-toggle-inspector').title=open?shellT('toolbar.hideInspector'):shellT('toolbar.showInspector');try{localStorage.setItem('tracelab.workspace.panels.v1',JSON.stringify({open,width:inspectorWidth}));}catch{/* Panel preferences are optional. */}}
function setInspectorWidth(width){inspectorWidth=Math.max(280,Math.min(520,width));host.style.setProperty('--inspector-width',inspectorWidth+'px');$('#ws-inspector-resize').setAttribute('aria-valuenow',String(inspectorWidth));setInspector(inspectorOpen);}
async function openConnection(pair={}){
  const active=document.activeElement;connectionOrigin={recordId:active?.dataset?.recordId,port:active?.dataset?.port,id:active?.id};
  await personalProject();const project=store.getProject();
  if(project.records.length<2){feedback(shellT('error.twoRecords'),true);return;}
  const form=$('#ws-connect-form');form.reset();form.querySelector('.ws-form-error').textContent='';
  $('#ws-connect-from').innerHTML=project.records.map(record=>`<option value="${escape(record.id)}">${escape(record.title)} · ${escape(record.id)}</option>`).join('');
  $('#ws-connect-from').value=pair.from||selectedId||project.records[0].id;if(!$('#ws-connect-from').value)$('#ws-connect-from').selectedIndex=0;
  updateConnectionTargets(pair.to);$('#ws-connect-dialog').showModal();
}
function updateConnectionTargets(to){const from=$('#ws-connect-from').value;$('#ws-connect-to').innerHTML=`<option value="">${escape(shellT('inspector.choose'))}</option>`+store.getProject().records.filter(record=>record.id!==from).map(record=>`<option value="${escape(record.id)}">${escape(record.title)} · ${escape(record.id)}</option>`).join('');if(to)$('#ws-connect-to').value=to;}
function filteredRecords(project){const query=$('#ws-search').value.trim().toLocaleLowerCase(getWorkspaceLocale());const kind=$('#ws-kind').value;return project.records.filter(record=>(kind==='all'||record.kind===kind)&&(!query||[record.id,record.title,record.body,record.author,record.rationale].join(' ').toLocaleLowerCase(getWorkspaceLocale()).includes(query)));}
function selectRecord(id){
  const active=document.activeElement;
  const selectors=['.wc-node','.wc-record-button','.wc-port','.wv-test-row','.wv-measurement-select','.wv-timeline-button','.ws-record-list button'];
  const controlSelector=selectors.find(selector=>active?.matches?.(selector));
  const fromInspector=Boolean(active?.closest?.('#ws-inspector'));
  selectedId=id;const url=new URL(location.href);if(id)url.searchParams.set('record',id);else url.searchParams.delete('record');history.replaceState(null,'',url);setInspector(Boolean(id));render();
  const replacement=controlSelector?[...document.querySelectorAll(controlSelector)].find(control=>control.dataset.recordId===id||control.getAttribute('aria-label')?.startsWith(id+'.')||control.getAttribute('aria-label')?.startsWith(id+':')||control.querySelector('.wv-record-id')?.textContent===id||control.dataset.selectRecord===id):null;
  if(replacement)replacement.focus({preventScroll:true});
  else if(fromInspector){const heading=$('#ws-inspector h2');heading.tabIndex=-1;heading.focus({preventScroll:true});}
}
function stopReplay(){clearInterval(replayTimer);replayTimer=null;const button=$('#ws-replay');button.textContent=shellT('timeline.replay');button.setAttribute('aria-pressed','false');}
function switchView(view,focus=false){stopReplay();activeView=view;const url=new URL(location.href);url.searchParams.set('view',view);history.pushState(null,'',url);render();if(focus)$(`[role="tab"][data-view="${view}"]`).focus();}
function renderInspector(project){
  const inspector=$('#ws-inspector');
  const record=project.records.find(item=>item.id===selectedId);
  if(!record){inspector.innerHTML=`<h2>${escape(shellT('inspector.choose'))}</h2><p>${escape(shellT('inspector.empty'))}</p>`;return;}
  const links=project.links.filter(link=>(link.from===record.id||link.to===record.id)&&link.status!=='rejected');
  const accepted=links.filter(link=>!link.status||link.status==='accepted');
  const related=links.map(link=>({link,record:project.records.find(item=>item.id===(link.from===record.id?link.to:link.from))})).filter(item=>item.record);
  const tests=accepted.map(link=>project.records.find(item=>item.id===(link.from===record.id?link.to:link.from))).filter(item=>item?.kind==='test');
  const result=record.kind==='test'&&Number.isFinite(record.trials)&&Number.isFinite(record.successes)?shellT('inspector.resultRatio',{successes:formatNumber(record.successes),trials:formatNumber(record.trials),percent:formatPercent(record.successes/record.trials)}):'';
  const rationale=record.rationale?.trim();
  const why=record.kind==='decision'?`<section class="ws-evidence-note"><strong>${escape(shellT('inspector.why'))}</strong><p>${rationale?escape(rationale):shellT('inspector.noRationale')}</p><p>${tests.length?escape(shellT('inspector.linkedTests',{tests:tests.map(test=>test.id).join(', ')})):shellT('inspector.noTests')}</p></section>`:'';
  const notes=record.annotationHistory?.length?`<details class="ws-note-history"><summary>${escape(shellT('inspector.noteHistory'))} · ${record.annotationHistory.length}</summary>${record.annotationHistory.map(note=>`<article><p>${escape(note.body)}</p><small>${escape(note.field)} · ${escape(note.authorUserId)} · ${escape(dateLabel(note.createdAt))}<br>${escape(shellT('inspector.provenance'))}: ${escape(note.provenance||shellT('common.notProvided'))} · ${escape(note.sourceMethod||shellT('common.notProvided'))}</small></article>`).join('')}</details>`:'';
  inspector.innerHTML=`<div class="ws-record-id">${escape(recordType(record.kind))} · ${escape(record.id)}</div><h2>${escape(record.title)}</h2><p>${escape(record.body||shellT('inspector.noDescription'))}</p><dl><div><dt>${escape(shellT('record.author'))}</dt><dd>${escape(record.author||shellT('inspector.noAuthor'))}</dd></div><div><dt>${escape(shellT('inspector.date'))}</dt><dd>${escape(dateLabel(record.createdAt))}</dd></div>${record.revision?`<div><dt>${escape(shellT('inspector.version'))}</dt><dd>${escape(record.revision)}</dd></div>`:''}${result?`<div><dt>${escape(shellT('inspector.result'))}</dt><dd>${escape(result)}</dd></div>`:''}${Number.isFinite(record.measuredValue)?`<div><dt>${escape(shellT('inspector.measurement'))}</dt><dd>${escape(record.measuredValue)} ${escape(record.unit||shellT('inspector.noUnit'))}</dd></div>`:''}</dl>${record.conditions?`<h3>${escape(shellT('test.conditions'))}</h3><p>${escape(record.conditions)}</p>`:''}${record.criterion?`<h3>${escape(shellT('test.criterion'))}</h3><p>${escape(record.criterion)}</p>`:''}${why}<h3>${escape(shellT('inspector.related'))}</h3>${related.length?related.map(item=>`<button class="ws-related-button" type="button" data-select-record="${escape(item.record.id)}"><strong>${escape(item.record.title)}</strong><span>${escape(item.record.id)} · ${escape(item.link.label)}${item.link.status==='suggested'?' · '+escape(shellT('inspector.suggested')):''}</span></button>`).join(''):`<p>${escape(shellT('inspector.noLinks'))}</p>`}${project.dataKind!=='synthetic'?`<button class="ws-text-action ws-edit-record" type="button" data-edit-record="${escape(record.id)}">${escape(shellT('record.edit'))}</button><form id="ws-link-form"><h3>${escape(shellT('connection.add'))}</h3><label for="ws-link-target">${escape(shellT('connection.selectedTo'))}<select id="ws-link-target" name="to" required><option value="">${escape(shellT('inspector.choose'))}</option>${project.records.filter(item=>item.id!==record.id).map(item=>`<option value="${escape(item.id)}">${escape(item.title)} · ${escape(recordType(item.kind))}</option>`).join('')}</select></label><label for="ws-link-label">${escape(shellT('connection.what'))}<input id="ws-link-label" name="label" maxlength="160" required value="${escape(shellT('connection.supports'))}"></label><button class="button light-outline" type="submit">${escape(shellT('connection.save'))}</button></form>`:''}`;
  if(notes)inspector.insertAdjacentHTML('beforeend',notes);
  appendRecordHistory(inspector,record);
  if(canManageGraphRecord(record.id)){
    const hidden=project.hiddenRecordIds?.includes(record.id),action=document.createElement('button');
    action.type='button';action.className='ws-text-action';action.textContent=shellT(hidden?'record.restoreGraph':'record.hideGraph');
    action.addEventListener('click',()=>guarded(()=>hidden?restoreGraphRecord(record.id):hideGraphRecord(record.id)));inspector.append(action);
  }
  if(serverMode)appendConflictingDrafts(inspector,store.serverContext.conflictDrafts?.filter(item=>item.projectId===project.id&&item.recordId===record.id),draft=>guarded(()=>openRecord(record.id,draft.record)));
  if(serverMode&&!store.serverContext.editableRecordIds?.[project.id]?.includes(record.id))inspector.querySelector('[data-edit-record]')?.remove();
  if(serverMode&&!['student','student_lead'].includes(store.serverContext.role))inspector.querySelector('#ws-link-form')?.remove();
  inspector.querySelector('#ws-link-form')?.addEventListener('submit',event=>{event.preventDefault();const fields=new FormData(event.target);guarded(async()=>{await store.addLink({from:record.id,to:String(fields.get('to')),label:String(fields.get('label')),status:'accepted',origin:'local'});feedback(shellT('feedback.linkSaved'));});});
}
function canManageGraphRecord(id){return !serverMode || store.serverContext.role==='student_lead' || (store.serverContext.role==='student' && store.serverContext.editableRecordIds?.[store.getProject().id]?.includes(id));}
async function hideGraphRecord(id){if(!await personalProject())return;await store.hideRecord(id);selectedId=null;render();feedback(shellT('feedback.recordHidden'));}
async function restoreGraphRecord(id){await store.restoreRecord(id);render();feedback(shellT('feedback.recordRestored'));}
function renderHistory(project){
  const direction=readHistoryFilters(new URLSearchParams(location.search)).order==='oldest'?1:-1;
  const records=filteredRecords(project).sort((left,right)=>direction*(new Date(left.createdAt)-new Date(right.createdAt)));
  const view=$('#ws-view');
  if(!records.length){view.innerHTML=`<div class="ws-empty"><h2>${escape(shellT('history.noMatch'))}</h2><p>${escape(shellT('history.noMatchHint'))}</p></div>`;return;}
  view.innerHTML=`<div class="ws-record-list">${records.map(record=>`<button type="button" data-select-record="${escape(record.id)}" aria-current="${String(record.id===selectedId)}"><div><strong>${escape(record.title)}</strong><small>${escape(record.id)} · ${escape(record.author||shellT('inspector.noAuthor'))} · ${escape(dateLabel(record.createdAt))}</small><small>${escape((record.rationale||record.body||shellT('inspector.noDescriptionShort')).slice(0,180))}</small></div><span class="ws-record-kind">${escape(recordType(record.kind))}</span></button>`).join('')}</div>`;
}
function render(){
  if(!host)return;
  applyWorkspaceShellLocale(document);
  $('#ws-replay').textContent=shellT(replayTimer?'timeline.stop':'timeline.replay');
  if($('#ws-record-dialog').open)$('#ws-record-form-title').textContent=shellT(editingId?'record.edit':'toolbar.addRecord');
  cleanup();cleanup=()=>{};
  const state=store.getState();const project=store.getProject();
  if(serverMode)setWorkspaceLocale(getWorkspaceLocale(),store.serverContext.team.timezone);
  const historyState=readHistoryFilters(new URLSearchParams(location.search));
  historyFilters?.render(project,activeView==='timeline'||activeView==='history');
  const historyProject={...project,records:filterHistoryRecords(project.records,historyState)};
  host.dataset.view=activeView;
  $('#ws-project').innerHTML=state.projects.map(item=>`<option value="${escape(item.id)}" ${item.id===project.id?'selected':''}>${escape(item.name)}</option>`).join('');
  const synthetic=project.dataKind==='synthetic';
  $('#ws-data-kind').textContent=synthetic?shellT('storage.synthetic'):project.educationalOrigin?shellT('storage.copy'):serverMode?`${shellT('storage.team')} · ${store.serverContext.team.name}`:shellT('storage.local');
  $('#ws-storage').textContent=serverMode?(store.storageStatus==='syncing'?shellT('storage.syncing'):store.storageStatus==='failed'?shellT('storage.failed'):shellT('storage.savedTeam')):(store.storageStatus==='persistent'?shellT('storage.savedLocal'):shellT('storage.memory'));
  $('#ws-context').textContent=synthetic?shellT('storage.syntheticHint'):`${shellT('storage.device')} ${store.storageMessage||shellT('storage.backup')}`;
  if(!synthetic&&project.educationalOrigin)$('#ws-context').textContent+=" "+shellT('storage.copyHint')+"";
  $('#ws-import-notes').hidden=!project.importWarnings?.length;
  $('#ws-import-notes').textContent=(project.importWarnings||[]).join('\n');
  $('#ws-counts').textContent=shellT('project.counts',{records:formatNumber(project.records.length),tests:formatNumber(project.records.filter(item=>item.kind==='test').length),decisions:formatNumber(project.records.filter(item=>item.kind==='decision').length)});
  $('#ws-copy-project').hidden=!synthetic;
  $('#ws-edit-example').hidden=!synthetic;
  const canWrite=!serverMode||['student','student_lead'].includes(store.serverContext.role);
  $('#ws-add-record').disabled=!canWrite;
  $('#ws-add-record').title=synthetic?shellT('record.addCopy'):shellT('toolbar.addRecord');
  $('#ws-add-study').disabled=!canWrite;
  $('#ws-import-csv').disabled=!canWrite;
  $('#ws-connect').disabled=!canWrite;
  if(serverMode)$('#ws-context').textContent=store.storageMessage;
  for(const button of document.querySelectorAll('[role="tab"][data-view]')){const active=button.dataset.view===activeView;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  $('#ws-panel').setAttribute('aria-labelledby',`ws-tab-${activeView}`);
  $('#ws-timeline-actions').hidden=activeView!=='timeline';
  $('#ws-study-actions').hidden=activeView!=='study';
  $('#ws-connect').hidden=activeView!=='graph'&&activeView!=='history';
  const standalone=['study','gallery','models','sources','inbox','chat'].includes(activeView);
  $('.ws-tools').hidden=['gallery','models','sources','inbox','chat'].includes(activeView);
  $('#ws-toggle-inspector').hidden=standalone;
  $('.ws-search-label').hidden=activeView==='tests'||standalone;
  $('#ws-kind').closest('label').hidden=activeView==='tests'||standalone;
  $('.ws-workarea').dataset.wide=String(standalone);
  const options={selectedId,query:$('#ws-search').value.trim(),kind:$('#ws-kind').value,onSelect:selectRecord};
  if(activeView==='graph')cleanup=renderCanvas($('#ws-view'),project,{...options,onConnect:pair=>guarded(()=>openConnection(pair)),onMove:(id,position)=>guarded(()=>preserveCanvasFocus(()=>store.setNodePosition(id,position))),onResetLayout:()=>guarded(()=>preserveCanvasFocus(()=>store.resetNodePositions())),onHideRecord:id=>guarded(()=>hideGraphRecord(id)),onRestoreRecord:id=>guarded(()=>restoreGraphRecord(id)),canHideRecord:canManageGraphRecord,onRemoveLink:id=>guarded(async()=>{await personalProject();await store.removeLink(id);feedback(shellT('feedback.linkRemoved'));}),onError:message=>feedback(message,true)})||(()=>{});
  else if(activeView==='timeline')cleanup=renderTimeline($('#ws-view'),historyProject,{...options,order:historyState.order})||(()=>{});
  else if(activeView==='tests')cleanup=renderTestChart($('#ws-view'),project,{onSelect:selectRecord})||(()=>{});
  else if(activeView==='study')cleanup=renderStudyChart($('#ws-view'),project)||(()=>{});
  else if(activeView==='gallery'||activeView==='models'){
    const view=activeView,target=$('#ws-view');target.innerHTML=`<div class="ws-empty" role="status">${escape(shellT('common.loading'))}</div>`;let cancelled=false;
    cleanup=()=>{cancelled=true;};
    if(serverMode)import('./workspace-media.js').then(({mountWorkspaceMedia})=>{if(cancelled)return;const dispose=mountWorkspaceMedia(target,{teamId:store.serverContext.team.id,projectId:project.id,mode:view,role:store.serverContext.role,onChanged:()=>store.refresh()});cleanup=typeof dispose==='function'?dispose:()=>{cancelled=true;};}).catch(error=>{if(!cancelled){target.textContent=workspaceErrorText(error);}});
    else target.innerHTML=`<div class="ws-empty"><h2>${escape(shellT('media.title'))}</h2><p>${escape(shellT('media.signinHint'))}</p><a href="/auth?mode=signin">${escape(shellT('common.signin'))}</a></div>`;
  }else if(activeView==='sources'){
    const target=$('#ws-view');target.innerHTML=`<div class="ws-empty" role="status">${escape(shellT('common.loading'))}</div>`;let cancelled=false;cleanup=()=>{cancelled=true;};
    if(serverMode)import('./workspace-sources.js').then(({mountWorkspaceSources})=>{if(cancelled)return;const dispose=mountWorkspaceSources(target,{teamId:store.serverContext.team.id,projectId:project.id,role:store.serverContext.role,onChanged:()=>store.refresh()});cleanup=typeof dispose==='function'?dispose:()=>{cancelled=true;};}).catch(error=>{if(!cancelled)target.textContent=workspaceErrorText(error);});
    else target.innerHTML=`<div class="ws-empty"><p>${escape(shellT('media.signinHint'))}</p><a href="/auth?mode=signin">${escape(shellT('common.signin'))}</a></div>`;
  }else if(activeView==='chat'){
    const target=$('#ws-view');target.innerHTML=`<div class="ws-empty" role="status">${escape(shellT('common.loading'))}</div>`;let cancelled=false;cleanup=()=>{cancelled=true;};
    if(serverMode)import('./workspace-chat.js').then(({mountWorkspaceChat})=>{if(cancelled)return;const dispose=mountWorkspaceChat(target,{teamId:store.serverContext.team.id,teamName:store.serverContext.team.name,userId:store.serverContext.user.id});cleanup=()=>{cancelled=true;dispose?.();};}).catch(error=>{if(!cancelled)target.textContent=workspaceErrorText(error);});
    else target.innerHTML=`<div class="ws-empty"><p>${escape(shellT('media.signinHint'))}</p><a href="/auth?mode=signin">${escape(shellT('common.signin'))}</a></div>`;
  }else if(activeView==='inbox'){
    const target=$('#ws-view');target.innerHTML=`<div class="ws-empty" role="status">${escape(shellT('common.loading'))}</div>`;let cancelled=false;cleanup=()=>{cancelled=true;};
    if(serverMode)import('./workspace-inbox.js').then(({mountWorkspaceInbox})=>{if(cancelled)return;const dispose=mountWorkspaceInbox(target,{teamId:store.serverContext.team.id,projectId:project.id,role:store.serverContext.role,onChanged:()=>store.refresh(),onSelectRecord:id=>{switchView('graph');selectRecord(id);},onCreateIteration:()=>guarded(async()=>{await openRecord();$('#ws-record-kind').value='iteration';configureRecordFields();})});cleanup=typeof dispose==='function'?dispose:()=>{cancelled=true;};}).catch(error=>{if(!cancelled)target.textContent=workspaceErrorText(error);});
    else target.innerHTML=`<div class="ws-empty"><p>${escape(shellT('media.signinHint'))}</p><a href="/auth?mode=signin">${escape(shellT('common.signin'))}</a></div>`;
  }else renderHistory(historyProject);
  renderInspector(project);
}
function localDate(value=new Date()){const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function configureRecordFields(){const kind=$('#ws-record-kind').value;$('#ws-test-fields').hidden=kind!=='test';$('#ws-decision-fields').hidden=kind!=='decision';}
async function openRecord(id=null,proposal=null){
  if(!await personalProject())return;
  editingId=id;const project=store.getProject();const record=project.records.find(item=>item.id===id);
  const form=$('#ws-record-form');form.reset();form.querySelector('.ws-form-error').textContent='';
  $('#ws-record-form-title').textContent=record?shellT('record.edit'):shellT('toolbar.addRecord');
  $('#ws-record-kind').disabled=Boolean(record);
  if(record){for(const [key,value] of Object.entries(proposal||record)){const field=form.elements.namedItem(key);if(field&&value!==undefined)field.value=String(value);}}
  $('#ws-record-date').value=localDate(proposal?.createdAt||record?.createdAt);
  if(serverMode){$('#ws-record-author').value=store.serverContext.user.displayName;$('#ws-record-author').readOnly=true;}
  $('#ws-record-status').value=proposal?.status||record?.status||'draft';
  $('#ws-record-related').innerHTML=`<option value="">${escape(shellT('record.later'))}</option>`+project.records.filter(item=>item.id!==id).map(item=>`<option value="${escape(item.id)}">${escape(item.title)} · ${escape(recordType(item.kind))}</option>`).join('');
  $('#ws-record-related').closest('label').hidden=Boolean(record);
  configureRecordFields();$('#ws-record-dialog').showModal();
}
function download(content,type,filename){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportReport(){
  const project=store.getProject();
  const disclaimer=project.dataKind==='synthetic'?shellT('report.synthetic'):project.educationalOrigin?shellT('report.copy'):shellT('report.local');
  const html=`<!doctype html><html lang="${getWorkspaceLocale()}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(project.name)} — Iznera</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:auto;padding:32px;color:#202620}h1,h2{line-height:1.25}section{padding:22px 0;border-top:1px solid #ccc}aside{padding:20px;background:#f0f4ed}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #ccc}p{white-space:pre-wrap}small{color:#465246}</style><h1>${escape(project.name)}</h1><p>${escape(project.description)}</p><aside>${escape(disclaimer)}</aside><h2>${escape(shellT('report.records'))}</h2>${project.records.map(record=>`<section><small>${escape(recordType(record.kind))} · ${escape(record.id)} · ${escape(record.createdAt)} · ${escape(record.author)}</small><h2>${escape(record.title)}</h2><p>${escape(record.body)}</p>${record.rationale?`<h3>${escape(shellT('decision.explanation'))}</h3><p>${escape(record.rationale)}</p>`:''}${Number.isFinite(record.trials)?`<p>${escape(shellT('inspector.result'))}: ${escape(record.successes)} ${escape(shellT('report.of'))} ${escape(record.trials)} ${escape(shellT('report.attempts'))}</p>`:''}${Number.isFinite(record.measuredValue)?`<p>${escape(shellT('inspector.measurement'))}: ${escape(record.measuredValue)} ${escape(record.unit||shellT('inspector.noUnit'))}</p>`:""}${record.conditions?`<p>${escape(shellT('report.conditions'))}: ${escape(record.conditions)}</p>`:''}${record.criterion?`<p>${escape(shellT('report.criterion'))}: ${escape(record.criterion)}</p>`:''}</section>`).join('')}<h2>${escape(shellT('report.links'))}</h2><table><thead><tr><th>${escape(shellT('report.from'))}</th><th>${escape(shellT('report.to'))}</th><th>${escape(shellT('report.meaning'))}</th><th>${escape(shellT('report.status'))}</th></tr></thead><tbody>${project.links.map(link=>`<tr><td>${escape(link.from)}</td><td>${escape(link.to)}</td><td>${escape(link.label)}</td><td>${escape(link.status||'accepted')}</td></tr>`).join('')}</tbody></table><h2>${escape(shellT('report.paired'))}</h2>${project.studyRows.length?`<table><thead><tr><th>${escape(shellT('report.code'))}</th><th>${escape(shellT('report.before'))}</th><th>${escape(shellT('report.with'))}</th></tr></thead><tbody>${project.studyRows.map(row=>`<tr><td>${escape(row.participantCode)}</td><td>${escape(row.baselineSeconds)}</td><td>${escape(row.traceSeconds)}</td></tr>`).join('')}</tbody></table>`:`<p>${escape(shellT('report.noMeasurements'))}</p>`}</html>`;
  download(html,'text/html;charset=utf-8','iznera-project-report.html');feedback(shellT('feedback.report'));
}
function parseCsv(text){
  if(text.length>2*1024*1024)throw new Error(shellT('error.csvLarge'));
  const rows=[];let row=[],value='',quoted=false;
  for(let index=0;index<=text.length;index++){const character=text[index]??'\n';if(character==='"'){if(quoted&&text[index+1]==='"'){value+='"';index++;}else quoted=!quoted;}else if((character===','||character===';'||character==='\n')&&!quoted){row.push(value.replace(/\r$/,'').trim());value='';if(character==='\n'){if(row.some(item=>item))rows.push(row);row=[];}}else value+=character;}
  if(quoted)throw new Error(shellT('error.csvQuotes'));
  const headers=(rows.shift()||[]).map(value=>value.replace(/^\uFEFF/,'').toLowerCase());
  const code=headers.indexOf('participant_code'),baseline=headers.indexOf('baseline_seconds'),trace=headers.indexOf('trace_seconds');
  if([code,baseline,trace].some(index=>index<0))throw new Error(shellT('error.csvColumns'));
  if(!rows.length)throw new Error(shellT('error.csvEmpty'));
  if(rows.length+store.getProject().studyRows.length>1000)throw new Error(shellT('error.measurementLimit'));
  const codes=new Set(store.getProject().studyRows.map(row=>row.participantCode));
  for(const [index,cells] of rows.entries()){const participant=cells[code]||'';if(codes.has(participant))throw new Error(shellT('error.csvDuplicate',{row:index+2}));codes.add(participant);}
  return rows.map((cells,index)=>{const participantCode=cells[code]||'',baselineSeconds=Number(cells[baseline]),traceSeconds=Number(cells[trace]);if(!participantCode||participantCode.length>80||!cells[baseline]||!cells[trace]||!Number.isFinite(baselineSeconds)||baselineSeconds<0||!Number.isFinite(traceSeconds)||traceSeconds<0)throw new Error(shellT('error.csvRow',{row:index+2}));return {participantCode,baselineSeconds,traceSeconds};});
}

if(host){
  mountProductControls({store,localStore,serverMode,onLocale:render,onError:error=>feedback(workspaceErrorText(error),true),onImport:()=>{selectedId=null;render();}});
  historyFilters=mountHistoryFilters($('.ws-tools'),()=>{stopReplay();render();});
  if(serverMode){await setOfflineContext(offlineContext()).catch(()=>feedback(shellT('error.offlineStorage'),true));addEventListener('online',syncOutbox);syncOutbox();if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});}
  const requestedProject=searchParams.get('project');
  if(requestedProject&&store.getState().projects.some(project=>project.id===requestedProject)&&store.getProject().id!==requestedProject)await store.selectProject(requestedProject);
  for(const button of document.querySelectorAll('[role="tab"][data-view]')){
    button.addEventListener('click',()=>switchView(button.dataset.view));
    button.addEventListener('keydown',event=>{const index=allowedViews.indexOf(button.dataset.view);let next;if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%allowedViews.length;if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index+allowedViews.length-1)%allowedViews.length;if(event.key==='Home')next=0;if(event.key==='End')next=allowedViews.length-1;if(next!==undefined){event.preventDefault();switchView(allowedViews[next],true);}});
  }
  $('#ws-project').addEventListener('change',event=>guarded(async()=>{stopReplay();selectedId=null;await store.selectProject(event.target.value);feedback(shellT('feedback.opened'));}));
  $('#ws-search').value=searchParams.get('q')||'';
  $('#ws-kind').value=['source','iteration','test','decision'].includes(searchParams.get('kind'))?searchParams.get('kind'):'all';
  const filterChanged=()=>{stopReplay();const url=new URL(location.href);for(const [key,value] of [['q',$('#ws-search').value.trim()],['kind',$('#ws-kind').value]]){if(value&&value!=='all')url.searchParams.set(key,value);else url.searchParams.delete(key);}history.replaceState(null,'',url);render();};
  $('#ws-search').addEventListener('input',filterChanged);
  $('#ws-kind').addEventListener('change',filterChanged);
  addEventListener('popstate',()=>{const params=new URLSearchParams(location.search);activeView=allowedViews.includes(params.get('view'))?params.get('view'):'graph';selectedId=params.get('record');$('#ws-search').value=params.get('q')||'';$('#ws-kind').value=params.get('kind')||'all';stopReplay();render();});
  $('#ws-panel').addEventListener('click',event=>{const related=event.target.closest('[data-select-record]');const edit=event.target.closest('[data-edit-record]');if(related)selectRecord(related.dataset.selectRecord);if(edit)guarded(()=>openRecord(edit.dataset.editRecord));});
  $('#ws-create-project').addEventListener('click',()=>{$('#ws-project-form').reset();$('#ws-project-form .ws-form-error').textContent='';$('#ws-project-dialog').showModal();});
  $('#ws-project-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.target,fields=new FormData(form),submit=form.querySelector('[type="submit"]');submit.disabled=true;try{const id=await store.createProject({name:String(fields.get('name')),description:String(fields.get('description'))});selectedId=null;await store.selectProject(id);$('#ws-project-dialog').close();feedback(shellT('feedback.projectCreated'));}catch(error){form.querySelector('.ws-form-error').textContent=workspaceErrorText(error);}finally{submit.disabled=false;}});
  $('#ws-copy-project').addEventListener('click',()=>guarded(copyExample));
  $('#ws-edit-example').addEventListener('click',()=>guarded(copyExample));
  $('#ws-toggle-inspector').addEventListener('click',()=>setInspector(!inspectorOpen));
  $('#ws-close-inspector').addEventListener('click',()=>{setInspector(false);$('#ws-toggle-inspector').focus();});
  $('#ws-open-help').addEventListener('click',()=>$('#ws-help-dialog').showModal());
  $('#ws-connect').addEventListener('click',()=>guarded(()=>openConnection()));
  $('#ws-connect-from').addEventListener('change',()=>updateConnectionTargets());
  $('#ws-connect-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.target,fields=new FormData(form),submit=form.querySelector('[type="submit"]');submit.disabled=true;try{const relationType=String(fields.get('relationType'));const meanings={RELATED_TO:shellT('connection.related'),SUPPORTS:shellT('connection.supports'),LEADS_TO:shellT('connection.leads'),CONTRADICTS:shellT('connection.contradicts'),SUPERSEDES:shellT('connection.supersedes')};await store.addLink({from:String(fields.get('from')),to:String(fields.get('to')),label:String(fields.get('label')).trim()||meanings[relationType],relationType,status:'accepted',origin:'student'});$('#ws-connect-dialog').close();feedback(shellT('feedback.connectionCreated'));}catch(error){form.querySelector('.ws-form-error').textContent=workspaceErrorText(error);}finally{submit.disabled=false;}});
  $('#ws-connect-dialog').addEventListener('close',()=>{if($('#ws-connect-dialog').open)return;const origin=connectionOrigin;const current=document.activeElement;if(!current||current===document.body||!current.isConnected||$('#ws-connect-dialog').contains(current)){const replacement=origin?.recordId?[...document.querySelectorAll(origin.port?'.wc-port':'.wc-node')].find(control=>control.dataset.recordId===origin.recordId&&(!origin.port||control.dataset.port===origin.port)):origin?.id?document.getElementById(origin.id):null;(replacement||$('#ws-connect')).focus({preventScroll:true});}connectionOrigin=null;});
  $('#ws-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{feedback(shellT('feedback.fullscreen'));}});
  document.addEventListener('fullscreenchange',()=>{const active=Boolean(document.fullscreenElement);$('#ws-fullscreen').dataset.wsLabel=active?'toolbar.exitFullscreen':'toolbar.fullscreen';$('#ws-fullscreen').dataset.wsTitle=active?'toolbar.exitFullscreen':'toolbar.fullscreen';$('#ws-fullscreen').setAttribute('aria-pressed',String(active));$('#ws-fullscreen').setAttribute('aria-label',active?shellT('toolbar.exitFullscreen'):shellT('toolbar.fullscreen'));$('#ws-fullscreen').title=shellT(active?'toolbar.exitFullscreen':'toolbar.fullscreen');});
  const resize=$('#ws-inspector-resize');
  resize.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();const start=event.clientX,width=inspectorWidth;resize.setPointerCapture(event.pointerId);const move=next=>setInspectorWidth(width+start-next.clientX);const end=()=>{resize.removeEventListener('pointermove',move);resize.removeEventListener('pointerup',end);resize.removeEventListener('pointercancel',end);};resize.addEventListener('pointermove',move);resize.addEventListener('pointerup',end);resize.addEventListener('pointercancel',end);});
  resize.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setInspectorWidth(inspectorWidth+(event.key==='ArrowLeft'?20:-20));}});
  document.addEventListener('click',event=>{const menu=$('#ws-project-menu');if(!menu.contains(event.target)||event.target.closest('.ws-menu-popover button'))menu.open=false;});
  $('#ws-add-record').addEventListener('click',()=>guarded(()=>openRecord()));
  $('#ws-record-kind').addEventListener('change',configureRecordFields);
  $('#ws-record-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target,fields=new FormData(form);
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try{const existing=store.getProject().records.find(record=>record.id===editingId);const kind=existing?.kind||String(fields.get('kind'));const values={kind,title:String(fields.get('title')),body:String(fields.get('body')),author:String(fields.get('author')||shellT('inspector.noAuthor')),createdAt:new Date(String(fields.get('createdAt'))).toISOString(),revision:String(fields.get('revision')||'')};
      if(kind==='decision'){values.rationale=String(fields.get('rationale')||'');values.status=String(fields.get('status')||'draft');}
      if(kind==='test'){for(const key of ['trials','successes','measuredValue']){const value=String(fields.get(key)||'').trim();values[key]=value!==''?Number(value):null;}for(const key of ['unit','conditions','criterion'])values[key]=String(fields.get(key)||'');}
      if(serverMode&&!navigator.onLine&&!existing){const related=String(fields.get('related')||'');if(related)values.relatedRecordId=related;await outbox.enqueue(offlineContext(),values);$('#ws-record-dialog').close();feedback(shellT('feedback.queued'));return;}
      if(existing){await store.updateRecord(existing.id,values);selectedId=existing.id;}else{const related=String(fields.get('related')||'');if(serverMode&&related)values.relatedRecordId=related;selectedId=await store.addRecord(values);if(related&&!serverMode)await store.addLink({from:related,to:selectedId,label:kind==='decision'?shellT('connection.rationale'):shellT('connection.next'),status:'accepted',origin:'local'});}
      $('#ws-record-dialog').close();render();feedback(shellT('feedback.recordSaved'));
    }catch(error){form.querySelector('.ws-form-error').textContent=workspaceErrorText(error);}finally{submit.disabled=false;}
  });
  for(const dialog of document.querySelectorAll('.ws-dialog'))dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  $('#ws-import').addEventListener('click',()=>$('#ws-import-file').click());
  $('#ws-import-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error(shellT('error.jsonLarge'));const text=await file.text();if(serverMode){await previewServerImport(text);return;}const id=await store.importProject(text);selectedId=null;await store.selectProject(id);feedback(shellT('feedback.imported'));}catch(error){feedback(workspaceErrorText(error),true);}finally{event.target.value='';}});
  $('#ws-export-json').addEventListener('click',()=>guarded(()=>{download(store.exportProject(),'application/json;charset=utf-8','iznera-project.json');feedback(shellT('feedback.exported'));}));
  $('#ws-export-html').addEventListener('click',()=>guarded(exportReport));
  $('#ws-add-study').addEventListener('click',()=>guarded(async()=>{if(!await personalProject())return;$('#ws-study-form').reset();$('#ws-study-form .ws-form-error').textContent='';$('#ws-study-dialog').showModal();}));
  $('#ws-study-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.target,fields=new FormData(form);try{await store.addStudyRow({participantCode:String(fields.get('participantCode')),baselineSeconds:Number(fields.get('baselineSeconds')),traceSeconds:Number(fields.get('traceSeconds'))});$('#ws-study-dialog').close();feedback(shellT('feedback.measurementSaved'));}catch(error){form.querySelector('.ws-form-error').textContent=workspaceErrorText(error);}});
  $('#ws-import-csv').addEventListener('click',()=>guarded(async()=>{if(await personalProject())$('#ws-csv-file').click();}));
  $('#ws-csv-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error(shellT('error.csvLarge'));const rows=parseCsv(await file.text());await store.addStudyRows(rows);feedback(shellT('feedback.measurementsImported',{count:formatNumber(rows.length)}));}catch(error){feedback(workspaceErrorText(error),true);}finally{event.target.value='';}});
  $('#ws-replay').addEventListener('click',()=>{if(replayTimer){stopReplay();return;}const sequence=filteredRecords(store.getProject()).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));if(!sequence.length){feedback(shellT('timeline.needsRecords'));return;}let index=0;selectedId=sequence[0].id;render();$('#ws-replay').textContent=shellT('timeline.stop');$('#ws-replay').setAttribute('aria-pressed','true');replayTimer=setInterval(()=>{index++;if(index>=sequence.length){stopReplay();feedback(shellT('timeline.finished'));return;}selectedId=sequence[index].id;render();$('#ws-replay').textContent=shellT('timeline.stop');$('#ws-replay').setAttribute('aria-pressed','true');},2200);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopReplay();});
  store.subscribe(()=>{const project=store.getProject();const url=new URL(location.href);url.searchParams.set('project',project.id);if(serverMode){url.searchParams.set('team',store.serverContext.team.id);setOfflineContext(offlineContext()).catch(()=>{});}if(!project.records.some(record=>record.id===selectedId))url.searchParams.delete('record');history.replaceState(null,'',url);stopReplay();render();});
  setInspectorWidth(inspectorWidth);setInspector(inspectorOpen);render();
  if(serverMode){
    let checking=false,pointerActive=false,lastInteraction=0;
    const idle=()=>activeView!=='chat'&&!document.hidden&&navigator.onLine&&!pointerActive&&!replayTimer&&Date.now()-lastInteraction>1000&&
      !document.querySelector('dialog[open]')&&!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
    async function refreshTeam(){
      if(checking||!idle())return;checking=true;
      try{await preserveCanvasFocus(()=>store.refreshIfChanged({canApply:idle}));}
      catch(error){
        if(error.status===401 || error.status===403){
          clearInterval(timer);feedback(workspaceErrorText(error),true);
          // Clear the private document after the server revokes this session or
          // membership. Polling never navigates away from an open author form.
          location.assign(error.status===401?`/auth?mode=signin&next=${encodeURIComponent(location.pathname+location.search)}`:'/onboarding');
        }
      }finally{checking=false;}
    }
    const timer=setInterval(refreshTeam,5000);
    document.addEventListener('pointerdown',()=>{pointerActive=true;lastInteraction=Date.now();},{passive:true});
    for(const name of ['pointerup','pointercancel'])addEventListener(name,()=>{pointerActive=false;lastInteraction=Date.now();},{passive:true});
    for(const name of ['keydown','input'])document.addEventListener(name,()=>{lastInteraction=Date.now();},{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshTeam();});
    addEventListener('online',refreshTeam);addEventListener('focus',refreshTeam);
    addEventListener('blur',()=>{pointerActive=false;});
    addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(timer);});
    $('#ws-storage').dataset.wsTitle='server.autoRefresh';$('#ws-storage').title=shellT('server.autoRefresh');
  }
  if(searchParams.get('capture')==='1'){await guarded(()=>openRecord());const url=new URL(location.href);url.searchParams.delete('capture');history.replaceState(null,'',url);}
}
