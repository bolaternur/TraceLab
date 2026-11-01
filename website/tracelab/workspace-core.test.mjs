import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionScope,decisionNeedsAttention,findMemory,acceptedNeighbors,coreText} from './workspace-core.js';
import {setWorkspaceLocale} from './workspace-i18n.js';
const project={id:'fixture',name:'Fixture only',records:[
 {id:'photo',kind:'source',title:'Направляющая',createdAt:'2026-10-01',revision:'v1'},
 {id:'test',kind:'test',title:'Вход: 9 из 10',createdAt:'2026-10-02'},
 {id:'decision',kind:'decision',title:'Расширить вход',rationale:'Деталь застревала в узком входе',createdAt:'2026-10-03'},
 {id:'draft',kind:'iteration',title:'Новый захват',rationale:'',createdAt:'2026-10-04'},
],links:[{from:'photo',to:'decision',status:'accepted'},{from:'test',to:'decision',status:'suggested'},{from:'missing',to:'decision',status:'accepted'}]};
test('Decisions excludes source/test/iteration by default while full journal remains an explicit choice',()=>{assert.deepEqual(decisionScope(project.records,new URLSearchParams()).map(r=>r.id),['decision']);assert.equal(decisionScope(project.records,new URLSearchParams('journal=all')).length,4);assert.deepEqual(decisionScope(project.records,new URLSearchParams('journal=unknown')).map(r=>r.id),['decision']);assert.equal(project.records.length,4);});
test('Memory searches authored reasons and accepted source titles without upgrading suggestions',()=>{setWorkspaceLocale('ru');const result=findMemory([project],{query:'Направляющая'});assert.equal(result.length,1);assert.equal(result[0].record.id,'decision');assert.deepEqual(result[0].related.map(r=>r.record.id),['photo']);assert.equal(findMemory([project],{query:'9 из 10'}).length,0);assert.equal(acceptedNeighbors(project,'decision').length,1);});
test('Memory gap review reports missing explanation and does not substitute material descriptions',()=>{const result=findMemory([project],{gaps:true});assert.deepEqual(result.map(r=>r.record.id),['draft']);assert.equal(result[0].record.rationale,'');assert.equal(project.records[2].rationale,'Деталь застревала в узком входе');});
test('Memory accepts question prefixes and punctuation without inventing a matching reason',()=>{
 setWorkspaceLocale('ru');assert.deepEqual(findMemory([project],{query:'Почему «застревала», направляющая?'}).map(item=>item.record.id),['decision']);
 assert.equal(findMemory([project],{query:'Почему направляющая неизвестное?'}).length,0);
 for(const [locale,question] of [['en','Why'],['kk','Неліктен']]){setWorkspaceLocale(locale);assert.equal(findMemory([project],{query:question+' застревала?'}).length,1);}
 setWorkspaceLocale('ru');assert.equal(project.records[2].rationale,'Деталь застревала в узком входе');
});
test('A link to a future iteration does not claim a decision has supporting evidence',()=>{
 const decision=project.records.find(record=>record.id==='decision');
 const forwardOnly={...project,links:[{from:'decision',to:'draft',status:'accepted',kind:'LEADS_TO'}]};
 assert.equal(decisionNeedsAttention(forwardOnly,decision),true);
 assert.equal(decisionNeedsAttention(project,decision),false);
 assert.equal(decisionNeedsAttention(project,{...decision,rationale:''}),true);
});
test('Memory only searches project objects explicitly passed by the authorized shell',()=>{const second={id:'other',name:'Other fixture',records:[{id:'other-decision',kind:'decision',title:'Other choice',rationale:'Reason',createdAt:'2026-10-05'}],links:[]};assert.equal(findMemory([project]).length,2);assert.equal(findMemory([project,second]).length,3);assert.equal(findMemory([project],{query:'Other choice'}).length,0);});
test('New views and missing-explanation labels are complete across RU EN KK',()=>{for(const locale of ['ru','en','kk']){setWorkspaceLocale(locale);for(const key of ['overview','iterations','memory','missingWhy','emptyDecisions','helpStorage','reportsHint'])assert.notEqual(coreText(key),key);}setWorkspaceLocale('ru');});
