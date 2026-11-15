const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox',
   '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const dir='babylon/animstudio-preview/reload-qa';
  fs.mkdirSync(dir,{recursive:true});
  for(const device of [{name:'desktop',width:1280,height:850,mobile:false},
    {name:'iphone',width:390,height:844,mobile:true}]){
   const page=await browser.newPage({viewport:{width:device.width,height:device.height},
     isMobile:device.mobile,hasTouch:device.mobile,deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
   await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html?combatDemo=1',
     {waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.ready===true,
     null,{timeout:95000});
   for(const weapon of ['MP40','MG42']){
    await page.click(weapon==='MP40'?'#combat-mp':'#combat-mg');
    await page.waitForFunction(w=>window.__BATTLEFIELD_COMBAT_DEMO__?.weapon===w &&
      window.__BATTLEFIELD_ANIMATIONS__?.weapon===w,weapon,{timeout:30000});
    await page.click('#combat-play');
    await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.state?.phase==='runFire',
      null,{timeout:20000});
    const firing=await page.evaluate(()=>{
     const d=window.__BATTLEFIELD_COMBAT_DEMO__,v=window.__BATTLEFIELD_ANIMATIONS__;
     return {phase:d.state.phase,speed:d.state.speed,moving:d.state.moving,
      overlay:v.weaponRig.movingFireOverlay,clip:v.clip,ammo:d.state.ammoRemaining,
      movingShots:d.state.movingShots,root:v.scene.getTransformNodeByName('approved-character-display').position.x};
    });
    if(firing.clip!==weapon+'_Run'||!firing.moving||firing.speed<=.06||!firing.overlay)
     throw Error('RUN_AND_GUN_NOT_RUNNING '+weapon+' '+JSON.stringify(firing));
    await page.screenshot({path:dir+'/'+device.name+'-'+weapon+'-run-fire.png'});
    await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.state?.phase==='reload',
      null,{timeout:30000});
    const firstReload=await page.evaluate(()=>{
     const d=window.__BATTLEFIELD_COMBAT_DEMO__,v=window.__BATTLEFIELD_ANIMATIONS__;
     const root=v.scene.getTransformNodeByName('approved-character-display');
     return {phase:d.state.phase,seconds:d.state.reloadSeconds,
      elapsed:d.state.reloadElapsedFrames,progress:d.state.reloadProgress,
      speed:d.state.speed,moving:d.state.moving,clip:v.clip,
      gesture:v.weaponRig.reloadGestureActive,ammo:d.state.ammoRemaining,
      shots:d.state.fired,position:root.position.x};
    });
    const expected=weapon==='MP40'?2.5:7.5;
    if(firstReload.seconds!==expected||firstReload.phase!=='reload')
     throw Error('RELOAD_DURATION_WRONG '+JSON.stringify(firstReload));
    await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.state?.phase==='reload'
      && window.__BATTLEFIELD_COMBAT_DEMO__.state.reloadProgress>.3,
      null,{timeout:30000});
    const reload=await page.evaluate(()=>{
     const d=window.__BATTLEFIELD_COMBAT_DEMO__,v=window.__BATTLEFIELD_ANIMATIONS__;
     return {phase:d.state.phase,speed:d.state.speed,moving:d.state.moving,
      clip:v.clip,hand:v.weaponRig.reloadHandOffsetMeters,ammo:d.state.ammoRemaining,
      shots:d.state.fired,progress:d.state.reloadProgress,
      position:v.scene.getTransformNodeByName('approved-character-display').position.x};
    });
    if(reload.hand<=.005)throw Error('RELOAD_HAND_NOT_ANIMATED '+JSON.stringify(reload));
    if(reload.shots!==firstReload.shots)
     throw Error('FIRE_DURING_RELOAD '+weapon);
    if(weapon==='MP40'){
      if(!reload.moving||reload.speed<=.06||reload.clip!==weapon+'_Run'||
        reload.position<=firstReload.position+.02)
       throw Error('MP40_RELOAD_STOPPED_RUNNING '+JSON.stringify(reload));
    }else{
      if(reload.moving||reload.speed>.06||reload.clip!==weapon+'_Hold')
       throw Error('MG42_RELOADED_WITHOUT_STOP '+JSON.stringify(reload));
    }
    await page.screenshot({path:dir+'/'+device.name+'-'+weapon+'-reloading.png'});
    await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.done===true,
      null,{timeout:30000});
    const done=await page.evaluate(()=>{
     const d=window.__BATTLEFIELD_COMBAT_DEMO__;
     return {state:d.state,events:d.events,errors:d.errors};
    });
    if(done.errors.length||done.state.reloadCount!==1||done.state.reloading||
      done.state.fired!==(weapon==='MP40'?5:10)||
      done.events.filter(e=>e.name==='reload-start').length!==1||
      done.events.filter(e=>e.name==='reload-complete').length!==1)
     throw Error('RELOAD_DID_NOT_FINISH '+weapon+' '+JSON.stringify(done));
    const shotEvents=done.events.filter(e=>e.name==='shot');
    if(!shotEvents.every(e=>e.phase==='runFire'&&e.speed>.06))
     throw Error('SHOT_NOT_DURING_RUN '+weapon);
    if(done.events.some(e=>e.name==='shot'&&e.phase==='reload'))
     throw Error('SHOT_DURING_RELOAD '+weapon);
    console.log('RELOAD_BROWSER_PASS '+JSON.stringify({
     device:device.name,weapon,seconds:expected,clips:[firing.clip,reload.clip],
     shots:shotEvents.length,movedDuringReload:reload.position-firstReload.position,
     reloadGestureMeters:reload.hand,errors}));
   }
   if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
   await page.close();
  }
  console.log('ALL_FOUR_MOBILE_DESKTOP_RUN_AND_GUN_RELOAD_SCENES_PASS');
 }catch(e){console.error('RELOAD_BROWSER_QA_FAILED',e);process.exitCode=1}
 finally{await browser?.close()}
})();