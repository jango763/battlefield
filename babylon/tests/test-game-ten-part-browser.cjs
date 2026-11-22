'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('/tmp/bf-ten-stage/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader','--enable-webgl','--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},
   deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8876/babylon/index.html?quality=low',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||
   window.__BATTLEFIELD_GAME__?.error,null,{timeout:105000});
  const metrics=await page.evaluate(()=>{
   const s=window.__BATTLEFIELD_GAME__;
   return {ready:s.ready,error:s.error,models:s.models,
    graphics:s.graphics,mission:s.mission,
    engineering:s.engineering,minimap:{
     width:document.getElementById('battle-minimap').width,
     height:document.getElementById('battle-minimap').height}};
  });
  console.log('BATTLEFIELD_TEN_PART_PREVIEW',JSON.stringify(metrics));
  assert.equal(metrics.ready,true,'Real Babylon game should load on phone');
  assert(metrics.models>=2,'Hero and opponent GLBs must be present');
  assert.equal(metrics.graphics.mode,'low');
  assert.equal(metrics.minimap.width,232,'Retina minimap');
  assert.equal(metrics.mission?.completed,0,'Session objectives reset');
  assert.equal(metrics.engineering?.parts,10,'Ten real game code partitions');
  assert.equal(errors.length,0,'JS errors: '+errors.join(' | '));
  await page.locator('#enter-game').click();
  await page.waitForTimeout(2200);
  const started=await page.evaluate(()=>({
   battle:document.body.classList.contains('battle-active'),
   mission:window.__BATTLEFIELD_GAME__.mission,
   graphics:window.__BATTLEFIELD_GAME__.graphics,
   readout:document.getElementById('readout').textContent
  }));
  console.log('BATTLEFIELD_TEN_PART_BATTLE',JSON.stringify({
   battle:started.battle,mission:started.mission,graphics:started.graphics,
   missionShown:started.readout.includes('Задача:')}));
  assert(started.battle,'Start button must enter combat');
  assert(started.readout.includes('Задача:'),'Gamification objective must appear in HUD');
  assert.equal(errors.length,0,'Runtime JS errors after combat start');
  const image=await page.screenshot({type:'jpeg',quality:35,
   path:'/tmp/bf-ten-stage-mobile.jpeg'});
  console.log('BATTLEFIELD_TEN_PART_MOBILE_JPEG_BASE64 '+image.toString('base64'));
  console.log('BATTLEFIELD_TEN_PART_BROWSER_TEST_PASS');
  await page.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
