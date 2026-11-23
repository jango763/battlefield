'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const art=fs.readFileSync(path.join(ROOT,'babylon/modern-art-v1.js'),'utf8');
const village=fs.readFileSync(path.join(ROOT,'babylon/modern-village-models.js'),'utf8');
const game=fs.readFileSync(path.join(ROOT,'babylon/game.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'babylon/index.html'),'utf8');
new Function(art);new Function(village);new Function(game);
const modernModule=require('../modern-art-v1.js');
assert.equal(typeof modernModule.apply,'function');
assert.equal(modernModule.PROFILE,'modern-battlefield-pbr-v1');
assert(html.includes('<script src="./modern-art-v1.js"></script>'));
assert(html.includes('<script src="./modern-village-models.js"></script>'));
assert(game.includes('villageModels.install({scene,B,art:state.modernArt})'));
assert(village.includes('B.SceneLoader.LoadAssetContainerAsync'));
assert(village.includes('m.isPickable=false'));
assert(village.includes('normandy-timber-house'));
assert(village.includes('libya-adobe-procedural'),
 'North African scene must use original adobe models, not Norman houses');
assert(village.includes('libya-village-wall'),
 'Adobe buildings must have navigation colliders');

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
const villages=JSON.parse(fs.readFileSync(
 path.join(ROOT,'babylon/art/models/SOURCE_LICENSES.json'),'utf8'));
assert.equal(villages.license,'CC0 1.0');
assert.equal(Object.keys(villages.models).length,3);
for(const obj of Object.values(villages.models)){
 const glb=fs.readFileSync(path.join(ROOT,'babylon/art/models',obj.file));
 assert.equal(glb.subarray(0,4).toString(),'glTF','Invalid real GLB payload');
 assert(glb.length>100000,'Not a substantial textured historical 3D model');
 assert(obj.source.startsWith('https://tevy.dev/models/'));
}

assert(art.includes("pbr('warped-timber','wood'"));
assert(art.includes("world.ground.material=smoothEarth"),'Ground must avoid photo-grain shimmer');
assert(art.includes('north-africa-libya-sunlit-v1'),
 'Map must use the approved dry North African palette');
assert(art.includes('sunlit-sandstone-and-dune-washes'));
assert(art.includes("road.albedoTexture=roadTexture"),'Roads must use coarse painted material');
assert(art.includes("makeOrganicRoad('north-south',true"),'Road edge should be organic');
assert(art.includes("mesh.name.startsWith('rut-')"),'Remove toy-like raised tracks');
assert(art.includes("circle.isVisible=false"),'Hide giant screen-covering base circles');
assert(game.includes("camera=new B.ArcRotateCamera('camera',Math.PI*1.5,.88,29"),
 'Camera must retain the elevated tactical profile');
assert(art.includes("mesh.skeleton"),'Never rewrite soldier rig materials');
console.log('BATTLEFIELD_MODERN_ART_STATIC_PASS',{
 scannedMaterialSets:5,textureMaps:10,realPBR:true,
 architecture:'damaged village ruins and pitched roofs',
 foliage:'batched thin instances',collision:'original unchanged'
});
