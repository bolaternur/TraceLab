import test from 'node:test';
import assert from 'node:assert/strict';
import {mountOverlayNavigation} from './astra-navigation.js';

function fixture({animated=false,reduced=false}={}) {
  const documentRef={body:{style:{overflow:'auto'}},activeElement:null};
  class Control extends EventTarget {
    constructor(){super();this.attributes=new Map();this.tabIndex=0;this.isConnected=true;this.hidden=false;}
    setAttribute(name,value){this.attributes.set(name,value);}
    getAttribute(name){return this.attributes.get(name);}
    closest(){return null;}
    getClientRects(){return [{}];}
    focus(){documentRef.activeElement=this;}
  }
  const trigger=new Control(),label={textContent:''},closeButton=new Control(),destination=new Control(),language=new Control(),animations=[];
  trigger.querySelector=()=>label;trigger.getBoundingClientRect=()=>({left:600,top:20,width:110,height:46});trigger.iconIntact=true;
  const dialog=new Control();dialog.open=false;dialog.dataset={};dialog.querySelector=()=>closeButton;dialog.querySelectorAll=()=>[closeButton,destination,language];dialog.contains=node=>node===dialog||[closeButton,destination,language].includes(node);
  dialog.showModal=()=>{assert.equal(dialog.open,false);dialog.open=true;};
  dialog.close=()=>{dialog.open=false;queueMicrotask(()=>dialog.dispatchEvent(new Event('close')));};
  if(animated)dialog.animate=(frames,options)=>{let finish;const item={frames,options,cancelled:0,finished:new Promise(resolve=>{finish=resolve;}),finish:()=>finish(),cancel(){this.cancelled++;}};animations.push(item);return item;};
  documentRef.activeElement=trigger;
  let locale='ru';const words={ru:{menuOpen:'Открыть меню',menuClose:'Закрыть меню'},en:{menuOpen:'Open menu',menuClose:'Close menu'}};
  const controller=mountOverlayNavigation({dialog,trigger,documentRef,windowRef:{matchMedia:()=>({matches:reduced})},localeText:key=>words[locale][key]});
  const key=(value,shiftKey=false)=>{const event=new Event('keydown',{cancelable:true});Object.assign(event,{key:value,shiftKey});dialog.dispatchEvent(event);return event;};
  return {controller,dialog,trigger,label,closeButton,destination,language,documentRef,animations,key,setLocale:value=>{locale=value;controller.refreshLabels();}};
}

test('menu locks the background and restores it synchronously on unmount, even before a native close event',async()=>{
  const f=fixture();f.controller.open();assert.equal(f.dialog.open,true);assert.equal(f.documentRef.body.style.overflow,'hidden');assert.equal(f.documentRef.activeElement,f.closeButton);assert.equal(f.trigger.getAttribute('aria-expanded'),'true');
  f.controller.dispose();assert.equal(f.dialog.open,false);assert.equal(f.documentRef.body.style.overflow,'auto');assert.equal(f.trigger.getAttribute('aria-expanded'),'false');
  await Promise.resolve();assert.equal(f.documentRef.body.style.overflow,'auto');f.trigger.dispatchEvent(new Event('click'));assert.equal(f.dialog.open,false);
});

test('keyboard focus stays inside the menu and Escape returns focus to its trigger',()=>{
  const f=fixture();try{f.controller.open();f.language.focus();assert.equal(f.key('Tab').defaultPrevented,true);assert.equal(f.documentRef.activeElement,f.closeButton);assert.equal(f.key('Tab',true).defaultPrevented,true);assert.equal(f.documentRef.activeElement,f.language);assert.equal(f.key('Escape').defaultPrevented,true);assert.equal(f.dialog.open,false);assert.equal(f.documentRef.activeElement,f.trigger);assert.equal(f.documentRef.body.style.overflow,'auto');}finally{f.controller.dispose();}
});

test('native Escape cancellation follows the same cleanup path and does not rely on native close-event timing',()=>{
  const f=fixture();try{f.controller.open();const event=new Event('cancel',{cancelable:true});f.dialog.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(f.dialog.open,false);assert.equal(f.documentRef.activeElement,f.trigger);assert.equal(f.documentRef.body.style.overflow,'auto');}finally{f.controller.dispose();}
});

test('following a destination unlocks scrolling without stealing focus back from navigation',()=>{
  const f=fixture();try{f.controller.open();f.destination.focus();f.destination.closest=selector=>selector.includes('a[href]')?f.destination:null;const event=new Event('click');Object.defineProperty(event,'target',{value:f.destination});f.dialog.dispatchEvent(event);assert.equal(f.dialog.open,false);assert.equal(f.documentRef.body.style.overflow,'auto');assert.equal(f.documentRef.activeElement,f.destination);}finally{f.controller.dispose();}
});

test('a completed exit from an interrupted transition cannot close a reopened menu',async()=>{
  const f=fixture({animated:true});try{f.controller.open();f.controller.close();f.animations[1].finish();f.controller.open();await Promise.resolve();assert.equal(f.dialog.open,true);assert.equal(f.documentRef.body.style.overflow,'hidden');assert.equal(f.trigger.getAttribute('aria-expanded'),'true');f.animations[0].finish();f.animations[2].finish();await Promise.resolve();assert.equal(f.dialog.dataset.motionState,'open');}finally{f.controller.dispose();}
});

test('a queued native close event from the previous opening cannot unlock the reopened menu',async()=>{
  const f=fixture();try{f.controller.open();f.controller.close({immediate:true});f.controller.open();await Promise.resolve();assert.equal(f.dialog.open,true);assert.equal(f.trigger.getAttribute('aria-expanded'),'true');assert.equal(f.documentRef.body.style.overflow,'hidden');}finally{f.controller.dispose();}
});

test('locale updates keep the icon intact and reduced motion removes the spatial reveal',()=>{
  const f=fixture({animated:true,reduced:true});try{f.setLocale('en');assert.equal(f.label.textContent,'Open menu');assert.equal(f.trigger.iconIntact,true);f.controller.open();assert.equal(f.label.textContent,'Close menu');assert.equal(f.animations[0].options.duration,100);assert.ok(f.animations[0].frames.every(frame=>!Object.hasOwn(frame,'clipPath')));}finally{f.controller.dispose();}
});
