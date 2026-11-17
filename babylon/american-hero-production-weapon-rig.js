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
 "uk-piat":{label:"PIAT",file:null,supportZ:.11,procedural:true}
});
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
 let manifest=null,container=null,piatDispose=null,currentMeta=null,mode="ready",updating=false,stopped=false,generation=0;
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
 // The original American GLB has neutral finger joints pointing mostly local -Y,+Z.
 // Rotating fingers around Z spread them sideways: this CAUSED butterfly palms.
 // Fingers actually flex around local X (toward the opposite side of the palm).
 function applyFingerCurl(){
  for(const [name,node] of fingers){
   const isThumb=name.includes("thumb");
   const isTriggerFinger=name.startsWith("right")&&name.includes("index");
   const seg=Number(name[name.length-1]);
   const magnitude=isThumb?[.42,.30,.16][seg-1]:
      isTriggerFinger?[.22,.20,.12][seg-1]:
      [.57,.67,.41][seg-1];
   const axis=isThumb?B.Axis.Z:B.Axis.X;
   const sign=isThumb?(name.startsWith("right")?-1:1):1;
   node.rotationQuaternion=rest.get(node).multiply(
    B.Quaternion.RotationAxis(axis,sign*magnitude)).normalize();
  }
 }
 function fromTo(a,b){
  const src=a.clone().normalize(),dst=b.clone().normalize();
  let d=B.Scalar.Clamp(B.Vector3.Dot(src,dst),-1,1);
  if(d>.99999)return B.Quaternion.Identity();
  let axis=B.Vector3.Cross(src,dst);
  if(axis.lengthSquared()<1e-8)axis=B.Vector3.Cross(src,Math.abs(src.y)<.9?B.Axis.Y:B.Axis.X);
  axis.normalize();
  return B.Quaternion.RotationAxis(axis,Math.acos(d));
 }
 function alignPalm(arm,side,weaponQ){
  // Measure the ACTUAL phalanx basis, not a made-up Mixamo +Y direction.
  const hand=arm.hand,stem=side.toLowerCase();
  const index=jointMap.get(stem+"handindex1");
  const middle=jointMap.get(stem+"handmiddle1");
  const pinky=jointMap.get(stem+"handpinky1");
  if(!index||!middle||!pinky)return null;
  refresh(index);refresh(middle);refresh(pinky);
  const handPos=hand.getAbsolutePosition();
  const sourceFinger=middle.getAbsolutePosition().subtract(handPos).normalize();
  const sourceAcross=pinky.getAbsolutePosition().subtract(index.getAbsolutePosition()).normalize();
  // Distinct poses: trigger-hand fingers follow the grip vertically;
  // support-hand fingers curve across the underside of the forestock.
  const targetFinger=rotate(side==="Right"?V(0,-.94,.34):V(-.73,-.61,.32),weaponQ).normalize();
  const targetAcross=rotate(side==="Right"?V(-.95,.06,-.27):V(.23,-.22,.95),weaponQ).normalize();
  const swing=fromTo(sourceFinger,targetFinger);
  let swungAcross=rotate(sourceAcross,swing);
  const project=(u)=>u.subtract(targetFinger.scale(B.Vector3.Dot(u,targetFinger))).normalize();
  swungAcross=project(swungAcross);
  const wantAcross=project(targetAcross);
  const signed=Math.atan2(
    B.Vector3.Dot(targetFinger,B.Vector3.Cross(swungAcross,wantAcross)),
    B.Scalar.Clamp(B.Vector3.Dot(swungAcross,wantAcross),-1,1));
  const twist=B.Quaternion.RotationAxis(targetFinger,signed);
  const delta=twist.multiply(swing).normalize();
  const current=worldRotation(hand);
  let desiredWorld=delta.multiply(current).normalize();
  const parentQ=hand.parent?worldRotation(hand.parent):B.Quaternion.Identity();
  hand.rotationQuaternion=parentQ.conjugate().multiply(desiredWorld).normalize();
  refresh(hand);
  refresh(middle); // Re-evaluate finger geometry after the wrist changed, not stale matrices.
  return {turnDegrees:Math.round(2*Math.acos(Math.min(1,Math.abs(delta.w)))*180/Math.PI),
   directionErrorDegrees:Math.round(Math.acos(B.Scalar.Clamp(B.Vector3.Dot(
    middle.getAbsolutePosition().subtract(hand.getAbsolutePosition()).normalize(),targetFinger),-1,1))*180/Math.PI)};
 }
 function update(){
  if(stopped||updating||!currentMeta)return;
  updating=true;
  try{
   restoreArms();
   refresh(chest);
   const body=torsoAxes();
   const running=mode==="run";
   // Source GLB bind pose: shoulder joints +/-0.205, y=0.598,
   // upper arms +/-0.277, y=0.565. Old code put trigger on the chest.
   // Correct production order: shoulder stock SOCKET determines the weapon;
   // trigger follows the weapon and BOTH original hands solve to its grips.
   // Positive yaw points the muzzle across the body toward the left forearm.
   const gunQ=body.q.multiply(B.Quaternion.FromEulerAngles(
     running?.27:.18, running?.65:.70, 0)).normalize();
   const shoulderSocket=right.shoulder.getAbsolutePosition()
     .add(body.x.scale(.030))
     .add(body.y.scale(-.010))
     .add(body.z.scale(.040));
   pivot.rotationQuaternion.copyFrom(gunQ);
   pivot.position.copyFrom(shoulderSocket.subtract(
     rotate(V(...currentMeta.shoulder),gunQ)));
   refresh(pivot);
   let trigger=pivot.position.add(rotate(V(...currentMeta.trigger),gunQ));
   // The right hand is the weapon's dominant control point. Its wrist is
   // positioned beside the trigger, never on the center of the rib cage.
   const rightGripOffset=rotate(V(-.018,-.015,0),gunQ);
   const rightGoal=trigger.add(rightGripOffset);
   const rightPole=right.upper.getAbsolutePosition()
     .add(body.x.scale(-.24)).add(body.y.scale(-.24)).add(body.z.scale(.12));
   const leftPole=left.upper.getAbsolutePosition()
     .add(body.x.scale(.24)).add(body.y.scale(-.24)).add(body.z.scale(.12));
   const r=solveArm(right,rightGoal,rightPole);
   // If residual IK error is small, move gun precisely to the dominant hand.
   // This avoids a visible gap between trigger and right palm. Do NOT snap
   // the gun to a badly solved wrist (which would drag it back into the chest).
   if(r.error < .055){
     const residual=right.hand.getAbsolutePosition().subtract(rightGoal);
     pivot.position.addInPlace(residual);
     refresh(pivot);
     trigger=trigger.add(residual);
   }
   const support=pivot.position.add(rotate(V(0,
     Number(currentMeta.support?.[1]||.04),
     Number(currentMeta.gripSupportZ)),gunQ));
   const leftGoal=support.add(rotate(V(.015,-.013,-.016),gunQ));
   const l=solveArm(left,leftGoal,leftPole);
   const rightPalm=alignPalm(right,"Right",gunQ);
   const leftPalm=alignPalm(left,"Left",gunQ);
   applyFingerCurl();
   report.rightWristDegrees=rightPalm?.turnDegrees??null;
   report.leftWristDegrees=leftPalm?.turnDegrees??null;
   report.rightFingerDirectionErrorDegrees=rightPalm?.directionErrorDegrees??null;
   report.leftFingerDirectionErrorDegrees=leftPalm?.directionErrorDegrees??null;
   report.rightGripMeters=+B.Vector3.Distance(right.hand.getAbsolutePosition(),
     trigger.add(rightGripOffset)).toFixed(3);
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
  function proceduralPiat(scene,parent){
    const B=window.BABYLON;
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
      mesh.parent=parent;mesh.position.copyFrom(V(...xyz));
      if(rotation)mesh.rotation.copyFrom(V(...rotation));
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
 async function equip(id){
  if(!GUNS[id])throw Error("Unknown Allied weapon: "+id);
  const token=++generation;
  const spec=GUNS[id];
  if(!manifest&&!spec.procedural){
   const response=await fetch(weaponRoot+"manifest.json");
   if(!response.ok)throw Error("Weapon manifest HTTP "+response.status);
   manifest=await response.json();
  }
  const entry=spec.procedural?{
   trigger:[0,-.155,-.15],support:[0,-.115,.11],shoulder:[0,-.045,-.40],
   file:null
  }:manifest?.weapons?.[id];
  if(!entry||entry.file!==spec.file||!Array.isArray(entry.trigger)||
     !Array.isArray(entry.support)||!Array.isArray(entry.shoulder))
   throw Error("Missing Allied weapon metadata "+id);
  const loaded=spec.procedural?null:
    await B.SceneLoader.LoadAssetContainerAsync("",weaponRoot+entry.file,scene);
  if(token!==generation){loaded?.dispose();return;}
  if(container){container.dispose();container=null;}
  if(piatDispose){piatDispose();piatDispose=null;}
  if(loaded){
   loaded.addAllToScene();
   for(const node of [...loaded.meshes,...loaded.transformNodes])if(!node.parent)node.parent=pivot;
   container=loaded;
  }else{
   piatDispose=proceduralPiat(scene,pivot);
  }
  currentMeta={...entry,gripSupportZ:Math.min(entry.support[2],spec.supportZ)};
  report.weapon=id;
  report.asset=spec.procedural?"procedural PIAT preview, not final production mesh":"original MIT GLB";
  report.ready=true;
  update();
 }
 function setPose(value){mode=value==="run"?"run":"ready";update()}
 const observer=scene.onBeforeRenderObservable.add(update);
 state.weaponRigReady=false;
 state.equipWeapon=equip;
 state.setWeaponPose=setPose;
 state.disposeWeaponRig=()=>{stopped=true;scene.onBeforeRenderObservable.remove(observer);container?.dispose();piatDispose?.();pivot.dispose()};
 return equip("uk-lee-enfield").then(()=>{
  state.weaponRigReady=true;
  return report;
 }).catch(err=>{scene.onBeforeRenderObservable.remove(observer);pivot.dispose();throw err});
}
return Object.freeze({create,stripArmTracks,CANON,GUNS});
});