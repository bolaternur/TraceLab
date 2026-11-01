// Native command dialog informed by shadcn Command's grouped search pattern.
// Reference: https://ui.shadcn.com/docs/components/radix/command
// Uses existing workspace actions; no remote component runtime or extra framework.
import {getWorkspaceLocale,recordType} from './workspace-i18n.js';
const copy={
 ru:{open:'Быстрый переход',search:'Найти раздел или запись',sections:'Разделы',records:'Записи проекта',empty:'Ничего не найдено. Попробуйте другое название.',close:'Закрыть',hint:'↑ ↓ выбрать · Enter открыть · Esc закрыть'},
 en:{open:'Quick navigation',search:'Find a section or record',sections:'Sections',records:'Project records',empty:'No matches. Try a different title.',close:'Close',hint:'↑ ↓ select · Enter open · Esc close'},
 kk:{open:'Жылдам өту',search:'Бөлімді немесе жазбаны табу',sections:'Бөлімдер',records:'Жоба жазбалары',empty:'Ештеңе табылмады. Басқа атауды іздеп көріңіз.',close:'Жабу',hint:'↑ ↓ таңдау · Enter ашу · Esc жабу'},
};
export function commandMatches(items,query){const terms=query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);return items.filter(item=>terms.every(term=>`${item.label} ${item.detail||''}`.toLocaleLowerCase().includes(term))).slice(0,40);}
export function mountWorkspaceCommand({getProject,onRecord,onView,documentRef=document}){
 const c=()=>copy[getWorkspaceLocale()]||copy.ru;
 const node=(tag,cls,text)=>{const el=documentRef.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const sidebar=documentRef.querySelector('.ws-sidebar'),trigger=node('button','wk-command-trigger');trigger.type='button';
 trigger.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span></span><kbd>Ctrl K</kbd>';
 sidebar?.insertBefore(trigger,sidebar.querySelector('.ws-tabs'));
 let modal,previous,rows=[],active=0,input,list,status;
 function close(){modal?.close();}
 function activate(index){if(!rows.length){input.removeAttribute('aria-activedescendant');return;}active=(index+rows.length)%rows.length;rows.forEach((row,i)=>row.setAttribute('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant',rows[active].id);rows[active].scrollIntoView({block:'nearest'});}
 function render(){
  const sections=[...documentRef.querySelectorAll('.ws-tabs [data-view]')].map(tab=>({label:tab.getAttribute('aria-label')||tab.textContent.trim(),detail:'',group:'sections',run:()=>onView(tab.dataset.view)}));
  const records=(getProject()?.records||[]).map(record=>({label:record.title,detail:recordType(record.kind),group:'records',run:()=>onRecord(record.id)}));
  const matches=commandMatches([...sections,...records],input.value);list.replaceChildren();rows=[];let group='';
  for(const [i,item]of matches.entries()){
   if(item.group!==group){list.append(node('div','wk-command-group',c()[item.group]));group=item.group;}
   const row=node('div','wk-command-item');row.id='wk-command-result-'+i;row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.append(node('strong','',item.label));if(item.detail)row.append(node('small','',item.detail));
   row.addEventListener('click',()=>{close();item.run();});list.append(row);rows.push(row);
  }
  status.textContent=matches.length?'':c().empty;activate(0);
 }
 function open(){
  if(modal?.open)return;previous=documentRef.activeElement;modal=node('dialog','wk-command');modal.setAttribute('aria-labelledby','wk-command-title');
  const head=node('header','wk-command-head'),title=node('h2','','');title.id='wk-command-title';title.textContent=c().open;const exit=node('button','ws-tool-button',c().close);exit.type='button';exit.onclick=close;head.append(title,exit);
  input=node('input','wk-command-input');input.type='search';input.placeholder=c().search;input.setAttribute('aria-label',c().search);input.setAttribute('role','combobox');input.setAttribute('aria-expanded','true');input.setAttribute('aria-controls','wk-command-list');input.setAttribute('aria-autocomplete','list');input.maxLength=200;
  list=node('div','wk-command-list');list.id='wk-command-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',c().search);status=node('p','wk-command-status');status.setAttribute('role','status');
  modal.append(head,input,list,status,node('p','wk-command-hint',c().hint));
  input.oninput=render;input.onkeydown=event=>{if(['ArrowDown','ArrowUp','Home','End','Enter'].includes(event.key)){event.preventDefault();if(event.key==='Enter')rows[active]?.click();else activate(event.key==='Home'?0:event.key==='End'?rows.length-1:active+(event.key==='ArrowDown'?1:-1));}};
  modal.addEventListener('close',()=>{modal.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});documentRef.body.append(modal);modal.showModal();render();input.focus();
 }
 function refresh(){trigger.setAttribute('aria-label',c().open);trigger.title=c().open+' · Ctrl / ⌘ K';trigger.querySelector('span').textContent=c().open;}
 const shortcut=event=>{if(event.defaultPrevented||event.altKey||!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='k'||event.target.closest?.('input,textarea,select,[contenteditable=true]')||documentRef.querySelector('dialog[open]'))return;event.preventDefault();open();};
 trigger.onclick=open;refresh();documentRef.addEventListener('keydown',shortcut);
 return{refresh,dispose(){close();trigger.remove();documentRef.removeEventListener('keydown',shortcut);}};
}
