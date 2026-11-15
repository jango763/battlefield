const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--enable-webgl']});
  const out='babylon/animstudio-preview/combat-qa';fs.mkdirSync(out,{recursive:true});
  for(const device of [{name:'desktop',width:1300,height:900,mobile:false},
                       {name:'iphone',width:390,height:844,mobile:true}]){
   const page=await browser.newPage({viewport:{width:device.width,height:device.height},
     isMobile:device.mobile,hasTouch:device.mobile,deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push('JS '+String(e)));
   page.on('response',r=>{if(r.status()>=400)
     errors.push('HTTP '+r.status()+' '+r.url())});
   await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html?combatDemo=1',
     {waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.ready===true,
     null,{timeout:95000});
   const initial=await page.evaluate(()=>{
     const v=window.__BATTLEFIELD_ANIMATIONS__,d=window.__BATTLEFIELD_COMBAT_DEMO__;
     return {gun:v.weapon,poseSaved:d.posePreserved,ready:d.ready,
       originalProfile:v.getMasterPose(),butt:v.weaponRig.stockOnRightShoulder};
   });
   if(!initial.ready||!initial.poseSaved||initial.gun!=='Kar98k'||!initial.butt)
     throw Error('Combat scene did not preserve approved Kar98k '+JSON.stringify(initial));
   await page.screenshot({path:path.join(out,device.name+'-initial.png')});
   await page.click('#combat-play');
   await page.waitForFunction(()=>{
     const d=window.__BATTLEFIELD_COMBAT_DEMO__,v=window.__BATTLEFIELD_ANIMATIONS__;
     return d?.state?.phase==='lower' && v?.weaponRig?.combatCrouchStrength>.55;
   },null,{timeout:35000});
   const lower=await page.evaluate(()=>{
     const v=window.__BATTLEFIELD_ANIMATIONS__,d=window.__BATTLEFIELD_COMBAT_DEMO__;
     return {stance:v.weaponRig.combatCrouchStrength,knees:v.sampleKnees(),state:d.state};
   });
   if(lower.state?.speed>.06||lower.stance<.25)throw Error('Low marksman stance failed '+JSON.stringify(lower));
   await page.screenshot({path:path.join(out,device.name+'-rifle-low-stance.png')});
   await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.state?.phase==='bolt',
     null,{timeout:30000});
   await page.waitForTimeout(220);
   const bolt=await page.evaluate(()=>{
     const v=window.__BATTLEFIELD_ANIMATIONS__,d=window.__BATTLEFIELD_COMBAT_DEMO__;
     return {crouch:v.weaponRig.combatCrouchStrength,
       move:v.weaponRig.boltHandOffsetMeters,stock:v.weaponRig.stockOnRightShoulder,
       shots:d.state.fired,speed:d.state.speed,phase:d.state.phase};
   });
   if(!bolt.stock||bolt.crouch<.7||bolt.shots!==1||bolt.speed>.06)
     throw Error('Rifle bolt posture failed '+JSON.stringify(bolt));
   await page.screenshot({path:path.join(out,device.name+'-rifle-bolt.png')});
   await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.done===true,
     null,{timeout:35000});
   const rifle=await page.evaluate(()=>{
     const d=window.__BATTLEFIELD_COMBAT_DEMO__,v=window.__BATTLEFIELD_ANIMATIONS__;
     return {state:d.state,events:d.events,errors:d.errors,profile:v.getMasterPose()};
   });
   if(rifle.errors.length||rifle.state.fired!==1||rifle.state.boltCount!==1||
      rifle.state.shotsOnMove!==0||rifle.state.boltLocked!==true)
     throw Error('Kar98k sequence incorrect '+JSON.stringify(rifle));
   const names=rifle.events.map(x=>x.name);
   const exact=['stop-confirmed','shot','bolt-handle-lift',
     'bolt-back','bolt-forward','bolt-locked'];
   if(JSON.stringify(names)!==JSON.stringify(exact))
     throw Error('Wrong rifle event order '+JSON.stringify(names));
   if(JSON.stringify(initial.originalProfile)!==JSON.stringify(rifle.profile))
     throw Error('The approved 32-parameter grip was modified by combat cycle');
   await page.click('#combat-pz');
   await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.weapon==='Panzerschreck'
     && window.__BATTLEFIELD_ANIMATIONS__?.weapon==='Panzerschreck',
     null,{timeout:60000});
   await page.click('#combat-play');
   await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.state?.phase==='aim',
     null,{timeout:35000});
   const rocketAim=await page.evaluate(()=>({
     crouch:window.__BATTLEFIELD_ANIMATIONS__.weaponRig.combatCrouchStrength,
     phase:window.__BATTLEFIELD_COMBAT_DEMO__.state.phase
   }));
   if(rocketAim.crouch>.2)throw Error('Rocket wrongly forced into rifle crouch '+JSON.stringify(rocketAim));
   await page.screenshot({path:path.join(out,device.name+'-rocket-aim.png')});
   await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.state?.phase==='reload'
     && window.__BATTLEFIELD_COMBAT_DEMO__.state.reloadProgress>.3
     && window.__BATTLEFIELD_ANIMATIONS__?.weaponRig?.reloadGestureActive,
     null,{timeout:35000});
   const loading=await page.evaluate(()=>{
     const d=window.__BATTLEFIELD_COMBAT_DEMO__,v=window.__BATTLEFIELD_ANIMATIONS__;
     return {phase:d.state.phase,speed:d.state.speed,moving:d.state.moving,
       seconds:d.state.reloadSeconds,ammo:d.state.ammoRemaining,
       reloadProgress:d.state.reloadProgress,hand:v.weaponRig.reloadHandOffsetMeters};
   });
   if(loading.phase!=='reload'||loading.seconds!==9||loading.ammo!==0||
     loading.speed>.06||loading.moving||loading.hand<.005)
     throw Error('Panzerschreck did not reload for 9 seconds at rest '+JSON.stringify(loading));
   await page.screenshot({path:path.join(out,device.name+'-rocket-reload.png')});
   await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.done===true,
     null,{timeout:45000});
   const rocket=await page.evaluate(()=>{
     const d=window.__BATTLEFIELD_COMBAT_DEMO__;return {state:d.state,events:d.events,errors:d.errors};
   });
   if(rocket.errors.length||rocket.state.fired!==1||rocket.state.boltCount!==0||
     rocket.state.shotsOnMove!==0||rocket.state.reloadCount!==1||
     rocket.state.ammoRemaining!==1||
     rocket.events.some(x=>x.name.startsWith('bolt-'))||
     rocket.events.filter(x=>x.name==='reload-start').length!==1||
     rocket.events.filter(x=>x.name==='reload-complete').length!==1)
     throw Error('Rocket combat wrong '+JSON.stringify(rocket));
   if(errors.length)throw Error('Browser errors '+JSON.stringify(errors));
   console.log('BABYLON_COMBAT_PREVIEW_PASS '+JSON.stringify({
     device:device.name,rifleMarkers:names,rocketMarkers:rocket.events.map(x=>x.name),
     rifleCrouch:bolt.crouch,rocketCrouch:rocketAim.crouch,
     approvedPose:initial.poseSaved,errors}));
   await page.close();
  }
  console.log('BABYLON_KAR98K_PANZERSCHRECK_COMBAT_CYCLE_ALL_TESTS_PASS');
 }catch(e){console.error('BABYLON_COMBAT_SCENE_FAILED',e);process.exitCode=1}
 finally{await browser?.close()}
})();