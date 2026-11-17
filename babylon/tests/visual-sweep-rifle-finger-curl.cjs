"use strict";
const {chromium}=require("/tmp/stage4-qa/node_modules/playwright");
const fs=require("node:fs");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const folder="babylon-qa-results/hand-curl-sweep";
 fs.mkdirSync(folder,{recursive:true});
 try{
  await page.goto("http://127.0.0.1:8758/babylon/us-hero-lee-enfield-donor-hands-v7.html",
    {waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__US_HERO_STAGE4_QA__?.ready||window.__US_HERO_STAGE4_QA__?.error,
    null,{timeout:110000});
  const ready=await page.evaluate(()=>window.__US_HERO_STAGE4_QA__.ready);
  if(!ready)throw Error("Cannot load v7 donor pose: "+await page.evaluate(()=>window.__US_HERO_STAGE4_QA__.error));
  await page.evaluate(()=>{
   const B=window.BABYLON,c=B.EngineStore.LastCreatedScene.activeCamera;
   c.alpha=Math.PI/2;c.beta=1.39;c.radius=1.33;c.setTarget(new B.Vector3(0,1.19,0));
   document.getElementById("panel").style.display="none";
  });
  const configs=[
   ["open",{base:0,middle:0,distal:0,thumbBase:0,thumbMiddle:0,thumbDistal:0}],
   ["current",{base:1.03,middle:.93,distal:.38,thumbBase:.53,thumbMiddle:.63,thumbDistal:.28}],
   ["strong-positive",{base:1.7,middle:1.3,distal:.7,thumbBase:1.1,thumbMiddle:.9,thumbDistal:.35}],
   ["moderate-negative",{base:-.65,middle:-.65,distal:-.3,thumbBase:-.55,thumbMiddle:-.55,thumbDistal:-.25}],
   ["strong-negative",{base:-1.25,middle:-1.0,distal:-.55,thumbBase:-.95,thumbMiddle:-.85,thumbDistal:-.45}],
   ["proximal-only",{base:1.25,middle:0,distal:0,thumbBase:.9,thumbMiddle:0,thumbDistal:0}],
   ["alternating",{base:.9,middle:-.8,distal:-.5,thumbBase:.5,thumbMiddle:-.5,thumbDistal:0}]
  ];
  for(const [label,control] of configs){
   await page.evaluate(c=>Object.assign(window.__US_HERO_STAGE4_QA__.rig.fingerControls,c),control);
   await page.waitForTimeout(450);
   await page.screenshot({path:folder+"/"+label+".png"});
   console.log("CURL_VARIANT",label,JSON.stringify(control));
  }
  console.log("HAND_CURL_SWEEP_IMAGES_READY");
 }catch(e){console.error("SWEEP_ERROR",e.stack||String(e));process.exitCode=1}
 finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
