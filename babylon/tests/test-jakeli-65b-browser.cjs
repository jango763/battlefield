"use strict";
const {chromium}=require("/tmp/jakeli-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/jakeli-65b";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,
  isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto("http://127.0.0.1:8809/babylon/jakeli-65b-iphone.html",
    {waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>window.__JAKELI_RIG_QA__?.loaded||
    window.__JAKELI_RIG_QA__?.error,null,{timeout:120000});
  let state=await page.evaluate(()=>{
   const q=window.__JAKELI_RIG_QA__,scene=window.BABYLON.EngineStore.LastCreatedScene;
   return {loaded:q.loaded,error:q.error,bones:q.bones,skins:q.skins,
     meshes:q.meshCount,clips:q.clips,sceneSkins:scene?.skeletons.length,
     visibleParts:scene?.meshes.filter(m=>m.isEnabled()&&m.getTotalVertices()>0).length,
     width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
  });
  console.log("JAKELI_REAL_MODEL_MOBILE_LOAD",JSON.stringify(state));
  if(state.error||!state.loaded||state.bones!==65||state.skins!==1||
    state.sceneSkins!==1||state.meshes!==13||state.visibleParts!==13||
    state.clips.length!==4||state.scrollWidth>state.width+3)
      throw Error("Bad Jakeli real skinned GLB load: "+JSON.stringify(state));
  await page.screenshot({path:dir+"/01-idle.png",fullPage:true});
  for(const [index,motion] of ["Walk_Quaternius","Jog_Quaternius",
   "Sprint_Quaternius","Idle_Quaternius"].entries()){
   await page.locator('[data-motion="'+motion+'"]').click();
   await page.waitForFunction(name=>{
    const scene=window.BABYLON.EngineStore.LastCreatedScene;
    return window.__JAKELI_RIG_QA__?.active===name&&
      scene.animationGroups.some(g=>g.name===name&&g.isPlaying);
   },motion,{timeout:12000});
   await page.waitForTimeout(500);
   state=await page.evaluate(()=>{
    const q=window.__JAKELI_RIG_QA__,scene=window.BABYLON.EngineStore.LastCreatedScene;
    return {active:q.active,loaded:q.loaded,error:q.error,
       playing:scene.animationGroups.filter(g=>g.isPlaying).map(g=>g.name),
       bones:scene.skeletons[0]?.bones.length};
   });
   console.log("JAKELI_MOBILE_MOTION",JSON.stringify(state));
   if(state.error||!state.loaded||state.active!==motion||state.bones!==65||
     state.playing.length>2||!state.playing.includes(motion))
       throw Error("Animation transition failed: "+JSON.stringify(state));
   await page.screenshot({path:dir+"/"+(index+2)+"-"+motion+".png",fullPage:true});
  }
  if(errors.length)throw Error("Browser script errors: "+JSON.stringify(errors));
  console.log("JAKELI_REAL_MODEL_CHROMIUM_PASS",JSON.stringify({
   viewport:"390x844",originalBritishVisuals:true,bones:65,skins:1,
   skinnedVisibleMeshes:13,quaterniusClips:4,buttonsTested:4,
   hardwareSafariTest:false,visualGeometryApproved:false
  }));
 }catch(e){
  console.error("JAKELI_REAL_MODEL_CHROMIUM_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});