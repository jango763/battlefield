'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cases=[
 ['local-no-paywall-debug',/privacy:'local-only'/],
 ['adaptive-gpu',/renderQuality\.fpsElapsed/],
 ['shared-soldier-materials',/soldierMaterialCache=new Map/],
 ['network-retry-window',/modelDepotRetryAfter=Date\.now\(\)\+30000/],
 ['live-first-weapons',/weaponQueue\.findIndex\(v=>v\?\.unit\?\.alive/],
 ['session-objectives',/const SESSION_OBJECTIVES=Object\.freeze/],
 ['tracer-buffer-reuse',/instance:slot\.mesh/],
 ['retina-map',/c\.setTransform\(dpi,0,0,dpi,0,0\)/],
 ['safe-keyboard-controls',/const magnitude=Math\.hypot\(x,z\)/],
 ['batched-world-updates',/now-lastFarmSyncAt>400/]
];
for(const [name,re] of cases)assert.match(game,re,name);
assert.match(game,/B\.MeshBuilder\.CreateLines\('tracer-pooled'/);
assert.match(game,/const TRACER_LIMIT=48/);
assert.match(game,/window\.addEventListener\('blur'/);
assert.match(game,/if\(f\.pooled\)/);
assert.match(game,/advanceObjectives\(hero,econ\)/);
assert.match(html,/id="view"/);
assert.match(html,/babylonjs\.loaders/);
assert(!game.includes('https://github.com/'),
 'No build-time network or remote authentication should be embedded in game runtime');
console.log('BATTLEFIELD_TEN_PART_ENGINEERING_TEST_PASS',cases.map(x=>x[0]).join(','));
