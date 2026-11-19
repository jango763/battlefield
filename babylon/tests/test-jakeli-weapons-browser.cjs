"use strict";
const {chromium}=require("/tmp/jakeli-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/jakeli-weapons";
// Match the approved British grip budget in assets/allied-soldiers/manifest.json.
// A visible weapon mesh does not prove that either hand actually holds it.
const GRIP_LIMITS=Object.freeze({right:0.06,left:0.06,stock:0.15});
function checkGrip(snapshot,pose){
 const g=snapshot.grip;
 const values={right:g?.rightGripMeters,left:g?.leftGripMeters,stock:g?.stockToShoulderMeters};
 const finite=Object.values(values).every(x=>typeof x==="number"&&Number.isFinite(x));
 // Unlike the attachment-to-itself socket distance, this measures a genuine
 // animated finger joint against the GLB weapon trigger marker.
 const fingerToTrigger=g?.rightIndex2ToTriggerMeters;
 const fingerLocal=g?.rightIndex2TriggerLocal;
 const contactPass=Number.isFinite(fingerToTrigger)&&fingerToTrigger<=.055&&
   Array.isArray(fingerLocal)&&fingerLocal.length===3&&
   fingerLocal.every(Number.isFinite)&&
   Math.abs(fingerLocal[0])<=.045&&fingerLocal[1]>=-.06&&fingerLocal[1]<=.01&&
   Math.abs(fingerLocal[2])<=.045&&
   Number.isFinite(g?.rightThumb2ToTriggerMeters)&&g.rightThumb2ToTriggerMeters<=.10;
 const curlPass=g?.fingerGripProfile==="jakeli-weapon-specific-v1"&&
   Number.isInteger(g?.fingerJointCount)&&g.fingerJointCount>=26&&
   Number.isFinite(g?.triggerIndexFlexRad)&&g.triggerIndexFlexRad>.40&&g.triggerIndexFlexRad<.9&&
   Number.isFinite(g?.supportFingerFlexRad)&&g.supportFingerFlexRad>.95&&
   g.triggerIndexFlexRad<g.supportFingerFlexRad;
 if(snapshot.error||g?.error||!finite||!curlPass||!contactPass||!g?.mounted||!g?.rightReachable||
    !g?.leftReachable||!g?.leftSupportInHandguard||
    values.right>GRIP_LIMITS.right||values.left>GRIP_LIMITS.left||
    values.stock>GRIP_LIMITS.stock){
   throw Error("Jakeli two-hand IK failed "+snapshot.weapon+" / "+pose+
     " thresholds="+JSON.stringify(GRIP_LIMITS)+" values="+JSON.stringify(snapshot));
 }
}
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},
   deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto("http://127.0.0.1:8809/babylon/jakeli-weapons-iphone.html",
    {waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>window.__JAKELI_WEAPON_QA__?.loaded||
    window.__JAKELI_WEAPON_QA__?.error,null,{timeout:120000});
  const init=await page.evaluate(()=>window.__JAKELI_WEAPON_QA__);
  console.log("JAKELI_REAL_WEAPON_INIT",JSON.stringify(init));
  if(!init.loaded||init.error||init.bones!==65||init.meshCount!==13||init.clips.length!==4)
   throw Error("Real Jakeli 65-bone weapon rig not loaded "+JSON.stringify(init));
  const results=[];
  for(const w of ["uk-lee-enfield","uk-sten","uk-bren","uk-piat"]){
   if(w!=="uk-lee-enfield"){
    await page.locator('[data-weapon="'+w+'"]').click();
   }
   await page.waitForFunction(id=>{
    const q=window.__JAKELI_WEAPON_QA__;
    return q?.weaponId===id&&q.grip?.mounted&&q.weaponMeshCount>0;
   },w,{timeout:25000});
   await page.waitForTimeout(250);
   const data=await page.evaluate(()=>{
    const q=window.__JAKELI_WEAPON_QA__,s=window.BABYLON.EngineStore.LastCreatedScene;
    return {weapon:q.weaponId,weaponMeshes:q.weaponMeshCount,
      grip:q.grip,bones:q.bones,actors:q.meshCount,
      skeletons:s.skeletons.length,error:q.error};
   });
   console.log("JAKELI_REAL_WEAPON_CHECK",JSON.stringify(data));
   checkGrip(data,"ready");
   results.push({pose:"ready",...data});
   await page.screenshot({path:dir+"/"+w+".png",fullPage:true});
   if(data.error||data.grip?.error||data.bones!==65||data.skeletons!==1||
      !data.grip?.mounted||data.grip?.armChannelsRemoved!==32||
      data.weaponMeshes<1)
    throw Error("Weapon state failed "+JSON.stringify(data));
   await page.locator('[data-pose="aim"]').click();
   await page.waitForTimeout(300);
   const aim=await page.evaluate(()=>{
     const q=window.__JAKELI_WEAPON_QA__,s=window.BABYLON.EngineStore.LastCreatedScene;
     return {weapon:q.weaponId,weaponMeshes:q.weaponMeshCount,
       grip:q.grip,bones:q.bones,actors:q.meshCount,
       skeletons:s.skeletons.length,error:q.error};
   });
   checkGrip(aim,"aim");
   results.push({pose:"aim",...aim});
   console.log("JAKELI_REAL_WEAPON_AIM_CHECK",JSON.stringify(aim));
   await page.screenshot({path:dir+"/"+w+"-aim.png",fullPage:true});
   await page.locator("#zoom-right").click();
   await page.waitForTimeout(200);
   const closeup=await page.evaluate(()=>{
     const cam=window.BABYLON.EngineStore.LastCreatedScene.activeCamera;
     return {radius:cam.radius,target:cam.target.asArray()};
   });
   if(closeup.radius<1.05||closeup.radius>1.25||closeup.target.some(x=>!Number.isFinite(x)))
     throw Error("Jakeli closeup camera failed "+JSON.stringify(closeup));
   await page.screenshot({path:dir+"/"+w+"-trigger-close.png",fullPage:true});
   await page.locator("#zoom-full").click();
   await page.locator('[data-pose="ready"]').click();
  }
  if(errors.length)throw Error("Browser errors "+JSON.stringify(errors));
  console.log("JAKELI_REAL_WEAPONS_CHROMIUM_PASS",JSON.stringify({
    weaponCount:4,gripPoseChecks:results.length,actualBritishMesh:true,ikReused:true,
    allMounted:true,gripLimitsMeters:GRIP_LIMITS,visualApproval:false,iphoneSafari:false,
    greatestRightGrip:Math.max(...results.map(x=>x.grip.rightGripMeters)),
    greatestLeftGrip:Math.max(...results.map(x=>x.grip.leftGripMeters)),
    greatestStockGap:Math.max(...results.map(x=>x.grip.stockToShoulderMeters)),
    minFingerJoints:Math.min(...results.map(x=>x.grip.fingerJointCount)),
    maxTrueIndexTriggerGap:Math.max(...results.map(x=>x.grip.rightIndex2ToTriggerMeters)),
    maxThumbTriggerGap:Math.max(...results.map(x=>x.grip.rightThumb2ToTriggerMeters)),
    triggerIndexFlexRange:[Math.min(...results.map(x=>x.grip.triggerIndexFlexRad)),Math.max(...results.map(x=>x.grip.triggerIndexFlexRad))],
    supportFingerFlexRange:[Math.min(...results.map(x=>x.grip.supportFingerFlexRad)),Math.max(...results.map(x=>x.grip.supportFingerFlexRad))]
  }));
 }catch(e){
  console.error("JAKELI_REAL_WEAPONS_CHROMIUM_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});