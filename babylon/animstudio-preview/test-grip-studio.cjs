const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  fs.mkdirSync('babylon/animstudio-preview/master-qa',{recursive:true});
  for(const cfg of [{name:'desktop',width:1280,height:850},{name:'iphone',width:390,height:844}]){
    const page=await browser.newPage({viewport:{width:cfg.width,height:cfg.height},isMobile:cfg.name==='iphone',hasTouch:cfg.name==='iphone',deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
    await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html?gripStudio=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__BATTLEFIELD_GRIP_STUDIO__?.ready===true,null,{timeout:95000});
    const initial=await page.evaluate(()=>({
      pose:window.__BATTLEFIELD_ANIMATIONS__.pose,
      clip:window.__BATTLEFIELD_ANIMATIONS__.clip,
      gun:window.__BATTLEFIELD_ANIMATIONS__.weapon,
      enabled:window.__BATTLEFIELD_ANIMATIONS__.masterPoseEnabled,
      profile:window.__BATTLEFIELD_GRIP_STUDIO__.read()
    }));
    if(!initial.enabled||initial.gun!=='Kar98k'||initial.pose!=='Aim')
      throw Error('Studio boot '+cfg.name+': '+JSON.stringify(initial));
    await page.screenshot({path:'babylon/animstudio-preview/master-qa/'+cfg.name+'-baseline.png'});
    const edited=await page.evaluate(()=>{
      const e=window.__BATTLEFIELD_GRIP_STUDIO__;
      e.update({rightRoll:32,rightPitch:-18,indexCurl:1.9,thumbCurl:2.1,
        rightOffsetY:-.015});
      e.refresh();
      return e.read();
    });
    if(edited.rightRoll!==32||edited.rightPitch!==-18||edited.indexCurl!==1.9)
      throw Error('Profile controls '+JSON.stringify(edited));
    await page.screenshot({path:'babylon/animstudio-preview/master-qa/'+cfg.name+'-edited.png'});
    await page.evaluate(()=>document.getElementById('master-copy').click());
    const json=await page.locator('#master-json').inputValue();
    const parsed=JSON.parse(json);
    if(parsed.weapon!=='Kar98k'||parsed.profile.rightRoll!==32)
      throw Error('JSON export '+json);
    await page.evaluate(()=>document.getElementById('master-reset').click());
    const reset=await page.evaluate(()=>window.__BATTLEFIELD_GRIP_STUDIO__.read());
    if(reset.rightRoll!==0)throw Error('Reset failed');
    if(errors.length)throw Error('Browser errors: '+errors.join('; '));
    console.log('GRIP_STUDIO_PASS '+JSON.stringify({env:cfg.name,gun:initial.gun,
      baseline:initial.profile,edited,reset:reset.rightRoll,errors}));
    await page.close();
  }
 }catch(e){console.error('GRIP_STUDIO_FAILED',e);process.exitCode=1}
 finally{await browser?.close()}
})();