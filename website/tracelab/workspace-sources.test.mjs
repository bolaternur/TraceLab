import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCopy} from './workspace-sources-copy.js';
test('Sources controls and status explanations have identical semantic keys in all three locales',()=>{
  const keys=Object.keys(sourceCopy.ru).sort();
  for(const locale of ['en','kk']){assert.deepEqual(Object.keys(sourceCopy[locale]).sort(),keys);for(const key of keys)assert.ok(sourceCopy[locale][key].trim(),`${locale}.${key}`);}
});
test('Source connection copy never claims local configuration is a verified external connection',()=>{
  for(const locale of ['ru','en','kk']){assert.notEqual(sourceCopy[locale].pending,sourceCopy[locale].receiving);assert.ok(sourceCopy[locale].local.includes('localhost'));assert.ok(sourceCopy[locale].setup.includes('push'));}
});
