'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const game=read('game.js'),art=read('modern-art-v1.js');
const field=read('tactical-field.js'),html=read('index.html');
const old=read('legacy-visual-style.js');
for(const [name,src] of [['game',game],['art',art],['field',field],['legacy',old]])
 new Function(src);
assert.match(art,/scene,false,false,/,'Scanned texture must have mipmaps');
assert.match(art,/t\.anisotropicFilteringLevel=4/);
assert.match(art,/earthWash\(/);
assert.match(art,/id:'hedgerow'/,'Keep the original named shrub layer');
assert.match(art,/function makeDryScrub\(name\)/);
assert.match(art,/new B\.Mesh\(name,scene\)/);
assert.match(art,/shrubSilhouette='faceted-dry-thorn-scrub-v2'/);
assert.match(art,/shrubLobes=lobes\.length/);
assert.match(art,/hedgerow-leaf-west/);
assert.match(art,/hedgerow-leaf-east/);
assert.match(art,/report\.mipmappedScans=true/);
assert.match(art,/terrainStyle='low-frequency-mipmapped-matte'/);
assert.match(art,/north-africa-libya-sunlit-v1/);
assert.match(art,/sandTextureSize=1024/);
assert.match(art,/terrainLandforms='wind-etched-dune-ridges-v1'/);
assert.match(art,/duneRidges=48/);
assert.match(art,/scene\.fogDensity=\.0009/);
assert.match(field,/B\.Mesh\.MergeMeshes\(group,true,true\)/);
assert.match(field,/if\(part\.parent\)/,'Must keep rotating weapon rigs out of static batches');
assert.match(field,/joined\.freezeWorldMatrix\(\)/);
assert.match(field,/optimization\.drawCallsSaved/);
assert.match(field,/indices\.push\(a,b,c,b,d,c\)/, 'Terrain winding must be upward');
assert.match(game,/changeGraphicsMode\(mode\)/);
assert.match(game,/state\.optimization=world\.field\.optimization/);
assert.match(game,/renderQuality\.mode==='auto'/);
assert.match(html,/id="quality-cycle"/);
assert.match(html,/id="view-focus"/);
assert.match(game,/CAMERA_FOV_TACTICAL=\.92,CAMERA_FOV_HERO=\.74/);
assert.match(game,/hero-halo-0/);
assert.match(game,/setHeroCameraFocus\(false\)/);
assert.match(old,/mobile\?512:PROFILE\.shadowMapSize/);
assert.match(html,/\.\/navigation-core\.js/);
assert.match(html,/\.\/emplacements-core\.js/);
assert.match(html,/\.\/tactical-ai\.js/);
const parts=Array.from({length:10},(_,i)=>read(
 'game.parts/'+String(i+1).padStart(2,'0')+'.part'));
assert.equal(parts.join(''),game,'Game parts must match browser entry byte for byte');
const D=require('../defense-layout.js'),N=require('../navigation-core.js');
const layout=D.create(),nav=N.create({obstacles:layout.obstacles});
assert.equal(layout.trenches.length,8);
assert.equal(layout.emplacements.length,4);
for(const w of layout.emplacements)
 assert(layout.obstacles.some(o=>o.id===w.id),'Gun must block passage');
for(const trench of layout.trenches)
 assert(D.heightAt(layout,trench.x,trench.z)<-.8);
assert(nav.clear({x:150,z:70},{x:150,z:90}),'Open central route preserved');
assert.match(art,/roadTexture\.wrapV=B\.Texture\.WRAP_ADDRESSMODE/);
assert.match(art,/mesh\.setVerticesData\(B\.VertexBuffer\.UVKind,uv\)/);
assert.match(art,/dual-ruts-with-meadow-shoulders/);
assert.match(art,/sunlit-sandstone-and-dune-washes/);
require('./test-heading-smoothing.cjs');
require('./test-joystick-response.cjs');
require('./test-infantry-lighting.cjs');
console.log('BATTLEFIELD_STAGE9_STAGE10_STATIC_PASS',{parts:parts.length,
 terrain:'feathered, mipmapped, shrub-thin-instances',guns:layout.emplacements.length,
 trenches:layout.trenches.length,quality:'auto/low/high',
 optimizedEarthworks:'static-only batches'});
