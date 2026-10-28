const DATABASE='tracelab-team-outbox-v1';
export const OUTBOX_LIMITS=Object.freeze({records:100,photoBytes:15*1024*1024,pendingPhotoBytes:60*1024*1024});
const fallbackLocks=new Map();
function queueLock(userId,work){
  const key=`trace-outbox:${userId}`;
  if(globalThis.navigator?.locks)return navigator.locks.request(key,work);
  const next=(fallbackLocks.get(key)||Promise.resolve()).catch(()=>{}).then(work);
  fallbackLocks.set(key,next);return next.finally(()=>{if(fallbackLocks.get(key)===next)fallbackLocks.delete(key);});
}
function failure(code,message){return Object.assign(new Error(message),{code});}
function openDatabase(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB){reject(new Error('IndexedDB unavailable'));return;}const request=indexedDB.open(DATABASE,1);request.onupgradeneeded=()=>{request.result.createObjectStore('outbox',{keyPath:'id'});request.result.createObjectStore('context');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function access(store,mode,action){const db=await openDatabase();try{return await new Promise((resolve,reject)=>{const transaction=db.transaction(store,mode);const request=action(transaction.objectStore(store));transaction.oncomplete=()=>resolve(request?.result);transaction.onabort=()=>reject(transaction.error||new Error('Offline storage failed'));transaction.onerror=()=>reject(transaction.error);});}finally{db.close();}}
export const outboxStorage={all:()=>access('outbox','readonly',store=>store.getAll()),put:value=>access('outbox','readwrite',store=>store.put(value)),remove:id=>access('outbox','readwrite',store=>store.delete(id))};
export async function setOfflineContext(context){await access('context','readwrite',store=>store.put(context,'active'));}
export async function getOfflineContext(){return access('context','readonly',store=>store.get('active'));}
export async function clearOfflineContext(){await access('context','readwrite',store=>store.delete('active'));}
export function createOutbox({storage=outboxStorage,request=globalThis.fetch?.bind(globalThis),now=()=>new Date().toISOString(),id=()=>crypto.randomUUID()}={}){
  async function list(userId){return (await storage.all()).filter(row=>row.userId===userId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));}
  function requireContext(context){if(!context?.userId||!context?.projectId||!context?.teamId)throw failure('no_context','Sign in and open a project before capturing offline.');}
  async function capacity(context,photoSize=0){
    const all=await storage.all(),own=all.filter(row=>row.userId===context.userId);
    if(own.length>=OUTBOX_LIMITS.records)throw failure('queue_full','Sync or export the pending records first (maximum 100).');
    // The device-wide limit protects shared browsers without revealing other users' drafts.
    const pendingBytes=all.reduce((total,row)=>total+(row.type==='photo'?(row.blob?.size||0):0),0);
    if(photoSize&&pendingBytes+photoSize>OUTBOX_LIMITS.pendingPhotoBytes)throw failure('photo_queue_full','Pending photos exceed the local storage budget. Sync or download photos first.');
  }
  async function enqueue(context,record){
    requireContext(context);
    if(!record.title?.trim()||record.title.length>160||String(record.body||'').length>10000)throw failure('invalid_record','Check the record title and length.');
    if(record.kind==='decision'&&record.status!=='draft'&&!record.rationale?.trim())throw failure('decision_explanation','A completed decision needs an explanation.');
    await capacity(context);
    const row={id:id(),userId:context.userId,teamId:context.teamId,projectId:context.projectId,record:structuredClone(record),createdAt:now(),state:'pending',attempts:0,body:null,error:null};
    await storage.put(row);return row.id;
  }
  async function enqueuePhoto(context,{file,title,caption='',alt='',occurredAt}={}){
    requireContext(context);
    if(!(file instanceof Blob)||!file.size||file.size>OUTBOX_LIMITS.photoBytes)throw failure('photo_size','Choose a photo no larger than 15 MiB.');
    const head=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const jpeg=head[0]===255&&head[1]===216&&head[2]===255;
    const png=[137,80,78,71,13,10,26,10].every((value,index)=>head[index]===value);
    const ascii=new TextDecoder().decode(head),webp=ascii.slice(0,4)==='RIFF'&&ascii.slice(8,12)==='WEBP';
    if(!jpeg&&!png&&!webp)throw failure('photo_format','Only JPEG, PNG and WebP photos can be queued.');
    if(!String(title||'').trim()||String(title).length>160||String(caption).length>5000||String(alt).length>500)throw failure('invalid_record','Check the photo title and description length.');
    const date=occurredAt||now();if(!Number.isFinite(Date.parse(date)))throw failure('invalid_record','Check the photo date.');
    await capacity(context,file.size);
    const key=id(),createdAt=now(),extension=png?'png':webp?'webp':'jpg';
    const metadata={teamId:context.teamId,projectId:context.projectId,requestId:key,kind:'photo',name:String(title).trim(),
      filename:String(file.name||`offline-photo.${extension}`).slice(0,180),caption:String(caption),alt:String(alt),occurredAt:new Date(date).toISOString()};
    const row={id:key,type:'photo',userId:context.userId,teamId:context.teamId,projectId:context.projectId,blob:file,
      metadata,metadataHeader:encodeURIComponent(JSON.stringify(metadata)),createdAt,state:'pending',attempts:0,error:null};
    // IndexedDB commits both bytes and metadata before the UI reports success.
    await storage.put(row);return key;
  }
  async function discard(userId,key){const row=(await list(userId)).find(item=>item.id===key);if(!row)return false;await storage.remove(key);return true;}
  async function flush(userId){
    const session=await request('/api/account/session',{cache:'no-store',credentials:'same-origin'});
    if(!session.ok)throw failure('signin_required','Sign in again before syncing.');
    if((await session.json()).user?.id!==userId)throw failure('owner_mismatch','Sign in to the account that created these drafts.');
    let sent=0;
    for(const row of await list(userId)){
      try{
        if(row.type!=='photo'&&!row.body){const response=await request(`/api/workspace?team=${encodeURIComponent(row.teamId)}&project=${encodeURIComponent(row.projectId)}`,{cache:'no-store',credentials:'same-origin'});const data=await response.json();if(!response.ok)throw failure(data.error?.code||'project_unavailable',data.error?.message||'Project unavailable');const project=data.projects.find(project=>project.id===row.projectId);if(!project)throw failure('project_unavailable','Project unavailable');row.body=JSON.stringify({command:'addRecord',requestId:row.id,projectId:row.projectId,teamId:row.teamId,expectedRevision:project.serverRevision,args:[row.record]});}
        row.attempts++;row.state='sending';row.error=null;row.errorCode=null;await storage.put(row);
        const response=row.type==='photo'
          ?await request('/api/workspace/media',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-TraceLab-Metadata':row.metadataHeader,'X-TraceLab-Queue-Owner':userId},body:row.blob})
          :await request('/api/workspace',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-TraceLab-Queue-Owner':userId},body:row.body});
        const data=await response.json();
        if(!response.ok){if(response.status===409&&row.type!=='photo')row.body=null;throw failure(data.error?.code||'sync_failed',data.error?.message||'Sync failed');}
        if(row.type==='photo'&&!data.artifactId)throw failure('invalid_ack','The server did not acknowledge the uploaded photo.');
        await storage.remove(row.id);sent++;
      }catch(error){row.state='failed';row.error=error.message;row.errorCode=error.code||'network';await storage.put(row);break;}
    }
    return {sent,pending:(await list(userId)).length};
  }
  const api={list,enqueue:(context,record)=>queueLock('device',()=>queueLock(context?.userId,()=>enqueue(context,record))),
    enqueuePhoto:(context,value)=>queueLock('device',()=>queueLock(context?.userId,()=>enqueuePhoto(context,value))),
    discard:(userId,key)=>queueLock(userId,()=>discard(userId,key)),flush:userId=>queueLock(userId,()=>flush(userId))};
  return api;
}
