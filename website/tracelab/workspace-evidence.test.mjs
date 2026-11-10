import test from 'node:test';
import assert from 'node:assert/strict';
import {assessEvidence,evidenceSummary,appendEvidenceAssessment} from './workspace-evidence.js';
import {setWorkspaceLocale,t} from './workspace-i18n.js';

const source={id:'photo',kind:'source',title:'Authored observation',revision:'v2'};
const decision={id:'decision',kind:'decision',title:'Keep the pad',status:'closed',rationale:'The photographed wear is at the contact edge'};
const trial={id:'test',kind:'test',title:'Original lift test',conditions:'180 g, same lift height',criterion:'Part remains held',body:'The part slipped',revision:'v2'};
const fixture=(records=[source,decision],links=[{from:source.id,to:decision.id,status:'accepted',relationType:'REFERENCES'}])=>({records,links});
const keys=assessment=>assessment.gaps.map(gap=>gap.key);

test('a documented observation-based decision needs no fabricated test and the assessment never mutates records',()=>{
  const project=fixture(),before=JSON.stringify(project);
  assert.equal(assessEvidence(project,decision).complete,true);
  assert.deepEqual(assessEvidence(project,decision).supporting.map(item=>item.record.id),['photo']);
  assert.equal(JSON.stringify(project),before);
});

test('closed labels never hide missing reasons, accepted sources or exact version context',()=>{
  const record={...decision,rationale:' '},project=fixture([record],[]);
  assert.deepEqual(keys(assessEvidence(project,record)),['why','support','version']);
  assert.equal(record.status,'closed');
});

test('suggested, rejected, dangling and contradictory records cannot count as supporting evidence',()=>{
  for(const link of [
    {from:'photo',to:'decision',status:'suggested'},
    {from:'photo',to:'decision',status:'rejected'},
    {from:'missing',to:'decision',status:'accepted'},
    {from:'photo',to:'decision',status:'accepted',relationType:'CONTRADICTS'},
    {from:'photo',to:'decision',status:'accepted',relationType:'LEADS_TO'},
  ])assert.ok(keys(assessEvidence(fixture(undefined,[link]),decision)).includes('support'));
});

test('test gaps identify the exact original test without replacing authorship or demanding numeric trials',()=>{
  assert.equal(assessEvidence(fixture([trial],[]),trial).complete,true);
  const incomplete={...trial,conditions:'',criterion:'',revision:''};
  const project=fixture([decision,incomplete],[{from:'test',to:'decision',status:'accepted',relationType:'SUPPORTS'}]);
  const gaps=assessEvidence(project,decision).gaps;
  assert.ok(gaps.some(gap=>gap.key==='conditions'&&gap.record.id==='test'));
  assert.ok(gaps.some(gap=>gap.key==='criterion'&&gap.record.id==='test'));
  assert.equal(gaps.some(gap=>gap.key==='result'),false);
  assert.equal(decision.rationale,'The photographed wear is at the contact edge');
});

test('zero is a valid measurement and unknown or absent results remain incomplete',()=>{
  const record={...trial,body:'',measuredValue:0};
  assert.equal(keys(assessEvidence(fixture([record],[]),record)).includes('result'),false);
  delete record.measuredValue;
  assert.ok(keys(assessEvidence(fixture([record],[]),record)).includes('result'));
});

test('accepted iteration context qualifies a linked test; suggestions do not',()=>{
  const iteration={id:'iteration',kind:'iteration'},record={...trial,revision:''};
  const project=fixture([iteration,record],[{from:'test',to:'iteration',status:'suggested',relationType:'TESTS'}]);
  assert.ok(keys(assessEvidence(project,record)).includes('version'));
  project.links[0].status='accepted';assert.equal(assessEvidence(project,record).complete,true);
});

test('iteration completeness remains distinct from closed status and flags unsupported test outcome',()=>{
  const iteration={id:'iteration',kind:'iteration',status:'closed',body:'Added pads',rationale:'Wear at the edge',outcome:'iterate',testOutcome:'pass',revision:'v2'};
  const project=fixture([iteration,source],[{from:'iteration',to:'photo',status:'accepted'}]);
  assert.deepEqual(keys(assessEvidence(project,iteration)),['testRecord']);
  iteration.testOutcome='unknown';assert.equal(assessEvidence(project,iteration).complete,true);
});

test('completeness labels are localized and exact-record actions are safe for authored HTML-like text',()=>{
  const previous=globalThis.document;
  class Node {
    constructor(tag){this.tagName=tag;this.children=[];this.handlers={};}
    append(...children){this.children.push(...children);}
    set textContent(value){this.text=String(value);}
    get textContent(){return(this.text||'')+this.children.map(child=>child.textContent).join(' ');}
    addEventListener(name,handler){this.handlers[name]=handler;}
    all(){return [this,...this.children.flatMap(child=>child.all())];}
  }
  globalThis.document={createElement:tag=>new Node(tag)};
  try {
    const incomplete={...trial,title:'<img src=x onerror=bad()>',criterion:''};
    const project=fixture([decision,incomplete],[{from:'test',to:'decision',status:'accepted'}]);
    for(const locale of ['ru','en','kk']) {
      setWorkspaceLocale(locale);const container=new Node('div');let opened;
      appendEvidenceAssessment(container,project,decision,{onOpen:id=>{opened=id;}});
      assert.ok(container.textContent.includes(t('evidence.scope')));
      const action=container.all().find(node=>node.tagName==='button');
      assert.ok(action.textContent.includes(incomplete.title));action.handlers.click();assert.equal(opened,'test');
      assert.ok(evidenceSummary(project,decision).includes(t('evidence.criterion')));
      assert.equal(container.all().some(node=>node.tagName==='img'),false);
    }
  } finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;setWorkspaceLocale('ru');}
});
