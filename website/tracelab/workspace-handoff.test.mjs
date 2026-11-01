import test from 'node:test';
import assert from 'node:assert/strict';
import {handoffSections,handoffSelection} from './workspace-handoff-model.js';
import {handoffCopy} from './workspace-handoff-copy.js';
import {mountWorkspaceHandoff,openNextSeason} from './workspace-handoff.js';
import {setWorkspaceLocale} from './workspace-i18n.js';

const record=(id,kind,extra={})=>({id,kind,title:'Fixture '+id,author:'Original author',createdAt:'2026-11-01T08:00:00Z',...extra});
test('handoff is a categorization of saved evidence with original attribution and no fabricated explanation',()=>{
  const records=[record('decision','decision',{status:'closed',rationale:'Student explanation'}),record('failed','iteration',{status:'closed',outcome:'reverted',rationale:'Original evidence failed'}),record('open','iteration',{status:'draft',nextStep:'Repeat the lift'}),record('test','test',{trials:10,successes:6}),record('tip','source',{sourceType:'handoff',body:'My advice'}),record('photo','source')];
  const project={records,links:[]},before=JSON.stringify(project),sections=handoffSections(project);
  for(const [key,id]of [['decisions','decision'],['failed','failed'],['open','open'],['tests','test'],['advice','tip'],['materials','photo']])assert.equal(sections.find(section=>section.key===key).records[0],records.find(item=>item.id===id));
  assert.equal(JSON.stringify(project),before);assert.equal(sections.find(section=>section.key==='open').records[0].rationale,undefined);
});
test('handoff selection is explicit and optionally includes only direct accepted sources and tests',()=>{
  const project={records:[record('decision','decision'),record('source','source'),record('test','test'),record('proposal','source'),record('other','decision'),record('transitive','source')],links:[{from:'source',to:'decision',status:'accepted'},{from:'test',to:'decision',status:'accepted'},{from:'proposal',to:'decision',status:'suggested'},{from:'other',to:'decision',status:'accepted'},{from:'source',to:'transitive',status:'accepted'}]};
  assert.deepEqual(handoffSelection(project,new Set()),[]);
  assert.deepEqual(handoffSelection(project,new Set(['decision','missing'])),['decision']);
  assert.deepEqual(handoffSelection(project,new Set(['decision']),{includeEvidence:true}),['decision','source','test']);
});
test('handoff text and actions cover all three locales',()=>{
  for(const locale of ['en','kk'])assert.deepEqual(Object.keys(handoffCopy[locale]).sort(),Object.keys(handoffCopy.ru).sort());
  for(const copy of Object.values(handoffCopy))for(const value of Object.values(copy))assert.ok(value.trim());
});

class Node {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.handlers={};this.attributes={};this.dataset={};this.className='';this.checked=false;this.disabled=false;this.value='';}
  append(...nodes){this.children.push(...nodes);}
  prepend(...nodes){this.children.unshift(...nodes);}
  replaceChildren(...nodes){this.children=nodes;this.text='';}
  set textContent(value){this.text=String(value);this.children=[];}
  get textContent(){return(this.text||'')+this.children.map(item=>item.textContent).join(' ');}
  setAttribute(key,value){this.attributes[key]=String(value);}
  addEventListener(name,handler){this.handlers[name]=handler;}
  querySelectorAll(selector){return selector==='input[type=checkbox]'?this.all().filter(item=>item.tagName==='INPUT'&&item.type==='checkbox'):selector==='button,input'?this.all().filter(item=>['BUTTON','INPUT'].includes(item.tagName)):[];}
  showModal(){this.open=true;}close(){this.open=false;this.handlers.close?.();}focus(){}remove(){}reportValidity(){return true;}
  all(){return[this,...this.children.flatMap(item=>item.all())];}
}
test('opening handoff only reads season metadata; export is gated by explicit selection and preserves author text',async()=>{
  const previous={document:globalThis.document,fetch:globalThis.fetch};
  globalThis.document={createElement:tag=>new Node(tag),createTextNode:text=>{const node=new Node('text');node.textContent=text;return node;}};
  const requests=[];globalThis.fetch=async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({season:{name:'2026 fixture',active:true},projects:[]})};};
  const project={id:'fixture-project',name:'Fixture project',records:[record('d','decision',{status:'closed',rationale:'Exact student words'})],links:[]};
  const store={getProject:()=>project,serverContext:{role:'coach',team:{id:'fixture-team'}}},container=new Node('div');let exported;
  try{
    setWorkspaceLocale('en','UTC');store.serverContext.role='student';
    const cleanup=mountWorkspaceHandoff(container,{store,project,serverMode:true,onExport:options=>{exported=options;}});await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests.length,1);assert.equal(requests[0].options.method,undefined);assert.equal(exported,undefined);
    const exportButton=container.all().find(item=>item.tagName==='BUTTON'&&item.textContent==='Prepare handoff report');assert.equal(exportButton.disabled,true);
    const checkbox=container.all().find(item=>item.attributes['aria-label']==='Include in handoff: Fixture d');checkbox.checked=true;checkbox.handlers.change();assert.equal(exportButton.disabled,false);
    exportButton.handlers.click();assert.deepEqual(exported,{scope:'handoff',recordIds:['d']});assert.ok(container.textContent.includes('Exact student words'));assert.equal(requests.length,1);cleanup();
  }finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('starting a season requires preview then explicit confirmation and reuses the request after network failure',async()=>{
  const prior={document:globalThis.document,fetch:globalThis.fetch},body=new Node('body'),requests=[];let started=0;
  globalThis.document={body,activeElement:null,createElement:tag=>new Node(tag),createTextNode:text=>{const node=new Node('text');node.textContent=text;return node;}};
  globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));if(requests.length===1)throw new Error('fixture network failure');return{ok:true,json:async()=>({projectId:'new-project',seasonId:'new-season'})};};
  try{
    setWorkspaceLocale('en','UTC');const project={id:'source-project',name:'Previous robot'},store={getProject:()=>project},metadata={role:'student_lead',canStartNextSeason:true,revision:5,subsystemCount:2,season:{id:'old-season',name:'2026',year:2026}};
    assert.equal(openNextSeason({store,project,metadata:{...metadata,role:'coach'}}),null);
    const modal=openNextSeason({store,project,metadata,onStarted:()=>{started++;}}),form=modal.all().find(item=>item.tagName==='FORM');
    const titleLabel=form.all().find(item=>item.tagName==='LABEL'&&item.textContent==='New project name');titleLabel.children[0].value='Next robot';
    const acknowledge=form.all().find(item=>item.tagName==='LABEL'&&item.textContent.includes('I reviewed the source season'));acknowledge.children[0].checked=true;
    await form.handlers.submit({preventDefault(){}});assert.equal(requests.length,0);
    const review=form.all().find(item=>item.tagName==='BUTTON'&&item.textContent==='Review transition');review.handlers.click();assert.equal(requests.length,0);assert.ok(form.textContent.includes('Evidence is not copied'));
    await form.handlers.submit({preventDefault(){}});assert.equal(requests.length,1);assert.equal(modal.open,true);assert.equal(started,0);
    await form.handlers.submit({preventDefault(){}});assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(started,1);assert.equal(modal.open,false);
  }finally{for(const [key,value]of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
