import test from 'node:test';
import assert from 'node:assert/strict';
import {inboxCopy} from './workspace-inbox-copy.js';
test('Inbox and closeout controls and error messages have matching RU/EN/KK keys',()=>{
  const keys=Object.keys(inboxCopy.ru).sort();for(const locale of ['en','kk']){assert.deepEqual(Object.keys(inboxCopy[locale]).sort(),keys);for(const key of keys)assert.ok(inboxCopy[locale][key].trim());}
});
