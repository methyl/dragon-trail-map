import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdirSync,readFileSync} from 'node:fs';
test('production build emits and references the MapLibre module worker under the Pages base',()=>{
  execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
  const dir=new URL('../dist/assets/',import.meta.url);
  const files=readdirSync(dir);
  const worker=files.find(f=>/^maplibre-gl-worker-.+\.js$/.test(f));
  assert.ok(worker,'The MapLibre worker must be emitted, not guessed at runtime');
  const main=files.filter(f=>/^index-.+\.js$/.test(f)).map(f=>readFileSync(new URL(f,dir),'utf8')).join('');
  assert.ok(main.includes('/dragon-trail-map/assets/'+worker),'Worker URL must respect the GitHub Pages subdirectory');
  assert.ok(readFileSync(new URL(worker,dir),'utf8').length>100000,'Worker must contain bundled runtime');
});
