/* Battlefield — independent donor rigs: German RUN drives LEGS only.
 * Rifle-ready/aim and both arms remain native to their skinned character.
 * Cross-rig full-body READY is unsafe: it caused mannequin arms and lost grip.
 * Source GLBs and bind matrices remain untouched. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldUnitMotionUnifier=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const REQUIRED=Object.freeze(['hips','spine','spine1','spine2','head',
  'leftshoulder','leftarm','leftforearm','lefthand','rightshoulder',
  'rightarm','rightforearm','righthand','leftupleg','leftleg','leftfoot',
  'rightupleg','rightleg','rightfoot']);
 const WEAPONS=Object.freeze(['Kar98k','MP40','MG42','Panzerschreck']);
 const LOCOMOTION=Object.freeze(['hips','leftupleg','leftleg','leftfoot',
  'lefttoebase','rightupleg','rightleg','rightfoot','righttoebase']);
 const locomotionNames=new Set(LOCOMOTION);
 const canonical=name=>String(name||'').replace(/[-_]\d+$/,'')
  .replace(/^.*?(?=mixamorig)/i,'').replace(/^mixamorig[:_]?/i,'')
  .replace(/[^a-z0-9]/gi,'').toLowerCase();
 const sourceName=group=>group?.name?.replace(/-\d+$/,'')||'';
 function findGroup(groups,name){
  return (groups||[]).find(g=>sourceName(g)===name||g.name===name)||null;
 }
 function targetRig(skeletons){
  const skeleton=(skeletons||[]).find(s=>s?.bones?.length>=60);
  if(!skeleton)return {ok:false,reason:'Нет полного скелета'};
  const map=new Map();
  for(const bone of skeleton.bones||[]){
   const node=bone.getTransformNode?.();
   if(!node)continue;
   const key=canonical(bone.name||node.name);
   if(!map.has(key))map.set(key,{bone,node});
  }
  const missing=REQUIRED.filter(n=>!map.has(n));
  return {ok:missing.length===0,map,missing,
   reason:missing.length?'Нет linked-костей: '+missing.join(', '):null,
   bones:skeleton.bones.length};
 }
 function armReach(skeletons,side){
  const rig=targetRig(skeletons);
  if(!rig.ok)return {ok:false,reason:rig.reason};
  const prefix=side==='left'?'left':'right';
  const shoulder=rig.map.get(prefix+'arm')?.node;
  const elbow=rig.map.get(prefix+'forearm')?.node;
  const hand=rig.map.get(prefix+'hand')?.node;
  if(!shoulder||!elbow||!hand)return {ok:false,reason:'Отсутствует цепь руки'};
  const a=shoulder.getAbsolutePosition?.(),b=elbow.getAbsolutePosition?.(),
    c=hand.getAbsolutePosition?.();
  const upper=a?.subtract(b)?.length(),lower=b?.subtract(c)?.length();
  if(!Number.isFinite(upper)||!Number.isFinite(lower)||upper<=0||lower<=0)
   return {ok:false,reason:'Невозможно измерить длину руки'};
  return {ok:true,upper,lower,maxReach:(upper+lower)*.98};
 }
 function clampGrip(skeletons,side,desired,Vector3){
  const metrics=armReach(skeletons,side);
  if(!metrics.ok)return {ok:false,reason:metrics.reason};
  const key=(side==='left'?'left':'right')+'arm';
  const shoulder=targetRig(skeletons).map.get(key)?.node?.getAbsolutePosition?.();
  if(!shoulder||!desired)return {ok:false,reason:'Нет координат оружия'};
  const delta=desired.subtract(shoulder);
  const distance=delta.length();
  if(!Number.isFinite(distance))return {ok:false,reason:'Неверная точка хвата'};
  const clipped=distance>metrics.maxReach;
  const safe=clipped?shoulder.add(delta.scale(metrics.maxReach/Math.max(distance,1e-6))):desired.clone();
  return {ok:true,target:safe,clipped,distance,maxReach:metrics.maxReach};
 }
 function retarget({B,sourceGroup,targetRoot,skeletons,tag}){
  if(!sourceGroup||!targetRoot||typeof B?.AnimatorAvatar!=='function')
   return {ok:false,reason:'Нет исходного клипа, корня или Babylon AnimatorAvatar'};
  const rig=targetRig(skeletons);
  if(!rig.ok)return {ok:false,reason:rig.reason};
  const mapping=new Map();
  for(const ta of sourceGroup.targetedAnimations||[]){
   const name=ta.target?.name,matched=rig.map.get(canonical(name));
   if(name&&matched)mapping.set(name,matched.bone.name);
  }
  const missing=REQUIRED.filter(n=>![...mapping.keys()].some(k=>canonical(k)===n));
  if(missing.length)return {ok:false,reason:'У донора нет '+missing.join(', ')};
  const hips=[...mapping.keys()].find(n=>canonical(n)==='hips');
  let group;
  try{
   const avatar=new B.AnimatorAvatar('infantry-avatar-'+tag,targetRoot);
   group=avatar.retargetAnimationGroup(sourceGroup,{
    animationGroupName:'standard-'+tag+'-'+sourceName(sourceGroup),
    mapNodeNames:mapping,retargetAnimationKeys:true,
    fixRootPosition:true,fixGroundReference:false,
    fixAnimations:true,checkHierarchy:false,rootNodeName:hips
   });
   const present=new Set((group?.targetedAnimations||[]).map(t=>canonical(t.target?.name)));
   const absent=REQUIRED.filter(n=>!present.has(n));
   if(absent.length){
    group?.dispose?.();
    return {ok:false,reason:'Неполный retarget: '+absent.join(', ')};
   }
   group.stop();
   return {ok:true,group,joints:mapping.size};
  }catch(e){
   group?.dispose?.();
   return {ok:false,reason:String(e?.message||e)};
  }
 }
 // Retargeting the donor's ARMS is not a valid two-handed weapon solution.
 // Play only its authored hip/leg motion. Native torso, fingers and hand-IK
 // always remain in control; never overwrite the target character's skin.
 function legsOnly(group){
  if(!group?.targetedAnimations)return {ok:false,reason:'No animated targets'};
  let removed=0;
  for(let i=group.targetedAnimations.length-1;i>=0;i--){
   const name=canonical(group.targetedAnimations[i]?.target?.name);
   if(!locomotionNames.has(name)){
    group.targetedAnimations.splice(i,1);removed++;
   }
  }
  const names=new Set(group.targetedAnimations.map(t=>canonical(t.target?.name)));
  if(!['hips','leftupleg','leftleg','rightupleg','rightleg'].every(n=>names.has(n)))
   return {ok:false,reason:'Incomplete animated leg chain',removed};
  return {ok:true,kept:group.targetedAnimations.length,removed};
 }
 // Production-safe same-rig locomotion split: duplicate only the SOURCE
 // group's approved leg channels. Do not retarget across factions and never
 // let the rifle carry be controlled by the source's authored wrist tracks.
 function installNativeGermanLegRun(view,{B,scene}={}){
  if(!view?.clips||!view?.imported?.skeletons||!B?.AnimationGroup||!scene)
   return {ok:false,reason:'Incomplete independent German actor or scene'};
  if(view.nativeGermanLegsRun)return {ok:true,installed:false,group:view.nativeGermanLegsRun};
  const source=view.clips.get('Kar98k_Run');
  if(!source?.targetedAnimations?.length)
   return {ok:false,reason:'Missing original German rifle run'};
  const isolated=new B.AnimationGroup('german-native-legs-'+view.index,scene);
  try{
   for(const ta of source.targetedAnimations)
    isolated.addTargetedAnimation(ta.animation,ta.target);
   const mask=legsOnly(isolated);
   if(!mask.ok){isolated.dispose();return {ok:false,reason:mask.reason};}
   isolated.stop();
   view.nativeGermanLegsRun=isolated;
   view.nativeGermanFullRun=source;
   view.clips.set('Kar98k_Run',isolated);
   return {ok:true,installed:true,group:isolated,
    joints:mask.kept,protectedChannels:mask.removed};
  }catch(error){
   isolated.dispose();
   return {ok:false,reason:String(error?.message||error)};
  }
 }
 // Each actor owns a different rig. Do not replace READY with an unrelated
 // soldier's upper-body pose: the weapon/hand controller owns that stance.
 function install(view,{B,germanRun}={}){
  if(!view?.root||!view?.imported?.skeletons||!view?.clips)
   return {ok:false,reason:'No independent skinned actor'};
  view.nativeMotionClips||=new Map(view.clips);
  view.unifiedMotionGroups||=new Map();
  view.unifiedMotionReports||={};
  const family=view.importedAlliedName||'approvedGerman';
  view.unifiedMotionReports.ready={status:'native-weapon-stance',
   reason:'Character-specific arms and grip; no cross-rig READY'};
  if(family==='approvedGerman'){
   view.unifiedMotionReports.run={status:'native-donor'};
   return {ok:true,transferred:0,family,reports:view.unifiedMotionReports};
  }
  if(!germanRun){
   view.unifiedMotionReports.run={status:'pending'};
   return {ok:true,transferred:0,family,reports:view.unifiedMotionReports};
  }
  const signature='legs:'+sourceName(germanRun);
  if(view.unifiedMotionGroups.has(signature))
   return {ok:true,transferred:0,family,reports:view.unifiedMotionReports};
  const made=retarget({B,sourceGroup:germanRun,targetRoot:view.root,
    skeletons:view.imported.skeletons,tag:String(view.index)+'-legs-run'});
  if(!made.ok){
   view.unifiedMotionReports.run={status:'native-fallback',reason:made.reason};
   return {ok:true,transferred:0,family,reports:view.unifiedMotionReports};
  }
  const masking=legsOnly(made.group);
  if(!masking.ok){
   made.group.dispose?.();
   view.unifiedMotionReports.run={status:'native-fallback',reason:masking.reason};
   return {ok:true,transferred:0,family,reports:view.unifiedMotionReports};
  }
  view.unifiedMotionGroups.set(signature,made.group);
  view.clips.set('Kar98k_Run',made.group);
  view.unifiedMotionReports.run={status:'legs-only',joints:masking.kept,
   protectedChannels:masking.removed};
  return {ok:true,transferred:1,family,reports:view.unifiedMotionReports};
 }
 return Object.freeze({REQUIRED,WEAPONS,canonical,sourceName,findGroup,
  targetRig,armReach,clampGrip,retarget,legsOnly,installNativeGermanLegRun,install});
});
