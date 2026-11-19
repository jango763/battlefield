'use strict';
const {chromium,webkit}=require('/tmp/jakeli-blender-qa/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const dir='babylon-qa-results/jakeli-blender-lee-screen';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const results=[];
 for(const [name,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:8810/babylon/jakeli-blender-lee-iphone.html',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__BABYLON_SOLDIER__?.ready,null,{timeout:90000});
   const state=await page.evaluate(()=>window.__BABYLON_SOLDIER__);
   assert.equal(state.error,null);assert(state.loaded);assert.equal(state.skeletonBones,65);assert.equal(state.skinnedMeshes,13);assert.equal(state.animationCount,6);
   const samples=[];
   for(const pose of ['Ready','Aim','Fire','Walk','Jog','Sprint']){
    await page.locator(`[data-pose="${pose}"]`).click();
    await page.waitForTimeout(400);
    const metric=await page.evaluate(()=>{
     const q=window.__JAKELI_QA__,B=window.BABYLON;
     const p=n=>q.joints[n].getAbsolutePosition();
     return {pose:window.__BABYLON_SOLDIER__.pose,rightLength:B.Vector3.Distance(p('RightArm'),p('RightForeArm'))+B.Vector3.Distance(p('RightForeArm'),p('RightHand')),leftLength:B.Vector3.Distance(p('LeftArm'),p('LeftForeArm'))+B.Vector3.Distance(p('LeftForeArm'),p('LeftHand')),active:q.groups.filter(g=>g.isPlaying).map(g=>g.name)};
    });
    assert.equal(metric.pose,pose);assert.deepEqual(metric.active,[pose]);assert(metric.leftLength>.45&&metric.leftLength<.55);assert(metric.rightLength>.45&&metric.rightLength<.55);samples.push(metric);
    // Keep the actual on-screen controls tested, but remove overlays from
    // evidence captures so faces, rifle and hands remain fully visible.
    if(pose==='Ready')await page.screenshot({path:`${dir}/${name}-Ready-UI.png`});
    await page.evaluate(()=>{for(const id of ['title','controls','status','credit'])document.getElementById(id).style.visibility='hidden'});
    await page.screenshot({path:`${dir}/${name}-${pose}.png`});
    await page.evaluate(()=>{for(const id of ['title','controls','status','credit'])document.getElementById(id).style.visibility=''});
   }
   await page.locator('[data-pose="Aim"]').click();
   for(const v of ['hands','right']){await page.locator(`[data-view="${v}"]`).click();await page.waitForTimeout(300);
    await page.evaluate(()=>{for(const id of ['title','controls','status','credit'])document.getElementById(id).style.visibility='hidden'});
    await page.screenshot({path:`${dir}/${name}-Aim-${v}.png`});
    await page.evaluate(()=>{for(const id of ['title','controls','status','credit'])document.getElementById(id).style.visibility=''});
   }
   assert.deepEqual(errors,[]);results.push({browser:name,status:'pass',samples,realIphoneSafari:false});
  }catch(e){await page.screenshot({path:`${dir}/${name}-FAIL.png`}).catch(()=>{});results.push({browser:name,status:'fail',error:String(e),pageErrors:errors});process.exitCode=1;}
  finally{await browser.close();}
 }
 fs.writeFileSync(`${dir}/browser-report.json`,JSON.stringify(results,null,2));console.log('JAKELI_BROWSER_REPORT',JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1});
