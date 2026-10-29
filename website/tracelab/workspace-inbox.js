import {inboxText as t,inboxErrorText} from './workspace-inbox-copy.js';
import {formatDate,formatNumber} from './workspace-i18n.js';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const button=(text,action)=>{const node=el('button','wm-button',text);node.type='button';node.addEventListener('click',action);return node;};
const select=(label,options,value)=>{const wrap=el('label','wm-field',label),input=el('select');for(const [key,text]of options){const option=el('option','',text);option.value=key;input.append(option);}input.value=value;wrap.append(input);return{wrap,input};};
export function mountWorkspaceInbox(container,{projectId,role,onChanged=()=>{},onSelectRecord,onCreateIteration}={}){
  let disposed=false,loading=false,nextCursor=null,revision=0,items=[],iterations=[],currentRole=role,dialog=null,counts={};const retries=new Map();
  const abort=new AbortController(),root=el('section','wm-library'),header=el('header','wm-heading'),heading=el('div');heading.append(el('h2','',t('title')),el('p','',t('intro')));header.append(heading,button(t('refresh'),()=>load()));
  const tabBar=el('div','wm-tools'),tabs=new Map();let filter=new URL(location.href).searchParams.get('inboxStatus');if(!['inbox','linked','ignored'].includes(filter))filter='inbox';
  for(const value of ['inbox','linked','ignored']){const tab=button(t(value),()=>{filter=value;const url=new URL(location.href);url.searchParams.set('inboxStatus',value);history.replaceState(history.state,'',url);load();});tab.setAttribute('aria-pressed',String(value===filter));tabs.set(value,tab);tabBar.append(tab);}
  const status=el('p','wm-status');status.setAttribute('role','status');const versionArea=el('section','wm-form'),list=el('div','wm-grid'),more=button(t('more'),()=>load(true)),count=el('p','wm-meta');more.hidden=true;
  root.append(header,tabBar,status,count,list,more,versionArea,el('p','wm-meta',t('ignoreHint')));container.replaceChildren(root);
  const writable=()=>['student','student_lead'].includes(currentRole);
  const openRecord=id=>{if(onSelectRecord)onSelectRecord(id);else{const url=new URL('/workspace',location.origin);url.searchParams.set('project',projectId);url.searchParams.set('view','graph');url.searchParams.set('record',id);location.assign(url.pathname+url.search);}};
  async function send(fields){const key=JSON.stringify(fields),previous=retries.get(key),payload=previous||{...fields,projectId,expectedRevision:revision,requestId:crypto.randomUUID()};retries.set(key,payload);if(retries.size>20)retries.delete(retries.keys().next().value);
    const response=await fetch('/api/workspace/inbox',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:abort.signal}),data=await response.json();
    if(!response.ok){if(response.status<500)retries.delete(key);throw new Error(inboxErrorText(data.error?.code));}retries.delete(key);return data;
  }
  async function mutate(control,fields){control.disabled=true;status.textContent=t('loading');try{await send(fields);await onChanged();if(!disposed){await load();status.textContent=t('saved');}}catch(error){if(!disposed)status.textContent=error.message;}finally{control.disabled=false;}}
  async function load(append=false){if(loading||disposed)return;loading=true;more.disabled=true;status.textContent=t('loading');
    try{const params=new URLSearchParams({project:projectId,status:filter});if(append&&nextCursor)params.set('cursor',nextCursor);const response=await fetch('/api/workspace/inbox?'+params,{credentials:'same-origin',cache:'no-store',signal:abort.signal}),data=await response.json();if(!response.ok)throw new Error(inboxErrorText(data.error?.code));if(disposed)return;
      items=append?[...items,...data.items.filter(item=>!items.some(old=>old.sourceId===item.sourceId))]:data.items;iterations=data.iterations;revision=data.revision;currentRole=data.role;nextCursor=data.nextCursor;counts=data.counts;paint();status.textContent='';
    }catch(error){if(!disposed)status.textContent=error.message;}finally{loading=false;more.disabled=false;}
  }
  function paint(){for(const [value,tab]of tabs){tab.setAttribute('aria-pressed',String(value===filter));tab.textContent=`${t(value)} · ${formatNumber(counts[value]||0)}`;}count.textContent=`${t('count')}: ${formatNumber(items.length)} · ${t('total')}: ${formatNumber(counts[filter]||0)}`;list.replaceChildren();more.hidden=!nextCursor;
    if(!items.length)list.append(el('p','wm-empty',t('empty')));
    for(const item of items){const card=el('article','wm-card'),info=el('div','wm-card-info'),actions=el('div','wm-card-actions');info.append(el('h3','',item.title),el('p','wm-meta',`${item.provider} · ${formatDate(item.occurredAt)}`));const details=el('details'),summary=el('summary','',t('metadata'));details.append(summary,el('p','',item.summary||t('noDescription')),el('p','wm-meta',`${t('received')}: ${formatDate(item.receivedAt)}`));
      if(item.externalActor)details.append(el('p','wm-meta',`${item.externalActor} · ${t('external')}`));else if(item.authorName)details.append(el('p','wm-meta',item.authorName));
      for(const key of ['repository','branch','sha'])if(item.metadata?.[key])details.append(el('p','wm-meta',item.metadata[key]));
      if(item.metadata?.url){try{const url=new URL(item.metadata.url);if(url.protocol==='https:'&&url.hostname==='github.com'){const link=el('a','',item.metadata.url);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}}catch{}}
      info.append(details);actions.append(button(t('open'),()=>openRecord(item.recordId)));
      if(writable()){
        if(iterations.length){const choice=select(t('iteration'),[['',t('choose')],...iterations.map(iteration=>[iteration.id,iteration.title])],item.iterationId||''),meaning=select(t('relation'),[['DERIVED_FROM',t('derived')],['REFERENCES',t('reference')]],'DERIVED_FROM');
          const assign=button(t('assign'),()=>{if(!choice.input.value){choice.input.focus();return;}mutate(assign,{command:'triage',sourceId:item.sourceId,status:'linked',iterationId:choice.input.value,relationType:meaning.input.value});});info.append(choice.wrap,meaning.wrap);actions.append(assign);
        }else info.append(el('p','wm-meta',t('noIterations')));
        const triage=button(t(item.status==='ignored'?'restore':'ignore'),()=>mutate(triage,{command:'triage',sourceId:item.sourceId,status:item.status==='ignored'?'inbox':'ignored'}));actions.append(triage);
        if(item.status==='linked'){const restore=button(t('restore'),()=>mutate(restore,{command:'triage',sourceId:item.sourceId,status:'inbox'}));actions.append(restore);}
      }info.append(actions);card.append(info);list.append(card);}
    paintVersions();
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
