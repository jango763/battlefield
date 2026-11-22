'use strict';
/* Unit-only deterministic contract test. No map, economy or gameplay QA. */
const assert=require('node:assert/strict');
const motion=require('../unit-motion-unifier.js');
const names=motion.REQUIRED;
class Vec{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 subtract(b){return new Vec(this.x-b.x,this.y-b.y,this.z-b.z)}
 add(b){return new Vec(this.x+b.x,this.y+b.y,this.z+b.z)}
 scale(n){return new Vec(this.x*n,this.y*n,this.z*n)}
 clone(){return new Vec(this.x,this.y,this.z)}
 length(){return Math.hypot(this.x,this.y,this.z)}
}
const positions={
 leftarm:new Vec(0,0,0),leftforearm:new Vec(.10,0,0),lefthand:new Vec(.30,0,0),
 rightarm:new Vec(0,0,0),rightforearm:new Vec(-.10,0,0),righthand:new Vec(-.30,0,0)
};
const title=n=>n[0].toUpperCase()+n.slice(1);
function skeleton(omit=[]){
 const bones=[...names,...Array.from({length:46},(_,i)=>'finger'+i)]
  .filter(n=>!omit.includes(n)).map(n=>{
   const name='mixamorig'+title(n);
   const node={name,getAbsolutePosition:()=>positions[n]||new Vec(0,0,0)};
   return {name,getTransformNode:()=>node};
  });
 return {bones};
}
function clip(name){
 return {name,targetedAnimations:names.map(n=>({
  target:{name:'mixamorig'+title(n)},animation:{targetProperty:'rotationQuaternion'}
 }))};
}
const german=clip('Kar98k_Run'),british=clip('Ready');
const B={
 AnimatorAvatar:class {
  retargetAnimationGroup(g,{mapNodeNames}){
   assert(mapNodeNames.size>=19,'Full canonical joint map required');
   return {name:'retarget-'+g.name,
    targetedAnimations:[...mapNodeNames.values()].map(name=>({target:{name}})),
    stop(){},dispose(){}};
  }
 }
};
assert.equal(motion.canonical('Armature|mixamorigLeftForeArm-3'),'leftforearm');
assert.equal(motion.findGroup([{name:'Ready-12'}],'Ready').name,'Ready-12');
assert.equal(motion.targetRig([skeleton()]).ok,true);
assert.equal(motion.targetRig([skeleton(['lefthand'])]).ok,false);
const reach=motion.armReach([skeleton()],'left');
assert(reach.ok&&Math.abs(reach.maxReach-.294)<1e-8);
const grip=motion.clampGrip([skeleton()],'left',new Vec(.5,0,0),Vec);
assert(grip.ok&&grip.clipped&&Math.abs(grip.target.x-.294)<1e-8);
const made=motion.retarget({B,sourceGroup:german,targetRoot:{},
 skeletons:[skeleton()],tag:'soldier'});
assert(made.ok&&made.joints>=19,'Valid donor clip must be mapped');
const reduced=motion.legsOnly(made.group);
assert(reduced.ok&&reduced.kept===7&&reduced.removed===12,'Donor may drive legs, NEVER the hands');
const all=new Map(motion.WEAPONS.flatMap(w=>['Run','Hold','Aim','Fire']
 .map(p=>[w+'_'+p,{name:'native-'+w+'-'+p}])));
const view={root:{},imported:{skeletons:[skeleton()]},clips:all,index:3,
 importedAlliedName:'americanHero'};
const originalSmg=all.get('MP40_Run'),originalAim=all.get('Kar98k_Aim');
const result=motion.install(view,{B,germanRun:german,britishReady:british});
assert(result.ok&&result.transferred===1,'Only donor leg motion should map');
assert.equal(view.unifiedMotionReports.run.status,'legs-only');
assert.equal(view.unifiedMotionReports.ready.status,'native-weapon-stance');
assert.notEqual(view.clips.get('Kar98k_Run').name,'native-Kar98k-Run');
assert.equal(view.clips.get('Kar98k_Hold').name,'native-Kar98k-Hold','Do not replace American ready and hands with British pose');
assert.equal(view.clips.get('MP40_Run'),originalSmg,'Preserve SMG authored grip');
assert.equal(view.clips.get('Kar98k_Aim'),originalAim,'Do not overwrite aim');
assert.equal(motion.install(view,{B,germanRun:german,britishReady:british}).transferred,0,
 'Idempotent install cannot create duplicate rigs');
const faulty={root:{},imported:{skeletons:[skeleton(['rightarm'])]},index:5,
 importedAlliedName:'britishJakeli',clips:new Map(all)};
const fail=motion.install(faulty,{B,germanRun:german,britishReady:british});
assert(fail.ok&&fail.reports.run.status==='native-fallback','Invalid rigs retain native clips');
assert.equal(faulty.clips.get('Kar98k_Run'),all.get('Kar98k_Run'));
assert(!view.unifiedMotionGroups.get('legs:Kar98k_Run').targetedAnimations.some(t=>/arm|hand|shoulder|spine/i.test(t.target.name)));
assert.equal(british.targetedAnimations.length,19,'British rig remains untouched');
console.log('BATTLEFIELD_UNIT_MOTION_UNIFIER_TEST_PASS');
