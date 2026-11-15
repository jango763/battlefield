const { chromium } = require('/tmp/babylon-qa/node_modules/playwright');
const fs = require('node:fs');
(async () => {
 let browser;
 try {
  browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
  for (const o of [
    {name:'desktop',w:1280,h:860,mobile:false},
    {name:'iphone',w:390,h:844,mobile:true}
  ]) {
   const page = await browser.newPage({viewport:{width:o.w,height:o.h},isMobile:o.mobile,hasTouch:o.mobile,deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,240))});
   await page.goto('http://127.0.0.1:8758/babylon/index.html',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__BABYLON_SOLDIER__?.ready===true,null,{timeout:90000});
   const s=await page.evaluate(()=>window.__BABYLON_SOLDIER__);
   console.log('BABYLON_ORIGINAL_SOLDIER_'+o.name+' '+JSON.stringify({state:s,errors}));
   if(s.error || !s.loaded || s.skinnedMeshes<4 || s.skeletonBones<60 || s.materialCount<4 || errors.length) {
     throw new Error('Babylon verification failed '+JSON.stringify({state:s,errors}));
   }
   fs.mkdirSync('babylon-qa-results',{recursive:true});
   await page.waitForTimeout(650);
   await page.screenshot({path:'babylon-qa-results/babylon-soldier-'+o.name+'.png'});
   await page.close();
  }
  console.log('BABYLON_ORIGINAL_SOLDIER_TESTS_PASSED');
 } catch(e) {console.error(e);process.exitCode=1}
 finally{await browser?.close()}
})();
