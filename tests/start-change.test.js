import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profile,distance} from '../src/geo.js';
const read=f=>JSON.parse(readFileSync(new URL('../public/data/'+f,import.meta.url)));
const routes=read('routes.geojson').features,report=read('start-correction.json');
const second=read('second-half-correction.json');
const originals=JSON.parse(readFileSync(new URL('./fixtures/start-retained-geometry.json',import.meta.url)));
test('Rynek start/meta, Młynówka prefix and entire previous finish preserved',()=>{
 for(const f of routes){
  const id=f.properties.id,c=f.geometry.coordinates,r=report.routes.find(r=>r.route===id),old=originals[id];
  assert.deepEqual(c[0],c.at(-1));
  assert.deepEqual(c.slice(r.newRetainedPrefixStart,r.newRetainedPrefixStart+85),old.prefix);
  if(id!=='30k')assert.deepEqual(c.slice(r.newRetainedSuffixStart,r.newRetainedSuffixStart+old.suffix.length),old.suffix);
  if(id!=='30k')assert.deepEqual(c.slice(r.newRetainedSuffixStart+old.suffix.length,r.newRetainedSuffixStart+old.suffix.length+7),old.extension);
  assert.ok(c.some(p=>distance(p,[21.5226686,49.6033614])<1e-8),'Stadium stairs missing');
  assert.ok(c.some(p=>distance(p,[21.5233421,49.6031127])<1e-8),'West-side turn missing');
  assert.ok(Math.abs(profile(c).at(-1).km-(id==='30k'?second.newDistanceKm:r.newKm))<1e-8);
 }
});
test('both profiles and GPX match changed routes; stale U1 gone; ława and finish crossing remain',()=>{
 const points=read('points.geojson').features;
 assert.ok(!points.some(p=>p.properties.code==='U1'));
 for(const id of ['30k-U3','10k-CROSSING','30k-D2','10k-D2'])assert.ok(points.some(p=>p.properties.id===id));
 for(const f of routes){
  const id=f.properties.id,c=f.geometry.coordinates,p=read('profiles.json').find(p=>p.id===id);
  assert.equal(p.distanceKm.length,c.length);assert.deepEqual(p.elevationM,c.map(p=>p[2]));
  assert.ok(Math.abs(p.distanceKm.at(-1)-f.properties.distanceKm)<1e-9);
  const xml=readFileSync(new URL('../public/data/'+id+'.gpx',import.meta.url),'utf8');
  const coords=[...xml.matchAll(/<trkpt lon="([^"]+)" lat="([^"]+)"><ele>([^<]+)<\/ele><\/trkpt>/g)].map(m=>m.slice(1).map(Number));
  assert.deepEqual(coords,c);
  assert.deepEqual(points.find(p=>p.properties.id===id+'-START').geometry.coordinates,c[0].slice(0,2));
 }
});
