"use strict";
const {chromium}=require("/tmp/stage4-qa/node_modules/playwright");
const fs=require("node:fs");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const dir="babylon-qa-results/right-grip-v9";
 fs.mkdirSync(dir,{recursive:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 try{
  await page.goto("http://127.0.0.1:8758/babylon/us-hero-right-grip-axes-v9-iphone.html",
                  {waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__US_HERO_STAGE4_QA__?.ready||window.__US_HERO_STAGE4_QA__?.error,
      null,{timeout:105000});
  let qa=await page.evaluate(()=>window.__US_HERO_STAGE4_QA__);
  if(!qa.ready)throw Error("Model load failure "+qa.error);
  await page.evaluate(()=>{
   document.querySelector("header").style.display="none";
   document.getElementById("panel").style.display="none";
  });
  const presets=["donor","gunDown","gunDiagonal","gunForward","bodyDown","across"];
  for(const preset of presets){
   await page.evaluate(p=>{window.__US_HERO_STAGE4_QA__.rig.rightDirPreset=p;},preset);
   await page.waitForTimeout(250);
   const m=await page.evaluate(()=>({...window.__US_HERO_STAGE4_QA__.rig}));
   if(m.error)throw Error(preset+": "+m.error);
   if(m.rightGripMeters>.035||m.leftGripMeters>.035)throw Error(preset+" IK "+JSON.stringify(m));
   console.log("PRESET",preset,JSON.stringify({
     rPalm:m.rightPalmErrorDeg,lPalm:m.leftPalmErrorDeg,
     rFingers:m.rightFingerErrorDeg,gripRight:m.rightGripMeters,
     gripLeft:m.leftGripMeters
   }));
   for(const [angle,alpha,beta] of [["front",Math.PI/2,1.36],["quarter",2.32,1.36]]){
    await page.evaluate(({alpha,beta})=>{
     const B=window.BABYLON;
     const cam=B.EngineStore.LastCreatedScene.activeCamera;
     cam.alpha=alpha;cam.beta=beta;cam.radius=1.45;
     cam.setTarget(new B.Vector3(0,1.27,0));
    },{alpha,beta});
    await page.waitForTimeout(220);
    await page.screenshot({path:dir+"/"+preset+"-"+angle+".png"});
   }
  }
  if(errors.length)throw Error("Browser JS errors: "+JSON.stringify(errors));
  console.log("RIGHT_GRIP_V9_COMPARISON_PASS_NEEDS_VISUAL_REVIEW");
 }finally{
   await browser.close();
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
