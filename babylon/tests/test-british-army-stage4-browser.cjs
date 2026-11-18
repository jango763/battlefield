"use strict";
const {chromium}=require("/tmp/british-stage2-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/british-stage4";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},
  deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 try{
  await page.goto("http://127.0.0.1:8799/babylon/british-stage4-iphone.html",
   {waitUntil:"domcontentloaded",timeout:55000});
  await page.waitForFunction(()=>window.__BRITISH_STAGE4_QA__?.ready||
   window.__BRITISH_STAGE4_QA__?.error,null,{timeout:100000});
  const initial=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE4_QA__;
   return {ready:q.ready,loaded:q.loaded,verified:q.modelIdentityVerified,error:q.error};
  });
  if(!initial.ready||initial.loaded||initial.verified)
   throw Error("Stage4 must not fabricate British skins: "+JSON.stringify(initial));
  await page.screenshot({path:dir+"/before-real-british-skin.png",fullPage:true});
  await page.locator("#reference").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE4_QA__?.loaded||
   window.__BRITISH_STAGE4_QA__?.error,null,{timeout:125000});
  await page.waitForTimeout(140);
  const reference=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE4_QA__,scene=window.BABYLON.EngineStore.LastCreatedScene;
   return {error:q.error,loaded:q.loaded,control:q.referenceOnly,
    verified:q.modelIdentityVerified,rig:q.rigAudit?.bones,
    sceneSkeletons:scene.skeletons.length,stage:q.stage,
    motion:q.animation?.clipCount,stance:q.stance,
    qaAim:q.aim,qaGrip:q.grip,playing:scene.animationGroups.filter(g=>g.isPlaying).length,
    guns:scene.meshes.filter(m=>/Lee-Enfield/i.test(m.name)).length};
  });
  console.log("BRITISH_STAGE4_IK_READY",JSON.stringify(reference));
  if(reference.error||!reference.loaded||!reference.control||reference.verified||
   reference.rig!==65||reference.sceneSkeletons!==1||reference.stage!==4||
   reference.motion!==4||reference.playing!==1||
   reference.stance?.mounted?.parent!=="mixamorig:Weapon_R"||
   !reference.qaGrip?.ok||reference.qaAim?.barrelDot<.97||
   reference.stance?.readyForBritishDeployment)
   throw Error("Stage4 actual weapon IK or facing failed: "+JSON.stringify(reference));
  await page.screenshot({path:dir+"/rifle-ready.png",fullPage:true});
  // Aiming must operate on original 65-bone arms, not duplicate hands.
  await page.locator('[data-pose="aim"]').click();
  await page.waitForTimeout(150);
  const aim=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE4_QA__;
   return {pose:q.stance?.pose,quality:q.grip,aim:q.aim,
    mount:q.stance?.mounted};
  });
  console.log("BRITISH_STAGE4_AIM",JSON.stringify(aim));
  if(aim.pose!=="aim"||!aim.quality?.ok||aim.aim?.barrelDot<.97||
   aim.mount?.mountCount!==1)
   throw Error("Aiming changed IK attachment "+JSON.stringify(aim));
  await page.screenshot({path:dir+"/rifle-aim.png",fullPage:true});
  for(const id of ["enemy-a","enemy-c","enemy-b"]){
   await page.locator('[data-target="'+id+'"]').click();
   const v=await page.evaluate(()=>({
    target:window.__BRITISH_STAGE4_QA__.stance?.targetId,
    aim:window.__BRITISH_STAGE4_QA__.aim,
    quality:window.__BRITISH_STAGE4_QA__.grip,
    error:window.__BRITISH_STAGE4_QA__.error
   }));
   console.log("BRITISH_STAGE4_FACE_TARGET",JSON.stringify(v));
   if(v.error||v.target!==id||v.aim?.barrelDot<.97||!v.quality?.ok)
    throw Error("Hero is facing backward or wrists detached "+JSON.stringify(v));
  }
  await page.screenshot({path:dir+"/turns-to-enemy.png",fullPage:true});
  await page.locator('[data-pose="ready"]').click();
  for(const motion of ["walk","jog","sprint","idle"]){
   await page.locator('[data-motion="'+motion+'"]').click();
   await page.waitForFunction(()=>!window.__BRITISH_STAGE4_QA__?.animation?.blending,
    null,{timeout:15000});
   const v=await page.evaluate(()=>{
    const q=window.__BRITISH_STAGE4_QA__,scene=window.BABYLON.EngineStore.LastCreatedScene;
    q.sync();
    return {motion:q.motion,pose:q.stance?.pose,barrelDot:q.aim?.barrelDot,
     quality:q.grip,playing:scene.animationGroups.filter(g=>g.isPlaying).length,
     skeletons:scene.skeletons.length,error:q.error};
   });
   console.log("BRITISH_STAGE4_MOVEMENT",JSON.stringify(v));
   if(v.error||v.motion!==motion||v.pose!=="ready"||
    v.barrelDot<.97||!v.quality?.ok||v.playing!==1||v.skeletons!==1)
    throw Error("Weapons detached during Quaternius locomotion "+JSON.stringify(v));
  }
  await page.screenshot({path:dir+"/idle-after-sprint.png",fullPage:true});
  const final=await page.evaluate(()=>window.__BRITISH_STAGE4_QA__);
  if(final.error||errors.length||final.modelIdentityVerified||
   !final.referenceOnly)throw Error("Stage4 honesty/console errors "+JSON.stringify(errors));
  console.log("BRITISH_STAGE4_MOBILE_QA_PASS",JSON.stringify({
   skeletons:1,bones:65,quaterniusMotionClips:4,
   rightHandIK:true,leftHandIK:true,mountedOnWeaponR:true,
   targetTurnChecks:3,aimAndReady:true,
   importedBritishSkin:false,heroOnlyTechnicalControl:true
  }));
 }catch(e){
  console.error("BRITISH_STAGE4_MOBILE_QA_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
