'use strict';
const assert=require('node:assert/strict');
const world=require('../world-300.js');
const economy=require('../gold-economy-core.js');
const map=economy.MAP;
assert.equal(map.size,300);
assert.equal(map.bases.length,2);
assert.equal(map.farms.length,5);
assert.equal(map.pillboxes.length,7);
assert.equal(map.wrecks.length,3);
assert.equal(map.teamsize,12);
assert.equal(economy.FACTIONS.blue.name,'Британцы');
assert.equal(economy.FACTIONS.red.name,'Вермахт');
assert.equal(map.farms.find(f=>f.id==='center').x,150);
assert.equal(map.farms.find(f=>f.id==='center').z,150);
class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 copyFrom(v){this.x=v.x;this.y=v.y;this.z=v.z;return this}
 add(v){return new Vector3(this.x+v.x,this.y+v.y,this.z+v.z)}
 subtract(v){return new Vector3(this.x-v.x,this.y-v.y,this.z-v.z)}
 scale(a){return new Vector3(this.x*a,this.y*a,this.z*a)}
 setAll(v){this.x=v;this.y=v;this.z=v;return this}
}
class Node{
 constructor(name){this.name=name;this.position=new Vector3();this.rotation=new Vector3();
  this.scaling=new Vector3(1,1,1);this.isVisible=true;this.enabled=true}
 dispose(){this.disposed=true}
 setParent(parent){this.parent=parent;return this}
 computeWorldMatrix(){return null}
 setEnabled(enabled){this.enabled=enabled}
 getHierarchyBoundingVectors(){return {min:new Vector3(-3,-1,-2),max:new Vector3(3,2,2)}}
}
class VertexData {
 applyToMesh(m){
  m.hasCustomGeometry=true;
  m.generatedVertices=(this.positions||[]).length/3;
  m.generatedTriangles=(this.indices||[]).length/3;
 }
 static ComputeNormals(positions,indices,normals){normals.push(...positions.map(()=>1))}
}
class Color3 extends Vector3{
 static FromHexString(){return new Color3(1,1,1)}
}
class Material{
 constructor(name){this.name=name;this.diffuseColor=new Color3();
  this.emissiveColor=new Color3();this.specularColor=new Color3()}
}
const drawn=[];
const B={
 Vector3,Color3,StandardMaterial:Material,TransformNode:Node,
 VertexData,Mesh:Node,
 MeshBuilder:{
  CreateBox:name=>{drawn.push(name);return new Node(name)},
  CreateCylinder:name=>{drawn.push(name);return new Node(name)},
  CreateSphere:name=>{drawn.push(name);return new Node(name)},
  CreateGround:name=>{drawn.push(name);return new Node(name)},
  CreateTorus:name=>{drawn.push(name);return new Node(name)}
 },
 SceneLoader:{LoadAssetContainerAsync:async(root,file)=>{
  assert.equal(root,'./assets/');
  assert.equal(file,'btr-convoy-legacy.glb');
  return {meshes:['Object_2','Object_3','Object_4','Object_5'].map(n=>new Node(n)),
   transformNodes:[],addAllToScene(){}}
 }}
};
(async()=>{
 const m=world.create({},B,map);
 assert.equal(m.ground.name,'map-ground-300');
 assert.equal(m.ground.isPickable,true);
 assert(m.isInside(0,0)&&m.isInside(300,300)&&!m.isInside(300.01,0));
 assert.deepEqual(m.fromScene(new Vector3(0,0,0)),{x:150,z:150});
 assert.equal(m.toScene(150,150).x,0);
 assert.equal(m.toScene(150,150).z,0);
 assert(m.inBase(150,25,'blue')&&!m.inBase(150,25,'red'));
 assert(m.inBase(150,275,'red')&&!m.inBase(150,275,'blue'));
 assert.equal(drawn.filter(n=>n.startsWith('farm-house-')).length,5);
 assert.equal(drawn.filter(n=>n.startsWith('pillbox-bunker-')).length,7);
 assert.equal(drawn.filter(n=>n.startsWith('legacy-btr-position-')).length,3);
 assert.equal(drawn.filter(n=>n.startsWith('tree-crown-')).length,0);
 assert.equal(drawn.filter(n=>n.startsWith('tree-top-')).length,0);
 const acacias=m.nodes.filter(n=>n.name.startsWith('north-africa-acacia-crown-'));
 assert.equal(acacias.length,2,'Two shared acacia canopy meshes limit draw calls');
 assert(acacias.every(m=>m.hasCustomGeometry&&m.generatedVertices>700),
  'Authored canopy geometry must have a true multi-lobed relief');
 assert(acacias.every(m=>m.material.disableLighting&&!m.isPickable),
  'Muted sage acacia canopies must remain matte and not block pointer taps');
 assert.equal(drawn.filter(n=>n.startsWith('tree-trunk-')).length,0,
  'Original dark telephone-pole cylinders must be replaced');
 const trunks=m.nodes.filter(n=>n.name.startsWith('north-africa-tree-trunks-'));
 assert.equal(trunks.length,2,'Only two indexed trunk draw batches allowed');
 assert(trunks.every(m=>m.hasCustomGeometry&&m.generatedVertices>500),
  'Tree bark should have real taper and curvature, not box proxies');
 assert(trunks.every(m=>!m.isPickable),'Visual trunks must not intercept taps');
 assert.equal(m.obstacles.filter(o=>o.type==='tree').length,50,
  'Tree-trunk collisions must remain intact');
 assert(drawn.length>0);
 assert(m.nodes.some(x=>x.name==='north-africa-palm-fronds'),
  'One batched palm canopy must replace repetitive spherical forest');
 assert(m.nodes.find(x=>x.name==='north-africa-palm-fronds').hasCustomGeometry,
  'Palm geometry must be low-poly indexed triangles');
 const leaves=m.nodes.find(x=>x.name==='north-africa-palm-fronds');
 assert(leaves.generatedVertices>11000,
  'Palm silhouettes must include individual tapered leaflets');
 assert(leaves.generatedTriangles>4500,
  'Palm leaflets must remain one batched indexed mesh');
 assert.equal(leaves.material.name,'map-palm-leaves');
 assert.equal(leaves.material.disableLighting,true,
  'Date palm leaflets must stay matte olive in the harsh sun');
 const status=await m.loadOriginalBTR();
 assert.equal(status.ok,true);
 assert.equal(status.loaded,3);
 assert.equal(m.getOriginalWreckCount(),3);
 const game=economy.create(),snap=game.summary();
 assert.equal(snap.central.started,false);
 assert.equal(snap.periodicGold.blue,0);
 m.syncFarms(snap);
 console.log('BATTLEFIELD_300_WORLD_MODEL_AND_BTR_IMPORT_TESTS_PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
