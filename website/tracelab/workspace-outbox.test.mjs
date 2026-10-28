import test from 'node:test';
import assert from 'node:assert/strict';
import {createOutbox,OUTBOX_LIMITS} from './workspace-outbox.js';
function memory(){const rows=new Map();return{all:async()=>[...rows.values()].map(row=>structuredClone(row)),put:async row=>{rows.set(row.id,structuredClone(row));},remove:async id=>{rows.delete(id);}};}
const context={userId:'owner',teamId:'team',projectId:'project'};
const record={title:'Offline evidence',body:'Unchanged authored words',kind:'source'};
const reply=(data,status=200)=>({ok:status<400,status,json:async()=>data});
test('offline capture is owner scoped and keeps the full authored record',async()=>{const box=createOutbox({storage:memory()});await box.enqueue(context,record);record.title='A later form edit';assert.equal((await box.list('owner'))[0].record.title,'Offline evidence');assert.equal((await box.list('other')).length,0);});
test('lost response and replay use identical persisted body; draft removed only after ACK',async()=>{let lose=true;const bodies=[];const storage=memory();const request=async(url,options)=>{if(url.includes('/session'))return reply({user:{id:'owner'}});if(options.method!=='POST')return reply({projects:[{id:'project',serverRevision:5}]});bodies.push(options.body);if(lose){lose=false;throw new Error('Network lost');}return reply({result:'record'});};const box=createOutbox({storage,request});await box.enqueue(context,record);assert.equal((await box.flush('owner')).pending,1);const restarted=createOutbox({storage,request});assert.equal((await restarted.flush('owner')).pending,0);assert.equal(bodies[0],bodies[1]);});
test('another signed-in account cannot send someone else’s queue',async()=>{const box=createOutbox({storage:memory(),request:async()=>reply({user:{id:'other'}})});await box.enqueue(context,record);await assert.rejects(box.flush('owner'),/account/);assert.equal((await box.list('owner')).length,1);});
test('validation and draft decision checks happen before persistence',async()=>{const box=createOutbox({storage:memory()});await assert.rejects(box.enqueue(context,{...record,kind:'decision',status:'closed',rationale:''}),/explanation/);assert.equal((await box.list('owner')).length,0);await box.enqueue(context,{...record,kind:'decision',status:'draft',rationale:''});assert.equal((await box.list('owner')).length,1);});

const photo=()=>{const blob=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],{type:'image/png'});Object.defineProperty(blob,'name',{value:'offline.png'});return blob;};
test('photo bytes and metadata survive queue reconstruction, and remain owner scoped',async()=>{
  const storage=memory(),box=createOutbox({storage}),file=photo();
  await box.enqueuePhoto(context,{file,title:'Фото испытания',caption:'Наше наблюдение',alt:'Тестовый файл'});
  const restored=createOutbox({storage}),rows=await restored.list('owner');assert.equal(rows.length,1);assert.equal(rows[0].type,'photo');
  assert.deepEqual(await rows[0].blob.arrayBuffer(),await file.arrayBuffer());assert.equal(rows[0].metadata.name,'Фото испытания');assert.equal(rows[0].metadata.filename,'offline.png');assert.equal(rows[0].metadata.requestId,rows[0].id);
  assert.equal((await restored.list('other')).length,0);
});
test('photo retry after lost ACK sends identical bytes and request metadata, then removes once acknowledged',async()=>{
  const storage=memory(),requests=[];let lost=true;
  const request=async(url,options)=>{if(url.includes('/session'))return reply({user:{id:'owner'}});assert.equal(url,'/api/workspace/media');requests.push({headers:options.headers,bytes:await options.body.arrayBuffer()});if(lost){lost=false;throw new Error('lost after server commit');}return reply({artifactId:'acknowledged-private-artifact'},201);};
  const box=createOutbox({storage,request});await box.enqueuePhoto(context,{file:photo(),title:'Photo'});assert.equal((await box.flush('owner')).pending,1);
  const restarted=createOutbox({storage,request});assert.equal((await restarted.flush('owner')).pending,0);assert.deepEqual(requests[0],requests[1]);assert.equal(requests[0].headers['X-TraceLab-Queue-Owner'],'owner');
});
test('revoked membership or missing photo acknowledgement keeps local bytes for download or retry',async()=>{
  const storage=memory();let denied=true;
  const request=async url=>url.includes('/session')?reply({user:{id:'owner'}}):denied?reply({error:{code:'forbidden'}},403):reply({unexpected:'not an artifact acknowledgement'});
  const box=createOutbox({storage,request});await box.enqueuePhoto(context,{file:photo(),title:'Photo'});
  assert.equal((await box.flush('owner')).pending,1);let row=(await box.list('owner'))[0];assert.equal(row.errorCode,'forbidden');assert.ok(row.blob.size>0);
  denied=false;assert.equal((await box.flush('owner')).pending,1);row=(await box.list('owner'))[0];assert.equal(row.errorCode,'invalid_ack');assert.ok(row.blob.size>0);
});
test('only the draft owner can discard a queued photo, leaving other owners untouched',async()=>{
  const box=createOutbox({storage:memory()}),key=await box.enqueuePhoto(context,{file:photo(),title:'Photo'});
  assert.equal(await box.discard('other',key),false);assert.equal((await box.list('owner')).length,1);assert.equal(await box.discard('owner',key),true);assert.equal((await box.list('owner')).length,0);
});
test('photo validation and bounded device quota reject before persistence',async()=>{
  const storage=memory(),box=createOutbox({storage});await assert.rejects(box.enqueuePhoto(context,{file:new Blob(['html']),title:'Not an image'}),{code:'photo_format'});
  await assert.rejects(box.enqueuePhoto(context,{file:new Blob([new Uint8Array(OUTBOX_LIMITS.photoBytes+1)]),title:'Oversize'}),{code:'photo_size'});
  await storage.put({id:'existing-owner-photo',type:'photo',userId:'other',createdAt:'2026-10-27',blob:{size:OUTBOX_LIMITS.pendingPhotoBytes}});
  await assert.rejects(box.enqueuePhoto(context,{file:photo(),title:'Over budget'}),{code:'photo_queue_full'});assert.equal((await box.list('owner')).length,0);
});
test('a failed IndexedDB commit never reports the photo saved',async()=>{
  const storage={...memory(),put:async()=>{throw Object.assign(new Error('quota'),{name:'QuotaExceededError'});}};
  await assert.rejects(createOutbox({storage}).enqueuePhoto(context,{file:photo(),title:'Photo'}),{name:'QuotaExceededError'});assert.equal((await storage.all()).length,0);
});
test('concurrent photo captures share the device-wide budget across accounts',async()=>{
  const storage=memory();await storage.put({id:'existing',type:'photo',userId:'previous',createdAt:'2026-10-27',blob:{size:OUTBOX_LIMITS.pendingPhotoBytes-photo().size*2}});
  const first=createOutbox({storage}),second=createOutbox({storage});
  const results=await Promise.allSettled([
    first.enqueuePhoto(context,{file:photo(),title:'First'}),
    second.enqueuePhoto({...context,userId:'second'},{file:photo(),title:'Second'}),
    second.enqueuePhoto({...context,userId:'third'},{file:photo(),title:'Over budget'}),
  ]);
  assert.equal(results.filter(row=>row.status==='fulfilled').length,2);assert.equal(results.filter(row=>row.status==='rejected'&&row.reason.code==='photo_queue_full').length,1);
});
