"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const rig=require("../us-hero-ara-lee-enfield-stage4.js");
const names=["LeftShoulder","LeftArm","LeftForeArm","LeftHand",
 "RightShoulder","RightArm","RightForeArm","RightHand"];
const legs=["Hips","Spine","Spine1","Spine2","Neck","Head",
 "LeftUpLeg","LeftLeg","LeftFoot","RightUpLeg","RightLeg","RightFoot"];
const groups=Array.from({length:4},()=>({targetedAnimations:
 [...names,...legs].map(n=>({target:{name:"mixamorig:"+n}}))}));
assert.equal(rig.stripArmTracks(groups),32);
assert(groups.every(g=>g.targetedAnimations.length===12));
assert(groups.every(g=>g.targetedAnimations.every(t=>legs.includes(t.target.name.split(":")[1]))));
assert.deepEqual(Object.keys(rig.DONOR),["ready","aim"]);
for(const phase of Object.values(rig.DONOR))
 for(const hand of [phase.right,phase.left]){
  assert.equal(hand.dir.length,3);assert.equal(hand.palm.length,3);
  assert.equal(hand.pole.length,3);
  assert(Math.hypot(...hand.dir)>.9);
 }
const script=fs.readFileSync(path.join(__dirname,"../us-hero-ara-lee-enfield-stage4.js"),"utf8");
const page=fs.readFileSync(path.join(__dirname,"../us-hero-lee-enfield-ara-stage4-iphone.html"),"utf8");
assert(!script.includes("MeshBuilder"),"No duplicate hand meshes");
assert(script.includes("const localBasis=handWorld.conjugate().multiply(srcBasis)"),"Uses real finger-bone anatomical calibration");
assert(script.includes("const lSolve=solveLimb("),"Separate IK per arm");
assert(page.includes('"us-hero-quaternius.glb"'),"Model autoload, no picker");
assert(!page.includes('type="file"'),"No manual picker");
assert(page.includes("us-hero-ara-lee-enfield-stage4.js"),"Stage4 rig included");
assert(page.includes('weaponRoot:"../assets/ww2-weapons/"'));
assert(page.includes('Idle_Quaternius'),"Quaternius idle remains");
console.log("US_HERO_LEE_ENFIELD_STAGE4_STATIC_PASS");