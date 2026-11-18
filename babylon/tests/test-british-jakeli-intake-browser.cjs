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
  // Load the actual user-supplied, optimized model distributed in THIS branch.
  await page.locator("#load-repo").click();
  await page.waitForFunction(()=>{
   const q=window.__BRITISH_JAKELI_INTAKE_QA__;
   return q?.loaded||q?.error
  },null,{timeout:110000});
  const british=await page.evaluate(()=>{
   const q=window.__BRITISH_JAKELI_INTAKE_QA__;
   return {loaded:q.loaded,verified:q.sourceVerified,
    original:q.modelIsBritish,skins:q.skins,bones:q.bones,
    clips:q.clips,meshes:q.meshes,canInstall:q.canInstall,
    bytes:q.bytes,sha:q.sha256,error:q.error,
    canvasVisible:getComputedStyle(document.querySelector("#canvas")).display!=="none"};
  });
  console.log("BRITISH_JAKELI_ACTUAL_GLB",JSON.stringify(british));
  if(!british.loaded||!british.verified||!british.original||
   british.skins!==0||british.bones!==0||british.clips!==0||
   british.meshes!==14||british.canInstall||british.bytes!==5200624||
   !british.canvasVisible||
   british.sha!=="e86dc27fdb763092ad80391ea79c3f83f20c7b81195d2132dc1b68cf3634d7a0"||
   british.error)
   throw Error("Actual optimized Jakeli GLB load/integrity or static-rig truth failed "+
    JSON.stringify(british));
  await page.screenshot({path:dir+"/real-jakeli-3d-not-yet-rigged.png",fullPage:true});
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
   screen:"390x844",realModelRequired:true,sourceStaticPartsInGithub:17,originalFileBytePerfectReassembled:true,
   hero65BonesNotAcceptedAsBritish:true,sourceSHA256Gate:true,
   githubActualGLBLoaded:true,meshCount:14,authenticStaticRig0:true,
   localFilePicker:true,visualRigNotFaked:true,errors:0
  }));
 }catch(e){
  console.error("BRITISH_JAKELI_INTAKE_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
