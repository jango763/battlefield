/* Battlefield / Quaternius CC0 locomotion → Mixamo 65-bone soldier
 * Source is the actual 43-clip Quaternius GLB committed to this branch.
 * Retarget via Babylon.js 9+ AnimatorAvatar; do NOT replay stale
 * procedural walk/jog animations generated for the old American prototype.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldQuaterniusMotion=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const SOURCE_TO_MIXAMO=Object.freeze({
  pelvis:'Hips',spine_01:'Spine',spine_02:'Spine1',spine_03:'Spine2',
  neck_01:'Neck',Head:'Head',
  clavicle_l:'LeftShoulder',upperarm_l:'LeftArm',
  lowerarm_l:'LeftForeArm',hand_l:'LeftHand',
  clavicle_r:'RightShoulder',upperarm_r:'RightArm',
  lowerarm_r:'RightForeArm',hand_r:'RightHand',
  thigh_l:'LeftUpLeg',calf_l:'LeftLeg',
  foot_l:'LeftFoot',ball_l:'LeftToeBase',
  thigh_r:'RightUpLeg',calf_r:'RightLeg',
  foot_r:'RightFoot',ball_r:'RightToeBase'
 });
 const AVAILABLE=Object.freeze({
  rest:'Idle_Loop',
  walk:'Walk_Loop',
  jog:'Jog_Fwd_Loop',
  sprint:'Sprint_Loop',
  crouch:'Crouch_Fwd_Loop',
  crouchIdle:'Crouch_Idle_Loop',
  hit:'Hit_Chest',
  death:'Death01'
 });
 const required=new Set([
  'Hips','Spine','Spine1','Spine2','Head',
  'LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand',
  'LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'
 ]);
 function skeletonMap(skeleton){
  const entries=(skeleton?.bones||[]).map(b=>[b.name,b.getTransformNode?.()])
   .filter(([,node])=>!!node);
  const names=new Map(entries.map(([name])=>
   [String(name).replace(/^mixamorig[:_]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase(),name]));
  const missing=[...required].filter(n=>!names.has(n.toLowerCase()));
  if(missing.length)throw Error('У американского героя отсутствуют связные суставы: '+missing.join(', '));
  return new Map(Object.entries(SOURCE_TO_MIXAMO).map(([source,target])=>[
   source,names.get(target.toLowerCase())]).filter(([,target])=>!!target));
 }
 function clipsByName(groups){
  const found=new Map();
  for(const g of groups||[]){
   const name=Object.values(AVAILABLE).find(n=>g.name===n||g.name.endsWith(n));
   if(name)found.set(name,g);
  }
  const missing=Object.values(AVAILABLE).filter(n=>!found.has(n));
  if(missing.length)throw Error('В Quaternius нет анимаций: '+missing.join(', '));
  return found;
 }
 function retarget({B,heroRoot,heroSkeleton,sourceGroups,tag='american-hero'}){
  if(typeof B?.AnimatorAvatar!=='function')throw Error('Нужен Babylon.js 9+ AnimatorAvatar');
  if(!heroRoot||!heroSkeleton)throw Error('Нет полноценного рига американского героя');
  const mapping=skeletonMap(heroSkeleton),sources=clipsByName(sourceGroups);
  if(mapping.size<17)throw Error('Недостаточно соответствий суставов: '+mapping.size);
  heroSkeleton.returnToRest?.();
  // Source importer must provide the untouched GLB bind/rest pose.
  // This function is called before playing any of Quaternius clips.
  const avatar=new B.AnimatorAvatar('quaternius-to-'+tag,heroRoot);
  const output=new Map();
  try{
   for(const [name,group] of sources){
    if(group.isPlaying)throw Error('Сначала остановить клип-источник: '+name);
    const targets=new Set((group.targetedAnimations||[])
      .map(t=>t.target?.name));
    const active=new Map([...mapping].filter(([key])=>targets.has(key)));
    if(active.size<17)throw Error('Несовместимая исходная иерархия Quaternius '+name+': '+active.size);
    const adapted=avatar.retargetAnimationGroup(group,{
     animationGroupName:'battlefield-'+tag+'-'+name,
     mapNodeNames:active,
     rootNodeName:'pelvis',
     groundReferenceNodeName:'foot_l',
     retargetAnimationKeys:true,
     fixRootPosition:true,
     // The source and target may differ in ground axes/height. Defer dynamic
     // feet pinning until local retarget contact points are inspected.
     fixGroundReference:false,
     fixAnimations:true,
     checkHierarchy:false
    });
    const count=adapted?.targetedAnimations?.length||0;
    if(count<17){adapted?.dispose?.();throw Error('Неполный перенос '+name+': '+count+' треков');}
    adapted.stop();
    output.set(name,adapted);
   }
  }catch(e){for(const clip of output.values())clip.dispose?.();throw e}
  return Object.freeze({
   clips:output,
   get:name=>output.get(AVAILABLE[name]||name),
   dispose:()=>{for(const c of output.values())c.dispose?.();}
  });
 }
 return Object.freeze({SOURCE_TO_MIXAMO,AVAILABLE,skeletonMap,clipsByName,retarget});
});