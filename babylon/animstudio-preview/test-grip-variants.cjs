const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const dir='babylon/animstudio-preview/grip-qa';
  fs.mkdirSync(dir,{recursive:true});
  for(const style of ['neutral','classic','firm','reverse','axisX']){
    const page=await browser.newPage({viewport:{width:1200,height:880}});
    await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html?gripDebug='+style,
      {waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__BATTLEFIELD_ANIMATIONS__?.ready===true,null,{timeout:95000});
    if(!await page.evaluate(()=>window.__BATTLEFIELD_ANIMATIONS__.loaded))
      throw Error('Loading '+style+' failed');
    for(const gun of ['Kar98k','MP40','MG42']){
      await page.evaluate(async g=>window.__BATTLEFIELD_ANIMATIONS__.show(g,'Aim'),gun);
      await page.waitForTimeout(150);
      await page.click('#handsmode');
      await page.waitForTimeout(150);
      await page.screenshot({path:dir+'/'+gun+'-'+style+'.png'});
      const d=await page.evaluate(()=>{
        const s=window.__BATTLEFIELD_ANIMATIONS__;return {gun:s.weapon,
          rightGrip:s.weaponRig.rightGripMeters,leftGrip:s.weaponRig.leftGripMeters,
          leftElbow:s.weaponRig.leftElbowDegrees,rightElbow:s.weaponRig.rightElbowDegrees,
          forearmRoll:s.weaponRig.rightForearmTwistDegrees,
          wrists:[s.weaponRig.rightWristDegrees,s.weaponRig.leftWristDegrees]};});
      console.log('FINGER_PRESET',JSON.stringify({style,...d}));
      await page.click('#handsmode');
    }
    await page.close();
  }
  console.log('ALL_FIVE_FINGER_PRESETS_RECORDED');
 }catch(e){console.error('FINGER_PRESET_ERROR',e);process.exitCode=1}
 finally{await browser?.close()}
})();