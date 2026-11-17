/* Battlefield US hero Stage 8: reusable lightweight muzzle flash & PIAT round.
 * Browser-only cosmetic effects; no damage, hit detection or audio.
 * Weapon geometry stays a child of the original right-hand Weapon_R socket.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldUSCombatVFXStage8=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
function create({scene,rig}){
 const B=typeof window!=="undefined"?window.BABYLON:null;
 if(!B?.MeshBuilder||!scene||!rig?.getMuzzleWorld)throw Error("Stage8 VFX needs Babylon scene and muzzle locator");
 const flash=B.MeshBuilder.CreateSphere("stage8-muzzle-flash",{diameter:.10,segments:8},scene);
 flash.isPickable=false;flash.alwaysSelectAsActiveMesh=true;
 const flashMat=new B.StandardMaterial("stage8-flash-mat",scene);
 flashMat.diffuseColor=new B.Color3(1,.68,.16);
 flashMat.emissiveColor=new B.Color3(1,.75,.28);
 flashMat.specularColor=B.Color3.Black();
 flash.material=flashMat;flash.setEnabled(false);
 const projectile=B.MeshBuilder.CreateSphere("stage8-piat-projectile",{diameter:.09,segments:8},scene);
 projectile.isPickable=false;
 const shellMat=new B.StandardMaterial("stage8-piat-shell-mat",scene);
 shellMat.diffuseColor=new B.Color3(.65,.67,.45);
 shellMat.emissiveColor=new B.Color3(.22,.15,.04);
 projectile.material=shellMat;projectile.setEnabled(false);
 const muzzleLight=new B.PointLight("stage8-muzzle-light",B.Vector3.Zero(),scene);
 muzzleLight.diffuse=new B.Color3(1,.65,.19);
 muzzleLight.intensity=0;muzzleLight.range=1.5;
 let muzzleTime=0,projectileTime=0,shots=0,missiles=0,disposed=false;
 let origin=B.Vector3.Zero(),direction=B.Vector3.Forward();
 function shoot(id){
  if(disposed)throw Error("Stage8 VFX disposed");
  const m=rig.getMuzzleWorld();
  if(m.weaponId!==id)throw Error("Muzzle and selected weapon do not match");
  origin=new B.Vector3(...m.position);
  direction=new B.Vector3(...m.direction).normalize();
  flash.position.copyFrom(origin);
  muzzleLight.position.copyFrom(origin);
  muzzleTime=id==="uk-piat"?.12:.055;
  flash.scaling.setAll(id==="uk-bren"?1.2:1);
  flash.setEnabled(true);muzzleLight.intensity=1.6;
  shots++;
  if(id==="uk-piat"){
   projectile.position.copyFrom(origin);
   projectileTime=.42;projectile.setEnabled(true);missiles++;
  }
  return {shots,missiles,muzzle:m.position,direction:m.direction};
 }
 function tick(dt){
  if(disposed)return;
  const step=Math.max(0,Number(dt)||0);
  if(muzzleTime>0){
   muzzleTime=Math.max(0,muzzleTime-step);
   if(muzzleTime===0){flash.setEnabled(false);muzzleLight.intensity=0;}
   else{
    // While gun recoils, flash stays at the actual muzzle — no floating VFX.
    const p=rig.getMuzzleWorld();
    flash.position.set(...p.position);muzzleLight.position.copyFrom(flash.position);
   }
  }
  if(projectileTime>0){
   projectileTime=Math.max(0,projectileTime-step);
   const travel=.42-projectileTime;
   projectile.position.copyFrom(origin.add(direction.scale(travel*7)));
   if(projectileTime===0)projectile.setEnabled(false);
  }
 }
 function reset(){flash.setEnabled(false);projectile.setEnabled(false);
  muzzleLight.intensity=0;muzzleTime=0;projectileTime=0;}
 function status(){return {shots,missiles,flashVisible:flash.isEnabled(),
  projectileVisible:projectile.isEnabled(),muzzleTime,projectileTime,
  flashMeshes:1,projectileMeshes:1};}
 function dispose(){
  if(disposed)return;disposed=true;reset();
  flash.dispose();projectile.dispose();muzzleLight.dispose();
  flashMat.dispose();shellMat.dispose();
 }
 return Object.freeze({shoot,tick,reset,status,dispose});
}
return Object.freeze({create});
});