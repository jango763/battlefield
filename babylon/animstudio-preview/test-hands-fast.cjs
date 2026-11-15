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
        rightElbow:r.rightElbowDegrees,leftElbow:r.leftElbowDegrees,
        reach:r.leftReachMeters,goal:r.leftGoalFromShoulderMeters,
        wristR:r.rightWristDegrees,wristL:r.leftWristDegrees,
        forward:r.forwardDot,shift:r.weaponReachCorrectionMeters,
        rawReach:r.weaponOriginalReachRatio,solver:r.solver,error:r.error,
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
  // Require the fourth weapon's IK to pass too, while keeping the 3D prop
  // labelled as a provisional artist model.
  const bad=results.filter(x=>x.error||!x.pass||
    x.rightElbow<20||x.leftElbow<20||
    x.goal/x.reach>.95||
    !Number.isFinite(x.forward)||x.forward<.82||
    x.solver!=='analytical-two-bone-with-pole'||
    x.wristR>55.01||x.wristL>55.01);
  if(bad.length)throw Error('FOUR_WEAPONS_ARM_QUALITY_FAILED '+JSON.stringify(bad));
  if(errors.length)throw Error('Console errors '+JSON.stringify(errors));
  console.log('FOUR_WEAPONS_ARM_IK_PASS__PANZERSCHRECK_MODEL_STILL_PROTOTYPE');
 }catch(e){console.error('HANDS_FAST_QA_FAILED',e);process.exitCode=1}
 finally{await browser?.close()}
})();