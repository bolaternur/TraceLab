import {THEME_STORAGE_KEY,THEME_COLORS} from './theme-bootstrap.js';

export {THEME_STORAGE_KEY};
export const themeCopy={
  ru:{label:'Молочная тема',milk:'Включить молочную тему',dark:'Включить тёмную тему'},
  en:{label:'Milk theme',milk:'Switch to milk theme',dark:'Switch to dark theme'},
  kk:{label:'Сүт түсті тақырып',milk:'Сүт түсті тақырыпқа ауысу',dark:'Қараңғы тақырыпқа ауысу'},
};
const valid=theme=>theme==='dark'||theme==='milk';
const transitions=new WeakMap();
export function readTheme(storage){try{const value=storage?.getItem(THEME_STORAGE_KEY);return valid(value)?value:'dark';}catch{return 'dark';}}
export function currentTheme(documentRef=globalThis.document){return valid(documentRef?.documentElement?.dataset.theme)?documentRef.documentElement.dataset.theme:'dark';}

/** Layout and data are unchanged: only semantic colors, metadata and preference. */
export function applyTheme(theme,{documentRef=globalThis.document,windowRef=documentRef?.defaultView,persist=true,animate=true,storage}={}){
  if(!valid(theme)||!documentRef)return false;
  const root=documentRef.documentElement,changed=currentTheme(documentRef)!==theme;
  const previous=transitions.get(root);if(previous){previous.windowRef.clearTimeout(previous.id);transitions.delete(root);}
  delete root.dataset.themeTransition;
  if(changed&&animate&&!windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
    root.dataset.themeTransition='true';
    const id=windowRef.setTimeout(()=>{delete root.dataset.themeTransition;transitions.delete(root);},260);transitions.set(root,{id,windowRef});
  }
  if(root.dataset.theme!==theme)root.dataset.theme=theme;
  root.style.colorScheme=theme==='milk'?'light':'dark';
  documentRef.querySelector('meta[name="theme-color"]')?.setAttribute('content',THEME_COLORS[theme]);
  if(persist){try{(storage||windowRef.localStorage)?.setItem(THEME_STORAGE_KEY,theme);}catch{/* Private browsing still permits an in-memory choice. */}}
  if(changed){const EventClass=windowRef.CustomEvent||globalThis.CustomEvent;windowRef.dispatchEvent(new EventClass('iznera-theme-change',{detail:{theme}}));}
  return true;
}

export const themeIconMarkup='<span class="iz-theme-glyph" aria-hidden="true"><svg class="iz-theme-sun" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg><svg class="iz-theme-moon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.2A8.8 8.8 0 0 1 10.8 3.4 8.8 8.8 0 1 0 20.6 13.2Z"/></svg></span>';
export const themeToggleMarkup=({wide=false}={})=>`<button type="button" class="iz-theme-toggle${wide?' iz-theme-toggle-wide':''}" data-theme-toggle role="switch" aria-checked="false" aria-label="${themeCopy.ru.label}" title="${themeCopy.ru.milk}">${themeIconMarkup}${wide?'<span data-theme-label>Молочная тема</span>':''}</button>`;

export function mountThemeToggle(button,{locale=()=>button?.ownerDocument?.documentElement.lang||'ru',documentRef=button?.ownerDocument,windowRef=documentRef?.defaultView}={}){
  if(!button||!documentRef||!windowRef)return {refresh(){},dispose(){}};
  function refresh(){
    const theme=currentTheme(documentRef),copy=themeCopy[locale()]||themeCopy.ru;
    button.setAttribute('aria-label',copy.label);button.setAttribute('aria-checked',String(theme==='milk'));button.title=copy[theme==='milk'?'dark':'milk'];
    const text=button.querySelector('[data-theme-label]');if(text)text.textContent=copy.label;
  }
  const toggle=()=>{applyTheme(currentTheme(documentRef)==='milk'?'dark':'milk',{documentRef,windowRef});refresh();};
  const storageChanged=event=>{
    if(event.key!==THEME_STORAGE_KEY)return;
    const theme=event.newValue===null?'dark':event.newValue;
    if(valid(theme))applyTheme(theme,{documentRef,windowRef,persist:false,animate:false});refresh();
  };
  const observer=windowRef.MutationObserver?new windowRef.MutationObserver(refresh):null;
  observer?.observe(documentRef.documentElement,{attributes:true,attributeFilter:['lang','data-theme']});
  button.addEventListener('click',toggle);windowRef.addEventListener('storage',storageChanged);windowRef.addEventListener('iznera-theme-change',refresh);
  let initial=currentTheme(documentRef);
  if(!valid(documentRef.documentElement.dataset.theme)){try{initial=readTheme(windowRef.localStorage);}catch{initial='dark';}}
  applyTheme(initial,{documentRef,windowRef,persist:false,animate:false});refresh();
  return {refresh,dispose(){observer?.disconnect();button.removeEventListener('click',toggle);windowRef.removeEventListener('storage',storageChanged);windowRef.removeEventListener('iznera-theme-change',refresh);}};
}

export function mountThemeToggles(documentRef=globalThis.document){
  const controls=[...documentRef.querySelectorAll('[data-theme-toggle]')].map(button=>mountThemeToggle(button,{documentRef}));
  return {refresh(){controls.forEach(control=>control.refresh());},dispose(){controls.forEach(control=>control.dispose());}};
}
