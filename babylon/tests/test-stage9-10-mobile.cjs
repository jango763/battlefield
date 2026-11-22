'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pw=require('/tmp/bf-stage910/node_modules/playwright');
const name=process.argv[2]||'chromium';
const dir='babylon-qa-results/stage9-10';
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await pw[name].launch({headless:true,...(name==='chromium'
  ?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{})});
 const page=await browser.newPage({
  viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 page.setDefaultTimeout(35000);
 const result={browser:name,success:false,errors:[],requests:[]};
 page.on('pageerror',e=>result.errors.push(String(e)));
 page.on('requestfailed',r=>result.requests.push({
  url:r.url(),reason:r.failure()?.errorText}));
 try{
  await page.goto('http://127.0.0.1:8877/babylon/index.html?quality=low',
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||
   window.__BATTLEFIELD_GAME__?.error,null,{timeout:180000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.vehicleBounds?.length===3,
   null,{timeout:90000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.modernArt?.scannedMaterialMaps>=12,
   null,{timeout:40000});
  result.initial=await page.evaluate(()=>{
   const s=window.__BATTLEFIELD_GAME__,b=window.BABYLON;
   const scene=b.EngineStore.LastCreatedScene;
   const grass=scene.getMeshByName('hd2026-hedgerow');
   return {ready:s.ready,error:s.error,art:s.modernArt,
    btrs:s.vehicleBounds,optimization:s.optimization,
    graphics:s.graphics,trenchCount:s.defenses?.trenches,
    turretNodes:scene.transformNodes.filter(x=>x.name.endsWith('-turret')).length,
    shrubInstances:grass?.thinInstanceCount,
    batchMeshes:scene.meshes.filter(x=>x.name.startsWith('field-batched-')).length,
    camera:s.cameraProfile,
    skeletons:scene.skeletons.length,
    farmCount:document.getElementById('battle-minimap')?5:0};
  });
  const s=result.initial;
  assert(s.ready&&!s.error,'Game startup failed: '+s.error);
  assert.equal(s.art.colorGrade,'muted-olive-earth-v4');
  assert.equal(s.art.roadVisualWidth,4.2,'Road must be narrowed');
  assert.equal(await page.evaluate(()=>{
   const m=window.BABYLON.EngineStore.LastCreatedScene.getMeshByName('map-ground-300');
   return m?.material?.name==='hd2026-matte-terrain'&&!!m.material.diffuseTexture;
  }),true,'Matte diffuse ground did not load');
  assert(s.art.mipmappedScans&&s.art.opaqueHedgerows);
  assert(s.art.scannedMaterialMaps>=12);
  assert(s.shrubInstances>=30,'Nontransparent low-poly ground foliage absent');
  assert(s.optimization.drawCallsSaved>=60,
   'Static defensive meshes were not batched: '+JSON.stringify(s.optimization));
  assert(s.optimization.dynamicMountMeshes>=12,'Gun meshes should remain animated');
  assert.equal(s.turretNodes,4,'Two guns and two MG turrets required');
  assert.equal(s.trenchCount,8);
  assert.equal(s.btrs.length,3);
  for(const b of s.btrs){
   assert(Math.abs(b.minY-.025)<.025,'BTR not grounded');
   assert(b.height>1&&b.height<5,'BTR still vertical');
  }
  assert.equal(s.graphics.mode,'low');
  assert(s.camera.mode==='elevated-tactical-follow');
  assert(s.camera.radius>=28&&s.camera.radius<=31,'Camera must expose more of battlefield');
  await page.locator('#enter-game').click();
  await page.waitForTimeout(750);
  result.heroBefore=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.heroPosition);
  await page.screenshot({path:dir+'/'+name+'-portrait.png'});
  await page.mouse.move(160,693);await page.mouse.down();
  await page.mouse.move(94,693,{steps:7});
  await page.waitForTimeout(850);await page.mouse.up();
  const left=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.heroPosition);
  assert(left.x>result.heroBefore.x+.15,'Joystick LEFT is reversed or stuck');
  await page.mouse.move(83,693);await page.mouse.down();
  await page.mouse.move(164,693,{steps:7});
  await page.waitForTimeout(850);await page.mouse.up();
  const right=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.heroPosition);
  assert(right.x<left.x-.15,'Joystick RIGHT is reversed or stuck');
  result.heroMovement={left,right};
  await page.locator('#hud-toggle').click();
  await page.locator('#quality-cycle').click();
  result.graphicsAfter=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.graphics);
  assert.equal(result.graphicsAfter.mode,'high','Quality toggle did not work');
  assert(!result.graphicsAfter.adaptive);
  await page.locator('#quality-cycle').click();
  result.graphicsAuto=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.graphics);
  assert.equal(result.graphicsAuto.mode,'auto');
  assert(result.graphicsAuto.adaptive);
  await page.locator('#hud-toggle').click();
  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(550);
  await page.screenshot({path:dir+'/'+name+'-landscape.png'});
  result.final=await page.evaluate(()=>{
   const s=window.__BATTLEFIELD_GAME__,scene=window.BABYLON.EngineStore.LastCreatedScene;
   return {ready:s.ready,error:s.error,fps:scene.getEngine().getFps(),
    sceneMeshes:scene.meshes.length,graphics:s.graphics,
    supportsTouch:!!document.getElementById('touch-zone')};
  });
  assert(result.final.ready&&!result.final.error);
  assert.equal(result.errors.length,0,'Browser script exceptions: '+result.errors.join('; '));
  result.success=true;
 }catch(e){
  result.error=String(e?.stack||e);process.exitCode=1;
  await page.screenshot({path:dir+'/'+name+'-FAILED.png'}).catch(()=>{});
 }finally{
  fs.writeFileSync(dir+'/'+name+'.json',JSON.stringify(result,null,2));
  console.log('BATTLEFIELD_STAGE9_10_MOBILE',JSON.stringify(result).slice(0,25000));
  await page.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
