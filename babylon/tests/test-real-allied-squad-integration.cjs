'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('/tmp/battlefield-actual-allies/node_modules/playwright');
const ROOT='babylon-qa-results/actual-three-soldier-integrated';
fs.mkdirSync(ROOT,{recursive:true});
async function inspect(browserType,name){
 const browser=await browserType.launch({headless:true,...(name==='chromium'
  ?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result={browser:name,success:false,checkpoints:[]};
 try{
  await page.goto('http://127.0.0.1:8855/babylon/index.html',{waitUntil:'domcontentloaded',timeout:75000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||!!window.__BATTLEFIELD_GAME__?.error,
    null,{timeout:150000});
  let state=await page.evaluate(()=>({...window.__BATTLEFIELD_GAME__}));
  result.initialState=state;
  result.importDiagnostics=await page.evaluate(()=>window.__BATTLEFIELD_TRIAL_IMPORT_QA__||null);
  console.log('REAL_ALLIED_INITIAL_STATE',name,JSON.stringify(state).slice(0,6000));
  console.log('REAL_ALLIED_IMPORT_DIAGNOSTICS',name,
   JSON.stringify(result.importDiagnostics).slice(0,7000));
  assert(!state.error,JSON.stringify({error:state.error,modelErrors:state.modelErrors}));
  assert(state.ready,'Main game never became ready');
  assert(state.importedAlliedCount>=1,'Approved real US hero missing from initial duel');
  assert(!state.modelErrors.americanHero,'US hero file rejected: '+state.modelErrors.americanHero);
  result.checkpoints.push({step:'duel',models:state.models,importedAllies:state.importedAlliedCount});
  await page.screenshot({path:ROOT+'/'+name+'-hero-duel.png'});
  await page.locator('#enter-game').click();
  await page.locator('[data-scenario="squads"]').click();
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.models>=24||
    !!window.__BATTLEFIELD_GAME__?.error,null,{timeout:200000});
  state=await page.evaluate(()=>({...window.__BATTLEFIELD_GAME__}));
  result.fullState=state;
  assert(!state.error,JSON.stringify({error:state.error,modelErrors:state.modelErrors}));
  assert.equal(state.models,24,'24 independent soldier instances');
  assert.equal(state.importedAlliedCount,9,'US hero and eight real Jakeli British infantry');
  assert(!state.modelErrors.britishJakeli,'Jakeli import failed: '+state.modelErrors.britishJakeli);
  assert(!state.modelErrors.americanHero);
  result.checkpoints.push({step:'squads',models:state.models,importedAllies:state.importedAlliedCount});
  result.visualAudit=await page.evaluate(()=>{
   const B=window.BABYLON,scene=B.EngineStore.LastCreatedScene;
   const ground=scene.getMeshByName('map-ground-300');
   const material=ground?.material,texture=material?.diffuseTexture;
   const context=texture?.getContext?.();
   let groundPixel=null;
   if(context?.getImageData){
    const p=context.getImageData(3,3,1,1).data;
    groundPixel=[p[0],p[1],p[2]];
   }
   const camera=scene.activeCamera;
   return {fogMode:scene.fogMode,fogDensity:scene.fogDensity,
    expectedFog:B.Scene.FOGMODE_EXP2,groundTextureReady:!!texture?.isReady?.(),
    groundPixel,cameraRadius:camera?.radius||null,cameraBeta:camera?.beta||null,
    menuClosed:document.getElementById('panel').classList.contains('closed'),
    controlsVisible:getComputedStyle(document.getElementById('mobile-controls')).display!=='none',
    visualProfile:window.__BATTLEFIELD_GAME__.visualProfile};
  });
  console.log('BATTLEFIELD_LEGACY_VISUAL_AUDIT',name,JSON.stringify(result.visualAudit));
  assert.equal(result.visualAudit.fogMode,result.visualAudit.expectedFog,
   'Atmospheric first-game fog must be enabled');
  assert(result.visualAudit.groundTextureReady,'Ground texture not uploaded to WebGL');
  assert(result.visualAudit.groundPixel?.every(v=>v<225),'Ground must not be white');
  assert(result.visualAudit.cameraRadius>=35 && result.visualAudit.cameraRadius<75,
   'Camera reverted to barrack-wall close-up');
  assert(result.visualAudit.menuClosed,'Menu must be closed during battle');
  assert(result.visualAudit.controlsVisible,'First-game mobile controls missing');
  assert.equal(result.visualAudit.visualProfile?.shadows,'soft-PCF');
  await page.screenshot({path:ROOT+'/'+name+'-24-soldiers.png'});
  const startPos=await page.evaluate(()=>{
   const v=window.BABYLON.EngineStore.LastCreatedScene.getTransformNodeByName('soldier-anchor-0');
   return {x:v?.position.x,z:v?.position.z};
  });
  const pad=await page.locator('#touch-stick').boundingBox();
  assert(pad,'Joystick target must exist');
  const cx=pad.x+pad.width/2,cy=pad.y+pad.height/2;
  await page.mouse.move(cx,cy);await page.mouse.down();
  await page.mouse.move(cx+24,cy-32,{steps:5});
  await page.waitForTimeout(850);await page.mouse.up();
  const endPos=await page.evaluate(()=>{
   const v=window.BABYLON.EngineStore.LastCreatedScene.getTransformNodeByName('soldier-anchor-0');
   return {x:v?.position.x,z:v?.position.z};
  });
  result.joystickTravel=Math.hypot(endPos.x-startPos.x,endPos.z-startPos.z);
  assert(result.joystickTravel>.1,'Joystick did not move the hero');
  await page.screenshot({path:ROOT+'/'+name+'-legacy-controls.png'});
  assert.equal(errors.length,0,'Browser scripts failed: '+errors.join('|'));
  result.success=true;
 }catch(e){
  result.error=String(e.stack||e);result.pageErrors=errors;
  await page.screenshot({path:ROOT+'/'+name+'-failure.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{await browser.close();}
 return result;
}
(async()=>{
 const results=[await inspect(chromium,'chromium'),await inspect(webkit,'webkit')];
 fs.writeFileSync(ROOT+'/report.json',JSON.stringify(results,null,2));
 console.log('BATTLEFIELD_REAL_ALLIES_MAIN_GAME_QA',JSON.stringify(results.map(x=>({
  browser:x.browser,success:x.success,checkpoints:x.checkpoints,error:x.error||null}))));
})().catch(e=>{console.error(e);process.exitCode=1});
