import test from 'node:test';
import assert from 'node:assert/strict';
import {hydrateTimelineMedia,timelineThumbnailUrl} from './workspace-timeline-media.js';
const origin='http://localhost:3000',artifact='a0a0a0a0-1111-4111-8111-111111111111',thumbnail='/api/workspace/media/'+artifact+'?variant=thumbnail';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function environment(count=2){
  class Image extends EventTarget{constructor(){super();this.dataset={};}removeAttribute(key){delete this[key];}remove(){if(this.parent)this.parent.images=this.parent.images.filter(image=>image!==this);}}
  const makeButton=id=>({dataset:{recordId:id},isConnected:true,main:{images:[],querySelector(){return this.images[0]||null;},append(image){image.parent=this;this.images.push(image);}},querySelector(selector){return selector==='.wv-timeline-main'?this.main:selector==='.wv-timeline-title'?{textContent:'Title '+id}:null;},getBoundingClientRect:()=>({top:10,bottom:110}),matches:()=>true});
  const observers={};let serial=0;const timers=new Map();
  const win={location:{origin},setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},IntersectionObserver:class{constructor(callback,options){this.callback=callback;this.options=options;this.nodes=new Set();observers.intersection=this;}observe(node){this.nodes.add(node);}unobserve(node){this.nodes.delete(node);}disconnect(){this.disconnected=true;this.nodes.clear();}},MutationObserver:class{constructor(callback){this.callback=callback;observers.mutation=this;}observe(){}disconnect(){this.disconnected=true;}}};
  const doc={defaultView:win,createElement:()=>new Image()},container=new EventTarget();container.ownerDocument=doc;container.buttons=Array.from({length:count},(_,index)=>makeButton('record-'+index));container.querySelectorAll=selector=>selector==='[data-timeline-media]'?container.buttons.flatMap(button=>button.main.images):container.buttons;container.getBoundingClientRect=()=>({top:0,bottom:700});
  return{container,win,observers,makeButton,async flush(){const queued=[...timers.values()];timers.clear();queued.forEach(fn=>fn());await tick();},intersect(buttons=container.buttons){observers.intersection.callback(buttons.map(target=>({target,isIntersecting:true})));}};
}
test('thumbnail URLs accept only the same-origin private thumbnail endpoint',()=>{
  assert.equal(timelineThumbnailUrl(thumbnail,origin),thumbnail);assert.equal(timelineThumbnailUrl(origin+thumbnail,origin),thumbnail);
  for(const value of ['https://evil.invalid'+thumbnail,'data:image/png;base64,AAAA','//evil.invalid'+thumbnail,thumbnail+'&token=secret',thumbnail+'#fragment',thumbnail.replace('?variant=thumbnail',''),'/api/workspace/media/../../account?variant=thumbnail','http://user:pass@localhost:3000'+thumbnail])assert.equal(timelineThumbnailUrl(value,origin),null,value);
});
test('only intersecting records are requested; pagination reuses scoped metadata without replacing timeline nodes',async()=>{
  const env=environment(150),requests=[],first=env.container.buttons[0];
  const dispose=hydrateTimelineMedia(env.container,{teamId:'team',projectId:'project',request:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({items:[{recordId:'record-0',thumbnailUrl:thumbnail,caption:'Caption'},{recordId:'foreign-record',thumbnailUrl:thumbnail},{recordId:'record-1',thumbnailUrl:'https://evil.invalid/image'}]})};}});
  assert.equal(requests.length,0);env.intersect(env.container.buttons.slice(0,2));await env.flush();
  const params=new URL(requests[0].url,origin).searchParams;assert.deepEqual(params.getAll('record'),['record-0','record-1']);assert.equal(requests[0].options.cache,'no-store');assert.equal(first.main.images.length,1);assert.equal(first.main.images[0].loading,'lazy');assert.equal(env.container.buttons[1].main.images.length,0);assert.equal(env.container.buttons[0],first);
  const replacement=env.makeButton('record-0');env.container.buttons=[replacement];env.observers.mutation.callback([{addedNodes:[replacement]}]);assert.equal(replacement.main.images.length,1);env.intersect([replacement]);await env.flush();assert.equal(requests.length,1);
  dispose();assert.equal(requests[0].options.signal.aborted,true);assert.equal(replacement.main.images.length,0);assert.equal(env.observers.intersection.disconnected,true);assert.equal(env.observers.mutation.disconnected,true);
});
test('visible metadata is batched to 100 IDs, with no duplicate requests',async()=>{
  const env=environment(200),requests=[],dispose=hydrateTimelineMedia(env.container,{teamId:'team',projectId:'project',request:async url=>{requests.push(url);return{ok:true,json:async()=>({items:[]})};}});
  env.intersect();await env.flush();await env.flush();assert.equal(requests.length,2);const ids=requests.flatMap(url=>new URL(url,origin).searchParams.getAll('record'));assert.equal(ids.length,200);assert.equal(new Set(ids).size,200);assert.ok(requests.every(url=>new URL(url,origin).searchParams.getAll('record').length<=100));env.intersect();await env.flush();assert.equal(requests.length,2);dispose();
});
test('cleanup aborts pending metadata and a late response cannot paint private media',async()=>{
  const env=environment(1);let finish,signal;const dispose=hydrateTimelineMedia(env.container,{teamId:'team',projectId:'project',request:(_url,options)=>{signal=options.signal;return new Promise(resolve=>{finish=resolve;});}});
  env.intersect();await env.flush();dispose();assert.equal(signal.aborted,true);finish({ok:true,json:async()=>({items:[{recordId:'record-0',thumbnailUrl:thumbnail}]})});await tick();assert.equal(env.container.buttons[0].main.images.length,0);
});
test('membership denial removes hydrated images and stops requesting more records',async()=>{
  const env=environment(3);let calls=0;const dispose=hydrateTimelineMedia(env.container,{teamId:'team',projectId:'project',request:async()=>++calls===1?{ok:true,json:async()=>({items:[{recordId:'record-0',thumbnailUrl:thumbnail}]})}:{ok:false,status:403}});
  env.intersect([env.container.buttons[0]]);await env.flush();assert.equal(env.container.buttons[0].main.images.length,1);env.intersect([env.container.buttons[1]]);await env.flush();assert.equal(env.container.buttons[0].main.images.length,0);env.intersect([env.container.buttons[2]]);await env.flush();assert.equal(calls,2);dispose();
});
