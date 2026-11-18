import test from 'node:test';
import assert from 'node:assert/strict';

function fixtureDatabase() {
  const data=new Map();
  return {open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={pending:0,objectStore(){return {get:key=>operation(()=>data.get(key)),put:(value,key)=>operation(()=>{data.set(key,structuredClone(value));return key;}),delete:key=>operation(()=>data.delete(key))};}};
    function operation(callback){const result={};tx.pending++;queueMicrotask(()=>{result.result=callback();result.onsuccess?.();tx.pending--;queueMicrotask(()=>{if(tx.pending===0)tx.oncomplete?.();});});return result;}return tx;}};request.onsuccess?.();});return request;}};
}
test('a late response from the signed-out document cannot restore its offline identity; a new document can',async()=>{
  const original=globalThis.indexedDB,clock=Date.now;let now=100;
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:fixtureDatabase()});Date.now=()=>now;
  try{
    const old=await import('./workspace-outbox.js?context-fixture-old');
    await old.setOfflineContext({userId:'old-owner',projectId:'private-old-project'});assert.equal((await old.getOfflineContext()).userId,'old-owner');
    now=200;await old.clearOfflineContext();assert.equal(await old.getOfflineContext(),undefined);
    await old.setOfflineContext({userId:'old-owner',projectId:'late-response-project'});assert.equal(await old.getOfflineContext(),undefined);
    now=300;const fresh=await import('./workspace-outbox.js?context-fixture-new');
    await fresh.setOfflineContext({userId:'new-owner',projectId:'new-project'});assert.equal((await fresh.getOfflineContext()).userId,'new-owner');
    await old.setOfflineContext({userId:'old-owner',projectId:'another-late-response'});assert.equal((await fresh.getOfflineContext()).userId,'new-owner');
  }finally{Date.now=clock;if(original===undefined)delete globalThis.indexedDB;else Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:original});}
});
