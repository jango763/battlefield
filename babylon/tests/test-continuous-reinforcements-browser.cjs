'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('/tmp/battlefield-reinforcements/node_modules/playwright');
const ROOT='babylon-qa-results/continuous-reinforcements';
fs.mkdirSync(ROOT,{recursive:true});
async function check(type,name){
 const browser=await type.launch({headless:true,...(name==='chromium'
  ?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,
  isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const report={browser:name,passed:false};
 try{
  await page.goto('http://127.0.0.1:8857/babylon/index.html',
   {waitUntil:'domcontentloaded',timeout:75000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||
   !!window.__BATTLEFIELD_GAME__?.error,null,{timeout:160000});
  report.initial=await page.evaluate(()=>{
   const s=window.__BATTLEFIELD_GAME__;
   return {ready:s.ready,models:s.models,error:s.error,
    state:s.reinforcements,importedAlliedCount:s.importedAlliedCount};
  });
  assert(report.initial.ready,'Game not ready');
  assert(!report.initial.error,'Game init failed: '+report.initial.error);
  assert.equal(report.initial.models,2,'Original eager 24-model loading was not removed');
  assert.equal(report.initial.state?.blueAlive,1,'Hero missing at start');
  assert.equal(report.initial.state?.redAlive,1,'First enemy missing at start');
  assert.equal(report.initial.state?.maxAlivePerSide,8);
  assert(report.initial.importedAlliedCount>=1,'American hero GLB not loaded');
  await page.screenshot({path:ROOT+'/'+name+'-start-1v1.png'});
  await page.locator('#enter-game').click();
  assert(await page.locator('#panel').evaluate(el=>el.classList.contains('closed')),
   'HUD obscures combat after Enter');
  await page.waitForFunction(()=>{
   const s=window.__BATTLEFIELD_GAME__;
   return (s?.reinforcements?.blueAlive>=2&&s.reinforcements.redAlive>=2)||
    !!s?.error;
  },null,{timeout:175000});
  report.progress=await page.evaluate(()=>{
   const s=window.__BATTLEFIELD_GAME__,r=s.reinforcements;
   const scene=window.BABYLON.EngineStore.LastCreatedScene;
   const visible=scene.transformNodes.filter(n=>n.name.startsWith('soldier-anchor-')&&n.isEnabled());
   return {models:s.models,active:r,importedAlliedCount:s.importedAlliedCount,
    renderAnchors:visible.length,menuClosed:document.getElementById('panel').classList.contains('closed'),
    modeButton:document.querySelector('[data-scenario=squads]')?.textContent?.trim(),
    errors:s.error,hero:!!scene.getTransformNodeByName('soldier-anchor-0')?.isEnabled()};
  });
  assert(!report.progress.errors,'Game error after reinforcement');
  assert(report.progress.models>=4,'Real models not instantiated for reinforcements');
  assert(report.progress.models<24,'All 24 models incorrectly loaded immediately');
  assert(report.progress.active.blueAlive<=8&&report.progress.active.redAlive<=8);
  assert(report.progress.active.totalBlueReinforced>=2);
  assert(report.progress.active.totalRedReinforced>=2);
  assert(report.progress.modeButton?.includes('подкрепления'),'Old fixed 12v12 mode remained');
  assert(report.progress.hero,'Hero disappeared during unit replenishment');
  assert(report.progress.menuClosed,'Main HUD overlay blocks player');
  await page.screenshot({path:ROOT+'/'+name+'-continuous-reinforcements.png'});
  const fatal=errors.filter(e=>!/No parent to post message|ResizeObserver loop/i.test(e));
  assert.equal(fatal.length,0,'JS errors: '+fatal.join('; '));
  report.passed=true;
 }catch(e){
  report.error=String(e.stack||e);report.pageErrors=errors;
  await page.screenshot({path:ROOT+'/'+name+'-FAILED.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{
  console.log('CONTINUOUS_REINFORCEMENT_BROWSER',name,JSON.stringify(report).slice(0,10000));
  await page.close();await browser.close();
 }
 return report;
}
(async()=>{
 const reports=[await check(chromium,'chromium'),await check(webkit,'webkit')];
 fs.writeFileSync(ROOT+'/report.json',JSON.stringify(reports,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
