'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const wrapper=read('preview/formation-replenishment-v3.html');
const pass=read('preview/visual-boost-v1.js');
const worldArt=read('preview/ww2-structure-materials-v1.js');
new Function(worldArt);
const script=wrapper.match(/<script>([\s\S]*?)<\/script>/);
assert(script,'Approved old Three.js loader must remain present');
new Function(script[1]);
new Function(pass);
assert(wrapper.includes("graphics!=='original'"),'Original graphics bypass missing');
assert(wrapper.includes('visual-boost-v1.js?v=20261121-r2'));
assert(wrapper.includes('if(visualPass&&graphics!=='),'Feature should be opt-in to the safe injection');
assert(wrapper.includes('const graphicUpgrade=get('));
assert(wrapper.includes("return null;"),'Missing fallback when optional visuals fail');
assert(wrapper.includes('if(window.__BF_VISUAL_DECORATE_RUINS__)'));
assert(pass.includes('window.__BATTLEFIELD_VISUAL_BOOST__'));
assert(pass.includes('gr.material.map=texture'),'Ground mesh must be kept, only its material updated');
assert(pass.includes('scene.add(inst)'),'Instanced vegetation required');
assert(pass.includes('sun.castShadow=true')&&pass.includes('if(!mobile)'),
 'Full-resolution shadow map must be desktop-only');
const parts=Array.from({length:17},(_,i)=>read(
 'preview/parts/german-'+String(i).padStart(3,'0')+'.txt'));
const base=parts.join('');
const unique=[
 'gr.rotation.x=-Math.PI/2;scene.add(gr);',
 'for(let i=0;i<14;i++)ruin(rnd(-50,50),rnd(-60,60));',
 "tex('#6a553c',['#5a4630','#7a6448','#3a2c1e'],160,[24,1])"
];
for(const anchor of unique){
 assert.equal(base.split(anchor).length,2,
  'Original engine changed: visual-only splice anchor missing or duplicated '+anchor);
}
for(const name of ['guardUpdate','fogUpdate','dustUpdate','camUpdate',
 'SaveState','TANKS','R.render(scene,cam)']){
 assert(base.includes(name),'Approved original gameplay missing '+name);
}
assert(wrapper.includes("const texturedWorld=get('ww2-structure-materials-v1.js?v=20261121-2')"),
 'Actual surface texture source must be loaded');
assert(wrapper.includes("'HD · ТЕКСТУРЫ ЗДАНИЙ'"),'Visual mode label missing');
assert(wrapper.includes("'+(materialPass||'')"),'Texture pass not injected');
for(const material of ['plaster-brick','burnt-brick','weathered-concrete',
 'splintered-wood','broken-masonry'])
 assert(worldArt.includes(material),'Missing actual WWII art texture '+material);
assert(worldArt.includes('new THREE.CanvasTexture(canvas)'));
assert(worldArt.includes('new THREE.MeshStandardMaterial({map:tex'));
assert(worldArt.includes('window.__BF_VISUAL_DECORATE_RUINS__=function(){'));
assert(worldArt.includes('report.texturedWalls+=changed'));
assert(worldArt.includes("sandbag:image('sandbag-cloth'"),'Sandbag textures missing');
assert(worldArt.includes('window.__BF_WORLD_TEXTURE_SITES__=function'), 'Structures texture hook missing');
assert(worldArt.includes('window.__BF_WORLD_ART_TICK__=function'), 'Occluded-structure fade missing');
assert(wrapper.includes("window.__BF_WORLD_TEXTURE_SITES__"),'Structure texture hook not called');
assert(wrapper.includes("window.__BF_WORLD_ART_TICK__?.()"),'Cutaway graphics hook not called');
assert(base.includes("mkPoint('m',0,-50);mkPoint('m',0,50);"),'Objectives absent');
assert(base.includes('camUpdate(dt);hud();ambient(now/1000);mmap();R.render(scene,cam)'),
 'Native camera callback cannot be decorated');
console.log('BATTLEFIELD_THREEJS_VISUAL_UPGRADE_STATIC_PASS',{
 sourceBytes:base.length,visualBytes:pass.length,
 loaderUntouched:wrapper.includes('for(const unit of'),nativeGuard:pass.includes('mobile')
});
