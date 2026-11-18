import test from 'node:test';
import assert from 'node:assert/strict';
import {teamCopy} from './workspace-team-copy.js';
test('Team settings actions, permission errors and statuses are complete in RU/EN/KK',()=>{
  const keys=Object.keys(teamCopy.ru).sort();for(const locale of ['en','kk']){assert.deepEqual(Object.keys(teamCopy[locale]).sort(),keys);for(const key of keys)assert.ok(teamCopy[locale][key].trim());}
});
