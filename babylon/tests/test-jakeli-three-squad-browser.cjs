"use strict";
const fs=require("node:fs");
const {chromium}=require("/tmp/jakeli-qa/node_modules/playwright");
const dir="babylon-qa-results/jakeli-squad";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto("http://127.0.0.1:8809/babylon/jakeli-three-squad-iphone.html",
   {waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>window.__JAKELI_SQUAD_QA__?.loaded||
    window.__JAKELI_SQUAD_QA__?.errors?.length,null,{timeout:120000});
  let q=await page.evaluate(()=>({
   ...window.__JAKELI_SQUAD_QA__,
   skeletons:window.BABYLON.EngineStore.LastCreatedScene?.skeletons?.length
  }));
  console.log("JAKELI_SQUAD_THREE_LOAD",JSON.stringify(q));
  if(!q.loaded||q.errors?.length||q.actors!==3||q.skeletons!==3||
   q.bones.some(x=>x!==65)||!q.uniqueSkeletons||!q.uniqueClips||
   q.readyForDeployment!==false)throw Error("Independent Jakeli rig check failed");
  await page.screenshot({path:dir+"/turtle-idle.png",fullPage:true});
  await page.locator('[data-motion="Walk_Quaternius"]').click();
  await page.locator('[data-mode="semicircle"]').click();
  await page.waitForTimeout(1000);
  q=await page.evaluate(()=>({
   ...window.__JAKELI_SQUAD_QA__,
   skeletons:window.BABYLON.EngineStore.LastCreatedScene.skeletons.length,
   groupsPlaying:window.BABYLON.EngineStore.LastCreatedScene.animationGroups
     .filter(g=>g.isPlaying).length
  }));
  console.log("JAKELI_SQUAD_FORMATION",JSON.stringify(q));
  if(q.errors?.length||q.formation!=="semicircle"||
   q.motion!=="Walk_Quaternius"||q.groupsPlaying!==3||q.skeletons!==3)
    throw Error("Independent squad formation or locomotion failed");
  await page.screenshot({path:dir+"/semicircle-walk.png",fullPage:true});
  if(errors.length)throw Error("Page errors: "+JSON.stringify(errors));
  console.log("JAKELI_THREE_SQUAD_CHROMIUM_PASS",JSON.stringify({
   realBritishModels:3,independentSkeletons:3,independentClipGroups:12,
   formations:2,motions:["Idle_Quaternius","Walk_Quaternius"],
   releaseApproved:false,physicalSafari:false
  }));
 }catch(e){
  console.error("JAKELI_THREE_SQUAD_CHROMIUM_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});