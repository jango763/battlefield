"use strict";
const {chromium}=require("/tmp/stage7-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/us-hero-stage7";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 let tests=0;
 try{
  await page.goto("http://127.0.0.1:8777/babylon/us-hero-stage7-four-weapons-iphone.html",
   {waitUntil:"domcontentloaded",timeout:50000});
  await page.waitForFunction(()=>window.__US_HERO_STAGE7_QA__?.ready||window.__US_HERO_STAGE7_QA__?.error,
   null,{timeout:115000});
  const ready=await page.evaluate(()=>window.__US_HERO_STAGE7_QA__.ready);
  if(!ready)throw Error("Hero load failed: "+await page.evaluate(()=>window.__US_HERO_STAGE7_QA__.error));
  const first=await page.evaluate(()=>{
   const sc=window.BABYLON.EngineStore.LastCreatedScene;
   return {meshCount:sc.meshes.length,skeletons:sc.skeletons.length,
    animationGroups:sc.animationGroups.map(g=>g.name)};
  });
  if(first.skeletons!==1)throw Error("Duplicate skeletons at boot");
  const cases=[
   ["uk-lee-enfield","Lee-Enfield"],["uk-sten","Sten"],
   ["uk-bren","Bren"],["uk-piat","PIAT"]
  ];
  const findings=[];
  for(const [id,name] of cases){
   if(id!=="uk-lee-enfield"){
    await page.locator('[data-weapon="'+id+'"]').click();
    await page.waitForFunction(id=>window.__US_HERO_STAGE7_QA__?.weapon===id||
      !!window.__US_HERO_STAGE7_QA__?.error,id,{timeout:75000});
   }
   for(const pose of ["ready","aim"]){
    await page.locator('[data-pose="'+pose+'"]').click();
    await page.waitForTimeout(350);
    const x=await page.evaluate(()=>{
     const qa=window.__US_HERO_STAGE7_QA__,sc=window.BABYLON.EngineStore.LastCreatedScene;
     const r=qa.rigInstance.report;
     const grip=qa.rigInstance.getSupportSocket();
     const mount=qa.rigInstance.getWeaponMount();
     const visibleMeshes=sc.meshes.filter(m=>m.getTotalVertices?.()>0).length;
     const piatMeshes=sc.meshes.filter(m=>m.name.startsWith("PIAT ")).length;
     return {id:qa.weapon,mode:qa.pose,ready:qa.ready,changes:qa.changes,
      data:{...r},grip,mount,meshes:visibleMeshes,piatMeshes,skeletons:sc.skeletons.length};
    });
    console.log("STAGE7_WEAPON_POSE",JSON.stringify({
     id:x.id,pose:x.mode,mesh:x.meshes,piatMeshes:x.piatMeshes,
     weaponType:x.data.weaponSource,weaponMeshCount:x.data.weaponMeshCount,
     right:x.data.rightGripMeters,left:x.data.leftGripMeters,elbow:x.data.leftElbowAngleDeg,
     supportZ:x.data.supportSocketLocalZ,mountCount:x.mount.mountCount,error:x.data.error}));
    if(x.id!==id||x.mode!==pose)throw Error(id+" "+pose+" incorrect UI state");
    if(x.data.error)throw Error(id+" "+pose+" IK "+x.data.error);
    if(x.mount.parent!=="mixamorig:Weapon_R"||!x.data.socketAttached)
      throw Error(id+" gun detached from right wrist");
    if(x.grip.parent!=="us-stage7-allied-weapon-Weapon_R")
      throw Error(id+" left target no longer attached to actual gun");
    if(x.skeletons!==1)throw Error("Duplicate skeleton after equipping "+id);
    if(!x.data.supportWithinHandguard)throw Error(id+" support outside weapon fore-end");
    if(!Number.isFinite(x.data.leftElbowAngleDeg)||x.data.leftElbowAngleDeg<=4||x.data.leftElbowAngleDeg>179)
      throw Error(id+" elbow invalid: "+x.data.leftElbowAngleDeg);
    if(x.data.socketLocalDriftMeters>1e-5||x.data.socketLocalRotationErrorDeg>.01)
      throw Error(id+" firearm local mount drift");
    if(x.data.rightGripMeters>.02||x.data.leftGripMeters>.16)
      throw Error(id+" hand is detached: "+x.data.rightGripMeters+"/"+x.data.leftGripMeters);
    if(x.data.leftGripMeters>.03)console.warn("STAGE7_SUPPORT_REACH_NEEDS_CALIBRATION",id,pose,x.data.leftGripMeters);
    if(id==="uk-piat"){
     if(x.piatMeshes<8)throw Error("PIAT procedural mesh missing");
     if(!x.data.weaponSource.includes("Procedural"))throw Error("PIAT mislabeled as GLB");
    }else if(x.piatMeshes!==0)throw Error("Leaked PIAT while carrying "+id);
    await page.screenshot({path:dir+"/"+id+"-"+pose+"-mobile.png",fullPage:true});
    await page.evaluate(()=>{
     document.getElementById("panel").style.display="none";
     const c=window.BABYLON.EngineStore.LastCreatedScene.activeCamera;
     c.radius=1.55;c.alpha=Math.PI*.77;c.beta=1.37;
     c.setTarget(new window.BABYLON.Vector3(0,1.18,0));
    });
    await page.waitForTimeout(200);
    await page.screenshot({path:dir+"/"+id+"-"+pose+"-closeup.png",fullPage:true});
    await page.evaluate(()=>document.getElementById("panel").style.display="");
    findings.push(x);tests++;
   }
  }
  await page.locator('[data-weapon="uk-lee-enfield"]').click();
  await page.waitForFunction(()=>window.__US_HERO_STAGE7_QA__?.weapon==="uk-lee-enfield",null,{timeout:70000});
  const tail=await page.evaluate(()=>{
   const qa=window.__US_HERO_STAGE7_QA__,sc=window.BABYLON.EngineStore.LastCreatedScene;
   return {mounts:qa.rigInstance.getWeaponMount().mountCount,
    piatMeshes:sc.meshes.filter(m=>m.name.startsWith("PIAT ")).length,
    meshCount:sc.meshes.length,changes:qa.changes,
    error:qa.rigInstance.report.error};
  });
  console.log("STAGE7_RETURN_TO_RIFLE",JSON.stringify(tail));
  if(tail.piatMeshes||tail.error||tail.mounts!==5||tail.changes!==4)
   throw Error("Weapon swap cleanup or remount failed "+JSON.stringify(tail));
  if(errors.length)throw Error("Browser errors: "+JSON.stringify(errors));
  console.log("STAGE7_FOUR_WEAPONS_BROWSER_PASS",JSON.stringify({
   testedPoses:tests,weaponChanges:tail.changes,weaponModels:[
    "uk-lee-enfield.glb","uk-sten.glb","uk-bren.glb","Battlefield procedural PIAT"
   ]}));
 }catch(e){
  console.error("STAGE7_FOUR_WEAPONS_BROWSER_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});