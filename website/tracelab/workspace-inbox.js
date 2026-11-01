import {inboxText as t,inboxErrorText} from './workspace-inbox-copy.js';
import {formatDate,formatNumber} from './workspace-i18n.js';
import {proposeInboxGroups,runInboxBatch} from './workspace-inbox-model.js';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const button=(text,action)=>{const node=el('button','wm-button',text);node.type='button';node.addEventListener('click',action);return node;};
const select=(label,options,value)=>{const wrap=el('label','wm-field',label),input=el('select');for(const [key,text]of options){const option=el('option','',text);option.value=key;input.append(option);}input.value=value;wrap.append(input);return{wrap,input};};
export function mountWorkspaceInbox(container,{projectId,role,onChanged=()=>{},onSelectRecord,onCreateIteration}={}){
  let disposed=false,loading=false,nextCursor=null,revision=0,items=[],iterations=[],currentRole=role,dialog=null,counts={},batchBusy=false;const retries=new Map(),selected=new Set(),selectionControls=new Map(),itemErrors=new Map();
  const abort=new AbortController(),root=el('section','wm-library'),header=el('header','wm-heading'),heading=el('div');heading.append(el('h2','',t('title')),el('p','',t('intro')));header.append(heading,button(t('refresh'),()=>load()));
  const tabBar=el('div','wm-tools'),tabs=new Map();let filter=new URL(location.href).searchParams.get('inboxStatus');if(!['inbox','linked','ignored'].includes(filter))filter='inbox';
  for(const value of ['inbox','linked','ignored']){const tab=button(t(value),()=>{if(batchBusy)return;selected.clear();filter=value;const url=new URL(location.href);url.searchParams.set('inboxStatus',value);history.replaceState(history.state,'',url);load();});tab.setAttribute('aria-pressed',String(value===filter));tabs.set(value,tab);tabBar.append(tab);}
  const status=el('p','wm-status');status.setAttribute('role','status');const versionArea=el('section','wm-form'),list=el('div','wm-grid'),more=button(t('more'),()=>load(true)),count=el('p','wm-meta');more.hidden=true;
  const batchTools=el('div','wm-tools wm-inbox-batch'),selectAllLabel=el('label','wm-inbox-select'),selectAll=el('input');selectAll.type='checkbox';selectAllLabel.append(selectAll,el('span','',t('selectAll')));
  const selectedCount=el('span','wm-inbox-selection-count'),review=button(t('batchReview'),()=>showBatchReview()),clear=button(t('clearSelection'),()=>{selected.clear();updateSelection();});batchTools.append(selectAllLabel,selectedCount,clear,review);
  selectAll.addEventListener('change',()=>{for(const item of items){if(selectAll.checked)selected.add(item.sourceId);else selected.delete(item.sourceId);}updateSelection();});
  const proposals=el('details','wm-inbox-proposals');
  root.append(header,tabBar,batchTools,proposals,status,count,list,more,versionArea,el('p','wm-meta',t('ignoreHint')));container.replaceChildren(root);
  const writable=()=>['student','student_lead'].includes(currentRole);
  const openRecord=id=>{if(onSelectRecord)onSelectRecord(id);else{const url=new URL('/workspace',location.origin);url.searchParams.set('project',projectId);url.searchParams.set('view','graph');url.searchParams.set('record',id);location.assign(url.pathname+url.search);}};
  async function send(fields){const key=JSON.stringify(fields),previous=retries.get(key),payload=previous||{...fields,projectId,expectedRevision:revision,requestId:crypto.randomUUID()};retries.set(key,payload);if(retries.size>20)retries.delete(retries.keys().next().value);
    let response,data;
    try{response=await fetch('/api/workspace/inbox',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:abort.signal});data=await response.json();}
    catch(cause){if(abort.signal.aborted)throw cause;const error=new Error(inboxErrorText('network'));error.code='network';throw error;}
    if(!response.ok){if(response.status<500)retries.delete(key);const error=new Error(inboxErrorText(data.error?.code));error.code=data.error?.code;throw error;}
    const nextRevision=data.projects?.find(item=>item.id===projectId)?.serverRevision;if(Number.isInteger(nextRevision))revision=nextRevision;
    retries.delete(key);return data;
  }
  async function mutate(control,fields){control.disabled=true;status.textContent=t('loading');try{await send(fields);await onChanged();if(!disposed){await load();status.textContent=t('saved');}}catch(error){if(!disposed)status.textContent=error.message;}finally{control.disabled=false;}}
  async function load(append=false){if(loading||disposed||batchBusy)return;loading=true;more.disabled=true;status.textContent=t('loading');
    try{const params=new URLSearchParams({project:projectId,status:filter});if(append&&nextCursor)params.set('cursor',nextCursor);const response=await fetch('/api/workspace/inbox?'+params,{credentials:'same-origin',cache:'no-store',signal:abort.signal}),data=await response.json();if(!response.ok)throw new Error(inboxErrorText(data.error?.code));if(disposed)return;
      items=append?[...items,...data.items.filter(item=>!items.some(old=>old.sourceId===item.sourceId))]:data.items;for(const id of selected)if(!items.some(item=>item.sourceId===id))selected.delete(id);iterations=data.iterations;revision=data.revision;currentRole=data.role;nextCursor=data.nextCursor;counts=data.counts;paint();status.textContent='';
    }catch(error){if(!disposed)status.textContent=error.message;}finally{loading=false;more.disabled=false;}
  }
  function updateSelection(){batchTools.hidden=!writable()||!items.length;selectedCount.textContent=t('selected')+': '+formatNumber(selected.size);review.disabled=!selected.size||!iterations.length;review.title=iterations.length?'':t('noIterations');clear.disabled=!selected.size;selectAll.checked=items.length>0&&items.every(item=>selected.has(item.sourceId));selectAll.indeterminate=selected.size>0&&!selectAll.checked;for(const [id,input]of selectionControls)input.checked=selected.has(id);}
  function paint(){for(const [value,tab]of tabs){tab.setAttribute('aria-pressed',String(value===filter));tab.textContent=`${t(value)} · ${formatNumber(counts[value]||0)}`;}count.textContent=`${t('count')}: ${formatNumber(items.length)} · ${t('total')}: ${formatNumber(counts[filter]||0)}`;list.replaceChildren();selectionControls.clear();more.hidden=!nextCursor;
    if(!items.length){const blank=el('div','wm-empty wm-inbox-empty');blank.append(el('p','',t('empty')),el('p','',t(filter==='inbox'?'emptyInboxHint':filter==='linked'?'emptyLinkedHint':'emptyIgnoredHint')));if(filter==='inbox'){const link=el('a','wm-button',t('sources')),url=new URL(location.href);url.searchParams.set('view','sources');url.searchParams.delete('inboxStatus');link.href=url.pathname+url.search;blank.append(link);}list.append(blank);}
    for(const item of items){const card=el('article','wm-card'),info=el('div','wm-card-info'),actions=el('div','wm-card-actions');info.append(el('h3','',item.title),el('p','wm-meta',`${item.provider} · ${formatDate(item.occurredAt)}`));const details=el('details'),summary=el('summary','',t('metadata'));details.append(summary,el('p','',item.summary||t('noDescription')),el('p','wm-meta',`${t('received')}: ${formatDate(item.receivedAt)}`));
      if(item.externalActor)details.append(el('p','wm-meta',`${item.externalActor} · ${t('external')}`));else if(item.authorName)details.append(el('p','wm-meta',item.authorName));
      for(const key of ['repository','branch','sha'])if(item.metadata?.[key])details.append(el('p','wm-meta',item.metadata[key]));
      if(item.metadata?.url){try{const url=new URL(item.metadata.url);if(url.protocol==='https:'&&url.hostname==='github.com'){const link=el('a','',item.metadata.url);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}}catch{}}
      info.append(details);actions.append(button(t('open'),()=>openRecord(item.recordId)));
      if(writable()){
        const selection=el('label','wm-inbox-select'),checkbox=el('input');checkbox.type='checkbox';checkbox.checked=selected.has(item.sourceId);checkbox.setAttribute('aria-label',t('selectSource')+': '+item.title);selection.append(checkbox,el('span','',t('selectSource')));checkbox.addEventListener('change',()=>{if(checkbox.checked)selected.add(item.sourceId);else selected.delete(item.sourceId);updateSelection();});selectionControls.set(item.sourceId,checkbox);info.prepend(selection);
        if(iterations.length){const choice=select(t('iteration'),[['',t('choose')],...iterations.map(iteration=>[iteration.id,iteration.title])],item.iterationId||(iterations.length===1?iterations[0].id:'')),meaning=select(t('relation'),[['DERIVED_FROM',t('derived')],['REFERENCES',t('reference')]],'DERIVED_FROM');
          const assign=button(t('assign'),()=>{if(!choice.input.value){choice.input.focus();return;}mutate(assign,{command:'triage',sourceId:item.sourceId,status:'linked',iterationId:choice.input.value,relationType:meaning.input.value});});info.append(choice.wrap,meaning.wrap);actions.append(assign);
        }else info.append(el('p','wm-meta',t('noIterations')));
        const triage=button(t(item.status==='ignored'?'restore':'ignore'),()=>mutate(triage,{command:'triage',sourceId:item.sourceId,status:item.status==='ignored'?'inbox':'ignored'}));actions.append(triage);
        if(item.status==='linked'){const restore=button(t('restore'),()=>mutate(restore,{command:'triage',sourceId:item.sourceId,status:'inbox'}));actions.append(restore);}
      }if(itemErrors.has(item.sourceId)){const error=el('p','wm-inbox-item-error',itemErrors.get(item.sourceId));error.setAttribute('role','status');info.append(error);}info.append(actions);card.append(info);list.append(card);}
    updateSelection();paintProposals();paintVersions();
  }
  function paintProposals(){proposals.replaceChildren();const groups=writable()&&filter==='inbox'?proposeInboxGroups(items).slice(0,6):[];proposals.hidden=!groups.length;if(!groups.length)return;proposals.append(el('summary','',t('proposalTitle')),el('p','wm-meta',t('proposalHint')));
    for(const group of groups){const row=el('div','wm-inbox-proposal'),description=el('p','',[group.provider,group.repository,group.subsystem||t('unknownSubsystem'),formatDate(new Date(group.from).toISOString()),formatNumber(group.sourceIds.length)].filter(Boolean).join(' · '));row.append(description,button(t('chooseGroup'),()=>{selected.clear();for(const id of group.sourceIds)selected.add(id);updateSelection();review.focus();}));proposals.append(row);}
  }
  function showBatchReview(){if(batchBusy||!writable())return;const chosen=items.filter(item=>selected.has(item.sourceId));if(!chosen.length||!iterations.length)return;
    dialog?.close();const previous=document.activeElement,modal=el('dialog','wm-dialog'),form=el('form','wm-form');dialog=modal;modal.setAttribute('aria-label',t('batchTitle'));form.append(el('h2','',t('batchTitle')),el('p','wm-meta',t('batchIntro')));
    const target=select(t('iteration'),[['',t('choose')],...iterations.map(item=>[item.id,item.title])],iterations.length===1?iterations[0].id:''),meaning=select(t('relation'),[['REFERENCES',t('reference')],['DERIVED_FROM',t('derived')]],'REFERENCES');target.input.required=true;form.append(target.wrap,meaning.wrap);
    const preview=el('ul','wm-inbox-batch-list'),resultLabels=new Map();for(const item of chosen){const row=el('li'),result=el('small','',t('pending'));row.append(el('span','',item.title),result);preview.append(row);resultLabels.set(item.sourceId,result);}form.append(preview);
    const message=el('p','wm-status');message.setAttribute('role','status');form.append(message);let pendingIds=chosen.map(item=>item.sourceId),savedAny=false,needsRefresh=false;
    const actions=el('div','wm-inbox-batch-actions'),cancel=button(t('cancel'),()=>{if(!batchBusy)modal.close();}),confirm=button(t('confirmLink'),()=>{});confirm.type='submit';actions.append(cancel,confirm);form.append(actions);
    form.addEventListener('submit',async event=>{event.preventDefault();if(batchBusy||!form.reportValidity())return;
      if(needsRefresh){await load();needsRefresh=false;if(disposed)return;}
      batchBusy=true;for(const control of [cancel,confirm,target.input,meaning.input])control.disabled=true;message.textContent=t('batchProgress');
      try{const result=await runInboxBatch(pendingIds,{stopped:()=>disposed,run:id=>send({command:'triage',sourceId:id,status:'linked',iterationId:target.input.value,relationType:meaning.input.value}),onProgress:entry=>{
        const label=resultLabels.get(entry.sourceId);if(label){label.textContent=entry.saved?t('alreadySaved'):entry.error.message;label.dataset.result=entry.saved?'saved':'failed';}
        if(entry.saved){savedAny=true;selected.delete(entry.sourceId);itemErrors.delete(entry.sourceId);}else itemErrors.set(entry.sourceId,entry.error.message);
      }});pendingIds=result.failed.map(item=>item.sourceId);needsRefresh=result.failed.some(item=>item.error.code==='revision_conflict');
        message.textContent=`${t('batchSaved')}: ${formatNumber(chosen.length-pendingIds.length)} · ${t('batchFailed')}: ${formatNumber(pendingIds.length)}`;
        if(!pendingIds.length){modal.close();return;}message.append(el('br'),document.createTextNode(t('batchRetryHint')));confirm.textContent=t('retryFailed');
      }finally{batchBusy=false;cancel.disabled=false;confirm.disabled=false;target.input.disabled=savedAny;meaning.input.disabled=savedAny;updateSelection();}
    });
    modal.addEventListener('cancel',event=>{if(batchBusy)event.preventDefault();});modal.addEventListener('close',()=>{modal.remove();if(dialog===modal)dialog=null;if(previous?.isConnected)previous.focus({preventScroll:true});if(savedAny&&!disposed)Promise.resolve(onChanged()).then(()=>{if(!disposed)load();}).catch(error=>{if(!disposed)status.textContent=error.message;});},{once:true});modal.append(form);document.body.append(modal);modal.showModal();target.input.focus();
  }
  function paintVersions(){versionArea.replaceChildren();const title=el('div','wm-heading');title.append(el('h3','',t('versions')));if(writable()&&onCreateIteration)title.append(button(t('create'),()=>onCreateIteration()));versionArea.append(title);
    if(!iterations.length){versionArea.append(el('p','wm-empty',t('noIterations')));return;}const choice=select(t('iteration'),iterations.map(item=>[item.id,item.title]),iterations[0].id),details=el('div','wm-card-info');versionArea.append(choice.wrap,details);
    const paintVersion=()=>{const item=iterations.find(item=>item.id===choice.input.value);details.replaceChildren();details.append(el('p','wm-meta',t(item.state==='closed'?'closed':'draft')),el('p','',item.body||t('noDescription')));if(item.rationale)details.append(el('p','',item.rationale));if(item.outcome)details.append(el('p','wm-meta',t(item.outcome)));if(item.nextStep)details.append(el('p','',t('next')+': '+item.nextStep));if(item.closedAt)details.append(el('p','wm-meta',t('closedAt')+': '+formatDate(item.closedAt)));
      const tools=el('div','wm-card-actions');tools.append(button(t('view'),()=>openRecord(item.id)));if(item.canEdit)tools.append(button(t(item.state==='closed'?'editCloseout':'closeout'),()=>showCloseout(item)));details.append(tools);};choice.input.addEventListener('change',paintVersion);paintVersion();
  }
  function showCloseout(item){dialog?.close();const modal=el('dialog','wm-dialog'),form=el('form','wm-form');dialog=modal;modal.setAttribute('aria-label',t('closeout'));form.append(el('h2','',item.title),el('p','wm-meta',t('closeoutHint')));
    const state=select(t('state'),[['draft',t('draft')],['closed',t('closed')]],item.state==='closed'?'closed':'draft');form.append(state.wrap);
    const area=(label,value,max)=>{const wrap=el('label','wm-field',label),input=el('textarea');input.value=value||'';input.maxLength=max;input.rows=4;wrap.append(input);form.append(wrap);return input;};
    const change=area(t('change'),item.body,12000),why=area(t('why'),item.rationale,12000),outcome=select(t('outcome'),[['',t('choose')],...['kept','reverted','iterate','deferred','rejected'].map(key=>[key,t(key)])],item.outcome||'');form.append(outcome.wrap);const next=area(t('next'),item.nextStep,2000),error=el('p','wm-status');error.setAttribute('role','status');const save=button(t('save'),()=>{});save.type='submit';form.append(error,save,button(t('cancel'),()=>modal.close()));
    const required=()=>{for(const input of [change,why,outcome.input])input.required=state.input.value==='closed';};state.input.addEventListener('change',required);required();
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;error.textContent=t('loading');try{await send({command:'iteration',iterationId:item.id,status:state.input.value,body:change.value,rationale:why.value,outcome:outcome.input.value,nextStep:next.value});modal.close();await onChanged();if(!disposed){await load();status.textContent=t('saved');}}catch(e){error.textContent=e.message;}finally{save.disabled=false;}});
    modal.append(form);modal.addEventListener('close',()=>{modal.remove();if(dialog===modal)dialog=null;},{once:true});document.body.append(modal);modal.showModal();change.focus();
  }
  load();return()=>{disposed=true;abort.abort();dialog?.close();};
}
