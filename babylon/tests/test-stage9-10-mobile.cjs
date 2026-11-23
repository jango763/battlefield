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
  result.infantryFill=await page.evaluate(()=>{
   const sc=window.BABYLON.EngineStore.LastCreatedScene;
   const light=sc.lights.find(l=>l.name==='infantry-fill-light');
   const subset=light?.includedOnlyMeshes||[];
   return {present:!!light,enabled:light?.isEnabled(),
    intensity:light?.intensity,tracked:subset.length,
    allSoldiers:subset.every(m=>Number.isInteger(m.metadata?.squadSlot)),
    includesTerrain:subset.includes(sc.getMeshByName('map-ground-300')),
    groundBtrs:subset.filter(m=>m.name.startsWith('legacy-btr-')).length,
    sceneLightCount:sc.lights.length,
    report:window.__BATTLEFIELD_GAME__.infantryLighting};
  });
  assert(result.infantryFill.intensity>=1&&result.infantryFill.intensity<=1.10,
   'Character light profile must be bounded and consistent');
  assert(result.infantryFill.present&&result.infantryFill.enabled,
   'Soldier-only hemispheric fill not active');
  assert(result.infantryFill.tracked>=4,'Original imported GLB meshes not registered');
  assert(result.infantryFill.allSoldiers,
   'Infantry fill incorrectly assigned to non-soldier meshes');
  assert(!result.infantryFill.includesTerrain&&!result.infantryFill.groundBtrs,
   'Lighting must never wash out the environment or vehicles');
  assert.equal(result.infantryFill.sceneLightCount,3,
   'No extra world lights or per-soldier light instances');
  assert.equal(result.infantryFill.report.modifiedImportedMaterials,0);
  assert.equal(s.art.colorGrade,'north-africa-libya-sunlit-v1');
  assert.equal(s.art.theatre,'north-africa-libya-sunlit-v1');
  assert.equal(s.art.sandTextureSize,1024);
  assert.equal(s.art.lightMood,'warm-dry-high-noon');
  await page.waitForFunction(()=>
   window.__BATTLEFIELD_GAME__?.villageModels?.finished===true,
   null,{timeout:45000});
  result.libyaVillage=await page.evaluate(()=>{
   const g=window.__BATTLEFIELD_GAME__.villageModels;
   const scene=window.BABYLON.EngineStore.LastCreatedScene;
   const palm=scene.getMeshByName('north-africa-palm-fronds');
   return {style:g?.style,loaded:g?.loaded,pending:g?.pending,
    palmPresent:!!palm,palmVertices:palm?.getTotalVertices(),
    palmPickable:palm?.isPickable,
    adobeMeshes:scene.meshes.filter(m=>m.name.startsWith('libya-')).length,
    errors:g?.errors,
    stuccoDiffuse:scene.getMaterialByName('libya-sunlit-stucco')?.diffuseColor?.asArray(),
    stuccoUnlit:scene.getMaterialByName('libya-sunlit-stucco')?.disableLighting,
    stuccoTextureReady:scene.getMaterialByName('libya-sunlit-stucco')?.diffuseTexture?.isReady()};
  });
  assert(result.libyaVillage.stuccoDiffuse?.[0]>.85,
   'Libyan adobe walls must remain light sand, not black PBR facades');
  assert(result.libyaVillage.stuccoUnlit===true&&
   result.libyaVillage.stuccoTextureReady===true,
   'Author-painted adobe facades must remain bright and detailed');
  assert.equal(result.libyaVillage.style,'libya-adobe-procedural');
  assert.equal(result.libyaVillage.loaded,3);
  assert(result.libyaVillage.adobeMeshes>30);
  assert(result.libyaVillage.palmPresent&&result.libyaVillage.palmVertices>1000);
  assert.equal(result.libyaVillage.palmPickable,false);
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
  assert.equal(s.camera.mode,'elevated-tactical-follow');
  assert.equal(await page.evaluate(()=>window.BABYLON.EngineStore.LastCreatedScene.activeCamera.fov),.92,
   'Default tactical view must keep the approved wide field');
  await page.locator('#enter-game').click();
  await page.waitForTimeout(750);
  result.heroBefore=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.heroPosition);
  await page.screenshot({path:dir+'/'+name+'-portrait.png'});
  result.terrainDiagnostics=await page.evaluate(()=>{
   const scene=window.BABYLON.EngineStore.LastCreatedScene;
   const g=scene.getMeshByName('map-ground-300'),mat=g.material;
   const normals=g.getVerticesData('normal')||[];
   const indices=g.getIndices()||[];
   const positions=g.getVerticesData('position')||[];
   const tx=mat.diffuseTexture;
   let pixel=null;try{
    const ctx=tx.getContext();
    pixel=Array.from(ctx.getImageData(256,256,1,1).data);
   }catch(e){pixel=String(e)}
   return {ground:{visible:g.isVisible,enabled:g.isEnabled(),
    ready:mat.isReady(g),vertices:g.getTotalVertices(),indices:g.getTotalIndices(),
    normals:Array.from(normals.slice(0,9)),triangles:Array.from(indices.slice(0,6)),
    positions:Array.from(positions.slice(0,12)),scaling:g.scaling.asArray(),
    world:g.getWorldMatrix().toArray().slice(0,16)},
    material:{name:mat.name,disableLighting:mat.disableLighting,
      diffuse:mat.diffuseColor.asArray(),emissive:mat.emissiveColor.asArray(),
      textureReady:tx?.isReady(),canvasPixel:pixel,backface:mat.backFaceCulling},
    lightCount:scene.lights.length,clear:scene.clearColor.asArray(),
    activeCamera:scene.activeCamera?.position.asArray()};
  });
  assert(result.terrainDiagnostics.ground.normals[1]>.9,
   'Ground normals point DOWN: '+JSON.stringify(result.terrainDiagnostics.ground.normals));
  assert(result.terrainDiagnostics.material.textureReady,
   'Painted terrain texture unavailable to GPU');
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
  const halo=await page.evaluate(()=>{
    const scene=window.BABYLON.EngineStore.LastCreatedScene;
    const m=scene.getMeshByName('hero-halo-0');
    return {present:!!m,pickable:m?.isPickable,parent:m?.parent?.name,
     material:m?.material?.name};
   });
  assert(halo.present&&!halo.pickable&&halo.parent==='soldier-anchor-0',
   'Hero ground marker must be noninteractive and follow only the hero');
  result.heroMarker=halo;
  await page.locator('#hud-toggle').click();
  const zoomIn=await page.evaluate(()=>{
   const cam=window.BABYLON.EngineStore.LastCreatedScene.activeCamera;
   const before={radius:cam.radius,alpha:cam.alpha,beta:cam.beta};
   // Read before/after during one browser task; the render loop can move
   // the camera between asynchronous Playwright operations.
   document.getElementById('view-focus').click();
   return {radius:cam.radius,radiusBefore:before.radius,
    alpha:cam.alpha,alphaBefore:before.alpha,
    beta:cam.beta,betaBefore:before.beta,
    fov:cam.fov,state:window.__BATTLEFIELD_GAME__.cameraView};
  });
  assert.equal(zoomIn.fov,.74,'Close soldier view should magnify actors on screen');
  assert.equal(zoomIn.radius,zoomIn.radiusBefore,
   'Switching FOV must not directly change camera distance');
  assert.equal(zoomIn.alpha,zoomIn.alphaBefore,
   'Switching view must not change north-up bearing');
  assert.equal(zoomIn.beta,zoomIn.betaBefore,
   'Switching view must not change camera elevation');
  assert.equal(zoomIn.state.mode,'hero-close');
  // Same portrait viewpoint as the baseline screenshot; capture the larger
  // soldier presentation without the settings panel obscuring the scene.
  await page.locator('#hud-toggle').click();
  await page.screenshot({path:dir+'/'+name+'-hero-close.png'});
  await page.locator('#hud-toggle').click();
  await page.locator('#view-focus').click();
  const zoomOut=await page.evaluate(()=>({
   fov:window.BABYLON.EngineStore.LastCreatedScene.activeCamera.fov,
   state:window.__BATTLEFIELD_GAME__.cameraView
  }));
  assert.equal(zoomOut.fov,.92,'Second press must restore tactical view');
  assert.equal(zoomOut.state.mode,'tactical');
  result.cameraZoom={zoomIn,zoomOut};
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
  result.landscapeInput=await page.evaluate(()=>{
   const zone=document.getElementById('touch-zone');
   const controls=document.getElementById('mobile-controls');
   return {display:getComputedStyle(controls).display,
    zoneWidth:zone.getBoundingClientRect().width,
    viewport:window.innerWidth};
  });
  assert.equal(result.landscapeInput.display,'flex',
   'Landscape phones must display joystick, reload and fire');
  assert(result.landscapeInput.zoneWidth<result.landscapeInput.viewport*.50,
   'Left joystick zone must not block the central battlefield');
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
