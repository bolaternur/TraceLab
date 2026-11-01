import test from 'node:test';
import assert from 'node:assert/strict';
import {beamCurve,boundedSpotlight} from './astra-effects.js';
test('beam geometry follows actual endpoints and bounded curvature after a resize',()=>{assert.equal(beamCurve({x:20,y:160},{x:200,y:60},100),'M 20,160 Q 110,60 200,60');assert.equal(beamCurve({x:0,y:0},{x:400,y:100},0),'M 0,0 Q 200,0 400,100');assert.equal(beamCurve({x:NaN,y:0},{x:1,y:2}), '');});
test('spotlight coordinates remain inside the hovered surface',()=>{assert.deepEqual(boundedSpotlight(-40,800,200,120),{x:0,y:120});assert.deepEqual(boundedSpotlight(50,60,200,120),{x:50,y:60});assert.deepEqual(boundedSpotlight(NaN,Infinity,0,0),{x:0,y:0});});
