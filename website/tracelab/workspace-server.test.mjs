import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerWorkspace } from './workspace-server.js';
import { setWorkspaceLocale } from './workspace-i18n.js';
import { shellT } from './workspace-shell-i18n.js';

const state = revision => ({ user:{id:'u'},team:{id:'t'},teams:[],projects:[{id:'p',serverRevision:revision,records:[],links:[],studyRows:[]}],activeProjectId:'p' });
const location = {search:'',pathname:'/workspace',assign(){}};
const reply = (data, status=200) => ({ok:status<400,status,json:async()=>data});
const metadata=revision=>({team:{id:'t'},role:'student',projects:[{id:'p',serverRevision:revision}]});

test('team polling avoids a full reload when revisions are unchanged and adopts another member’s update once',async()=>{
  let revision=0,fullReads=0,notices=0;
  const store=await createServerWorkspace({location,request:async(url)=>{
    if(url.startsWith('/api/workspace/revision?'))return reply(metadata(revision));
    fullReads++;return reply({...state(revision),role:'student'});
  }});
  store.subscribe(()=>notices++);
  assert.equal(await store.refreshIfChanged(),false);assert.equal(fullReads,1);assert.equal(notices,0);
  revision=1;assert.equal(await store.refreshIfChanged(),true);assert.equal(store.getProject().serverRevision,1);
  assert.equal(fullReads,2);assert.equal(notices,1);
});

test('opening an author form during either polling request postpones adoption and keeps the existing snapshot',async()=>{
  for(const phase of ['metadata','records']){
    let idle=true,reads=0;
    const store=await createServerWorkspace({location,request:async(url)=>{
      if(url.startsWith('/api/workspace/revision?')){if(phase==='metadata')idle=false;return reply(metadata(1));}
      reads++;if(reads>1)idle=false;return reply({...state(reads>1?1:0),role:'student'});
    }});
    assert.equal(await store.refreshIfChanged({canApply:()=>idle}),false);
    assert.equal(store.getProject().serverRevision,0);
    assert.equal(reads,phase==='metadata'?1:2);
  }
});

test('a write begun during revision polling cannot be replaced by the older polling response',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const store=await createServerWorkspace({location,request:async(url,options)=>{
    if(url.startsWith('/api/workspace/revision?')){await gate;return reply(metadata(1));}
    return reply({...state(options.method==='POST'?2:0),role:'student',result:'written'});
  }});
  const poll=store.refreshIfChanged();const write=store.addRecord({title:'Own new record'});
  await write;release();assert.equal(await poll,false);assert.equal(store.getProject().serverRevision,2);
});

test('revoked membership is surfaced without adopting private records from another team',async()=>{
  const store=await createServerWorkspace({location,request:async(url)=>url.startsWith('/api/workspace/revision?')?reply({error:{code:'forbidden'}},403):reply({...state(0),role:'student'})});
  await assert.rejects(store.refreshIfChanged(),error=>error.status===403&&error.code==='forbidden');
  assert.equal(store.getProject().serverRevision,0);
});

test('response loss retries the identical command key and body; success clears the key', async()=>{
  const bodies=[]; let lose=true;
  const store=await createServerWorkspace({location,request:async(_url,options)=>{
    if(options.method!=='POST')return reply(state(0));
    bodies.push(JSON.parse(options.body));
    if(lose){lose=false;throw new TypeError('Network unavailable');}
    return reply({...state(1),result:'r'});
  }});
  await assert.rejects(store.addRecord({title:'Evidence'}),error=>error.code==='network');
  assert.equal(store.storageStatus,'failed');
  assert.equal(await store.addRecord({title:'Evidence'}),'r');
  assert.deepEqual(bodies[0],bodies[1]);
  await store.addRecord({title:'Evidence'});
  assert.notEqual(bodies[1].requestId,bodies[2].requestId);
  assert.equal(store.storageStatus,'server');
});

test('conflict refreshes server state, preserves failed status and requires explicit retry', async()=>{
  let reads=0;const bodies=[];
  const store=await createServerWorkspace({location,request:async(_url,options)=>{
    if(options.method!=='POST')return reply(state(reads++?4:0));
    bodies.push(JSON.parse(options.body));
    return bodies.length===1?reply({error:{code:'REVISION_CONFLICT',message:'Project changed'}},409):reply({...state(5),result:'r'});
  }});
  await assert.rejects(store.addRecord({title:'Evidence'}),error=>error.code==='REVISION_CONFLICT');
  assert.equal(store.getProject().serverRevision,4);
  assert.equal(store.storageStatus,'failed');
  assert.equal(bodies.length,1);
  await store.addRecord({title:'Evidence'});
  assert.equal(bodies[1].expectedRevision,4);
  assert.notEqual(bodies[0].requestId,bodies[1].requestId);
});

test('unauthenticated bootstrap redirects to sign-in preserving the requested view', async()=>{
  const redirects=[];
  await assert.rejects(createServerWorkspace({location:{search:'?view=timeline',pathname:'/workspace',assign:url=>redirects.push(url)},request:async()=>reply({error:{message:'Sign in'}},401)}));
  assert.match(redirects[0],/next=%2Fworkspace%3Fview%3Dtimeline/);
});

test('serialized edits use the revision returned by the previous edit', async()=>{
  let revision=0;const bodies=[];
  const store=await createServerWorkspace({location,request:async(_url,options)=>{
    if(options.method!=='POST')return reply(state(revision));
    bodies.push(JSON.parse(options.body));
    await new Promise(resolve=>setTimeout(resolve,5));
    return reply({...state(++revision),result:String(revision)});
  }});
  await Promise.all([store.addRecord({title:'One'}),store.addRecord({title:'Two'})]);
  assert.deepEqual(bodies.map(body=>body.expectedRevision),[0,1]);
});

test('server errors use semantic codes and stored status follows locale without rewriting records', async()=>{
  for(const locale of ['ru','en','kk']){
    setWorkspaceLocale(locale);
    const snapshot=state(0);snapshot.projects[0].name='Авторское название';
    const store=await createServerWorkspace({location,request:async(_url,options)=>options.method==='POST'?reply({error:{code:'forbidden',message:'Russian or provider detail must not leak'}},403):reply(snapshot)});
    assert.equal(store.storageMessage,shellT('server.loaded'));
    await assert.rejects(store.addRecord({title:'Author text'}),error=>error.message===shellT('error.forbidden')&&error.status===403);
    assert.equal(store.storageMessage,shellT('error.forbidden'));
    assert.equal(store.getProject().name,'Авторское название');
    setWorkspaceLocale(locale==='en'?'kk':'en');
    assert.equal(store.storageMessage,shellT('error.forbidden'));
  }
});
