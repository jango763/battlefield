'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const dir='us-hero-ara-qa-results';
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try{
  await page.goto('http://127.0.0.1:8758/babylon/american-hero-ara-autoload-iphone.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_US_HERO_V5__?.ready===true,{timeout:100000});
  const qa=await page.evaluate(()=>window.__BATTLEFIELD_US_HERO_V5__);
  assert.equal(qa.modelBytes,4474936,'Original 4-motion hero GLB');
  assert.equal(await page.locator('input[type=file]').count(),0,'No file picker in production preview');
  for(const name of ['uk-lee-enfield','uk-sten','uk-bren','uk-piat']){
   await page.locator('[data-weapon="'+name+'"]').click();
   await page.waitForFunction(w=>window.__BATTLEFIELD_US_HERO_V5__?.weaponId===w,name,{timeout:30000});
   await page.waitForTimeout(650);
   await page.screenshot({path:dir+'/'+name+'-ready.png'});
   await page.locator('#aim-control').click();
   await page.waitForTimeout(300);
   await page.screenshot({path:dir+'/'+name+'-aim.png'});
   await page.locator('#aim-control').click();
  }
  await page.locator('[data-motion="Jog_Quaternius"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({path:dir+'/jog-piat.png'});
  const result=await page.evaluate(()=>({qa:window.__BATTLEFIELD_US_HERO_V5__,status:document.getElementById('status').textContent,metrics:document.getElementById('metrics').textContent}));
  fs.writeFileSync(dir+'/summary.json',JSON.stringify({...result,errors},null,2));
  assert.equal(result.qa.weaponId,'uk-piat');
  assert.equal(result.qa.motion,'Jog_Quaternius');
  assert(!errors.length,'Browser errors: '+errors.join('; '));
  console.log('US_ARA_HYBRID_BROWSER_QA_PASS',result);
 }catch(e){await page.screenshot({path:dir+'/FAIL.png'}).catch(()=>{});throw e;}
 finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});