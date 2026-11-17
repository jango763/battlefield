/* Battlefield / American hero / ONE skin + TWO anatomical hands.
 * This is an independent, iPhone-only experiment; it never uses German pose presets.
 * Babylon glTF joints are linked TransformNodes. Target upper/forearm nodes only.
 * Weapon anchored to right shoulder stock socket, not chest; right wrist drives trigger,
 * left wrist solves fore-end IK. Never add extra hand meshes.
 */
(function(root,factory){
  const api=factory();
  if(root)root.BattlefieldAmericanTwoHandIK=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const CANON=n=>String(n||"").replace(/^mixamorig[:_]?/i,"").replace(/[^a-zA-Z0-9]/g,"").toLowerCase();
const ARMS=new Set(["leftshoulder","leftarm","leftforearm","lefthand",
 "rightshoulder","rightarm","rightforearm","righthand"]);
const GUNS=Object.freeze({
 "uk-lee-enfield":{label:"Lee-Enfield",file:"uk-lee-enfield.glb",supportZ:.20},
 "uk-sten":{label:"Sten",file:"uk-sten.glb",supportZ:.18},
 "uk-bren":{label:"Bren",file:"uk-bren.glb",supportZ:.17},
 "uk-piat":{label:"PIAT",file:null,supportZ:.11,prototype:true}
});
const PIAT={trigger:[0,-.155,-.15],support:[0,-.115,.11],
 muzzle:[0,.055,.49],shoulder:[0,-.045,-.40]};
// Ara 3D Gen shooter reference positions and palm vectors (MIT).
// We retarget the direction and handedness, NOT foreign local bone rotations.
// https://github.com/olatunde85/3d-gen/blob/main/src/core/anim/clips/shooter.ts
// Measured target poses from Ara 3D Gen (MIT), shooter.ts.
// Weapon is attached after solving the dominant hand; non-dominant hand uses
// its actual support socket on the source GLB weapon. No German coordinates.
const ARA_RIFLE={
 ready:{
  Right:{pos:[-.15,-.36,.17],pole:[-1,-.6,-.4],dir:[.1,-.75,.65],palm:[1,0,0]},
  Left:{pos:[.03,-.42,.4],pole:[.6,-1,0],dir:[-.35,.05,.93],palm:[0,1,0]}
 },
 aim:{
  Right:{pos:[-.13,-.19,.22],pole:[-1,-.9,-.2],dir:[.1,-.55,.83],palm:[1,0,0]},
  Left:{pos:[-.01,-.13,.5],pole:[.4,-1,0],dir:[-.35,.2,.91],palm:[0,1,0]}
 },
 sprint:{
  Right:{pos:[-.17,-.42,.13],pole:[-1,-.5,-.5],dir:[.3,-.75,.55],palm:[1,0,0]},
  Left:{pos:[.12,-.2,.27],pole:[.8,-1,0],dir:[-.6,.35,.7],palm:[0,1,0]}
 }
};
  function proceduralPiat(scene,parent){
    const B=window.BABYLON;
    const v=a=>new B.Vector3(...a);
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
function stripArmTracks(groups){
 let removed=0;
 for(const group of groups||[]){
  // Prevent TWO writers from rotating wrists/shoulders in the same frame:
  // Quaternius provides legs+torso; the clean grip drives the arm chains.
  const tracks=group.targetedAnimations;
  if(!Array.isArray(tracks))throw Error("AnimationGroup targetedAnimations unavailable");
  for(let i=tracks.length-1;i>=0;i--){
   const canonical=CANON(tracks[i]?.target?.name);
   if(ARMS.has(canonical)){tracks.splice(i,1);removed++;}
  }
 }
 return removed;
}
function create({scene,imported,root:actorRoot,state,weaponRoot="../assets/ww2-weapons/"}){
 const B=window.BABYLON;
 if(!B?.SceneLoader||!scene||!actorRoot)throw Error("Babylon.js scene missing");
 if((imported?.skeletons||[]).length!==1)
  throw Error("A single 65-bone American hero skeleton is required");
 const skeleton=imported.skeletons[0];
 if(skeleton.bones.length!==65)throw Error("Wrong hero skeleton: "+skeleton.bones.length);
 const jointMap=new Map();
 for(const bone of skeleton.bones){
  const node=bone.getTransformNode?.();
  const key=CANON(node?.name||bone.name);
  if(!key||!node)continue;
  if(jointMap.has(key))throw Error("Duplicate linked joint "+key);
  jointMap.set(key,node);
 }
 const find=k=>{const value=jointMap.get(CANON(k));if(!value)throw Error("Missing American joint "+k);return value};
 const left={shoulder:find("LeftShoulder"),upper:find("LeftArm"),
  fore:find("LeftForeArm"),hand:find("LeftHand")};
 const right={shoulder:find("RightShoulder"),upper:find("RightArm"),
  fore:find("RightForeArm"),hand:find("RightHand")};
 const chest=find("Spine2"),hips=find("Hips"),neck=find("Neck");
 const fingers=[...jointMap].filter(([name])=>/^(left|right)hand(thumb|index|middle|ring|pinky)[123]$/.test(name));
 const V=(x,y,z)=>new B.Vector3(x,y,z);
 function refresh(node){
  const parents=[];
  for(let n=node;n;n=n.parent)parents.unshift(n);
  for(const n of parents)n.computeWorldMatrix(true);
 }
 function worldRotation(node){
  refresh(node);
  const q=B.Quaternion.Identity();
  node.getWorldMatrix().decompose(undefined,q,undefined);
  return q.normalize();
 }
 function rotate(vec,q){
  const m=B.Matrix.Identity();
  B.Matrix.FromQuaternionToRef(q,m);
  return B.Vector3.TransformNormal(vec,m);
 }
 function adjustJoint(joint,end,goal,maxAngle){
  refresh(end);
  const origin=joint.getAbsolutePosition();
  const from=end.getAbsolutePosition().subtract(origin);
  const to=goal.subtract(origin);
  if(from.lengthSquared()<1e-8||to.lengthSquared()<1e-8)return;
  from.normalize();to.normalize();
  const cross=B.Vector3.Cross(from,to),m=cross.length();
  if(m<1e-7)return;
  const angle=Math.min(maxAngle,Math.atan2(m,B.Vector3.Dot(from,to)));
  const qWorld=B.Quaternion.RotationAxis(cross.scale(1/m),angle);
  const parentQ=joint.parent?worldRotation(joint.parent):B.Quaternion.Identity();
  const localQ=parentQ.conjugate().multiply(qWorld).multiply(parentQ);
  joint.rotationQuaternion=localQ.multiply(joint.rotationQuaternion||
   B.Quaternion.FromEulerAngles(joint.rotation.x,joint.rotation.y,joint.rotation.z)).normalize();
 }
 function elbowPole(arm,pole){
  refresh(arm.hand);
  const a=arm.upper.getAbsolutePosition(),elbow=arm.fore.getAbsolutePosition(),wrist=arm.hand.getAbsolutePosition();
  const axis=wrist.subtract(a);if(axis.lengthSquared()<1e-7)return;
  axis.normalize();
  const project=v=>v.subtract(axis.scale(B.Vector3.Dot(axis,v)));
  const u=project(elbow.subtract(a)),v=project(pole.subtract(a));
  if(u.lengthSquared()<1e-8||v.lengthSquared()<1e-8)return;
  u.normalize();v.normalize();
  const delta=B.Scalar.Clamp(Math.atan2(B.Vector3.Dot(axis,B.Vector3.Cross(u,v)),
   B.Scalar.Clamp(B.Vector3.Dot(u,v),-1,1)),-.20,.20);
  const parentQ=arm.upper.parent?worldRotation(arm.upper.parent):B.Quaternion.Identity();
  const turn=B.Quaternion.RotationAxis(axis,delta);
  arm.upper.rotationQuaternion=parentQ.conjugate().multiply(turn).multiply(parentQ)
    .multiply(arm.upper.rotationQuaternion).normalize();
 }
 function solveArm(arm,goal,pole){
  refresh(arm.hand);
  const shoulder=arm.upper.getAbsolutePosition();
  const upperLen=B.Vector3.Distance(shoulder,arm.fore.getAbsolutePosition());
  const lowerLen=B.Vector3.Distance(arm.fore.getAbsolutePosition(),arm.hand.getAbsolutePosition());
  const maxReach=upperLen+lowerLen-.012;
  const direction=goal.subtract(shoulder);
  const actual=direction.length();
  const target=actual>maxReach&&maxReach>.04
    ?shoulder.add(direction.scale(maxReach/actual)):goal.clone();
  for(let i=0;i<16;i++){
   adjustJoint(arm.fore,arm.hand,target,.33);
   adjustJoint(arm.upper,arm.hand,target,.33);
   refresh(arm.hand);
   if(B.Vector3.DistanceSquared(arm.hand.getAbsolutePosition(),target)<.00008)break;
  }
  elbowPole(arm,pole);
  for(let i=0;i<3;i++){
   adjustJoint(arm.fore,arm.hand,target,.20);
   adjustJoint(arm.upper,arm.hand,target,.20);
  }
  refresh(arm.hand);
  return {error:B.Vector3.Distance(arm.hand.getAbsolutePosition(),goal),
   reachable:actual<=maxReach+.015};
 }
 // Explicitly frame each palm from its REAL knuckle/finger chain.
 // This is the critical difference from merely snapping a wrist to a trigger.
 const calibration={};
 function targetFrame(forward,palm){
  const y=forward.clone().normalize();
  let x=palm.subtract(y.scale(B.Vector3.Dot(palm,y)));
  if(x.lengthSquared()<1e-8)x=B.Vector3.Cross(y,B.Axis.Z);
  x.normalize();
  let z=B.Vector3.Cross(x,y).normalize();
  x=B.Vector3.Cross(y,z).normalize();
  const m=B.Matrix.Identity();B.Matrix.FromXYZAxesToRef(x,y,z,m);
  return B.Quaternion.FromRotationMatrix(m).normalize();
 }
 function setupHand(side,hand){
  const j=jointMap;
  const index=j.get(CANON(side+"HandIndex1"));
  const pinky=j.get(CANON(side+"HandPinky1"));
  const middle=j.get(CANON(side+"HandMiddle2"));
  const thumb=j.get(CANON(side+"HandThumb3"));
  if(!index||!pinky||!middle||!thumb)return null;
  for(const n of [hand,index,pinky,middle,thumb])refresh(n);
  const wrist=hand.getAbsolutePosition();
  const rawFinger=middle.getAbsolutePosition().subtract(wrist).normalize();
  let palm=B.Vector3.Cross(index.getAbsolutePosition().subtract(wrist),
                            pinky.getAbsolutePosition().subtract(wrist)).normalize();
  if(B.Vector3.Dot(thumb.getAbsolutePosition().subtract(wrist),palm)<0)palm.scaleInPlace(-1);
  const live=targetFrame(rawFinger,palm);
  const local=worldRotation(hand).conjugate().multiply(live).normalize();
  return {local,rawFinger,palm};
 }
 calibration.Right=setupHand("Right",right.hand);
 calibration.Left=setupHand("Left",left.hand);
 function poseWrist(hand,side,bodyQ,mode){
  const c=calibration[side];if(!c)return false;
  const ref=ARA_RIFLE[mode==="run"?"sprint":mode==="aim"?"aim":"ready"][side];
  const desired=targetFrame(rotate(V(...ref.dir),bodyQ),
                            rotate(V(...ref.palm),bodyQ));
  const world=desired.multiply(c.local.conjugate()).normalize();
  const parentQ=hand.parent?worldRotation(hand.parent):B.Quaternion.Identity();
  const local=parentQ.conjugate().multiply(world).normalize();
  // Full wrist orientation was blocked by the old 55 degree limit.
  // A 0.8 blend avoids one-frame twist of the skinned cuff.
  const old=hand.rotationQuaternion||B.Quaternion.Identity();
  hand.rotationQuaternion=B.Quaternion.Slerp(old,local,.80).normalize();
  refresh(hand);return true;
 }
 function angularError(a,b){
  if(a.lengthSquared()<1e-7||b.lengthSquared()<1e-7)return null;
  return +(Math.acos(B.Scalar.Clamp(B.Vector3.Dot(a.normalize(),b.normalize()),-1,1))*180/Math.PI).toFixed(1);
 }
 function handDirectionError(side,hand,bodyQ,mode){
  const mid=jointMap.get(CANON(side+"HandMiddle2"));if(!mid)return null;
  refresh(mid);refresh(hand);
  const actual=mid.getAbsolutePosition().subtract(hand.getAbsolutePosition());
  const expected=rotate(V(...ARA_RIFLE[mode==="run"?"sprint":mode==="aim"?"aim":"ready"][side].dir),bodyQ);
  return angularError(actual,expected);
 }
 const fingerRotations=new Map();
 function prepareFingerBends(){
  for(const [name,node] of fingers){
   const next=name.endsWith("1")?"2":name.endsWith("2")?"3":null;
   const nextNode=next?jointMap.get(name.slice(0,-1)+next):null;
   const side=name.startsWith("left")?"Left":"Right";
   const c=calibration[side];if(!nextNode||!c)continue;
   refresh(nextNode);refresh(node);
   const finger=nextNode.getAbsolutePosition().subtract(node.getAbsolutePosition());
   const inward=c.palm.scale(-1);
   const axis=B.Vector3.Cross(finger,inward);
   if(axis.lengthSquared()<1e-8)continue;
   const world=worldRotation(node);
   const localAxis=rotate(axis.normalize(),world.conjugate()).normalize();
   fingerRotations.set(node,localAxis);
  }
 }
 prepareFingerBends();
 const bodyNodes=[left.shoulder,left.upper,left.fore,left.hand,right.shoulder,right.upper,right.fore,right.hand];
 const rest=new Map([...bodyNodes,...fingers.map(x=>x[1])].map(n=>{
  if(!n.rotationQuaternion)n.rotationQuaternion=B.Quaternion.FromEulerAngles(n.rotation.x,n.rotation.y,n.rotation.z);
  return [n,n.rotationQuaternion.clone()];
 }));
 const stripped=stripArmTracks(imported.animationGroups);
 if(stripped!==32)throw Error("Expected exactly 8 arm tracks in 4 clips (32), got "+stripped);
 const displayMeshes=(imported.meshes||[]).filter(m=>m.getTotalVertices?.()>0);
 if(displayMeshes.length!==36)throw Error("Source hero mesh count changed: "+displayMeshes.length);
 const pivot=new B.TransformNode("american-hero-only-weapon-pivot",scene);
 pivot.rotationQuaternion=B.Quaternion.Identity();
 const report={ready:false,weapon:null,leftGripMeters:null,rightGripMeters:null,
  leftReachable:false,rightReachable:false,uniqueHands:2,
  suppressedConflictingArmTracks:stripped,error:null,originalMeshes:displayMeshes.length};
 state.weaponRig=report;
 let manifest=null,container=null,rocketDispose=null,currentMeta=null,mode="ready",updating=false,stopped=false,generation=0;
 const restoreArms=()=>{
  for(const [node,q] of rest)node.rotationQuaternion=q.clone();
 };
 function torsoAxes(){
  refresh(left.upper);refresh(right.upper);refresh(neck);refresh(hips);
  const x=left.upper.getAbsolutePosition().subtract(right.upper.getAbsolutePosition()).normalize();
  const y=neck.getAbsolutePosition().subtract(hips.getAbsolutePosition());
  y.subtractInPlace(x.scale(B.Vector3.Dot(x,y))).normalize();
  const z=B.Vector3.Cross(x,y).normalize();
  const m=B.Matrix.Identity();
  B.Matrix.FromXYZAxesToRef(x,y,z,m);
  return {x,y,z,q:B.Quaternion.FromRotationMatrix(m).normalize()};
 }
 function applyFingerCurl(){
  // Per-joint axes are measured from the artist's real skinned phalanges.
  // Different Mixamo wrist orientations cannot share universal XYZ curl values.
  for(const [name,node] of fingers){
   const axis=fingerRotations.get(node);if(!axis)continue;
   const thumb=name.includes("thumb"),index=name.includes("index");
   const seg=Number(name[name.length-1]);
   const bend=thumb?(seg===1?.42:.36):index?(seg===1?.74:1.02):
      seg===1?1.10:1.22;
   node.rotationQuaternion=rest.get(node).multiply(
    B.Quaternion.RotationAxis(axis,bend)).normalize();
  }
 }
 function update(){
  if(stopped||updating||!currentMeta)return;
  updating=true;
  try{
   restoreArms();
   refresh(chest);
   const body=torsoAxes();
   const running=mode==="run";
   // AUTHORED ARMED POSE FIRST: Ara's right wrist target determines the hold,
   // not a generic shoulder-to-stock distance. Body-space IK targets are
   // adapted to the actual current American rig, never German coordinates.
   const pose=ARA_RIFLE[mode==="run"?"sprint":mode==="aim"?"aim":"ready"];
   const scale=B.Vector3.Distance(left.upper.getAbsolutePosition(),
      right.upper.getAbsolutePosition())/.55;
   const ara=(p)=>chest.getAbsolutePosition()
      .add(rotate(V(p[0]*scale,p[1]*scale+.15,p[2]*scale),body.q));
   const rightGoal=ara(pose.Right.pos);
   const rightPole=ara(pose.Right.pole.map(v=>v*.25));
   const leftPole=ara(pose.Left.pole.map(v=>v*.25));
   const r=solveArm(right,rightGoal,rightPole);
   const gunQ=body.q.multiply(B.Quaternion.FromEulerAngles(
      running?.24:mode==="aim"?.025:.19,
      running?.52:mode==="aim"?.29:.48,0)).normalize();
   const rightOriented=poseWrist(right.hand,"Right",gunQ,mode);
   // Right hand is now authoritative. Attach stock and receiver using the
   // real weapon's trigger socket; no independent chest/stock positioning.
   const gripOffset=rotate(V(-.015,-.012,-.01),gunQ);
   let trigger=right.hand.getAbsolutePosition().subtract(gripOffset);
   pivot.rotationQuaternion.copyFrom(gunQ);
   pivot.position.copyFrom(trigger.subtract(rotate(V(...currentMeta.trigger),gunQ)));
   refresh(pivot);
   const support=pivot.position.add(rotate(V(0,
     Number(currentMeta.support?.[1]||.04),
     Number(currentMeta.gripSupportZ)),gunQ));
   const leftGoal=support.add(rotate(V(.012,-.012,-.008),gunQ));
   const l=solveArm(left,leftGoal,leftPole);
   const leftOriented=poseWrist(left.hand,"Left",gunQ,mode);
   // Compare to actual shoulder; do not snap the rifle back into the chest.
   const shoulderSocket=right.shoulder.getAbsolutePosition();
   applyFingerCurl();
   report.palmCalibration={right:rightOriented,left:leftOriented};
   report.rightFingerErrorDegrees=handDirectionError("Right",right.hand,body.q,mode);
   report.leftFingerErrorDegrees=handDirectionError("Left",left.hand,body.q,mode);
   report.visualAccepted=false; // Numerical contact is NOT artistic acceptance.
   report.rightGripMeters=+B.Vector3.Distance(right.hand.getAbsolutePosition(),
     trigger.add(gripOffset)).toFixed(3);
   report.leftGripMeters=+B.Vector3.Distance(left.hand.getAbsolutePosition(),
     leftGoal).toFixed(3);
   report.stockToShoulderMeters=+B.Vector3.Distance(
     pivot.position.add(rotate(V(...currentMeta.shoulder),gunQ)),
     shoulderSocket).toFixed(3);
   report.triggerDistanceFromChestMeters=+B.Vector3.Distance(
     trigger,chest.getAbsolutePosition()).toFixed(3);
   report.rightReachable=r.reachable;
   report.leftReachable=l.reachable;
   report.mode=mode;
   report.error=null;
  }catch(e){report.error=String(e?.message||e)}
  finally{updating=false}
 }
 async function equip(id){
  if(!GUNS[id])throw Error("Unknown Allied weapon: "+id);
  const token=++generation;
  if(!manifest){
   const response=await fetch(weaponRoot+"manifest.json");
   if(!response.ok)throw Error("Weapon manifest HTTP "+response.status);
   manifest=await response.json();
  }
  const spec=GUNS[id],entry=spec.prototype?PIAT:manifest.weapons?.[id];
  if(!entry||(!spec.prototype&&entry.file!==spec.file)||
      !Array.isArray(entry.trigger)||!Array.isArray(entry.support)||!Array.isArray(entry.shoulder))
   throw Error("Missing original Allied weapon metadata "+id);
  const loaded=spec.prototype?null:await B.SceneLoader.LoadAssetContainerAsync("",weaponRoot+entry.file,scene);
  if(token!==generation){loaded?.dispose();return;}
  if(container){container.dispose();container=null}
  if(rocketDispose){rocketDispose();rocketDispose=null}
  if(loaded){
   loaded.addAllToScene();
   for(const node of [...loaded.meshes,...loaded.transformNodes])if(!node.parent)node.parent=pivot;
   container=loaded;
  }else{
   rocketDispose=proceduralPiat(scene,pivot);
  }
  currentMeta={...entry,gripSupportZ:Math.min(entry.support[2],spec.supportZ)};
  report.weapon=id;report.asset=spec.prototype?"procedural PIAT prototype":"original MIT GLB";report.ready=true;
  update();
 }
 function setPose(value){mode=value==="run"?"run":value==="aim"?"aim":"ready";update()}
 const observer=scene.onBeforeRenderObservable.add(update);
 state.weaponRigReady=false;
 state.equipWeapon=equip;
 state.setWeaponPose=setPose;
 state.disposeWeaponRig=()=>{stopped=true;scene.onBeforeRenderObservable.remove(observer);container?.dispose();rocketDispose?.();pivot.dispose()};
 return equip("uk-lee-enfield").then(()=>{
  state.weaponRigReady=true;
  return report;
 }).catch(err=>{scene.onBeforeRenderObservable.remove(observer);pivot.dispose();throw err});
}
return Object.freeze({create,stripArmTracks,CANON,GUNS});
});