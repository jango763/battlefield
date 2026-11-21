'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('/tmp/battlefield-first-game-parity/node_modules/playwright');
const ROOT='babylon-qa-results/first-game-parity';
fs.mkdirSync(ROOT,{recursive:true});
async function inspect(browserType,browserName){
 const browser=await browserType.launch({headless:true,...(browserName==='chromium'
  ?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
 const page=await browser.newPage({viewport:{width:390,height:844},
  deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const report={browser:browserName,passed:false};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8859/babylon/index.html',
   {waitUntil:'domcontentloaded',timeout:75000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||
   window.__BATTLEFIELD_GAME__?.error,null,{timeout:160000});
  const state=await page.evaluate(()=>window.__BATTLEFIELD_GAME__);
  assert(state.ready&&!state.error,'Game boot failed: '+state.error);
  assert.equal(state.controls,'first-game-free-walking');
  assert.equal(state.armyBehavior,'autonomous-capture-and-magnet');
  assert.equal(state.models,2,'24 skeletons should NOT be loaded at boot');
  assert(Math.abs(state.cameraPosition.alpha-Math.PI*1.5)<.1,
   'Camera no longer follows original first-game direction');
  assert(Math.abs(state.cameraPosition.radius-43)<2);
  report.start={models:state.models,controls:state.controls,
   army:state.armyBehavior,camera:state.cameraPosition};
  await page.screenshot({path:ROOT+'/'+browserName+'-hero-start.png'});
  await page.locator('#enter-game').click();
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.reinforcements?.redAlive>=2&&
   window.__BATTLEFIELD_GAME__?.reinforcements?.blueAlive>=2,
   null,{timeout:170000});
  const before=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.heroPosition);
  await page.keyboard.down('w');
  await page.waitForTimeout(1450);
  await page.keyboard.up('w');
  await page.waitForTimeout(350);
  const after=await page.evaluate(()=>{
   const s=window.__BATTLEFIELD_GAME__;
   return {hero:s.heroPosition,camera:s.cameraPosition,army:s.firstGameArmy,
    reinforcements:s.reinforcements,models:s.models};
  });
  report.walked=Math.hypot(after.hero.x-before.x,after.hero.z-before.z);
  assert(report.walked>5,'Direct W key did not move player freely');
  assert(Math.abs(after.camera.alpha-Math.PI*1.5)<.1,
   'One-finger free movement unintentionally rotates the camera');
  assert(after.army.autonomousRed>=1,'Enemy infantry is still controlled by nearest-hero chase');
  assert(Object.keys(after.army.goals).some(id=>id.startsWith('вермахт-')),
   'German infantry lacks independent farm-capture mission');
  assert(after.army.aliveGuards<=6,'Magnetic squad cap exceeded');
  assert(after.reinforcements.blueAlive<=8&&after.reinforcements.redAlive<=8,
   'Active mobile cap exceeded');
  assert(after.models<24,'Original 24 instant model load returned');
  report.end=after;
  await page.screenshot({path:ROOT+'/'+browserName+'-walking-army.png'});
  assert.equal(errors.length,0,'Page errors: '+errors.join('; '));
  report.passed=true;
 }catch(error){
  report.error=String(error.stack||error);report.errors=errors;
  await page.screenshot({path:ROOT+'/'+browserName+'-FAILED.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{
  console.log('FIRST_BATTLEFIELD_BEHAVIOR_BROWSER',JSON.stringify(report).slice(0,18000));
  await page.close();await browser.close();
 }
 return report;
}
(async()=>{
 const out=[await inspect(chromium,'chromium'),await inspect(webkit,'webkit')];
 fs.writeFileSync(ROOT+'/report.json',JSON.stringify(out,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
