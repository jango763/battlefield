"use strict";
const {chromium}=require("/tmp/stage6-qa/node_modules/playwright");
const fs=require("node:fs");
const root="http://127.0.0.1:8765/babylon/us-hero-lee-enfield-stage6-iphone.html";
const dir="babylon-qa-results/us-hero-stage6";
const close=(v,n=5)=>Math.round(v*10**n)/10**n;
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 try{
  await page.goto(root,{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__US_HERO_STAGE6_QA__?.ready||window.__US_HERO_STAGE6_QA__?.error,null,{timeout:110000});
  const ready=await page.evaluate(()=>window.__US_HERO_STAGE6_QA__.ready);
  if(!ready)throw Error("Hero not ready: "+await page.evaluate(()=>window.__US_HERO_STAGE6_QA__?.error));
  const samples=[];
  async function audit(pose,label){
   if(pose)await page.locator('[data-pose="'+pose+'"]').click();
   await page.waitForTimeout(350);
   const snap=await page.evaluate(()=>{
    const qa=window.__US_HERO_STAGE6_QA__,rig=qa.rigInstance;
    return {mode:qa.pose,...rig.getWeaponMount(),
     rightGripMeters:qa.rig.rightGripMeters,
     leftGripMeters:qa.rig.leftGripMeters,
     stockToShoulderMeters:qa.rig.stockToShoulderMeters,
     socketLocalDriftMeters:qa.rig.socketLocalDriftMeters,
     socketLocalRotationErrorDeg:qa.rig.socketLocalRotationErrorDeg,
     leftElbowAngleDeg:qa.rig.leftElbowAngleDeg,
     leftElbowPoleSideMeters:qa.rig.leftElbowPoleSideMeters,
     supportSocketErrorMeters:qa.rig.supportSocketErrorMeters,
     supportWithinHandguard:qa.rig.supportWithinHandguard,
     supportSocketLocalZ:qa.rig.supportSocketLocalZ,
     supportProfile:qa.rig.leftSupportProfile,
     support:rig.getSupportSocket(),
     error:qa.rig.error};
   });
   console.log("SOCKET_AUDIT",label,JSON.stringify(snap));
   if(snap.error)throw Error(label+" IK runtime "+snap.error);
   if(!snap.attached||!/Weapon_R/i.test(snap.parent||""))throw Error(label+" rifle is NOT attached to original Weapon_R");
   if(snap.mountCount!==1)throw Error(label+" unexpected weapon remount count "+snap.mountCount);
   if(snap.socketLocalDriftMeters>.00001||snap.socketLocalRotationErrorDeg>.01)
    throw Error(label+" local transform changed; rifle is not rigid on right socket");
   if(snap.rightGripMeters>.01)throw Error(label+" trigger is not physically attached to right socket "+snap.rightGripMeters);
   if(snap.leftGripMeters>.03)throw Error(label+" support hand detached from real weapon "+snap.leftGripMeters);
   if(snap.stockToShoulderMeters>.10)throw Error(label+" stock shifted far from shoulder "+snap.stockToShoulderMeters);
   if(snap.support.parent!=="us-stage6-Lee-Enfield-Weapon_R")
     throw Error(label+" left support socket is not attached to the weapon");
   if(!snap.supportWithinHandguard || snap.supportSocketLocalZ<.165 || snap.supportSocketLocalZ>.313)
     throw Error(label+" left support slipped off the wood fore-end "+snap.supportSocketLocalZ);
   if(snap.supportSocketErrorMeters>.028)
     throw Error(label+" left palm not at actual fore-end "+snap.supportSocketErrorMeters);
   if(!Number.isFinite(snap.leftElbowAngleDeg)||snap.leftElbowAngleDeg<12||snap.leftElbowAngleDeg>179)
     throw Error(label+" left elbow angle invalid "+snap.leftElbowAngleDeg);
   await page.screenshot({path:dir+"/"+label+"-mobile.png",fullPage:true});
   await page.evaluate(()=>document.getElementById("panel").style.display="none");
   await page.screenshot({path:dir+"/"+label+"-figure.png",fullPage:true});
   await page.evaluate(()=>{
    const c=window.BABYLON.EngineStore.LastCreatedScene.activeCamera;
    c.radius=1.37;c.alpha=Math.PI*.8;c.beta=1.34;
    c.setTarget(new window.BABYLON.Vector3(0,1.23,0));
   });
   await page.waitForTimeout(180);
   await page.screenshot({path:dir+"/"+label+"-hands.png",fullPage:true});
   await page.evaluate(()=>document.getElementById("panel").style.display="");
   samples.push(snap);return snap;
  }
  await audit("ready","ready-before");
  await audit("aim","aim");
  await audit("ready","ready-after");
  await page.evaluate(()=>{
   const scene=window.BABYLON.EngineStore.LastCreatedScene;
   const stage=scene.getTransformNodeByName("us-approved-hero");
   if(!stage)throw Error("Hero stage not found");
   stage.rotation.y+=.3;
  });
  await audit(null,"hero-rotated");
  if(samples[0].localPosition.some((n,i)=>Math.abs(n-samples[1].localPosition[i])>1e-6))
   throw Error("Socket LOCAL position changed between ready and aim");
  if(samples[0].localRotation.some((n,i)=>Math.abs(n-samples[1].localRotation[i])>1e-6))
   throw Error("Socket LOCAL orientation changed between ready and aim");
  // Sweep three legal left fore-end positions without touching RIGHT socket.
  const variants=[];
  for(const id of ["near","forward","standard"]){
    const v=await page.evaluate(profile=>{
      const qa=window.__US_HERO_STAGE6_QA__,rig=qa.rigInstance;
      rig.setSupportProfile(profile);
      return {profile, ...rig.getSupportSocket(),
        rightMounts:rig.getWeaponMount().mountCount,
        leftGrip:qa.rig.leftGripMeters,
        rightGrip:qa.rig.rightGripMeters,
        elbowDeg:qa.rig.leftElbowAngleDeg,
        error:qa.rig.error};
    },id);
    variants.push(v);
    if(v.error||v.rightMounts!==1||v.leftGrip>.028||v.rightGrip>.01)
      throw Error("Variant "+id+" invalid: "+JSON.stringify(v));
    await page.evaluate(()=>{
      document.getElementById("panel").style.display="none";
      const c=window.BABYLON.EngineStore.LastCreatedScene.activeCamera;
      c.radius=1.33;c.alpha=Math.PI*.79;c.beta=1.32;
      c.setTarget(new window.BABYLON.Vector3(0,1.19,0));
    });
    await page.waitForTimeout(230);
    await page.screenshot({path:dir+"/support-"+id+"-closeup.png",fullPage:true});
    await page.evaluate(()=>document.getElementById("panel").style.display="");
    console.log("FOREEND_VARIANT",JSON.stringify(v));
  }
  if(variants[0].localPosition[2]===variants[1].localPosition[2])
    throw Error("Fore-end QA profiles do not move the supporting hand");
    if(errors.length)throw Error("Browser errors: "+JSON.stringify(errors));
  console.log("STAGE6_LEFT_SUPPORT_IK_PASS",JSON.stringify({
   samples:samples.length,mounts:samples.at(-1).mountCount,
   rightGripMaxMeters:close(Math.max(...samples.map(s=>s.rightGripMeters))),
   leftGripMaxMeters:close(Math.max(...samples.map(s=>s.leftGripMeters))),
   stockMaxMeters:close(Math.max(...samples.map(s=>s.stockToShoulderMeters)))
  }));
 }catch(e){
  console.error("STAGE6_LEFT_SUPPORT_IK_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error-mobile.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});