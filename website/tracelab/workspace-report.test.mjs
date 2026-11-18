import test from 'node:test';
import assert from 'node:assert/strict';
import {reportOrderedRecords,moveReportRecord,reportSectionSequence,reportAttachmentStatus} from './workspace-report-model.js';
import {reportText} from './workspace-report.js';

test('report reorder cannot introduce a foreign record or duplicate evidence',()=>{
  const records=[{id:'a',kind:'source'},{id:'b',kind:'test'},{id:'c',kind:'decision'}];
  const moved=moveReportRecord(['a','b','c'],'c',-1);assert.deepEqual(moved,['a','c','b']);
  assert.deepEqual(reportOrderedRecords(records,['foreign','c','c','a']).map(record=>record.id),['c','a','b']);
  assert.deepEqual(moveReportRecord(['a','b'],'a',-1),['a','b']);
});
test('section boundaries follow the exact selected sequence and leave authored content untouched',()=>{
  const records=[{id:'a',kind:'source',body:'Original'}, {id:'b',kind:'test'}, {id:'c',kind:'test'}, {id:'d',kind:'decision'}],before=JSON.stringify(records);
  assert.deepEqual(reportSectionSequence(records,['d','b','c','a'],true,kind=>kind.toUpperCase()),[{title:'DECISION',recordIds:['d']},{title:'TEST',recordIds:['b','c']},{title:'SOURCE',recordIds:['a']}]);
  assert.equal(reportSectionSequence(records,['a'],false,kind=>kind),undefined);assert.equal(JSON.stringify(records),before);
});
test('attachment preview distinguishes checked embedding candidates from referenced-only models/files',()=>{
  assert.equal(reportAttachmentStatus({mimeType:'image/jpeg',bytes:500},{imageBytes:1000}),'eligible_image');
  for(const attachment of [{mimeType:'model/gltf-binary',bytes:500},{mimeType:'image/png',bytes:1001},{mimeType:'image/webp',bytes:500}])assert.equal(reportAttachmentStatus(attachment,{imageBytes:1000}),'reference_only');
});
test('report ordering, policy and disclosure controls are localized in RU/EN/KK',()=>{
  for(const locale of ['ru','en','kk'])for(const key of ['policyDetails','reviewPath','policy_layout_unreviewed','teamNumber','previewNote','moveUp','moveDown','manifestNote','report_preview_changed','competition_pdf_required']){const text=reportText(key,locale);assert.ok(text);assert.notEqual(text,reportText('unavailable',locale),`${locale}:${key}`);}
});
