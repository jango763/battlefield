'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('/tmp/r187-lab-qa/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--disable-dev-shm-usage'
 ]});
 try{
  for(const viewport of [
    {name:'desktop',size:{width:1360,height:900}},
    {name:'mobile-chromium',size:{width:390,height:844}}
  ]){
   const page=await browser.newPage({viewport:viewport.size});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',msg=>{
    if(msg.type()==='error')console.log('CONSOLE ERROR',viewport.name,msg.text().slice(0,300));
   });
   const response=await page.goto('http://127.0.0.1:8777/lab/three-r187/index.html',
     {waitUntil:'domcontentloaded',timeout:45000});
   assert.equal(response.status(),200);
   await page.waitForFunction(()=>window.__rigLab?.ready||window.__rigLab?.error,
     null,{timeout:120000});
   let data=await page.evaluate(()=>({
      ready:window.__rigLab.ready,
      error:window.__rigLab.error,
      report:window.__rigLab.getReport?.(),
      canvas:document.querySelectorAll('#viewport canvas').length
   }));
   if(data.error)throw Error('r187 startup failed: '+data.error);
   assert(data.ready,'r187 models did not initialize');
   assert(data.canvas>=1,'r187 viewport never rendered');
   assert.equal(data.report.revision,'187','wrong Three.js build');
   assert.equal(data.report.webgl2,true,'WebGL2 not available');
   assert.equal(data.report.people,2);
   assert(data.report.dual.sourceBones>=60,'missing Quaternius skeleton');
   assert(data.report.dual.donorBones>=50,'missing actual WW2 Mixamo skeleton');
   assert(data.report.dual.matchedBones>=48,'bind-name map incomplete');
   assert(data.report.single.sourceBones>=60,'baseline source skeleton missing');
   for(const side of ['left','right']){
     const one=data.report.single[side],two=data.report.dual[side];
     for(const item of [one,two]){
       assert(item.sampledVisibleVertices>100,'empty skinned glove sample '+side);
       assert(Number.isFinite(item.wristToGrip)&&Number.isFinite(item.surfaceToGrip),
         'non-finite geometric contact');
     }
   }
   console.log('R187_STARTUP_PASS',viewport.name,JSON.stringify(data.report));
   await page.screenshot({path:'/tmp/r187-'+viewport.name+'-uk-idle.png'});
   await page.evaluate(()=>window.__rigLab.setState({side:'red',weapon:'smg',animation:'jog'}));
   await page.waitForTimeout(800);
   data=await page.evaluate(()=>window.__rigLab.getReport());
   assert.equal(data.loadedWeapon,'de-mp40');
   assert.equal(data.faction,'red');
   assert.equal(data.animation,'jog');
   console.log('R187_GERMAN_JOG_PASS',viewport.name,JSON.stringify(data.dual));
   await page.screenshot({path:'/tmp/r187-'+viewport.name+'-de-jog.png'});
   await page.evaluate(()=>window.__rigLab.setState({side:'blue',weapon:'rifle',animation:'idle',retarget:'rotation'}));
   await page.waitForTimeout(800);
   data=await page.evaluate(()=>window.__rigLab.getReport());
   assert.equal(data.loadedWeapon,'uk-lee-enfield','UK rifle GLB did not load');
   assert.equal(data.retarget,'rotation');
   console.log('R187_UK_RIFLE_PASS',viewport.name,JSON.stringify(data.dual));
   await page.screenshot({path:'/tmp/r187-'+viewport.name+'-uk-rifle.png'});
   assert.equal(errors.length,0,'JS runtime failures: '+errors.join('; '));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
