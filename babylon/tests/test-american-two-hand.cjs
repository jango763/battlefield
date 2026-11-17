'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('../american-hero-two-hand-ik.js');
const arm=['LeftShoulder','LeftArm','LeftForeArm','LeftHand',
 'RightShoulder','RightArm','RightForeArm','RightHand'];
const rest=['Hips','Spine','Spine1','Spine2','Neck','Head',
 'LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'];
const groups=Array.from({length:4},()=>({
 targetedAnimations:[...arm,...rest].map(name=>({target:{name:'mixamorig:'+name}}))
}));
assert.equal(api.stripArmTracks(groups),32,'Eight arm tracks per clip disabled');
assert(groups.every(g=>g.targetedAnimations.length===12),'Keep all torso and leg motion');
assert(groups.every(g=>g.targetedAnimations.every(a=>
 rest.includes(a.target.name.split(':')[1]))),'All two-hand arm animation conflicts removed');
assert.deepEqual(Object.keys(api.GUNS),
 ['uk-lee-enfield','uk-sten','uk-bren']);
const rig=fs.readFileSync(path.join(__dirname,'../american-hero-two-hand-ik.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../american-hero-two-hand-iphone.html'),'utf8');
assert(!rig.includes('kar98k-user-v2'),'No inherited German grip preset');
assert(!rig.includes('CreateSphere')&&!rig.includes('MeshBuilder'),
 'No supplemental hand or arm meshes');
assert(rig.includes('skeleton.bones.length!==65'),'Original 65 bone skeleton');
assert(rig.includes('displayMeshes.length!==36'),'Keep original skinned 36 meshes');
assert(html.includes('american-hero-two-hand-ik.js'));
assert(!html.includes('weapon-rig-american-qa.js'));
assert(!html.includes('weapon-rig-german-preset-us-qa.js'));
assert(html.includes('Idle_Quaternius')&&html.includes('Sprint_Quaternius'));
console.log('AMERICAN_TWO_HAND_ISOLATION_TESTS_PASS');