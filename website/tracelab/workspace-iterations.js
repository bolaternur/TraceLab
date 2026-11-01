import {iterationText as t} from './workspace-iterations-copy.js';
import {filterIterations,iterationEvidence,iterationMissing} from './workspace-iterations-model.js';
import {formatDate,formatNumber,recordType} from './workspace-i18n.js';
import {appendRecordHistory} from './workspace-record-history.js';
import {workspaceErrorText} from './workspace-shell-i18n.js';

const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const button=(text,action,cls='wi-button')=>{const node=el('button',cls,text);node.type='button';node.addEventListener('click',action);return node;};
const canWrite=({store,serverMode})=>!serverMode||['student','student_lead'].includes(store.serverContext?.role);
const canEdit=(record,options)=>canWrite(options)&&(!record||!options.serverMode||options.store.serverContext?.editableRecordIds?.[options.project.id]?.includes(record.id));
function field(form,key,value,{type='textarea',max=4000,required=false}={}) {
  const label=el('label','wi-field',t(key)),input=el(type==='textarea'?'textarea':'input');
  if(type!=='textarea')input.type=type;
  input.name=key;input.value=value||'';input.maxLength=max;input.required=required;
  if(type==='textarea')input.rows=3;
  label.append(input);form.append(label);return input;
}
function choice(form,key,entries,value) {
  const label=el('label','wi-field',t(key)),input=el('select');input.name=key;
  for(const entry of entries){const option=el('option','',t(entry||'choose'));option.value=entry;input.append(option);}
  input.value=value||'';label.append(input);form.append(label);return input;
}

/** The modal owns its draft independently of shell refreshes. Server conflicts
 * leave all fields intact; a saved record ID survives partial link retries. */
export function openWorkspaceIteration({store,project=store.getProject(),recordId=null,serverMode=false,onSaved=()=>{},onSelectRecord=()=>{},onCreateTest=()=>{},draft}={}) {
  const source=project.records.find(item=>item.id===recordId&&item.kind==='iteration');
  const original={...source,...draft};
  const options={store,project,serverMode};
  const editable=project.dataKind!=='synthetic'&&canEdit(source,options);
  const previous=document.activeElement,dialog=el('dialog','wi-editor'),form=el('form','wi-form');
  const title=el('h2','',source?.title||t('create'));dialog.setAttribute('aria-label',title.textContent);
  form.append(title,el('p','wi-intro',t('intro')));
  if(!editable)form.append(el('p','wi-notice',t(project.dataKind==='synthetic'?'demo':'readonly')));
  const name=field(form,'name',original.title,{type:'text',max:240,required:true});
  const context=el('div','wi-columns');form.append(context);
  const subsystem=field(context,'subsystem',original.subsystem,{type:'text',max:120});
  const suggestions=el('datalist');suggestions.id='wi-subsystems-'+crypto.randomUUID();subsystem.setAttribute('list',suggestions.id);subsystem.after(suggestions,el('small','wi-hint',t('subsystemHint')));
  const subsystemNames=new Set(project.records.map(item=>item.subsystem).filter(Boolean));
  const updateNames=()=>{suggestions.replaceChildren(...[...subsystemNames].sort().map(value=>{const option=el('option');option.value=value;return option;}));};updateNames();
  const controller=new AbortController();
  if(serverMode)fetch('/api/workspace/iterations?'+new URLSearchParams({project:project.id}),{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async response=>{
    if(!response.ok)return;const data=await response.json();if(controller.signal.aborted)return;
    for(const value of data.subsystems||[])if(typeof value==='string')subsystemNames.add(value);updateNames();
  }).catch(()=>{/* Typed project-local names still work if suggestions cannot load. */});
  const revision=field(context,'revision',original.revision,{type:'text',max:80});
  const goal=field(form,'goal',original.problemOrGoal);
  const change=field(form,'change',original.body,{max:12000});
  const why=field(form,'why',original.rationale,{max:12000});why.after(el('small','wi-hint',t('whyHint')));
  const resultRow=el('div','wi-columns');form.append(resultRow);
  const testOutcome=choice(resultRow,'testOutcome',['unknown','pass','fail','partial'],original.testOutcome||'unknown');
  const disposition=choice(resultRow,'outcome',['','kept','reverted','iterate','deferred','rejected'],original.outcome);
  const next=field(form,'next',original.nextStep,{max:2000});
  const evidence=el('fieldset','wi-evidence');evidence.append(el('legend','',t('evidence')),el('p','wi-hint',t('evidenceHint')));form.append(evidence);
  const accepted=new Set(iterationEvidence(project,source?.id).map(item=>item.record.id));
  const selected=new Set(),checks=new Map();
  for(const record of project.records.filter(item=>item.id!==source?.id&&item.kind!=='iteration')) {
    const label=el('label','wi-check'),input=el('input');input.type='checkbox';input.value=record.id;input.checked=accepted.has(record.id);input.disabled=accepted.has(record.id)||!editable;
    input.addEventListener('change',()=>{if(input.checked)selected.add(record.id);else selected.delete(record.id);});
    label.append(input,el('span','',record.title),el('small','wi-hint',recordType(record.kind)));evidence.append(label);checks.set(record.id,input);
  }
  if(!checks.size)evidence.append(el('p','wi-hint',t('noEvidence')));
  const status=el('p','wi-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');form.append(status);
  let busy=false,dirty=false,savedId=source?.id||null;
  form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
  const controls=el('div','wi-actions');form.append(controls);
  const save=button(t(source?.status==='closed'?'update':'save'),()=>submit(source?.status==='closed'?'closed':'draft'),'wi-button wi-primary');
  const close=button(t(source?.status==='closed'?'reopen':'close'),()=>submit(source?.status==='closed'?'draft':'closed'));
  const dismiss=()=>{if(!busy&&(!dirty||confirm(t('discard'))))dialog.close();};
  const cancel=button(t('cancel'),dismiss);controls.append(cancel);
  if(editable)controls.append(close,save);
  else for(const input of form.querySelectorAll('input,textarea,select'))input.disabled=true;
  if(source) {
    const current=el('p','wi-hint',t('status')+': '+t(source.status==='closed'?'closed':'draft')+' · '+formatDate(source.createdAt));form.append(current);
    appendRecordHistory(form,source);
  }
  form.addEventListener('submit',event=>{event.preventDefault();if(editable)submit(source?.status==='closed'?'closed':'draft');});
  async function submit(state) {
    if(busy||!editable)return;
    const values={kind:'iteration',title:name.value,subsystem:subsystem.value,revision:revision.value,problemOrGoal:goal.value,body:change.value,rationale:why.value,testOutcome:testOutcome.value,outcome:disposition.value,nextStep:next.value,status:state};
    const missing=state==='closed'?iterationMissing(values):[];
    if(missing.length){status.textContent=t('missing')+' '+missing.map(key=>t(key+'Missing')).join(', ');({change,why,outcome:disposition}[missing[0]])?.focus();return;}
    if(!form.reportValidity())return;
    busy=true;for(const control of controls.querySelectorAll('button'))control.disabled=true;status.textContent=t('saving');
    try {
      if(savedId)await store.updateRecord(savedId,values);
      else savedId=await store.addRecord({...values,author:serverMode?store.serverContext.user.displayName:'',createdAt:new Date().toISOString()});
      let incomplete=false;
      for(const id of selected) {
        const live=store.getProject();
        if(live.links.some(link=>link.status==='accepted'&&((link.from===savedId&&link.to===id)||(link.to===savedId&&link.from===id)))){selected.delete(id);continue;}
        const record=live.records.find(item=>item.id===id);if(!record){incomplete=true;continue;}
        try{await store.addLink({from:record.kind==='test'?id:savedId,to:record.kind==='test'?savedId:id,label:record.kind==='test'?'TESTS':'REFERENCES',relationType:record.kind==='test'?'TESTS':'REFERENCES',origin:'local',status:'accepted'});selected.delete(id);checks.get(id).disabled=true;}catch{incomplete=true;}
      }
      dirty=incomplete;
      if(incomplete){status.textContent=t('linkFailure');return;}
      dialog.close();await onSaved(savedId);
    }catch(error){status.textContent=error.code?workspaceErrorText(error):t('error');}
    finally{busy=false;for(const control of controls.querySelectorAll('button'))control.disabled=false;}
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  dialog.addEventListener('close',()=>{controller.abort();dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});
  dialog.append(form);document.body.append(dialog);dialog.showModal();
  if(editable)name.focus({preventScroll:true});
  else{title.tabIndex=-1;title.focus({preventScroll:true});}
  dialog.scrollTop=0;
  return dialog;
}

export function mountWorkspaceIterations(container,{store,project=store.getProject(),serverMode=false,onSelectRecord=()=>{},onChanged=()=>{},onCreateTest=()=>{}}={}) {
  const root=el('section','wi-library'),header=el('header','wi-heading'),description=el('div');
  description.append(el('h2','',t('title')),el('p','wi-intro',t('intro')));header.append(description);
  const open=id=>openWorkspaceIteration({store,project:store.getProject(),recordId:id,serverMode,onSelectRecord,onCreateTest,onSaved:async()=>onChanged()});
  if(canWrite({store,serverMode})&&project.dataKind!=='synthetic')header.append(button(t('create'),()=>open(null),'wi-button wi-primary'));
  root.append(header);const filters=el('div','wi-filters'),query=el('input');query.type='search';query.placeholder=t('search');query.setAttribute('aria-label',t('search'));
  const params=new URL(location.href).searchParams;query.value=params.get('iterationQuery')||'';filters.append(query);
  const state=choice(filters,'status',['all','draft','closed'],['draft','closed'].includes(params.get('iterationState'))?params.get('iterationState'):'all');
  const subsystem=el('select');subsystem.setAttribute('aria-label',t('subsystem'));const all=el('option','',t('allSubsystems'));all.value='';subsystem.append(all);
  for(const value of [...new Set(project.records.map(item=>item.subsystem).filter(Boolean))].sort()){const option=el('option','',value);option.value=value;subsystem.append(option);}subsystem.value=params.get('iterationSubsystem')||'';
  const subLabel=el('label','wi-field',t('subsystem'));subLabel.append(subsystem);filters.append(subLabel);root.append(filters);
  const list=el('div','wi-list');root.append(list);container.replaceChildren(root);
  function paint(sync=true) {
    if(sync){const url=new URL(location.href);for(const [key,value] of [['iterationQuery',query.value],['iterationState',state.value==='all'?'':state.value],['iterationSubsystem',subsystem.value]]){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}history.replaceState(history.state,'',url);}
    const records=filterIterations(project,{query:query.value,state:state.value,subsystem:subsystem.value});list.replaceChildren();
    if(!records.length){const none=project.records.every(item=>item.kind!=='iteration');const empty=el('div','wi-empty');empty.append(el('h3','',t(none?'empty':'noMatch')),el('p','wi-intro',t('emptyHint')));if(!none)empty.append(button(t('reset'),()=>{query.value='';state.value='all';subsystem.value='';paint();}));list.append(empty);return;}
    for(const record of records) {
      const row=el('article','wi-row'),top=el('div','wi-row-heading'),heading=el('h3');heading.append(button(record.title,()=>open(record.id),'wi-title-button'));top.append(heading,el('span','wi-state',t(record.status==='closed'?'closed':'draft')));row.append(top);
      const context=[record.subsystem,record.revision,record.author,formatDate(record.createdAt)].filter(Boolean).join(' · ');row.append(el('p','wi-hint',context));
      if(record.problemOrGoal)row.append(el('p','',record.problemOrGoal));
      const why=el('p','wi-why');why.append(el('strong','',t('why')+' '),document.createTextNode(record.rationale||t('notDocumented')));row.append(why);
      if(record.nextStep)row.append(el('p','',t('next')+': '+record.nextStep));
      const evidence=iterationEvidence(project,record.id),actions=el('div','wi-actions');
      for(const item of evidence.slice(0,5))actions.append(button(item.record.title,()=>onSelectRecord(item.record.id),'wi-evidence-link'));
      if(!evidence.length)row.append(el('p','wi-hint',t('noEvidence')));
      const missing=iterationMissing(record);if(record.status!=='closed'&&missing.length)row.append(el('p','wi-hint',t('missingLabel')+': '+missing.map(key=>t(key+'Missing')).join(', ')));
      if(record.testOutcome)row.append(el('p','wi-hint',t('testOutcome')+': '+t(record.testOutcome)));
      if(record.outcome)row.append(el('p','wi-hint',t('outcome')+': '+t(record.outcome)));
      if(record.recordHistory?.versions?.length)row.append(el('p','wi-hint',t('versions')+': '+formatNumber(record.recordHistory.versions.length)));
      actions.append(button(t(canEdit(record,{store,project,serverMode})?'edit':'read'),()=>open(record.id)));row.append(actions);list.append(row);
    }
  }
  query.addEventListener('input',()=>paint());state.addEventListener('change',()=>paint());subsystem.addEventListener('change',()=>paint());paint(false);
  return()=>{};
}
