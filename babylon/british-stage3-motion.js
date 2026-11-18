/* Battlefield · British army stage 3: real Babylon.js 9 avatar retargeting.
 * Reuses the approved Quaternius hero source and existing native crossfader.
 * Does not label the hero mesh as a British asset; never changes gameplay.
 * Source rig and target skinned GLB remain distinct until retarget is complete.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldBritishStage3Motion=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const CLIPS=Object.freeze({
  idle:"Idle_Quaternius",walk:"Walk_Quaternius",
  jog:"Jog_Quaternius",sprint:"Sprint_Quaternius"
 });
 const CRITICAL=Object.freeze([
  "hips","spine","head","leftarm","leftforearm","lefthand",
  "rightarm","rightforearm","righthand","leftupleg","leftleg","leftfoot",
  "rightupleg","rightleg","rightfoot"
 ]);
 const norm=name=>String(name||"").replace(/^mixamorig[:_]?/i,"")
  .replace(/_\d+$/,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
 const namedBone=b=>b?.getTransformNode?.()?.name||b?.name||"";
 function mapBones(skeleton){
  if(!skeleton?.bones?.length)throw Error("Missing skinned 65-bone target");
  const mapping=new Map();
  for(const bone of skeleton.bones){
   const key=norm(namedBone(bone));
   if(!key||mapping.has(key))throw Error("Duplicate or unnamed bone "+key);
   if(!bone.getTransformNode?.())throw Error("Bone without linked glTF joint: "+key);
   mapping.set(key,bone);
  }
  for(const key of CRITICAL)if(!mapping.has(key))
   throw Error("Missing critical British joint "+key);
  return mapping;
 }
 function checkClips(sourceGroups,sourceBones,targetBones){
  if(!Array.isArray(sourceGroups))throw Error("Source animationGroups missing");
  const src=new Map();
  for(const g of sourceGroups)if(g&&Object.values(CLIPS).includes(g.name)){
   if(src.has(g.name))throw Error("Duplicate approved Quaternius clip "+g.name);
   src.set(g.name,g);
  }
  if(src.size!==4)throw Error("Four Quaternius locomotion clips are required: "+
   Object.values(CLIPS).filter(c=>!src.has(c)).join(","));
  const stats=[];
  for(const [motion,name] of Object.entries(CLIPS)){
   const group=src.get(name),matched=new Set(),absent=new Set();
   for(const ta of group.targetedAnimations||[]){
    const key=norm(ta.target?.name);
    if(!key||!sourceBones.has(key))continue;
    if(!targetBones.has(key))absent.add(key);
    else matched.add(key);
   }
   const unanimated=CRITICAL.filter(key=>!matched.has(key));
   if(absent.size||unanimated.length)
    throw Error(name+" missing mapped/animated joints: "+
     [...absent,...unanimated].join(","));
   if(matched.size<18)throw Error(name+" has too few animation joints: "+matched.size);
   stats.push(Object.freeze({motion,name,sourceChannels:group.targetedAnimations.length,
    mappedJoints:matched.size}));
  }
  return {groups:src,stats:Object.freeze(stats)};
 }
 function create({B,scene,source,target,avatarRoot,blend,role="infantry",tag="british"}={}){
  if(!B?.AnimatorAvatar||!B?.SceneLoader||!scene||!avatarRoot)
   throw Error("Requires Babylon.js 9 AnimatorAvatar, scene and avatarRoot");
  if(!blend?.play||!blend?.update||!blend?.stop)
   throw Error("Approved BattlefieldNativeClipBlend is required");
  if(!["infantry","commando","control"].includes(role))
   throw Error("Unknown British role");
  if(source?.skeletons?.length!==1||target?.skeletons?.length!==1||
   source.skeletons[0]===target.skeletons[0])
   throw Error("Source and target must be separate, single-skinned rigs");
  if(source.skeletons[0].bones.length!==65||
    target.skeletons[0].bones.length!==65)
   throw Error("Retargeting needs the approved 65-bone architecture");
  const sourceBones=mapBones(source.skeletons[0]);
  const targetBones=mapBones(target.skeletons[0]);
  const {groups,stats}=checkClips(source.animationGroups,sourceBones,targetBones);
  const mapNodeNames=new Map();
  for(const group of groups.values()){
   for(const ta of group.targetedAnimations||[]){
    const key=norm(ta.target?.name),to=targetBones.get(key);
    if(to)mapNodeNames.set(ta.target.name,to.name);
   }
  }
  // Source animation must be at REST before Avatar keyframe compensation.
  for(const g of source.animationGroups)g.stop();
  for(const g of target.animationGroups||[])g.stop();
  source.skeletons[0].returnToRest();
  target.skeletons[0].returnToRest();
  const avatar=new B.AnimatorAvatar("british-stage3-"+tag,avatarRoot);
  const output=new Map();
  try{
   for(const {motion,name} of stats){
    const original=groups.get(name);
    const hips=(original.targetedAnimations||[]).find(
     x=>norm(x.target?.name)==="hips")?.target?.name;
    if(!hips)throw Error(name+" has no root Hips");
    const group=avatar.retargetAnimationGroup(original,{
     animationGroupName:"british-"+tag+"-"+name,
     mapNodeNames,rootNodeName:hips,
     retargetAnimationKeys:true,fixRootPosition:true,
     fixGroundReference:false,fixAnimations:true,
     checkHierarchy:false
    });
    const outputJoints=new Set((group.targetedAnimations||[]).map(
     ta=>norm(ta.target?.name)));
    const missing=CRITICAL.filter(n=>!outputJoints.has(n));
    if(missing.length)throw Error(name+" lost joints after retarget: "+missing.join(","));
    if(outputJoints.size<18)throw Error("Incomplete retargeted motion "+name);
    group.stop();
    output.set(motion,group);
   }
  }catch(e){
   for(const group of output.values())group.dispose();
   throw e;
  }
  const view={clips:output,clip:null,motionBlend:null,animationChanges:0};
  let motion="idle",disposed=false;
  function select(next){
   if(disposed)throw Error("Motion controller disposed");
   const clip=output.get(next);
   if(!clip)throw Error("Unknown locomotion "+next);
   blend.play(view,clip,next,{loop:true,duration:next==="idle"?.24:.22});
   motion=next;
   return status();
  }
  function tick(dt){
   if(!disposed)blend.update(view,dt);
  }
  function status(){
   return Object.freeze({
    role,controlOnly:role==="control",
    motion,clipCount:output.size,
    activeClip:view.clip?.name||null,
    blending:!!view.motionBlend,animationChanges:view.animationChanges,
    mappedChannels:stats.map(x=>({motion:x.motion,joints:x.mappedJoints})),
    sourceAndTargetWereDifferent:true,
    skeletonBones:target.skeletons[0].bones.length,
    motionTransferSucceeded:true,
    readyForBritishDeployment:false // requires licensed British asset + visual and combat QA
  });
  }
  function dispose(){
   if(disposed)return;disposed=true;
   blend.stop(view);for(const g of output.values())g.dispose();
  }
  select("idle");
  return Object.freeze({select,tick,status,dispose,CLIPS});
 }
 return Object.freeze({CLIPS,CRITICAL,mapBones,checkClips,create});
});
