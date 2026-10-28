import {sourceText as t} from './workspace-sources-copy.js';
import {formatDate,formatNumber} from './workspace-i18n.js';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const button=(text,action)=>{const node=el('button','wm-button',text);node.type='button';node.addEventListener('click',action);return node;};
export function mountWorkspaceSources(container,{projectId,role,onChanged=()=>{}}={}){
  let disposed=false,currentRole=role,dialog=null,loading=false;
  const abort=new AbortController(),root=el('section','wm-library'),header=el('header','wm-heading'),heading=el('div');
  heading.append(el('h2','',t('title')),el('p','',t('intro')));const add=button(t('configure'),()=>configure());header.append(heading,add);
  const status=el('p','wm-status');status.setAttribute('role','status');
  const list=el('div','wm-grid'),receipts=el('div','wm-form');root.append(header,el('p','wm-meta',t('readOnly')),button(t('refresh'),()=>load()),status,list,el('h3','',t('history')),receipts,el('p','wm-meta',t('limits')));container.replaceChildren(root);
  const writable=()=>currentRole==='student_lead';
  async function api(payload){const response=await fetch('/api/workspace/sources',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,projectId}),signal:abort.signal});const data=await response.json();if(!response.ok)throw new Error(t('error'));return data;}
  async function action(control,fn){control.disabled=true;status.textContent=t('loading');try{await fn();if(!disposed)await load();}catch(e){if(!disposed)status.textContent=e.message;}finally{control.disabled=false;}}
  async function load(){if(loading||disposed)return;loading=true;status.textContent=t('loading');
    try{const response=await fetch('/api/workspace/sources?'+new URLSearchParams({project:projectId}),{credentials:'same-origin',cache:'no-store',signal:abort.signal}),data=await response.json();if(!response.ok)throw new Error(t('error'));if(disposed)return;currentRole=data.role;add.hidden=!writable();list.replaceChildren();receipts.replaceChildren();
      if(!data.connections.length)list.append(el('p','wm-empty',t('empty')));
      for(const source of data.connections){const card=el('article','wm-card'),info=el('div','wm-card-info'),tools=el('div','wm-card-actions');info.append(el('h3','',source.label),el('p','',source.repository),el('p','wm-meta',t(source.status==='error'?'failed':source.status)));
        if(source.lastEventAt)info.append(el('p','wm-meta',formatDate(source.lastEventAt)));
        if(writable()){
          const rotate=button(t('rotate'),()=>{if(!window.confirm(t('confirmRotate')))return;action(rotate,async()=>showSecret(await api({command:'rotate',connectionId:source.id})));});tools.append(rotate);
          if(source.status!=='disconnected'){const disconnect=button(t('disconnect'),()=>{if(!window.confirm(t('confirmDisconnect')))return;action(disconnect,()=>api({command:'disconnect',connectionId:source.id}));});tools.append(disconnect);}
        }info.append(tools);card.append(info);list.append(card);}
      if(!data.receipts.length)receipts.append(el('p','wm-empty',t('historyEmpty')));
      for(const receipt of data.receipts){const row=el('article','wm-card-info'),source=data.connections.find(item=>item.id===receipt.connectionId);row.append(el('strong','',source?.label||'GitHub'),el('p','wm-meta',`${formatDate(receipt.receivedAt)} · ${t(receipt.status)} · ${t('attempts')}: ${formatNumber(receipt.attempts)} · ${t('imported')}: ${formatNumber(receipt.importedCount)}`));
        if(writable()&&receipt.status!=='complete'&&receipt.attempts<5&&source?.status!=='disconnected'){const retry=button(t('retry'),()=>action(retry,async()=>{await api({command:'retry',connectionId:receipt.connectionId,deliveryId:receipt.deliveryId});await onChanged();}));row.append(retry);}receipts.append(row);}
      status.textContent='';
    }catch(e){if(!disposed)status.textContent=e.message;}finally{loading=false;}
  }
  function modal(title){dialog?.close();const modal=el('dialog','wm-dialog'),body=el('div','wm-form');modal.setAttribute('aria-label',title);body.append(el('h2','',title));modal.append(body);modal.addEventListener('close',()=>{modal.remove();if(dialog===modal)dialog=null;add.focus();},{once:true});document.body.append(modal);dialog=modal;return{modal,body};}
  function input(parent,label,value='',readonly=false){const wrap=el('label','wm-field',label),node=el('input');node.value=value;node.readOnly=readonly;wrap.append(node);parent.append(wrap);return node;}
  function showSecret(data){const {modal:box,body}=modal(t('saved'));body.append(el('p','',t('setup')));const endpoint=new URL('/api/workspace/sources/github/'+data.id,location.origin);input(body,t('url'),endpoint.href,true);
    if(data.secret){const secret=input(body,t('secret'),data.secret,true);secret.autocomplete='off';secret.spellcheck=false;body.append(el('p','wm-meta',t('secretHint')));}else body.append(el('p','',t('lostSecret')));
    if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))body.append(el('p','wm-status',t('local')));
    body.append(button(t('close'),()=>box.close()));box.showModal();
  }
  function configure(){const {modal:box,body}=modal(t('configure')),form=el('form','wm-form'),label=input(form,t('label')),repository=input(form,t('repository'));label.required=true;label.maxLength=120;repository.required=true;repository.maxLength=140;repository.placeholder='team/robot-code';repository.autocomplete='off';
    const preview=el('p','wm-meta',t('preview')),error=el('p','wm-status');error.setAttribute('role','status');const submit=button(t('create'),()=>{});submit.type='submit';form.append(preview,error,submit,button(t('cancel'),()=>box.close()));body.append(form);let requestId=crypto.randomUUID(),lastBody='';
    form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;error.textContent=t('loading');const values={repository:repository.value.trim(),label:label.value.trim()},signature=JSON.stringify(values);if(lastBody&&lastBody!==signature)requestId=crypto.randomUUID();lastBody=signature;
      try{const data=await api({command:'create',requestId,...values});box.close();showSecret(data);await load();}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}});box.showModal();label.focus();
  }
  load();return()=>{disposed=true;abort.abort();dialog?.close();};
}
