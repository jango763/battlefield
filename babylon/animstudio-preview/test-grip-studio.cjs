const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  fs.mkdirSync('babylon/animstudio-preview/master-qa',{recursive:true});
  for(const cfg of [{name:'desktop',width:1280,height:850,mobile:false},
    {name:'iphone',width:390,height:844,mobile:true}]){
    const page=await browser.newPage({viewport:{width:cfg.width,height:cfg.height},
      isMobile:cfg.mobile,hasTouch:cfg.mobile,deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',e=>errors.push('JS '+String(e)));
    page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
    await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html?gripStudio=1',
      {waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__BATTLEFIELD_GRIP_STUDIO__?.ready===true,
      null,{timeout:95000});
    const initial=await page.evaluate(()=>{
      const s=window.__BATTLEFIELD_ANIMATIONS__;
      return {pose:s.pose,weapon:s.weapon,clip:s.clip,
        profile:window.__BATTLEFIELD_GRIP_STUDIO__.read(),
        pinned:s.weaponRig.stockOnRightShoulder};
    });
    if(initial.weapon!=='Kar98k'||initial.pose!=='Aim'||!initial.pinned)
      throw Error('Studio boot '+cfg.name+': '+JSON.stringify(initial));
    if(!await page.locator('#master-left').evaluate(e=>e.open))
      throw Error('Left hand panel should be open by default');
    if(!await page.locator('#master-right').count())
      throw Error('Missing separate right hand panel');
    if(!await page.locator('[data-key="leftOffsetZ"]').count())
      throw Error('Missing fore-end slider');
    for(const side of ['right','left'])
      for(const digit of ['Thumb','Index','Middle','Ring','Pinky'])
        for(const axis of ['Curl','Spread'])
          if(!await page.locator('[data-key="'+side+digit+axis+'"]').count())
            throw Error('Missing independent finger '+side+digit+axis);
    await page.screenshot({path:'babylon/animstudio-preview/master-qa/'+cfg.name+'-before.png'});
    // Physical UI interaction: shift only left wrist forward.
    await page.locator('#master-left-forward').click();
    const forward=await page.evaluate(()=>window.__BATTLEFIELD_GRIP_STUDIO__.read());
    if(Math.abs(forward.leftOffsetZ-initial.profile.leftOffsetZ-.05)>1e-6||
       forward.rightOffsetZ!==initial.profile.rightOffsetZ)
      throw Error('Left fore-end button affected right hand '+JSON.stringify(forward));
    await page.locator('#master-left-back').click();
    // Independent per-finger bend and rotation, tested through DOM input events.
    await page.evaluate(()=>{
      const input=document.querySelector('[data-key="leftMiddleSpread"]');
      input.value='22';
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    const middle=await page.evaluate(()=>window.__BATTLEFIELD_GRIP_STUDIO__.read());
    if(middle.leftMiddleSpread!==22||middle.leftRingSpread!==initial.profile.leftRingSpread||
       middle.rightMiddleSpread!==initial.profile.rightMiddleSpread)
      throw Error('Finger isolation failed '+JSON.stringify(middle));
    const edited=await page.evaluate(()=>{
      const s=window.__BATTLEFIELD_GRIP_STUDIO__;
      s.update({leftOffsetZ:.23,leftIndexCurl:2.2,leftThumbSpread:19,
        rightRoll:32,rightIndexCurl:1.9,rightPinkySpread:-16,rightOffsetY:-.015});
      s.refresh();
      return s.read();
    });
    if(edited.leftOffsetZ!==.23||edited.leftIndexCurl!==2.2||
       edited.leftThumbSpread!==19||edited.rightRoll!==32||
       edited.rightIndexCurl!==1.9||edited.rightPinkySpread!==-16||
       edited.rightRingSpread!==initial.profile.rightRingSpread)
      throw Error('Independent hand profile failed '+JSON.stringify(edited));
    await page.evaluate(()=>window.__BATTLEFIELD_GRIP_STUDIO__.focusHand('left'));
    const focus=await page.evaluate(()=>{
      const s=window.__BATTLEFIELD_ANIMATIONS__;
      return {target:s.scene.activeCamera.getTarget().asArray(),
        wrist:s.weaponRig.leftHandFocus,stock:s.weaponRig.stockOnRightShoulder};
    });
    if(!focus.stock||Math.hypot(...focus.target.map((v,i)=>v-focus.wrist[i]))>.01)
      throw Error('Left-hand camera/stock failed '+JSON.stringify(focus));
    await page.screenshot({path:'babylon/animstudio-preview/master-qa/'+cfg.name+'-left-hand-edited.png'});
    // JSON v2 preserves both hands and individually rotated fingers.
    await page.locator('#master-copy').click();
    const json=JSON.parse(await page.locator('#master-json').inputValue());
    if(json.version!==2||json.profile.leftIndexCurl!==2.2||
       json.profile.rightPinkySpread!==-16)
      throw Error('Export is not v2 '+JSON.stringify(json));
    // Reset left hand ONLY - right hand must not change.
    const afterLeftReset=await page.evaluate(()=>{
      const s=window.__BATTLEFIELD_GRIP_STUDIO__;
      s.resetHand('left');return s.read();
    });
    if(afterLeftReset.rightRoll!==32||afterLeftReset.rightPinkySpread!==-16||
       afterLeftReset.leftIndexCurl!==initial.profile.leftIndexCurl||
       afterLeftReset.leftMiddleSpread!==0)
      throw Error('Independent left reset failed '+JSON.stringify(afterLeftReset));
    // Restore saved profile through UI.
    await page.locator('#master-import').click();
    const restored=await page.evaluate(()=>window.__BATTLEFIELD_GRIP_STUDIO__.read());
    if(restored.leftOffsetZ!==.23||restored.rightPinkySpread!==-16)
      throw Error('JSON import failed '+JSON.stringify(restored));
    // Check legacy v1 import, preserving right/left independent schema.
    const legacy=await page.evaluate(()=>{
      const s=window.__BATTLEFIELD_GRIP_STUDIO__;
      s.update({fingerCurl:1.45,supportOffsetZ:.12});
      return s.read();
    });
    if(legacy.rightMiddleCurl!==1.45||legacy.rightRingCurl!==1.45||
       legacy.rightPinkyCurl!==1.45||legacy.leftOffsetZ!==.12)
      throw Error('Legacy JSON profile migration failed');
    await page.locator('#master-reset').click();
    const reset=await page.evaluate(()=>window.__BATTLEFIELD_GRIP_STUDIO__.read());
    if(reset.rightRoll!==0||reset.leftMiddleSpread!==0||reset.leftOffsetZ!==.08)
      throw Error('Reset both hands failed '+JSON.stringify(reset));
    if(errors.length)throw Error('Browser errors: '+errors.join('; '));
    console.log('GRIP_STUDIO_TWO_HANDS_AND_TEN_FINGERS_PASS '+JSON.stringify({
      env:cfg.name,forward5cm:forward.leftOffsetZ,
      leftEdited:edited.leftOffsetZ,independentFinger:middle.leftMiddleSpread,
      rightRoll:edited.rightRoll,jsonVersion:json.version,errors}));
    await page.close();
  }
  console.log('MASTER_GRIP_LEFT_RIGHT_INDEPENDENT_ALL_TESTS_PASS');
 }catch(e){console.error('MASTER_GRIP_TWO_HANDS_FAILED',e);process.exitCode=1}
 finally{await browser?.close()}
})();