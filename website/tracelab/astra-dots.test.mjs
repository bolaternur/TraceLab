import test from 'node:test';
import assert from 'node:assert/strict';
import {DOT_FIELD_LIMITS,dotFieldLayout,stepDotPointer,mountDots,mountDotFields} from './astra-dots.js';

test('dot fields stay within the desktop/mobile budgets and finite surface bounds',()=>{
  for(const [width,height] of [[1,1],[390,650],[1440,700],[10000,20000],[1e10,10]])for(const compact of [true,false]){
    const points=dotFieldLayout(width,height,{compact});assert.ok(points.length>0);assert.ok(points.length<=(compact?200:700));
    for(const point of points){assert.ok(Number.isFinite(point.x)&&point.x>=0&&point.x<=width);assert.ok(Number.isFinite(point.y)&&point.y>=0&&point.y<=height);assert.ok(point.opacity>=0&&point.opacity<=1);}
  }
  for(const dimensions of [[0,20],[-1,2],[NaN,10],[10,Infinity]])assert.deepEqual(dotFieldLayout(...dimensions),[]);
});

test('pointer feedback settles exactly, including a pointer leaving the surface',()=>{
  let state={x:0,y:0,strength:0},target={x:800,y:120,active:true};
  for(let i=0;i<100;i++)state=stepDotPointer(state,target,16);
  assert.deepEqual(state,{x:800,y:120,strength:1,moving:false});
  target={...target,active:false};for(let i=0;i<100;i++)state=stepDotPointer(state,target,16);
  assert.deepEqual(state,{x:800,y:120,strength:0,moving:false});
});

class Target{
  handlers=new Map();
  addEventListener(name,handler){if(!this.handlers.has(name))this.handlers.set(name,new Set());this.handlers.get(name).add(handler);}
  removeEventListener(name,handler){this.handlers.get(name)?.delete(handler);}
  emit(name,event={}){for(const handler of this.handlers.get(name)||[])handler(event);}
  get listenerCount(){return [...this.handlers.values()].reduce((count,items)=>count+items.size,0);}
}
function fixture({width=1000,height=520,reduced=false,coarse=false}={}){
  const surface=new Target(),doc=new Target(),view=new Target(),frames=new Map(),media=new Map(),observers=[];
  let frameId=0,time=0,clears=0,fills=0;
  const context={setTransform(){},clearRect(){clears++;},beginPath(){},arc(){},fill(){fills++;}};
  const canvas={setAttribute(){},getContext:()=>context,remove(){this.removed=true;}};
  const field={ownerDocument:doc,children:[],getBoundingClientRect:()=>({width,height,left:0,top:0}),setAttribute(){},append(node){this.children.push(node);},closest:()=>surface};
  doc.defaultView=view;doc.createElement=()=>canvas;doc.hidden=false;doc.querySelectorAll=()=>[field];view.devicePixelRatio=4;
  view.matchMedia=query=>{const item=new Target();item.matches=query.includes('reduced')?reduced:coarse;media.set(query,item);return item;};
  view.requestAnimationFrame=handler=>{const id=++frameId;frames.set(id,handler);return id;};view.cancelAnimationFrame=id=>frames.delete(id);
  view.ResizeObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
  view.IntersectionObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
  function flush(){let count=0;while(frames.size&&count++<150){const [id,handler]=frames.entries().next().value;frames.delete(id);handler(time+=16);}assert.equal(frames.size,0,'decorative motion must reach an idle state');}
  return {field,doc,view,surface,canvas,frames,media,observers,flush,get clears(){return clears;},get fills(){return fills;},resize(w,h){width=w;height=h;observers[0].callback();},intersect(visible){observers[1].callback([{isIntersecting:visible}]);}};
}

test('the field paints once at rest and stops scheduling frames after pointer feedback settles',()=>{
  const f=fixture(),cleanup=mountDots(f.field);try{
    assert.equal(f.clears,1);assert.equal(f.frames.size,0);assert.equal(f.canvas.width,1000*DOT_FIELD_LIMITS.dpr);
    assert.equal(mountDots(f.field),cleanup,'a second initializer must not double listeners or canvas');
    f.surface.emit('pointermove',{clientX:850,clientY:200});assert.equal(f.frames.size,1);f.flush();
    const settled=f.clears;assert.ok(settled>1);assert.equal(f.frames.size,0);
    f.surface.emit('pointerleave');f.flush();assert.ok(f.clears>settled);assert.equal(f.frames.size,0);
  }finally{cleanup();cleanup();}
  assert.equal(f.canvas.removed,true);assert.equal(f.surface.listenerCount,0);assert.equal(f.doc.listenerCount,0);assert.equal(f.view.listenerCount,0);assert.ok(f.observers.every(item=>item.disconnected));
});

test('reduced motion, coarse pointers, hidden and offscreen fields never run decorative loops',()=>{
  for(const options of [{reduced:true},{coarse:true},{width:390}]){const f=fixture(options),cleanup=mountDots(f.field);try{f.surface.emit('pointermove',{clientX:100,clientY:200});assert.equal(f.frames.size,0);assert.ok(f.fills<=700);}finally{cleanup();}}
  const f=fixture(),cleanup=mountDots(f.field);try{
    f.surface.emit('pointermove',{clientX:800,clientY:300});assert.equal(f.frames.size,1);f.intersect(false);assert.equal(f.frames.size,0);
    f.intersect(true);assert.equal(f.frames.size,0);f.surface.emit('pointermove',{clientX:700,clientY:300});f.doc.hidden=true;f.doc.emit('visibilitychange');assert.equal(f.frames.size,0);
    f.doc.hidden=false;f.doc.emit('visibilitychange');assert.equal(f.frames.size,0);
    f.surface.emit('pointermove',{clientX:700,clientY:300});const reduced=f.media.get('(prefers-reduced-motion: reduce)');reduced.matches=true;reduced.emit('change');assert.equal(f.frames.size,0);
    f.surface.emit('pointermove',{clientX:700,clientY:300});assert.equal(f.frames.size,0);
  }finally{cleanup();}
});

test('resize work and page lifecycle remain bounded and cleanup removes every animation',()=>{
  const f=fixture(),cleanup=mountDotFields(f.doc);try{
    f.resize(20000,10000);assert.equal(f.canvas.width,DOT_FIELD_LIMITS.width*DOT_FIELD_LIMITS.dpr);assert.equal(f.canvas.height,DOT_FIELD_LIMITS.height*DOT_FIELD_LIMITS.dpr);
    f.surface.emit('pointermove',{clientX:400,clientY:100});assert.equal(f.frames.size,1);f.view.emit('pagehide');assert.equal(f.frames.size,0);
    f.view.emit('pageshow');assert.equal(f.frames.size,0);f.surface.emit('pointermove',{clientX:700,clientY:300});assert.equal(f.frames.size,1);
  }finally{cleanup();}
  assert.equal(f.frames.size,0);f.surface.emit('pointermove',{clientX:300,clientY:200});assert.equal(f.frames.size,0);
});
