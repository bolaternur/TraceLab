import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedPhotoSelection} from './workspace-media-editor.js';
import {mediaMessages} from './workspace-media-copy.js';

test('photo selection is integer bounded and cannot address pixels outside the image',()=>{
  assert.deepEqual(boundedPhotoSelection({x:-10,y:200,w:500,h:500},320,180),{x:0,y:178,w:320,h:2});
  assert.deepEqual(boundedPhotoSelection({x:11.6,y:5.3,w:24.8,h:40.2},320,180),{x:12,y:5,w:25,h:40});
  assert.deepEqual(boundedPhotoSelection({x:NaN,y:Infinity,w:-5,h:undefined},320,180),{x:0,y:0,w:2,h:180});
});

test('keyboard photo selection instructions and controls exist in all three locales',()=>{
  for(const locale of ['ru','en','kk'])for(const key of ['editHint','selection','leftPx','topPx','widthPx','heightPx'])assert.ok(mediaMessages[locale][key]);
});
