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
  // Mobile visual acceptance gate: the 3D canvas must have space for the
  // COMPLETE soldier before the user taps anything. The bottom controls are
  // collapsed by default, while faction switcher is always available above.
  const initialUI=await page.evaluate(()=>{
   const rect=id=>{const b=document.getElementById(id).getBoundingClientRect();
    return {x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom};};
   return {panelOpen:window.__BF_UNIT_REVIEW__?.panelOpen,
    expanded:document.getElementById('toggle-controls').getAttribute('aria-expanded'),
    hidden:document.getElementById('controls-body').hidden,
    control:rect('control'),picker:rect('unit-picker'),
    viewport:{width:innerWidth,height:innerHeight}};
  });
  console.log('BATTLEFIELD_UNIT_MOBILE_LAYOUT',JSON.stringify(initialUI));
  assert.equal(initialUI.panelOpen,false,'Menu must start collapsed');
  assert.equal(initialUI.expanded,'false','Menu toggle accessibility state');
  assert.equal(initialUI.hidden,true,'Animation controls hidden by default');
  assert(initialUI.control.h<=70,'Collapsed controls cover too much of the figure');
  assert(initialUI.picker.h<=72,'Faction picker covers too much of the figure');
  assert(initialUI.picker.bottom<initialUI.viewport.height*.22,'Picker must stay near top');
  assert(initialUI.control.y>initialUI.viewport.height*.84,'Controls must stay at bottom');
  for(const id of ['german','jakeli','american']){
   if(id!=='german')await page.locator('[data-unit="'+id+'"]').click();
   await page.waitForFunction(id=>{
    const s=window.__BF_UNIT_REVIEW__;
    return s?.error||s?.selected===id&&s?.characters[id]?.activeClip;
   },id,{timeout:90000});
   const loaded=await page.evaluate(id=>{
    const s=window.__BF_UNIT_REVIEW__;
    return {id,error:s?.error,failures:s?.skinFailures,loadedCount:s?.loadedCount,
     active:s?.characters[id]?.activeClip,models:s?.realModels,
     rigReady:s?.characters[id]?.rigReady,assembled:s?.characters[id]?.assembled,
     hiddenSourceGun:s?.characters[id]?.hiddenSourceGun};
   },id);
   console.log('BATTLEFIELD_UNIT_LOAD_STEP',JSON.stringify(loaded));
   assert(!loaded.error,'Original model '+id+' failed: '+loaded.error);
   assert(loaded.active,'Original '+id+' was not selected and animated');
   assert(loaded.rigReady,'Soldier '+id+' must have complete hands / gun rig, never a mannequin');
   if(id==='american')assert(/hand IK/.test(loaded.assembled),'American must have original Lee-Enfield rig');
   if(id==='american')assert.equal(loaded.hiddenSourceGun,5,'American original gun must not overlap equipped Lee-Enfield');
   if(id==='german')assert(/weapon rig/.test(loaded.assembled),'German must be equipped, not a naked animation source');
   await page.waitForTimeout(400);
   // Visible output is captured for human inspection; base64 JPEG in the CI
   // log permits inspecting the ACTUAL browser pixels, not only console QA.
   const jpg=await page.screenshot({type:'jpeg',quality:48,
     path:'/tmp/bf-unit-soldier-'+id+'-full.jpeg'});
   console.log('BATTLEFIELD_QA_PREVIEW_'+id.toUpperCase()+'_JPEG_BASE64 '+jpg.toString('base64'));
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
  await page.locator('#toggle-controls').click();
  assert.equal(await page.locator('#toggle-controls').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('[data-motion="run"]').isVisible(),true,
   'Animation controls must be visible after toggle');
  await page.locator('[data-motion="run"]').click();
  assert.equal(status.motionReports.american.idle.status,'native-weapon-ready','Do not transfer foreign arm pose');
  assert.equal(status.motionReports.german.idle.status,'native-weapon-ready','Do not transfer foreign arm pose');
  await page.waitForTimeout(500);
  await page.screenshot({path:'/tmp/bf-unit-motion-american-run.png'});
  await page.locator('#motion-standard').click();
  assert.equal(await page.locator('#motion-standard').getAttribute('aria-pressed'),'false');
  await page.screenshot({path:'/tmp/bf-unit-motion-american-native.png'});
  await page.locator('#toggle-controls').click();
  assert.equal(await page.locator('#toggle-controls').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('[data-motion="run"]').isVisible(),false,
   'Animation controls must collapse without hiding characters');
  console.log('BATTLEFIELD_UNIT_MOTION_BROWSER_TEST_PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
