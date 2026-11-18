"use strict";
const {chromium}=require("/tmp/british-stage2-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/british-stage10";
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
  await page.goto("http://127.0.0.1:8799/babylon/british-stage10-iphone.html",
   {waitUntil:"domcontentloaded",timeout:55000});
  await page.waitForFunction(()=>window.__BRITISH_STAGE10_QA__?.ready||
   window.__BRITISH_STAGE10_QA__?.error,null,{timeout:70000});
  const initial=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE10_QA__;
   return {ready:q.ready,error:q.error,release:q.releaseReady,
    count:q.originalBritishModelsReady,actors:q.originalBritish3dActors,
    links:q.stageLinks,technical:q.technicalPrototypeReady,
    present:q.presentFiles.length,safari:q.safariLikely,
    memory:q.memoryAvailable,innerWidth:innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    manual:document.querySelectorAll("#manual input").length,
    cards:document.querySelectorAll("#stage-list a.stage").length,
    missingModels:document.querySelectorAll("#source-list .item").length,
    linkHrefs:[...document.querySelectorAll("#stage-list a.stage")]
     .map(a=>a.getAttribute("href"))};
  });
  console.log("BRITISH_STAGE10_INITIAL",JSON.stringify(initial));
  if(initial.error||!initial.ready||initial.release||initial.count!==0||
   initial.actors!==0||initial.present!==0||initial.links!==8||
   !initial.technical||initial.cards!==8||initial.manual!==6||
   initial.missingModels!==3||initial.scrollWidth>initial.innerWidth+4||
   initial.linkHrefs.some((href,i)=>href!=="./british-stage"+(i+2)+"-iphone.html"))
   throw Error("Stage10 mobile release/honesty/layout gate failed "+
    JSON.stringify(initial));
  await page.screenshot({path:dir+"/release-blockers-no-uk-skins.png",fullPage:true});
  for(const href of initial.linkHrefs){
   const res=await page.request.head(
    "http://127.0.0.1:8799/babylon/"+href.replace("./",""));
   if(!res.ok())throw Error("Unreachable stage10 preview link "+href+" "+res.status());
  }
  // A user ticking every visual check must not unlock main while models
  // and licenses are missing.
  for(const box of await page.locator("#manual input").all())
   await box.check();
  const afterManual=await page.evaluate(()=>({
   release:window.__BRITISH_STAGE10_QA__.releaseReady,
   count:Object.values(window.__BRITISH_STAGE10_QA__.manual)
    .filter(Boolean).length,
   report:window.__BRITISH_STAGE10_QA__.report
  }));
  if(afterManual.release||afterManual.count!==6||
   !afterManual.report.includes("НЕ ГОТОВО К ВЫПУСКУ"))
   throw Error("A user checkbox silently bypassed original 3D gate "+
    JSON.stringify(afterManual));
  await page.screenshot({path:dir+"/safari-checklist-not-auto-release.png",fullPage:true});
  await page.locator("#clear").click();
  const cleared=await page.evaluate(()=>({
   count:Object.values(window.__BRITISH_STAGE10_QA__.manual).filter(Boolean).length,
   release:window.__BRITISH_STAGE10_QA__.releaseReady
  }));
  if(cleared.release||cleared.count)
   throw Error("Manual test clear/never certify gate broken");
  // Real technical asset (not fake 3D soldier) is loaded into a real Babylon
  // scene at the iPhone viewport; emulated FPS is recorded but never used
  // to claim physical iPhone Safari pass.
  await page.locator("#benchmark").click();
  await page.waitForFunction(()=>!!window.__BRITISH_STAGE10_QA__?.perf||
   !!window.__BRITISH_STAGE10_QA__?.probeError,null,{timeout:115000});
  const probe=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE10_QA__;
   return {perf:q.perf,error:q.probeError,
    release:q.releaseReady,canvasVisible:
     getComputedStyle(document.querySelector("#hero-canvas")).display!=="none",
    mainOverflow:document.documentElement.scrollWidth-innerWidth,
    perfText:document.querySelector("#performance").textContent.slice(0,500),
    stageLinks:q.stageLinks};
  });
  console.log("BRITISH_STAGE10_3D_PROBE",JSON.stringify(probe));
  if(probe.error||probe.release||!probe.canvasVisible||
   probe.perf?.bones!==65||!probe.perf?.controlOnly||
   probe.perf?.renderFps<=0||probe.perf?.loadMs<=0||
   probe.perf?.vertices<1000||probe.perf?.triangles<1000||
   probe.mainOverflow>4||probe.stageLinks!==8)
   throw Error("Performance probe falsely certified or failed to load hero "+
    JSON.stringify(probe));
  await page.screenshot({path:dir+"/real-65bone-hero-benchmark.png",fullPage:true});
  if(errors.length)throw Error("Browser errors "+JSON.stringify(errors));
  console.log("BRITISH_STAGE10_MOBILE_PASS",JSON.stringify({
   stageLinks:8,originalBritishAssets:0,original3DSoldiers:0,
   physicalSafariVerified:false,realControlHeroBones:65,
   measuredControlHeroLoadMs:Math.round(probe.perf.loadMs),
   measuredControlHeroFps:+probe.perf.renderFps.toFixed(1),
   safariManualChecklist:6,
   noCounterfeitRelease:true,layout390px:true,
   releaseAllowed:false
  }));
 }catch(e){
  console.error("BRITISH_STAGE10_MOBILE_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
