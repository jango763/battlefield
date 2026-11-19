"use strict";
const {chromium}=require("/tmp/jakeli-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/jakeli-weapons";
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
   console.log("JAKELI_REAL_WEAPON_CHECK",JSON.stringify(data));results.push(data);
   await page.screenshot({path:dir+"/"+w+".png",fullPage:true});
   if(data.error||data.grip?.error||data.bones!==65||data.skeletons!==1||
      !data.grip?.mounted||data.grip?.armChannelsRemoved!==32||
      data.weaponMeshes<1)
    throw Error("Weapon state failed "+JSON.stringify(data));
   await page.locator('[data-pose="aim"]').click();
   await page.waitForTimeout(300);
   await page.screenshot({path:dir+"/"+w+"-aim.png",fullPage:true});
   await page.locator('[data-pose="ready"]').click();
  }
  if(errors.length)throw Error("Browser errors "+JSON.stringify(errors));
  console.log("JAKELI_REAL_WEAPONS_CHROMIUM_PASS",JSON.stringify({
    weaponCount:results.length,actualBritishMesh:true,ikReused:true,
    allMounted:true,visualApproval:false,iphoneSafari:false,
    greatestRightGrip:Math.max(...results.map(x=>x.grip.rightGripMeters)),
    greatestLeftGrip:Math.max(...results.map(x=>x.grip.leftGripMeters))
  }));
 }catch(e){
  console.error("JAKELI_REAL_WEAPONS_CHROMIUM_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});