import {test} from 'node:test';import assert from 'node:assert/strict';import {distance,profile,bounds,nearestSample,elevationStats} from '../src/geo.js';
test('Haversine distance in km',()=>assert.ok(Math.abs(distance([0,0],[0,1])-111.195)<.01));
test('profile accumulates distance and preserves missing elevations',()=>{const p=profile([[21,49,100],[21,49.01,110],[21,49.02]]);assert.equal(p[0].km,0);assert.ok(p[2].km>2);assert.equal(p[2].ele,null);assert.equal(elevationStats(p),null);});
test('bounds and profile lookup',()=>{assert.deepEqual(bounds([[2,3],[1,5],[4,2]]),[[1,2],[4,5]]);assert.equal(nearestSample([{km:0},{km:5},{km:10}],6).km,5);});
test('vertical noise is not counted as ascent',()=>assert.deepEqual(elevationStats([{ele:100},{ele:101},{ele:100},{ele:110},{ele:105}]),{up:10,down:5}));
