import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = name => readFileSync(new URL(`../public/data/${name}`, import.meta.url));
test('D2 meadow alternatives reproduce the organizer drawing for both routes without modifying primary routes', () => {
  const { features } = JSON.parse(read('alternatives.geojson'));
  assert.equal(features.length, 2);
  assert.deepEqual(features.map(f => f.properties.route).sort(), ['10k', '30k']);
  assert.deepEqual(features[0].geometry.coordinates, features[1].geometry.coordinates);
  for (const f of features) {
    assert.equal(f.properties.includedInMainDistance, false);
    assert.equal(f.geometry.coordinates.length, 21);
    assert.deepEqual(f.geometry.coordinates[0], [21.522841146, 49.59492177]);
    assert.deepEqual(f.geometry.coordinates.at(-1), [21.520559896, 49.593568034]);
  }
  for (const [name, hash] of Object.entries({
    'routes.geojson': 'c2e4ce7fe5983d815922552b313aa66a6909baa20b80c348882be3b38fa8225f',
    'profiles.json': '212e88066526268085262c428f4380d020d54eeeed5a83e0d16b622c9d56953c',
    '30k.gpx': '98a670612f81038e56c4eab4dbe8ad06dd3ae6ab678815290694b7b578b1c00b',
    '10k.gpx': '4d4a2f371d8118ecd80bee1659bd3330c4b255acc545a782bcc0f261b735685c'
  })) assert.equal(createHash('sha256').update(read(name)).digest('hex'), hash, name);
});
