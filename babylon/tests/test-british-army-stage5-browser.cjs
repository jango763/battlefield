"use strict";
const {chromium}=require("/tmp/british-stage2-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/british-stage5";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},
  deviceScaleFactor:1,isMobile:true,hasTouch:true});
 // Only for deterministic regression tests of authoritative BattlefieldBalance.
 // This does not change the random seed for actual players.
 await page.addInitScript(()=>{Math.random=()=>.1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 try{
  await page.goto("http://127.0.0.1:8799/babylon/british-stage5-iphone.html",
   {waitUntil:"domcontentloaded",timeout:55000});
  await page.waitForFunction(()=>window.__BRITISH_STAGE5_QA__?.ready||
   window.__BRITISH_STAGE5_QA__?.error,null,{timeout:110000});
  const empty=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE5_QA__;
   return {stage:q.stage,ready:q.ready,loaded:q.loaded,verified:q.modelIdentityVerified,
    error:q.error,shootDisabled:document.querySelector("#fire").disabled};
  });
  if(empty.error||empty.stage!==5||!empty.ready||empty.loaded||
   empty.verified||!empty.shootDisabled)
   throw Error("Stage5 cannot pretend original British GLBs are installed "+
    JSON.stringify(empty));
  await page.screenshot({path:dir+"/before-original-british-glb.png",fullPage:true});
  await page.locator("#reference").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE5_QA__?.loaded||
   window.__BRITISH_STAGE5_QA__?.error,null,{timeout:125000});
  const ready=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE5_QA__,scene=window.BABYLON.EngineStore.LastCreatedScene;
   return {stage:q.stage,loaded:q.loaded,error:q.error,bones:q.rigAudit?.bones,
    referenceOnly:q.referenceOnly,sourceVerified:q.modelIdentityVerified,
    clips:q.animation?.clipCount,skeletons:scene.skeletons.length,
    rifle:q.rifle,opponents:scene.transformNodes.filter(n=>n.name.startsWith("st9-opponent-")).length};
  });
  console.log("BRITISH_STAGE5_READY",JSON.stringify(ready));
  if(ready.error||!ready.loaded||ready.bones!==65||!ready.referenceOnly||
   ready.sourceVerified||ready.clips!==4||ready.skeletons!==1||
   ready.opponents!==3||ready.rifle?.weapon!=="uk-lee-enfield"||
   ready.rifle?.mounted?.parent!=="mixamorig:Weapon_R"||
   !ready.rifle?.grip?.ok||ready.rifle?.aim?.barrelDot<.97||
   !ready.rifle?.infiniteAmmo||ready.rifle?.interval!==2.1||
   ready.rifle?.readyForBritishDeployment)
   throw Error("Stage5 original-model honesty/real rifle 3D mount failed "+
    JSON.stringify(ready));
  await page.screenshot({path:dir+"/rifle-ready.png",fullPage:true});
  await page.locator('[data-pose="aim"]').click();
  await page.locator("#fire").click();
  await page.waitForTimeout(180);
  const fired=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE5_QA__,r=q.rifle;
   return {error:q.error,last:q.lastShot,shots:r?.shots,damage:r?.damage,
    kills:r?.kills,cooldown:r?.cooldownRemaining,infinite:r?.infiniteAmmo,
    visual:r?.visual,fx:r?.fx,aim:r?.aim,grip:r?.grip,
    mount:r?.mounted,targets:r?.targets};
  });
  console.log("BRITISH_STAGE5_FIRST_SHOT",JSON.stringify(fired));
  if(fired.error||!fired.last?.ok||fired.shots!==1||fired.cooldown<=1||
   !fired.infinite||fired.visual?.shots!==1||fired.fx?.shots!==1||
   fired.aim?.barrelDot<.97||!fired.grip?.ok||
   fired.mount?.parent!=="mixamorig:Weapon_R"||
   !(fired.targets.find(t=>t.id==="enemy-b").hp<100))
    throw Error("Rifle shot damage/flash/recoil/mount invalid "+JSON.stringify(fired));
  await page.screenshot({path:dir+"/aim-hit-recoil.png",fullPage:true});
  await page.locator("#fire").click();
  const blocked=await page.evaluate(()=>({
   shots:window.__BRITISH_STAGE5_QA__.rifle?.shots,
   reason:window.__BRITISH_STAGE5_QA__.lastRejection
  }));
  if(blocked.shots!==1||blocked.reason!=="cooldown")
   throw Error("2.1s authentic rifle cooldown bypass "+JSON.stringify(blocked));
  await page.locator('[data-motion="walk"]').click();
  await page.locator("#fire").click();
  const moving=await page.evaluate(()=>({
   shots:window.__BRITISH_STAGE5_QA__.rifle?.shots,
   reason:window.__BRITISH_STAGE5_QA__.lastRejection,
   motion:window.__BRITISH_STAGE5_QA__.motion
  }));
  if(moving.motion!=="walk"||moving.shots!==1||
   moving.reason!=="stop-to-fire")
   throw Error("Lee-Enfield fired while walking "+JSON.stringify(moving));
  await page.screenshot({path:dir+"/walk-firing-blocked.png",fullPage:true});
  await page.locator('[data-motion="idle"]').click();
  await page.locator('[data-target="enemy-a"]').click();
  const chosen=await page.evaluate(()=>({
   selected:window.__BRITISH_STAGE5_QA__.rifle?.targetId,
   aim:window.__BRITISH_STAGE5_QA__.rifle?.aim?.barrelDot,
   mounted:window.__BRITISH_STAGE5_QA__.rifle?.mounted?.parent,
   grip:window.__BRITISH_STAGE5_QA__.rifle?.grip?.ok
  }));
  if(chosen.selected!=="enemy-a"||chosen.aim<.97||
   !chosen.grip||chosen.mounted!=="mixamorig:Weapon_R")
   throw Error("Rifle is firing backwards after target switch "+JSON.stringify(chosen));
  // Advance the actual authoritative battle timer; never fake shot acceptance.
  await page.evaluate(()=>window.__BRITISH_STAGE5_QA__.range().getBattle().tick(2.2));
  await page.locator("#fire").click();
  const again=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE5_QA__;
   return {shots:q.rifle?.shots,target:q.lastShot?.targetId,
    source:q.lastShot?.sourceWeapon,fxShots:q.rifle?.fx?.shots,error:q.error};
  });
  console.log("BRITISH_STAGE5_SECOND_SHOT",JSON.stringify(again));
  if(again.error||again.shots!==2||again.target!=="enemy-a"||
   again.source!=="Kar98k"||again.fxShots!==2)
   throw Error("Second rifle shot not synchronized with authoritative ammo "+JSON.stringify(again));
  await page.locator("#reset").click();
  const reset=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE5_QA__;
   return {shots:q.rifle?.shots,targets:q.rifle?.targets,
    ammo:q.rifle?.infiniteAmmo,match:q.rifle?.mounted,
    skeletons:window.BABYLON.EngineStore.LastCreatedScene.skeletons.length,
    originalVerified:q.modelIdentityVerified,error:q.error};
  });
  if(reset.error||reset.shots!==0||!reset.ammo||reset.skeletons!==1||
   reset.targets.some(t=>!t.alive||t.hp!==100)||
   reset.match?.mountCount!==1||reset.originalVerified||
   errors.length)throw Error("Reset/asset safety regression "+JSON.stringify({reset,errors}));
  await page.screenshot({path:dir+"/rifle-reset.png",fullPage:true});
  console.log("BRITISH_STAGE5_IPHONE_PASS",JSON.stringify({
   rig65Bones:true,weapon:"Lee-Enfield",shots:2,cooldown:2.1,
   rifleInfiniteAmmo:true,preventsMovingShot:true,realDamage:true,
   recoilFX:true,threeTargets:true,originalBritishSkin:false
  }));
 }catch(e){
  console.error("BRITISH_STAGE5_IPHONE_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
