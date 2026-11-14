'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const code=fs.readFileSync(path.join(root,'preview/german-v5.js'),'utf8');
const html=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(code);
const loader=html.match(/<script>([\s\S]*?)<\/script>/);
assert(loader,'Missing loader script');new Function(loader[1]);
for(const token of [
  'const heroStartupGate=(()=>{','heroStartupGate.afterFrame(unit,r)',
  'heroStartupGate.fallback(e?.message||String(e))',
  "if(heroStartupGate.phase==='fallback')return",
  "if(unit.kind==='p'&&heroStartupGate.phase==='fallback')return"
])assert(code.includes(token),'Missing startup invariant: '+token);
for(const token of ['hero-startup-cover','independentWatchdog','hero-startup-retry'])
  assert(html.includes(token),'Missing startup overlay or fallback retry: '+token);
assert(!code.includes('muster-rifleman-rig.js'),'Old Muster experimental model must not load');
console.log('HERO_STARTUP_STATIC_PASS');
if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/hero-startup-qa/node_modules/playwright');
  (async()=>{
    const browser=await chromium.launch({headless:true,
      args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
    try{
      for(const device of [
        {name:'desktop',viewport:{width:1280,height:800}},
        {name:'mobile-chromium',viewport:{width:390,height:844},
          userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
      ]){
        const context=await browser.newContext({
          viewport:device.viewport,deviceScaleFactor:1,
          ...(device.userAgent?{userAgent:device.userAgent,isMobile:true,hasTouch:true}:{})
        });
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',e=>{if(!/No parent to post message/.test(e.message))errors.push(e.message)});
        // Slow native character imports on purpose: a clear first frame must
        // be opaque even when the old donor character is already constructed.
        await page.route('**/assets/native-hero-quaternius/*.glb',async route=>{
          await new Promise(resolve=>setTimeout(resolve,900));
          await route.continue();
        });
        await page.goto(
          'http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=british&armyRig=british',
          {waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>{
          const mask=document.getElementById('hero-startup-cover');
          return !!mask&&getComputedStyle(mask).display!=='none';
        },null,{timeout:70000});
        const early=await page.evaluate(()=>{
          const cover=document.getElementById('hero-startup-cover');
          const r=cover.getBoundingClientRect();
          return{mask:!!cover,phase:window.__heroStartupGate?.phase,
            width:r.width,height:r.height,viewport:[innerWidth,innerHeight],
            background:getComputedStyle(cover).backgroundColor,
            isOpaque:getComputedStyle(cover).opacity==='1',
            playerExists:typeof P!=='undefined'&&!!P,
            nativeReady:typeof P!=='undefined'&&!!P.germanPreview?.nativeRig};
        });
        assert(early.width>=device.viewport.width-2&&early.height>=device.viewport.height-2,
          'Startup hero mask does not fully cover viewport: '+JSON.stringify(early));
        assert(early.isOpaque,'Provisional hero is visible behind transparent mask');
        await page.waitForFunction(()=>window.__heroStartupGate?.phase==='native'||
          window.__heroStartupGate?.phase==='fallback',null,{timeout:120000});
        await page.waitForTimeout(270);
        const ready=await page.evaluate(()=>{
          const r=P?.germanPreview?.nativeRig;
          const cover=document.getElementById('hero-startup-cover');
          return{
            phase:window.__heroStartupGate?.phase,
            coverPresent:!!cover,coverVisible:!!cover&&getComputedStyle(cover).opacity!=='0',
            model:!!r?.model,ww2:!!r?.ww2Uniform,
            nativeAction:r?.state,weapon:r?.weapon?.activeModelId,
            headwear:r?.ww2Uniform?.headwear,
            playerSide:P?.side,playerPosition:[P?.x,P?.z],
            hasMuster:!!window.__musterRifleRig
          };
        });
        assert.equal(ready.phase,'native','Hero did not finish first final animated frame: '+JSON.stringify(ready));
        assert(!ready.coverPresent&&!ready.coverVisible,'Startup cover not removed after ready');
        assert(ready.model&&ready.ww2,'Final native hero did not install');
        assert(['uk-lee-enfield','de-kar98k','uk-sten','de-mp40','uk-bren','de-mg42'].includes(ready.weapon),
          'Final hero displayed fallback gun before real GLB loaded: '+JSON.stringify(ready));
        assert(ready.headwear&&ready.headwear!=='none','Final hero appeared without headwear');
        assert(!ready.hasMuster,'Abandoned Muster assets leaked into active build');
        assert.equal(errors.length,0,'Fatal browser exception: '+errors.join(';'));
        await page.screenshot({path:'/tmp/startup-'+device.name+'-native.png'});
        console.log('HERO_STARTUP_BROWSER_PASS',device.name,JSON.stringify({early,ready}));
        await context.close();
      }
      // Forced early failure: show stable original hero, never accept a late
      // async native rig and never leave the user on a permanent blank screen.
      const fallback=await browser.newPage({viewport:{width:390,height:844}});
      const errors=[];
      fallback.on('pageerror',e=>{if(!/No parent to post message/.test(e.message))errors.push(e.message)});
      await fallback.goto(
        'http://127.0.0.1:8777/preview/formation-replenishment-v3.html?startupTimeoutMs=500',
        {waitUntil:'domcontentloaded',timeout:45000});
      await fallback.waitForFunction(()=>window.__heroStartupGate?.phase==='fallback',
        null,{timeout:70000});
      await fallback.waitForTimeout(1700);
      const safe=await fallback.evaluate(()=>({
        phase:window.__heroStartupGate.phase,
        cover:!!document.getElementById('hero-startup-cover'),
        player:typeof P!=='undefined'&&!!P,rig:!!P?.germanPreview?.nativeRig,
        renderCanvas:!!document.querySelector('canvas'),
        army:typeof U!=='undefined'&&Array.isArray(U)
      }));
      assert.equal(safe.phase,'fallback');
      assert(!safe.cover&&safe.player&&safe.renderCanvas&&safe.army,
        'Fallback did not reveal original playable game: '+JSON.stringify(safe));
      assert(!safe.rig,'Late native replacement occurred after fallback timeout');
      assert(!errors.length,'JS errors on fallback: '+errors.join(';'));
      console.log('HERO_STARTUP_FALLBACK_PASS',JSON.stringify(safe));
      await fallback.close();
    }finally{await browser.close()}
  })().catch(e=>{console.error('HERO_STARTUP_BROWSER_FAIL',e.stack||e);process.exitCode=1});
}
