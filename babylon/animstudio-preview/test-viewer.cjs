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
      if(!state.clips.includes('Kar98k_Run') || state.clips.some(n=>/_Walk$/.test(n)))
        throw Error('Combat motion must be running, not walking: '+JSON.stringify(state.clips));
      const result=[];
      for(const gun of ['Kar98k','MP40','MG42','Panzerschreck']){
        for(const pose of ['Hold','Aim','Fire','Run']){
          await page.evaluate(async([w,p])=>await window.__BATTLEFIELD_ANIMATIONS__.show(w,p),[gun,pose]);
          await page.waitForTimeout(180);
          const s=await page.evaluate(()=>({
            clip:window.__BATTLEFIELD_ANIMATIONS__.clip,
            error:window.__BATTLEFIELD_ANIMATIONS__.error,
            loaded:Object.keys(window.__BATTLEFIELD_ANIMATIONS__.weapons),
            corrected:window.__BATTLEFIELD_ANIMATIONS__.correctiveIK,
            right:window.__BATTLEFIELD_ANIMATIONS__.weaponRig?.rightGripMeters,
            left:window.__BATTLEFIELD_ANIMATIONS__.weaponRig?.leftGripMeters,
            pass:window.__BATTLEFIELD_ANIMATIONS__.weaponRig?.geometricPass,
            rigError:window.__BATTLEFIELD_ANIMATIONS__.weaponRig?.error
          }));
          if(s.clip!==gun+'_'+pose||s.error||!s.loaded.includes(gun))throw Error(env.name+' mismatched clip '+JSON.stringify(s));
          if(!s.corrected||s.rigError||!s.pass||!Number.isFinite(s.right)||!Number.isFinite(s.left)||s.right>.075||s.left>.075)
            throw Error(env.name+' IK grip FAILED '+gun+' '+pose+' '+JSON.stringify(s));
          await page.screenshot({path:path.join(out,env.name+'-'+gun+'-'+pose+'.png')});
          if(pose==='Run'){
            // Seek to the exact keyframes, independent of headless WebGL frame rate.
            // Timed snapshots sometimes sampled only one leg's stance phase.
            const samples=await page.evaluate(()=>{
              const state=window.__BATTLEFIELD_ANIMATIONS__;
              const clip=state.scene.animationGroups.find(g=>g.name===state.clip);
              clip.pause();
              const result=[];
              for(let i=0;i<=30;i++){
                clip.goToFrame(clip.from+(clip.to-clip.from)*i/30);
                result.push(state.sampleKnees());
              }
              clip.play(true);
              return result;
            });
            if(samples.some(m=>!Number.isFinite(m.left)||!Number.isFinite(m.right)))
              throw Error('Non-finite knee angle '+gun+' '+JSON.stringify(samples));
            const maxLeft=Math.max(...samples.map(x=>x.left));
            const maxRight=Math.max(...samples.map(x=>x.right));
            console.log('TACTICAL_RUN_KNEES '+JSON.stringify({env:env.name,gun,
              leftDeg:maxLeft,rightDeg:maxRight,samples}));
            if(maxLeft<35||maxRight<35)
              throw Error('GOOSE_STEP_REGRESSION '+env.name+' '+gun+' '+maxLeft+' '+maxRight);
            for(const phase of [3,9,16]){
              await page.evaluate(k=>{
                const state=window.__BATTLEFIELD_ANIMATIONS__;
                const clip=state.scene.animationGroups.find(g=>g.name===state.clip);
                clip.pause();
                clip.goToFrame(clip.from+(clip.to-clip.from)*k/20);
              },phase);
              await page.screenshot({path:path.join(out,env.name+'-'+gun+'-Run-phase'+phase+'.png')});
            }
          }
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