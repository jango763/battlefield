#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const file="assets/allied-soldiers/uk-jakeli-prototype-65b.glb",bytes=fs.readFileSync(file);
assert.equal(bytes.toString("ascii",0,4),"glTF");
assert.equal(bytes.readUInt32LE(8),bytes.length);
const j=JSON.parse(bytes.toString("utf8",20,20+bytes.readUInt32LE(12)));
assert.equal(j.skins.length,1);
assert.equal(j.skins[0].joints.length,65);
assert.equal(j.animations.length,4);
assert.deepEqual(j.animations.map(x=>x.name),["Idle_Quaternius","Walk_Quaternius","Jog_Quaternius","Sprint_Quaternius"]);
assert.equal(j.meshes.length,14,"The 14 source British mesh definitions must stay preserved");
assert.equal(j.materials.length,14,"The original British material identity must be retained");
assert.equal(j.textures.length,27,"The original textured outfit is required");
assert(j.asset.extras?.jakeliPrototype?.noHeroMeshes);
assert(j.asset.extras?.jakeliPrototype?.notGameReady);
const rigMeshNodes=j.nodes.filter(n=>n.skin===0&&n.mesh!==undefined);
assert.equal(rigMeshNodes.length,13,"Exactly 13 original meshes must be displayed (embedded Springfield excluded)");
let skinned=0,vertices=0;
for(const node of rigMeshNodes){
 assert(!/springfield|rifle/i.test(j.meshes[node.mesh].name),"Original embedded rifle must not conflict with weapons");
 for(const p of j.meshes[node.mesh].primitives){
  const at=p.attributes;
  for(const k of ["POSITION","NORMAL","JOINTS_0","WEIGHTS_0"])assert(Number.isInteger(at[k]),"Missing "+k);
  const a=j.accessors[at.POSITION],weights=j.accessors[at.WEIGHTS_0],joints=j.accessors[at.JOINTS_0];
  assert.equal(a.count,weights.count);assert.equal(a.count,joints.count);
  assert.equal(weights.componentType,5126);assert.equal(joints.componentType,5121);
  const wview=j.bufferViews[weights.bufferView],jview=j.bufferViews[joints.bufferView],
   bin=20+bytes.readUInt32LE(12)+8,wm=(wview.byteOffset||0)+(weights.byteOffset||0),
   jm=(jview.byteOffset||0)+(joints.byteOffset||0);
  for(let i=0;i<a.count;i++){
   let sum=0;
   for(let c=0;c<4;c++){
    const w=bytes.readFloatLE(bin+wm+i*16+c*4),bone=bytes.readUInt8(bin+jm+i*4+c);
    assert(Number.isFinite(w)&&w>=0&&w<=1,"Malformed weight");
    assert(bone<65,"Invalid bone index");sum+=w;
   }
   assert(Math.abs(sum-1)<0.0001,"Unnormalized British vertex weight");
  }
  vertices+=a.count;skinned++;
 }
}
assert(vertices>40000,"A placeholder or partial model is not acceptable");
const nodesWithAnimation=new Set();
for(const a of j.animations)for(const ch of a.channels){
 assert(j.skins[0].joints.includes(ch.target.node),"Animation does not target the 65-bone British rig");
 nodesWithAnimation.add(ch.target.node);
}
assert(nodesWithAnimation.size>=20);
console.log("JAKELI_REAL_MESH_RIG_STRUCTURAL_PASS",JSON.stringify({skinnedParts:skinned,
 skinnedVertices:vertices,bones:65,animations:j.animations.map(x=>x.name),
 textures:j.textures.length,bytes:bytes.length,
 sha256:crypto.createHash("sha256").update(bytes).digest("hex"),
 releaseCertified:false,safariCertified:false}));
