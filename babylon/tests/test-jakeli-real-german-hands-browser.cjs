"use strict";
// Human visual gate: ONLY the original Lee-Enfield, with transplanted approved
// German source-hand geometry. Do not claim final approval from this test.
const {chromium}=require("/tmp/jakeli-qa/node_modules/playwright");
const fs=require("node:fs");
const path="babylon-qa-results/jakeli-real-hands";
fs.mkdirSync(path,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto("http://127.0.0.1:8809/babylon/jakeli-weapons-iphone.html?hands=real",
    {waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>window.__JAKELI_WEAPON_QA__?.loaded||window.__JAKELI_WEAPON_QA__?.error,
    null,{timeout:120000});
  const snap=()=>page.evaluate(()=>window.__JAKELI_WEAPON_QA__);
  let s=await snap();
  if(!s.loaded||s.error||s.meshCount!==13||s.bones!==65||
     s.clips.length!==4||s.weaponId!=="uk-lee-enfield"||
     s.handWeightSource!=="german-real-mesh")
   throw Error("Authentic geometry not loaded: "+JSON.stringify(s));
  await page.waitForTimeout(650);
  await page.screenshot({path:path+"/lee-enfield-standing.png",fullPage:true});
  await page.locator("#zoom-right").click();
  await page.waitForTimeout(550);
  await page.screenshot({path:path+"/lee-enfield-trigger-close.png",fullPage:true});
  await page.locator('[data-pose="aim"]').click();
  await page.waitForTimeout(650);
  s=await snap();
  if(s.error||s.weaponId!=="uk-lee-enfield"||!s.grip?.mounted||
     !Number.isFinite(s.grip.rightIKMeters)||!Number.isFinite(s.grip.leftIKMeters))
   throw Error("True rifle posture failed: "+JSON.stringify(s));
  await page.screenshot({path:path+"/lee-enfield-aim-close.png",fullPage:true});
  console.log("JAKELI_REAL_ARTIST_HANDS_RIFLE_TECHNICAL_PASS",JSON.stringify({
   model:s.handWeightSource,weapon:s.weaponId,bones:s.bones,meshes:s.meshCount,
   rightIKMeters:s.grip.rightIKMeters,leftIKMeters:s.grip.leftIKMeters,
   visualApproval:false,iphoneSafari:false
  }));
 }catch(e){
  console.error("JAKELI_REAL_ARTIST_HANDS_RIFLE_FAIL",String(e),
    JSON.stringify({errors}));
  process.exitCode=1;
 }finally{await browser.close();}
})();
