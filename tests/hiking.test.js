import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('hiking overlay preserves ground marking colours and stays within local extent',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/data/hiking-routes.geojson',import.meta.url)));
 assert.equal(data.features.length,205);
 const green=data.features.filter(f=>f.properties.osm_relation===3754001);
 assert.ok(green.length);
 assert.ok(green.every(f=>f.properties.trail_color==='green'&&f.properties.color==='#2e7846'));
 for(const f of data.features)for(const [x,y]of f.geometry.coordinates){assert.ok(x>=21.4&&x<=21.67);assert.ok(y>=49.48&&y<=49.65);}
});
