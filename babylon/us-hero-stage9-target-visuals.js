/* Battlefield Stage 9: three LIGHTWEIGHT visual enemy targets, not gameplay AI.
 * Babylon.js meshes react only to authoritative BattlefieldBalance events.
 * No duplicate skeletons, no imports, no new damage randomization.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldUSStage9Targets=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
function create({scene,bridge,rig,onSelect=()=>{}}){
 const B=typeof window!=="undefined"?window.BABYLON:null;
 if(!B?.MeshBuilder||!scene||!bridge||!rig)throw Error("Stage9 target visuals require Babylon scene, real battle and rig");
 const actors=new Map();
 const disposables=[];
 const mat=(name,r,g,b)=>{
  const m=new B.StandardMaterial(name,scene);
  m.diffuseColor=new B.Color3(r,g,b);
  m.specularColor=new B.Color3(.08,.08,.08);
  disposables.push(m);
  return m;
 };
 const uniform=mat("st9-axis-uniform",.27,.32,.28);
 const helmet=mat("st9-axis-helmet",.17,.22,.17);
 const skin=mat("st9-axis-skin",.65,.46,.34);
 const boots=mat("st9-axis-boots",.13,.14,.13);
 const targetLine=mat("st9-target-line",.33,.13,.12);
 const healthRed=mat("st9-health-red",.75,.22,.13);
 const healthGreen=mat("st9-health-green",.32,.75,.37);
 const hitMat=mat("st9-hit-overlay",.96,.46,.20);
 const selectedMat=mat("st9-selected-marker",.99,.78,.18);
 const tracerMat=mat("st9-tracer-mat",1,.84,.30);
 const blastMat=mat("st9-piat-impact",1,.51,.12);
 blastMat.alpha=.26;
 const targetIds=bridge.availableTargets();
 function addGeometry(label,parent,kind,opts,pos,material){
  const name="st9-"+label;
  const mesh=kind==="box"?B.MeshBuilder.CreateBox(name,opts,scene):
    kind==="sphere"?B.MeshBuilder.CreateSphere(name,opts,scene):
    B.MeshBuilder.CreateCylinder(name,opts,scene);
  mesh.parent=parent;
  mesh.position.set(...pos);
  mesh.material=material;
  mesh.isPickable=true;
  mesh.metadata={enemyId:parent.metadata?.enemyId||parent.parent?.metadata?.enemyId};
  return mesh;
 }
 for(const t of targetIds){
  const root=new B.TransformNode("st9-opponent-"+t.id,scene);
  root.metadata={enemyId:t.id};
  root.position.set(t.x,0,t.z);
  const torso=addGeometry(t.id+"-torso",root,"box",{width:.39,height:.67,depth:.23},[0,.93,0],uniform);
  const head=addGeometry(t.id+"-head",root,"sphere",{diameter:.25,segments:10},[0,1.42,0],skin);
  addGeometry(t.id+"-helmet",root,"sphere",{diameter:.282,segments:10},[0,1.51,0],helmet);
  addGeometry(t.id+"-left-arm",root,"cylinder",{diameter:.14,height:.62,tessellation:7},[-.275,.97,0],uniform);
  addGeometry(t.id+"-right-arm",root,"cylinder",{diameter:.14,height:.62,tessellation:7},[.275,.97,0],uniform);
  addGeometry(t.id+"-left-leg",root,"cylinder",{diameter:.165,height:.67,tessellation:7},[-.115,.34,0],uniform);
  addGeometry(t.id+"-right-leg",root,"cylinder",{diameter:.165,height:.67,tessellation:7},[.115,.34,0],uniform);
  addGeometry(t.id+"-left-boot",root,"box",{width:.18,height:.13,depth:.28},[-.12,.085,.07],boots);
  addGeometry(t.id+"-right-boot",root,"box",{width:.18,height:.13,depth:.28},[.12,.085,.07],boots);
  addGeometry(t.id+"-rifle",root,"box",{width:.065,height:.05,depth:.78},[.30,.91,.20],boots);
  const healthPivot=new B.TransformNode("st9-health-"+t.id,scene);
  healthPivot.position.set(t.x,1.81,t.z);
  healthPivot.billboardMode=B.TransformNode.BILLBOARDMODE_ALL;
  const bg=B.MeshBuilder.CreatePlane("st9-health-background-"+t.id,{width:.59,height:.095},scene);
  bg.parent=healthPivot;bg.material=targetLine;bg.isPickable=false;
  const fill=B.MeshBuilder.CreatePlane("st9-health-fill-"+t.id,{width:.55,height:.065},scene);
  fill.parent=healthPivot;fill.position.z=-.006;fill.material=healthGreen;fill.isPickable=false;
  const marker=B.MeshBuilder.CreateTorus("st9-selection-ring-"+t.id,
   {diameter:.65,thickness:.035,tessellation:22},scene);
  marker.rotation.x=Math.PI/2;marker.position.set(t.x,.025,t.z);
  marker.material=selectedMat;marker.isPickable=false;marker.setEnabled(false);
  actors.set(t.id,{root,torso,head,healthPivot,healthFill:fill,marker,
    flash:0,fall:0,dead:false,hp:t.hp,maxHp:t.maxHp});
 }
 const blast=B.MeshBuilder.CreateSphere("st9-piat-splash",{diameter:.6,segments:12},scene);
 blast.material=blastMat;blast.isPickable=false;blast.setEnabled(false);
 const tracer=B.MeshBuilder.CreateLines("st9-shot-tracer",{
   points:[B.Vector3.Zero(),new B.Vector3(0,0,-1)],updatable:true},scene);
 tracer.color=new B.Color3(1,.79,.25);
 tracer.isPickable=false;tracer.setEnabled(false);
 let tracerTime=0,blastTime=0,shots=0,damageEvents=0,deathEvents=0,selected=null;
 const ranges=()=>[...actors].map(([id,a])=>({id,hp:a.hp,alive:!a.dead,fall:a.fall}));
 function setSelected(id){
  if(!actors.has(id))return false;
  selected=id;
  for(const [key,a] of actors)a.marker.setEnabled(id===key&&!a.dead);
  return true;
 }
 function syncTargets(){
  const t=bridge.availableTargets();
  for(const info of t){
   const a=actors.get(info.id);if(!a)continue;
   a.hp=info.hp;
   a.dead=!info.alive;
   const ratio=Math.max(.001,info.hp/info.maxHp);
   a.healthFill.scaling.x=ratio;
   a.healthFill.position.x=-(1-ratio)*.55/2;
   a.healthFill.material=ratio<=.35?healthRed:healthGreen;
   if(a.dead)a.marker.setEnabled(false);
  }
  setSelected(bridge.status().targetId);
 }
 const pointer=scene.onPointerObservable.add(event=>{
  if(event.type!==B.PointerEventTypes.POINTERPICK)return;
  const id=event.pickInfo?.pickedMesh?.metadata?.enemyId;
  if(!id)return;
  const r=bridge.selectTarget(id);
  if(r.ok){setSelected(id);onSelect(id);}
 });
 function reactShot(result){
  if(!result?.ok)return;
  shots++;
  const first=actors.get(result.targetId);
  const muzzle=rig.getMuzzleWorld();
  const a=new B.Vector3(...muzzle.position);
  const target=first?.head?.getAbsolutePosition().clone()||new B.Vector3(0,1.3,-3);
  if(!result.hit)target.x+=.65;
  B.MeshBuilder.CreateLines("st9-shot-tracer",{points:[a,target],instance:tracer},scene);
  tracer.setEnabled(true);tracerTime=.12;
  for(const hit of result.hits||[]){
   const actor=actors.get(hit.id);
   if(actor){actor.flash=.18;damageEvents++;}
  }
  for(const deadId of result.fallen||[]){
   const actor=actors.get(deadId);
   if(actor){actor.dead=true;deathEvents++;}
  }
  if(result.impact){
   blast.position.set(result.impact.x/bridge.SCALE,1.05,result.impact.z/bridge.SCALE);
   blast.scaling.setAll(.6);blast.setEnabled(true);blastTime=.35;
  }
  syncTargets();
 }
 function tick(dt){
  const step=Math.max(0,Math.min(.1,dt||0));
  if(tracerTime>0){
   tracerTime=Math.max(0,tracerTime-step);
   if(tracerTime===0)tracer.setEnabled(false);
  }
  if(blastTime>0){
   blastTime=Math.max(0,blastTime-step);
   blast.scaling.scaleInPlace(1+step*1.7);
   if(blastTime===0)blast.setEnabled(false);
  }
  for(const actor of actors.values()){
   actor.flash=Math.max(0,actor.flash-step);
   actor.torso.material=actor.flash>0?hitMat:uniform;
   if(actor.dead){
    actor.fall=Math.min(1,actor.fall+step*1.5);
    actor.root.rotation.z=-Math.PI*.46*actor.fall;
    actor.root.position.y=-.09*actor.fall;
    actor.healthPivot.setEnabled(false);
   }
  }
 }
 function reset(){
  bridge.reset();
  for(const [id,a] of actors){
   a.dead=false;a.flash=0;a.fall=0;a.hp=a.maxHp;
   a.root.position.y=0;a.root.rotation.z=0;
   a.torso.material=uniform;a.healthPivot.setEnabled(true);
   a.marker.setEnabled(false);
  }
  tracerTime=blastTime=0;tracer.setEnabled(false);blast.setEnabled(false);
  shots=0;damageEvents=0;deathEvents=0;
  syncTargets();
 }
 function status(){
  return {targets:ranges(),selected,shots,damageEvents,deathEvents,
    visualActors:actors.size,visibleTracer:tracer.isEnabled(),
    visibleExplosion:blast.isEnabled()};
 }
 function dispose(){
  scene.onPointerObservable.remove(pointer);
  for(const a of actors.values()){
   a.root.getChildMeshes().forEach(m=>m.dispose());
   a.root.dispose();
   a.healthPivot.getChildMeshes().forEach(m=>m.dispose());
   a.healthPivot.dispose();a.marker.dispose();
  }
  tracer.dispose();blast.dispose();
  for(const m of disposables)m.dispose();
 }
 syncTargets();
 return Object.freeze({reactShot,tick,status,reset,syncTargets,setSelected,dispose});
}
return Object.freeze({create});
});