/* Battlefield · Stage 8 · US hero retained four weapon mounts + animated combat overlays.
 * Rifle pose derived from Ara 3D Gen MIT src/core/anim/clips/shooter.ts:
 * READY and AIM pole, finger-direction, palm-target conventions.
 * This is a new adaptation to the user's existing 65-bone glTF skeleton,
 * not a verbatim import of animation keys or a modification of the German rig.
 * MIT copyright (c) 2026 Joshua Olatunde and Ara 3D Gen contributors.
 */
(function(root,factory){
  const api=factory();
  if(root)root.BattlefieldUSLeeEnfieldStage4=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const CANON=n=>String(n||"").replace(/^mixamorig[:_]?/i,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
const ARMS=new Set(["leftshoulder","leftarm","leftforearm","lefthand",
                    "rightshoulder","rightarm","rightforearm","righthand"]);
const WEAPON_IDS=Object.freeze(["uk-lee-enfield","uk-sten","uk-bren","uk-piat"]);
const PROFILES=Object.freeze({
 "uk-lee-enfield":{label:"Lee-Enfield",file:"uk-lee-enfield.glb",source:"GLB · Muster WW2",
   support:{min:.14,max:.313,ready:.22,aim:.255,drop:.052,x:0},grip:[-.012,-.055,-.065],fingerDir:[0,-.95,.31],angle:[.24,.71,.11,.64]},
 "uk-sten":{label:"Sten",file:"uk-sten.glb",source:"GLB · Muster WW2",
   support:{min:.15,max:.399,ready:.255,aim:.285,drop:.034,x:-.006},grip:[-.010,-.036,-.043],fingerDir:[0,-.92,.40],angle:[.19,.67,.08,.62]},
 "uk-bren":{label:"Bren",file:"uk-bren.glb",source:"GLB · Muster WW2",
   support:{min:.095,max:.315,ready:.22,aim:.24,drop:.039,x:.055},grip:[-.019,-.057,-.080],fingerDir:[0,-.95,.31],angle:[.25,.66,.12,.58]},
 "uk-piat":{label:"PIAT",file:null,source:"Procedural · original Battlefield",
   support:{min:.027,max:.155,ready:.095,aim:.115,drop:.020,x:.065},grip:[-.015,-.048,-.035],fingerDir:[0,-.94,.34],angle:[.22,.60,.08,.52]}
});
const PIAT={
 trigger:[0,-.155,-.15],support:[0,-.115,.11],
 muzzle:[0,.055,.49],shoulder:[0,-.045,-.40],
 triggerAxis:[0,.97,.24],supportAxis:[0,.92,.40],
 triggerPalm:[-.8,0,-.6],supportPalm:[.8,0,-.6]
};
  function proceduralPiat(scene,parent){
    const B=window.BABYLON;
    const v=a=>new B.Vector3(a[0],a[1],a[2]);
    const meshes=[],mats=[];
    const makeMat=(name,hex,metallic)=>{
      const m=new B.PBRMaterial(name,scene);
      m.albedoColor=B.Color3.FromHexString(hex);m.metallic=metallic;m.roughness=.73;
      mats.push(m);return m;
    };
    const steel=makeMat('uk-piat-steel','#515b48',.55);
    const dark=makeMat('uk-piat-dark','#252b25',.28);
    const canvas=makeMat('uk-piat-pad','#615f4d',.03);
    function put(mesh,xyz,material,rotation){
      mesh.parent=parent;mesh.position.copyFrom(v(xyz));
      if(rotation)mesh.rotation.copyFrom(v(rotation));
      mesh.material=material;meshes.push(mesh);
    }
    const box=(n,size,at,mat,rot)=>put(B.MeshBuilder.CreateBox(n,{
      width:size[0],height:size[1],depth:size[2]},scene),at,mat,rot);
    const tube=(n,diam,len,at,mat)=>put(B.MeshBuilder.CreateCylinder(n,{
      diameter:diam,height:len,tessellation:12},scene),at,mat,[Math.PI/2,0,0]);
    tube('PIAT spring body',.125,.67,[0,0,-.075],steel);
    tube('PIAT forward mortar spigot',.065,.29,[0,0,.40],dark);
    box('PIAT open bomb tray',[.145,.034,.31],[0,-.055,.365],steel);
    box('PIAT tray left wall',[.025,.075,.31],[-.067,-.011,.365],steel);
    box('PIAT tray right wall',[.025,.075,.31],[.067,-.011,.365],steel);
    box('PIAT shoulder stock',[.165,.125,.23],[0,-.040,-.40],steel);
    box('PIAT rubber butt',[.17,.17,.040],[0,-.045,-.525],canvas);
    box('PIAT trigger assembly',[.085,.095,.14],[0,-.122,-.16],dark);
    box('PIAT grip',[.060,.155,.055],[0,-.204,-.16],canvas);
    box('PIAT forward support',[.075,.095,.07],[0,-.145,.11],canvas);
    box('PIAT folding monopod',[.022,.28,.022],[0,-.175,.38],steel);
    box('PIAT rear sight',[.025,.070,.020],[0,.10,-.28],dark);
    return ()=>{for(const mesh of meshes)mesh.dispose();
      for(const mat of mats)mat.dispose();};
  }
const DONOR={
 ready:{
  right:{dir:[.10,-.75,.65],palm:[1,0,0],pole:[-1,-.6,-.4]},
  left:{dir:[-.35,.05,.93],palm:[0,1,0],pole:[.6,-1,0]}
 },
 aim:{
  right:{dir:[.10,-.55,.83],palm:[1,0,0],pole:[-1,-.9,-.2]},
  left:{dir:[-.35,.20,.91],palm:[0,1,0],pole:[.4,-1,0]}
 }
};
function stripArmTracks(groups){
 let count=0;
 for(const g of groups||[]){
  for(let i=(g.targetedAnimations||[]).length-1;i>=0;i--){
   if(ARMS.has(CANON(g.targetedAnimations[i]?.target?.name))){
    g.targetedAnimations.splice(i,1);count++;
   }
  }
 }
 return count;
}
async function create({scene,imported,stage,weaponRoot="../assets/ww2-weapons/",initialWeaponId="uk-lee-enfield"}){
 const B=window.BABYLON;
 if(!B?.SceneLoader||!stage||!scene)throw Error("Babylon.js / scene missing");
 if(imported?.skeletons?.length!==1||imported.skeletons[0].bones.length!==65)
  throw Error("Expected original American 65-bone skeleton");
 const bones=imported.skeletons[0].bones;
 const byName=new Map();
 for(const b of bones){
  const node=b.getTransformNode?.();
  if(node){const key=CANON(node.name);
   if(byName.has(key))throw Error("Duplicate glTF joint "+key);
   byName.set(key,node);
  }
 }
 const find=name=>{
  const n=byName.get(CANON(name));
  if(!n)throw Error("No original joint "+name);
  return n;
 };
 const limbs={};
 for(const side of ["right","left"]){
  const p=side==="right"?"Right":"Left";
  limbs[side]={
   shoulder:find(p+"Shoulder"),
   upper:find(p+"Arm"),
   fore:find(p+"ForeArm"),
   hand:find(p+"Hand"),
   socket:find("Weapon_"+p[0]),
   index:find(p+"HandIndex1"),
   middle:find(p+"HandMiddle1"),
   pinky:find(p+"HandPinky1"),
   thumb:find(p+"HandThumb2")
  };
 }
 const chest=find("Spine2"),neck=find("Neck"),hips=find("Hips");
 const fingerNames=[...byName.keys()].filter(k=>/^(right|left)hand(index|middle|ring|pinky|thumb)[123]$/.test(k));
 const joints=[...new Set([...Object.values(limbs).flatMap(a=>[a.shoulder,a.upper,a.fore,a.hand]),...fingerNames.map(n=>byName.get(n))])];
 const rest=new Map(joints.map(n=>{
  if(!n.rotationQuaternion)n.rotationQuaternion=B.Quaternion.FromEulerAngles(n.rotation.x,n.rotation.y,n.rotation.z);
  return [n,n.rotationQuaternion.clone()];
 }));
 const v=(x,y,z)=>new B.Vector3(x,y,z);
 const arr=a=>v(...a);
 function refresh(n){
  const parents=[];for(let z=n;z;z=z.parent)parents.unshift(z);
  for(const z of parents)z.computeWorldMatrix(true);
 }
 function worldRot(n){
  refresh(n);const q=B.Quaternion.Identity();
  n.getWorldMatrix().decompose(undefined,q,undefined);
  return q.normalize();
 }
 function rotate(x,q){
  const m=B.Matrix.Identity();
  B.Matrix.FromQuaternionToRef(q,m);
  return B.Vector3.TransformNormal(x,m);
 }
 function basis(forward,palm){
  const z=forward.clone().normalize();
  const x=palm.subtract(z.scale(B.Vector3.Dot(palm,z))).normalize();
  const y=B.Vector3.Cross(z,x).normalize();
  const m=B.Matrix.Identity();
  B.Matrix.FromXYZAxesToRef(x,y,z,m);
  return B.Quaternion.FromRotationMatrix(m).normalize();
 }
 function setWorldRot(node,q){
  const parentQ=node.parent?worldRot(node.parent):B.Quaternion.Identity();
  node.rotationQuaternion=parentQ.conjugate().multiply(q).normalize();
  refresh(node);
 }
 function qFromTo(a,b){
  if(a.lengthSquared()<1e-10||b.lengthSquared()<1e-10)return B.Quaternion.Identity();
  const u=a.normalize(),w=b.normalize(),d=B.Scalar.Clamp(B.Vector3.Dot(u,w),-1,1);
  if(d>.999999)return B.Quaternion.Identity();
  if(d<-.99999){
   let axis=B.Vector3.Cross(u,B.Axis.X);
   if(axis.lengthSquared()<1e-5)axis=B.Vector3.Cross(u,B.Axis.Y);
   return B.Quaternion.RotationAxis(axis.normalize(),Math.PI);
  }
  const axis=B.Vector3.Cross(u,w).normalize();
  return B.Quaternion.RotationAxis(axis,Math.acos(d));
 }
 function setBoneToward(node,end,target){
  refresh(end);refresh(node);
  const a=node.getAbsolutePosition();
  const from=end.getAbsolutePosition().subtract(a);
  const to=target.subtract(a);
  const delta=qFromTo(from,to);
  setWorldRot(node,delta.multiply(worldRot(node)).normalize());
 }
 function solveLimb(arm,wristGoal,pole){
  refresh(arm.hand);refresh(arm.fore);refresh(arm.upper);
  const S=arm.upper.getAbsolutePosition().clone();
  const E=arm.fore.getAbsolutePosition().clone();
  const W=arm.hand.getAbsolutePosition().clone();
  const l1=B.Vector3.Distance(S,E),l2=B.Vector3.Distance(E,W);
  const diff=wristGoal.subtract(S),actual=diff.length();
  const dist=B.Scalar.Clamp(actual,Math.abs(l1-l2)+.001,l1+l2-.005);
  if(actual<1e-7)throw Error("Degenerate shoulder-to-wrist IK");
  const aim=diff.normalize(),a=(l1*l1-l2*l2+dist*dist)/(2*dist);
  const h=Math.sqrt(Math.max(0,l1*l1-a*a));
  const outward=pole.subtract(S);
  const perp=outward.subtract(aim.scale(B.Vector3.Dot(outward,aim)));
  if(perp.lengthSquared()<1e-7)throw Error("Invalid elbow pole");
  const elbowGoal=S.add(aim.scale(a)).add(perp.normalize().scale(h));
  setBoneToward(arm.upper,arm.fore,elbowGoal);
  setBoneToward(arm.fore,arm.hand,wristGoal);
  refresh(arm.hand);
  return {
   error:B.Vector3.Distance(wristGoal,arm.hand.getAbsolutePosition()),
   reachable:actual<=l1+l2-.002,
   reach:l1+l2
  };
 }
 // Build a persistent transform from each original hand's *real joint landmarks*
 // to the anatomical axes. We never assume glTF Hand local Y is the finger axis.
 const calibrations={};
 for(const [side,arm] of Object.entries(limbs)){
  refresh(arm.hand);refresh(arm.index);refresh(arm.pinky);refresh(arm.middle);refresh(arm.thumb);refresh(arm.socket);
  const handWorld=worldRot(arm.hand);
  const across=arm.index.getAbsolutePosition().subtract(arm.pinky.getAbsolutePosition()).normalize();
  const forward=arm.middle.getAbsolutePosition().subtract(arm.hand.getAbsolutePosition()).normalize();
  let palm=B.Vector3.Cross(across,forward).normalize();
  const thumb=arm.thumb.getAbsolutePosition().subtract(arm.hand.getAbsolutePosition());
  if(B.Vector3.Dot(palm,thumb)<0)palm.scaleInPlace(-1);
  const srcBasis=basis(forward,palm);
  const localBasis=handWorld.conjugate().multiply(srcBasis).normalize();
  const socketLocalOffset=rotate(arm.socket.getAbsolutePosition().subtract(arm.hand.getAbsolutePosition()),
                                  handWorld.conjugate());
  calibrations[side]={localBasis,socketLocalOffset};
 }
 const stoppedTracks=stripArmTracks(imported.animationGroups);
 if(stoppedTracks!==32)throw Error("Expected 32 conflicting arm tracks, got "+stoppedTracks);
 const poseGroups=imported.animationGroups;
 poseGroups.forEach(g=>g.stop());
 const gunMetaResponse=await fetch(weaponRoot+"manifest.json");
 if(!gunMetaResponse.ok)throw Error("Weapon metadata HTTP "+gunMetaResponse.status);
 const manifest=(await gunMetaResponse.json()).weapons||{};
 if(!PROFILES[initialWeaponId])throw Error("Unknown Allied weapon "+initialWeaponId);
 let weaponId=initialWeaponId, weaponProfile=PROFILES[weaponId];
 let m=weaponId==="uk-piat"?PIAT:manifest[weaponId];
 const isValidMeta=x=>x&&["trigger","shoulder","support","muzzle","triggerPalm","supportPalm","supportAxis"].every(k=>Array.isArray(x[k]));
 if(!isValidMeta(m))throw Error("No source weapon grip metadata: "+weaponId);
 const pivot=new B.TransformNode("us-stage7-allied-weapon-Weapon_R",scene);
 pivot.rotationQuaternion=B.Quaternion.Identity();
 // A weapon-owned support socket follows right wrist automatically.
 const supportSocket=new B.TransformNode("us-stage7-allied-foreend-L",scene);
 supportSocket.parent=pivot;
 supportSocket.rotationQuaternion=basis(arr(m.supportAxis),arr(m.supportPalm).scale(-1));
 let resource=null,weaponMeshCount=0;
 async function loadWeapon(id){
  const cfg=PROFILES[id];
  if(!cfg)throw Error("Unrecognized Allied weapon "+id);
  if(cfg.file){
   const pack=await B.SceneLoader.LoadAssetContainerAsync("",weaponRoot+cfg.file,scene);
   return {type:"GLB",pack,attach(){
    pack.addAllToScene();
    for(const node of [...pack.meshes,...pack.transformNodes])
      if(!node.parent)node.parent=pivot;
    return pack.meshes.filter(x=>x.getTotalVertices?.()>0).length;
   },dispose(){pack.dispose();}};
  }
  return {type:"procedural",pack:null,attach(){
   const meshCountBefore=scene.meshes.length;
   this.cleanup=proceduralPiat(scene,pivot);
   return scene.meshes.length-meshCountBefore;
  },dispose(){this.cleanup?.();}};
 }
 resource=await loadWeapon(initialWeaponId);
 weaponMeshCount=resource.attach();
 let mode="ready",stopped=false,mounted=false;
 let combatRecoil=0,combatReloadPhase=0,combatReloadActive=false;
 let mountLocalPosition=null,mountLocalRotation=null;
 const fingerControls={base:-1.12,middle:-.94,distal:-.50,thumbBase:-.84,thumbMiddle:-.78,thumbDistal:-.40};
 // Rifle space (metres): move the dominant palm below and behind the trigger,
 // so the hand itself is not occulted by the wooden stock and receiver.
 const handFits=Object.freeze({
   standard:{grip:[-.012,-.055,-.065],dir:[0,-.95,.31]},
   outboard:{grip:[-.055,-.050,-.060],dir:[-.08,-.94,.30]},
   wrapped:{grip:[-.034,-.065,-.091],dir:[0,-.85,.52]}
 });
 let handFit=handFits.standard;
 // Actual per-weapon offsets are derived only from the selected profile.
 // v9 fallback applies to Lee-Enfield and is not copied to Sten/Bren/PIAT.
 // Three experimentally bounded positions INSIDE the original Lee-Enfield
 // wooden fore-end. No new geometry / no separate arms.
 const supportProfiles=Object.freeze({
  standard:{x:0,drop:.052,readyZ:.22,aimZ:.255},
  near:{x:-.012,drop:.055,readyZ:.185,aimZ:.215},
  forward:{x:.008,drop:.050,readyZ:.265,aimZ:.293}
 });
 let supportProfile="standard";
 const state={ready:true,mode,armChannelsRemoved:stoppedTracks,fingerControls,
  weaponId,weaponLabel:weaponProfile.label,weaponSource:weaponProfile.source,
  weaponMeshCount,weaponSwitchCount:0,weaponReady:true,
  combatRecoil:0,combatReloadPhase:0,combatReloadActive:false,
  rightGripMeters:Infinity,leftGripMeters:Infinity,
  rightPalmErrorDeg:Infinity,leftPalmErrorDeg:Infinity,
  rightFingerErrorDeg:Infinity,leftFingerErrorDeg:Infinity,
  rightIKMeters:Infinity,leftIKMeters:Infinity,
  supportAlongBarrelMeters:0,stockToShoulderMeters:Infinity,
  rightReachable:false,leftReachable:false,rightHandVariant:"standard",
  socketAttached:false,socketName:null,mountCount:0,
  socketLocalDriftMeters:Infinity,socketLocalRotationErrorDeg:Infinity,
  weaponGripDistanceMeters:Infinity,
  leftSupportProfile:"standard",supportSocketName:supportSocket.name,
  supportSocketParent:pivot.name,supportSocketLocalZ:0,
  supportSocketLocalDropMeters:0,supportSocketErrorMeters:Infinity,
  supportWithinHandguard:false,leftElbowAngleDeg:Infinity,
  leftElbowPoleSideMeters:Infinity,
  error:null};
 const V=(p,q)=>rotate(arr(p),q);
 function bodyFrame(){
  refresh(limbs.left.upper);refresh(limbs.right.upper);refresh(neck);refresh(hips);
  const x=limbs.left.upper.getAbsolutePosition().subtract(limbs.right.upper.getAbsolutePosition()).normalize();
  let y=neck.getAbsolutePosition().subtract(hips.getAbsolutePosition());
  y=y.subtract(x.scale(B.Vector3.Dot(y,x))).normalize();
  const z=B.Vector3.Cross(x,y).normalize();
  const matrix=B.Matrix.Identity();B.Matrix.FromXYZAxesToRef(x,y,z,matrix);
  return {q:B.Quaternion.FromRotationMatrix(matrix).normalize(),x,y,z};
 }
 function goalOrientation(arm,side,gQ,bQ){
  const target=DONOR[mode][side];
  // Ara supplies elbow/finger stance. The actual Lee-Enfield author supplies
  // the trigger and handguard palm normals. Do not face both open palms outward.
  // Right hand: the rifle is the reference frame, not the torso. The former
  // Ara diagonal drove index/middle fingers sideways under the receiver.
  const dir=side==="right"?V(weaponId==="uk-lee-enfield"?handFit.dir:weaponProfile.fingerDir,gQ).normalize():V(m.supportAxis,gQ).normalize();
  // SUPPORT: the left hand must CUP the underside of the wooden fore-end.
  // Previous v5 used manifest's downward normal and posed the palm ON TOP.
  const palm=side==="right"?V(m.triggerPalm,gQ).normalize():V(m.supportPalm,gQ).scale(-1).normalize();
  const anatomical=basis(dir,palm);
  const boneWorld=anatomical.multiply(calibrations[side].localBasis.conjugate()).normalize();
  const gripOffset=rotate(calibrations[side].socketLocalOffset,boneWorld);
  return {boneWorld,gripOffset,dir,palm};
 }
 function angleDeg(a,b){
  return Math.acos(B.Scalar.Clamp(B.Vector3.Dot(a.normalize(),b.normalize()),-1,1))*180/Math.PI;
 }
 function actualHandFrame(arm){
  refresh(arm.hand);refresh(arm.index);refresh(arm.middle);refresh(arm.pinky);refresh(arm.thumb);
  const forward=arm.middle.getAbsolutePosition().subtract(arm.hand.getAbsolutePosition()).normalize();
  const cross=arm.index.getAbsolutePosition().subtract(arm.pinky.getAbsolutePosition()).normalize();
  let palm=B.Vector3.Cross(cross,forward).normalize();
  if(B.Vector3.Dot(palm,arm.thumb.getAbsolutePosition().subtract(arm.hand.getAbsolutePosition()))<0)palm.scaleInPlace(-1);
  return {forward,palm};
 }
 // Corrected curl sign verified by seven on-screen comparisons.
 // Curl around the real two-handed rifle grip. Each phalanx has real vertex
 // weights now; use proximal/middle/distal degrees of freedom independently.
 // Critical: fingers bend into the palm, the thumb opposes the four fingers.
 
 function foldFinger(name){
  const match=/^(right|left)hand(index|middle|ring|pinky|thumb)([123])$/.exec(name);
  if(!match)return;
  const side=match[1],kind=match[2],seg=Number(match[3]);
  const node=byName.get(name);
  const next=byName.get(name.slice(0,-1)+(seg+1));
  const prev=seg>1?byName.get(name.slice(0,-1)+(seg-1)):byName.get(side+"hand");
  if(!node||!rest.has(node))return;
  refresh(node);
  if(next)refresh(next);
  if(prev)refresh(prev);
  const direction=(next?next.getAbsolutePosition().subtract(node.getAbsolutePosition()):
                          node.getAbsolutePosition().subtract(prev.getAbsolutePosition())).normalize();
  // The finger's hinge axis in world space, projected toward its desired palm.
  const palm=calibrations[side].lastPalm;
  const wanted=kind==="thumb"?palm.clone():palm.scale(-1);
  const hinge=B.Vector3.Cross(direction,wanted);
  if(hinge.lengthSquared()<1e-8)return;
  const angle=kind==="thumb"
    ?(seg===1?fingerControls.thumbBase:seg===2?fingerControls.thumbMiddle:fingerControls.thumbDistal)
    :(seg===1?fingerControls.base:seg===2?fingerControls.middle:fingerControls.distal);
  const localAxis=rotate(hinge.normalize(),worldRot(node).conjugate()).normalize();
  node.rotationQuaternion=node.rotationQuaternion.multiply(B.Quaternion.RotationAxis(localAxis,angle)).normalize();
  if(next)refresh(next);
 }

 function update(){
  if(stopped)return;
  try{
   for(const [node,q] of rest)node.rotationQuaternion=q.clone();
   const body=bodyFrame();
   const a=weaponProfile.angle;
   const gunQ=body.q.multiply(B.Quaternion.FromEulerAngles(mode==="aim"?a[2]:a[0],mode==="aim"?a[3]:a[1],0)).normalize();
   const right=limbs.right,left=limbs.left;
   // Anchor a rigid stock to the actual RIGHT shoulder; weapon then owns its grips.
   const stockPoint=right.shoulder.getAbsolutePosition()
     .add(body.x.scale(.045)).add(body.y.scale(mode==="aim"?-.045:-.07))
     .add(body.z.scale(.025));
   // The shoulder defines the intended combat stance. It is NOT the weapon
   // attachment: once the right wrist is solved, the weapon is a true child
   // of the approved model's linked mixamorig:Weapon_R joint.
   const referenceOrigin=stockPoint.subtract(V(m.shoulder,gunQ));
   if(!mounted){
    pivot.rotationQuaternion.copyFrom(gunQ);
    pivot.position.copyFrom(referenceOrigin);
    refresh(pivot);
   }
   const trigger=referenceOrigin.add(V(m.trigger,gunQ));
   const orientationR=goalOrientation(right,"right",gunQ,body.q);
   // Additive recoil affects the *actual right wrist*, not the gun pivot.
   // The hard-mounted weapon follows its hand. This preserves Stage5 local
   // socket coordinates while a short shot impulse moves the entire rifle.
   const rGrip=trigger.add(V(weaponId==="uk-lee-enfield"?handFit.grip:weaponProfile.grip,gunQ))
      .add(V([0,.002*combatRecoil,-.016*combatRecoil],gunQ));
   const rWrist=rGrip.subtract(orientationR.gripOffset);
   const poleR=right.upper.getAbsolutePosition()
      .add(V(DONOR[mode].right.pole,body.q).scale(.27));
   const rSolve=solveLimb(right,rWrist,poleR);
   setWorldRot(right.hand,orientationR.boneWorld);
   refresh(right.socket);
   if(!mounted){
    // Babylon TransformNode.setParent preserves the current world transform
    // while converting it into the socket's LOCAL transform. The relative
    // transform is calibrated only once, not rewritten every render frame.
    // This prevents shoulder/weapon drift and avoids any visual clone meshes.
    pivot.setParent(right.socket);
    if(pivot.parent!==right.socket)throw Error("Weapon_R parenting failed");
    mountLocalPosition=pivot.position.clone();
    mountLocalRotation=pivot.rotationQuaternion.clone();
    mounted=true;
    state.mountCount++;
    state.socketAttached=true;state.socketName=right.socket.name;
   }
   refresh(pivot);
   const actualWeaponQ=worldRot(pivot);
   const actualWeaponOrigin=pivot.getAbsolutePosition().clone();
   // The LEFT hand always follows the *actual* gun's dedicated socket.
   // We do not attach the hand to the gun (that would cause an IK parent
   // cycle); only its world-space target comes from the gun's fore-end.
   // Orient the palm from the rifle-local wooden stock direction, including
   // any model turn / root animation. No old German pose coordinates.
   const s=weaponProfile.support;
   const originalSupport=supportProfiles[supportProfile];
   const adjust=weaponId==="uk-lee-enfield"?originalSupport:null;
   const minZ=s.min,maxZ=s.max;
   const preferredZ=mode==="aim"?(adjust?.aimZ??s.aim):(adjust?.readyZ??s.ready);
   let z=B.Scalar.Clamp(preferredZ,minZ,maxZ);
   const drop=adjust?.drop??s.drop,offsetX=adjust?.x??s.x;
   // A lightweight preview reload gesture shifts the supporting hand
   // toward the breech, while its elbow follows through IK.
   // Not a replacement for licensed/authored weapon reload animations.
   const reachForMagazine=combatReloadActive?
      Math.sin(Math.PI*B.Scalar.Clamp(combatReloadPhase,0,1)):0;
   z=B.Scalar.Clamp(z-.045*reachForMagazine,minZ,maxZ);
   supportSocket.position.set(
      offsetX+.012*reachForMagazine,
      m.support[1]-drop-.033*reachForMagazine,z);
   refresh(supportSocket);
   const leftShoulder=left.upper.getAbsolutePosition().clone();
   const shoulderToElbow=B.Vector3.Distance(leftShoulder,left.fore.getAbsolutePosition());
   const elbowToWrist=B.Vector3.Distance(left.fore.getAbsolutePosition(),left.hand.getAbsolutePosition());
   const armReach=shoulderToElbow+elbowToWrist;
   let lGrip,lWrist,orientationL;
   // Prefer the requested grip along the wooden fore-end; when unreachable
   // move toward the receiver, never stretch or dislocate the forearm.
   for(let n=0;n<32;n++){
    supportSocket.position.z=z;
    refresh(supportSocket);
    const supportQ=worldRot(supportSocket);
    const boneWorld=supportQ.multiply(calibrations.left.localBasis.conjugate()).normalize();
    const gripOffset=rotate(calibrations.left.socketLocalOffset,boneWorld);
    lGrip=supportSocket.getAbsolutePosition().clone();
    lWrist=lGrip.subtract(gripOffset);
    orientationL={boneWorld,
      dir:rotate(B.Axis.Z,supportQ).normalize(),
      palm:rotate(B.Axis.X,supportQ).normalize()};
    if(B.Vector3.Distance(leftShoulder,lWrist)<armReach*.965||z<=minZ+.001)break;
    z=Math.max(minZ,z-.004);
   }
   // Stable arm-side pole controls the bend direction. The shoulder/forearm
   // chain is solved analytically: wrist position and elbow plane are separate.
   const poleL=left.upper.getAbsolutePosition().add(V(DONOR[mode].left.pole,body.q).scale(.30));
   const lSolve=solveLimb(left,lWrist,poleL);
   setWorldRot(left.hand,orientationL.boneWorld);
   refresh(left.upper);refresh(left.fore);refresh(left.hand);
   const elbow=left.fore.getAbsolutePosition(),shoulder=left.upper.getAbsolutePosition(),
         wrist=left.hand.getAbsolutePosition();
   const upperRay=shoulder.subtract(elbow).normalize();
   const foreRay=wrist.subtract(elbow).normalize();
   const elbowAngle=Math.acos(B.Scalar.Clamp(B.Vector3.Dot(upperRay,foreRay),-1,1))*180/Math.PI;
   // Elbow pole and arm should remain on the body's left/outboard side.
   state.leftElbowAngleDeg=elbowAngle;
   state.leftElbowPoleSideMeters=B.Vector3.Dot(elbow.subtract(shoulder),body.x);
   // Curl each original finger using joint-native axes (no duplicate hand meshes).
   calibrations.right.lastPalm=orientationR.palm;
   calibrations.left.lastPalm=orientationL.palm;
   for(const name of fingerNames)foldFinger(name);
   refresh(right.socket);refresh(left.socket);
   const rf=actualHandFrame(right),lf=actualHandFrame(left);
   const trueTrigger=actualWeaponOrigin.add(V(m.trigger,actualWeaponQ));
   const trueDominantGrip=trueTrigger.add(V(weaponId==="uk-lee-enfield"?handFit.grip:weaponProfile.grip,actualWeaponQ));
   state.rightGripMeters=B.Vector3.Distance(right.socket.getAbsolutePosition(),trueDominantGrip);
   state.weaponGripDistanceMeters=state.rightGripMeters;
   state.leftGripMeters=B.Vector3.Distance(left.socket.getAbsolutePosition(),lGrip);
   state.supportSocketErrorMeters=B.Vector3.Distance(
      left.socket.getAbsolutePosition(),supportSocket.getAbsolutePosition());
   state.supportSocketLocalZ=z;
   state.supportSocketLocalDropMeters=drop;
   state.supportWithinHandguard=z>=minZ-1e-6&&z<=maxZ+1e-6;
   state.leftSupportProfile=supportProfile;
   if(supportSocket.parent!==pivot)throw Error("Left support grip escaped rifle parent");
   if(!state.supportWithinHandguard)throw Error("Left support grip outside "+weaponProfile.label+" fore-end");
   state.stockToShoulderMeters=B.Vector3.Distance(
      actualWeaponOrigin.add(V(m.shoulder,actualWeaponQ)),stockPoint);
   state.socketLocalDriftMeters=B.Vector3.Distance(pivot.position,mountLocalPosition);
   const q0=pivot.rotationQuaternion,q1=mountLocalRotation;
   // Babylon.js quaternions are often unit-length only within machine
   // tolerance. Dot(q,q) can be 0.999999993 despite identical components.
   // Normalize the DOT by both norms, otherwise a genuine zero-drift weapon
   // intermittently fails with a fake 0.013° angular deviation.
   const q0n=Math.hypot(q0.x,q0.y,q0.z,q0.w);
   const q1n=Math.hypot(q1.x,q1.y,q1.z,q1.w);
   const qDot=Math.abs(B.Quaternion.Dot(q0,q1)/(q0n*q1n));
   state.socketLocalRotationErrorDeg=2*Math.acos(B.Scalar.Clamp(qDot,-1,1))*180/Math.PI;
   if(pivot.parent!==right.socket)throw Error("Weapon detached from Weapon_R");
   if(state.socketLocalDriftMeters>.00001 || state.socketLocalRotationErrorDeg>.01)
     throw Error("Weapon socket local attachment changed unexpectedly "+weaponId+" position="+state.socketLocalDriftMeters+" rotationDeg="+state.socketLocalRotationErrorDeg+" current="+pivot.position.asArray()+" stored="+mountLocalPosition.asArray());
   state.rightIKMeters=rSolve.error;state.leftIKMeters=lSolve.error;
   state.rightReachable=rSolve.reachable;state.leftReachable=lSolve.reachable;
   state.rightPalmErrorDeg=angleDeg(rf.palm,orientationR.palm);
   state.leftPalmErrorDeg=angleDeg(lf.palm,orientationL.palm);
   state.rightFingerErrorDeg=angleDeg(rf.forward,orientationR.dir);
   state.leftFingerErrorDeg=angleDeg(lf.forward,orientationL.dir);
   state.supportAlongBarrelMeters=z;
   state.combatRecoil=combatRecoil;
   state.combatReloadActive=combatReloadActive;
   state.combatReloadPhase=combatReloadPhase;
   state.weaponId=weaponId;
   state.weaponLabel=weaponProfile.label;
   state.mode=mode;state.error=null;
  }catch(e){state.error=String(e?.message||e);console.error("Stage4 rifle pose",e);}
 }
 const observer=scene.onBeforeRenderObservable.add(update);
 update();
 return {
  report:state,
  setRightGripVariant(id){
   if(weaponId!=="uk-lee-enfield")throw Error("Right-hand variant editor only applies to Lee-Enfield");
   if(!Object.prototype.hasOwnProperty.call(handFits,id))throw Error("Bad right-hand variant");
   // A new grip profile explicitly recalibrates the socket transform once.
   // Ordinary idle->aim changes never detach the weapon.
   if(mounted){pivot.setParent(null);mounted=false;mountLocalPosition=null;mountLocalRotation=null;}
   handFit=handFits[id];state.rightHandVariant=id;update();return state;
  },
  setSupportProfile(id){
   if(!Object.prototype.hasOwnProperty.call(supportProfiles,id))
     throw Error("Bad rifle support profile");
   supportProfile=id;state.leftSupportProfile=id;update();return state;
  },
  async equipWeapon(nextId){
   if(!PROFILES[nextId])throw Error("Only four approved Allied weapons");
   if(nextId===weaponId)return state;
   if(state.weaponBusy)throw Error("Weapon change already in progress");
   state.weaponBusy=true;state.weaponReady=false;
   let pending=null;
   try{
    const cfg=PROFILES[nextId];
    const meta=nextId==="uk-piat"?PIAT:manifest[nextId];
    if(!isValidMeta(meta))throw Error("No grip metadata for "+nextId);
    // Stage the new asset *before* disposing the old asset, so a missing
    // source GLB does not leave the soldier unarmed.
    pending=await loadWeapon(nextId);
    if(mounted){
      pivot.setParent(null);mounted=false;
      mountLocalPosition=null;mountLocalRotation=null;
    }
    resource?.dispose();
    resource=pending;pending=null;
    weaponMeshCount=resource.attach();
    weaponId=nextId;weaponProfile=cfg;m=meta;
    supportSocket.rotationQuaternion=basis(arr(m.supportAxis),arr(m.supportPalm).scale(-1));
    supportProfile="standard";
    state.leftSupportProfile="standard";
    state.weaponId=weaponId;
    state.weaponLabel=cfg.label;
    state.weaponSource=cfg.source;
    state.weaponMeshCount=weaponMeshCount;
    state.weaponSwitchCount++;
    combatRecoil=0;combatReloadPhase=0;combatReloadActive=false;
    state.socketAttached=false;state.socketName=null;
    update(); // Right mount recalibrates ONCE, left support follows rifle.
    return state;
   }catch(e){
    pending?.dispose();
    state.error=String(e?.message||e);
    throw e;
   }finally{
    state.weaponBusy=false;
    state.weaponReady=true;
   }
  },
  setCombatOverlay({recoil=0,reloadActive=false,reloadPhase=0}={}){
    combatRecoil=B.Scalar.Clamp(Number(recoil)||0,0,1);
    combatReloadActive=!!reloadActive;
    combatReloadPhase=B.Scalar.Clamp(Number(reloadPhase)||0,0,1);
    return {recoil:combatRecoil,reloadActive:combatReloadActive,
      reloadPhase:combatReloadPhase};
  },
  getMuzzleWorld(){
    // Geometry remains parented to the original Weapon_R right-hand bone.
    refresh(pivot);
    const q=worldRot(pivot);
    const p=B.Vector3.TransformCoordinates(arr(m.muzzle),pivot.getWorldMatrix());
    const direction=rotate(B.Axis.Z,q).normalize();
    return {weaponId,position:p.asArray(),direction:direction.asArray()};
  },
  getSupportSocket(){
   refresh(supportSocket);
   return {parent:supportSocket.parent?.name||null,
    name:supportSocket.name,localPosition:supportSocket.position.asArray(),
    worldPosition:supportSocket.getAbsolutePosition().asArray(),
    contactErrorMeters:state.supportSocketErrorMeters,
    elbowAngleDeg:state.leftElbowAngleDeg};
  },
  setPose(next){
   if(!["ready","aim"].includes(next))throw Error("Stage6 supports only ready or aim");
   mode=next;update();return state;
  },
  getWeaponMount(){
   return {attached:mounted,parent:pivot.parent?.name||null,
     localPosition:pivot.position.asArray(),
     localRotation:pivot.rotationQuaternion.asArray(),
     mountCount:state.mountCount};
  },
  dispose(){stopped=true;scene.onBeforeRenderObservable.remove(observer);resource?.dispose();supportSocket.dispose();pivot.dispose();}
 };
}
return Object.freeze({create,stripArmTracks,CANON,DONOR,WEAPON_IDS,PROFILES,PIAT});
});