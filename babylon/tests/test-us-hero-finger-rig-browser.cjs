"use strict";
const {chromium}=require("/tmp/stage4-qa/node_modules/playwright");
const fs=require("node:fs");
const base="http://127.0.0.1:8758/babylon/us-hero-lee-enfield-repaired-fingers-iphone.html";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 fs.mkdirSync("babylon-qa-results/finger-rig-v3",{recursive:true});
 try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__US_HERO_STAGE4_QA__?.ready||window.__US_HERO_STAGE4_QA__?.error,
    {timeout:110000});
  const state=await page.evaluate(()=>({ready:window.__US_HERO_STAGE4_QA__.ready,
    error:window.__US_HERO_STAGE4_QA__.error}));
  if(!state.ready)throw Error("Stage4 cannot load: "+state.error);
  for(const pose of ["ready","aim"]){
    await page.locator('[data-pose="'+pose+'"]').click();
    await page.waitForTimeout(700);
    const metrics=await page.evaluate(()=>({...window.__US_HERO_STAGE4_QA__.rig}));
    await page.screenshot({path:"babylon-qa-results/finger-rig-v3/"+pose+"-mobile.png",fullPage:true});
    await page.evaluate(()=>document.getElementById("panel").style.display="none");
    await page.screenshot({path:"babylon-qa-results/finger-rig-v3/"+pose+"-full-figure.png",fullPage:true});
    await page.evaluate(()=>document.getElementById("panel").style.display="");
    console.log("POSE",pose,JSON.stringify(metrics));
    if(metrics.error)throw Error(pose+" IK error "+metrics.error);
    if(!Number.isFinite(metrics.rightGripMeters)||!Number.isFinite(metrics.leftGripMeters))
      throw Error(pose+" missing grip metrics");
    if(metrics.rightGripMeters>.055||metrics.leftGripMeters>.065)
      throw Error(pose+" wrist mismatch "+JSON.stringify(metrics));
    if(metrics.rightPalmErrorDeg>18||metrics.leftPalmErrorDeg>18)
      console.warn("PALM_ORIENTATION_NOT_YET_APPROVED",pose,metrics.rightPalmErrorDeg,metrics.leftPalmErrorDeg);
  }
  if(errors.length)throw Error("Browser errors: "+errors.join("; "));
  console.log("STAGE4_FINGER_RIG_BROWSER_EXECUTED_VISUAL_REVIEW_REQUIRED");
 }catch(e){
  console.error("STAGE4_BROWSER_FAIL",String(e));
  console.error("RUNTIME_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:"babylon-qa-results/finger-rig-v3/error-mobile.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});