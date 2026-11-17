/* Battlefield · Stage 8 · light-weight Babylon muzzle FX for isolated hero QA.
 * Procedural visual-only projectiles. No damage/collision/game economy change.
 * All 12 pooled projectiles reuse geometry and never detach weapon meshes.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldUSStage8Effects=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
function create({scene,rig,combat}){
 const B=window.BABYLON;
 if(!scene||!rig||!combat)throw Error("Stage8 FX needs Babylon scene, weapon rig, combat state");
 const glow=new B.StandardMaterial("us-stage8-flash-material",scene);
 glow.diffuseColor=new B.Color3(1,.83,.24);
 glow.emissiveColor=new B.Color3(1,.7,.2);
 glow.disableLighting=true;
 const rocketGlow=new B.StandardMaterial("us-stage8-rocket-material",scene);
 rocketGlow.diffuseColor=new B.Color3(.8,.85,.62);
 rocketGlow.emissiveColor=new B.Color3(.8,.45,.15);
 rocketGlow.disableLighting=true;
 const flash=B.MeshBuilder.CreateSphere("us-stage8-muzzle-flash",{diameter:.055,segments:6},scene);
 flash.material=glow;flash.isVisible=false;flash.isPickable=false;
 const pool=[];
 for(let i=0;i<12;i++){
  const mesh=B.MeshBuilder.CreateSphere("us-stage8-visible-projectile-"+i,{diameter:.029,segments:5},scene);
  mesh.material=glow;mesh.isPickable=false;mesh.isVisible=false;
  pool.push({mesh,life:0,velocity:new B.Vector3(0,0,0),kind:"bullet"});
 }
 let next=0,flashLife=0,recoil=0,shotEvents=0;
 const report={shotEvents:0,visibleProjectiles:0,flashVisible:false,
   lastMuzzle:null,lastShotWeapon:null,recoil:0};
 function fire(event){
  const muzzle=rig.getMuzzlePose();
  if(muzzle.weaponId!==event.weapon)throw Error("Gun muzzle/weapon mismatch");
  const p=B.Vector3.FromArray(muzzle.position);
  const d=B.Vector3.FromArray(muzzle.forward).normalize();
  flash.position.copyFrom(p);
  flash.scaling.setAll(event.kind==="launcher"?1.9:1);
  flash.isVisible=true;flashLife=event.kind==="launcher"?.20:.07;
  const item=pool[next];next=(next+1)%pool.length;
  const rocket=event.kind==="launcher";
  item.mesh.material=rocket?rocketGlow:glow;
  item.mesh.scaling.setAll(rocket?2.4:1);
  item.mesh.position.copyFrom(p);
  item.velocity=d.scale(rocket?3.1:23);
  item.life=rocket?.95:.16;
  item.kind=rocket?"projectile":"tracer";
  item.mesh.isVisible=true;
  recoil=1;shotEvents++;
  report.shotEvents=shotEvents;report.lastMuzzle=muzzle;report.lastShotWeapon=event.weapon;
 }
 function update(dt){
  const delta=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  flashLife=Math.max(0,flashLife-delta);flash.isVisible=flashLife>0;
  recoil=Math.max(0,recoil-delta*9.5);
  let n=0;
  for(const item of pool){
   if(item.life<=0){item.mesh.isVisible=false;continue;}
   item.life=Math.max(0,item.life-delta);
   item.mesh.position.addInPlace(item.velocity.scale(delta));
   item.mesh.isVisible=item.life>0;
   if(item.life>0)n++;
  }
  const s=combat.snapshot();
  rig.setCombatOverlay({reloading:s.reloading,reloadProgress:s.reloadProgress,recoil});
  report.visibleProjectiles=n;report.flashVisible=flash.isVisible;report.recoil=recoil;
  return report;
 }
 function dispose(){
  flash.dispose();glow.dispose();rocketGlow.dispose();
  pool.forEach(x=>x.mesh.dispose());
 }
 return Object.freeze({fire,update,report,dispose});
}
return Object.freeze({create});
});