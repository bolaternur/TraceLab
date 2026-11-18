import test from 'node:test';
import assert from 'node:assert/strict';
import {createSidebarController,primeSidebarPreference,sidebarCopy,SIDEBAR_STORAGE_KEY} from './workspace-sidebar.js';

function fixture({mobile=false,animated=false,reduced=false,saved=null,storageFails=false}={}) {
  const documentRef=new EventTarget(),windowRef=new EventTarget(),media=new EventTarget();
  media.matches=mobile;windowRef.matchMedia=query=>query.includes('prefers-reduced-motion')?{matches:reduced}:media;
  class Control extends EventTarget {
    constructor(tag='div'){super();this.tag=tag;this.attrs=new Map();this.dataset={};this.children=[];this.parentNode=null;this.isConnected=true;this.ownerDocument=documentRef;}
    setAttribute(name,value){this.attrs.set(name,String(value));}
    getAttribute(name){return this.attrs.get(name)??null;}
    removeAttribute(name){this.attrs.delete(name);}
    focus(){documentRef.activeElement=this;}
    get nextSibling(){if(!this.parentNode)return null;return this.parentNode.children[this.parentNode.children.indexOf(this)+1]??null;}
    append(node){if(node.parentNode)node.parentNode.children.splice(node.parentNode.children.indexOf(node),1);node.parentNode=this;this.children.push(node);}
    insertBefore(node,next){if(node.parentNode)node.parentNode.children.splice(node.parentNode.children.indexOf(node),1);const index=next===null?this.children.length:this.children.indexOf(next);assert.ok(index>=0,'insertion reference must belong to the original container');node.parentNode=this;this.children.splice(index,0,node);}
    contains(node){return this===node||this.children.some(child=>child.contains(node));}
    closest(selector){if(selector.includes('[role="tab"]'))return this.dataset.view?this:null;if(selector.includes('input,textarea'))return this.tag==='input'||this.tag==='textarea'||this.editable?this:null;return null;}
  }
  const host=new Control(),container=new Control(),sidebar=new Control(),panel=new Control(),navigation=new Control('nav'),tab=new Control('button'),trigger=new Control('button'),collapse=new Control('button'),dialog=new Control('dialog'),closeButton=new Control('button'),outside=new Control('button'),input=new Control('input');
  host.dataset.sidebarState=saved==='collapsed'||saved==='expanded'?saved:undefined;
  sidebar.id='sidebar';dialog.id='sidebar-mobile';tab.dataset.view='graph';
  navigation.append(tab);sidebar.append(navigation);container.append(sidebar);container.append(panel);
  documentRef.body={style:{overflow:'auto'}};documentRef.activeElement=trigger;documentRef.defaultView=windowRef;
  dialog.open=false;dialog.showModal=()=>{assert.equal(dialog.open,false);dialog.open=true;};
  dialog.close=()=>{dialog.open=false;queueMicrotask(()=>dialog.dispatchEvent(new Event('close')));};
  const animations=[];
  if(animated)dialog.animate=(frames,options)=>{let complete;const animation={frames,options,cancelled:0,finished:new Promise(resolve=>{complete=resolve;}),finish:()=>complete(),cancel(){this.cancelled++;}};animations.push(animation);return animation;};
  const values=new Map(saved===null?[]:[[SIDEBAR_STORAGE_KEY,saved]]),writes=[];
  const storage={getItem(key){if(storageFails)throw new Error('Storage unavailable');return values.get(key)??null;},setItem(key,value){if(storageFails)throw new Error('Storage unavailable');writes.push([key,value]);values.set(key,value);}};
  let otherDialog=null,locale='ru',selected=0;
  documentRef.querySelector=()=>otherDialog||dialog.open&&dialog||null;
  tab.addEventListener('click',()=>{selected++;});
  navigation.click=()=>{throw new Error('Sidebar state must not activate a view');};
  const controller=createSidebarController({host,sidebar,container,trigger,collapse,dialog,closeButton,navigation,labels:()=>sidebarCopy[locale],documentRef,windowRef,storage});
  function key(key,{target=outside,ctrlKey=false,metaKey=false,altKey=false}={}){const event=new Event('keydown',{cancelable:true});Object.assign(event,{key,ctrlKey,metaKey,altKey});Object.defineProperty(event,'target',{value:target});documentRef.dispatchEvent(event);return event;}
  return {controller,host,sidebar,container,panel,navigation,tab,trigger,collapse,dialog,closeButton,documentRef,windowRef,media,storage,values,writes,animations,input,key,get selected(){return selected;},setOtherDialog:value=>{otherDialog=value;},resize(value){media.matches=value;media.dispatchEvent(new Event('change'));},setLocale(value){locale=value;controller.refresh();}};
}

test('all ten sidebar sections and control labels are present in RU, EN and KK',()=>{
  const keys=Object.keys(sidebarCopy.ru).sort();
  for(const locale of ['ru','en','kk']){
    assert.deepEqual(Object.keys(sidebarCopy[locale]).sort(),keys);
    for(const key of ['graph','timeline','tests','history','study','gallery','models','sources','inbox','chat','expand','collapse','open','close'])assert.ok(sidebarCopy[locale][key]?.trim(),`${locale}.${key}`);
  }
  assert.equal(sidebarCopy.kk.sources,'Дереккөздер');
});

test('desktop collapse persists only layout preference and keeps the original navigation alive',()=>{
  const f=fixture();try{
    const navigation=f.navigation,tab=f.tab;
    f.trigger.dispatchEvent(new Event('click'));
    assert.equal(f.host.dataset.sidebarState,'collapsed');assert.equal(f.trigger.getAttribute('aria-expanded'),'false');assert.equal(f.trigger.getAttribute('aria-controls'),f.sidebar.id);assert.equal(f.trigger.getAttribute('aria-haspopup'),null);
    assert.deepEqual(f.writes,[[SIDEBAR_STORAGE_KEY,'collapsed']]);assert.equal(f.selected,0);assert.equal(f.navigation,navigation);assert.equal(f.tab,tab);assert.equal(f.dialog.open,false);
    f.tab.dispatchEvent(new Event('click'));assert.equal(f.selected,1);
    f.collapse.dispatchEvent(new Event('click'));assert.equal(f.host.dataset.sidebarState,'expanded');assert.equal(f.values.get(SIDEBAR_STORAGE_KEY),'expanded');
    f.setLocale('kk');assert.equal(f.trigger.getAttribute('aria-label'),sidebarCopy.kk.collapse);
  }finally{f.controller.dispose();}
});

test('mobile opens the same sidebar in a native dialog, Escape restores its exact position and focus',async()=>{
  const f=fixture({mobile:true});try{
    const sidebar=f.sidebar,navigation=f.navigation,tab=f.tab;
    f.controller.openMobile();assert.equal(f.dialog.open,true);assert.equal(f.sidebar,sidebar);assert.equal(f.navigation,navigation);assert.equal(f.tab,tab);assert.equal(f.sidebar.parentNode,f.dialog);assert.equal(f.documentRef.body.style.overflow,'hidden');assert.equal(f.documentRef.activeElement,f.closeButton);assert.equal(f.trigger.getAttribute('aria-haspopup'),'dialog');
    const cancel=new Event('cancel',{cancelable:true});f.dialog.dispatchEvent(cancel);assert.equal(cancel.defaultPrevented,true);assert.equal(f.dialog.open,false);assert.equal(f.documentRef.body.style.overflow,'auto');assert.equal(f.documentRef.activeElement,f.trigger);assert.deepEqual(f.container.children,[sidebar,f.panel]);assert.equal(f.selected,0);
    await Promise.resolve();assert.equal(f.documentRef.body.style.overflow,'auto');
    f.tab.dispatchEvent(new Event('click'));assert.equal(f.selected,1);
  }finally{f.controller.dispose();}
});

test('mobile Tab and Shift+Tab wrap between the first and last visible controls',()=>{
  const f=fixture({mobile:true});try{
    const home=f.input;home.tag='a';
    f.sidebar.append(home);f.dialog.append(f.closeButton);
    const controls=[f.closeButton,f.tab,home];
    for(const control of controls){control.tabIndex=0;control.hidden=false;control.getClientRects=()=>[{}];}
    f.dialog.querySelectorAll=()=>controls;
    const pressTab=(target,shiftKey)=>{
      const event=new Event('keydown',{cancelable:true});Object.assign(event,{key:'Tab',shiftKey});Object.defineProperty(event,'target',{value:target});f.dialog.dispatchEvent(event);return event;
    };
    f.controller.openMobile();assert.equal(f.controller.state.mobileOpen,true);assert.equal(f.documentRef.activeElement,f.closeButton);
    assert.equal(pressTab(f.closeButton,true).defaultPrevented,true);assert.equal(f.documentRef.activeElement,home);
    assert.equal(pressTab(home,false).defaultPrevented,true);assert.equal(f.documentRef.activeElement,f.closeButton);
  }finally{f.controller.dispose();}
});

test('breakpoint changes dismiss the mobile sheet and preserve the desktop preference',()=>{
  const f=fixture({saved:'collapsed'});try{
    f.resize(true);f.controller.openMobile();assert.equal(f.dialog.open,true);assert.equal(f.controller.state.desktop,'collapsed');
    f.resize(false);assert.equal(f.dialog.open,false);assert.equal(f.sidebar.parentNode,f.container);assert.equal(f.documentRef.body.style.overflow,'auto');assert.equal(f.host.dataset.sidebarState,'collapsed');assert.equal(f.controller.state.mobile,false);assert.equal(f.trigger.getAttribute('aria-expanded'),'false');assert.equal(f.writes.length,0);
  }finally{f.controller.dispose();}
});

test('an interrupted closing animation cannot dismiss a reopened mobile sheet',async()=>{
  const f=fixture({mobile:true,animated:true});try{
    f.controller.openMobile();f.controller.closeMobile();const exit=f.animations.at(-1);f.controller.openMobile();exit.finish();await Promise.resolve();assert.equal(f.dialog.open,true);assert.equal(f.sidebar.parentNode,f.dialog);assert.equal(f.documentRef.body.style.overflow,'hidden');assert.equal(f.controller.state.mobileOpen,true);
    f.controller.dispose();assert.equal(f.dialog.open,false);assert.equal(f.documentRef.body.style.overflow,'auto');assert.equal(f.sidebar.parentNode,f.container);
  }finally{f.controller.dispose();}
});

test('storage failures and invalid preferences leave sidebar controls fully usable',()=>{
  const f=fixture({storageFails:true});try{
    primeSidebarPreference(f.host,f.storage);assert.equal(f.host.dataset.sidebarState,'expanded');
    f.controller.toggle();assert.equal(f.host.dataset.sidebarState,'collapsed');f.controller.toggle();assert.equal(f.host.dataset.sidebarState,'expanded');
  }finally{f.controller.dispose();}
  const invalid=fixture({saved:'unexpected'});try{primeSidebarPreference(invalid.host,invalid.storage);assert.equal(invalid.host.dataset.sidebarState,'expanded');}finally{invalid.controller.dispose();}
});

test('Ctrl/Cmd+B ignores editing and other dialogs, toggles elsewhere and is removed on disposal',()=>{
  const f=fixture();try{
    assert.equal(f.key('b',{ctrlKey:true,target:f.input}).defaultPrevented,false);assert.equal(f.host.dataset.sidebarState,'expanded');
    f.setOtherDialog({open:true});assert.equal(f.key('b',{ctrlKey:true}).defaultPrevented,false);assert.equal(f.host.dataset.sidebarState,'expanded');f.setOtherDialog(null);
    assert.equal(f.key('b',{ctrlKey:true}).defaultPrevented,true);assert.equal(f.host.dataset.sidebarState,'collapsed');assert.equal(f.key('B',{metaKey:true}).defaultPrevented,true);assert.equal(f.host.dataset.sidebarState,'expanded');
    f.controller.dispose();assert.equal(f.key('b',{ctrlKey:true}).defaultPrevented,false);assert.equal(f.host.dataset.sidebarState,'expanded');
  }finally{f.controller.dispose();}
});

test('pagehide and reduced motion close immediately without leaving a scroll lock or replacing tabs',()=>{
  const f=fixture({mobile:true,animated:true,reduced:true});try{
    f.controller.openMobile();assert.equal(f.animations.length,0);f.windowRef.dispatchEvent(new Event('pagehide'));assert.equal(f.dialog.open,false);assert.equal(f.documentRef.body.style.overflow,'auto');assert.equal(f.sidebar.parentNode,f.container);assert.equal(f.navigation.children[0],f.tab);
    f.controller.openMobile();f.controller.closeMobile();assert.equal(f.dialog.open,false);assert.equal(f.animations.length,0);
  }finally{f.controller.dispose();}
});
