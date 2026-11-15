// Babylon.js isolated migration test. Never imports or changes the existing game.
const canvas=document.querySelector('#view'),status=document.querySelector('#status');
const state={ready:false,error:null,animation:'idle',skeletons:0,groups:[],meshes:0,engine:'Babylon.js',fps:0};
window.__babylonLab=state;
const base=new URL('../../assets/native-hero-quaternius/',import.meta.url);
function log(msg){status.textContent=msg;console.info('[BABYLON LAB]',msg);}
async function start(){
 if(!window.BABYLON)throw Error('Babylon.js CDN не загрузился');
 const B=window.BABYLON;
 const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,disableWebGL2Support:false});
 const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.20,.26,.22,1);
 const camera=new B.ArcRotateCamera('camera',-Math.PI/2,Math.PI/2.25,5.6,new B.Vector3(0,1.2,0),scene);
 camera.attachControl(canvas,true);camera.lowerRadiusLimit=2;camera.upperRadiusLimit=12;
 const hemi=new B.HemisphericLight('sky',new B.Vector3(0,1,0),scene);hemi.intensity=1.4;
 const sun=new B.DirectionalLight('sun',new B.Vector3(-.5,-1,-.4),scene);sun.intensity=1.8;
 const ground=B.MeshBuilder.CreateGround('ground',{width:20,height:20},scene);
 const mat=new B.StandardMaterial('earth',scene);mat.diffuseColor=new B.Color3(.25,.32,.23);ground.material=mat;
 log('Загружаем оригинальную модель Quaternius…');
 const model=await B.SceneLoader.ImportMeshAsync('','',new URL('night-striker-lite.glb',base).href,scene);
 const root=new B.TransformNode('characterRoot',scene);
 for(const node of model.meshes.filter(m=>!m.parent))node.parent=root;
 const bounds=model.meshes.filter(m=>m.getBoundingInfo&&m.getTotalVertices()>0).map(m=>m.getBoundingInfo().boundingBox);
 if(bounds.length){let lo=Infinity,hi=-Infinity;for(const b of bounds){lo=Math.min(lo,b.minimumWorld.y);hi=Math.max(hi,b.maximumWorld.y);}
 const h=hi-lo;if(h>.01&&Number.isFinite(h))root.scaling.scaleInPlace(2.1/h);}
 state.skeletons=model.skeletons.length;state.meshes=model.meshes.length;
 log('Модель загружена. Подключаем существующие GLB-анимации…');
 const clips=await B.SceneLoader.LoadAssetContainerAsync('',new URL('hero-three-clips-lite.glb',base).href,scene);
 const all=clips.animationGroups;
 const wanted={idle:'Idle_Loop',jog:'Jog_Fwd_Loop',sprint:'Sprint_Loop'};
 // The animation GLB has its own node hierarchy. Babylon animates transform nodes,
 // not necessarily Skeleton.bones. Resolve targets against the imported character.
 // Keep animated transform nodes separate from Skeleton.bones: the latter
 // may expose names without being the actual GLB animation targets.
 const modelTargets=[...model.transformNodes,...model.meshes,...model.skeletons.flatMap(x=>x.bones)];
 state.rigInventory={
  skeletons:model.skeletons.map(sk=>({name:sk.name,bones:sk.bones.map(b=>b.name)})),
  transforms:model.transformNodes.map(n=>({name:n.name,parent:n.parent?.name||null})),
  meshes:model.meshes.map(n=>({name:n.name,parent:n.parent?.name||null}))
 };
 const norm=name=>String(name||'').replace(/^mixamorig[:_]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const byName=new Map();
 for(const node of modelTargets){
  const key=norm(node.name);
  if(key&&!byName.has(key))byName.set(key,node);
 }
 const remapped={},counts={},unmatched={};
 for(const [mode,name] of Object.entries(wanted)){
  const group=all.find(g=>g.name===name||g.name.includes(name));
  if(!group){counts[mode]=0;unmatched[mode]=['missing group '+name];continue;}
  const output=new B.AnimationGroup('battlefield-'+mode,scene);
  const misses=[];let count=0;
  for(const ta of group.targetedAnimations){
   const old=ta.target;
   const target=byName.get(norm(old?.name));
   if(!target){misses.push(old?.name||'(unnamed)');continue;}
   // Preserve Babylon's glTF animation property (rotationQuaternion/position/scaling).
   output.addTargetedAnimation(ta.animation.clone(),target);
   count++;
  }
  if(count){output.normalize();output.stop();remapped[mode]=output;}
  else output.dispose();
  counts[mode]=count;unmatched[mode]=misses.slice(0,12);
 }
 state.unmatched=unmatched;
 state.targetNames=modelTargets.map(n=>n.name).slice(0,25);
 state.sourceNames=all.flatMap(g=>g.targetedAnimations.map(a=>a.target?.name)).filter(Boolean).slice(0,25);
 state.groups=all.map(g=>g.name);state.mappedTracks=counts;
 // Torso-mounted weapon: independent of the swinging right wrist.
 // Two-handed pose is an experimental procedural aim constraint.
 let weaponContainer=null,weaponRoot=null,grip=null,weaponGeneration=0;
 const weaponSelect=document.querySelector('#weapon');
 const findPart=(...names)=>model.transformNodes.find(n=>names.some(x=>norm(n.name)===norm(x)))||modelTargets.find(n=>names.some(x=>norm(n.name)===norm(x)));
 const chest=findPart('spine_03','spine_02','spine2','chest','upperchest','spine1');
 const rightHand=findPart('hand_r','righthand','RightHand');
 const leftHand=findPart('hand_l','lefthand','LeftHand');
 const rightUpper=findPart('upperarm_r','rightarm','RightArm');
 const leftUpper=findPart('upperarm_l','leftarm','LeftArm');
 const rightLower=findPart('lowerarm_r','rightforearm','RightForeArm');
 const leftLower=findPart('lowerarm_l','leftforearm','LeftForeArm');
 const auditRig=()=>{
  const joints={chest,rightUpper,rightLower,rightHand,leftUpper,leftLower,leftHand};
  const info={};
  for(const [key,node] of Object.entries(joints))info[key]=node?{name:node.name,type:node.getClassName?.(),parent:node.parent?.name||null,rotationQuaternion:!!node.rotationQuaternion}:null;
  state.rigAudit={joints:info,skeletons:state.rigInventory.skeletons,armCandidates:modelTargets.map(n=>n.name).filter(n=>/arm|hand|clavicle|spine|chest|wrist/i.test(n))};
  return state.rigAudit;
 };
 auditRig();
 // Rig-space diagnostic: measure real local axes and world-space shoulder/hand
 // positions before attempting any combat retargeting. This does not mutate
 // bones or the existing three animation groups.
 function sampleRigSpace(){
  const names={chest,rightUpper,rightLower,rightHand,leftUpper,leftLower,leftHand};
  const data={};
  for(const [key,node] of Object.entries(names)){
   if(!node?.computeWorldMatrix||!node?.getAbsolutePosition){data[key]={error:'not a transform node'};continue;}
   node.computeWorldMatrix(true);
   const p=node.getAbsolutePosition();
   const world=node.getWorldMatrix();
   const axis=x=>{const v=B.Vector3.TransformNormal(x,world).normalize();return [v.x,v.y,v.z].map(n=>+n.toFixed(4));};
   data[key]={name:node.name,position:[p.x,p.y,p.z].map(n=>+n.toFixed(4)),
    localX:axis(B.Axis.X),localY:axis(B.Axis.Y),localZ:axis(B.Axis.Z),
    parent:node.parent?.name||null};
  }
  return data;
 }
 state.sampleRigSpace=sampleRigSpace;
 state.rigSpace=sampleRigSpace();

 const manifest=await fetch(new URL('../../assets/ww2-weapons/manifest.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('manifest HTTP '+r.status);return r.json();});
 const toVec=a=>new B.Vector3(...a);
 const positionOf=node=>node?.getAbsolutePosition?.()||B.Vector3.Zero();
 // Experimental static two-hand grip: solve only once after the idle pose freezes.
 function aimJoint(joint,hand,target){
  if(!joint||!hand||!joint.parent)return;
  joint.computeWorldMatrix(true);hand.computeWorldMatrix(true);
  const pivot=joint.getAbsolutePosition();
  const from=hand.getAbsolutePosition().subtract(pivot).normalize();
  const to=target.subtract(pivot).normalize();
  const axis=B.Vector3.Cross(from,to);
  const length=axis.length();
  if(length<1e-5)return;
  const angle=Math.min(Math.atan2(length,B.Vector3.Dot(from,to)),.24);
  const parentRotation=new B.Quaternion();
  joint.parent.computeWorldMatrix(true).decompose(undefined,parentRotation,undefined);
  const localAxis=B.Vector3.TransformNormal(axis.scale(1/length),B.Matrix.FromQuaternion(parentRotation.conjugate())).normalize();
  const q=B.Quaternion.RotationAxis(localAxis,angle);
  const original=joint.rotationQuaternion||B.Quaternion.FromEulerAngles(joint.rotation.x,joint.rotation.y,joint.rotation.z);
  joint.rotationQuaternion=q.multiply(original).normalize();
 }
 function poseArm(upper,lower,hand,target){
  if(!upper||!lower||!hand)return;
  for(let i=0;i<8;i++){aimJoint(lower,hand,target);aimJoint(upper,hand,target);}
 }
 let combatPoseSolved=false;
 const combatArmNodes=[rightUpper,rightLower,leftUpper,leftLower].filter(n=>n?.rotationQuaternion);
 const combatRest=new Map();
 function resetCombatArms(){for(const [node,q] of combatRest){node.rotationQuaternion=q.clone();}combatRest.clear();}
 function raiseCombatArms(){
  // An explicit upper-body pose is required: IK alone cannot raise a gun
  // parented to a hanging wrist. Apply it once, after freezing idle.
  for(const node of combatArmNodes)combatRest.set(node,node.rotationQuaternion.clone());
  for(const [node,angle] of [[rightUpper,-.75],[leftUpper,-.70],[rightLower,-.35],[leftLower,-.45]]){
   if(!node?.rotationQuaternion)continue;
   const delta=B.Quaternion.RotationAxis(B.Axis.X,angle);
   node.rotationQuaternion.multiplyInPlace(delta).normalize();
  }
  state.combatPoseStatus='Upper-body pose applied; support IK pending';
 }

 function updateWeaponPose(){
  if(!weaponRoot||!grip)return;
  // The trigger is the weapon origin (see manifest). Keep it at the right-hand
  // socket, rather than using an unverified chest-relative offset.
  grip.position.set(0,0,0);
  grip.rotationQuaternion=null;
  // Weapon forward is +Z in its GLB. This is a provisional local orientation;
  // the two-hand combat pose still needs a verified animation.
  // Do not roll the magazine upward: weapon local +Z is the barrel direction.
  grip.rotation.set(0,0,0);
  const trigger=weaponRoot.getAbsolutePosition();
  const support=toVec(weaponRoot.metadata?.support||[0,0,.25]);
  const supportWorld=B.Vector3.TransformCoordinates(support,weaponRoot.getWorldMatrix());
  if(state.animation==='combat'&&!combatPoseSolved){
   combatPoseSolved=true;
   try{
    if(rightHand&&leftUpper&&leftLower&&leftHand){
     // The weapon is parented to the right hand, so right-hand IK would
     // chase its own child and introduce an unstable feedback loop.
     // Solve the free (support) arm toward the actual foregrip point.
     poseArm(leftUpper,leftLower,leftHand,supportWorld);
     state.combatPoseStatus='Left support-hand IK attempted; right hand is weapon anchor';
    }else state.combatPoseStatus='IK skipped: arm joints unavailable';
   }catch(error){state.combatPoseStatus='IK failed: '+String(error);}
  }
  state.gripDistances={
   right:rightHand?Number(B.Vector3.Distance(positionOf(rightHand),trigger).toFixed(3)):null,
   left:leftHand?Number(B.Vector3.Distance(positionOf(leftHand),supportWorld).toFixed(3)):null
  };
  state.weaponSocket={parent:grip.parent?.name||null,triggerAtRightHand:state.gripDistances.right};
  // Machine-readable acceptance checks. Never call a pose successful merely
  // because the button was pressed or the animation group stopped.
  if(state.animation==='combat'){
   const shoulder=rightUpper&&positionOf(rightUpper);
   const right=rightHand&&positionOf(rightHand);
   const left=leftHand&&positionOf(leftHand);
   const gunMuzzle=weaponRoot.metadata?.muzzle&&B.Vector3.TransformCoordinates(toVec(weaponRoot.metadata.muzzle),weaponRoot.getWorldMatrix());
   const shoulderHeight=shoulder?.y??null;
   const rightRaised=shoulderHeight!==null&&right?.y>=shoulderHeight-.25;
   const leftSupport=Number.isFinite(state.gripDistances.left)&&state.gripDistances.left<.12;
   const muzzleAboveGrip=gunMuzzle?gunMuzzle.y-trigger.y: null;
   state.combatAcceptance={rightRaised,leftSupport,muzzleAboveGrip,
    passed:rightRaised&&leftSupport&&muzzleAboveGrip!==null&&muzzleAboveGrip>-.20,
    note:'Geometric checks only; visual anatomy still requires validation'};
  }

 }
 async function equipWeapon(id){
  const generation=++weaponGeneration;
  state.weapon=id;state.weaponError=null;state.weaponAttached=false;
  try{
   const meta=manifest.weapons[id];if(!meta)throw Error('Unknown weapon '+id);
   const url=new URL('../../assets/ww2-weapons/'+meta.file,import.meta.url);
   const incoming=await B.SceneLoader.LoadAssetContainerAsync('',url.href,scene);
   if(generation!==weaponGeneration){incoming.dispose();return;}
   if(grip){grip.dispose(false,false);grip=null;weaponRoot=null;}
   if(weaponContainer){weaponContainer.dispose();weaponContainer=null;}
   weaponContainer=incoming;weaponContainer.addAllToScene();
   if(!rightHand||typeof rightHand.getAbsolutePosition!=='function')throw Error('Правая кисть не найдена как TransformNode; крепление оружия остановлено');
   grip=new B.TransformNode('rightHandWeaponSocket',scene);grip.parent=rightHand;
   weaponRoot=new B.TransformNode('weaponTrigger',scene);weaponRoot.parent=grip;
   weaponRoot.metadata={support:meta.support,trigger:meta.trigger,muzzle:meta.muzzle};
   for(const mesh of weaponContainer.meshes.filter(m=>!m.parent))mesh.parent=weaponRoot;
   for(const node of weaponContainer.transformNodes.filter(n=>!n.parent))node.parent=weaponRoot;
   state.weaponAttached=true;combatPoseSolved=false;updateWeaponPose();
  }catch(e){state.weaponError=String(e);console.error('Weapon load',e);}
  select(state.animation);
 }
 weaponSelect.addEventListener('change',()=>equipWeapon(weaponSelect.value));
 state.equipWeapon=equipWeapon;
 function select(mode){
  resetCombatArms();state.animation=mode;combatPoseSolved=false;
  for(const group of Object.values(remapped))group.stop();
  if(mode==='combat'&&remapped.idle){remapped.idle.start(true,1,remapped.idle.from,remapped.idle.to,false);remapped.idle.goToFrame(remapped.idle.from);remapped.idle.pause();raiseCombatArms();}
  else if(remapped[mode])remapped[mode].start(true,1,remapped[mode].from,remapped[mode].to,false);
  for(const btn of document.querySelectorAll('[data-clip]'))btn.setAttribute('aria-pressed',String(btn.dataset.clip===mode));
  log('Babylon.js | meshes: '+state.meshes+' | skeletons: '+state.skeletons+' | tracks: '+JSON.stringify(counts)+'\nAnimation: '+mode+' | '+(mode==='combat'?'static inspection pose; grip not yet solved':remapped[mode]?'active':'НЕ ПРИВЯЗАНА — требуется адаптация')+'\nSource groups: '+state.groups.join(', '));
 }
 for(const btn of document.querySelectorAll('[data-clip]'))btn.addEventListener('click',()=>select(btn.dataset.clip));
 select('idle');await equipWeapon(weaponSelect.value);state.ready=true;state.scene=scene;state.engineInstance=engine;
 engine.runRenderLoop(()=>{try{updateWeaponPose();}catch(e){state.poseError=String(e);status.textContent='ОШИБКА БОЕВОЙ ПОЗЫ: '+state.poseError;console.error('Combat pose',e);}scene.render();state.fps=Math.round(engine.getFps());});
 window.addEventListener('resize',()=>engine.resize());
}
start().catch(err=>{state.error=String(err?.stack||err);log('ОШИБКА: '+state.error);console.error(err);});
