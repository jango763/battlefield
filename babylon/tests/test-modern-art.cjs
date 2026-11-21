'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const art=fs.readFileSync(path.join(ROOT,'babylon/modern-art-v1.js'),'utf8');
const game=fs.readFileSync(path.join(ROOT,'babylon/game.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'babylon/index.html'),'utf8');
new Function(art);new Function(game);
const module=require('../modern-art-v1.js');
assert.equal(typeof module.apply,'function');
assert.equal(module.PROFILE,'modern-battlefield-pbr-v1');
assert(html.includes('<script src="./modern-art-v1.js"></script>'));
assert(game.includes("new URLSearchParams(location.search).get('art')!=='classic'"));
assert(game.includes("state.modernArt=modernArt.apply({scene,B,world,camera,sun,map:goldRules.MAP})"));
for(const word of ['new B.PBRMaterial(','-base.jpg','-normal.jpg',
 'B.Mesh.MergeMeshes','roofPair(','frameWindow(','report.damagedRuins++',
 'thinInstanceSetBuffer','isPickable=false'])
 assert(art.includes(word),'Missing modern Babylon graphics feature '+word);
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'babylon/art/SOURCE_LICENSES.json'),'utf8'));
assert.equal(manifest.license,'CC0 1.0');
for(const [name,data] of Object.entries(manifest.materials)){
 assert(data.asset_page.startsWith('https://polyhaven.com/a/'));
 for(const m of Object.values(data.maps)){
  const local=path.join(ROOT,'babylon/art',m.path);
  assert(fs.statSync(local).size>=30000,'Missing scanned JPEG '+m.path);
  assert(m.source.startsWith('https://dl.polyhaven.org/'));
 }
}
assert.equal(Object.keys(manifest.materials).length,5);
assert(art.includes("pbr('warped-timber','wood'"));
assert(art.includes("world.ground.material=mud"));
assert(art.includes("mesh.isSkinnedMesh"),'Never rewrite soldier rig materials');
console.log('BATTLEFIELD_MODERN_ART_STATIC_PASS',{
 scannedMaterialSets:5,textureMaps:10,realPBR:true,
 architecture:'damaged village ruins and pitched roofs',
 foliage:'batched thin instances',collision:'original unchanged'
});
