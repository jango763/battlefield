'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('/tmp/jakeli-arsenal-qa/node_modules/playwright');
const out='babylon-qa-results/jakeli-arsenal';fs.mkdirSync(out,{recursive:true});
const ids=['uk-lee-enfield','uk-sten','uk-bren','uk-piat'];
(async()=>{
 const reports=[];
 for(const [browserName,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true,...(browserName==='chromium'?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const report={browser:browserName,weapons:[],success:false};
  try {
   await page.goto('http://127.0.0.1:8822/babylon/jakeli-arsenal-iphone.html',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__JAKELI_ARSENAL_QA__?.ready,null,{timeout:90000});
   assert.equal(await page.locator('#controls').evaluate(el=>el.open),false,'Controls must start closed');
   const dimensions=await page.locator('#controls').boundingBox();
   assert(dimensions.height<60,'iPhone control panel must not cover model');
   for(const id of ids){
    await page.locator('#controls summary').click();
    await page.locator('[data-weapon="'+id+'"]').click();
    await page.waitForFunction(w=>{const s=window.__JAKELI_ARSENAL_QA__;return s&&s.weapon===w&&!s.busy&&s.ready},id,{timeout:90000});
    if(id==='uk-piat'){
     const detailed=await page.evaluate(()=>{
      const meshes=window.__JAKELI_ARSENAL__.scene.meshes;
      return meshes.filter(m=>m.name.startsWith('PIAT')&&m.isEnabled()&&(m.getTotalVertices?.()||0)>0).length;
     });
     assert(detailed>=20,'Expected original detailed PIAT procedural model, not primitive proxy: '+detailed);
    }
    const poses=browserName==='chromium'?['Ready','Aim','Fire','Walk','Jog','Sprint']:['Ready','Aim','Walk','Sprint'];
    for(const pose of poses){
     await page.locator('#controls summary').click();
     await page.locator('[data-pose="'+pose+'"]').click();
     await page.waitForTimeout(230);
     const state=await page.evaluate(()=>{
      const s=window.__JAKELI_ARSENAL_QA__,scene=window.__JAKELI_ARSENAL__?.scene;
      return {weapon:s.weapon,pose:s.pose,error:s.error,bones:s.skeletonBones,
       skinned:s.skinnedMeshes,weaponMeshes:s.weaponMeshes,
       clips:s.animationNames,sceneSkeletons:scene?.skeletons.length,
       active:scene?.animationGroups.filter(g=>g.isPlaying).map(g=>g.name),
       panelOpen:document.getElementById('controls').open,
       modelCount:scene?.meshes.filter(m=>m.skeleton).length};
     });
     assert.equal(state.error,null,JSON.stringify(state));
     assert.equal(state.weapon,id);
     assert.equal(state.pose,pose);
     assert.equal(state.bones,65);
     assert.equal(state.skinned,13);
     assert(state.weaponMeshes>=1);
     assert.equal(state.sceneSkeletons,1,'Duplicate skeleton after weapon swap');
     assert.equal(state.modelCount,13,'Old skinned mesh leaked in scene');
     assert.deepEqual(state.active,[pose],JSON.stringify(state));
     assert.equal(state.panelOpen,false,'Interface still covers the character');
     await page.screenshot({path:`${out}/${browserName}-${id}-${pose}.png`});
     report.weapons.push({weapon:id,pose,weaponMeshes:state.weaponMeshes});
    }
   }
   assert.deepEqual(errors,[],'Uncaught script errors');
   report.success=true;
  } catch(e){
   report.error=String(e.stack||e);report.pageErrors=errors;
   await page.screenshot({path:`${out}/${browserName}-FAILED.png`}).catch(()=>{});
   process.exitCode=1;
  } finally {reports.push(report);await browser.close();}
 }
 fs.writeFileSync(out+'/report.json',JSON.stringify(reports,null,2));
 console.log('JAKELI_ARSENAL_BROWSER_REPORT',JSON.stringify(reports.map(r=>({
  browser:r.browser,success:r.success,checks:r.weapons.length,error:r.error||null
 }))));
})().catch(e=>{console.error(e);process.exitCode=1});