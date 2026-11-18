"use strict";
const assert=require("node:assert/strict");
const stage4=require("../british-stage4-stance.js");
const stage3=require("../british-stage3-motion.js");
const roster=require("../british-army-pipeline.js");
assert.equal(roster.STAGES[3],"combat-stance-and-two-hand-ik");
assert.equal(stage4.MOTIONS.length,4);
assert.equal(stage4.ARM_JOINTS.length,8);
const required=Array.from(new Set(stage4.REQUIRED));
function rig(includeAll=true,bonesCount=65){
 const bs=required.concat(Array.from({length:Math.max(0,bonesCount-required.length)},(_,i)=>"extra"+i));
 if(!includeAll)bs.splice(bs.indexOf("weapon_r"),1);
 return {skeletons:[{bones:bs.slice(0,bonesCount).map(name=>({
  name:"mixamorig:"+name,getTransformNode(){return {name:"mixamorig:"+name}}
 }))}]};
}
const valid=stage4.inspect(rig());
assert.equal(valid.ok,true);
assert.equal(valid.bones,65);
assert.equal(stage4.inspect(rig(false)).ok,false);
assert(stage4.inspect(rig(false)).missing.includes("weapon_r"));
assert.equal(stage4.inspect(rig(true,60)).ok,false);
assert.equal(stage4.inspect({skeletons:[]}).ok,false);
assert.equal(stage4.inspect({skeletons:[{bones:[]},{bones:[]}]}).ok,false);
function clip(name,arms=stage4.ARM_JOINTS){
 return {name,targetedAnimations:arms.map(name=>({target:{name:"mixamorig:"+name}}))};
}
const scene={animationGroups:stage4.MOTIONS.map(name=>
 clip("british-control-"+name))};
const groups=stage4.mappedGroups(scene,"control");
assert.equal(groups.length,4);
assert.throws(()=>stage4.mappedGroups({animationGroups:scene.animationGroups.slice(1)},"control"));
assert.throws(()=>stage4.mappedGroups({animationGroups:[
 ...scene.animationGroups.slice(0,3),clip("british-control-Sprint_Quaternius",stage4.ARM_JOINTS.slice(0,7))
]},"control"),/32/);
const stage={rotation:{y:0},computeWorldMatrix(){}};
const muzzle={getMuzzleWorld(){return {position:[0,1.1,0],
 direction:[Math.sin(stage.rotation.y),0,Math.cos(stage.rotation.y)]}}};
const behind=stage4.aimAt({stage,rig:muzzle,target:{id:"b",x:0,z:-3.2}});
assert(behind.barrelDot>.999);
assert(Math.abs(stage.rotation.y-Math.PI)<.01);
const left=stage4.aimAt({stage,rig:muzzle,target:{id:"l",x:-1,z:-3.2}});
assert(left.barrelDot>.999);
assert.equal(left.targetId,"l");
assert.throws(()=>stage4.aimAt({stage,rig:muzzle,target:{x:Infinity,z:0}}));
assert.throws(()=>stage4.aimAt({stage,rig:{getMuzzleWorld:()=>({
 position:[0,1,0],direction:[0,1,0]})},target:{x:0,z:3}}));
const quality=stage4.gripQuality({rightGripMeters:.012,leftGripMeters:.02,
 stockToShoulderMeters:.09,armChannelsRemoved:32,
 socketLocalDriftMeters:0,socketLocalRotationErrorDeg:0},
 {attached:true,parent:"mixamorig:Weapon_R"});
assert.equal(quality.ok,true);
assert.equal(stage4.gripQuality({rightGripMeters:.5,leftGripMeters:.5,
 stockToShoulderMeters:.25,armChannelsRemoved:24},
 {attached:false,parent:null}).ok,false);
assert.equal(stage3.CLIPS.sprint,"Sprint_Quaternius");
console.log("BRITISH_STAGE4_STANCE_CONTRACT_PASS",JSON.stringify({
 heroRigBones:65,requiredLinkedJoints:required.length,
 animatedArmChannels:32,barrelDot:behind.barrelDot,sideTargetDot:left.barrelDot,
 rigidWeaponParent:quality.socketParent
}));
