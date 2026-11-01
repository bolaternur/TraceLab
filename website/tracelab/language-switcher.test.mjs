import test from 'node:test';
import assert from 'node:assert/strict';
import {languageSwitcherMarkup,mountLanguageSwitcher} from './language-switcher.js';

function fixture({animated=false,reduced=false}={}) {
  const documentRef=new EventTarget(),windowRef=new EventTarget();
  windowRef.innerHeight=800;windowRef.matchMedia=()=>({matches:reduced});
  class Control extends EventTarget {
    constructor(){super();this.attrs={};this.dataset={};this.hidden=false;this.textContent='';}
    setAttribute(name,value){this.attrs[name]=value;}
    getAttribute(name){return this.attrs[name];}
    focus(){documentRef.activeElement=this;}
    contains(node){return this===node;}
    closest(selector){return selector==='[data-locale]'&&this.dataset.locale?this:null;}
  }
  const trigger=new Control(),panel=new Control(),heading=new Control(),code=new Control(),root=new Control(),animations=[],changes=[];
  const options=['ru','en','kk'].map(locale=>{
    const item=new Control(),hint=new Control(),name=new Control();item.dataset.locale=locale;name.textContent={ru:'Русский',en:'English',kk:'Қазақша'}[locale];
    item.querySelector=selector=>selector==='[data-language-hint]'?hint:name;return item;
  });
  panel.hidden=true;trigger.getBoundingClientRect=()=>({top:24,bottom:68});
  root.querySelector=selector=>({'[data-language-trigger]':trigger,'[data-language-panel]':panel,'[data-language-heading]':heading,'.iz-language-code':code}[selector]);
  root.querySelectorAll=()=>options;root.contains=node=>[root,trigger,panel,...options].includes(node);
  if(animated)panel.animate=(frames,settings)=>{
    let finish;const a={frames,settings,finished:new Promise(resolve=>{finish=resolve;}),cancel(){},finish:()=>finish()};animations.push(a);return a;
  };
  const controller=mountLanguageSwitcher(root,{locale:'ru',onChange:next=>changes.push(next),documentRef,windowRef});
  function fire(type,target,props={}){const event=new Event(type,{cancelable:true});Object.defineProperty(event,'target',{value:target});Object.assign(event,props);root.dispatchEvent(event);return event;}
  return {controller,root,trigger,panel,options,documentRef,windowRef,heading,code,animations,changes,click:target=>fire('click',target),key:(target,key)=>fire('keydown',target,{key})};
}

test('language markup retains native names and declares a single selection, with safe IDs',()=>{
  const html=languageSwitcherMarkup('test-languages','kk');
  assert.equal((html.match(/aria-checked="true"/g)||[]).length,1);
  for(const name of ['Русский','English','Қазақша'])assert.ok(html.includes(name));
  assert.ok(html.includes('aria-controls="test-languages"'));
  assert.throws(()=>languageSwitcherMarkup('unsafe"onclick="x'));
});

test('keyboard navigation selects a locale and returns focus without losing the current page',()=>{
  const f=fixture();try{
    assert.equal(f.key(f.trigger,'ArrowDown').defaultPrevented,true);assert.equal(f.panel.hidden,false);assert.equal(f.documentRef.activeElement,f.options[0]);
    f.key(f.options[0],'End');assert.equal(f.documentRef.activeElement,f.options[2]);
    f.click(f.options[2]);assert.deepEqual(f.changes,['kk']);assert.equal(f.code.textContent,'KK');assert.equal(f.panel.hidden,true);assert.equal(f.documentRef.activeElement,f.trigger);assert.equal(f.options[2].getAttribute('aria-checked'),'true');
    f.click(f.trigger);f.key(f.options[2],'ArrowDown');assert.equal(f.documentRef.activeElement,f.options[0]);
    assert.equal(f.key(f.options[0],'Escape').defaultPrevented,true);assert.equal(f.panel.hidden,true);
  }finally{f.controller.dispose();}
});

test('a completed exit cannot hide a reopened language panel and reduced motion skips animation',async()=>{
  const f=fixture({animated:true});try{
    f.click(f.trigger);f.controller.close();const exit=f.animations.at(-1);f.click(f.trigger);exit.finish();await Promise.resolve();assert.equal(f.panel.hidden,false);assert.equal(f.trigger.getAttribute('aria-expanded'),'true');
  }finally{f.controller.dispose();}
  const reduced=fixture({animated:true,reduced:true});try{reduced.click(reduced.trigger);reduced.controller.close();assert.equal(reduced.animations.length,0);assert.equal(reduced.panel.hidden,true);}finally{reduced.controller.dispose();}
});

test('outside focus and disposal close the menu and remove its listeners',()=>{
  const f=fixture();f.click(f.trigger);
  const focus=new Event('focusin');Object.defineProperty(focus,'target',{value:new EventTarget()});f.documentRef.dispatchEvent(focus);assert.equal(f.panel.hidden,true);
  f.controller.dispose();f.click(f.trigger);assert.equal(f.panel.hidden,true);
});
