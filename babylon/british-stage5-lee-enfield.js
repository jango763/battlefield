/* Battlefield · British army 5/10 · Lee-Enfield actual shot lifecycle.
 * Reuses approved hero IK, muzzle VFX, target visuals and the authoritative
 * BattlefieldBalance shot/cooldown/damage. No duplicate ammo or hit system.
 * Never treats a control hero or unlicensed user GLB as a finished British skin.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldBritishStage5Rifle=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const WEAPON_ID="uk-lee-enfield",SOURCE_ID="Kar98k";
 const RECOIL_SECONDS=.13;
 const TARGETS=Object.freeze([
  Object.freeze({id:"enemy-a",x:-.88,z:-2.9}),
  Object.freeze({id:"enemy-b",x:0,z:-3.2}),
  Object.freeze({id:"enemy-c",x:.85,z:-2.9})
 ]);
 function create({scene,stance,balance,bridge,visuals,vfx,random=Math.random,
  controlOnly=false}={}){
  if(!scene||!stance?.getMuzzleWorld||!stance?.setCombatOverlay||
   !stance?.status||!stance?.sync||!stance?.targetAt)
   throw Error("Approved two-hand Lee-Enfield stance is required");
  if(!balance?.createBattle||!balance?.WEAPONS?.[SOURCE_ID]||
   !bridge?.create||!visuals?.create||!vfx?.create)
   throw Error("Only the original BattlefieldBalance and approved hero VFX may fire");
  const profile=balance.WEAPONS[SOURCE_ID];
  if(profile.canFireMoving!==false||!Number.isFinite(profile.interval)||
   profile.interval<=0||profile.magazineSize!==Infinity)
   throw Error("Unapproved rifle ammo/movement profile");
  if(stance.status().weaponId!==WEAPON_ID)
   throw Error("Stage5 requires genuine Lee-Enfield 3D weapon");
  const events=[];
  const battle=bridge.create({balance,random,onEvent:e=>{if(events.length<50)events.push(e)}});
  const fx=vfx.create({scene,rig:stance});
  const targetView=visuals.create({scene,bridge:battle,rig:stance,
   onSelect:id=>{try{selectTarget(id)}catch(e){errors.push(String(e?.message||e))}}
  });
  let recoilRemaining=0,disposed=false,shots=0,last=null;
  const errors=[];
  function ensure(){
   if(disposed)throw Error("Lee-Enfield controller disposed");
  }
  function selectedTarget(){
   const target=battle.currentTarget();
   return target&&TARGETS.find(t=>t.id===target.id)||null;
  }
  function orient(){
   const target=selectedTarget();
   if(!target)return null;
   const state=stance.targetAt(target);
   if(state.aim?.barrelDot<.97||!state.quality?.ok)
    throw Error("Unsafe rifle alignment or two-hand grip");
   return state;
  }
  function selectTarget(id){
   ensure();
   const result=battle.selectTarget(id);
   if(!result.ok)return result;
   orient();targetView.setSelected(id);
   return result;
  }
  function fire({moving=false}={}){
   ensure();
   if(typeof moving!=="boolean")throw Error("Moving must be boolean");
   if(stance.status().weaponId!==WEAPON_ID)
    throw Error("The wrong weapon is mounted");
   const aligned=orient();
   if(!aligned)return {ok:false,reason:"all-targets-destroyed"};
   // BattlefieldBalance alone owns cooldown, hit, damage and infinite rifle ammo.
   const result=battle.fire(WEAPON_ID,{moving});
   if(!result.ok)return result;
   shots++;last=result;recoilRemaining=RECOIL_SECONDS;
   fx.shoot(WEAPON_ID);targetView.reactShot(result);
   // Target auto-selection after a kill must also face the NEXT living target.
   orient();
   return result;
  }
  function tick(dt){
   ensure();
   const step=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
   battle.tick(step);
   recoilRemaining=Math.max(0,recoilRemaining-step);
   stance.setCombatOverlay({recoil:recoilRemaining/RECOIL_SECONDS,
    reloadActive:false,reloadPhase:0});
   fx.tick(step);targetView.tick(step);
   return status();
  }
  function reset(){
   ensure();
   targetView.reset();
   fx.reset();recoilRemaining=0;shots=0;last=null;errors.length=0;
   stance.setCombatOverlay({recoil:0,reloadActive:false,reloadPhase:0});
   orient();
   return status();
  }
  function status(){
   ensure();
   const s=battle.status(),held=stance.status();
   return Object.freeze({
    weapon:WEAPON_ID,sourceWeapon:SOURCE_ID,
    controlOnly,readyForBritishDeployment:false,
    shots,damage:s.hits,kills:s.kills,
    targetId:s.targetId,targets:s.targets,
    infiniteAmmo:s.magazine===Infinity&&s.reserve===Infinity,
    // Lee-Enfield is unlimited-ammo: its 2.1s shot interval is NOT a
    // magazine reload. Do not invent a clip/magazine counter.
    cooldownRemaining:Math.max(0,battle.getPlayer().cooldown),
    interval:profile.interval,canFireMoving:profile.canFireMoving,
    reloading:s.reloadRemaining>0,
    recoil:recoilRemaining/RECOIL_SECONDS,
    mounted:held.mounted,grip:held.quality,
    aim:held.aim,pose:held.pose,
    last,visual:targetView.status(),fx:fx.status(),
    error:errors[0]||null,sceneSkeletons:scene.skeletons.length
   });
  }
  function dispose(){
   if(disposed)return;
   targetView.dispose();fx.dispose();
   stance.setCombatOverlay({recoil:0,reloadActive:false,reloadPhase:0});
   disposed=true;
  }
  orient();
  return Object.freeze({fire,tick,reset,status,selectTarget,dispose,
   getBattle:()=>battle,getVFX:()=>fx,getTargets:()=>targetView,
   RECOIL_SECONDS,TARGETS});
 }
 return Object.freeze({create,WEAPON_ID,SOURCE_ID,RECOIL_SECONDS,TARGETS});
});
