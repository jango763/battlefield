const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const out='babylon/animstudio-preview/kar98k-stock-qa';
  fs.mkdirSync(out,{recursive:true});
  for(const device of [
    {name:'desktop',viewport:{width:1300,height:900},mobile:false},
    {name:'iphone',viewport:{width:390,height:844},mobile:true}
  ]){
    const page=await browser.newPage({viewport:device.viewport,
      isMobile:device.mobile,hasTouch:device.mobile,deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
    await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__BATTLEFIELD_ANIMATIONS__?.ready===true,null,{timeout:95000});
    if(!await page.evaluate(()=>window.__BATTLEFIELD_ANIMATIONS__.loaded))
      throw Error('Could not load '+device.name+errors.join(','));
    for(const pose of ['Hold','Aim','Fire','Run']){
      await page.evaluate(p=>window.__BATTLEFIELD_ANIMATIONS__.show('Kar98k',p),pose);
      await page.waitForTimeout(350);
      const measured=await page.evaluate(()=>{
        const s=window.__BATTLEFIELD_ANIMATIONS__,r=s.weaponRig;
        return {weapon:s.weapon,pose:s.pose,clip:s.clip,
          contact:r.stockToSocketMeters,shoulder:r.stockRightShoulderMeters,
          butt:r.stockWorldPosition,socket:r.stockSocketWorldPosition,
          pinned:r.stockOnRightShoulder,correction:r.weaponReachCorrectionMeters,
          leftGrip:r.leftGripMeters,rightGrip:r.rightGripMeters,
          elbows:[r.leftElbowDegrees,r.rightElbowDegrees],
          error:r.error};
      });
      console.log('KAR98K_BUTTPLATE '+JSON.stringify({device:device.name,...measured}));
      if(measured.error||measured.weapon!=='Kar98k'||!measured.pinned||
         measured.correction>.00001||measured.contact>.008||measured.shoulder>.12)
        throw Error('KAR98K_STOCK_DETACHED '+JSON.stringify(measured));
      if(!Number.isFinite(measured.leftGrip)||!Number.isFinite(measured.rightGrip))
        throw Error('Invalid wrists: '+JSON.stringify(measured));
      if(measured.elbows[0]<20||measured.elbows[1]<20||
        measured.leftGrip>.075||measured.rightGrip>.075)
        throw Error('KAR98K_HANDS_WRONG_POSE '+JSON.stringify(measured));
      // Show full body from right side and directly behind the butt.
      await page.evaluate(()=>{
        const s=window.__BATTLEFIELD_ANIMATIONS__;
        document.body.classList.add('full-body');
        const camera=s.scene.activeCamera;
        camera.setTarget(new BABYLON.Vector3(0,.95,0));
        camera.alpha=Math.PI;camera.beta=Math.PI*.48;camera.radius=2.15;
      });
      await page.waitForTimeout(100);
      await page.screenshot({path:path.join(out,device.name+'-'+pose+'-full-right.png')});
      await page.evaluate(()=>{
        const s=window.__BATTLEFIELD_ANIMATIONS__;
        const c=s.scene.activeCamera;
        c.setTarget(new BABYLON.Vector3(...s.weaponRig.stockSocketWorldPosition));
        c.alpha=Math.PI;c.beta=Math.PI*.44;c.radius=1.28;
      });
      await page.waitForTimeout(100);
      await page.screenshot({path:path.join(out,device.name+'-'+pose+'-stock-close.png')});
    }
    if(errors.length)throw Error('Browser '+device.name+' errors '+JSON.stringify(errors));
    console.log('KAR98K_SHOULDER_FOUR_POSES_PASS '+device.name);
    await page.close();
  }
  console.log('KAR98K_RIGHT_SHOULDER_ALL_POSES_PASS');
 }catch(e){console.error('KAR98K_RIGHT_SHOULDER_QA_FAILED',e);process.exitCode=1}
 finally{await browser?.close()}
})();