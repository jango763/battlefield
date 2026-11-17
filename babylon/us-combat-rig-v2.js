/* Battlefield - experimental American firearm handling (Babylon.js)
 * Inspired by Ara 3D Gen shooter presets (MIT), source https://github.com/olatunde85/3d-gen
 * Soldier keeps one original 65-bone skeleton; Quaternius animates legs/torso.
 * Right hand is the weapon socket. Left hand is solved to actual support point.
 * No German pose and no duplicate hand geometry.
 */
(function () {
"use strict";
const B=window.BABYLON;
if(!B)return;
const C=n=>String(n||"").replace(/^mixamorig[:_]?/i,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
const fingers=["thumb","index","middle","ring","pinky"];
const keys=["leftshoulder","leftarm","leftforearm","lefthand","rightshoulder","rightarm","rightforearm","righthand"];
const arms=new Set([...keys,...["left","right"].flatMap(a=>fingers.flatMap(b=>[1,2,3].map(c=>a+"hand"+b+c)))]);
const WEAPONS={
 "uk-lee-enfield":{title:"Lee-Enfield",file:"uk-lee-enfield.glb",support:.18},
 "uk-sten":{title:"Sten",file:"uk-sten.glb",support:.17},
 "uk-bren":{title:"Bren",file:"uk-bren.glb",support:.18},
 "uk-piat":{title:"PIAT",file:null,support:.11}
};
const V=(x,y,z)=>new B.Vector3(x,y,z);
const from=a=>V(a[0],a[1],a[2]);
const rot=(v,q)=>{const m=B.Matrix.Identity();B.Matrix.FromQuaternionToRef(q,m);return B.Vector3.TransformNormal(v,m)};
const clamp=B.Scalar.Clamp;
function refresh(n){let c=[];for(let k=n;k;k=k.parent)c.unshift(k);for(let k of c)k.computeWorldMatrix(true)}
function wr(n){refresh(n);let q=B.Quaternion.Identity();n.getWorldMatrix().decompose(undefined,q,undefined);return q.normalize()}
function frame(forward,palm){
 const y=forward.normalize();
 let x=palm.subtract(y.scale(B.Vector3.Dot(palm,y)));
 if(x.lengthSquared()<1e-8)x=B.Vector3.Cross(y,B.Axis.Z);
 x.normalize();
 const z=B.Vector3.Cross(x,y).normalize();
 x=B.Vector3.Cross(y,z).normalize();
 const m=B.Matrix.Identity(); B.Matrix.FromXYZAxesToRef(x,y,z,m);
 return B.Quaternion.FromRotationMatrix(m).normalize();
}
function armPose({imported,scene,state,actor,weaponRoot="../assets/ww2-weapons/"}){
 if(imported.skeletons.length!==1||imported.skeletons[0].bones.length!==65)
  throw Error("Нужен исходный американский скелет из 65 костей");
 const bones=imported.skeletons[0].bones, named=new Map();
 for(const bone of bones){
  let node=bone.getTransformNode?.(),name=C(node?.name||bone.name);
  if(node&&!named.has(name))named.set(name,node);
 }
 const find=s=>{let n=named.get(C(s));if(!n)throw Error("Не найден сустав "+s);return n};
 const left={shoulder:find("LeftShoulder"),upper:find("LeftArm"),fore:find("LeftForeArm"),hand:find("LeftHand")};
 const right={shoulder:find("RightShoulder"),upper:find("RightArm"),fore:find("RightForeArm"),hand:find("RightHand")};
 const neck=find("Neck"),hips=find("Hips"),spine=find("Spine2");
 const rest=new Map();
 for(const n of named.values()){
  if(!n.rotationQuaternion)n.rotationQuaternion=B.Quaternion.FromEulerAngles(n.rotation.x,n.rotation.y,n.rotation.z);
  if(arms.has(C(n.name)))rest.set(n,n.rotationQuaternion.clone());
 }
 const palmLocal={};
 for(const side of ["Left","Right"]){
  const arm=side==="Left"?left:right;
  const idx=find(side+"HandIndex2"),pink=find(side+"HandPinky2"),
    mid=find(side+"HandMiddle2"),thumb=find(side+"HandThumb2");
  refresh(idx);refresh(pink);refresh(mid);refresh(thumb);refresh(arm.hand);
  const wrist=arm.hand.getAbsolutePosition();
  const fi=mid.getAbsolutePosition().subtract(wrist);
  let pa=B.Vector3.Cross(idx.getAbsolutePosition().subtract(wrist),
    pink.getAbsolutePosition().subtract(wrist));
  if(B.Vector3.Dot(pa,thumb.getAbsolutePosition().subtract(wrist))<0)pa.scaleInPlace(-1);
  const sourceBasis=frame(fi,pa);
  palmLocal[side]=wr(arm.hand).conjugate().multiply(sourceBasis).normalize();
 }
 function bend(j,end,goal,cap){
  refresh(end);
  const p=j.getAbsolutePosition(),a=end.getAbsolutePosition().subtract(p),
    b=goal.subtract(p);
  if(a.lengthSquared()<1e-9||b.lengthSquared()<1e-9)return;
  a.normalize();b.normalize();const cross=B.Vector3.Cross(a,b);
  const sl=cross.length();if(sl<1e-8)return;
  const angle=Math.min(cap,Math.atan2(sl,B.Vector3.Dot(a,b)));
  const pq=j.parent?wr(j.parent):B.Quaternion.Identity();
  const q=B.Quaternion.RotationAxis(cross.scale(1/sl),angle);
  const local=pq.conjugate().multiply(q).multiply(pq);
  j.rotationQuaternion=local.multiply(j.rotationQuaternion).normalize();
 }
 function stabilise(arm,pole){
  refresh(arm.hand);
  const sh=arm.upper.getAbsolutePosition(),el=arm.fore.getAbsolutePosition(),
    hand=arm.hand.getAbsolutePosition();
  const axis=hand.subtract(sh);if(axis.lengthSquared()<1e-8)return;
  axis.normalize();
  const perp=p=>p.subtract(axis.scale(B.Vector3.Dot(p,axis)));
  let a=perp(el.subtract(sh)),b=perp(pole.subtract(sh));
  if(a.lengthSquared()<1e-8||b.lengthSquared()<1e-8)return;
  a.normalize();b.normalize();
  let angle=clamp(Math.atan2(B.Vector3.Dot(axis,B.Vector3.Cross(a,b)),
    B.Vector3.Dot(a,b)),-.25,.25);
  const p=arm.upper.parent?wr(arm.upper.parent):B.Quaternion.Identity();
  const q=B.Quaternion.RotationAxis(axis,angle);
  arm.upper.rotationQuaternion=p.conjugate().multiply(q).multiply(p)
    .multiply(arm.upper.rotationQuaternion).normalize();
 }
 function solve(arm,goal,pole){
  refresh(arm.hand);
  const p=arm.upper.getAbsolutePosition();
  const upper=B.Vector3.Distance(p,arm.fore.getAbsolutePosition());
  const fore=B.Vector3.Distance(arm.fore.getAbsolutePosition(),arm.hand.getAbsolutePosition());
  const reach=upper+fore-.008;
  const d=goal.subtract(p),dist=d.length();
  const target=dist>reach && reach>.03?p.add(d.scale(reach/dist)):goal;
  for(let i=0;i<18;i++){
   bend(arm.fore,arm.hand,target,.32);bend(arm.upper,arm.hand,target,.32);
   refresh(arm.hand);
   if(B.Vector3.DistanceSquared(arm.hand.getAbsolutePosition(),target)<.00004)break;
  }
  stabilise(arm,pole);
  for(let i=0;i<4;i++){
   bend(arm.fore,arm.hand,target,.18);bend(arm.upper,arm.hand,target,.18);
  }
  refresh(arm.hand);
  return +B.Vector3.Distance(arm.hand.getAbsolutePosition(),goal).toFixed(3);
 }
 function face(){
  refresh(neck);refresh(hips);refresh(left.upper);refresh(right.upper);
  let x=left.upper.getAbsolutePosition().subtract(right.upper.getAbsolutePosition()).normalize();
  let y=neck.getAbsolutePosition().subtract(hips.getAbsolutePosition());
  y.subtractInPlace(x.scale(B.Vector3.Dot(y,x))).normalize();
  let z=B.Vector3.Cross(x,y).normalize();y=B.Vector3.Cross(z,x).normalize();
  const mat=B.Matrix.Identity();B.Matrix.FromXYZAxesToRef(x,y,z,mat);
  return {q:B.Quaternion.FromRotationMatrix(mat).normalize(),x,y,z};
 }
 function orient(hand,side,desiredF,desiredPalm){
  const frameQ=frame(desiredF,desiredPalm);
  const worldQ=frameQ.multiply(palmLocal[side].conjugate()).normalize();
  const parentQ=hand.parent?wr(hand.parent):B.Quaternion.Identity();
  const localQ=parentQ.conjugate().multiply(worldQ).normalize();
  hand.rotationQuaternion=localQ;
  refresh(hand);
  return worldQ;
 }
 function fingersRest(){
  for(const [n,q] of rest)n.rotationQuaternion=q.clone();
 }
 function piat(scene,parent){
  const mats=[],meshes=[];
  const mat=(name,r,g,b,metal)=>{const m=new B.PBRMaterial(name,scene);
   m.albedoColor=new B.Color3(r,g,b);m.metallic=metal;m.roughness=.75;mats.push(m);return m};
  const steel=mat("PIAT parkerized steel",.29,.32,.26,.48);
  const dark=mat("PIAT dark metal",.08,.09,.08,.32);
  const wood=mat("PIAT canvas padding",.29,.26,.20,.0);
  const put=(mesh,m,xyz,rotation)=>{
   mesh.parent=parent;mesh.position.copyFrom(from(xyz));
   if(rotation)mesh.rotation.copyFrom(from(rotation));mesh.material=m;meshes.push(mesh);
  };
  const box=(n,s,p,m,r)=>put(B.MeshBuilder.CreateBox(n,{width:s[0],height:s[1],depth:s[2]},scene),m,p,r);
  const tube=(n,diam,len,p,m)=>put(B.MeshBuilder.CreateCylinder(n,{diameter:diam,height:len,tessellation:12},scene),m,p,[Math.PI/2,0,0]);
  // WWII PIAT: spring-powered spigot launcher with an OPEN front bomb tray, not a rocket tube.
  tube("PIAT main spring case",.125,.70,[0,0,-.075],steel);
  box("PIAT bomb tray", [.13,.026,.35],[0,.015,.42],steel);
  box("PIAT upper cradle left", [.028,.04,.34],[-.061,.04,.42],dark);
  box("PIAT upper cradle right", [.028,.04,.34],[.061,.04,.42],dark);
  tube("PIAT bomb mockup",.072,.23,[0,.08,.47],dark);
  box("PIAT butt pad",[.17,.15,.06],[0,-.01,-.42],wood);
  box("PIAT trigger",[.035,.10,.04],[0,-.205,-.15],dark);
  box("PIAT pistol grip",[.08,.17,.08],[0,-.245,-.17],wood);
  box("PIAT fore grip",[.065,.11,.10],[0,-.13,.11],steel);
  box("PIAT front support",[.03,.26,.03],[0,-.21,.28],dark);
  return ()=>{meshes.forEach(x=>x.dispose());mats.forEach(x=>x.dispose())};
 }
 const pivot=new B.TransformNode("American WeaponR authoritative socket",scene);
 pivot.rotationQuaternion=B.Quaternion.Identity();
 const stateOut={ready:false,weapon:null,pose:"aim",rightError:null,leftError:null,
  palmCalibration:true,source:"Ara 3D Gen shooter reference + American 65 bone Mixamo"};
 state.weaponRig=stateOut;
 let manifest=null,current=null,container=null,cleanup=null,token=0,pose="aim",disposed=false;
 const socketData={
  "uk-piat":{
   trigger:[0,-.155,-.15],support:[0,-.115,.11],shoulder:[0,-.045,-.40],
   muzzle:[0,.055,.49]
  }
 };
 function update(){
  if(disposed||!current)return;
  try{
   fingersRest();
   const f=face();
   const presets={
    aim:{right:[-.13,-.19,.22],poleR:[-1,-.9,-.2],poleL:[.4,-1,0],
       fR:[.1,-.55,.83],pR:[1,0,0],fL:[-.35,.2,.91],pL:[0,1,0],pitch:-.04,yaw:.88},
    ready:{right:[-.15,-.36,.17],poleR:[-1,-.6,-.4],poleL:[.6,-1,0],
       fR:[.1,-.75,.65],pR:[1,0,0],fL:[-.35,.05,.93],pL:[0,1,0],pitch:-.22,yaw:.85},
    run:{right:[-.16,-.38,.14],poleR:[-1,-.65,-.2],poleL:[.6,-1,0],
       fR:[.1,-.7,.7],pR:[1,0,0],fL:[-.35,.05,.93],pL:[0,1,0],pitch:-.18,yaw:.82},
    sprint:{right:[-.17,-.42,.13],poleR:[-1,-.5,-.5],poleL:[.8,-1,0],
       fR:[.3,-.75,.55],pR:[1,0,0],fL:[-.6,.35,.7],pL:[0,1,0],pitch:-.22,yaw:.82}
   };
   const p=presets[pose]||presets.aim;
   const place=(a)=>neck.getAbsolutePosition().add(rot(from(a),f.q));
   const goalR=place(p.right);
   const poleR=right.upper.getAbsolutePosition().add(rot(from(p.poleR).scale(.4),f.q));
   const errR=solve(right,goalR,poleR);
   orient(right.hand,"Right",rot(from(p.fR),f.q),rot(from(p.pR),f.q));
   // Right weapon socket is set by actual right wrist, never by chest or speculative coordinates.
   const gunQ=f.q.multiply(B.Quaternion.FromEulerAngles(p.pitch,p.yaw,0)).normalize();
   pivot.rotationQuaternion.copyFrom(gunQ);
   const socketOffset=rot(from(current.meta.trigger),gunQ);
   const wristSocket=right.hand.getAbsolutePosition().clone();
   pivot.position.copyFrom(wristSocket.subtract(socketOffset));
   refresh(pivot);
   // Support target moves with the weapon, not a separate world-space line.
   const supportZ=Math.min(current.support,Math.max(.13,current.meta.support?.[2]??.2));
   const supportLocal=V(current.meta.support?.[0]||0,current.meta.support?.[1]||0,supportZ);
   const supportWorld=pivot.position.add(rot(supportLocal,gunQ));
   const poleL=left.upper.getAbsolutePosition().add(rot(from(p.poleL).scale(.37),f.q));
   let errL=solve(left,supportWorld,poleL);
   orient(left.hand,"Left",rot(from(p.fL),f.q),rot(from(p.pL),f.q));
   errL=+B.Vector3.Distance(left.hand.getAbsolutePosition(),supportWorld).toFixed(3);
   const stock=pivot.position.add(rot(from(current.meta.shoulder),gunQ));
   const shoulder=right.shoulder.getAbsolutePosition();
   stateOut.rightError=errR;
   stateOut.leftError=errL;
   stateOut.stockToShoulder=+B.Vector3.Distance(stock,shoulder).toFixed(3);
   stateOut.hands=2;
   stateOut.error=null;
  }catch(error){stateOut.error=String(error?.message||error)}
 }
 async function equip(id){
  if(!WEAPONS[id])throw Error("Неизвестное оружие "+id);
  const currentToken=++token;
  if(!manifest){
   const res=await fetch(weaponRoot+"manifest.json",{cache:"force-cache"});
   if(!res.ok)throw Error("Не удалось получить манифест оружия: "+res.status);
   manifest=await res.json();
  }
  const w=WEAPONS[id],meta=id==="uk-piat"?socketData["uk-piat"]:manifest.weapons?.[id];
  if(!meta)throw Error("Нет оружейных сокетов "+id);
  let nextContainer=null,nextCleanup=null;
  if(w.file){
   nextContainer=await B.SceneLoader.LoadAssetContainerAsync("",weaponRoot+w.file,scene);
  } else {
   // PIAT is explicitly a provisional original mesh until a licensed GLB is approved.
  }
  if(currentToken!==token){nextContainer?.dispose();return}
  container?.dispose();cleanup?.();container=null;cleanup=null;
  if(nextContainer){
   nextContainer.addAllToScene();
   for(const obj of [...nextContainer.meshes,...nextContainer.transformNodes]){
    if(!obj.parent)obj.parent=pivot;
   }
   container=nextContainer;
  }else cleanup=piat(scene,pivot);
  current={id,meta,support:w.support};
  stateOut.weapon=id;stateOut.asset=w.file?"MIT original GLB":"First party provisional PIAT";
  stateOut.ready=true;update();
  return stateOut;
 }
 function stripUpper(groups){
  let removed=0;
  for(const g of groups){
   if(g.isPlaying)g.stop();
   const arr=g.targetedAnimations||[];
   for(let i=arr.length-1;i>=0;i--)if(arms.has(C(arr[i].target?.name))){
    arr.splice(i,1);removed++;
   }
  }
  stateOut.upperTracksDisabled=removed;
  return removed;
 }
 state.equipWeapon=equip;
 state.setWeaponPose=v=>{if(["aim","ready","run","sprint"].includes(v)){pose=v;stateOut.pose=pose;}};
 state.stripUpperTracks=stripUpper;
 const listener=scene.onBeforeRenderObservable.add(update);
 state.disposeWeaponRig=()=>{disposed=true;scene.onBeforeRenderObservable.remove(listener);container?.dispose();cleanup?.();pivot.dispose()};
 return equip("uk-lee-enfield").then(()=>{
  state.weaponRigReady=true;return stateOut;
 });
}
window.BattlefieldUSCombatRig={armPose,WEAPONS};
})();