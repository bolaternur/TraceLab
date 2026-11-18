/** Original Iznera dot-field interaction, informed by the supplied Framer reference.
 * Canvas is decorative only. No remote component code or Framer runtime is loaded.
 */
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const mounted=new WeakMap();
export const DOT_FIELD_LIMITS=Object.freeze({desktop:700,compact:200,dpr:1.5,width:2048,height:1200});

export function dotFieldLayout(width,height,{compact=false}={}){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return [];
  const budget=compact?DOT_FIELD_LIMITS.compact:DOT_FIELD_LIMITS.desktop;
  let columns=Math.max(1,Math.ceil(width/38)),rows=Math.max(1,Math.ceil(height/38));
  if(columns*rows>budget){columns=clamp(Math.floor(Math.sqrt(budget*width/height)),1,budget);rows=Math.max(1,Math.floor(budget/columns));}
  const points=[];
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const nx=(column+.5)/columns,ny=(row+.5)/rows;
    const center=Math.exp(-(((nx-.5)/.3)**4+((ny-.58)/.39)**4));
    const fade=Math.min(1,ny*8,(1-ny)*7),edge=.2+.8*Math.abs(nx-.5)*2;
    points.push({x:nx*width,y:clamp(ny*height+Math.sin(nx*5+row*.18)*6*nx,0,height),
      opacity:clamp((.11+edge*.18)*(1-center*.94)*fade,.004,.35),
      radius:compact?1:1.05+(column%5===0?.35:0),coral:clamp((nx-.42)*1.65,0,.86)});
  }
  return points;
}

export function stepDotPointer(current,target,elapsed){
  const amount=1-Math.exp(-clamp(Number.isFinite(elapsed)?elapsed:16,1,48)/82);
  const strengthTarget=target.active?1:0;
  const next={x:current.x+(target.x-current.x)*amount,y:current.y+(target.y-current.y)*amount,
    strength:current.strength+(strengthTarget-current.strength)*amount};
  const moving=Math.abs(next.strength-strengthTarget)>.004 || (target.active&&(Math.abs(next.x-target.x)>.2||Math.abs(next.y-target.y)>.2));
  if(!moving)return {x:target.x,y:target.y,strength:strengthTarget,moving:false};
  return {...next,moving:true};
}

export function mountDots(field){
  if(!field||mounted.has(field))return mounted.get(field)||(()=>{});
  const doc=field.ownerDocument,view=doc?.defaultView,surface=field.closest('.a-dot-surface')||field.parentElement;
  if(!doc||!view||!surface)return ()=>{};
  const canvas=doc.createElement('canvas'),context=canvas.getContext('2d',{alpha:true});
  if(!context)return ()=>{};
  canvas.className='a-dot-canvas';canvas.setAttribute('aria-hidden','true');field.setAttribute('aria-hidden','true');field.append(canvas);
  const reduced=view.matchMedia('(prefers-reduced-motion: reduce)'),coarse=view.matchMedia('(pointer: coarse)');
  let disposed=false,visible=true,suspended=false,frame=0,lastFrame=0,width=0,height=0,points=[],ratio=1;
  let pointer={x:0,y:0,active:false},current={x:0,y:0,strength:0};
  const interactive=()=>!reduced.matches&&!coarse.matches&&width>600;
  const runnable=()=>!disposed&&visible&&!suspended&&!doc.hidden;
  const stop=()=>{if(frame)view.cancelAnimationFrame(frame);frame=0;lastFrame=0;};
  function paint(){
    if(!runnable()||!width||!height)return;
    context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
    const radius=165;
    for(const point of points){
      const dx=point.x-current.x,dy=point.y-current.y,distance=Math.hypot(dx,dy);
      const influence=interactive()?Math.max(0,1-distance/radius)**2*current.strength:0;
      const shift=influence*8,divisor=Math.max(distance,1),coral=Math.min(1,point.coral+influence*.8);
      const red=Math.round(119+(250-119)*coral),green=Math.round(119+(91-119)*coral),blue=Math.round(137+(71-137)*coral);
      // The quiet center remains quiet even while the pointer crosses the title.
      context.fillStyle=`rgba(${red},${green},${blue},${Math.min(.88,point.opacity*(1+influence*4))})`;
      context.beginPath();context.arc(point.x+dx/divisor*shift,point.y+dy/divisor*shift,point.radius+influence*.7,0,Math.PI*2);context.fill();
    }
  }
  function tick(now){
    frame=0;if(!runnable()||!interactive())return;
    current=stepDotPointer(current,pointer,lastFrame?now-lastFrame:16);lastFrame=now;paint();
    if(current.moving)frame=view.requestAnimationFrame(tick);else lastFrame=0;
  }
  function schedule(){if(runnable()&&interactive()&&!frame)frame=view.requestAnimationFrame(tick);}
  function reset(){stop();pointer.active=false;current={...current,strength:0};paint();}
  function resize(){
    if(disposed)return;const bounds=field.getBoundingClientRect();
    width=Math.max(0,Math.min(DOT_FIELD_LIMITS.width,bounds.width));height=Math.max(0,Math.min(DOT_FIELD_LIMITS.height,bounds.height));
    ratio=clamp(view.devicePixelRatio||1,1,DOT_FIELD_LIMITS.dpr);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    points=dotFieldLayout(width,height,{compact:coarse.matches||bounds.width<=600});reset();
  }
  function move(event){
    if(!runnable()||!interactive())return;const bounds=field.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
    pointer={x:clamp((event.clientX-bounds.left)/bounds.width*width,0,width),y:clamp((event.clientY-bounds.top)/bounds.height*height,0,height),active:true};
    if(current.strength===0)current={x:pointer.x,y:pointer.y,strength:0};schedule();
  }
  function leave(){pointer.active=false;schedule();}
  function visibility(){if(doc.hidden)reset();else paint();}
  function pagehide(){suspended=true;reset();}
  function pageshow(){suspended=false;resize();}
  surface.addEventListener('pointermove',move,{passive:true});surface.addEventListener('pointerleave',leave,{passive:true});
  doc.addEventListener('visibilitychange',visibility);view.addEventListener('pagehide',pagehide);view.addEventListener('pageshow',pageshow);
  reduced.addEventListener('change',reset);coarse.addEventListener('change',resize);
  const resizeObserver=view.ResizeObserver?new view.ResizeObserver(resize):null;
  resizeObserver?.observe(field);if(!resizeObserver)view.addEventListener('resize',resize,{passive:true});
  const intersection=view.IntersectionObserver?new view.IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);reset();},{threshold:.01}):null;
  intersection?.observe(field);resize();
  function cleanup(){
    if(disposed)return;disposed=true;stop();resizeObserver?.disconnect();intersection?.disconnect();
    surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerleave',leave);doc.removeEventListener('visibilitychange',visibility);
    view.removeEventListener('pagehide',pagehide);view.removeEventListener('pageshow',pageshow);view.removeEventListener('resize',resize);
    reduced.removeEventListener('change',reset);coarse.removeEventListener('change',resize);canvas.remove();mounted.delete(field);
  }
  mounted.set(field,cleanup);return cleanup;
}

export function mountDotFields(root=globalThis.document){
  const fields=[...(root?.querySelectorAll('[data-dot-field]')||[])],cleanups=fields.map(field=>mountDots(field));
  return ()=>cleanups.forEach(cleanup=>cleanup());
}
