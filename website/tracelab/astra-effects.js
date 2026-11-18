/* Animated Beam geometry adapted from Magic UI, https://magicui.design/docs/components/animated-beam
 * MIT License. Copyright (c) Magic UI
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
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

export function beamCurve(start,end,curvature=0){
  if(![start.x,start.y,end.x,end.y,curvature].every(Number.isFinite))return '';
  return `M ${start.x},${start.y} Q ${(start.x+end.x)/2},${start.y-curvature} ${end.x},${end.y}`;
}
export function boundedSpotlight(x,y,width,height){
  return {x:Math.max(0,Math.min(Number.isFinite(x)?x:0,Math.max(0,width))),y:Math.max(0,Math.min(Number.isFinite(y)?y:0,Math.max(0,height)))};
}

export function mountEvidenceEffects(root=document){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer: fine)'),cleanups=[],pauses=[];
  for(const surface of root.querySelectorAll('[data-spotlight]')){
    let frame=null,point=null;
    const pause=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;surface.removeAttribute('data-spotlight-active');};
    const move=event=>{if(reduced.matches||!fine.matches||document.hidden)return;const bounds=surface.getBoundingClientRect();point=boundedSpotlight(event.clientX-bounds.left,event.clientY-bounds.top,bounds.width,bounds.height);if(frame!==null)return;frame=requestAnimationFrame(()=>{frame=null;if(document.hidden)return;surface.style.setProperty('--spot-x',point.x+'px');surface.style.setProperty('--spot-y',point.y+'px');surface.setAttribute('data-spotlight-active','');});};
    surface.addEventListener('pointermove',move,{passive:true});surface.addEventListener('pointerleave',pause);pauses.push(pause);
    cleanups.push(()=>{pause();surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerleave',pause);});
  }
  for(const graph of root.querySelectorAll('.a-graph')){
    const nodes=[...graph.querySelectorAll('.a-node')],svg=graph.querySelector('svg');if(!svg||nodes.length<2)continue;
    const ns='http://www.w3.org/2000/svg',layer=document.createElementNS(ns,'g'),paths=[];layer.classList.add('a-beam-layer');layer.setAttribute('aria-hidden','true');svg.append(layer);let animations=[];
    for(let index=0;index<nodes.length-1;index++){const path=document.createElementNS(ns,'path');path.classList.add('a-evidence-beam');path.setAttribute('fill','none');layer.append(path);paths.push(path);}
    function measure(){const area=graph.getBoundingClientRect();if(!area.width||!area.height)return;const box=svg.viewBox.baseVal,point=node=>{const rect=node.getBoundingClientRect();return{x:(rect.left-area.left+rect.width/2)/area.width*box.width,y:(rect.top-area.top+rect.height/2)/area.height*box.height};};for(let index=0;index<paths.length;index++){const start=point(nodes[index]),end=point(nodes[index+1]);paths[index].setAttribute('d',beamCurve(start,end,Math.max(0,start.y-end.y)));}}
    const pause=()=>{for(const animation of animations)animation.cancel();animations=[];};
    const pulse=event=>{const node=event.target.closest('.a-node');if(!node||!graph.contains(node)||reduced.matches||document.hidden)return;pause();measure();const selected=nodes.indexOf(node);paths.forEach((path,index)=>{if(index!==selected&&index+1!==selected)return;const length=path.getTotalLength();path.style.strokeDasharray=`30 ${length+30}`;if(typeof path.animate==='function')animations.push(path.animate([{strokeDashoffset:length+30,opacity:0},{strokeDashoffset:length*.65,opacity:1,offset:.2},{strokeDashoffset:0,opacity:.85,offset:.85},{strokeDashoffset:-40,opacity:0}],{duration:740,delay:index*70,easing:'cubic-bezier(.16,1,.3,1)'}));});};
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;observer?.observe(graph);measure();graph.addEventListener('click',pulse);pauses.push(pause);
    cleanups.push(()=>{pause();observer?.disconnect();graph.removeEventListener('click',pulse);layer.remove();});
  }
  const pause=()=>{for(const stop of pauses)stop();};
  document.addEventListener('visibilitychange',pause);reduced.addEventListener('change',pause);fine.addEventListener('change',pause);
  return()=>{pause();for(const dispose of cleanups)dispose();document.removeEventListener('visibilitychange',pause);reduced.removeEventListener('change',pause);fine.removeEventListener('change',pause);};
}
