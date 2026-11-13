import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = name => readFileSync(new URL(`../public/data/${name}`, import.meta.url));
test('D2 meadow alternatives reproduce the organizer drawing for both routes', () => {
  const features = JSON.parse(read('alternatives.geojson')).features.filter(f=>f.properties.id.endsWith('-D2-meadow'));
  assert.equal(features.length, 2);
  assert.deepEqual(features.map(f => f.properties.route).sort(), ['10k', '30k']);
  assert.deepEqual(features[0].geometry.coordinates, features[1].geometry.coordinates);
  for (const f of features) {
    assert.equal(f.properties.includedInMainDistance, false);
    assert.equal(f.geometry.coordinates.length, 21);
    assert.deepEqual(f.geometry.coordinates[0], [21.522841146, 49.59492177]);
    assert.deepEqual(f.geometry.coordinates.at(-1), [21.520559896, 49.593568034]);
  }
});
