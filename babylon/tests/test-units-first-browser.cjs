'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,webkit}=require('/tmp/bf-units-first/node_modules/playwright');
const DIR='babylon-qa-results/units-first';
fs.mkdirSync(DIR,{recursive:true});
async function check(engine,name){
 const browser=await engine.launch({headless:true,...(name==='chromium'
 ?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,
  hasTouch:true,deviceScaleFactor:1});
 const failures=[];page.on('pageerror',e=>failures.push(e.message));
 const report={browser:name,success:false,actors:{}};
 try{
  await page.goto('http://127.0.0.1:8858/babylon/units-first.html',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>{
   const s=window.__BF_UNIT_REVIEW__;
   return (s?.ready&&s.selected==='german')||!!s?.error;
  },null,{timeout:150000});
  for(const id of ['german','american','jakeli']){
   if(id!=='german')await page.locator('[data-unit="'+id+'"]').click();
   await page.waitForFunction(id=>{
    const s=window.__BF_UNIT_REVIEW__;
    return (s?.selected===id&&!!s?.characters[id]?.activeClip)||!!s?.error;
   },id,{timeout:160000});
   const snapshot=await page.evaluate(id=>{
    const s=window.__BF_UNIT_REVIEW__;
    const c=s.characters[id],B=window.BABYLON,
      scene=B.EngineStore.LastCreatedScene;
    const root=scene.getTransformNodeByName('original-unit-'+id);
    return {error:s.error,selected:s.selected,source:c?.source,
     bones:c?.bones,skin:c?.skinned,triangles:c?.triangles,
     clip:c?.activeClip,real:s.realModels[id],fallback:c?.hasFallback,
     approval:c?.approved,otherVisible:Object.keys(s.characters)
      .filter(k=>k!==id&&scene.getTransformNodeByName('original-unit-'+k)?.isEnabled()),
     rootEnabled:!!root?.isEnabled(),cameraRadius:scene.activeCamera?.radius};
   },id);
   report.actors[id]=snapshot;
   assert(!snapshot.error,'Original character did not load: '+snapshot.error);
   assert.equal(snapshot.bones,id==='german'?68:65);
   assert(snapshot.source.endsWith(id==='german'?'all-combat-run.glb':id==='american'?'us-hero-quaternius-donor-hands-v7.glb':'uk-jakeli-battle-lod1.glb'));
   assert(snapshot.skin>=2,'Static non-skinned character in '+id);
   assert(snapshot.triangles>9000,'Low-quality primitive substituted '+id);
   assert(snapshot.real&&!snapshot.fallback&&snapshot.rootEnabled);
   assert.equal(snapshot.otherVisible.length,0,'Previous models overlap '+id);
   assert.equal(snapshot.approval,id==='german',
    'Experimental UK/US model incorrectly marked final');
   await page.waitForTimeout(450);
   await page.screenshot({path:DIR+'/'+name+'-'+id+'-idle.png'});
   await page.locator('[data-motion="walk"]').click();
   await page.waitForTimeout(380);
   const walk=await page.evaluate(()=>window.__BF_UNIT_REVIEW__.characters[
    window.__BF_UNIT_REVIEW__.selected].activeClip);
   assert(walk&&/run|walk/i.test(walk),'Native walk/run clip missing '+id);
   await page.screenshot({path:DIR+'/'+name+'-'+id+'-walk.png'});
   if(id==='jakeli'){
    await page.locator('[data-motion="aim"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({path:DIR+'/'+name+'-'+id+'-aim.png'});
    const result=await page.evaluate(()=>{
     const B=window.BABYLON;
     const cam=B.EngineStore.LastCreatedScene.activeCamera;
     cam.alpha=Math.PI;cam.radius=2.15;
     return window.__BF_UNIT_REVIEW__.characters.jakeli.activeClip;
    });
    assert.equal(result,'Aim');
    await page.waitForTimeout(320);
    await page.screenshot({path:DIR+'/'+name+'-'+id+'-hands-side.png'});
   }
  }
  assert.equal(failures.length,0,'JS page errors '+failures.join('; '));
  report.success=true;
 }catch(e){report.error=String(e.stack||e);report.pageErrors=failures;
  await page.screenshot({path:DIR+'/'+name+'-FAILED.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{
  console.log('BATTLEFIELD_UNITS_FIRST_BROWSER',JSON.stringify(report).slice(0,19000));
  await page.close();await browser.close();
 }
 return report;
}
(async()=>{
 const reports=[await check(chromium,'chromium'),await check(webkit,'webkit')];
 fs.writeFileSync(DIR+'/report.json',JSON.stringify(reports,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
