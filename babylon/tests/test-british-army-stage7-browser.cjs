"use strict";
const {chromium}=require("/tmp/british-stage2-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/british-stage7";
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
  await page.goto("http://127.0.0.1:8799/babylon/british-stage7-iphone.html",
   {waitUntil:"domcontentloaded",timeout:55000});
  await page.waitForFunction(()=>window.__BRITISH_STAGE7_QA__?.ready||
   window.__BRITISH_STAGE7_QA__?.error,null,{timeout:105000});
  const before=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE7_QA__;
   return {stage:q.stage,ready:q.ready,loaded:q.loaded,
    originalVerified:q.modelIdentityVerified,error:q.error,
    fireDisabled:document.getElementById("fire").disabled};
  });
  if(before.stage!==7||!before.ready||before.loaded||
   before.originalVerified||!before.fireDisabled||before.error)
   throw Error("Stage7 cannot pretend to have British GLBs "+JSON.stringify(before));
  await page.screenshot({path:dir+"/british-skin-still-required.png",fullPage:true});
  await page.locator("#reference").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE7_QA__?.loaded||
   window.__BRITISH_STAGE7_QA__?.error,null,{timeout:125000});
  const init=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE7_QA__,sc=window.BABYLON.EngineStore.LastCreatedScene;
   return {error:q.error,referenceOnly:q.referenceOnly,originalVerified:q.modelIdentityVerified,
    bones:q.rigAudit?.bones,sceneSkeletons:sc.skeletons.length,
    clips:q.animation?.clipCount,weapon:q.bren?.weapon,source:q.bren?.sourceWeapon,
    magazine:q.bren?.magazine,reserve:q.bren?.reserve,full:q.bren?.fullBrenAmmo,
    magCount:q.bren?.magazineCount,reloadSeconds:q.bren?.reloadSeconds,
    canFireMoving:q.bren?.canFireMoving,grip:q.bren?.grip,
    barrel:q.bren?.aim?.barrelDot,mount:q.bren?.mounted,
    actors:q.bren?.visual?.visualActors,skinReady:q.bren?.readyForBritishDeployment};
  });
  console.log("BRITISH_STAGE7_READY",JSON.stringify(init));
  if(init.error||!init.referenceOnly||init.originalVerified||init.bones!==65||
   init.sceneSkeletons!==1||init.clips!==4||init.weapon!=="uk-bren"||
   init.source!=="MG42"||init.magazine!==100||init.reserve!==300||
   init.full!==400||init.magCount!==4||init.reloadSeconds!==7.5||
   !init.canFireMoving||!init.grip?.ok||init.barrel<.97||
   init.mount?.parent!=="mixamorig:Weapon_R"||init.mount?.mountCount!==2||
   init.actors!==3||init.skinReady)
   throw Error("Bren GLB socket, ammo or IK mismatch "+JSON.stringify(init));
  await page.screenshot({path:dir+"/bren-ready-control.png",fullPage:true});
  await page.locator('[data-pose="aim"]').click();
  // Real shot while standing: damage and muzzle VFX derive from approved Stage9.
  await page.locator("#fire").click();
  const shot=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE7_QA__;
   return {error:q.error,last:q.lastShot,shots:q.bren?.shots,
    mag:q.bren?.magazine,reserve:q.bren?.reserve,
    fx:q.bren?.fx,visual:q.bren?.visual,grip:q.bren?.grip,
    aim:q.bren?.aim?.barrelDot};
  });
  console.log("BRITISH_STAGE7_FIRST_SHOT",JSON.stringify(shot));
  if(shot.error||!shot.last?.ok||shot.last.sourceWeapon!=="MG42"||
   shot.shots!==1||shot.mag!==99||shot.reserve!==300||
   shot.fx?.shots!==1||shot.visual?.shots!==1||
   !shot.last.hit||!shot.last.hits.length||!shot.grip?.ok||shot.aim<.97)
   throw Error("Bren live damage/recoil/100-round counter failed "+JSON.stringify(shot));
  await page.screenshot({path:dir+"/bren-hit-and-ammo.png",fullPage:true});
  // Changing motion must not block Bren automatic fire.
  await page.locator('[data-motion="walk"]').click();
  await page.evaluate(()=>window.__BRITISH_STAGE7_QA__.range().getBattle().tick(.15));
  const moving=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE7_QA__;
   return q.fire();
  });
  const stateMove=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE7_QA__;
   return {motion:q.motion,shots:q.bren?.shots,mag:q.bren?.magazine,
    mount:q.bren?.mounted,grip:q.bren?.grip,aim:q.bren?.aim?.barrelDot,error:q.error};
  });
  console.log("BRITISH_STAGE7_MOVING",JSON.stringify({shot:moving,state:stateMove}));
  if(!moving?.ok||stateMove.motion!=="walk"||stateMove.shots!==2||
   stateMove.mag!==98||stateMove.error||!stateMove.grip?.ok||
   stateMove.aim<.97||stateMove.mount?.parent!=="mixamorig:Weapon_R")
   throw Error("Bren must fire while walking with stable grip");
  await page.screenshot({path:dir+"/bren-firing-on-move.png",fullPage:true});
  // Manual reload is exactly 7.5s, uses real reserve transfer, no scripted refill.
  await page.locator("#reload").click();
  const startingReload=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE7_QA__;
   return {remaining:q.bren?.reloadRemaining,loaded:q.bren?.magazine,
    reserve:q.bren?.reserve,reloading:q.bren?.reloading};
  });
  if(!startingReload.reloading||Math.abs(startingReload.remaining-7.5)>.4)
   throw Error("Bren reload not started correctly "+JSON.stringify(startingReload));
  // Use the existing authoritative battle tick directly to avoid a flaky wall-clock wait.
  await page.evaluate(()=>{
   const b=window.__BRITISH_STAGE7_QA__.range().getBattle();
   for(let i=0;i<76;i++)b.tick(.10);
  });
  const reloaded=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE7_QA__;
   q.sync();const r=q.range().status();
   return {reloading:r.reloading,loaded:r.magazine,reserve:r.reserve,
    full:r.fullBrenAmmo,grip:r.grip,aim:r.aim?.barrelDot};
  });
  console.log("BRITISH_STAGE7_RELOADED",JSON.stringify(reloaded));
  if(reloaded.reloading||reloaded.loaded!==100||reloaded.reserve!==298||
   reloaded.full!==398||!reloaded.grip?.ok||reloaded.aim<.97)
   throw Error("Bren 7.5s reload/reserve transfer failed "+JSON.stringify(reloaded));
  await page.screenshot({path:dir+"/bren-full-magazine-after-reload.png",fullPage:true});
  // Pointer-held fire must produce several rounds, not a fake single-shot animation.
  await page.evaluate(()=>Math.random=()=>.99);
  await page.locator("#fire").dispatchEvent("pointerdown",{pointerId:3,pointerType:"touch",isPrimary:true});
  await page.waitForFunction(()=>window.__BRITISH_STAGE7_QA__?.bren?.shots>=5,
   null,{timeout:25000});
  await page.locator("#fire").dispatchEvent("pointerup",{pointerId:3,pointerType:"touch",isPrimary:true});
  const held=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE7_QA__;
   return {shots:q.bren?.shots,mag:q.bren?.magazine,
    held:q.fireHeld,grip:q.bren?.grip?.ok,
    parent:q.bren?.mounted?.parent,error:q.error};
  });
  if(held.error||held.shots<5||held.held||!held.grip||
   held.parent!=="mixamorig:Weapon_R")
   throw Error("Bren long press automatic fire failed "+JSON.stringify(held));
  console.log("BRITISH_STAGE7_HELD_FIRE",JSON.stringify(held));
  await page.locator("#reset").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE7_QA__?.bren?.shots===0||
   window.__BRITISH_STAGE7_QA__?.error,null,{timeout:12000});
  const reset=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE7_QA__;
   return {shots:q.bren?.shots,mag:q.bren?.magazine,reserve:q.bren?.reserve,
    source:q.bren?.sourceWeapon,alive:q.bren?.targets.filter(t=>t.alive).length,
    skeletons:window.BABYLON.EngineStore.LastCreatedScene.skeletons.length,
    ref:q.referenceOnly,verified:q.modelIdentityVerified,error:q.error};
  });
  if(reset.error||reset.shots!==0||reset.mag!==100||reset.reserve!==300||
   reset.source!=="MG42"||reset.alive!==3||reset.skeletons!==1||!reset.ref||
   reset.verified||errors.length)
   throw Error("Bren stage7 reset, skin honesty or console regression "+JSON.stringify({reset,errors}));
  await page.screenshot({path:dir+"/bren-reset.png",fullPage:true});
  console.log("BRITISH_STAGE7_MOBILE_PASS",JSON.stringify({
   bones:65,originalBritishSkin:false,realBrenGLB:true,Weapon_R:true,
   movingFire:true,heldFire:true,damage:true,magazine:100,
   fullAmmo:400,reloadSeconds:7.5,reset:true
  }));
 }catch(e){
  console.error("BRITISH_STAGE7_MOBILE_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
