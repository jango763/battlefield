const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 let browser;
 const out='babylon/animstudio-preview/hand-qa';fs.mkdirSync(out,{recursive:true});
 try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const page=await browser.newPage({viewport:{width:1280,height:840},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__BATTLEFIELD_ANIMATIONS__?.ready,true,{timeout:100000});
  if(!await page.evaluate(()=>window.__BATTLEFIELD_ANIMATIONS__.loaded))
    throw Error('Load failed '+JSON.stringify(errors));
  const results=[];
  for(const gun of ['Kar98k','MP40','MG42','Panzerschreck']){
   for(const pose of ['Run','Aim']){
    await page.evaluate(async([gun,pose])=>window.__BATTLEFIELD_ANIMATIONS__.show(gun,pose),[gun,pose]);
    await page.waitForTimeout(220);
    const d=await page.evaluate(()=>{
      const s=window.__BATTLEFIELD_ANIMATIONS__,r=s.weaponRig;
      return {gun:s.weapon,pose:s.pose,right:r.rightGripMeters,left:r.leftGripMeters,
        rightElbow:r.rightElbowDegrees,leftElbow:r.leftElbowDegrees,error:r.error,
        fingers:r.fingerJoints,pass:r.geometricPass};
    });
    results.push(d);console.log('HAND_QUALITY',JSON.stringify(d));
    await page.screenshot({path:out+'/'+gun+'-'+pose+'.png'});
    await page.click('#handsmode');
    await page.waitForTimeout(100);
    await page.screenshot({path:out+'/'+gun+'-'+pose+'-close.png'});
    await page.click('#handsmode');
   }
  }
  const approved=results.filter(x=>x.gun!=='Panzerschreck');
  const bad=approved.filter(x=>x.error||!x.pass||x.rightElbow<20||x.leftElbow<20);
  const provisional=results.filter(x=>x.gun==='Panzerschreck'&&
    (x.error||!x.pass||x.rightElbow<20||x.leftElbow<20));
  if(provisional.length)console.warn('PANZERSCHRECK_PROTOTYPE_NOT_APPROVED '+JSON.stringify(provisional));
  if(bad.length)throw Error('APPROVED_THREE_GUNS_HAND_QUALITY_FAILED '+JSON.stringify(bad));
  if(errors.length)throw Error('Console errors '+JSON.stringify(errors));
  console.log('THREE_APPROVED_WEAPONS_BOTH_HANDS_PASS__PZ_PROTOTYPE_PENDING');
 }catch(e){console.error('HANDS_FAST_QA_FAILED',e);process.exitCode=1}
 finally{await browser?.close()}
})();