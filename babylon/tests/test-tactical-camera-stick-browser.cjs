'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('/tmp/bf-tactical-camera/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader','--enable-webgl','--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},
   isMobile:true,hasTouch:true,deviceScaleFactor:3});
  const errors=[];
  page.on('pageerror',e=>{errors.push(String(e));console.log('BATTLEFIELD_PAGE_ERROR',String(e))});
  page.on('console',m=>{
   if(m.type()==='error'||m.type()==='warning')
    console.log('BATTLEFIELD_BROWSER_CONSOLE',m.type(),m.text().slice(0,700));
  });
  page.on('requestfailed',req=>{
   console.log('BATTLEFIELD_REQUEST_FAILED',req.url(),req.failure()?.errorText);
  });
  await page.goto('http://127.0.0.1:8877/babylon/index.html?quality=low',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(9000);
  const diagnostics=await page.evaluate(()=>{
   const state=window.__BATTLEFIELD_GAME__;
   return {state:state?{ready:state.ready,loading:state.loading,error:state.error,
    models:state.models,mapDetail:state.mapDetail}:null,
    loading:document.querySelector('#loading')?.textContent,
    status:document.querySelector('#brief-progress')?.textContent,
    engine:!!window.BABYLON};
  });
  console.log('BATTLEFIELD_STARTUP_DIAGNOSTICS',JSON.stringify(diagnostics));
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||
   window.__BATTLEFIELD_GAME__?.error,null,{timeout:55000});
  const before=await page.evaluate(()=>{
   const s=window.__BATTLEFIELD_GAME__,pad=document.getElementById('touch-stick');
   return {ready:s.ready,error:s.error,models:s.models,
    camera:s.cameraProfile,cameraPosition:s.cameraPosition,
    detail:s.mapDetail,stickLoaded:!!s.thumbstick,
    padWidth:getComputedStyle(pad).width};
  });
  console.log('BATTLEFIELD_TACTICAL_CAMERA_MAP_LOAD',JSON.stringify(before));
  assert.equal(before.ready,true);assert(before.models>=2);
  assert.equal(before.camera,'tactical');
  assert(before.detail?.ready,'Organic non-pickable map overlay must render');
  assert(before.detail?.patches>=120&&before.detail.drawCalls===5,
   'Terrain plus two shared-mesh roadside detail batches must be generated');
  assert.equal(before.detail.roadSurface,'two-track-gravel-and-grass');
  assert.equal(before.detail.roadVergesVisible,true,
   'Natural grass verges must be distinguishable from the road from above');
  assert(before.detail.hedges>=25&&before.detail.stones>=12,
   'The empty hero corridor needs visible rural foliage and rubble');
  assert(before.stickLoaded);
  assert(parseFloat(before.padWidth)>=120,'Thumbstick must be easy to reach');
  assert.equal(errors.length,0,'startup JS errors: '+errors.join('|'));
  await page.locator('#enter-game').click();
  await page.waitForTimeout(500);
  const getState=()=>page.evaluate(()=>{
   const s=window.__BATTLEFIELD_GAME__;
   return {position:s.heroPosition,camera:s.cameraPosition,
    stick:s.thumbstick&&{active:s.thumbstick.active,x:s.thumbstick.x,
      z:s.thumbstick.z,resets:s.thumbstick.resetCount},
    battle:document.body.classList.contains('battle-active')};
  });
  const initial=await getState();
  assert(initial.battle);
  const box=await page.locator('#touch-stick').boundingBox();
  assert(box,'Thumbstick shown during combat');
  const x=box.x+box.width*.48,y=box.y+box.height*.52;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x,y-64,{steps:6});
  await page.waitForTimeout(1800);
  const moving=await getState();
  console.log('BATTLEFIELD_TACTICAL_STICK_MOVEMENT',JSON.stringify({initial,moving}));
  assert(moving.stick?.active,'Joystick must capture pointer while dragged');
  assert(moving.stick.z>.6,'Upward drag must send forward movement');
  assert(moving.position.z>initial.position.z+.7,
   'Hero must actually advance while dragging floating-origin joystick');
  await page.mouse.up();await page.waitForTimeout(300);
  const released=await getState();
  assert.equal(released.stick.active,false,'Releasing must reset input');
  assert(Math.abs(released.stick.z)<1e-8);
  await page.waitForTimeout(600);
  const stopped=await getState();
  assert(Math.abs(stopped.position.z-released.position.z)<.55,
   'Hero may not keep moving after finger release');
  // Actual iPhone uses touch, not a mouse. Exercise PointerEvent touch
  // capture through Chromium's native touchscreen injection pipeline.
  const client=await page.context().newCDPSession(page);
  const beforeTouch=await getState();
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',
   touchPoints:[{x,y,id:42}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',
   touchPoints:[{x,y:y-70,id:42}]});
  await page.waitForTimeout(750);
  const touchMoving=await getState();
  assert.equal(touchMoving.stick.active,true,'Native touch pointer must lock');
  assert(touchMoving.stick.z>.6,'Touch forward must match mouse and keyboard direction');
  assert(touchMoving.position.z>beforeTouch.position.z+.4,
   'Real touch gesture must actually move the German/British hero');
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(180);
  const touchReleased=await getState();
  assert.equal(touchReleased.stick.active,false,'TouchEnd must release the joystick');
  console.log('BATTLEFIELD_REAL_TOUCH_DRAG',JSON.stringify({
   initial:beforeTouch.position,moving:touchMoving.position,
   released:touchReleased.position}));
  await page.locator('#hud-toggle').click();
  await page.locator('#camera-toggle').click();
  const classic=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.cameraProfile);
  assert.equal(classic,'classic','Close reference camera must remain available');
  await page.locator('#camera-toggle').click();
  assert.equal(await page.evaluate(()=>window.__BATTLEFIELD_GAME__.cameraProfile),'tactical');
  await page.locator('#hud-toggle').click();
  const image=await page.screenshot({type:'jpeg',quality:48,path:'/tmp/bf-coh3-style-mobile.jpg'});
  console.log('BATTLEFIELD_TACTICAL_RENDER_JPEG_BASE64 '+image.toString('base64'));
  assert.equal(errors.length,0,'In-game JS errors: '+errors.join('|'));
  console.log('BATTLEFIELD_CAMERA_JOYSTICK_MAP_BROWSER_PASS');
  await page.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
