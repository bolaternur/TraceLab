import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceStore} from './workspace-store.js';
const factory=storage=>createWorkspaceStore({storage:storage||null,eventTarget:null});
function project(store){store.createProject({name:'Visibility test'});const a=store.addRecord({kind:'source',title:'Original',body:'Authored text',author:'A'}),b=store.addRecord({kind:'source',title:'Second',body:'Evidence',author:'B'});store.addLink({from:a,to:b,label:'Reference',status:'accepted'});store.setNodePosition(a,{x:125,y:210});return a;}
test('graph removal keeps originals, links, history and layout through restore and reload',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const store=factory(storage),id=project(store),before=structuredClone(store.getProject());
  store.hideRecord(id);store.hideRecord(id);const hidden=store.getProject();assert.deepEqual(hidden.hiddenRecordIds,[id]);
  for(const key of ['records','links','nodePositions'])assert.deepEqual(hidden[key],before[key]);
  const restored=factory(storage);assert.deepEqual(restored.getProject().hiddenRecordIds,[id]);restored.restoreRecord(id);restored.restoreRecord(id);
  assert.deepEqual(restored.getProject().hiddenRecordIds,[]);for(const key of ['records','links','nodePositions'])assert.deepEqual(restored.getProject()[key],before[key]);
});
test('backup import retains graph visibility and rejects corrupt hidden IDs atomically',()=>{
  const store=factory(),id=project(store);store.hideRecord(id);const saved=store.exportProject(),other=factory();other.importProject(saved);assert.deepEqual(other.getProject().hiddenRecordIds,[id]);
  const before=other.exportProject();for(const hiddenRecordIds of [[id,id],['missing-record'],['__proto__']]){const input=JSON.parse(saved);input.project.hiddenRecordIds=hiddenRecordIds;assert.throws(()=>other.importProject(JSON.stringify(input)));assert.equal(other.exportProject(),before);}
});
test('synthetic original remains protected from graph removal',()=>{
  const store=factory(),id=store.getProject().records[0].id;assert.throws(()=>store.hideRecord(id));assert.equal(store.getProject().hiddenRecordIds,undefined);
});
