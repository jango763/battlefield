const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
(async()=>{
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
    const page=await browser.newPage({viewport:{width:1100,height:700}});
    page.on('pageerror',e=>console.error('PAGE_ERROR',String(e)));
    await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__BATTLEFIELD_ANIMATIONS__?.loaded===true,null,{timeout:90000});
    for(const pose of ['Run','Aim']){
      await page.evaluate(async p=>window.__BATTLEFIELD_ANIMATIONS__.show('Panzerschreck',p),pose);
      await page.waitForTimeout(300);
      for(const phase of [0,8,16]){
        const m=await page.evaluate(k=>{
          const s=window.__BATTLEFIELD_ANIMATIONS__,c=s.scene.animationGroups.find(x=>x.name===s.clip);
          c.pause();c.goToFrame(c.from+(c.to-c.from)*k/20);
          s.scene.render();
          const r=s.weaponRig;
          return {pose:s.pose,reach:r.leftReachMeters,distance:r.leftGoalFromShoulderMeters,
            ratio: r.leftGoalFromShoulderMeters / r.leftReachMeters,
            elbow:r.leftElbowDegrees,grip:r.leftGripMeters,
            rElbow:r.rightElbowDegrees,rGrip:r.rightGripMeters,
            rWrist:r.rightWristDegrees,lWrist:r.leftWristDegrees,
            rocketShift:r.rocketRepositionMeters,
            originalRatio:r.rocketOriginalReachRatio,geomPass:r.geometricPass};
        },phase);
        console.log('ROCKET_DIAG '+JSON.stringify({phase,...m}));
      }
    }
    await page.close();
  }catch(e){console.error('ROCKET_DIAG_FAILED',e);process.exitCode=1}
  finally{await browser?.close()}
})();