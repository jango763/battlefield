"use strict";
const {chromium}=require("/tmp/stage4-qa/node_modules/playwright");
const fs=require("node:fs");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const folder="babylon-qa-results/static-grip-v11";
 fs.mkdirSync(folder,{recursive:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",e=>{if(e.type()==="error")errors.push(e.text());});
 try{
  await page.goto("http://127.0.0.1:8758/babylon/us-hero-lee-enfield-static-grip-v11-iphone.html",
    {waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__US_HERO_STAGE4_QA__?.ready||
    window.__US_HERO_STAGE4_QA__?.error,null,{timeout:110000});
  if(!await page.evaluate(()=>window.__US_HERO_STAGE4_QA__.ready))
   throw Error("Hero failed: "+await page.evaluate(()=>window.__US_HERO_STAGE4_QA__.error));
  for(const pose of ["ready","aim"]){
   await page.locator('[data-pose="'+pose+'"]').click();
   await page.waitForTimeout(850);
   const metric=await page.evaluate(()=>{
    const report=window.__US_HERO_STAGE4_QA__.rig;
    return {fps:Math.round(BABYLON.EngineStore.LastCreatedScene.getEngine().getFps()),...report};
   });
   if(metric.error)throw Error(pose+": "+metric.error);
   if(metric.processedFingerChains!==8)throw Error("All 8 finger chains must be active");
   if(!Number.isFinite(metric.fingerSurfaceErrorMeters))throw Error("Contact error NaN");
   await page.screenshot({path:folder+"/"+pose+"-mobile.png"});
   await page.evaluate(()=>{
     document.getElementById("panel").style.display="none";
     const B=BABYLON,c=B.EngineStore.LastCreatedScene.activeCamera;
     c.alpha=Math.PI/2;c.beta=1.35;c.radius=1.6;c.setTarget(new B.Vector3(0,1.2,0));
   });
   await page.waitForTimeout(450);
   await page.screenshot({path:folder+"/"+pose+"-hands.png"});
   await page.evaluate(()=>{
     document.getElementById("panel").style.display="";
     const B=BABYLON,c=B.EngineStore.LastCreatedScene.activeCamera;
     c.alpha=Math.PI/2;c.beta=1.35;c.radius=3;c.setTarget(new B.Vector3(0,.96,0));
   });
   console.log("STATIC_POSE",pose,JSON.stringify(metric));
  }
  if(errors.length)throw Error("Browser console: "+errors.join("; "));
  console.log("STAGE4_STATIC_FINGER_IK_V11_BROWSER_PASS");
 }catch(e){
  console.error("STAGE4_V11_FAIL",e.stack||String(e));
  await page.screenshot({path:folder+"/error.png"}).catch(()=>{});
  process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
