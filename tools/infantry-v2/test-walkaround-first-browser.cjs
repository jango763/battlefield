'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('/tmp/bf-threejs-visual/node_modules/playwright');
const ROOT='visual-qa/first-game-walkaround';
fs.mkdirSync(ROOT,{recursive:true});
async function validate(browserType,name){
 const browser=await browserType.launch({headless:true,...(name==='chromium'
  ?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']}: {})});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,
  isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const report={browser:name,pass:false};
 try{
  await page.goto('http://127.0.0.1:8856/preview/walkaround.html',
   {waitUntil:'domcontentloaded',timeout:55000});
  await page.waitForFunction(()=>{
    try{return !!window.__BF_WALKAROUND__&&typeof germanPreview!=='undefined'&&
     !!germanPreview.startupHeroReady&&R.domElement.isConnected}
    catch(e){return false}
  },null,{timeout:180000});
  await page.waitForTimeout(1300);
  report.initial=await page.evaluate(()=>{
   const status=window.__BF_WALKAROUND__;
   const state=status.getState();
   return {...state,profile:status.engine,army:status.army,controls:!!document.getElementById('atk'),
    label:document.getElementById('graphics-build-label')?.textContent,
    originalAI:typeof ArmyAI==='function',
    originalGuard:typeof guardUpdate==='function',
    dynamicArmy:U.some(u=>u.t==='blue')&&U.some(u=>u.t==='red'),
    autoSpawns:spT.blue<1.5&&spT.red<1.5,
    graphics:window.__BATTLEFIELD_WORLD_ART__?.textures||null,
    glcanvas:R.domElement?.isConnected,
    heroVisible:!!P.g?.visible};
  });
  assert.equal(report.initial.profile,'Three.js');
  assert.equal(report.initial.army,'original-autonomous');
  assert.equal(report.initial.camera[1],20.5,'Still old tactical overhead camera');
  assert(report.initial.label?.includes('БРОДИЛКА'),'Wrong build shown on iPhone');
  assert(report.initial.controls,'Original touch FIRE control missing');
  assert(report.initial.glcanvas&&report.initial.heroVisible,'Original playable hero missing');
  assert(report.initial.originalAI&&report.initial.originalGuard,
   'Native autonomous infantry AI or guard magnet removed');
  assert(report.initial.dynamicArmy,'Autonomous armies did not appear on both factions');
  assert(report.initial.autoSpawns,'First game spawning timers missing');
  assert(report.initial.graphics?.['plaster-brick'],'Previously approved HD environment missing');
  // Stable original keyboard controls must still move the free-walking hero.
  await page.screenshot({path:ROOT+'/'+name+'-hero-follow.png'});
  const initial=report.initial.hero;
  await page.keyboard.down('w');
  await page.waitForTimeout(1000);
  await page.keyboard.up('w');
  report.after=await page.evaluate(()=>window.__BF_WALKAROUND__.getState());
  report.heroTravel=Math.hypot(report.after.hero[0]-initial[0],
   report.after.hero[1]-initial[1]);
  assert(report.heroTravel>.03,'Hero walking controls have stopped working');
  assert.equal(report.after.camera[1],20.5);
  assert(errors.filter(e=>!/No parent to post message|ResizeObserver loop/i.test(e)).length===0,
   'Browser page errors: '+errors.join(' | '));
  await page.screenshot({path:ROOT+'/'+name+'-hero-moving.png'});
  report.pass=true;
 }catch(error){
  report.error=String(error?.stack||error);
  report.browserErrors=errors;
  await page.screenshot({path:ROOT+'/'+name+'-FAILED.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{
  console.log('BATTLEFIELD_FIRST_WALKAROUND_MOBILE',JSON.stringify(report).slice(0,13500));
  await page.close();await browser.close();
 }
 return report;
}
(async()=>{
 const results=[await validate(chromium,'chromium'),await validate(webkit,'webkit')];
 fs.writeFileSync(ROOT+'/report.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
