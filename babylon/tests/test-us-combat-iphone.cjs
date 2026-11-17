'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {chromium,devices}=require('/tmp/babylon-qa/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--disable-web-security']});
 const ctx=await browser.newContext({...devices['iPhone 13'],viewport:{width:390,height:844}});
 const page=await ctx.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const dest=path.resolve('babylon-qa-results/us-hero');
 fs.mkdirSync(dest,{recursive:true});
 try{
  await page.goto('http://127.0.0.1:8758/babylon/us-combat-iphone-v1.html',
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_US_COMBAT_QA__?.ready||
   window.__BATTLEFIELD_US_COMBAT_QA__?.error,{timeout:150000});
  const state=await page.evaluate(()=>window.__BATTLEFIELD_US_COMBAT_QA__);
  console.log('STATE',JSON.stringify(state));
  if(!state?.ready)throw Error('Viewer not ready: '+state?.error);
  if(!state.automatic||state.heroBones!==65||state.heroMeshes!==36||state.clips<2)
   throw Error('Hero auto load or retargeting wrong: '+JSON.stringify(state));
  const weapons=['uk-lee-enfield','uk-sten','uk-bren','uk-piat'];
  for(const w of weapons){
   await page.locator('[data-weapon="'+w+'"]').click();
   await page.waitForFunction(id=>window.__BATTLEFIELD_US_COMBAT_QA__?.weapon===id,w,{timeout:30000});
   await page.waitForTimeout(1200);
   const report=await page.evaluate(()=>window.__BATTLEFIELD_US_COMBAT_QA__);
   console.log('WEAPON',w,JSON.stringify(report));
   await page.screenshot({path:path.join(dest,w+'.png')});
   if(report.error)throw Error(w+': '+report.error);
  }
  for(const p of ['aim','ready','run','sprint']){
   await page.locator('[data-pose="'+p+'"]').click();
   await page.waitForTimeout(1000);
   await page.screenshot({path:path.join(dest,'pose-'+p+'.png')});
  }
  if(errors.length)console.log('BROWSER_ERRORS',JSON.stringify(errors.slice(0,15)));
  console.log('US_HERO_AUTOLOAD_FOUR_WEAPONS_QA_PASS');
 }catch(e){
  console.error('US_HERO_QA_FAIL',String(e));
  console.error('BROWSER_ERRORS',JSON.stringify(errors.slice(0,15)));
  await page.screenshot({path:path.join(dest,'failure.png')}).catch(()=>{});
  process.exitCode=1;
 }finally{await browser.close()}
})();