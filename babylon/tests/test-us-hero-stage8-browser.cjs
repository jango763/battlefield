"use strict";
const {chromium}=require("/tmp/stage8-qa/node_modules/playwright");
const fs=require("node:fs");
const root="http://127.0.0.1:8788/babylon/us-hero-stage8-iphone.html";
const dir="babylon-qa-results/us-hero-stage8";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 try{
  await page.goto(root,{waitUntil:"domcontentloaded",timeout:50000});
  await page.waitForFunction(()=>window.__US_HERO_STAGE8_QA__?.ready||window.__US_HERO_STAGE8_QA__?.error,
   null,{timeout:110000});
  const ready=await page.evaluate(()=>window.__US_HERO_STAGE8_QA__.ready);
  if(!ready)throw Error("Stage8 load error: "+await page.evaluate(()=>window.__US_HERO_STAGE8_QA__.error));
  const structure=await page.evaluate(()=>{
   const q=window.__US_HERO_STAGE8_QA__,s=window.BABYLON.EngineStore.LastCreatedScene;
   return {bones:q.bones,skeletons:s.skeletons.length,armChannelsRemoved:q.armChannelsRemoved,
    weapons:document.querySelectorAll("[data-weapon]").length,
    motions:document.querySelectorAll("[data-motion]").length,
    combatButtons:[!document.getElementById("fire").disabled,document.getElementById("reload").disabled],
    clips:[...s.animationGroups].map(g=>g.name)};
  });
  if(structure.bones!==65||structure.skeletons!==1||structure.weapons!==4||structure.motions!==4)
   throw Error("Stage8 scene or controls invalid: "+JSON.stringify(structure));
  console.log("STAGE8_STRUCTURE_PASS",JSON.stringify(structure));
  for(const [motion,id] of [["walk","Walk_Quaternius"],["jog","Jog_Quaternius"],["sprint","Sprint_Quaternius"],["idle","Idle_Quaternius"]]){
   await page.locator('[data-motion="'+motion+'"]').click();
   const x=await page.evaluate(()=>({motion:window.__US_HERO_STAGE8_QA__.motion,
    pose:window.BABYLON.EngineStore.LastCreatedScene.animationGroups.find(g=>g.isPlaying)?.name,
    moving:window.__US_HERO_STAGE8_QA__.combat.snapshot().moving}));
   if(x.motion!==motion||x.moving!==(motion!=="idle"))
    throw Error("Motion "+motion+" failed: "+JSON.stringify(x));
   console.log("STAGE8_MOTION",motion,JSON.stringify(x));
  }
  const cases=["uk-lee-enfield","uk-sten","uk-bren","uk-piat"];
  let initialCount=0;
  for(const id of cases){
   if(id!=="uk-lee-enfield"){
    await page.locator('[data-weapon="'+id+'"]').click();
    await page.waitForFunction(id=>window.__US_HERO_STAGE8_QA__?.weapon===id||
      !!window.__US_HERO_STAGE8_QA__?.error,id,{timeout:65000});
   }
   await page.locator('[data-motion="walk"]').click();
   await page.waitForTimeout(160);
   let check=await page.evaluate(()=>{
    const q=window.__US_HERO_STAGE8_QA__;
    return {current:q.weapon,moving:q.combat.snapshot().moving,
      able:q.combat.snapshot().canFireMoving,weaponMesh:q.rig.weaponMeshCount,
      mount:q.rigInstance.getWeaponMount(),
      muzzle:q.rigInstance.getMuzzleWorld()};
   });
   if(check.current!==id||!check.moving||check.mount.parent!=="mixamorig:Weapon_R")
    throw Error("Stage8 weapon/move mismatch "+JSON.stringify(check));
   if(check.muzzle.weaponId!==id||check.muzzle.position.some(x=>!Number.isFinite(x)))
    throw Error("Stage8 muzzle invalid for "+id);
   // Use the real fire button to test event wiring and the first round.
   const before=await page.evaluate(()=>window.__US_HERO_STAGE8_QA__.combat.snapshot().shots);
   await page.locator("#fire").dispatchEvent("pointerdown",{pointerId:17});
   await page.locator("#fire").dispatchEvent("pointerup",{pointerId:17});
   const whileWalking=await page.evaluate(()=>{
    const q=window.__US_HERO_STAGE8_QA__;
    return {shots:q.combat.snapshot().shots,loaded:q.combat.snapshot().loaded,
      fx:q.effects.status(),overlay:q.rig.combatRecoil};
   });
   if(check.able && whileWalking.shots<=before)
    throw Error("Must shoot on move with "+id);
   if(!check.able&&whileWalking.shots!==before)
    throw Error("Rifle/PIAT fired while moving "+id);
   await page.locator('[data-motion="idle"]').click();
   await page.waitForTimeout(80);
   if(!check.able){
    await page.locator("#fire").dispatchEvent("pointerdown",{pointerId:18});
    await page.locator("#fire").dispatchEvent("pointerup",{pointerId:18});
   }
   const shot=await page.evaluate(()=>{
    const q=window.__US_HERO_STAGE8_QA__;
    return {current:q.weapon,motion:q.motion,ammo:q.combat.snapshot(),
      fx:q.effects.status(),muzzle:q.rigInstance.getMuzzleWorld(),
      left:q.rig.leftGripMeters,right:q.rig.rightGripMeters,
      piatMeshes:window.BABYLON.EngineStore.LastCreatedScene.meshes.filter(m=>m.name.startsWith("PIAT ")).length};
   });
   console.log("STAGE8_WEAPON_TEST",JSON.stringify({
    id,shots:shot.ammo.shots,loaded:shot.ammo.loaded,reserve:shot.ammo.reserve,
    reload:shot.ammo.reloadRemaining,fx:shot.fx.shots,piat:shot.piatMeshes,
    left:shot.left,right:shot.right,canFireMoving:check.able}));
   if(shot.ammo.shots<1||shot.fx.shots<1)
    throw Error("No actual shot or muzzle FX for "+id);
   if(shot.right>.018||shot.left>.035)
    throw Error("Weapon grips lost while shooting "+id);
   if(id==="uk-piat" && (shot.piatMeshes<30||shot.fx.missiles<1))
    throw Error("PIAT blast/projectile wrong");
   if(id!=="uk-piat"&&shot.piatMeshes)throw Error("Leaked PIAT mesh");
   if(id==="uk-sten"||id==="uk-bren"){
    await page.locator("#reload").click();
    const reload=await page.evaluate(()=>window.__US_HERO_STAGE8_QA__.combat.snapshot());
    if(!reload.reloading)throw Error("Manual reload not started "+id);
    await page.evaluate(()=>window.__US_HERO_STAGE8_QA__.combat.tick(9));
    const full=await page.evaluate(()=>window.__US_HERO_STAGE8_QA__.combat.snapshot());
    if(full.reloading||full.loaded!==full.magazineSize)
     throw Error("Reload not completed "+id+" "+JSON.stringify(full));
   }
   await page.screenshot({path:dir+"/"+id+"-mobile.png",fullPage:true});
   await page.evaluate(()=>{
    document.getElementById("panel").style.display="none";
    const c=window.BABYLON.EngineStore.LastCreatedScene.activeCamera;
    c.radius=1.85;c.alpha=Math.PI*.77;c.beta=1.37;
    c.setTarget(new window.BABYLON.Vector3(0,1.13,0));
   });
   await page.waitForTimeout(250);
   await page.screenshot({path:dir+"/"+id+"-full.png",fullPage:true});
   await page.evaluate(()=>document.getElementById("panel").style.display="");
   initialCount++;
  }
  await page.locator('[data-weapon="uk-lee-enfield"]').click();
  await page.waitForFunction(()=>window.__US_HERO_STAGE8_QA__.weapon==="uk-lee-enfield",null,{timeout:65000});
  const last=await page.evaluate(()=>{
   const q=window.__US_HERO_STAGE8_QA__,sc=window.BABYLON.EngineStore.LastCreatedScene;
   return {changes:q.changes,shots:q.shots,skeletons:sc.skeletons.length,
    piatMeshes:sc.meshes.filter(m=>m.name.startsWith("PIAT ")).length,
    effectMeshes:sc.meshes.filter(m=>m.name.startsWith("stage8-")).length,
    error:q.error,rigError:q.rig.error};
  });
  console.log("STAGE8_RESTORE_RIFLE",JSON.stringify(last));
  if(last.skeletons!==1||last.piatMeshes||last.changes!==4||last.effectMeshes!==2||
     last.error||last.rigError)throw Error("Stage8 cleanup failed "+JSON.stringify(last));
  if(errors.length)throw Error("Browser errors: "+JSON.stringify(errors));
  console.log("STAGE8_MOBILE_BROWSER_PASS",JSON.stringify({weapons:initialCount,motions:4,
   changes:last.changes,shots:last.shots,visualFiles:8}));
 }catch(e){
  console.error("STAGE8_MOBILE_BROWSER_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});