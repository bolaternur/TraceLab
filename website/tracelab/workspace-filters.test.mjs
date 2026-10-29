import test from 'node:test';
import assert from 'node:assert/strict';
import {readHistoryFilters,filterHistoryRecords} from './workspace-filters.js';
import {setWorkspaceLocale} from './workspace-i18n.js';
test('date range follows the team day across UTC midnight and includes both boundaries',()=>{
  setWorkspaceLocale('ru','Asia/Qyzylorda');
  const records=[{id:'previous',createdAt:'2026-10-25T18:59:00Z',author:'A'},{id:'first',createdAt:'2026-10-25T19:00:00Z',author:'A'},{id:'last',createdAt:'2026-10-26T18:59:59Z',author:'A'},{id:'next',createdAt:'2026-10-26T19:00:00Z',author:'A'}];
  assert.deepEqual(filterHistoryRecords(records,{from:'2026-10-26',to:'2026-10-26',author:''}).map(r=>r.id),['first','last']);
});
test('deep link filters validate dates and use exact authored labels',()=>{
  const filters=readHistoryFilters(new URLSearchParams('from=2026-02-31&to=nonsense&order=oldest&author=A'));
  assert.equal(filters.from,'');assert.equal(filters.to,'');assert.equal(filters.order,'oldest');
  const records=[{id:'1',author:'A'},{id:'2',author:'AB'}];assert.deepEqual(filterHistoryRecords(records,filters),[records[0]]);
  assert.equal(records.length,2);
});
