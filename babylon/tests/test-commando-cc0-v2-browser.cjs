'use strict';
/* Genuine WW2 65-bone Commando: real mesh + old Quaternius browser proof.
 * Geometric CI remains separate; this verifies iPhone-like loading and UI.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('/tmp/commando-cc0-qa/node_modules/playwright');
const out='babylon-qa-results/commando-cc0-v2-browser';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const result=[];
 for(const [name,browserType] of Object.entries({chromium,webkit})){
  const browser=await browserType.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const report={name,poses:[],success:false};
  try{
   await page.goto('http://127.0.0.1:8844/babylon/commando-real-v2-iphone.html',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__COMMANDO_REAL_V2_QA__?.ready,null,{timeout:90000});
   const state=await page.evaluate(()=>{
    const s=window.__COMMANDO_REAL_V2_QA__,scene=window.__COMMANDO_REAL_V2__?.scene;
    return {error:s.error,loaded:s.loaded,bones:s.bones,skins:scene?.skeletons.length,
      meshes:s.skinned,clips:s.animations,body:scene?.meshes.some(m=>/Soldier/i.test(m.name)),
      viewport:document.getElementById('controls').getBoundingClientRect().height,
      controlsOpen:document.getElementById('controls').open};
   });
   assert.equal(state.error,null,JSON.stringify(state));
   assert(state.loaded);
   assert.equal(state.bones,65);
   assert.equal(state.skins,1);
   assert(state.meshes>=3);
   assert(state.body,'No genuine source human mesh visible');
   assert.equal(state.controlsOpen,false);
   assert(state.viewport<62,'mobile menu obscures the soldier');
   for(const pose of ['Ready','Aim','Fire','Walk','Jog','Sprint']){
    await page.locator('#controls summary').click();
    await page.locator('[data-pose="'+pose+'"]').click();
    await page.waitForTimeout(300);
    const snap=await page.evaluate(()=>{
     const s=window.__COMMANDO_REAL_V2_QA__,scene=window.__COMMANDO_REAL_V2__.scene;
     return {pose:s.pose,playing:scene.animationGroups.filter(g=>g.isPlaying).map(g=>g.name),
       skeletons:scene.skeletons.length,panelOpen:document.getElementById('controls').open};
    });
    assert.equal(snap.pose,pose);
    assert.deepEqual(snap.playing,[pose],JSON.stringify(snap));
    assert.equal(snap.skeletons,1);
    assert.equal(snap.panelOpen,false);
    report.poses.push(snap);
    await page.screenshot({path:out+'/'+name+'-'+pose+'.png'});
   }
   await page.locator('#controls summary').click();
   await page.locator('[data-view="hands"]').click();
   await page.screenshot({path:out+'/'+name+'-hands.png'});
   assert.deepEqual(errors,[]);
   report.success=true;
  }catch(e){
   report.error=String(e.stack||e);report.pageErrors=errors;
   await page.screenshot({path:out+'/'+name+'-failure.png'}).catch(()=>{});
   process.exitCode=1;
  }finally{
   result.push(report);
   await browser.close();
  }
 }
 fs.writeFileSync(out+'/report.json',JSON.stringify(result,null,2));
 console.log('COMMANDO_CC0_MOBILE_BROWSER_REPORT',JSON.stringify(result.map(r=>({name:r.name,success:r.success,poses:r.poses.length,error:r.error||null}))));
})().catch(e=>{console.error(e);process.exitCode=1});
