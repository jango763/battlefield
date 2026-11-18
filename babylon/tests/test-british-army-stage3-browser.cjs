"use strict";
const {chromium}=require("/tmp/british-stage2-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/british-stage3";
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
  await page.goto("http://127.0.0.1:8799/babylon/british-stage3-iphone.html",
   {waitUntil:"domcontentloaded",timeout:55000});
  await page.waitForFunction(()=>window.__BRITISH_STAGE3_QA__?.ready||
    window.__BRITISH_STAGE3_QA__?.error,null,{timeout:110000});
  const init=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE3_QA__;
   return {ready:q.ready,loaded:q.loaded,referenceOnly:q.referenceOnly,
    modelIdentityVerified:q.modelIdentityVerified,error:q.error};
  });
  if(!init.ready||init.loaded||init.modelIdentityVerified)
   throw Error("Stage3 must NOT pretend that British GLB exists: "+JSON.stringify(init));
  await page.screenshot({path:dir+"/before-source-asset.png",fullPage:true});
  await page.locator("#reference").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE3_QA__?.loaded||
    window.__BRITISH_STAGE3_QA__?.error,null,{timeout:125000});
  const q=await page.evaluate(()=>{
   const a=window.__BRITISH_STAGE3_QA__,s=a.animation;
   return {error:a.error,loaded:a.loaded,referenceOnly:a.referenceOnly,
    identityVerified:a.modelIdentityVerified,bones:a.rigAudit?.bones,
    sceneSkeletons:a.sceneSkeletons,clipCount:s?.clipCount,
    mapped:s?.mappedChannels,sourceAndTargetWereDifferent:s?.sourceAndTargetWereDifferent,
    gameplayReady:s?.readyForBritishDeployment};
  });
  console.log("BRITISH_STAGE3_CONTROL_READY",JSON.stringify(q));
  if(q.error||!q.loaded||!q.referenceOnly||q.identityVerified||
    q.bones!==65||q.sceneSkeletons!==1||q.clipCount!==4||
    q.mapped?.some(x=>x.joints<18)||q.sourceAndTargetWereDifferent!==true||
    q.gameplayReady!==false)
   throw Error("Real retarget/crossfade validation failed: "+JSON.stringify(q));
  await page.screenshot({path:dir+"/retargeted-idle-control.png",fullPage:true});
  let changes=0;
  for(const motion of ["walk","jog","sprint","idle"]){
   await page.locator('[data-motion="'+motion+'"]').click();
   const snap=await page.evaluate(()=>{
    const q=window.__BRITISH_STAGE3_QA__,s=q.animation,scene=window.BABYLON.EngineStore.LastCreatedScene;
    return {motion:s.motion,clip:s.activeClip,changes:s.animationChanges,
     playing:scene.animationGroups.filter(x=>x.isPlaying).map(x=>x.name),
     skeletons:scene.skeletons.length,error:q.error};
   });
   console.log("BRITISH_STAGE3_MOTION",JSON.stringify(snap));
   if(snap.error||snap.motion!==motion||snap.changes<=changes||
     snap.skeletons!==1||!snap.clip.includes("_Quaternius")||snap.playing.length>2)
    throw Error("Movement transition failed "+JSON.stringify(snap));
   changes=snap.changes;
   // Headless software GL renders at variable FPS: wait for the actual
   // frame-time-based crossfade, not an arbitrary wall-clock 240 ms.
   await page.waitForFunction(()=>!window.__BRITISH_STAGE3_QA__?.animation?.blending,
     null,{timeout:15000});
   const settled=await page.evaluate(()=>{
    const a=window.__BRITISH_STAGE3_QA__.animation,
     scene=window.BABYLON.EngineStore.LastCreatedScene;
    return {blending:a.blending,playing:scene.animationGroups.filter(x=>x.isPlaying).length};
   });
   if(settled.blending||settled.playing!==1)
    throw Error("Fade did not finalize cleanly "+JSON.stringify(settled));
   await page.screenshot({path:dir+"/quaternius-"+motion+".png",fullPage:true});
  }
  const finished=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE3_QA__,scene=window.BABYLON.EngineStore.LastCreatedScene;
   return {clips:q.animation.clipCount,changes:q.animation.animationChanges,
    skeletons:scene.skeletons.length,originalVerified:q.modelIdentityVerified,
    errors:q.error};
  });
  if(finished.errors||finished.changes<5||finished.skeletons!==1||
   finished.originalVerified||errors.length)throw Error("Final stage3 QA fail "+
    JSON.stringify({finished,errors}));
  console.log("BRITISH_STAGE3_MOBILE_QA_PASS",JSON.stringify(finished));
 }catch(e){
  console.error("BRITISH_STAGE3_MOBILE_QA_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
