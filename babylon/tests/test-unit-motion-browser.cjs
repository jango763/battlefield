'use strict';
/* Only THREE 3D soldiers and source/baked donor motions. No map or gameplay. */
const assert=require('node:assert/strict');
const {chromium}=require('/tmp/bf-unit-motion/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto('http://127.0.0.1:8858/babylon/units-first.html',
   {waitUntil:'domcontentloaded',timeout:60000});
  for(const id of ['german','jakeli','american']){
   if(id!=='german')await page.locator('[data-unit="'+id+'"]').click();
   await page.waitForFunction(id=>{
    const s=window.__BF_UNIT_REVIEW__;
    return s?.error||s?.selected===id&&s?.characters[id]?.activeClip;
   },id,{timeout:90000});
  }
  const status=await page.evaluate(()=>{
   const s=window.__BF_UNIT_REVIEW__;
   return {error:s.error,ready:s.ready,modelCount:s.loadedCount,
    motionReports:s.motionReports,groups:s.createdGroups,selected:s.selected,
    realModels:s.realModels};
  });
  console.log('BATTLEFIELD_UNIT_MOTION_MOBILE',JSON.stringify(status));
  assert(!status.error,'Invalid real soldier GLB or retarget: '+status.error);
  assert.equal(status.modelCount,3,'Three original soldiers must load');
  assert.equal(errors.length,0,errors.join('; '));
  assert.equal(status.realModels.german,true);
  assert.equal(status.realModels.jakeli,true);
  assert.equal(status.realModels.american,true);
  for(const [id,mode] of [['jakeli','run'],['american','run'],['american','idle'],['german','idle']])
   assert(status.motionReports[id]?.[mode]&&
    !['pending'].includes(status.motionReports[id][mode].status),
    id+' '+mode+' donor must be processed or explicitly rejected');
  await page.locator('[data-motion="run"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({path:'/tmp/bf-unit-motion-american-run.png'});
  await page.locator('#motion-standard').click();
  assert.equal(await page.locator('#motion-standard').getAttribute('aria-pressed'),'false');
  await page.screenshot({path:'/tmp/bf-unit-motion-american-native.png'});
  console.log('BATTLEFIELD_UNIT_MOTION_BROWSER_TEST_PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
