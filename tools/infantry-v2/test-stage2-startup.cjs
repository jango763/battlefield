// Stage 2: first visible frame must contain the approved hero rig.
// The old/donor/native succession must happen behind a bounded startup gate.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'preview/german-v5.js'),'utf8');
const wrapper=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(source);
const inline=wrapper.match(/<script>([\s\S]*?)<\/script>/);
assert(inline,'playable HTML loader must exist');
new Function(inline[1]);

assert(source.indexOf('const heroStartupGate=')>source.indexOf('const germanPreview='));
assert(source.includes("heroStartupGate.finish('native')"));
assert(source.includes("heroStartupGate.finish('load-fallback')"));
assert(source.includes("heroStartupGate.finish('no-loader-fallback')"));
assert(source.includes("heroStartupGate.finish('parse-fallback')"));
assert(source.includes("heroStartupGate.finish('model-fallback')"));
assert(source.includes("finish('timeout-fallback'),10000"),'bounded fallback timeout missing');
assert(source.includes("if(!heroStartupGate.pending())return;"),'late async native swap not blocked');
assert(source.includes("u!==P||heroStartupGate.pending()"),'late donor swap not blocked');
assert(source.indexOf('animateNativeHeroRig(unit,v,0);') <
  source.indexOf("heroStartupGate.finish('native')"),'first pose must be applied before reveal');
assert(wrapper.includes('german-v5.js?v=20261114-stage6-single-hands-r2'), 'stale loader cache URL');
console.log('STAGE 2 STATIC PASS: script parses, startup gate bounded, stable fallback, hero posed first');

if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/stage2-qa/node_modules/playwright');
  (async()=>{
    const errors=[];
    const browser=await chromium.launch({headless:true,
      args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
    try{
      for(const device of [
        {name:'desktop',viewport:{width:1280,height:800}},
        {name:'mobile-chromium',viewport:{width:390,height:844},
          userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
      ]){
        const page=await browser.newPage({viewport:device.viewport,
          ...(device.userAgent?{userAgent:device.userAgent}:{})});
        page.on('pageerror',e=>{
          if(!/No parent to post message/.test(e.message))errors.push(device.name+': '+e.message);
        });
        await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html',
          {waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>{
          try{return !!germanPreview.startupHeroReady;}catch(e){return false;}
        },null,{timeout:110000});
        const stats=await page.evaluate(()=>({
          ready:germanPreview.startupHeroReady,
          cover:!!document.getElementById('hero-startup-gate'),
          native:!!P.germanPreview?.nativeRig,
          oldFigure:P.germanPreview?.figure?.visible,
          oldWeapon:P.germanPreview?.weapon?.root?.visible,
          action:P.germanPreview?.nativeRig?.state,
          role:P.germanPreview?.role,
          currentFaction:P.side,
          canvasCount:document.querySelectorAll('canvas').length,
          armyMode:wehrmachtRollout.mode
        }));
        assert.equal(stats.ready,'native',device.name+' failed hero load '+JSON.stringify(stats));
        assert.equal(stats.cover,false,'overlay persisted after ready');
        assert(stats.native&&stats.role==='hero'&&stats.action==='idle',
          'hero not already posed in approved idle');
        assert.equal(stats.oldFigure,false,'donor model leaked after reveal');
        assert.equal(stats.oldWeapon,false,'interim weapon leaked after reveal');
        assert(stats.canvasCount>=1,'gameplay canvas missing');
        // A gameplay movement transition still works after first-frame gating.
        const action=await page.evaluate(()=>{
          const v=P.germanPreview;
          const before=P.x;
          const saved=P.sv;
          P.sv=3.2;
          animateGermanSoldier(P,1/60);
          const state=v.nativeRig.state;
          P.sv=saved;
          animateGermanSoldier(P,1/60);
          return {state,positionStable:P.x===before};
        });
        assert.equal(action.state,'jog','hero locomotion broken');
        assert(action.positionStable,'startup animation mutated gameplay position');
        await page.screenshot({path:'/tmp/stage2-'+device.name+'.png'});
        console.log('STAGE 2 BROWSER PASS',device.name,JSON.stringify(stats));
        await page.close();
      }
      assert.equal(errors.length,0,'browser errors '+errors.join('; '));
    }finally{await browser.close()}
  })().catch(error=>{console.error(error);process.exitCode=1});
}
