"use strict";
const {chromium}=require("/tmp/british-stage2-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/british-stage6";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},
  deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await page.addInitScript(()=>{Math.random=()=>.10});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 try{
  await page.goto("http://127.0.0.1:8799/babylon/british-stage6-iphone.html",
   {waitUntil:"domcontentloaded",timeout:55000});
  await page.waitForFunction(()=>window.__BRITISH_STAGE6_QA__?.ready||
   window.__BRITISH_STAGE6_QA__?.error,null,{timeout:105000});
  const before=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE6_QA__;
   return {stage:q.stage,ready:q.ready,loaded:q.loaded,
    originalVerified:q.modelIdentityVerified,error:q.error,
    fireDisabled:document.getElementById("fire").disabled};
  });
  if(before.stage!==6||!before.ready||before.loaded||
   before.originalVerified||!before.fireDisabled||before.error)
   throw Error("Stage6 cannot pretend to have British GLBs "+JSON.stringify(before));
  await page.screenshot({path:dir+"/british-skin-still-required.png",fullPage:true});
  await page.locator("#reference").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE6_QA__?.loaded||
   window.__BRITISH_STAGE6_QA__?.error,null,{timeout:125000});
  const init=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE6_QA__,sc=window.BABYLON.EngineStore.LastCreatedScene;
   return {error:q.error,referenceOnly:q.referenceOnly,originalVerified:q.modelIdentityVerified,
    bones:q.rigAudit?.bones,sceneSkeletons:sc.skeletons.length,
    clips:q.animation?.clipCount,weapon:q.sten?.weapon,source:q.sten?.sourceWeapon,
    magazine:q.sten?.magazine,reserve:q.sten?.reserve,full:q.sten?.fullStenAmmo,
    magCount:q.sten?.magazineCount,reloadSeconds:q.sten?.reloadSeconds,
    canFireMoving:q.sten?.canFireMoving,grip:q.sten?.grip,
    barrel:q.sten?.aim?.barrelDot,mount:q.sten?.mounted,
    actors:q.sten?.visual?.visualActors,skinReady:q.sten?.readyForBritishDeployment};
  });
  console.log("BRITISH_STAGE6_READY",JSON.stringify(init));
  if(init.error||!init.referenceOnly||init.originalVerified||init.bones!==65||
   init.sceneSkeletons!==1||init.clips!==4||init.weapon!=="uk-sten"||
   init.source!=="MP40"||init.magazine!==32||init.reserve!==128||
   init.full!==160||init.magCount!==5||init.reloadSeconds!==2.5||
   !init.canFireMoving||!init.grip?.ok||init.barrel<.97||
   init.mount?.parent!=="mixamorig:Weapon_R"||init.mount?.mountCount!==2||
   init.actors!==3||init.skinReady)
   throw Error("Sten GLB socket, ammo or IK mismatch "+JSON.stringify(init));
  await page.screenshot({path:dir+"/sten-ready-control.png",fullPage:true});
  await page.locator('[data-pose="aim"]').click();
  // Real shot while standing: damage and muzzle VFX derive from approved Stage9.
  await page.locator("#fire").click();
  const shot=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE6_QA__;
   return {error:q.error,last:q.lastShot,shots:q.sten?.shots,
    mag:q.sten?.magazine,reserve:q.sten?.reserve,
    fx:q.sten?.fx,visual:q.sten?.visual,grip:q.sten?.grip,
    aim:q.sten?.aim?.barrelDot};
  });
  console.log("BRITISH_STAGE6_FIRST_SHOT",JSON.stringify(shot));
  if(shot.error||!shot.last?.ok||shot.last.sourceWeapon!=="MP40"||
   shot.shots!==1||shot.mag!==31||shot.reserve!==128||
   shot.fx?.shots!==1||shot.visual?.shots!==1||
   !shot.last.hit||!shot.last.hits.length||!shot.grip?.ok||shot.aim<.97)
   throw Error("Sten live damage/recoil/32-round counter failed "+JSON.stringify(shot));
  await page.screenshot({path:dir+"/sten-hit-and-ammo.png",fullPage:true});
  // Changing motion must not block Sten automatic fire.
  await page.locator('[data-motion="walk"]').click();
  await page.evaluate(()=>window.__BRITISH_STAGE6_QA__.range().getBattle().tick(.15));
  const moving=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE6_QA__;
   return q.fire();
  });
  const stateMove=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE6_QA__;
   return {motion:q.motion,shots:q.sten?.shots,mag:q.sten?.magazine,
    mount:q.sten?.mounted,grip:q.sten?.grip,aim:q.sten?.aim?.barrelDot,error:q.error};
  });
  console.log("BRITISH_STAGE6_MOVING",JSON.stringify({shot:moving,state:stateMove}));
  if(!moving?.ok||stateMove.motion!=="walk"||stateMove.shots!==2||
   stateMove.mag!==30||stateMove.error||!stateMove.grip?.ok||
   stateMove.aim<.97||stateMove.mount?.parent!=="mixamorig:Weapon_R")
   throw Error("Sten must fire while walking with stable grip");
  await page.screenshot({path:dir+"/sten-firing-on-move.png",fullPage:true});
  // Manual reload is exactly 2.5s, uses real reserve transfer, no scripted refill.
  await page.locator("#reload").click();
  const startingReload=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE6_QA__;
   return {remaining:q.sten?.reloadRemaining,loaded:q.sten?.magazine,
    reserve:q.sten?.reserve,reloading:q.sten?.reloading};
  });
  if(!startingReload.reloading||Math.abs(startingReload.remaining-2.5)>.4)
   throw Error("Sten reload not started correctly "+JSON.stringify(startingReload));
  // Use the existing authoritative battle tick directly to avoid a flaky wall-clock wait.
  await page.evaluate(()=>{
   const b=window.__BRITISH_STAGE6_QA__.range().getBattle();
   for(let i=0;i<26;i++)b.tick(.10);
  });
  const reloaded=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE6_QA__;
   q.sync();const r=q.range().status();
   return {reloading:r.reloading,loaded:r.magazine,reserve:r.reserve,
    full:r.fullStenAmmo,grip:r.grip,aim:r.aim?.barrelDot};
  });
  console.log("BRITISH_STAGE6_RELOADED",JSON.stringify(reloaded));
  if(reloaded.reloading||reloaded.loaded!==32||reloaded.reserve!==126||
   reloaded.full!==158||!reloaded.grip?.ok||reloaded.aim<.97)
   throw Error("Sten 2.5s reload/reserve transfer failed "+JSON.stringify(reloaded));
  await page.screenshot({path:dir+"/sten-full-magazine-after-reload.png",fullPage:true});
  // Pointer-held fire must produce several rounds, not a fake single-shot animation.
  await page.evaluate(()=>Math.random=()=>.99);
  await page.locator("#fire").dispatchEvent("pointerdown",{pointerId:3,pointerType:"touch",isPrimary:true});
  await page.waitForFunction(()=>window.__BRITISH_STAGE6_QA__?.sten?.shots>=5,
   null,{timeout:25000});
  await page.locator("#fire").dispatchEvent("pointerup",{pointerId:3,pointerType:"touch",isPrimary:true});
  const held=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE6_QA__;
   return {shots:q.sten?.shots,mag:q.sten?.magazine,
    held:q.fireHeld,grip:q.sten?.grip?.ok,
    parent:q.sten?.mounted?.parent,error:q.error};
  });
  if(held.error||held.shots<5||held.held||!held.grip||
   held.parent!=="mixamorig:Weapon_R")
   throw Error("Sten long press automatic fire failed "+JSON.stringify(held));
  console.log("BRITISH_STAGE6_HELD_FIRE",JSON.stringify(held));
  await page.locator("#reset").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE6_QA__?.sten?.shots===0||
   window.__BRITISH_STAGE6_QA__?.error,null,{timeout:12000});
  const reset=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE6_QA__;
   return {shots:q.sten?.shots,mag:q.sten?.magazine,reserve:q.sten?.reserve,
    source:q.sten?.sourceWeapon,alive:q.sten?.targets.filter(t=>t.alive).length,
    skeletons:window.BABYLON.EngineStore.LastCreatedScene.skeletons.length,
    ref:q.referenceOnly,verified:q.modelIdentityVerified,error:q.error};
  });
  if(reset.error||reset.shots!==0||reset.mag!==32||reset.reserve!==128||
   reset.source!=="MP40"||reset.alive!==3||reset.skeletons!==1||!reset.ref||
   reset.verified||errors.length)
   throw Error("Sten stage6 reset, skin honesty or console regression "+JSON.stringify({reset,errors}));
  await page.screenshot({path:dir+"/sten-reset.png",fullPage:true});
  console.log("BRITISH_STAGE6_MOBILE_PASS",JSON.stringify({
   bones:65,originalBritishSkin:false,realStenGLB:true,Weapon_R:true,
   movingFire:true,heldFire:true,damage:true,magazine:32,
   fullAmmo:160,reloadSeconds:2.5,reset:true
  }));
 }catch(e){
  console.error("BRITISH_STAGE6_MOBILE_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
