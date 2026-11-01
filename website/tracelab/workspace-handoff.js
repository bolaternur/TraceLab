import {handoffText as t} from './workspace-handoff-copy.js';
import {handoffSections,handoffSelection} from './workspace-handoff-model.js';
import {iterationEvidence} from './workspace-iterations-model.js';
import {formatDate,formatNumber,recordType} from './workspace-i18n.js';
import {workspaceErrorText} from './workspace-shell-i18n.js';

const selections=new WeakMap();
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const button=(text,action,cls='wh-button')=>{const node=el('button',cls,text);node.type='button';node.addEventListener('click',action);return node;};

/** Draft advice is separate from the overview's lifecycle. A failed server
 * write keeps the user's text, and never edits somebody else's explanation. */
function writeAdvice({store,project,serverMode,onChanged}) {
  const previous=document.activeElement,dialog=el('dialog','wh-advice-dialog'),form=el('form','wh-advice-form');dialog.setAttribute('aria-label',t('adviceTitle'));
  form.append(el('h2','',t('adviceTitle')),el('p','wh-intro',t('adviceHint')));
  const titleLabel=el('label','wh-field',t('name')),title=el('input');title.value=t('adviceTitle');title.required=true;title.maxLength=240;titleLabel.append(title);
  const bodyLabel=el('label','wh-field',t('body')),body=el('textarea');body.required=true;body.maxLength=12000;body.rows=7;bodyLabel.append(body);form.append(titleLabel,bodyLabel);
  const status=el('p','wh-status');status.setAttribute('role','status');form.append(status);
  let busy=false,dirty=false;form.addEventListener('input',()=>{dirty=true;});
  const actions=el('div','wh-actions'),cancel=button(t('cancel'),()=>{if(!busy&&(!dirty||confirm(t('discard'))))dialog.close();}),save=button(t('save'),()=>{},'wh-button wh-primary');save.type='submit';actions.append(cancel,save);form.append(actions);
  form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!form.reportValidity())return;if(store.getProject().id!==project.id){status.textContent=t('projectChanged');return;}
    busy=true;cancel.disabled=true;save.disabled=true;status.textContent=t('saving');
    try{await store.addRecord({kind:'source',sourceType:'handoff',title:title.value,body:body.value,author:serverMode?store.serverContext.user.displayName:''});dirty=false;dialog.close();await onChanged();}
    catch(error){status.textContent=workspaceErrorText(error);}
    finally{busy=false;cancel.disabled=false;save.disabled=false;}
  });
  dialog.addEventListener('cancel',event=>{if(busy||(dirty&&!confirm(t('discard'))))event.preventDefault();});
  dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});dialog.append(form);document.body.append(dialog);dialog.showModal();body.focus();return dialog;
}

export function mountWorkspaceHandoff(container,{store,project=store.getProject(),serverMode=false,onSelectRecord=()=>{},onSelectProject,onExport,onChanged=()=>{},onStarted}={}) {
  let disposed=false;
  const controller=new AbortController(),root=el('section','wh-library'),header=el('header','wh-heading'),intro=el('div');
  intro.append(el('h2','',t('title')),el('p','wh-intro',t('intro')));header.append(intro);
  const canWrite=project.dataKind!=='synthetic'&&(!serverMode||['student','student_lead'].includes(store.serverContext?.role));
  if(canWrite)header.append(button(t('addAdvice'),()=>writeAdvice({store,project,serverMode,onChanged})));
  root.append(header);
  const context=el('section','wh-context');context.append(el('p','',t('scope')+': '+project.name),el('p','wh-intro',t('boundary')));root.append(context);
  const contextStatus=el('p','wh-status');contextStatus.setAttribute('role','status');root.append(contextStatus);
  if(!serverMode)root.append(el('p','wh-intro',t('local')));else if(!canWrite)root.append(el('p','wh-intro',t('readOnly')));
  let perProject=selections.get(store);if(!perProject){perProject=new Map();selections.set(store,perProject);}
  if(!perProject.has(project.id))perProject.set(project.id,{selected:new Set(),include:false});
  const preference=perProject.get(project.id),selected=preference.selected;
  for(const id of selected)if(!project.records.some(record=>record.id===id))selected.delete(id);
  const summary=el('div','wh-selection'),count=el('p','wh-selection-count'),includeLabel=el('label','wh-check'),include=el('input');include.type='checkbox';include.checked=preference.include;includeLabel.append(include,el('span','',t('includeEvidence')));
  const selectedSummary=el('p','wh-intro',t('selectHint')),hints=el('p','wh-intro',t('includeHint'));summary.append(selectedSummary,includeLabel,hints,count);root.append(summary);
  const sections=handoffSections(project),list=el('div','wh-sections');
  for(const section of sections) {
    if(!section.records.length)continue;
    const block=el('section','wh-section');block.append(el('h3','',t(section.key)));
    for(const record of section.records) {
      const row=el('article','wh-record'),top=el('div','wh-record-heading'),checkLabel=el('label','wh-check'),checkbox=el('input');checkbox.type='checkbox';checkbox.checked=selected.has(record.id);checkbox.setAttribute('aria-label',t('select')+': '+record.title);checkLabel.append(checkbox,el('span','',t('select')));top.append(checkLabel,el('span','wh-kind',recordType(record.kind)));row.append(top);
      const heading=el('h4');heading.append(button(record.title,()=>onSelectRecord(record.id),'wh-record-title'));row.append(heading);
      row.append(el('p','wh-meta',[record.subsystem,record.revision,record.author,formatDate(record.createdAt)].filter(Boolean).join(' · ')));
      if(record.authorProvenance==='imported-unverified')row.append(el('p','wh-meta',t('unverified')));
      if(record.body)row.append(el('p','wh-body',record.body));
      if(record.rationale){const why=el('p','wh-body');why.append(el('strong','',t('why')+' '),document.createTextNode(record.rationale));row.append(why);}
      else if(['decision','iteration'].includes(record.kind))row.append(el('p','wh-meta',t('missing')));
      if(record.nextStep)row.append(el('p','wh-body',t('next')+': '+record.nextStep));
      if(Number.isFinite(record.trials)&&Number.isFinite(record.successes))row.append(el('p','wh-meta',t('result')+': '+formatNumber(record.successes)+' / '+formatNumber(record.trials)));
      else if(Number.isFinite(record.measuredValue))row.append(el('p','wh-meta',t('result')+': '+formatNumber(record.measuredValue)+(record.unit?' '+record.unit:'')));
      const related=iterationEvidence(project,record.id);if(related.length){const tools=el('div','wh-links');for(const item of related)tools.append(button(item.record.title,()=>onSelectRecord(item.record.id),'wh-reference'));row.append(tools);}
      checkbox.addEventListener('change',()=>{if(checkbox.checked)selected.add(record.id);else selected.delete(record.id);updateSelection();});block.append(row);
    }list.append(block);
  }
  if(!project.records.length)list.append(el('p','wh-empty',t('empty')));root.append(list);
  const exportArea=el('section','wh-export'),actions=el('div','wh-actions'),exportButton=button(t('export'),()=>onExport?.({scope:'handoff',recordIds:handoffSelection(project,selected,{includeEvidence:include.checked})}),'wh-button wh-primary'),clear=button(t('clear'),()=>{selected.clear();for(const input of list.querySelectorAll('input[type=checkbox]'))input.checked=false;updateSelection();});actions.append(clear,exportButton);exportArea.append(actions,el('p','wh-intro',t('exportHint')));root.append(exportArea);
  function updateSelection(){preference.include=include.checked;const ids=handoffSelection(project,selected,{includeEvidence:include.checked});count.textContent=t('selected')+': '+formatNumber(ids.length);clear.disabled=!selected.size;exportButton.disabled=!serverMode||!canWrite||!ids.length||typeof onExport!=='function';}
  include.addEventListener('change',updateSelection);updateSelection();container.replaceChildren(root);
  if(serverMode){contextStatus.textContent=t('loading');fetch('/api/workspace/handoff?'+new URLSearchParams({project:project.id}),{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async response=>{
    if(!response.ok)throw new Error();const data=await response.json();if(disposed)return;contextStatus.textContent='';
    context.prepend(el('p','',`${t('season')}: ${data.season.name} · ${t(data.season.active?'active':'past')}`));
    if(data.canStartNextSeason&&data.role==='student_lead')context.append(button(t('startNextSeason'),()=>openNextSeason({store,project,metadata:data,onStarted:async result=>{if(onStarted)await onStarted(result);else if(onSelectProject)await onSelectProject(result.projectId);else{const url=new URL('/workspace',location.origin);url.searchParams.set('project',result.projectId);url.searchParams.set('team',store.serverContext.team.id);url.searchParams.set('view','overview');location.assign(url.pathname+url.search);}}})));
    if(data.projects?.length>1){const archive=el('label','wh-field',t('archive')),choice=el('select');for(const item of data.projects){const option=el('option','',`${item.seasonName} · ${item.name}`);option.value=item.id;choice.append(option);}choice.value=project.id;archive.append(choice);const open=button(t('chooseProject'),()=>{if(choice.value===store.getProject().id)return;if(onSelectProject)onSelectProject(choice.value);else{const url=new URL('/workspace',location.origin);url.searchParams.set('view','handoff');url.searchParams.set('project',choice.value);url.searchParams.set('team',store.serverContext.team.id);location.assign(url.pathname+url.search);}});context.append(archive,open);}
  }).catch(()=>{if(!disposed)contextStatus.textContent=t('unavailable');});}
  return()=>{disposed=true;controller.abort();};
}

/** No POST occurs until the user reviews the exact new season and confirms. */
export function openNextSeason({store,project=store.getProject(),metadata,onStarted=()=>{}}={}) {
  if(!metadata?.canStartNextSeason||metadata.role!=='student_lead')return null;
  const previous=document.activeElement,dialog=el('dialog','wh-advice-dialog'),form=el('form','wh-advice-form');dialog.setAttribute('aria-label',t('nextSeasonTitle'));form.append(el('h2','',t('nextSeasonTitle')),el('p','wh-intro',t('rolloverHint')),el('p','wh-intro',t('newPolicyUnknown')));
  const field=(key,value,type,max)=>{const label=el('label','wh-field',t(key)),input=el('input');input.type=type;input.value=value;input.required=true;if(max)input.maxLength=max;label.append(input);form.append(label);return input;};
  const seasonName=field('nextSeasonName',String(metadata.season.year+1),'text',80),year=field('nextSeasonYear',String(metadata.season.year+1),'number');year.min=metadata.season.year+1;year.max=2100;
  const projectName=field('nextProjectName','','text',120),carryLabel=el('label','wh-check'),carry=el('input');carry.type='checkbox';carryLabel.append(carry,document.createTextNode(t('carrySubsystems')));form.append(carryLabel);
  const acknowledgeLabel=el('label','wh-check'),acknowledge=el('input');acknowledge.type='checkbox';acknowledge.required=true;acknowledgeLabel.append(acknowledge,document.createTextNode(t('acknowledgeRollover')));form.append(acknowledgeLabel);
  const preview=el('section','wh-rollover-preview');preview.hidden=true;form.append(preview);
  const status=el('p','wh-status');status.setAttribute('role','status');form.append(status);
  let busy=false,pending=null,reviewed=false;
  const controls=el('div','wh-actions'),cancel=button(t('cancel'),()=>{if(!busy&&confirm(t('discardRollover')))dialog.close();}),review=button(t('reviewRollover'),()=>{
    if(!form.reportValidity())return;preview.replaceChildren();
    for(const [key,value]of [['fromSeason',metadata.season.name],['fromProject',project.name],['newSeason',seasonName.value+' · '+year.value],['newProject',projectName.value],['taxonomyCount',formatNumber(carry.checked?metadata.subsystemCount:0)]])preview.append(el('p','',t(key)+': '+value));
    preview.append(el('p','wh-intro',t('noEvidenceCopied')),el('p','wh-intro',t('newPolicyUnknown')));preview.hidden=false;review.hidden=true;confirmButton.hidden=false;reviewed=true;confirmButton.focus();
  }),confirmButton=button(t('confirmRollover'),()=>{},'wh-button wh-primary');confirmButton.type='submit';confirmButton.hidden=true;controls.append(cancel,review,confirmButton);form.append(controls);
  form.addEventListener('input',()=>{pending=null;reviewed=false;review.hidden=false;confirmButton.hidden=true;preview.hidden=true;});
  form.addEventListener('change',()=>{pending=null;reviewed=false;review.hidden=false;confirmButton.hidden=true;preview.hidden=true;});
  form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!reviewed||!form.reportValidity())return;
    if(store.getProject().id!==project.id){status.textContent=t('projectChanged');return;}
    if(!pending)pending={projectId:project.id,expectedSeasonId:metadata.season.id,expectedProjectRevision:metadata.revision,requestId:crypto.randomUUID(),seasonName:seasonName.value,year:Number(year.value),projectName:projectName.value,carrySubsystems:carry.checked,acknowledge:true};
    busy=true;for(const control of form.querySelectorAll('button,input'))control.disabled=true;status.textContent=t('saving');
    try{const response=await fetch('/api/workspace/handoff',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)}),data=await response.json();
      if(!response.ok){const code=data.error?.code;if(['season_state_changed','season_exists'].includes(code))status.textContent=t(code);else status.textContent=code==='invalid_fields'?t('invalidNextSeason'):workspaceErrorText({code});return;}
      status.textContent=t('rolloverSuccess');dialog.close();await onStarted(data);
    }catch{status.textContent=t('rolloverFailed');}
    finally{busy=false;for(const control of form.querySelectorAll('button,input'))control.disabled=false;}
  });
  dialog.addEventListener('cancel',event=>{if(busy||!confirm(t('discardRollover')))event.preventDefault();});dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});dialog.append(form);document.body.append(dialog);dialog.showModal();seasonName.focus({preventScroll:true});return dialog;
}
