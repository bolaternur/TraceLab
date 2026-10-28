import { formatDate,formatNumber } from './workspace-i18n.js';
import { mediaText as t,mediaErrorText } from './workspace-media-copy.js';
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const button=(text,action)=>{const node=el('button','wm-button',text);node.type='button';node.addEventListener('click',action);return node;};
const field=(form,name,label,{type='text',value='',required=false,max=5000}={})=>{const wrap=el('label','wm-field',label),input=el(type==='textarea'?'textarea':'input');input.name=name;if(type!=='textarea')input.type=type;input.value=value;input.required=required;input.maxLength=max;wrap.append(input);form.append(wrap);return input;};
const select=(form,name,label,options)=>{const wrap=el('label','wm-field',label),input=el('select');input.name=name;for(const [value,text]of options){const option=el('option','',text);option.value=value;input.append(option);}wrap.append(input);form.append(wrap);return input;};
export function mountWorkspaceMedia(container,{teamId,projectId,mode='gallery',role,onChanged=()=>{}}={}){
  let disposed=false,items=[],nextOffset=null,currentRole=role,xhr=null,dialog=null,lightbox=null,loading=false;
  const abort=new AbortController(),root=el('section','wm-library');container.replaceChildren(root);
  const readParams=()=>new URL(location.href).searchParams;
  let layout=readParams().get('mediaLayout')==='list'?'list':'grid';
  const header=el('header','wm-heading'),heading=el('div');heading.append(el('h2','',t(mode==='models'?'models':'gallery')),el('p','',t('intro')));
  const add=button(t('upload'),()=>showUpload());header.append(heading,add);root.append(header);
  const toolbar=el('div','wm-tools'),search=el('input'),type=el('select'),archive=el('select');
  search.type='search';search.placeholder=t('search');search.setAttribute('aria-label',t('search'));search.value=readParams().get('mediaQ')||'';
  type.setAttribute('aria-label',t('type'));for(const value of ['all',...(mode==='models'?['robot','assembly','part']:['photo','drawing','render','document'])]){const option=el('option','',t(value));option.value=value;type.append(option);}type.value=readParams().get('mediaType')||'all';if(!type.value)type.value='all';
  archive.setAttribute('aria-label',t('archived'));for(const value of ['active','archived']){const option=el('option','',t(value));option.value=value;archive.append(option);}archive.value=readParams().get('mediaStatus')==='archived'?'archived':'active';
  const gridButton=button(t('grid'),()=>{layout='grid';syncUrl();renderItems();}),listButton=button(t('list'),()=>{layout='list';syncUrl();renderItems();});
  toolbar.append(search,type,archive,gridButton,listButton,button(t('refresh'),()=>load()));root.append(toolbar);
  const status=el('p','wm-status');status.setAttribute('role','status');const usage=el('p','wm-usage'),list=el('div','wm-grid'),more=button(t('more'),()=>load(true));more.hidden=true;root.append(status,usage,list,more);
  const canWrite=()=>['student','student_lead'].includes(currentRole);
  const urlFor=item=>{const url=new URL('/workspace/',location.origin);url.searchParams.set('team',teamId);url.searchParams.set('project',projectId);url.searchParams.set('view','graph');if(item.recordId)url.searchParams.set('record',item.recordId);return url.pathname+url.search;};
  function syncUrl(selected){const url=new URL(location.href);for(const [key,value]of [['mediaQ',search.value],['mediaType',type.value],['mediaStatus',archive.value],['mediaLayout',layout]])url.searchParams.set(key,value);if(selected)url.searchParams.set('media',selected);else if(selected===null)url.searchParams.delete('media');history.replaceState(history.state,'',url);}
  const filtered=()=>items.filter(item=>(item.status||'active')===archive.value&&(type.value==='all'||(item.model?.category||item.kind)===type.value)&&[item.name,item.caption,item.authorLabel].join(' ').toLocaleLowerCase().includes(search.value.toLocaleLowerCase().trim()));
  for(const input of [search,type,archive])input.addEventListener('input',()=>{syncUrl();renderItems();});
  async function load(append=false){if(loading||disposed)return;loading=true;status.textContent=t('loading');more.disabled=true;
    try{const params=new URLSearchParams({team:teamId,project:projectId,mode,offset:String(append?nextOffset||0:0)});
      const response=await fetch('/api/workspace/media?'+params,{credentials:'same-origin',cache:'no-store',signal:abort.signal}),data=await response.json();
      if(!response.ok)throw new Error(mediaErrorText(data.error?.code));if(disposed)return;
      items=append?[...items,...data.items]:data.items;nextOffset=data.nextOffset;currentRole=data.role;add.hidden=!canWrite();
      usage.textContent=`${t('usage')}: ${formatNumber(data.usage.usedBytes/1048576)} / ${formatNumber(data.usage.quotaBytes/1048576)} MiB`;
      status.textContent=`${t('loaded')}: ${formatNumber(items.length)}`;renderItems();
      const selected=readParams().get('media');if(selected&&!lightbox){const item=items.find(item=>item.artifactId===selected);if(item)showItem(item);}
    }catch(error){if(!disposed)status.textContent=navigator.onLine?error.message:t('offline');}
    finally{loading=false;more.disabled=false;}
  }
  function renderItems(){list.replaceChildren();list.className='wm-grid'+(layout==='list'?' wm-list':'');gridButton.setAttribute('aria-pressed',String(layout==='grid'));listButton.setAttribute('aria-pressed',String(layout==='list'));
    const visible=filtered();if(!visible.length)list.append(el('p','wm-empty',t(items.length?'noMatch':'empty')));
    for(const item of visible){const card=el('article','wm-card'),preview=button('',()=>showItem(item,preview));preview.className='wm-preview';preview.setAttribute('aria-label',t('open')+': '+item.name);
      if(item.thumbnailUrl){const image=el('img');image.src=item.thumbnailUrl;image.alt=item.alt||item.name;image.loading='lazy';image.decoding='async';preview.append(image);}
      else preview.append(el('span','wm-file-kind',item.model?'GLB':item.mimeType==='application/pdf'?'PDF':'CSV'));
      const info=el('div','wm-card-info');info.append(el('h3','',item.name),el('p','wm-meta',[item.model?.versionLabel,item.authorLabel,formatDate(item.occurredAt)].filter(Boolean).join(' · ')),el('p','wm-caption',item.caption));
      const actions=el('div','wm-card-actions'),source=el('a','',t('source'));source.href=urlFor(item);actions.append(source);
      if(item.model){const viewer=el('a','',t('open'));viewer.href=item.model.viewerUrl;actions.append(viewer);}
      info.append(actions);card.append(preview,info);list.append(card);
    }more.hidden=nextOffset===null;
  }
  function showItem(first,restoreFocus){if(lightbox)lightbox.close();let item=first;const modal=el('dialog','wm-dialog wm-lightbox'),body=el('div','wm-lightbox-body'),tools=el('div','wm-tools');lightbox=modal;
    const close=()=>modal.close(),go=delta=>{const all=filtered(),index=all.findIndex(row=>row.artifactId===item.artifactId);const next=all[index+delta];if(next){item=next;paint();}};
    const previous=button(t('previous'),()=>go(-1)),next=button(t('next'),()=>go(1));tools.append(previous,next,button(t('close'),close));modal.append(tools,body);
    function paint(){body.replaceChildren();syncUrl(item.artifactId);modal.setAttribute('aria-label',item.name);body.append(el('h2','',item.name));
      if(item.mimeType?.startsWith('image/')){const image=el('img','wm-lightbox-image');image.src=item.url;image.alt=item.alt||item.name;body.append(image);}
      body.append(el('p','',item.caption),el('p','wm-meta',[item.authorLabel,formatDate(item.occurredAt),`${formatNumber(item.sizeBytes/1048576)} MiB`].filter(Boolean).join(' · ')));
      const actions=el('div','wm-tools'),download=el('a','wm-button',t('download'));download.href=item.url;download.download='';actions.append(download);
      const source=el('a','wm-button',t('source'));source.href=urlFor(item);actions.append(source);
      if(item.model){const viewer=el('a','wm-button',t('open'));viewer.href=item.model.viewerUrl;actions.append(viewer);}
      if(canWrite()&&item.canEdit)actions.append(button(t('rename'),()=>{modal.close();showMetadata(item);}));body.append(actions);
      const index=filtered().findIndex(row=>row.artifactId===item.artifactId);previous.disabled=index<=0;next.disabled=index>=filtered().length-1;
    }
    modal.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();go(-1);}if(event.key==='ArrowRight'){event.preventDefault();go(1);}});
    modal.addEventListener('close',()=>{lightbox=null;syncUrl(null);modal.remove();if(restoreFocus?.isConnected)restoreFocus.focus();},{once:true});
    document.body.append(modal);paint();modal.showModal();
  }
  function showMetadata(item){const modal=el('dialog','wm-dialog'),form=el('form','wm-form');dialog=modal;const title=el('h2','',t('rename'));form.append(title);
    field(form,'name',t('name'),{value:item.name,required:true,max:160});field(form,'caption',t('caption'),{type:'textarea',value:item.caption});field(form,'alt',t('alt'),{value:item.alt,max:500});
    const state=select(form,'status',t('archive'),[['active',t('active')],['archived',t('archived')]]);state.value=item.status;
    form.append(el('p','wm-meta',t('archiveHint')));const error=el('p','wm-status');error.setAttribute('role','status');form.append(error);const submit=button(t('save'),()=>{});submit.type='submit';form.append(submit,button(t('cancel'),()=>modal.close()));
    form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;try{const response=await fetch(item.url,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form))),signal:abort.signal}),data=await response.json();if(!response.ok)throw new Error(mediaErrorText(data.error?.code));modal.close();await load();}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}};
    modal.onclose=()=>{modal.remove();if(dialog===modal)dialog=null;};modal.append(form);document.body.append(modal);modal.showModal();
  }
  function showUpload(initialFile){if(!canWrite())return;const modal=el('dialog','wm-dialog'),form=el('form','wm-form');dialog=modal;let selectedFile=null,pending=null;
    form.append(el('h2','',t('upload')),el('p','wm-meta',t(mode==='models'?'glb':'formats')));
    const picker=el('input');picker.type='file';picker.accept=mode==='models'?'.glb':'.jpg,.jpeg,.png,.webp,.pdf,.csv';picker.hidden=true;
    const drop=el('div','wm-drop'),filename=el('p','wm-meta',t('drop'));drop.append(filename,button(t('choose'),()=>picker.click()));form.append(drop,picker);
    const name=field(form,'name',t('name'),{required:true,max:160});field(form,'caption',t('caption'),{type:'textarea'});
    const kind=mode==='models'?null:select(form,'kind',t('type'),['photo','drawing','render','document'].map(value=>[value,t(value)]));
    if(mode!=='models')field(form,'alt',t('alt'),{max:500});
    if(mode==='models'){
      select(form,'category',t('category'),['robot','assembly','part'].map(value=>[value,t(value)]));field(form,'versionLabel',t('version'),{required:true,max:80});field(form,'tags',t('tags'),{max:800});
      select(form,'previousModelId',t('newVersion'),[['',t('newModel')],...items.filter(item=>item.model).map(item=>[item.model.id,`${item.name} · ${item.model.versionLabel}`])]);
    }
    const error=el('p','wm-status');error.setAttribute('role','status');const progress=el('progress');progress.max=100;progress.hidden=true;progress.setAttribute('aria-label',t('sending'));
    const edit=button(t('editPhoto'),async()=>{try{const {editPrivatePhoto}=await import('./workspace-media-editor.js');const blob=await editPrivatePhoto(selectedFile,abort.signal);if(blob){selectedFile=new File([blob],selectedFile.name.replace(/\.[^.]+$/,'')+'.png',{type:'image/png'});filename.textContent=selectedFile.name;pending=null;}}catch(e){error.textContent=e.message;}});edit.hidden=true;
    function pick(file){if(!file)return;selectedFile=file;pending=null;filename.textContent=`${file.name} · ${formatNumber(file.size/1048576)} MiB`;if(!name.value)name.value=file.name.replace(/\.[^.]+$/,'');
      edit.hidden=mode==='models'||!/^image\/(jpeg|png|webp)$/.test(file.type);if(kind&&/\.(pdf|csv)$/i.test(file.name))kind.value='document';}
    picker.onchange=()=>pick(picker.files?.[0]);drop.ondragover=event=>{event.preventDefault();drop.dataset.drag='true';};drop.ondragleave=()=>delete drop.dataset.drag;
    drop.ondrop=event=>{event.preventDefault();delete drop.dataset.drag;pick(event.dataTransfer?.files[0]);};
    if(mode!=='models'){const camera=el('input');camera.type='file';camera.accept='image/*';camera.capture='environment';camera.hidden=true;camera.onchange=()=>pick(camera.files?.[0]);drop.append(camera,button(t('camera'),()=>camera.click()));form.append(edit,el('p','wm-meta',t('privacy')));}
    form.append(error,progress);const submit=button(t('upload'),()=>{});submit.type='submit';const retry=button(t('retry'),()=>send());retry.hidden=true;const cancel=button(t('cancel'),()=>{if(xhr){xhr.abort();}else modal.close();});form.append(submit,retry,cancel);
    const busy=value=>{for(const control of form.querySelectorAll('input,select,textarea,button'))control.disabled=value;cancel.disabled=false;};
    async function send(){if(!pending||disposed)return;if(!navigator.onLine){error.textContent=t('offline');retry.hidden=false;return;}busy(true);retry.hidden=true;progress.hidden=false;progress.value=0;error.textContent=t('sending');
      const request=new XMLHttpRequest();xhr=request;request.open('POST','/api/workspace/media');request.setRequestHeader('Content-Type','application/octet-stream');request.setRequestHeader('X-TraceLab-Metadata',encodeURIComponent(JSON.stringify(pending.metadata)));
      request.upload.onprogress=event=>{if(event.lengthComputable){progress.value=Math.min(95,event.loaded/event.total*95);if(event.loaded===event.total)error.textContent=t('processing');}};
      const failed=message=>{xhr=null;busy(false);retry.hidden=false;progress.hidden=true;error.textContent=message;};
      request.onerror=()=>failed(t('error'));request.onabort=()=>failed(t('cancelled'));
      request.onload=async()=>{let result;try{result=JSON.parse(request.responseText);}catch{failed(t('error'));return;}if(request.status<200||request.status>=300){failed(mediaErrorText(result.error?.code));return;}
        xhr=null;progress.value=100;error.textContent=t('saved');busy(false);modal.close();await load();await onChanged(result);};request.send(pending.file);
    }
    form.onsubmit=event=>{event.preventDefault();if(!selectedFile){error.textContent=t('selectFile');return;}const fields=new FormData(form);
      const metadata={teamId,projectId,kind:mode==='models'?'model':fields.get('kind'),name:String(fields.get('name')),filename:selectedFile.name,caption:String(fields.get('caption')||''),alt:String(fields.get('alt')||''),
        ...(mode==='models'?{model:{category:fields.get('category'),versionLabel:String(fields.get('versionLabel')),tags:String(fields.get('tags')||'').split(',').map(tag=>tag.trim()).filter(Boolean),...(fields.get('previousModelId')?{previousModelId:String(fields.get('previousModelId'))}:{})}}:{})};
      const signature=JSON.stringify(metadata);
      // A lost acknowledgement must not become a second file when Upload is pressed again.
      if(!pending||pending.file!==selectedFile||pending.signature!==signature)pending={file:selectedFile,signature,metadata:{...metadata,requestId:crypto.randomUUID(),occurredAt:new Date().toISOString()}};
      send();};
    modal.addEventListener('cancel',()=>{xhr?.abort();});modal.onclose=()=>{xhr?.abort();modal.remove();if(dialog===modal)dialog=null;};modal.append(form);document.body.append(modal);if(initialFile)pick(initialFile);modal.showModal();
  }
  const restore=()=>{search.value=readParams().get('mediaQ')||'';type.value=readParams().get('mediaType')||'all';archive.value=readParams().get('mediaStatus')==='archived'?'archived':'active';renderItems();};window.addEventListener('popstate',restore);
  add.hidden=!canWrite();load();return()=>{disposed=true;abort.abort();xhr?.abort();dialog?.close();lightbox?.close();window.removeEventListener('popstate',restore);root.remove();};
}
