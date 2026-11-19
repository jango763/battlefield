"use strict";
const {chromium}=require("/tmp/jakeli-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/jakeli-lee-german-controller";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto("http://127.0.0.1:8809/babylon/jakeli-lee-german-controller.html?handBasis=anatomy",{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>window.__BABYLON_SOLDIER__?.ready,null,{timeout:90000});
  const init=await page.evaluate(()=>window.__BABYLON_SOLDIER__);
  console.log("JAKELI_GERMAN_CONTROLLER_INIT",JSON.stringify(init));
  if(!init.loaded||init.error||init.skeletonBones!==65||!init.weaponRigReady||init.weaponRig?.weapon!=="uk-lee-enfield"||errors.length)
   throw Error("Approved German controller did not initialize on Jakeli "+JSON.stringify({init,errors}));
  for(const pose of ["ready","aim"]){
   await page.locator('[data-pose="'+pose+'"]').click();
   await page.waitForTimeout(600);
   const s=await page.evaluate(()=>window.__BABYLON_SOLDIER__);
   console.log("JAKELI_GERMAN_CONTROLLER_POSE",JSON.stringify({pose,rig:s.weaponRig}));
   // Diagnostics are not a visual approval: capture bad poses too.
   if(s.weaponRig?.error||s.weaponRig?.pose!==pose||
      !Number.isFinite(s.weaponRig?.rightGripMeters)||
      !Number.isFinite(s.weaponRig?.leftGripMeters))
    throw Error("German-controller pose could not be measured "+pose+": "+JSON.stringify(s.weaponRig));
   console.log("JAKELI_GERMAN_CONTROLLER_VISUAL_AUDIT",JSON.stringify({
     pose,rightGripMeters:s.weaponRig.rightGripMeters,
     leftGripMeters:s.weaponRig.leftGripMeters,
     rightWristDegrees:s.weaponRig.rightWristDegrees,
     leftWristDegrees:s.weaponRig.leftWristDegrees,
     rightFingerDirectionErrorDegrees:s.weaponRig.rightFingerDirectionErrorDegrees,
     leftFingerDirectionErrorDegrees:s.weaponRig.leftFingerDirectionErrorDegrees,
     leftGoalFromShoulderMeters:s.weaponRig.leftGoalFromShoulderMeters,
     leftReachMeters:s.weaponRig.leftReachMeters,
     geometricPass:s.weaponRig.geometricPass,
     stockOnRightShoulder:s.weaponRig.stockOnRightShoulder
   }));
   await page.screenshot({path:dir+"/"+pose+".png",fullPage:true});
   await page.evaluate(()=>{
    const scene=window.BABYLON.EngineStore.LastCreatedScene;
    scene.activeCamera.radius=1.55;
    scene.activeCamera.target.set(0,1.35,0);
   });
   await page.waitForTimeout(250);
   await page.screenshot({path:dir+"/"+pose+"-hands.png",fullPage:true});
  }
  console.log("JAKELI_GERMAN_CONTROLLER_DIAGNOSTIC_CAPTURED",JSON.stringify({poses:2,model:"real-Jakeli",controller:"approved-German",weapon:"Lee-Enfield",visualApproval:false,iphoneSafari:false}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
