'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const L=require('../infantry-lighting-core.js');
let lights=0;
class Hemi {
 constructor(name,direction,scene){
  this.name=name;this.direction=direction;this.scene=scene;lights++;
  this.includedOnlyMeshes=[];this.enabled=true;
 }
 setEnabled(v){this.enabled=v;}
}
const B={HemisphericLight:Hemi,Color3:{FromHexString:hex=>({hex})},
 Vector3:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z}}};
const world={id:'terrain',getTotalVertices:()=>30};
const soldier=tag=>({tag,getTotalVertices:()=>300,material:{baseColor:tag}});
const a=soldier('german'),b=soldier('british'),c=soldier('reinforcement');
const originalMaterials=[a.material,b.material,c.material];
const fill=L.create({B,scene:{}});
assert.equal(fill.light.enabled,false,'Unscoped fill must not light the map');
assert.equal(fill.light.includedOnlyMeshes.length,0);
assert.equal(fill.track([a,b,a,null,world].filter(x=>x!==world)),2);
assert.equal(fill.light.enabled,true);
assert.deepEqual(fill.light.includedOnlyMeshes,[a,b]);
assert.equal(fill.track([a,b]),0,'Do not duplicate the same mesh');
assert.equal(fill.track([c]),1,'Reinforcements must get the same fill');
assert.deepEqual(fill.light.includedOnlyMeshes,[a,b,c]);
assert(!fill.light.includedOnlyMeshes.includes(world),'Environment excluded');
assert.deepEqual([a.material,b.material,c.material],originalMaterials,
 'Lighting must not retint approved 3D GLB materials');
assert.equal(fill.snapshot().trackedMeshes,3);
assert.equal(fill.snapshot().worldIllumination,false);
assert.equal(fill.snapshot().modifiedImportedMaterials,0);
assert.equal(lights,1,'No per-soldier lights permitted');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.indexOf('src="./infantry-lighting-core.js"')<
 html.indexOf('src="./game.js"'),'Lighting core must load before game');
assert(game.includes('infantryFill.track(drawable)'));
assert(game.includes('state.infantryLighting=infantryFill.snapshot()'));
console.log('BATTLEFIELD_INFANTRY_ONLY_LIGHT_PASS');
