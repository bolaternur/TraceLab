const selector='.wv-timeline-button[data-record-id]';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const privateThumbnail=new RegExp('^/api/workspace/media/'+UUID+'$','i');
export function timelineThumbnailUrl(value,origin){
  if(typeof value!=='string'||value.length>500)return null;
  try{const url=new URL(value,origin);return url.origin===origin&&!url.username&&!url.password&&!url.hash&&privateThumbnail.test(url.pathname)&&url.searchParams.size===1&&url.searchParams.get('variant')==='thumbnail'?url.pathname+url.search:null;}catch{return null;}
}

/** Adds only lazy private thumbnails. The existing timeline nodes, focus,
 * scroll position, filters and selected record are never replaced. */
export function hydrateTimelineMedia(container,{teamId,projectId,request=globalThis.fetch?.bind(globalThis),documentRef=container?.ownerDocument,windowRef=documentRef?.defaultView}={}){
  if(!container||!teamId||!projectId||!request||!documentRef||!windowRef)return()=>{};
  const controller=new AbortController(),requested=new Set(),pending=new Set(),metadata=new Map(),observed=new Set();
  let disposed=false,blocked=false,busy=false,timer=null;
  const origin=windowRef.location.origin;
  function draw(button){const item=metadata.get(button.dataset.recordId),main=button.querySelector('.wv-timeline-main');if(!item||!main||main.querySelector('[data-timeline-media],.wv-timeline-preview'))return;
    const src=timelineThumbnailUrl(item.thumbnailUrl,origin);if(!src)return;
    const image=documentRef.createElement('img');image.className='wv-timeline-preview';image.dataset.timelineMedia='';image.width=160;image.height=100;image.loading='lazy';image.decoding='async';image.alt=String(item.alt||item.caption||button.querySelector('.wv-timeline-title')?.textContent||'').slice(0,500);image.addEventListener('error',()=>image.remove(),{once:true});image.src=src;main.append(image);
  }
  function clearImages(){for(const image of container.querySelectorAll('[data-timeline-media]')){image.removeAttribute?.('src');image.remove();}}
  function enqueue(button){if(disposed||blocked)return;const id=button.dataset.recordId;if(!id||id.length>100)return;if(metadata.has(id)){draw(button);return;}if(!requested.has(id)&&pending.size<200)pending.add(id);schedule();}
  function schedule(){if(disposed||blocked||busy||timer!==null||!pending.size)return;timer=windowRef.setTimeout(()=>{timer=null;void flush();},40);}
  async function flush(){if(disposed||blocked||busy||!pending.size)return;busy=true;const ids=[...pending].slice(0,100);for(const id of ids){pending.delete(id);requested.add(id);}const params=new URLSearchParams({team:teamId,project:projectId});for(const id of ids)params.append('record',id);
    try{const response=await request('/api/workspace/media?'+params,{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(disposed)return;if(!response.ok){if([401,403,404].includes(response.status)){blocked=true;pending.clear();metadata.clear();clearImages();}return;}const data=await response.json();if(disposed)return;const allowed=new Set(ids);for(const item of (Array.isArray(data.items)?data.items:[]).slice(0,100))if(item&&allowed.has(item.recordId)&&timelineThumbnailUrl(item.thumbnailUrl,origin))metadata.set(item.recordId,item);for(const button of container.querySelectorAll(selector))draw(button);
    }catch{/* Missing previews never block access to the authored timeline. */}finally{busy=false;schedule();}
  }
  const intersection=windowRef.IntersectionObserver?new windowRef.IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)enqueue(entry.target);},{root:container,rootMargin:'200px'}):null;
  function fallback(){const bounds=container.getBoundingClientRect();let queued=0;for(const button of container.querySelectorAll(selector)){const rect=button.getBoundingClientRect();if(rect.bottom>=bounds.top-200&&rect.top<=bounds.bottom+200){enqueue(button);if(++queued>=100)break;}}}
  function sync(){if(disposed||blocked)return;const current=new Set(container.querySelectorAll(selector));for(const button of observed)if(!current.has(button)){intersection?.unobserve(button);observed.delete(button);}for(const button of current){draw(button);if(intersection&&!observed.has(button)){observed.add(button);intersection.observe(button);}}if(!intersection)fallback();}
  const mutation=windowRef.MutationObserver?new windowRef.MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node.matches?.(selector)||node.querySelector?.(selector))))sync();}):null;
  mutation?.observe(container,{childList:true,subtree:true});if(!intersection)container.addEventListener('scroll',fallback,{passive:true});sync();
  return()=>{disposed=true;controller.abort();if(timer!==null)windowRef.clearTimeout(timer);intersection?.disconnect();mutation?.disconnect();container.removeEventListener('scroll',fallback);pending.clear();metadata.clear();requested.clear();observed.clear();clearImages();};
}
