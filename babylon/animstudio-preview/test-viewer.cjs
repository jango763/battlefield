const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--no-sandbox']});
    const out='babylon/animstudio-preview/qa';
    fs.mkdirSync(out,{recursive:true});
    for(const env of [{name:'desktop',width:1280,height:900,mobile:false},
                      {name:'phone',width:390,height:844,mobile:true}]){
      const page=await browser.newPage({viewport:{width:env.width,height:env.height},isMobile:env.mobile,hasTouch:env.mobile,deviceScaleFactor:1});
      const failures=[];page.on('pageerror',e=>failures.push(String(e)));
      page.on('console',message=>{if(message.type()==='error')failures.push(message.text().slice(0,350))});
      page.on('response',response=>{if(response.status()>=400)failures.push('HTTP '+response.status()+' '+response.url())});
      await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html',{waitUntil:'domcontentloaded',timeout:75000});
      await page.waitForFunction(()=>window.__BATTLEFIELD_ANIMATIONS__?.ready,true,{timeout:100000});
      let state=await page.evaluate(()=>({
        loaded:window.__BATTLEFIELD_ANIMATIONS__.loaded,
        error:window.__BATTLEFIELD_ANIMATIONS__.error,
        clips:window.__BATTLEFIELD_ANIMATIONS__.clips,
        socket:window.__BATTLEFIELD_ANIMATIONS__.socket,
        bones:window.__BATTLEFIELD_ANIMATIONS__.skeletonBones
      }));
      if(!state.loaded||state.error||state.clips.length<16)throw Error(env.name+' load failed: '+JSON.stringify(state)+' errors '+failures.join(','));
      const result=[];
      for(const gun of ['Kar98k','MP40','MG42','Panzerschreck']){
        for(const pose of ['Hold','Aim','Fire','Walk']){
          await page.evaluate(async([w,p])=>await window.__BATTLEFIELD_ANIMATIONS__.show(w,p),[gun,pose]);
          await page.waitForTimeout(180);
          const s=await page.evaluate(()=>({
            clip:window.__BATTLEFIELD_ANIMATIONS__.clip,
            error:window.__BATTLEFIELD_ANIMATIONS__.error,
            loaded:Object.keys(window.__BATTLEFIELD_ANIMATIONS__.weapons)
          }));
          if(s.clip!==gun+'_'+pose||s.error||!s.loaded.includes(gun))throw Error(env.name+' mismatched clip '+JSON.stringify(s));
          await page.screenshot({path:path.join(out,env.name+'-'+gun+'-'+pose+'.png')});
          result.push(s.clip);
        }
      }
      console.log('ANIMSTUDIO_VIEWER_PASSED '+JSON.stringify({env:env.name,clips:result,errors:failures,bones:state.bones}));
      if(failures.length)throw Error('Browser console errors: '+failures.join('; '));
      await page.close();
    }
    console.log('ALL_16_ACTUAL_ANIMATIONS_RENDERED');
  }catch(e){console.error('ANIMSTUDIO_VIEWER_FAILED',e);process.exitCode=1}
  finally{await browser?.close()}
})();