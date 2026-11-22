'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('/tmp/bf-mobile-visual/node_modules/playwright');
const out='babylon-qa-results/visual-stability';
fs.mkdirSync(out,{recursive:true});
async function test(browserType,name){
 const browser=await browserType.launch({
  headless:true,...(name==='chromium'?{args:['--no-sandbox',
   '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{})
 });
 let page=null;
 const result={name,success:false};
 try{
  page=await browser.newPage({viewport:{width:390,height:844},
   deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:8877/babylon/index.html?quality=auto',
   {waitUntil:'domcontentloaded',timeout:75000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||
   window.__BATTLEFIELD_GAME__?.error,null,{timeout:140000});
  const loaded=await page.evaluate(()=>{
   const s=window.__BATTLEFIELD_GAME__;
   const scene=window.BABYLON?.EngineStore.LastCreatedScene;
   const ground=scene?.getMeshByName('map-ground-300');
   return {ready:s.ready,error:s.error,
    terrain:s.modernArt?.terrainStyle,groundMaterial:ground?.material?.name,
    hasGroundMap:!!ground?.material?.albedoTexture,
    grass:!!scene?.getMeshByName('hd2026-meadow-tuft'),
    roadWidth:s.modernArt?.roadVisualWidth,
    organicRoad:!!scene?.getMeshByName('hd2026-organic-road-north-south'),
    oldRoadHidden:scene?.getMeshByName('north-south-road')?.isVisible===false,
    dotVergesAbsent:!scene?.getMeshByName('hd2026-road-verge'),
    controlButtonLeft:document.getElementById('quick-buttons')?.getBoundingClientRect().left,
    windowWidth:window.innerWidth,
    camera:s.cameraProfile,graphics:s.graphics};
  });
  assert(loaded.ready&&!loaded.error,'Game could not load: '+loaded.error);
  assert.equal(loaded.terrain,'low-frequency-mipmapped-matte');
  assert.equal(loaded.groundMaterial,'hd2026-matte-terrain');
  assert(loaded.hasGroundMap,'New terrain texture missing');
  assert(loaded.grass,'Opaque foliage missing');
  assert(Math.abs(loaded.roadWidth-5.64)<.01,'Road still too wide');
  assert(loaded.organicRoad&&loaded.oldRoadHidden&&loaded.dotVergesAbsent,
   'Irregular road surface did not replace rectangular road and dot verges');
  // After the battle-active CSS is applied the buttons must occupy RIGHT side.
  assert.equal(loaded.camera.mode,'elevated-tactical-follow');
  await page.locator('#enter-game').click();
  await page.waitForTimeout(700);
  const buttonBounds=await page.evaluate(()=>{
   const r=document.getElementById('quick-buttons').getBoundingClientRect();
   return {left:r.left,right:r.right,viewport:innerWidth};
  });
  assert(buttonBounds.left>buttonBounds.viewport*.52,
   'Fire/reload buttons overlap left joystick: '+JSON.stringify(buttonBounds));
  const initial=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.heroPosition);
  await page.screenshot({path:out+'/'+name+'-soft-terrain.png'});
  // User gestures are real pointer input, not synthesized app callbacks.
  await page.mouse.move(160,690);await page.mouse.down();
  await page.mouse.move(92,690,{steps:8});
  await page.waitForTimeout(850);
  await page.mouse.up();
  const left=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.heroPosition);
  assert(left.x>initial.x+.20,
   'Dragging LEFT must send hero toward world +X / screen-left: '+
    JSON.stringify({initial,left}));
  await page.mouse.move(84,690);await page.mouse.down();
  await page.mouse.move(165,690,{steps:8});
  await page.waitForTimeout(850);
  await page.mouse.up();
  const right=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.heroPosition);
  assert(right.x<left.x-.20,
   'Dragging RIGHT must send hero toward world -X / screen-right: '+
    JSON.stringify({left,right}));
  assert.equal(errors.length,0,'Unexpected browser errors: '+errors.join('; '));
  result.success=true;result.loaded=loaded;result.positions={initial,left,right};
  await page.screenshot({path:out+'/'+name+'-after-control.png'});
 }catch(error){
  result.error=String(error?.stack||error);
  if(page)await page.screenshot({path:out+'/'+name+'-FAILED.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{
  fs.writeFileSync(out+'/'+name+'-result.json',JSON.stringify(result,null,2));
  console.log('BATTLEFIELD_MOBILE_VISUAL_TEST',JSON.stringify(result));
  await page?.close();await browser.close();
 }
}
(async()=>{
 await test(chromium,'chromium');
 await test(webkit,'webkit');
})().catch(e=>{console.error(e);process.exitCode=1});
