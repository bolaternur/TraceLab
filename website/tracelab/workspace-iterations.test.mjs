import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceStore} from './workspace-store.js';
import {iterationEvidence,iterationMissing,filterIterations} from './workspace-iterations-model.js';
import {iterationCopy} from './workspace-iterations-copy.js';
import {openWorkspaceIteration} from './workspace-iterations.js';

test('an authored iteration can be drafted, closed, reopened and imported without losing goal or result history',()=>{
  let serial=0;const store=createWorkspaceStore({storage:null,eventTarget:null,idFactory:()=>`fixture-${++serial}`,now:()=> '2026-10-31T10:00:00.000Z'});
  store.createProject({name:'Iteration fixture'});
  const id=store.addRecord({kind:'iteration',title:'Retain the part',author:'Fixture student',subsystem:'Intake',problemOrGoal:'Lift a 180 g part',body:''});
  let record=store.getProject().records.find(item=>item.id===id);assert.deepEqual(iterationMissing(record),['change','why','outcome']);
  assert.throws(()=>store.updateRecord(id,{status:'closed',body:'Added a softer pad',outcome:'kept'}),/Почему/);
  store.updateRecord(id,{status:'closed',body:'Added a softer pad',rationale:'The first version slipped',testOutcome:'partial',outcome:'iterate',nextStep:'Repeat under the same load'});
  store.updateRecord(id,{status:'draft',problemOrGoal:'Lift the same part at a larger angle'});
  record=store.getProject().records.find(item=>item.id===id);
  assert.equal(record.subsystem,'Intake');assert.equal(record.testOutcome,'partial');assert.equal(record.status,'draft');
  assert.equal(record.recordHistory.versions.at(-2).snapshot.problemOrGoal,'Lift a 180 g part');
  assert.equal(record.recordHistory.versions.at(-2).snapshot.status,'closed');
  const restored=createWorkspaceStore({storage:null,eventTarget:null,idFactory:()=>`restored-${++serial}`});restored.importProject(store.exportProject());
  const imported=restored.getProject().records[0];assert.equal(imported.problemOrGoal,record.problemOrGoal);assert.equal(imported.testOutcome,'partial');assert.equal(imported.subsystem,'Intake');
  assert.throws(()=>store.updateRecord(id,{testOutcome:'made-up-success'}),/Результат итерации/);
});
test('iteration evidence excludes suggestions, rejected links and missing records without inferring causality',()=>{
  const project={records:[{id:'iteration',kind:'iteration'},{id:'photo',kind:'source'},{id:'test',kind:'test'},{id:'suggestion',kind:'decision'}],links:[
    {from:'iteration',to:'photo',status:'accepted',relationType:'REFERENCES'},
    {from:'test',to:'iteration',status:'accepted',relationType:'TESTS'},
    {from:'iteration',to:'photo',status:'accepted',relationType:'RELATED_TO'},
    {from:'suggestion',to:'iteration',status:'suggested'},
    {from:'iteration',to:'test',status:'rejected'},
    {from:'iteration',to:'missing',status:'accepted'},
  ]};
  const evidence=iterationEvidence(project,'iteration');assert.deepEqual(evidence.map(item=>item.record.id),['photo','test']);
  assert.deepEqual(evidence.map(item=>item.link.relationType),['REFERENCES','TESTS']);
});
test('iteration filters search student rationale and goals while excluding other record types',()=>{
  const records=[{id:'a',kind:'iteration',title:'V1',subsystem:'Lift',status:'draft',problemOrGoal:'Reduce slipping',createdAt:'2026-10-01T00:00:00Z'},
    {id:'b',kind:'iteration',title:'V2',subsystem:'Intake',status:'closed',rationale:'Slipping was measured',createdAt:'2026-10-02T00:00:00Z'},
    {id:'c',kind:'source',title:'Slipping',subsystem:'Intake'}];
  assert.deepEqual(filterIterations({records},{query:'slipping'}).map(item=>item.id),['b','a']);
  assert.deepEqual(filterIterations({records},{query:'slipping',subsystem:'Intake',state:'closed'}).map(item=>item.id),['b']);
});
test('all iteration actions and states have RU EN KK labels',()=>{
  for(const locale of ['en','kk'])assert.deepEqual(Object.keys(iterationCopy[locale]).sort(),Object.keys(iterationCopy.ru).sort());
  for(const labels of Object.values(iterationCopy))for(const value of Object.values(labels))assert.equal(typeof value==='string'&&value.length>0,true);
});

test('a readonly iteration starts at its heading rather than scrolling to the lone cancel button',()=>{
  const previous=globalThis.document;let focused;
  class Node{
    constructor(tag){this.tagName=tag;this.children=[];this.handlers={};this.dataset={};this.value='';this.className='';this.scrollTop=123;}
    append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;this.text='';}after(){}setAttribute(){}addEventListener(name,handler){this.handlers[name]=handler;}
    set textContent(value){this.text=String(value);this.children=[];}get textContent(){return(this.text||'')+this.children.map(item=>item.textContent).join(' ');}
    all(){return[this,...this.children.flatMap(item=>item.all())];}
    querySelectorAll(selector){return this.all().filter(item=>selector.split(',').includes(item.tagName));}
    focus(options){focused={node:this,options};}showModal(){this.open=true;this.scrollTop=1000;}close(){this.open=false;this.handlers.close?.();}remove(){}
  }
  globalThis.document={body:new Node('body'),activeElement:null,createElement:tag=>new Node(tag),createTextNode:text=>{const node=new Node('text');node.textContent=text;return node;}};
  try{
    const project={id:'readonly-fixture',dataKind:'synthetic',records:[{id:'iteration',kind:'iteration',title:'Saved iteration',body:'Recorded change',status:'draft',createdAt:'2026-11-01T08:00:00Z'}],links:[]},before=JSON.stringify(project);
    const dialog=openWorkspaceIteration({store:{getProject:()=>project},project,recordId:'iteration'});
    assert.equal(focused.node.tagName,'h2');assert.equal(focused.node.tabIndex,-1);assert.deepEqual(focused.options,{preventScroll:true});assert.equal(dialog.scrollTop,0);assert.equal(JSON.stringify(project),before);dialog.close();
  }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
