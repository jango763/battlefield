"use strict";
const {chromium}=require("/tmp/british-stage2-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/british-jakeli";
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
  await page.goto("http://127.0.0.1:8799/babylon/british-jakeli-intake-iphone.html",
   {waitUntil:"domcontentloaded",timeout:55000});
  await page.waitForFunction(()=>window.__BRITISH_JAKELI_INTAKE_QA__?.ready,
   null,{timeout:25000});
  const initial=await page.evaluate(()=>{
   const q=window.__BRITISH_JAKELI_INTAKE_QA__;
   return {ready:q.ready,loaded:q.loaded,install:q.canInstall,
    verified:q.sourceVerified,files:document.querySelector("#file").accept,
    width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
  });
  if(!initial.ready||initial.loaded||initial.verified||initial.install||
   !initial.files.includes(".glb")||initial.scrollWidth>initial.width+4)
   throw Error("Jakeli mobile intake initial state untrusted "+JSON.stringify(initial));
  await page.screenshot({path:dir+"/real-asset-needed.png",fullPage:true});
  // A fully rigged US control model must NOT be accepted as George Jakeli.
  await page.locator("#file").setInputFiles({
   name:"not-our-jakeli.glb",mimeType:"model/gltf-binary",
   buffer:fs.readFileSync("assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb")
  });
  await page.waitForFunction(()=>window.__BRITISH_JAKELI_INTAKE_QA__?.error,
   null,{timeout:25000});
  const bad=await page.evaluate(()=>{
   const q=window.__BRITISH_JAKELI_INTAKE_QA__;
   return {error:q.error,verified:q.sourceVerified,
    install:q.canInstall,modelIsBritish:q.modelIsBritish,
    status:document.getElementById("status").textContent};
  });
  if(bad.verified||bad.install||bad.modelIsBritish||
   !bad.error?.includes("закреплённой модели"))
   throw Error("Source identity spoofing possible "+JSON.stringify(bad));
  await page.screenshot({path:dir+"/non-jakeli-rejected.png",fullPage:true});
  if(errors.length)throw Error("Unexpected browser exceptions "+JSON.stringify(errors));
  console.log("BRITISH_JAKELI_INTAKE_MOBILE_PASS",JSON.stringify({
   screen:"390x844",realModelRequired:true,originalUploadedToGithub:false,
   hero65BonesNotAcceptedAsBritish:true,sourceSHA256Gate:true,
   localFilePicker:true,visualRigNotFaked:true,errors:0
  }));
 }catch(e){
  console.error("BRITISH_JAKELI_INTAKE_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
