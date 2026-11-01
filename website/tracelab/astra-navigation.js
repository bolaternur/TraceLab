/** Original native implementation of a full-screen motion menu; no Framer runtime or CDN code. */
export function mountOverlayNavigation({dialog,trigger,localeText=key=>key,documentRef=globalThis.document,windowRef=globalThis}={}) {
  if (!dialog || !trigger) return {open(){},close(){},refreshLabels(){},dispose(){}};
  let opened=false,disposed=false,revision=0,animation=null,previousFocus=null,previousOverflow='',restoreOnClose=true,scrollLocked=false;
  const reduced=windowRef.matchMedia?.('(prefers-reduced-motion: reduce)');
  const label=trigger.querySelector('[data-menu-label]');
  const closeControl=dialog.querySelector('[data-menu-close]');
  const visibleControls=()=>[...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]')]
    .filter(node=>node.tabIndex>=0&&!node.hidden&&!node.closest('[hidden]')&&(!node.getClientRects||node.getClientRects().length));
  function refreshLabels() {
    const text=localeText(opened?'menuClose':'menuOpen');
    if(label)label.textContent=text;
    trigger.setAttribute('aria-label',text);
    trigger.setAttribute('aria-expanded',String(opened));
  }
  function cancelAnimation(){animation?.cancel();animation=null;}
  function release() {
    opened=false;revision++;cancelAnimation();dialog.dataset.motionState='closed';refreshLabels();
    if(!scrollLocked)return;
    scrollLocked=false;
    documentRef.body.style.overflow=previousOverflow;
    if(restoreOnClose){const target=previousFocus?.isConnected?previousFocus:trigger;target.focus({preventScroll:true});}
    previousFocus=null;
  }
  function open() {
    if(disposed||opened)return;
    const wasAlreadyVisible=dialog.open;
    revision++;cancelAnimation();opened=true;restoreOnClose=true;
    if(!wasAlreadyVisible){previousFocus=documentRef.activeElement;previousOverflow=documentRef.body.style.overflow;dialog.showModal();}
    documentRef.body.style.overflow='hidden';scrollLocked=true;dialog.dataset.motionState='opening';refreshLabels();
    const origin=trigger.getBoundingClientRect?.(),x=origin?origin.left+origin.width/2:90,y=origin?origin.top+origin.height/2:32;
    if(dialog.animate){
      const frames=reduced?.matches?[{opacity:.6},{opacity:1}]:[{clipPath:`circle(0% at ${x}px ${y}px)`},{clipPath:`circle(160% at ${x}px ${y}px)`}];
      const current=revision;animation=dialog.animate(frames,{duration:reduced?.matches?100:480,easing:'cubic-bezier(.16,1,.3,1)'});
      animation.finished.then(()=>{if(current===revision&&opened){animation=null;dialog.dataset.motionState='open';}}).catch(()=>{});
    }else dialog.dataset.motionState='open';
    (closeControl||visibleControls()[0]||dialog).focus({preventScroll:true});
  }
  function close({immediate=false,restoreFocus=true}={}) {
    if(!dialog.open||(!opened&&!immediate))return;
    opened=false;restoreOnClose=restoreFocus;const current=++revision;cancelAnimation();refreshLabels();dialog.dataset.motionState='closing';
    const finish=()=>{if(current!==revision||opened)return;dialog.close();release();};
    if(immediate||!dialog.animate){finish();return;}
    animation=dialog.animate(reduced?.matches?[{opacity:1},{opacity:0}]:[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-12px)'}],{duration:reduced?.matches?80:180,easing:'cubic-bezier(.4,0,1,1)'});
    animation.finished.then(finish).catch(()=>{});
  }
  const clickTrigger=()=>opened?close():open();
  const clickDialog=event=>{
    if(event.target.closest('[data-menu-close]'))close();
    else if(event.target.closest('a[href],[data-menu-destination]'))close({immediate:true,restoreFocus:false});
    else if(event.target===dialog)close();
  };
  const cancel=event=>{event.preventDefault();close();};
  const closedEvent=()=>{if(!dialog.open)release();};
  const keydown=event=>{
    if(!opened)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const controls=visibleControls(),first=controls[0],last=controls.at(-1);
    if(!first){event.preventDefault();dialog.focus();return;}
    const active=documentRef.activeElement;
    if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(active===last||!dialog.contains(active))){event.preventDefault();first.focus();}
  };
  trigger.addEventListener('click',clickTrigger);dialog.addEventListener('click',clickDialog);dialog.addEventListener('cancel',cancel);dialog.addEventListener('keydown',keydown);dialog.addEventListener('close',closedEvent);
  refreshLabels();
  return {open,close,refreshLabels,dispose(){if(disposed)return;disposed=true;restoreOnClose=false;revision++;cancelAnimation();if(dialog.open)dialog.close();release();trigger.removeEventListener('click',clickTrigger);dialog.removeEventListener('click',clickDialog);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('keydown',keydown);dialog.removeEventListener('close',closedEvent);opened=false;refreshLabels();}};
}
