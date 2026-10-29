import { mediaText as t } from './workspace-media-copy.js';
function el(tag,text){const node=document.createElement(tag);if(text)node.textContent=text;return node;}
export function boundedPhotoSelection(value,width,height){
  const integer=(number,fallback)=>Number.isFinite(Number(number))?Math.round(Number(number)):fallback;
  const x=Math.max(0,Math.min(width-2,integer(value.x,0))),y=Math.max(0,Math.min(height-2,integer(value.y,0)));
  return {x,y,w:Math.max(2,Math.min(width-x,integer(value.w,width))),h:Math.max(2,Math.min(height-y,integer(value.h,height)))};
}
export async function editPrivatePhoto(file,signal){
  if(file.size>15*1024*1024)throw new Error(t('tooLarge'));
  const bitmap=await createImageBitmap(file);
  if(signal?.aborted){bitmap.close();return null;}
  if(bitmap.width>8192||bitmap.height>8192||bitmap.width*bitmap.height>24_000_000){bitmap.close();throw new Error(t('tooLarge'));}
  if(bitmap.width<2||bitmap.height<2){bitmap.close();throw new Error(t('unsupported'));}
  return new Promise(resolve=>{
    const focus=document.activeElement,dialog=el('dialog');dialog.className='wm-dialog wm-editor';
    const title=el('h2',t('editPhoto'));title.id='wm-editor-title';dialog.setAttribute('aria-labelledby',title.id);
    const hint=el('p',t('editHint')),stage=el('div');stage.className='wm-editor-stage';hint.id='wm-editor-hint';
    const preview=el('canvas'),overlay=el('canvas');overlay.className='wm-editor-overlay';overlay.tabIndex=0;overlay.setAttribute('aria-label',t('selection'));overlay.setAttribute('aria-describedby',hint.id);
    let work=el('canvas'),selection=null,start=null,closed=false;
    const coordinates=el('fieldset');coordinates.className='wm-editor-coordinates';coordinates.append(el('legend',t('selection')));
    const inputs={},announcement=el('p');announcement.setAttribute('role','status');announcement.className='wm-status';
    for(const [key,label]of [['x','leftPx'],['y','topPx'],['w','widthPx'],['h','heightPx']]){
      const wrap=el('label',t(label)),input=el('input');input.type='number';input.step='1';input.min=key==='x'||key==='y'?'0':'2';inputs[key]=input;wrap.append(input);coordinates.append(wrap);
      input.addEventListener('change',()=>{selection=boundedPhotoSelection(Object.fromEntries(Object.entries(inputs).map(([name,node])=>[name,node.value])),work.width,work.height);drawSelection();});
    }
    const toolbar=el('div');toolbar.className='wm-tools';
    const button=(label,callback)=>{const node=el('button',t(label));node.type='button';node.onclick=callback;toolbar.append(node);return node;};
    function drawSelection(){const ctx=overlay.getContext('2d'),scale=overlay.width/work.width;ctx.clearRect(0,0,overlay.width,overlay.height);
      if(selection){ctx.strokeStyle='#d9dcf0';ctx.lineWidth=3;ctx.setLineDash([6,4]);ctx.strokeRect(selection.x*scale,selection.y*scale,selection.w*scale,selection.h*scale);}
      const value=selection||{x:0,y:0,w:work.width,h:work.height};for(const [key,input]of Object.entries(inputs)){input.value=String(value[key]);input.max=String(key==='x'?work.width-2:key==='y'?work.height-2:key==='w'?work.width-value.x:work.height-value.y);}
      crop.disabled=cover.disabled=!selection||selection.w<2||selection.h<2;
    }
    const redraw=()=>{const scale=Math.min(1,1200/work.width);preview.width=overlay.width=Math.round(work.width*scale);preview.height=overlay.height=Math.round(work.height*scale);preview.getContext('2d').drawImage(work,0,0,preview.width,preview.height);selection=null;drawSelection();};
    const reset=()=>{work.width=bitmap.width;work.height=bitmap.height;work.getContext('2d').drawImage(bitmap,0,0);redraw();};
    const crop=button('crop',()=>{if(!selection)return;const next=el('canvas');next.width=selection.w;next.height=selection.h;next.getContext('2d').drawImage(work,selection.x,selection.y,selection.w,selection.h,0,0,next.width,next.height);work=next;redraw();});
    const cover=button('redact',()=>{if(!selection)return;const ctx=work.getContext('2d');ctx.fillStyle='#101018';ctx.fillRect(selection.x,selection.y,selection.w,selection.h);redraw();});
    button('reset',reset);
    const finish=result=>{if(closed)return;closed=true;signal?.removeEventListener('abort',cancel);bitmap.close();dialog.close();dialog.remove();if(focus instanceof HTMLElement&&focus.isConnected)focus.focus();resolve(result);};
    const cancel=()=>finish(null);signal?.addEventListener('abort',cancel,{once:true});
    const apply=button('apply',()=>{apply.disabled=true;work.toBlob(blob=>{if(closed)return;if(blob)finish(blob);else{apply.disabled=false;announcement.textContent=t('error');}},'image/png');});button('cancel',cancel);
    const point=event=>{const rect=overlay.getBoundingClientRect();return {x:Math.max(0,Math.min(work.width,Math.round((event.clientX-rect.left)*work.width/rect.width))),y:Math.max(0,Math.min(work.height,Math.round((event.clientY-rect.top)*work.height/rect.height)))};};
    overlay.onpointerdown=event=>{start=point(event);overlay.setPointerCapture(event.pointerId);overlay.focus();};
    overlay.onpointermove=event=>{if(!start)return;const end=point(event);selection={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y)};
      drawSelection();};
    overlay.onpointerup=()=>{start=null;crop.disabled=cover.disabled=!selection||selection.w<2||selection.h<2;};
    overlay.onpointercancel=()=>{start=null;selection=null;drawSelection();};
    overlay.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();
      const value=selection||{x:Math.floor(work.width/4),y:Math.floor(work.height/4),w:Math.floor(work.width/2),h:Math.floor(work.height/2)};
      const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,dy=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0;
      selection=boundedPhotoSelection({...value,...(event.shiftKey?{w:value.w+dx,h:value.h+dy}:{x:Math.max(0,Math.min(work.width-value.w,value.x+dx)),y:Math.max(0,Math.min(work.height-value.h,value.y+dy))})},work.width,work.height);drawSelection();};
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    stage.append(preview,overlay);dialog.append(title,hint,stage,coordinates,announcement,toolbar);document.body.append(dialog);reset();dialog.showModal();
  });
}
