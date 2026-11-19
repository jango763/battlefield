"use strict";
const {chromium}=require("/tmp/jakeli-blender-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/jakeli-blender-lee-screen";
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto("http://127.0.0.1:8810/babylon/jakeli-blender-lee-iphone.html",
    {waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>window.__BABYLON_SOLDIER__?.loaded||window.__BABYLON_SOLDIER__?.error,null,{timeout:90000});
  const snap=()=>page.evaluate(()=>window.__BABYLON_SOLDIER__);
  let state=await snap();
  if(!state.loaded||state.error||state.skeletonBones!==65||state.skinnedMeshes<10)
   throw Error("Actual Blender rig import failed "+JSON.stringify(state));
  await page.waitForTimeout(600);
  await page.screenshot({path:dir+"/01-ready.png",fullPage:true});
  const aim=page.locator('[data-pose="aim"]');
  await aim.click();
  await page.waitForTimeout(750);
  state=await snap();
  await page.screenshot({path:dir+"/02-aim.png",fullPage:true});
  if(state.error||!state.weaponRigReady)
   throw Error("Blender rifle pose failed "+JSON.stringify(state));
  await page.evaluate(()=>{
   const s=window.BABYLON.EngineStore.LastCreatedScene, c=s.activeCamera;
   c.radius=1.6;c.target=new window.BABYLON.Vector3(0,1.25,0);
  });
  await page.waitForTimeout(500);
  await page.screenshot({path:dir+"/03-aim-hands.png",fullPage:true});
  console.log("JAKELI_BLENDER_ONE_RIFLE_CHROMIUM_TECHNICAL_PASS",JSON.stringify({
    skeletonBones:state.skeletonBones,skinnedMeshes:state.skinnedMeshes,
    materials:state.materialCount,rightGripMeters:state.weaponRig?.rightGripMeters,
    leftGripMeters:state.weaponRig?.leftGripMeters,
    visualApproval:false,iphoneSafari:false
  }));
 }catch(err){
  await page.screenshot({path:dir+"/FAIL.png",fullPage:true}).catch(()=>{});
  console.error("JAKELI_BLENDER_ONE_RIFLE_CHROMIUM_FAIL",String(err),
    JSON.stringify(errors));
  process.exitCode=1;
 }finally{await browser.close();}
})();
