import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{validateStyleMin}from'@maplibre/maplibre-gl-style-spec';import{touristStyle}from'../src/tourist-style.js';
test('tourist style validates and exposes paths/tracks at overview zoom',()=>{
 const original=JSON.parse(readFileSync(new URL('./fixtures/liberty.json',import.meta.url)));
 const s=touristStyle(original),layer=id=>s.layers.find(l=>l.id===id);
 assert.deepEqual(validateStyleMin(s).map(e=>e.message),[]);
 assert.equal(layer('road_path_pedestrian').minzoom,11);
 assert.equal(layer('road_service_track').paint['line-width'][3],11);
 assert.equal(layer('road_service_track').paint['line-width'][4],0.65);
 assert.equal(layer('tourist-hillshade').paint['hillshade-exaggeration'],0.25);
 assert.equal(original.layers.find(l=>l.id==='road_path_pedestrian').minzoom,14);
});
