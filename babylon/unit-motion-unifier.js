/* Battlefield 2026-11-22 — unit-only shared animation donor bridge.
 * Germany supplies RUN; British Jakeli supplies READY. The American rig
 * remains a separate skinned character with its own weapon/hand IK.
 * Babylon AnimatorAvatar performs rest-pose-aware retargeting where possible.
 * Incompatible rigs keep native clips: never overwrite a GLB or bind pose.
 */
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
 const canonical=name=>String(name||'').replace(/-\\d+$/,'')
  .replace(/^mixamorig[:_]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const sourceName=group=>group?.name?.replace(/-\\d+$/,'')||'';
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
 // A unit retains a native clip map and can revert independently.
 // The bridge never mutates mesh geometry, skeleton hierarchy or gameplay.
 function install(view,{B,germanRun,britishReady}={}){
  if(!view?.root||!view?.imported?.skeletons||!view?.clips)
   return {ok:false,reason:'Нет самостоятельного персонажа'};
  view.nativeMotionClips||=new Map(view.clips);
  view.unifiedMotionGroups||=new Map();
  view.unifiedMotionReports||={};
  let transferred=0;
  const family=view.importedAlliedName||'approvedGerman';
  for(const [mode,donor,keepNative] of [
   ['run',germanRun,family==='approvedGerman'],
   ['ready',britishReady,family==='britishJakeli']
  ]){
   if(keepNative){
    view.unifiedMotionReports[mode]={status:'native',reason:'Утверждённый донор'};continue;
   }
   if(!donor){view.unifiedMotionReports[mode]={status:'pending',reason:'Донор ещё не загружен'};continue;}
   const signature=mode+':'+sourceName(donor);
   if(view.unifiedMotionGroups.has(signature))continue;
   const made=retarget({B,sourceGroup:donor,targetRoot:view.root,
    skeletons:view.imported.skeletons,tag:String(view.index)+'-'+mode});
   if(!made.ok){
    view.unifiedMotionReports[mode]={status:'fallback',reason:made.reason};
    continue;
   }
   view.unifiedMotionGroups.set(signature,made.group);
   for(const gun of WEAPONS)
    view.clips.set(gun+'_'+(mode==='run'?'Run':'Hold'),made.group);
   view.unifiedMotionReports[mode]={status:'retargeted',joints:made.joints};
   transferred++;
  }
  return {ok:true,transferred,family,
   reports:view.unifiedMotionReports,
   left:armReach(view.imported.skeletons,'left'),
   right:armReach(view.imported.skeletons,'right')};
 }
 return Object.freeze({REQUIRED,WEAPONS,canonical,sourceName,findGroup,
  targetRig,armReach,clampGrip,retarget,install});
});
