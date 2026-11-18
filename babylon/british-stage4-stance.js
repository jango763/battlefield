/* Battlefield · British army stage 4.
 * Reuses the approved Quaternius 65-bone hero and existing two-hand IK.
 * No replacement skin: actual British GLB is required for British deployment.
 * The hero model is permitted only as an explicitly labelled test control.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldBritishStage4Stance=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const CANON=name=>String(name||"").replace(/^mixamorig[:_]?/i,"")
  .replace(/_\d+$/,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
 const ARM_JOINTS=Object.freeze([
  "leftshoulder","leftarm","leftforearm","lefthand",
  "rightshoulder","rightarm","rightforearm","righthand"
 ]);
 const REQUIRED=Object.freeze([
  "hips","neck","spine2","weapon_r","weapon_l",
  ...ARM_JOINTS,
  "righthandindex1","righthandmiddle1","righthandpinky1",
  "righthandthumb2","lefthandindex1","lefthandmiddle1",
  "lefthandpinky1","lefthandthumb2"
 ]);
 const MOTIONS=Object.freeze([
  "Idle_Quaternius","Walk_Quaternius","Jog_Quaternius","Sprint_Quaternius"
 ]);
 function inspect({skeletons=[]}={}){
  const issues=[],skel=skeletons.length===1?skeletons[0]:null;
  const bones=skel?.bones||[],names=new Map();
  if(skeletons.length!==1)issues.push("Для IK нужен один скелет");
  if(bones.length!==65)issues.push("Для IK нужен 65-костный скелет");
  for(const bone of bones){
   const node=bone.getTransformNode?.(),key=CANON(node?.name||bone.name);
   if(!key||names.has(key))issues.push("Повторяющееся/безымянное сочленение "+key);
   if(node)names.set(key,node);
  }
  const missing=REQUIRED.filter(name=>!names.has(CANON(name)));
  if(missing.length)issues.push("Нет костей хвата и пальцев: "+missing.join(", "));
  return Object.freeze({ok:issues.length===0,bones:bones.length,
   linkedJoints:names.size,missing,issues});
 }
 function mappedGroups(scene,tag){
  const names=MOTIONS.map(x=>"british-"+tag+"-"+x);
  const groups=names.map(name=>(scene?.animationGroups||[]).find(g=>g.name===name));
  const missing=names.filter((name,i)=>!groups[i]);
  if(missing.length)throw Error("Нет перенесённых клипов: "+missing.join(", "));
  const arms=new Set(ARM_JOINTS);
  let count=0;
  for(const g of groups){
   for(const ta of g.targetedAnimations||[]){
    if(arms.has(CANON(ta.target?.name)))count++;
   }
  }
  // Exactly 8 conflicting shoulder/elbow/wrist channels per clip.
  // The approved hero IK removes these channels, while lower body remains animated.
  if(count!==32)throw Error("IK: ожидалось 32 канала рук, найдено "+count);
  return groups;
 }
 // Javascript-only aiming math; Babylon scene orientation is handled by
 // stage.rotation.y and rig.getMuzzleWorld(), just as in approved hero stage 9.
 function aimAt({stage,rig,target,maxIterations=12}={}){
  if(!stage?.rotation||!rig?.getMuzzleWorld||
   !Number.isFinite(target?.x)||!Number.isFinite(target?.z))
   throw Error("Нет 3D-корня, ствола или цели для ориентации");
  let dot=-1,iterations=0;
  for(let i=0;i<maxIterations;i++){
   iterations=i+1;
   const m=rig.getMuzzleWorld();
   const p=m.position,d=m.direction;
   const tx=target.x-p[0],tz=target.z-p[2],dx=d[0],dz=d[2];
   if([tx,tz,dx,dz].some(x=>!Number.isFinite(x)))
    throw Error("Невозможно вычислить направление ствола");
   const aimLength=Math.hypot(tx,tz),barrelLength=Math.hypot(dx,dz);
   if(aimLength<.001||barrelLength<.001)
    throw Error("Ствол или цель находятся в вырожденной позиции");
   dot=(tx*dx+tz*dz)/(aimLength*barrelLength);
   const targetYaw=Math.atan2(tx,tz),barrelYaw=Math.atan2(dx,dz);
   const delta=Math.atan2(Math.sin(targetYaw-barrelYaw),
    Math.cos(targetYaw-barrelYaw));
   if(Math.abs(delta)<.003)break;
   stage.rotation.y+=delta;
   stage.computeWorldMatrix?.(true);
  }
  const m=rig.getMuzzleWorld(),dx=m.direction[0],dz=m.direction[2],
   tx=target.x-m.position[0],tz=target.z-m.position[2];
  dot=(tx*dx+tz*dz)/(Math.hypot(tx,tz)*Math.hypot(dx,dz));
  if(!Number.isFinite(dot)||dot<.97)
   throw Error("Боец стреляет не в сторону противника: dot="+dot);
  return Object.freeze({targetId:target.id||null,barrelDot:dot,
   yaw:stage.rotation.y,iterations,muzzle:m.position,
   direction:m.direction});
 }
 function gripQuality(report,weaponMount){
  const errors=[];
  if(report?.error)errors.push("IK: "+report.error);
  const right=Number(report?.rightGripMeters),
   left=Number(report?.leftGripMeters),
   stock=Number(report?.stockToShoulderMeters);
  if(!Number.isFinite(right)||right>.06)
   errors.push("Правая кисть не на спуске: "+right);
  if(!Number.isFinite(left)||left>.06)
   errors.push("Левая кисть не на цевье: "+left);
  if(!Number.isFinite(stock)||stock>.20)
   errors.push("Приклад слишком далеко от плеча: "+stock);
  if(!weaponMount?.attached||!/(?:^|:)Weapon_R$/i.test(weaponMount.parent||""))
   errors.push("Оружие не закреплено на Weapon_R");
  if(report?.armChannelsRemoved!==32)
   errors.push("Конфликтующие анимации рук не отключены");
  // This is the actual palm/finger geometry diagnostic, not just contact.
  for(const [part,value] of [
   ["правая ладонь",report?.rightPalmErrorDeg],
   ["левая ладонь",report?.leftPalmErrorDeg],
   ["пальцы правой",report?.rightFingerErrorDeg],
   ["пальцы левой",report?.leftFingerErrorDeg]
  ]){
   if(!Number.isFinite(value)||value>25)
    errors.push("Неверная ориентация "+part+": "+value+"°");
  }
  if(report?.socketLocalDriftMeters>.001||
    report?.socketLocalRotationErrorDeg>1)
   errors.push("Крепление оружия изменилось во время движения");
  return Object.freeze({ok:errors.length===0,rightGripMeters:right,
   leftGripMeters:left,stockToShoulderMeters:stock,
   rightPalmErrorDeg:report?.rightPalmErrorDeg,
   leftPalmErrorDeg:report?.leftPalmErrorDeg,
   socketParent:weaponMount?.parent||null,errors});
 }
 async function create({scene,actor,stage,tag,grip,weaponRoot,
   target={id:"front",x:0,z:-3.2},controlOnly=false}={}){
  const check=inspect(actor);
  if(!check.ok)throw Error("Британская модель не готова к IK: "+check.issues.join("; "));
  if(!grip?.create)throw Error("Нужен утверждённый драйвер хвата героя");
  if(!["control","britishDanoob","britishJakeli","britishFab"].includes(tag))
   throw Error("Нельзя подменять ранее выбранные модели новыми");
  const groups=mappedGroups(scene,tag);
  // Retargeted groups (not original source animations) drive the real avatar.
  // AssetContainer.animationGroups can contain old author clips; they must not
  // run in parallel with Quaternius and our IK corrections.
  for(const original of actor.animationGroups||[]){
   if(!groups.includes(original)){original.stop?.();original.dispose?.();}
  }
  actor.animationGroups=groups;
  const mounted=await grip.create({scene,imported:actor,stage,
   weaponRoot:weaponRoot||"../assets/ww2-weapons/",
   initialWeaponId:"uk-lee-enfield"});
  let pose="ready",selected=target,disposed=false,aimStatus=null;
  function sync(){
   if(disposed)throw Error("Stage4 stance disposed");
   aimStatus=aimAt({stage,rig:mounted,target:selected});
   return status();
  }
  function status(){
   const mount=mounted.getWeaponMount();
   return Object.freeze({
    pose,weaponId:mounted.report.weaponId,controlOnly,
    targetId:selected.id||null,aim:aimStatus,
    quality:gripQuality(mounted.report,mount),
    mounted:mount,report:mounted.report,
    readyForBritishDeployment:false,
    BritishSkinInstalled:false
   });
  }
  function setPose(next){
   if(next!=="ready"&&next!=="aim")throw Error("Unknown stance "+next);
   mounted.setPose(next);pose=next;return sync();
  }
  function targetAt(t){
   if(!Number.isFinite(t?.x)||!Number.isFinite(t?.z))
    throw Error("Invalid target coordinates");
   selected=t;return sync();
  }
  try{
   const initial=sync();
   if(!initial.quality.ok)throw Error("Approved 2-hand IK calibration failed: "+
    initial.quality.errors.join("; "));
  }catch(e){
   mounted.dispose();
   throw e;
  }
  async function equipWeapon(id){
   if(disposed)throw Error("Stage4 stance disposed");
   await mounted.equipWeapon(id);
   const now=sync();
   if(!now.quality.ok)throw Error("Two-hand IK failed on "+id+": "+
    now.quality.errors.join("; "));
   return now;
  }
  return Object.freeze({setPose,targetAt,equipWeapon,sync,status,
   getMuzzleWorld:()=>mounted.getMuzzleWorld(),
   setCombatOverlay:overlay=>mounted.setCombatOverlay(overlay),
   dispose(){disposed=true;mounted.dispose();}});
 }
 return Object.freeze({CANON,REQUIRED,ARM_JOINTS,MOTIONS,
  inspect,mappedGroups,aimAt,gripQuality,create});
});
