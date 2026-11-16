'use strict';
const assert=require('node:assert/strict');
const loader=require('../allied-asset-loader.js');
const catalog=require('../allied-model-catalog.js');
const manifest=require('../../assets/allied-soldiers/manifest.json');
assert.equal(loader.CLIPS.length,16);
assert.equal(loader.REQUIRED.length,20);
assert(loader.validateManifest(manifest,catalog));
assert.deepEqual(Object.keys(manifest.models).sort(),catalog.IDS.slice().sort());
const bad=JSON.parse(JSON.stringify(manifest));
bad.models.britishFab.installed=true;
assert.throws(()=>loader.validateManifest(bad,catalog),/Uncleared/);
const badPath=JSON.parse(JSON.stringify(manifest));
badPath.models.americanHero.file='../secret.glb';
assert.throws(()=>loader.validateManifest(badPath,catalog),/Unsafe/);
const boneNames=[...loader.REQUIRED,...Array.from({length:45},(_,i)=>'Extra'+i)];
const boneMap=boneNames.map(name=>({
 name,getTransformNode(){return {name:'mixamorig:'+name,rotationQuaternion:{}};}
}));
const rifle={name:'Lee Enfield rifle',skeleton:null,isVisible:true,
 getTotalVertices:()=>300,getTotalIndices:()=>900,setEnabled(value){this.enabled=value}};
const human={name:'British soldier skinned mesh',skeleton:{bones:boneMap},
 getTotalVertices:()=>18000,getTotalIndices:()=>54000};
const entries={meshes:[human,rifle],skeletons:[{bones:boneMap}]};
let inspected=loader.inspect(entries,{maxTriangles:20000});
assert(inspected.ok,inspected.issues.join('; '));
assert.equal(inspected.bones,65);
assert.deepEqual(loader.hideEmbeddedWeapons(entries),['Lee Enfield rifle']);
assert.equal(rifle.isVisible,false);
assert.notEqual(human.isVisible,false);
inspected=loader.inspect(entries,{maxTriangles:10000});
assert(!inspected.ok&&inspected.issues.some(x=>x.includes('Слишком тяжёлая')));
const still={meshes:[{name:'static soldier',getTotalVertices:()=>2500,getTotalIndices:()=>7500}],
 skeletons:[]};
assert(!loader.inspect(still).ok,'Static model cannot be accepted as animated infantry');
const noHands={meshes:[human],skeletons:[{bones:boneMap.filter(b=>!b.name.includes('LeftHand'))}]};
assert(!loader.inspect(noHands).ok);
const clips=loader.CLIPS.map(name=>({
 name,targetedAnimations:boneMap.map(b=>({target:{name:'mixamorig:'+b.name}}))
}));
assert.equal(loader.sourceClips(clips).size,16);
assert.throws(()=>loader.sourceClips(clips.slice(0,15)),/missing/);
const created=[];
class Avatar{
 constructor(_name,_node){}
 retargetAnimationGroup(source,options){
  assert(options.retargetAnimationKeys);
  assert(options.fixAnimations);
  assert(options.mapNodeNames.size>=20);
  const group={name:options.animationGroupName,
   targetedAnimations:source.targetedAnimations,
   stop(){},dispose(){}};
  created.push(group);return group;
 }
}
const generated=loader.retarget({AnimatorAvatar:Avatar},{},clips,inspected.rig,'test');
assert.equal(generated.length,16);
assert.equal(created.length,16);
assert(generated.every(x=>x.name.startsWith('allied-test-')));
const limits={rightMaxMeters:.06,leftMaxMeters:.06,stockMaxMeters:.15};
assert(loader.gripAssessment({weapon:'uk-sten',rightGripMeters:.01,
 leftGripMeters:.02,stockRightShoulderMeters:.08},'uk-sten',limits).ok);
assert(!loader.gripAssessment({weapon:'uk-sten',rightGripMeters:.09,
 leftGripMeters:.01,stockRightShoulderMeters:.08},'uk-sten',limits).ok);
assert(!loader.gripAssessment({weapon:'de-kar98k',rightGripMeters:.01,
 leftGripMeters:.01},'uk-lee-enfield',limits).ok);
const store=loader.create({B:{SceneLoader:{}},scene:{},catalog,
 sourceGroups:clips,fetchManifest:async()=>manifest});
store.init().then(async status=>{
 assert(!Object.values(status).some(x=>x.installed));
 assert.equal(await store.instantiate('americanHero',0),null);
 assert.equal(await store.instantiate('britishDanoob',1),null);
 console.log('ALLIED_ASSET_LOADER_RETARGET_AND_GRIP_CHECKS_PASS');
}).catch(e=>{console.error(e);process.exitCode=1});
