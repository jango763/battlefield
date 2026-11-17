"use strict";
const {chromium}=require("/tmp/stage4-qa/node_modules/playwright");
const fs=require("node:fs");
const base="http://127.0.0.1:8758/babylon/us-hero-lee-enfield-finger-contact-v10-iphone.html";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 fs.mkdirSync("babylon-qa-results/finger-contact-v10",{recursive:true});
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
    await page.screenshot({path:"babylon-qa-results/finger-contact-v10/"+pose+"-mobile.png",fullPage:true});
    await page.evaluate(()=>document.getElementById("panel").style.display="none");
    await page.screenshot({path:"babylon-qa-results/finger-contact-v10/"+pose+"-full-figure.png",fullPage:true});
    await page.evaluate(()=>document.getElementById("panel").style.display="");
    // Real closeups, including SIDE view: wrist distance alone is not approval.
    await page.evaluate(()=>document.getElementById("panel").style.display="none");
    for(const [name,alpha,beta] of [["front",Math.PI/2,1.38],
                                     ["three-quarter",Math.PI*.77,1.38],
                                     ["side",Math.PI,1.38]]){
      await page.evaluate(({alpha,beta})=>{
        const B=window.BABYLON;
        const camera=B.EngineStore.LastCreatedScene.activeCamera;
        camera.alpha=alpha;camera.beta=beta;camera.radius=1.3;
        camera.setTarget(new B.Vector3(0,1.25,0));
      },{alpha,beta});
      await page.waitForTimeout(300);
      await page.screenshot({path:"babylon-qa-results/finger-contact-v10/"+pose+"-"+name+"-hands.png",
        fullPage:true});
    }
    await page.evaluate(()=>document.getElementById("panel").style.display="");
    console.log("POSE",pose,JSON.stringify(metrics));
    await page.evaluate(()=>{
      window.__US_HERO_STAGE4_QA__.rig.fingerMode="legacy";
      const B=window.BABYLON,c=B.EngineStore.LastCreatedScene.activeCamera;
      c.alpha=Math.PI/2;c.beta=1.38;c.radius=1.3;c.setTarget(new B.Vector3(0,1.25,0));
      document.getElementById("panel").style.display="none";
    });
    await page.waitForTimeout(400);
    await page.screenshot({path:"babylon-qa-results/finger-contact-v10/"+pose+"-legacy-front.png"});
    await page.evaluate(()=>window.__US_HERO_STAGE4_QA__.rig.fingerMode="surface");
    if(metrics.error)throw Error(pose+" IK error "+metrics.error);
    if(metrics.fingerMode!=="surface"||metrics.processedFingerChains!==8)
      throw Error("All 8 anatomically weighted finger chains must be solved");
    if(!Number.isFinite(metrics.fingerSurfaceErrorMeters))
      throw Error("Missing real finger to rifle contact measurements");
    if(metrics.palmTarget!=="MCP-based anatomical palm center (not wrist joint)")
      throw Error("v9 anatomical palm target not active");
    if(!Number.isFinite(metrics.rightSocketMeters)||!Number.isFinite(metrics.leftSocketMeters))
      throw Error("No legacy socket comparison");
    if(!Number.isFinite(metrics.rightGripMeters)||!Number.isFinite(metrics.leftGripMeters))
      throw Error(pose+" missing grip metrics");
    if(metrics.rightGripMeters>.055||metrics.leftGripMeters>.065)
      throw Error(pose+" wrist mismatch "+JSON.stringify(metrics));
    if(metrics.rightPalmErrorDeg>18||metrics.leftPalmErrorDeg>18)
      console.warn("PALM_ORIENTATION_NOT_YET_APPROVED",pose,metrics.rightPalmErrorDeg,metrics.leftPalmErrorDeg);
  }
  if(errors.length)throw Error("Browser errors: "+errors.join("; "));
  console.log("STAGE4_FINGER_CONTACT_V10_BROWSER_EXECUTED_VISUAL_REVIEW_REQUIRED");
 }catch(e){
  console.error("STAGE4_BROWSER_FAIL",String(e));
  console.error("RUNTIME_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:"babylon-qa-results/finger-contact-v10/error-mobile.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});