"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const audit=require("../british-stage2-rig-audit.js");
const pipeline=require("../british-army-pipeline.js");
const catalog=require("../allied-model-catalog.js");
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,
 "../../assets/allied-soldiers/manifest.json"),"utf8"));
const required=audit.REQUIRED;
function skeleton(boneCount=65,linked=true){
 const bones=Array.from({length:boneCount},(_,i)=>{
  const name="mixamorig:"+(required[i]||"Extra"+i);
  return {name,getTransformNode:()=>linked?({name}):null};
 });
 return {bones};
}
function mesh(skel,weights=[1,0,0,0,1,0,0,0,1,0,0,0],
 indices=[0,0,0,0,1,0,0,0,2,0,0,0],name="Soldier_Body"){
 return {name,skeleton:skel,
  getTotalVertices:()=>3,getTotalIndices:()=>3,
  getVerticesData:kind=>({matricesWeights:weights,matricesIndices:indices})[kind]||null};
}
function inspect(boneCount=65,weights,indices){
 const skel=skeleton(boneCount);
 return audit.audit({meshes:[mesh(skel,weights,indices)],skeletons:[skel]});
}
const valid=inspect();
assert.equal(valid.bones,65);
assert.equal(valid.skinnedMeshes,1);
assert.equal(valid.triangles,1);
assert.equal(valid.checkedVertices,3);
assert.equal(valid.invalidVertices,0);
assert.equal(valid.rigCompatible,true);
assert.equal(valid.needsHeadwearVisualApproval,true);
assert.equal(valid.readyForGameplay,false);
assert(valid.warnings.some(w=>w.includes("каска")));
const beret=audit.audit({meshes:[mesh(skeleton())],skeletons:[skeleton()]},
 {role:"commando"});
assert.equal(beret.expectedHeadwear,"берет");
assert.equal(beret.readyForGameplay,false);
// Wrong source rig cannot be misrepresented as the approved 65-bone skeleton.
const not65=inspect(54);
assert.equal(not65.rigCompatible,false);
assert(not65.problems.some(x=>x.includes("65-костным")));
// Detect missing skinning streams, bad weights and out-of-range JOINTS.
const skel=skeleton();
const bare=mesh(skel);bare.getVerticesData=()=>null;
const noWeights=audit.audit({meshes:[bare],skeletons:[skel]});
assert.equal(noWeights.rigCompatible,false);
assert.equal(noWeights.missingStreams,1);
assert.equal(inspect(65,[.5,0,0,0,1,0,0,0,1,0,0,0]).invalidVertices,1);
assert.equal(inspect(65,[1,0,0,0,1,0,0,0,1,0,0,0],
 [65,0,0,0,1,0,0,0,2,0,0,0]).invalidVertices,1);
const unskinned=audit.audit({meshes:[mesh(null)],skeletons:[skel]});
assert.equal(unskinned.rigCompatible,false);
const multiple=audit.audit({meshes:[mesh(skel)],skeletons:[skel,skeleton()]});
assert.equal(multiple.rigCompatible,false);
assert.throws(()=>audit.audit({meshes:[],skeletons:[]},{role:"unknown"}));
// One approved role might need a beret and another a steel helmet; never
// count the previous hero rig or a fabricated model as a licensed British GLB.
const availableFiles=["assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb"];
const rows=pipeline.auditModels({catalog,manifest,presentFiles:availableFiles});
assert(rows.every(x=>x.filePresent===false));
assert(rows.every(x=>x.ready===false));
console.log("BRITISH_STAGE2_RIG_AUDIT_PASS",JSON.stringify({
 tested:9,approvedBoneCount:audit.TARGET_BONES,headwearRoles:Object.keys(audit.ROLES),
 originalBritishAssetsPresent:rows.filter(x=>x.filePresent).length,
 status:"QA ready; British meshes pending original source GLB"
}));
