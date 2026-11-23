'use strict';
const assert=require('node:assert/strict');
const Design=require('../defense-layout');
const Field=require('../tactical-field');
const spheres=[],boxes=[];
function mesh(name){
 return {name,position:{set(x,y,z){this.x=x;this.y=y;this.z=z;}},
  rotation:{x:0,y:0,z:0},scaling:{set(x,y,z){this.x=x;this.y=y;this.z=z;}},
  setParent(x){this.parent=x;},freezeWorldMatrix(){this.frozen=true;}};
}
const B={
 Color3:{FromHexString:value=>({value}),Black:()=>({value:'#000'})},
 StandardMaterial:class {constructor(name){this.name=name;}},
 TransformNode:class {constructor(name){Object.assign(this,mesh(name));}},
 Vector3:class {constructor(x,y,z){Object.assign(this,{x,y,z});}},
 VertexData:class {applyToMesh(m){m.terrain=true;}}
};
B.VertexData.ComputeNormals=()=>{};
B.MeshBuilder={
 CreateBox:(name)=>{const v=mesh(name);boxes.push(v);return v;},
 CreateSphere:(name,opts)=>{const v=mesh(name);v.options=opts;spheres.push(v);return v;},
 CreateTorus:name=>mesh(name),CreateLines:name=>mesh(name)
};
B.Mesh={MergeMeshes:(group)=>mesh('merged-'+group.length)};
const layout=Design.create(),added=[],world={ground:mesh('ground'),addObstacle:o=>added.push(o)};
const field=Field.install({B,scene:{},world,layout,design:Design});
const count=layout.fortifications.filter(o=>o.type==='sandbags').length;
assert.equal(spheres.length,15*count,'Sandbag lines must be 8 base + 7 offset sacks');
assert(spheres.every(m=>m.options.segments===8&&m.options.diameter===1),
 'Every sandbag must be rounded and low poly');
assert(spheres.every(m=>m.scaling.x>m.scaling.y&&m.scaling.z>m.scaling.y),
 'Sandbags must have broad low silhouettes');
const row0=spheres.find(m=>m.name.endsWith('-0-0'));
const row1=spheres.find(m=>m.name.endsWith('-1-0'));
assert(Math.abs(row1.position.x-row0.position.x-.67)<1e-8,
 'Rows should be staggered to avoid rectangular slabs');
assert.equal(added.length,layout.obstacles.length,
 'Visual changes must preserve all existing defensive collision boxes');
assert(field.optimization.drawCallsSaved>60,
 'Rounded geometry must still be batched to protect mobile FPS');
assert.equal(field.optimization.mergeErrors.length,0);
console.log('BATTLEFIELD_ROUNDED_SANDBAG_RENDERING_PASS',spheres.length);
