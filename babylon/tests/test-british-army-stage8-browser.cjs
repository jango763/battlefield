"use strict";
const {chromium}=require("/tmp/british-stage2-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/british-stage8";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},
  deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await page.addInitScript(()=>{Math.random=()=>.1;});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 const snapshot=()=>page.evaluate(()=>{
  const q=window.__BRITISH_STAGE8_QA__,s=q.piat,sc=window.BABYLON.EngineStore.LastCreatedScene;
  return {error:q.error,stage:q.stage,loaded:q.loaded,reference:q.referenceOnly,
   verified:q.modelIdentityVerified,bones:q.rigAudit?.bones,
   clips:q.animation?.clipCount,skeletons:sc.skeletons.length,
   motion:q.motion,weapon:s?.weapon,source:s?.sourceWeapon,
   procedural:s?.proceduralPiatModel,
   magazine:s?.magazine,reserve:s?.reserve,total:s?.fullPiatAmmo,
   reloadSeconds:s?.reloadSeconds,remaining:s?.reloadRemaining,reloading:s?.reloading,
   canFireMoving:s?.canFireMoving,
   shots:s?.shots,fx:s?.fx,visual:s?.visual,impact:s?.impact,
   friendlyHp:s?.friendlyHp,targets:s?.targets,
   mount:s?.mounted,grip:s?.grip,aim:s?.aim?.barrelDot,
   last:q.lastShot,lastRejection:q.lastRejection,
   deployed:s?.readyForBritishDeployment
  };
 });
 try{
  await page.goto("http://127.0.0.1:8799/babylon/british-stage8-iphone.html",
   {waitUntil:"domcontentloaded",timeout:55000});
  await page.waitForFunction(()=>window.__BRITISH_STAGE8_QA__?.ready||
    window.__BRITISH_STAGE8_QA__?.error,null,{timeout:110000});
  const before=await snapshot();
  if(before.error||before.stage!==8||before.loaded||before.verified||
   !(await page.locator("#fire").isDisabled()))
   throw Error("Stage8 must never silently invent UK models "+JSON.stringify(before));
  await page.screenshot({path:dir+"/original-uk-skins-pending.png",fullPage:true});
  await page.locator("#reference").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE8_QA__?.loaded||
   window.__BRITISH_STAGE8_QA__?.error,null,{timeout:130000});
  const ready=await snapshot();
  console.log("BRITISH_STAGE8_READY",JSON.stringify(ready));
  if(ready.error||!ready.loaded||!ready.reference||ready.verified||
   ready.bones!==65||ready.skeletons!==1||ready.clips!==4||
   ready.weapon!=="uk-piat"||ready.source!=="Panzerschreck"||
   !ready.procedural||ready.magazine!==1||ready.reserve!==3||
   ready.total!==4||ready.reloadSeconds!==9||ready.canFireMoving||
   !ready.grip?.ok||ready.mount?.parent!=="mixamorig:Weapon_R"||
   ready.mount?.mountCount!==2||ready.aim<.97||ready.deployed)
   throw Error("Stage8 PIAT initial actual weapon/skeleton failed "+
    JSON.stringify(ready));
  await page.screenshot({path:dir+"/piat-ready.png",fullPage:true});
  // PIAT cannot shoot while walking, independently of click UI.
  await page.locator('[data-motion="walk"]').click();
  await page.locator("#fire").click();
  const walking=await snapshot();
  if(walking.error||walking.motion!=="walk"||walking.shots!==0||
   walking.total!==4||walking.lastRejection!=="stop-to-fire")
   throw Error("PIAT shot accepted during walk "+JSON.stringify(walking));
  await page.screenshot({path:dir+"/moving-shot-blocked.png",fullPage:true});
  await page.locator('[data-motion="idle"]').click();
  await page.locator('[data-pose="aim"]').click();
  await page.locator("#fire").click();
  const fired=await snapshot();
  console.log("BRITISH_STAGE8_FIRST_GRENADE",JSON.stringify(fired));
  if(fired.error||fired.motion!=="idle"||fired.shots!==1||
   fired.magazine!==0||fired.reserve!==3||fired.total!==3||
   !fired.reloading||fired.remaining<8.7||
   fired.last?.sourceWeapon!=="Panzerschreck"||!fired.last?.ok||
   !fired.last?.impact||!fired.last?.hits?.length||
   fired.fx?.shots!==1||fired.fx?.missiles!==1||
   !fired.visual?.visibleExplosion||!fired.visual?.shots||
   fired.friendlyHp!==100||!fired.grip?.ok||fired.aim<.97||
   fired.mount?.parent!=="mixamorig:Weapon_R")
   throw Error("PIAT explosion, AoE, 9s auto reload or Weapon_R failed "+
    JSON.stringify(fired));
  await page.screenshot({path:dir+"/piat-explosion-and-reload.png",fullPage:true});
  await page.locator("#fire").click();
  const blocked=await snapshot();
  if(blocked.shots!==1||blocked.lastRejection!=="reloading")
   throw Error("PIAT fired before 9s reload completed "+
    JSON.stringify(blocked));
  await page.evaluate(()=>{
   const b=window.__BRITISH_STAGE8_QA__.range().getBattle();
   for(let i=0;i<92;i++)b.tick(.1);
   window.__BRITISH_STAGE8_QA__.sync();
  });
  const reloaded=await snapshot();
  console.log("BRITISH_STAGE8_RELOADED",JSON.stringify(reloaded));
  if(reloaded.error||reloaded.reloading||reloaded.magazine!==1||
   reloaded.reserve!==2||reloaded.total!==3||
   reloaded.mount?.parent!=="mixamorig:Weapon_R"||!reloaded.grip?.ok)
   throw Error("PIAT 9s real balance reload failed "+JSON.stringify(reloaded));
  await page.screenshot({path:dir+"/second-grenade-loaded.png",fullPage:true});
  // The ballistic impact may affect nearby enemies, but must never hit ally.
  await page.locator("#fire").click();
  const second=await snapshot();
  console.log("BRITISH_STAGE8_SECOND_GRENADE",JSON.stringify(second));
  if(second.error||second.shots!==2||second.total!==2||
   second.fx?.missiles!==2||!second.last?.impact||second.friendlyHp!==100)
   throw Error("PIAT second rocket or friendly fire mismatch "+JSON.stringify(second));
  await page.locator("#reset").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE8_QA__?.piat?.shots===0||
   window.__BRITISH_STAGE8_QA__?.error,null,{timeout:20000});
  const reset=await snapshot();
  if(reset.error||reset.shots!==0||reset.magazine!==1||
   reset.reserve!==3||reset.total!==4||reset.reloading||
   reset.targets.filter(t=>t.alive).length!==3||reset.skeletons!==1||
   reset.friendlyHp!==100||reset.verified||errors.length)
   throw Error("PIAT reset/honesty regression "+JSON.stringify({reset,errors}));
  await page.screenshot({path:dir+"/piat-reset.png",fullPage:true});
  console.log("BRITISH_STAGE8_MOBILE_PASS",JSON.stringify({
   controlHeroOnly:true,originalBritishSkin:false,oneSkeleton65Bones:true,
   quaterniusClips:4,proceduralApprovedPIAT:true,twoHandIK:true,
   blastDamage:true,projectileVfx:true,noFriendlyFire:true,
   reloadSeconds:9,ammo:4,movingBlocked:true,rifleFallbackCoveredByNodeTest:true
  }));
 }catch(e){
  console.error("BRITISH_STAGE8_MOBILE_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
