import {themeToggleMarkup,mountThemeToggle} from './theme-toggle.js';
/* Adapted from shadcn/ui Sidebar-07 and Sidebar (native Iznera integration).
 * https://ui.shadcn.com/docs/components/radix/sidebar
 * MIT License — Copyright (c) 2023 shadcn
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import {getWorkspaceLocale} from './workspace-i18n.js';

export const SIDEBAR_STORAGE_KEY='iznera.workspace.sidebar.v1';
const copy={
  ru:{title:'Рабочее пространство',sections:'Разделы',expand:'Развернуть боковую панель',collapse:'Свернуть боковую панель',open:'Открыть разделы',close:'Закрыть разделы',project:'Проект',materials:'Материалы',team:'Команда',home:'На главную Iznera',graph:'Граф связей',timeline:'Хронология',tests:'Испытания',history:'Решения',study:'Замеры',gallery:'Галерея',models:'3D-модели',sources:'Источники',inbox:'Входящие',chat:'Чат команды'},
  en:{title:'Workspace',sections:'Sections',expand:'Expand sidebar',collapse:'Collapse sidebar',open:'Open sections',close:'Close sections',project:'Project',materials:'Materials',team:'Team',home:'Iznera home',graph:'Connection graph',timeline:'Timeline',tests:'Tests',history:'Decisions',study:'Measurements',gallery:'Gallery',models:'3D models',sources:'Sources',inbox:'Inbox',chat:'Team chat'},
  kk:{title:'Жұмыс кеңістігі',sections:'Бөлімдер',expand:'Бүйірлік панельді кеңейту',collapse:'Бүйірлік панельді жинау',open:'Бөлімдерді ашу',close:'Бөлімдерді жабу',project:'Жоба',materials:'Материалдар',team:'Команда',home:'Iznera басты беті',graph:'Байланыстар графы',timeline:'Хронология',tests:'Сынақтар',history:'Шешімдер',study:'Өлшемдер',gallery:'Галерея',models:'3D модельдер',sources:'Дереккөздер',inbox:'Кіріс',chat:'Команда чаты'},
};
export const sidebarCopy=copy;
const text=key=>(copy[getWorkspaceLocale()]||copy.ru)[key]||key;
const validState=state=>state==='collapsed'||state==='expanded';
function readPreference(storage){try{const saved=storage?.getItem(SIDEBAR_STORAGE_KEY);return validState(saved)?saved:'expanded';}catch{return 'expanded';}}
export function primeSidebarPreference(host,storage){
  if(!host)return;
  if(!storage){try{storage=host.ownerDocument.defaultView.localStorage;}catch{}}
  host.dataset.sidebarState=readPreference(storage);
}

/** Width and mobile state never recreate a view, editor, canvas or voice session. */
export function createSidebarController({host,sidebar,container,trigger,collapse,dialog,closeButton,navigation,labels=()=>copy.ru,documentRef=host.ownerDocument,windowRef=documentRef.defaultView,storage}={}){
  const media=windowRef.matchMedia('(max-width: 760px)');
  if(!storage){try{storage=windowRef.localStorage;}catch{}}
  let state=validState(host.dataset.sidebarState)?host.dataset.sidebarState:readPreference(storage);
  let mobileOpen=false,disposed=false,animation=null,revision=0,locked=false,previousOverflow='';
  const homeNext=sidebar.nextSibling;
  const reduced=()=>windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function cancel(){revision++;animation?.cancel();animation=null;}
  function refresh(){
    host.dataset.sidebarState=state;
    const c=labels(),expanded=media.matches?mobileOpen:state==='expanded';
    trigger.setAttribute('aria-expanded',String(expanded));trigger.setAttribute('aria-controls',media.matches?dialog.id:sidebar.id);
    trigger.setAttribute('aria-label',media.matches?c.open:expanded?c.collapse:c.expand);trigger.title=trigger.getAttribute('aria-label');
    if(media.matches)trigger.setAttribute('aria-haspopup','dialog');else trigger.removeAttribute('aria-haspopup');
    collapse.setAttribute('aria-label',state==='expanded'?c.collapse:c.expand);collapse.title=collapse.getAttribute('aria-label');
    closeButton.setAttribute('aria-label',c.close);closeButton.title=c.close;
  }
  function release({restoreFocus=false}={}){
    mobileOpen=false;
    if(sidebar.parentNode===dialog)container.insertBefore(sidebar,homeNext?.isConnected?homeNext:null);
    if(locked){documentRef.body.style.overflow=previousOverflow;locked=false;}
    refresh();
    if(restoreFocus&&!disposed)trigger.focus({preventScroll:true});
  }
  function closeMobile({immediate=false,restoreFocus=true}={}){
    if(!dialog.open)return;
    mobileOpen=false;cancel();refresh();const token=revision;
    const finish=()=>{if(token!==revision||mobileOpen)return;dialog.close();release({restoreFocus});};
    if(immediate||reduced()||!dialog.animate){finish();return;}
    animation=dialog.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-20px)'}],{duration:150,easing:'cubic-bezier(.4,0,1,1)'});
    animation.finished.then(finish).catch(()=>{});
  }
  function openMobile(){
    if(disposed||!media.matches||mobileOpen)return;
    cancel();mobileOpen=true;
    if(!locked){previousOverflow=documentRef.body.style.overflow;locked=true;}
    documentRef.body.style.overflow='hidden';
    if(sidebar.parentNode!==dialog)dialog.append(sidebar);
    if(!dialog.open)dialog.showModal();
    refresh();
    if(!reduced())animation=dialog.animate?.([{opacity:.4,transform:'translateX(-28px)'},{opacity:1,transform:'translateX(0)'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'});
    closeButton.focus({preventScroll:true});
  }
  function toggle(){
    if(disposed)return;
    if(media.matches){if(mobileOpen)closeMobile();else openMobile();return;}
    state=state==='expanded'?'collapsed':'expanded';
    try{storage?.setItem(SIDEBAR_STORAGE_KEY,state);}catch{/* The control still works when browser storage is unavailable. */}
    refresh();
  }
  const dismiss=()=>closeMobile();
  const cancelDialog=event=>{event.preventDefault();closeMobile();};
  const dialogClick=event=>{if(event.target===dialog)closeMobile();};
  const nativeClosed=()=>{if(!dialog.open){cancel();release();}};
  const trapFocus=event=>{
    if(!mobileOpen||event.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not([disabled]),a[href],[tabindex]')].filter(node=>node.tabIndex>=0&&!node.hidden&&!node.closest('[hidden]')&&node.getClientRects().length);
    const first=controls[0]||closeButton,last=controls.at(-1)||closeButton,active=documentRef.activeElement;
    if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(active===last||!dialog.contains(active))){event.preventDefault();first.focus();}
  };
  const selected=event=>{if(media.matches&&event.target.closest?.('[role="tab"][data-view]'))closeMobile();};
  const resize=()=>{if(!media.matches)closeMobile({immediate:true,restoreFocus:false});else if(sidebar.contains(documentRef.activeElement)&&!dialog.open)trigger.focus();refresh();};
  const shortcut=event=>{
    if(event.defaultPrevented||!(event.ctrlKey||event.metaKey)||event.altKey||event.key.toLowerCase()!=='b')return;
    if(event.target.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
    const other=documentRef.querySelector('dialog[open]');if(other&&other!==dialog)return;
    event.preventDefault();toggle();
  };
  const storageChanged=event=>{if(event.key===SIDEBAR_STORAGE_KEY&&validState(event.newValue)){state=event.newValue;refresh();}};
  const pagehide=()=>closeMobile({immediate:true,restoreFocus:false});
  trigger.addEventListener('click',toggle);collapse.addEventListener('click',toggle);closeButton.addEventListener('click',dismiss);
  dialog.addEventListener('cancel',cancelDialog);dialog.addEventListener('click',dialogClick);dialog.addEventListener('close',nativeClosed);
  dialog.addEventListener('keydown',trapFocus);
  navigation.addEventListener('click',selected);media.addEventListener('change',resize);documentRef.addEventListener('keydown',shortcut);
  windowRef.addEventListener('storage',storageChanged);windowRef.addEventListener('pagehide',pagehide);refresh();
  return {toggle,openMobile,closeMobile,refresh,get state(){return {desktop:state,mobileOpen,mobile:media.matches};},dispose(){
    if(disposed)return;disposed=true;closeMobile({immediate:true,restoreFocus:false});cancel();release();
    trigger.removeEventListener('click',toggle);collapse.removeEventListener('click',toggle);closeButton.removeEventListener('click',dismiss);
    dialog.removeEventListener('cancel',cancelDialog);dialog.removeEventListener('click',dialogClick);dialog.removeEventListener('close',nativeClosed);
    dialog.removeEventListener('keydown',trapFocus);
    navigation.removeEventListener('click',selected);media.removeEventListener('change',resize);documentRef.removeEventListener('keydown',shortcut);
    windowRef.removeEventListener('storage',storageChanged);windowRef.removeEventListener('pagehide',pagehide);
  }};
}

const element=(documentRef,tag,className='',value)=>{const node=documentRef.createElement(tag);node.className=className;if(value!==undefined)node.textContent=value;return node;};
const symbol=(documentRef,path)=>{
  const svg=documentRef.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
  const line=documentRef.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d',path);svg.append(line);return svg;
};

export function mountWorkspaceSidebar({documentRef=document,windowRef=window}={}){
  const host=documentRef.querySelector('[data-workspace]'),bar=documentRef.querySelector('.ws-appbar'),container=documentRef.querySelector('.ws-main'),navigation=documentRef.querySelector('.ws-tabs');
  if(!host||!bar||!container||!navigation)return {refresh(){},dispose(){}};
  const tabs=[...navigation.querySelectorAll('[data-view]')];
  const el=(tag,className='',value)=>element(documentRef,tag,className,value);
  const sidebar=navigation.closest('.ws-sidebar')||el('aside','ws-sidebar');sidebar.id='ws-sidebar';if(!sidebar.parentNode)container.insertBefore(sidebar,navigation);if(navigation.parentNode!==sidebar)sidebar.append(navigation);
  const header=el('div','ws-sidebar-header'),heading=el('span'),collapse=el('button','ws-sidebar-collapse');collapse.type='button';collapse.append(symbol(documentRef,'M4 4h16v16H4zM9 4v16m7-12-4 4 4 4'));header.append(heading,collapse);sidebar.prepend(header);
  const project=el('div','ws-sidebar-project'),name=el('strong','ws-sidebar-name'),context=el('span','ws-sidebar-tail');project.append(name,context);sidebar.insertBefore(project,navigation);
  const groups=[['project','overview'],['materials','gallery'],['team','chat']].map(([key,view])=>{
    const label=el('span','ws-sidebar-group-label');label.setAttribute('aria-hidden','true');label.setAttribute('role','presentation');navigation.insertBefore(label,tabs.find(tab=>tab.dataset.view===view));return {key,label};
  });
  const footer=el('div','ws-sidebar-footer'),home=el('a');home.href=bar.querySelector('.ws-app-brand')?.getAttribute('href')||'/';home.append(symbol(documentRef,'m4 12 8-8 8 8M6 10v10h12V10M10 20v-6h4v6'));const homeText=el('span');home.append(homeText);footer.insertAdjacentHTML('beforeend',themeToggleMarkup({wide:true}));const themeControl=mountThemeToggle(footer.querySelector('[data-theme-toggle]'),{locale:getWorkspaceLocale,documentRef,windowRef});footer.append(home);sidebar.append(footer);
  const trigger=el('button','ws-sidebar-trigger');trigger.type='button';trigger.id='ws-open-sidebar';trigger.append(symbol(documentRef,'M4 4h16v16H4zM9 4v16'));const triggerText=el('span');trigger.append(triggerText);bar.insertBefore(trigger,bar.querySelector('.ws-project-select'));
  const dialog=el('dialog','ws-sidebar-mobile');dialog.id='ws-sidebar-mobile';dialog.setAttribute('aria-labelledby','ws-sidebar-mobile-title');
  const mobileBar=el('div','ws-sidebar-mobile-bar'),mobileTitle=el('h2'),closeButton=el('button','ws-sidebar-mobile-close');mobileTitle.id='ws-sidebar-mobile-title';closeButton.type='button';closeButton.append(symbol(documentRef,'m6 6 12 12M18 6 6 18'));mobileBar.append(mobileTitle,closeButton);dialog.append(mobileBar);documentRef.body.append(dialog);
  const controller=createSidebarController({host,sidebar,container,trigger,collapse,dialog,closeButton,navigation,labels:()=>copy[getWorkspaceLocale()]||copy.ru,documentRef,windowRef});
  function refresh(){
    const c=copy[getWorkspaceLocale()]||copy.ru;
    heading.textContent=c.title;sidebar.setAttribute('aria-label',c.title);triggerText.textContent=c.sections;mobileTitle.textContent=c.title;
    name.textContent=documentRef.querySelector('#ws-project option:checked')?.textContent||c.project;name.title=name.textContent;
    context.textContent=documentRef.querySelector('#ws-data-kind')?.textContent||'';context.title=context.textContent;
    for(const {key,label}of groups)label.textContent=c[key];
    for(const tab of tabs){const label=tab.querySelector('[data-ws-key]')||tab.querySelector('span');if(label)label.textContent=c[tab.dataset.view]||tab.getAttribute('aria-label');tab.title=tab.getAttribute('aria-label')||c[tab.dataset.view];}
    homeText.textContent=c.home;home.setAttribute('aria-label',c.home);home.title=c.home;controller.refresh();
  }
  refresh();
  return {refresh,dispose(){themeControl.dispose();controller.dispose();container.insertBefore(navigation,sidebar);sidebar.remove();trigger.remove();dialog.remove();}};
}
