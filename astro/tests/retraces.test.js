import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profile,distance} from '../src/geo.js';
const read=f=>JSON.parse(readFileSync(new URL('../public/data/'+f,import.meta.url)));
const routes=read('routes.geojson').features;
const thirty=routes.find(f=>f.properties.id==='30k');
const corrections=read('geometry-corrections.json');
test('three user-reported out-and-back tips removed, original junctions retained',()=>{
 const c=thirty.geometry.coordinates;

 for(const fix of corrections.changes){
  assert.ok(c.some(p=>distance(p,fix.junction)<.00001),`${fix.place}: junction missing`);
  assert.ok(c.every(p=>distance(p,fix.tip)>.001),`${fix.place}: removed tip remains`);
 }

 assert.ok(Math.abs(corrections.changes.reduce((s,f)=>s+f.removedLengthM,0)-301.6157074547152)<.001);
});
test('corrected profile and downloadable GPX use the same geometry',()=>{
 const c=thirty.geometry.coordinates,p=read('profiles.json').find(p=>p.id==='30k');
 assert.equal(p.distanceKm.length,c.length);assert.deepEqual(p.elevationM,c.map(p=>p[2]));
 assert.ok(Math.abs(p.distanceKm.at(-1)-thirty.properties.distanceKm)<1e-9);
 const xml=readFileSync(new URL('../public/data/30k.gpx',import.meta.url),'utf8');
 const coords=[...xml.matchAll(/<trkpt lon="([^"]+)" lat="([^"]+)"><ele>([^<]+)<\/ele><\/trkpt>/g)].map(m=>m.slice(1).map(Number));
 assert.deepEqual(coords,c);
});
test('road segment ends at Myscowa junction after start revision',()=>{


 const road=read('roads.geojson').features.find(f=>f.properties.id==='30k-D3');
 assert.equal(road.geometry.coordinates.length,16);
 assert.ok(distance(road.geometry.coordinates.at(-1),corrections.changes[2].junction)<.00001);
});
