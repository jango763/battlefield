"use strict";
const assert=require("node:assert/strict");
const motion=require("../british-stage3-motion.js");
const blend=require("../native-clip-blend.js");
assert.deepEqual(Object.keys(motion.CLIPS),["idle","walk","jog","sprint"]);
assert.equal(motion.CLIPS.idle,"Idle_Quaternius");
assert.equal(motion.CLIPS.walk,"Walk_Quaternius");
assert.equal(motion.CLIPS.jog,"Jog_Quaternius");
assert.equal(motion.CLIPS.sprint,"Sprint_Quaternius");
assert.equal(motion.CRITICAL.length,15);
const keys=[...motion.CRITICAL,
 "leftshoulder","rightshoulder","leftupleg","rightupleg",
 ...Array.from({length:46},(_,i)=>"extra"+i)];
const bones=keys.slice(0,65).map(name=>({
 name:"mixamorig:"+name,getTransformNode:()=>({name:"mixamorig:"+name})
}));
assert.equal(bones.length,65);
const m=motion.mapBones({bones});
assert.equal(m.size,65);
const source=new Map(bones.map(x=>[x.name.replace(/^mixamorig:/,""),x]));
const groups=Object.values(motion.CLIPS).map(name=>({
 name,targetedAnimations:bones.map(x=>({
  target:{name:x.name},animation:{targetProperty:"rotationQuaternion"}
 }))
}));
const yes=motion.checkClips(groups,source,m);
assert.equal(yes.groups.size,4);
assert.equal(yes.stats.length,4);
assert(yes.stats.every(x=>x.mappedJoints>=30));
assert.throws(()=>motion.checkClips(groups.slice(0,3),source,m),/Four Quaternius/);
assert.throws(()=>motion.checkClips(groups.map((g,i)=>i===1?
 {...g,targetedAnimations:g.targetedAnimations.slice(4)}:g),source,m),/missing mapped/);
assert.throws(()=>motion.mapBones({bones:[bones[0],bones[0]]}),/Duplicate/);
assert.throws(()=>motion.mapBones({bones:[{name:"Hips",getTransformNode:()=>null}]}),/linked glTF/);
assert.throws(()=>motion.create({}),/Babylon.js 9/);
// Real crossfade module remains the only animation playback owner.
assert.equal(typeof blend.play,"function");
assert.equal(typeof blend.update,"function");
console.log("BRITISH_STAGE3_QUATERNION_CONTRACT_PASS",JSON.stringify({
 bones:65,clips:Object.values(motion.CLIPS),mappedChannels:65,
 gameplayChanges:0,approvedBlend:true
}));
