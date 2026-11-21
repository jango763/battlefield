'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('/tmp/bf-art-2026/node_modules/playwright');
const ROOT='babylon-qa-results/modern-art-2026';
fs.mkdirSync(ROOT,{recursive:true});
async function run(engine,name,mode){
 const browser=await engine.launch({headless:true,...(name==='chromium'
   ?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,
   isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result={browser:name,mode,pass:false};
 try{
  await page.goto('http://127.0.0.1:8862/babylon/index.html?art='+mode,
   {waitUntil:'domcontentloaded',timeout:75000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||
   !!window.__BATTLEFIELD_GAME__?.error,null,{timeout:170000});
  if(mode==='modern'){
   await page.waitForFunction(()=>{
    const art=window.__BATTLEFIELD_GAME__?.modernArt;
    return art?.ready && (art.scannedMaterialMaps>=16||art.errors.length>0);
   },null,{timeout:35000});
  }
  const start=await page.evaluate(()=>{
   const state=window.__BATTLEFIELD_GAME__,B=window.BABYLON;
   const scene=B.EngineStore.LastCreatedScene;
   const art=state.modernArt;
   return {ready:state.ready,error:state.error,
    art,models:state.models,pbr:scene.materials.filter(m=>m.getClassName()==='PBRMaterial').length,
    hdMaterials:scene.materials.filter(m=>m.name?.startsWith('hd2026-')).length,
    grounds:scene.meshes.filter(m=>m.name==='map-ground-300'&&!!m.material?.albedoTexture).length,
    hdNodes:scene.meshes.filter(m=>m.name?.startsWith('hd2026-')).length,
    meshCount:scene.meshes.length,
    text:document.getElementById('graphics-tag')?.textContent,
    army:state.armyBehavior};
  });
  result.initial=start;
  assert(start.ready&&!start.error,'Cannot start game '+start.error);
  assert.equal(start.models,2,'Changed the original approved character model startup');
  assert.equal(start.army,'autonomous-capture-and-magnet');
  if(mode==='modern'){
   assert(start.art?.ready,'Modern art not applied');
   assert.equal(start.art?.errors.length,0,'Local scan errors: '+start.art?.errors.join(' | '));
   assert(start.art?.scannedMaterialMaps>=16,'No photo-scan PBR images loaded');
   assert(start.art?.meshSurfaces>=35,'Still shows untextured block world');
   assert(start.art?.architecturalDetails>=140,'Real architectural detail missing');
   assert(start.art?.damagedRuins>=6,'Damaged village ruins missing');
   assert(start.art?.drawCallBatches>=4,'Too many draw calls; no batching');
   assert(start.art?.foliageInstances>=80,'Missing instanced grass');
   assert(start.hdMaterials>=8,'Scanned PBR materials not applied');
   assert(start.grounds===1,'Terrain scan missing');
   assert(start.text?.includes('PBR'),'Incorrect build label');
  }else{
   assert.equal(start.hdMaterials,0,'Modern PBR material leaked into original comparison');
   assert(start.text?.includes('ORIGINAL'));
  }
  await page.locator('#enter-game').click();
  await page.waitForTimeout(1300);
  const hero=await page.evaluate(()=>{
   const state=window.__BATTLEFIELD_GAME__;
   return {x:state.heroPosition?.x,z:state.heroPosition?.z,
    models:state.models,active:state.reinforcements};
  });
  assert(hero.models>=2&&hero.models<24,'Babylon GLB supply regressions');
  assert(hero.active?.blueAlive>=1&&hero.active?.redAlive>=1);
  await page.screenshot({path:ROOT+'/'+name+'-'+mode+'.png'});
  result.pass=true;
 }catch(e){
  result.error=String(e?.stack||e);
  await page.screenshot({path:ROOT+'/'+name+'-'+mode+'-FAILED.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{
  result.errors=errors;
  console.log('BATTLEFIELD_MODERN_ART_BROWSER',JSON.stringify(result).slice(0,20000));
  await page.close();await browser.close();
 }
 return result;
}
(async()=>{
 const results=[];
 for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']]){
  results.push(await run(engine,name,'classic'));
  results.push(await run(engine,name,'modern'));
 }
 fs.writeFileSync(ROOT+'/report.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
