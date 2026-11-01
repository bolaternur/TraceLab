import test from 'node:test';
import assert from 'node:assert/strict';
import {inboxCopy} from './workspace-inbox-copy.js';
import {proposeInboxGroups,runInboxBatch} from './workspace-inbox-model.js';
import {mountWorkspaceInbox} from './workspace-inbox.js';
import {setWorkspaceLocale} from './workspace-i18n.js';
test('Inbox and closeout controls and error messages have matching RU/EN/KK keys',()=>{
  const keys=Object.keys(inboxCopy.ru).sort();for(const locale of ['en','kk']){assert.deepEqual(Object.keys(inboxCopy[locale]).sort(),keys);for(const key of keys)assert.ok(inboxCopy[locale][key].trim());}
});

test('inbox groups stay proposals and require the same provider, repository, subsystem and bounded source time',()=>{
  const item=(id,time,patch={})=>({sourceId:id,status:'inbox',provider:'github',subsystemName:'Intake',metadata:{repository:'fixture/robot'},occurredAt:`2026-11-01T${time}:00Z`,...patch});
  const items=[item('one','08:00'),item('two','08:20'),item('later','08:40'),item('foreign-repository','08:10',{metadata:{repository:'another/robot'}}),item('other-subsystem','08:10',{subsystemName:'Lift'}),item('linked','08:15',{status:'linked'}),item('invalid','08:15',{occurredAt:'bad-date'})];
  const before=JSON.stringify(items),groups=proposeInboxGroups(items);
  assert.equal(groups.length,1);assert.deepEqual(groups[0].sourceIds,['one','two']);
  assert.equal(JSON.stringify(items),before);assert.equal('relationType' in groups[0],false);
});

test('batch review preserves successful writes and retries only failed sources',async()=>{
  const calls=[],failure=new Error('retry fixture');let failedOnce=false;
  const run=async id=>{calls.push(id);if(id==='two'&&!failedOnce){failedOnce=true;throw failure;}};
  const first=await runInboxBatch(['one','two','one','three'],{run});
  assert.deepEqual(first.saved,['one','three']);assert.deepEqual(first.failed,[{sourceId:'two',error:failure}]);
  const second=await runInboxBatch(first.failed.map(item=>item.sourceId),{run});
  assert.deepEqual(second.saved,['two']);assert.deepEqual(calls,['one','two','three','two']);
});

class Node {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.handlers={};this.attributes={};this.dataset={};this.className='';this.value='';this.checked=false;this.disabled=false;this.isConnected=true;}
  append(...nodes){this.children.push(...nodes);}
  prepend(...nodes){this.children.unshift(...nodes);}
  replaceChildren(...nodes){this.children=nodes;this.text='';}
  set textContent(value){this.text=String(value);this.children=[];}
  get textContent(){return(this.text||'')+this.children.map(item=>item.textContent).join(' ');}
  setAttribute(key,value){this.attributes[key]=String(value);}
  addEventListener(name,handler){(this.handlers[name]||=[]).push(handler);}
  async dispatch(name,event={}){for(const handler of this.handlers[name]||[])await handler({preventDefault(){},...event});}
  focus(){}
  remove(){this.isConnected=false;}
  showModal(){this.open=true;}
  close(){this.open=false;for(const handler of this.handlers.close||[])handler();}
  reportValidity(){return true;}
  all(){return[this,...this.children.flatMap(item=>item.all())];}
}

test('selection and proposal review do not write; confirmation chains revisions and retains retry identity per failed item',async()=>{
  const prior={document:globalThis.document,location:globalThis.location,history:globalThis.history,fetch:globalThis.fetch};
  const body=new Node('body'),container=new Node('div');body.append(container);
  globalThis.document={body,activeElement:null,createElement:tag=>new Node(tag),createTextNode:text=>{const node=new Node('text');node.textContent=text;return node;}};
  globalThis.location={href:'http://localhost:3000/workspace?view=inbox',origin:'http://localhost:3000'};
  globalThis.history={replaceState(_state,_title,url){globalThis.location.href=String(url);}};
  const items=['one','two'].map((sourceId,index)=>({sourceId,recordId:sourceId,title:'Fixture '+sourceId,status:'inbox',provider:'github',occurredAt:`2026-11-01T08:${index===0?'00':'10'}:00Z`,receivedAt:'2026-11-01T09:00:00Z',metadata:{repository:'fixture/robot'}}));
  const posts=[];let revision=7,networkFailed=false,changed=0;
  globalThis.fetch=async(_url,options={})=>{
    if(options.method!=='POST')return{ok:true,json:async()=>({items,iterations:[{id:'iteration',title:'Fixture version',state:'open',canEdit:false}],role:'student',revision,nextCursor:null,counts:{inbox:2}})};
    const payload=JSON.parse(options.body);posts.push(payload);
    assert.equal(payload.expectedRevision,revision);
    if(payload.sourceId==='two'&&!networkFailed){networkFailed=true;throw new Error('fixture offline');}
    revision++;return{ok:true,json:async()=>({projects:[{id:'project',serverRevision:revision}]})};
  };
  const flush=()=>new Promise(resolve=>setImmediate(resolve));let dispose;
  try{
    setWorkspaceLocale('en','UTC');dispose=mountWorkspaceInbox(container,{projectId:'project',role:'student',onChanged:()=>{changed++;}});await flush();
    const proposal=container.all().find(node=>node.tagName==='BUTTON'&&node.textContent==='Select group');assert.ok(proposal);await proposal.dispatch('click');
    assert.equal(posts.length,0);
    const review=container.all().find(node=>node.tagName==='BUTTON'&&node.textContent==='Link selected');assert.equal(review.disabled,false);await review.dispatch('click');
    assert.equal(posts.length,0);
    const modal=body.all().find(node=>node.tagName==='DIALOG'),form=modal.all().find(node=>node.tagName==='FORM');
    await form.dispatch('submit');assert.deepEqual(posts.map(item=>item.sourceId),['one','two']);assert.equal(modal.open,true);assert.ok(modal.textContent.includes('Retry failed sources'));assert.equal(changed,0);
    await form.dispatch('submit');await flush();
    assert.deepEqual(posts.map(item=>item.sourceId),['one','two','two']);assert.equal(posts[1].requestId,posts[2].requestId);assert.equal(modal.open,false);assert.equal(changed,1);
  }finally{dispose?.();for(const [key,value]of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
