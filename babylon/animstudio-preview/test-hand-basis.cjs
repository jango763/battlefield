const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const dir='babylon/animstudio-preview/wrist-basis-qa';
  fs.mkdirSync(dir,{recursive:true});
  for(const mode of ['legacy','anatomy']){
    const page=await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html'+
      (mode==='anatomy'?'?handBasis=anatomy':''),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__BATTLEFIELD_ANIMATIONS__?.ready===true,null,{timeout:95000});
    const loaded=await page.evaluate(()=>window.__BATTLEFIELD_ANIMATIONS__.loaded);
    if(!loaded)throw Error(mode+' loaded=false: '+errors.join(';'));
    for(const gun of ['Kar98k','MP40','MG42','Panzerschreck']){
      for(const pose of ['Aim','Run']){
        await page.evaluate(async ([g,p])=>window.__BATTLEFIELD_ANIMATIONS__.show(g,p),[gun,pose]);
        await page.waitForTimeout(220);
        const r=await page.evaluate(()=>{
          const s=window.__BATTLEFIELD_ANIMATIONS__,w=s.weaponRig;
          return {pose:s.pose,gun:s.weapon,calibrated:w.anatomicalHandCalibration,
            gripRight:w.rightGripMeters,gripLeft:w.leftGripMeters,
            fingerErrorRight:w.rightFingerDirectionErrorDegrees,
            fingerErrorLeft:w.leftFingerDirectionErrorDegrees,
            elbowRight:w.rightElbowDegrees,elbowLeft:w.leftElbowDegrees,
            wristRight:w.rightWristDegrees,wristLeft:w.leftWristDegrees,error:w.error};
        });
        console.log('ANATOMICAL_WRIST_AB '+JSON.stringify({mode,...r}));
        if(r.error||!Number.isFinite(r.gripRight)||!Number.isFinite(r.gripLeft))
          throw Error('Rig runtime error '+JSON.stringify(r));
        await page.click('#handsmode');
        await page.waitForTimeout(120);
        await page.screenshot({path:dir+'/'+mode+'-'+gun+'-'+pose+'.png'});
        await page.click('#handsmode');
      }
    }
    if(errors.length)throw Error(mode+' console '+JSON.stringify(errors));
    await page.close();
  }
  console.log('ANATOMICAL_WRIST_A_B_COMPLETED');
 }catch(e){console.error('ANATOMICAL_WRIST_AB_FAILED',e);process.exitCode=1}
 finally{await browser?.close()}
})();