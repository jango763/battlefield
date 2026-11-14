'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('/tmp/r187-lab-qa/node_modules/playwright');

(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox'
 ]});
 try{
  for(const config of [
   {name:'desktop',viewport:{width:1280,height:810}},
   {name:'mobile-chromium',viewport:{width:390,height:844},userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
  ]){
   const page=await browser.newPage({viewport:config.viewport,
     ...(config.userAgent?{userAgent:config.userAgent}:{})});
   const errors=[],responses=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('console',message=>{
     if(message.type()==='error')errors.push('console: '+message.text());
   });
   page.on('response',response=>{
     if(response.status()>=400)responses.push(response.status()+' '+response.url());
   });
   await page.goto('http://127.0.0.1:8777/lab/one-rig/index.html',
     {waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>window.__rigLab?.ready||window.__rigLab?.error,
     null,{timeout:150000});
   const startup=await page.evaluate(()=>({
    error:window.__rigLab.error,
    ready:window.__rigLab.ready,
    report:window.__rigLab.stats,
    canvas:!!document.querySelector('#viewport canvas'),
    busy:!document.querySelector('#busy').hidden
   }));
   assert(!startup.error,'r187 lab load error: '+startup.error);
   assert(startup.ready,'r187 lab not ready');
   assert(startup.canvas&&!startup.busy,'canvas missing or loading shade not removed');
   assert.equal(startup.report?.revision,'187','wrong version');
   assert.equal(startup.report?.people,2,'comparison must display two characters');
   assert(startup.report?.single?.sourceBones>50,'native skeleton not loaded');
   const one=await page.evaluate(()=>{
     const p=window.__rigLab.panels?.[0];
     if(!p)return {error:'missing one-rig panel'};
     const source=new Set(p.anatomy.values());
     return {
       mode:p.mode,hasDonor:!!p.costume,stats:p.oneRigDetails,
       nativeSkins:p.native?.children?.length,
       visibleNative:p.native?.getObjectByProperty('isSkinnedMesh',true)?.visible,
       clothingMeshes:p.skinMeshes.length,
       sameSkeleton:p.skinMeshes.length>0 && p.skinMeshes.every(m=>
         m.isSkinnedMesh && m.skeleton===p.oneRigRig &&
         m.skeleton.bones.every(b=>source.has(b))),
       weaponReady:!!p.weapon
     };
   });
   assert(!one.error,'one-rig panel missing: '+one.error);
   assert(!one.hasDonor,'Mixamo donor rig still drives clothes');
   assert(one.sameSkeleton,'costume must be bound to one original WW2 armature');
   assert.equal(one.clothingMeshes,2,'missing visible Panzergrenadier skinned meshes');
   assert(one.stats?.remappedBoneEntries>=35,'too few native bone remappings');
   assert(one.weaponReady,'weapon did not load on one-rig character');
   console.log('ONE_RIG_STRUCTURE_PASS',config.name,JSON.stringify(one));
   assert(startup.report?.dual?.donorBones>50,'two-rig control model not loaded');
   assert.equal(startup.report?.single?.donorBones,0,'one-rig must contain zero donor bones');
   assert(startup.report?.dual?.matchedBones>=35,'retarget mapping missing');
   assert(startup.report?.dual?.left?.sampledVisibleVertices>30,
    'not measuring actual skinned left glove vertices');
   assert(startup.report?.dual?.right?.sampledVisibleVertices>30,
    'not measuring actual skinned right glove vertices');
   // Initial metrics may be sampled before the first IK pose; inspect a settled frame.
   await page.waitForTimeout(1200);
   const settled=await page.evaluate(()=>window.__rigLab.stats);
   console.log('R187 LAB SETTLED IDLE',config.name,JSON.stringify(settled));
   assert(Number.isFinite(settled?.dual?.left?.closestVertexToGrip));
   assert(Number.isFinite(settled?.dual?.right?.closestVertexToGrip));
   console.log('R187 LAB STARTUP PASS',config.name,JSON.stringify(settled));
   await page.screenshot({path:'/tmp/r187-lab-'+config.name+'-blue-idle.png'});
   if(config.name==='desktop')await page.screenshot({path:'/tmp/one-rig-visual.jpg',type:'jpeg',quality:32});
   await page.locator('#focusDual').click();
   await page.waitForTimeout(160);
   await page.screenshot({path:'/tmp/r187-lab-'+config.name+'-glove-closeup.png'});
   await page.locator('#focusSingle').click();
   await page.waitForTimeout(160);
   await page.screenshot({path:'/tmp/r187-lab-'+config.name+'-native-closeup.png'});
   await page.locator('#resetCam').click();
   const checks=[
     {side:'blue',weapon:'smg',animation:'jog',retarget:'project',snap:'blue-jog'},
     {side:'blue',weapon:'rifle',animation:'idle',retarget:'rotation',snap:'blue-rifle-rotation'},
     {side:'blue',weapon:'rifle',animation:'idle',retarget:'project',snap:'blue-rifle-project'},
     {side:'red',weapon:'smg',animation:'idle',retarget:'project',snap:'red-idle'},
     {side:'red',weapon:'mg',animation:'sprint',retarget:'rotation',snap:'red-mg-rotation'},
     {side:'red',weapon:'mg',animation:'sprint',retarget:'project',snap:'red-mg-project'}
   ];
   for(const x of checks){
     await page.evaluate(async x=>window.__rigLab.setState(x),x);
     await page.waitForTimeout(700);
     const stat=await page.evaluate(()=>window.__rigLab.stats);
     assert(!stat?.error,'scene error '+JSON.stringify(x));
     assert.equal(stat.faction,x.side);
     assert.equal(stat.weapon,x.weapon);
     assert.equal(stat.animation,x.animation);
     assert.equal(stat.retarget,x.retarget);
     assert(stat.loadedWeapon?.startsWith(x.side==='blue'?'uk-':'de-'),
       'wrong weapon '+JSON.stringify(stat));
     assert(Number.isFinite(stat.dual.left.surfaceToGrip),
       'left glove surface missing '+JSON.stringify(stat));
     assert(Number.isFinite(stat.dual.right.surfaceToGrip),
       'right glove surface missing '+JSON.stringify(stat));
     // A passing loader is not a passing grip: validate visible skinned mesh surface.
     if(x.retarget==='project'){
       for(const hand of ['left','right']){
         const distance=stat.dual[hand].closestVertexToGrip;
         assert(Number.isFinite(distance)&&distance<0.25,
           'visible '+hand+' hand misses '+x.snap+' grip by '+distance+' scene units');
       }
     }
     await page.screenshot({path:'/tmp/r187-lab-'+config.name+'-'+x.snap+'.png'});
     assert(stat.single.left.sampledVisibleVertices>30 && stat.single.right.sampledVisibleVertices>30,
       'one-rig hand geometry has no weighted skin vertices');
     for(const side of ['left','right']){
       assert(Number.isFinite(stat.single[side].closestVertexToGrip),
         'one-rig hand mesh is missing or collapsed '+x.snap+' '+side);
     }
     console.log('ONE_RIG_VARIANT_REPORT',config.name,x.snap,
       JSON.stringify({left:stat.single.left,right:stat.single.right}));
     if(x.retarget==='project'){
       for(const hand of ['left','right']){
         const distance=stat.single[hand].closestVertexToGrip;
         assert(distance<0.25,'ONE RIG glove not close to '+x.snap+' '+hand+
           ': '+distance+' (requires rig/rest-pose correction)');
       }
     }
     console.log('R187 LAB VARIANT PASS',config.name,x.snap,
       JSON.stringify({weapon:stat.loadedWeapon,
       left:stat.dual.left,right:stat.dual.right}));
   }
   assert.equal(responses.length,0,'HTTP request errors: '+responses.join('; '));
   assert.equal(errors.length,0,'page errors: '+errors.join('; '));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
