'use strict';
const {chromium}=require('/tmp/battlefield-us-play/node_modules/playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const folder='babylon-us-hero-qa-results';fs.mkdirSync(folder,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push('page: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 try{
  await page.goto('http://127.0.0.1:8758/babylon/american-hero-production-v5-iphone.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_US_HERO_V5__?.ready===true,{timeout:90000});
  const qa=await page.evaluate(()=>window.__BATTLEFIELD_US_HERO_V5__);
  assert.equal(qa.modelBytes,4474936);assert.equal(qa.ready,true);
  assert.equal(await page.locator('input[type=file]').count(),0,'No file-selection UI');
  for(const name of ['uk-lee-enfield','uk-sten','uk-bren','uk-piat']){
   await page.locator('[data-weapon="'+name+'"]').click();
   await page.waitForFunction(w=>window.__BATTLEFIELD_US_HERO_V5__?.weaponId===w,name,{timeout:30000});
   await page.waitForTimeout(450);
   await page.screenshot({path:folder+'/'+name+'.png',fullPage:true});
  }
  await page.locator('[data-motion="Jog_Quaternius"]').click();await page.waitForTimeout(550);
  await page.screenshot({path:folder+'/running.png',fullPage:true});
  const last=await page.evaluate(()=>window.__BATTLEFIELD_US_HERO_V5__);
  fs.writeFileSync(folder+'/results.json',JSON.stringify({first:qa,last,errors},null,2));
  assert.equal(last.motion,'Jog_Quaternius');assert.equal(last.weaponId,'uk-piat');
  if(errors.length)console.log('Console errors:',errors.slice(0,4));
  console.log('HERO_IPHONE_VIEWPORT_QA_PASS',JSON.stringify({modelBytes:last.modelBytes,weapons:4,fps:last.fps,error:last.error}));
 }catch(e){
  await page.screenshot({path:folder+'/FAIL.png',fullPage:true}).catch(()=>{});
  fs.writeFileSync(folder+'/failure.txt',String(e)+'\nErrors:\n'+errors.join('\n')+'\n'+(await page.locator('#status').textContent().catch(()=>'')));
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
