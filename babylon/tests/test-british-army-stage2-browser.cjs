"use strict";
const {chromium}=require("/tmp/british-stage2-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/british-stage2";
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
  await page.goto("http://127.0.0.1:8799/babylon/british-stage2-iphone.html",
   {waitUntil:"domcontentloaded",timeout:55000});
  await page.waitForFunction(()=>window.__BRITISH_STAGE2_QA__?.ready||
   window.__BRITISH_STAGE2_QA__?.error,null,{timeout:100000});
  const initial=await page.evaluate(()=>({...window.__BRITISH_STAGE2_QA__}));
  if(!initial.ready||initial.loaded||initial.modelIdentityVerified||initial.result)
   throw Error("Stage2 must start with NO unverified British model "+JSON.stringify(initial));
  if(await page.locator("#source option").count()!==3)
   throw Error("Must preserve exactly three preselected British model identities");
  if(await page.locator("#role option").count()!==2)
   throw Error("Must preserve infantry and commando only");
  await page.screenshot({path:dir+"/original-asset-missing.png",fullPage:true});
  await page.locator("#reference").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE2_QA__?.loaded||
   window.__BRITISH_STAGE2_QA__?.error,null,{timeout:110000});
  const reference=await page.evaluate(()=>({
   result:window.__BRITISH_STAGE2_QA__.result,
   ready:window.__BRITISH_STAGE2_QA__.ready,
   referenceRig:window.__BRITISH_STAGE2_QA__.referenceRig,
   originalVerified:window.__BRITISH_STAGE2_QA__.modelIdentityVerified,
   error:window.__BRITISH_STAGE2_QA__.error
  }));
  console.log("BRITISH_STAGE2_CONTROL_HERO",JSON.stringify(reference));
  if(reference.error||!reference.referenceRig||reference.originalVerified||
   reference.result?.bones!==65||reference.result.skinnedMeshes<1||
   reference.result.checkedVertices<1000)
   throw Error("65-bone known hero control or honesty gates failed");
  await page.screenshot({path:dir+"/hero-rig-control-only.png",fullPage:true});
  await page.locator("#role").selectOption("commando");
  const beret=await page.evaluate(()=>window.__BRITISH_STAGE2_QA__.result);
  if(beret.role!=="commando"||beret.expectedHeadwear!=="берет"||
   beret.readyForGameplay)throw Error("Commando review or production gate invalid");
  await page.screenshot({path:dir+"/commando-headwear-qa.png",fullPage:true});
  await page.locator("#role").selectOption("infantry");
  const helmet=await page.evaluate(()=>window.__BRITISH_STAGE2_QA__.result);
  if(helmet.role!=="infantry"||helmet.expectedHeadwear!=="каска Mk II"||
   helmet.readyForGameplay)throw Error("Infantry review or production gate invalid");
  if(errors.length)throw Error("Browser console errors "+JSON.stringify(errors));
  console.log("BRITISH_STAGE2_IPHONE_QA_PASS",JSON.stringify({
   bones:reference.result.bones,skinnedMeshes:reference.result.skinnedMeshes,
   inspectedVertices:reference.result.checkedVertices,
   roleSwitching:true,unverifiedSourcesNotInstalled:true
  }));
 }catch(e){
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  console.error("BRITISH_STAGE2_IPHONE_QA_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
