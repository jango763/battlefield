const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs');
const expected={
 rightPitch:-80,rightYaw:-80,rightRoll:120,rightOffsetX:-.05,rightOffsetY:-.025,rightOffsetZ:0,
 leftPitch:10,leftYaw:-69,leftRoll:120,leftOffsetX:.075,leftOffsetY:-.075,leftOffsetZ:.38,
 rightThumbCurl:1,rightThumbSpread:-34,rightIndexCurl:.75,rightIndexSpread:-11,
 rightMiddleCurl:2.25,rightMiddleSpread:0,rightRingCurl:1.55,rightRingSpread:0,
 rightPinkyCurl:1.55,rightPinkySpread:0,leftThumbCurl:.15,leftThumbSpread:5,
 leftIndexCurl:2.6,leftIndexSpread:43,leftMiddleCurl:1.55,leftMiddleSpread:0,
 leftRingCurl:1.55,leftRingSpread:0,leftPinkyCurl:1.55,leftPinkySpread:0
};
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox',
   '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const dir='babylon/animstudio-preview/user-grip-qa';fs.mkdirSync(dir,{recursive:true});
  for(const device of [{name:'desktop',width:1280,height:800,isMobile:false},
                      {name:'phone',width:390,height:844,isMobile:true}]){
   const page=await browser.newPage({viewport:{width:device.width,height:device.height},
      isMobile:device.isMobile,hasTouch:device.isMobile,deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
   await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html?gripStudio=1&gripPreset=user',
     {waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__BATTLEFIELD_GRIP_STUDIO__?.ready===true,null,{timeout:100000});
   await page.waitForFunction(()=>window.__BATTLEFIELD_GRIP_STUDIO__?.read().rightPitch===-80 &&
     window.__BATTLEFIELD_GRIP_STUDIO__?.read().leftOffsetZ===.38,null,{timeout:15000});
   const result=await page.evaluate(()=>({
     profile:window.__BATTLEFIELD_GRIP_STUDIO__.read(),
     weapon:window.__BATTLEFIELD_ANIMATIONS__.weapon,
     presetCount:Object.keys(window.__BATTLEFIELD_GRIP_STUDIO__.read()).length,
     pinned:window.__BATTLEFIELD_ANIMATIONS__.weaponRig.stockOnRightShoulder,
     gripL:window.__BATTLEFIELD_ANIMATIONS__.weaponRig.leftGripMeters,
     gripR:window.__BATTLEFIELD_ANIMATIONS__.weaponRig.rightGripMeters
   }));
   if(result.weapon!=='Kar98k'||result.presetCount!==32||!result.pinned)
     throw Error(device.name+' boot/stock '+JSON.stringify(result));
   const diffs=Object.entries(expected).filter(([k,v])=>Math.abs(result.profile[k]-v)>1e-9);
   if(diffs.length)throw Error(device.name+' lost keys '+JSON.stringify(diffs));
   if(errors.length)throw Error(device.name+' browser errors '+JSON.stringify(errors));
   await page.screenshot({path:dir+'/'+device.name+'-preset.png'});
   const independent=await page.evaluate(()=>{
     const e=window.__BATTLEFIELD_GRIP_STUDIO__;
     e.update({leftIndexSpread:27});
     const modified=e.read();
     e.update({rightThumbCurl:.66});
     const both=e.read();
     return {modified,both};
   });
   if(independent.both.leftIndexSpread!==27 || independent.both.rightThumbCurl!==.66
    || independent.both.rightMiddleCurl!==expected.rightMiddleCurl)
     throw Error(device.name+' independence regression');
   // Saved preset remains reusable without reloading the page.
   await page.locator('#master-user-preset').click();
   await page.waitForFunction(()=>window.__BATTLEFIELD_GRIP_STUDIO__.read().leftIndexSpread===43,
     null,{timeout:15000});
   const restored=await page.evaluate(()=>window.__BATTLEFIELD_GRIP_STUDIO__.read());
   if(Object.entries(expected).some(([k,v])=>Math.abs(restored[k]-v)>1e-9))
     throw Error(device.name+' reload differs from original profile');
   console.log('KAR98K_USER_V2_PRESET_PASSED '+JSON.stringify({
     env:device.name,parameterCount:result.presetCount,pinned:result.pinned,
     gripLeftMeters:result.gripL,gripRightMeters:result.gripR,errors}));
   await page.close();
  }
  console.log('ALL_32_KAR98K_PROFILE_FIELDS_MATCH_USER_JSON');
 }catch(e){console.error('KAR98K_USER_PRESET_FAILED',e);process.exitCode=1}
 finally{await browser?.close()}
})();