/* Language dropdown adapted from Flowbite's free navbar example.
 * https://flowbite.com/docs/components/navbar/#language-dropdown
 * MIT License — Copyright (c) 2023 Bergside Inc.
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
 * Native controller, motion and Iznera styling are original adaptations.
 */
export const languageOptions = [
  {code:'ru',name:'Русский'}, {code:'en',name:'English'}, {code:'kk',name:'Қазақша'},
];
const labels = {
  ru:{heading:'Язык интерфейса',choose:'Выбрать язык',names:['Русский','Английский','Казахский']},
  en:{heading:'Interface language',choose:'Choose language',names:['Russian','English','Kazakh']},
  kk:{heading:'Интерфейс тілі',choose:'Тілді таңдау',names:['Орысша','Ағылшынша','Қазақша']},
};
const globe = '<svg class="iz-language-globe" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9Z"/></svg>';
const chevron = '<svg class="iz-language-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
const check = '<svg class="iz-language-check" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg>';
const valid = value => Object.hasOwn(labels,value);

export function languageSwitcherMarkup(id,locale='ru') {
  if (!/^[a-z][a-z\d-]*$/i.test(id)) throw new Error('Language switcher requires a safe unique ID');
  if (!valid(locale)) locale='ru';
  const text=labels[locale];
  return `<div class="iz-language" data-language-switcher data-open="false"><button class="iz-language-trigger" type="button" data-language-trigger aria-haspopup="menu" aria-expanded="false" aria-controls="${id}" aria-label="${text.choose}: ${languageOptions.find(item=>item.code===locale).name}">${globe}<span class="iz-language-code">${locale.toUpperCase()}</span>${chevron}</button><div class="iz-language-panel" data-language-panel id="${id}" role="menu" aria-label="${text.heading}" hidden><p class="iz-language-heading" data-language-heading>${text.heading}</p>${languageOptions.map((item,index)=>`<button class="iz-language-option" type="button" role="menuitemradio" data-locale="${item.code}" aria-checked="${item.code===locale}" tabindex="-1"><span class="iz-language-option-code" aria-hidden="true">${item.code.toUpperCase()}</span><span class="iz-language-text"><span class="iz-language-name" lang="${item.code}">${item.name}</span><span class="iz-language-hint" data-language-hint="${item.code}" ${text.names[index]===item.name?'hidden':''}>${text.names[index]}</span></span>${check}</button>`).join('')}</div></div>`;
}

export function mountLanguageSwitcher(root,{locale='ru',onChange=()=>{},documentRef=root?.ownerDocument,windowRef=documentRef?.defaultView}={}) {
  if (!root) return {refresh(){},close(){},dispose(){}};
  const trigger=root.querySelector('[data-language-trigger]'),panel=root.querySelector('[data-language-panel]');
  const options=[...root.querySelectorAll('[data-locale]')];
  let open=false,disposed=false,animation=null,revision=0;
  const reduced=()=>windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const cancelAnimation=()=>{revision++;animation?.cancel();animation=null;};
  function refresh(next=locale) {
    if (!valid(next)) return;
    const changed=next!==locale;locale=next;
    const text=labels[locale],name=languageOptions.find(item=>item.code===locale).name;
    const code=root.querySelector('.iz-language-code');
    code.textContent=locale.toUpperCase();
    trigger.setAttribute('aria-label',`${text.choose}: ${name}`);
    panel.setAttribute('aria-label',text.heading);
    root.querySelector('[data-language-heading]').textContent=text.heading;
    options.forEach((option,index)=>{
      option.setAttribute('aria-checked',String(option.dataset.locale===locale));
      const hint=option.querySelector('[data-language-hint]');
      hint.textContent=text.names[index];hint.hidden=text.names[index]===languageOptions[index].name;
    });
    if(changed&&!reduced())code.animate?.([{opacity:.2,transform:'translateY(5px)',filter:'blur(2px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],{duration:200,easing:'cubic-bezier(.16,1,.3,1)'});
  }
  function close({restoreFocus=false,immediate=false}={}) {
    if(!open)return;
    open=false;cancelAnimation();root.dataset.open='false';trigger.setAttribute('aria-expanded','false');panel.inert=true;
    if(restoreFocus)trigger.focus();
    const token=revision;
    if(!immediate&&!reduced()&&panel.animate){
      animation=panel.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-4px)'}],{duration:110,easing:'ease-out'});
      animation.finished.then(()=>{if(token===revision&&!open){panel.hidden=true;animation=null;}}).catch(()=>{});
    }else panel.hidden=true;
  }
  function show(focus='selected') {
    if(disposed)return;
    // Only one language menu may be open, including in the overlay navigation.
    documentRef.dispatchEvent(new CustomEvent('iznera-language-open',{detail:root}));
    cancelAnimation();open=true;panel.hidden=false;panel.inert=false;root.dataset.open='true';trigger.setAttribute('aria-expanded','true');
    const rect=trigger.getBoundingClientRect();
    root.dataset.placement=windowRef.innerHeight-rect.bottom<250&&rect.top>250?'up':'down';
    if(!reduced())animation=panel.animate?.([{opacity:0,transform:'translateY(-6px)',clipPath:'inset(0 0 12% 0 round 16px)'},{opacity:1,transform:'translateY(0)',clipPath:'inset(0 0 0 0 round 16px)'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'});
    const option=focus==='last'?options.at(-1):focus==='first'?options[0]:options.find(item=>item.dataset.locale===locale);
    option?.focus();
  }
  function onClick(event){
    const option=event.target.closest('[data-locale]');
    if(option&&root.contains(option)){
      const next=option.dataset.locale;
      if(valid(next)){refresh(next);close({restoreFocus:true});onChange(next);}
    }else if(trigger.contains(event.target)){
      if(open)close({restoreFocus:true});else show();
    }
  }
  function onKey(event){
    if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close({restoreFocus:true});return;}
    if(trigger.contains(event.target)&&['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();show(event.key==='ArrowUp'?'last':'first');return;
    }
    if(!open)return;
    const index=options.indexOf(event.target);
    if(index<0)return;
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:options.length-1))%options.length;
      options[next].focus();
    }else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&event.key!==' '){
      const value=event.key.toLocaleLowerCase();
      const match=options.find(option=>option.dataset.locale.startsWith(value)||option.querySelector('.iz-language-name').textContent.toLocaleLowerCase().startsWith(value));
      if(match){event.preventDefault();match.focus();}
    }
  }
  const outside=event=>{if(open&&!root.contains(event.target))close({immediate:event.type==='focusin'});};
  const other=event=>{if(event.detail!==root)close({immediate:true});};
  const leave=()=>close({immediate:true});
  root.addEventListener('click',onClick);root.addEventListener('keydown',onKey);
  documentRef.addEventListener('pointerdown',outside,true);documentRef.addEventListener('focusin',outside);
  documentRef.addEventListener('iznera-language-open',other);windowRef.addEventListener('pagehide',leave);
  refresh(locale);
  return {refresh,close,dispose(){disposed=true;close({immediate:true});cancelAnimation();panel.hidden=true;root.removeEventListener('click',onClick);root.removeEventListener('keydown',onKey);documentRef.removeEventListener('pointerdown',outside,true);documentRef.removeEventListener('focusin',outside);documentRef.removeEventListener('iznera-language-open',other);windowRef.removeEventListener('pagehide',leave);}};
}

let selectId=0;
export function enhanceLanguageSelect(select,{onChange}={}) {
  if(!select)return {refresh(){},dispose(){}};
  const documentRef=select.ownerDocument,holder=documentRef.createElement('div');
  holder.innerHTML=languageSwitcherMarkup(`workspace-language-${++selectId}`,select.value);
  const root=holder.firstElementChild;
  select.before(root);select.classList.add('iz-language-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  const controller=mountLanguageSwitcher(root,{locale:select.value,onChange:next=>{
    select.value=next;
    if(onChange)onChange(next);else select.dispatchEvent(new Event('change',{bubbles:true}));
  }});
  const refresh=()=>controller.refresh(select.value);
  select.addEventListener('change',refresh);
  return {refresh,dispose(){controller.dispose();select.removeEventListener('change',refresh);select.classList.remove('iz-language-native');select.removeAttribute('tabindex');select.removeAttribute('aria-hidden');root.remove();}};
}
