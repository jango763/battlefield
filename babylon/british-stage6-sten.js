/* Battlefield · British Army · 6/10 Sten Mk II.
 * Reuses approved Weapon_R IK, real Sten GLB, the stage9 battle bridge,
 * original BattlefieldBalance MP40-equivalent rates and Stage8 VFX.
 * No new damage/ammo logic, fake model, or changes to approved hero.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldBritishStage6Sten=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const WEAPON_ID="uk-sten",SOURCE_ID="MP40",FALLBACK_ID="uk-lee-enfield";
 const RECOIL_SECONDS=.085;
 const TARGETS=Object.freeze([
  Object.freeze({id:"enemy-a",x:-.88,z:-2.9}),
  Object.freeze({id:"enemy-b",x:0,z:-3.2}),
  Object.freeze({id:"enemy-c",x:.85,z:-2.9})
 ]);
 async function create({scene,stance,balance,bridge,visuals,vfx,
  random=Math.random,controlOnly=false}={}){
  if(!scene||!stance?.status||!stance?.getMuzzleWorld||
   !stance?.targetAt||!stance?.setCombatOverlay||!stance?.equipWeapon)
   throw Error("Requires approved original Weapon_R two-hand IK controller");
  if(!balance?.createBattle||!balance?.WEAPONS?.[SOURCE_ID]||
   !bridge?.create||!visuals?.create||!vfx?.create)
   throw Error("Original BattlefieldBalance and preview bridge required");
  const approved=balance.WEAPONS[SOURCE_ID];
  if(approved.magazineSize!==32||approved.magazines!==5||
    approved.reloadSeconds!==2.5||approved.canFireMoving!==true||
    Math.abs(approved.interval-.105)>.000001)
   throw Error("Unexpected approved Sten 32×5 / 2.5 second MP40 profile");
  // Only an existing licensed Sten GLB, not a procedural gun.
  await stance.equipWeapon(WEAPON_ID);
  if(stance.status().weaponId!==WEAPON_ID||
    stance.status().report.weaponSource?.includes("procedural"))
   throw Error("Original Sten GLB missing or incorrect socket");
  let disposed=false,recoilRemaining=0,last=null,shots=0,
   fallbackPending=null,range=null,fx=null,targetView=null;
  const errors=[];
  const battle=bridge.create({balance,random});
  const equip=battle.equip(WEAPON_ID);
  if(!equip.ok)throw Error("Cannot equip Sten from authoritative battle: "+equip.reason);
  try{
   fx=vfx.create({scene,rig:stance});
   targetView=visuals.create({scene,bridge:battle,rig:stance,
    onSelect:id=>{try{selectTarget(id)}catch(e){errors.push(String(e?.message||e))}}
   });
  }catch(e){fx?.dispose();targetView?.dispose();throw e;}
  function ensure(){
   if(disposed)throw Error("Stage6 Sten controller disposed");
  }
  function selected(){
   const target=battle.currentTarget();
   return target?TARGETS.find(t=>t.id===target.id)||null:null;
  }
  function orient(){
   const target=selected();
   if(!target)return null;
   const state=stance.targetAt(target);
   if(state.aim?.barrelDot<.97||!state.quality?.ok)
    throw Error("Sten aiming or two-hand IK invalid");
   return state;
  }
  function currentWeapon(){
   const visual=stance.status().weaponId;
   const source=battle.status().playerWeapon;
   return {visual,source,balanced:source===SOURCE_ID?WEAPON_ID:
     source==="Kar98k"?FALLBACK_ID:null};
  }
  function beginFallback(){
   if(fallbackPending||disposed)return fallbackPending;
   fallbackPending=Promise.resolve()
    .then(()=>stance.equipWeapon(FALLBACK_ID))
    .then(()=>{if(disposed)return;fx.reset();orient()})
    .catch(e=>{errors.push("Fallback model switch: "+String(e?.message||e))})
    .finally(()=>{fallbackPending=null;});
   return fallbackPending;
  }
  function selectTarget(id){
   ensure();
   const r=battle.selectTarget(id);
   if(r.ok){orient();targetView.setSelected(id);}
   return r;
  }
  function fire({moving=false}={}){
   ensure();
   if(typeof moving!=="boolean")throw Error("Moving flag must be boolean");
   if(fallbackPending)return {ok:false,reason:"switching-to-rifle"};
   const w=currentWeapon();
   if(!w.balanced||w.visual!==w.balanced)
    return {ok:false,reason:"visual-balance-weapon-mismatch"};
   const aim=orient();
   if(!aim)return {ok:false,reason:"all-targets-destroyed"};
   const result=battle.fire(w.visual,{moving});
   if(!result.ok)return result;
   shots++;last=result;recoilRemaining=RECOIL_SECONDS;
   fx.shoot(w.visual);targetView.reactShot(result);
   if(result.fallback)beginFallback();
   else orient();
   return result;
  }
  function reload(){
   ensure();
   if(fallbackPending)return {ok:false,reason:"switching-to-rifle"};
   if(currentWeapon().source!==SOURCE_ID)return {ok:false,reason:"rifle-unlimited"};
   const result=battle.reload();
   if(result.ok)recoilRemaining=0;
   return result;
  }
  function tick(dt){
   ensure();
   const step=Number.isFinite(dt)?Math.max(0,Math.min(.10,dt)):0;
   battle.tick(step);
   recoilRemaining=Math.max(0,recoilRemaining-step);
   const current=battle.status(),w=current.playerWeapon;
   const seconds=balance.WEAPONS[w]?.reloadSeconds||0;
   stance.setCombatOverlay({recoil:recoilRemaining/RECOIL_SECONDS,
    reloadActive:current.reloadRemaining>0,
    reloadPhase:current.reloadRemaining>0&&seconds>0?
     1-current.reloadRemaining/seconds:0});
   fx.tick(step);targetView.tick(step);
   return status();
  }
  async function reset(){
   ensure();
   if(fallbackPending)await fallbackPending;
   targetView.reset(); // Authoritative bridge resets weapon to base rifle.
   const result=battle.equip(WEAPON_ID);
   if(!result.ok)throw Error("Cannot rearm Sten after reset: "+result.reason);
   if(stance.status().weaponId!==WEAPON_ID)await stance.equipWeapon(WEAPON_ID);
   fx.reset();recoilRemaining=0;shots=0;last=null;errors.length=0;
   stance.setCombatOverlay({recoil:0,reloadActive:false,reloadPhase:0});
   orient();return status();
  }
  function status(){
   ensure();
   const s=battle.status(),held=stance.status(),w=currentWeapon();
   const weaponProfile=balance.WEAPONS[s.playerWeapon];
   const player=battle.getPlayer();
   const slot=player.inventory[SOURCE_ID];
   return Object.freeze({
    weapon:w.visual,sourceWeapon:w.source,
    controlOnly,readyForBritishDeployment:false,
    magazine:s.magazine,reserve:s.reserve,
    fullStenAmmo:(slot?.loaded||0)+(slot?.reserve||0),
    magazineSize:approved.magazineSize,magazineCount:approved.magazines,
    reloadSeconds:approved.reloadSeconds,
    reloadRemaining:s.reloadRemaining,
    reloading:s.reloadRemaining>0,
    fireInterval:weaponProfile.interval,
    cooldownRemaining:Math.max(0,player.cooldown),
    canFireMoving:weaponProfile.canFireMoving,
    fallback:!fallbackPending&&w.source==="Kar98k",
    switching:!!fallbackPending,
    shots,damage:s.hits,kills:s.kills,
    targetId:s.targetId,targets:s.targets,
    recoil:recoilRemaining/RECOIL_SECONDS,
    mounted:held.mounted,grip:held.quality,aim:held.aim,pose:held.pose,
    last,visual:targetView.status(),fx:fx.status(),
    error:errors[0]||null,sceneSkeletons:scene.skeletons.length
   });
  }
  function dispose(){
   if(disposed)return;
   // Do not dispose the shared actor/stance: stage 4 owns it.
   targetView.dispose();fx.dispose();disposed=true;
  }
  orient();
  return Object.freeze({fire,reload,tick,reset,status,selectTarget,dispose,
   getBattle:()=>battle,getVFX:()=>fx,getTargets:()=>targetView,
   awaitFallback:()=>fallbackPending||Promise.resolve(),
   TARGETS,WEAPON_ID,SOURCE_ID});
 }
 return Object.freeze({create,TARGETS,WEAPON_ID,SOURCE_ID,
  FALLBACK_ID,RECOIL_SECONDS});
});
