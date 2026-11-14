// Wehrmacht-wide staging gate: browser smoke and syntax checks, no gameplay edits.
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'preview/german-v5.js'),'utf8');
const wrapper=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(source);
const script=wrapper.match(/<script>([\s\S]*?)<\/script>/);
assert(script,'HTML must contain playable loader');
new Function(script[1]);
for(const name of [
  'wehrmachtRollout','wehrmachtArmyEligible','wehrmachtArmyCanInstall',
  'releaseNativeArmyVisual','germanPreview.armyActiveUnits',
  "unit.t==='red'","wehrmachtRollout.max>0"
])assert(source.includes(name),'Missing German army rollout guard: '+name);
assert(wrapper.includes("get('inspect')==='wehrmacht'"),'Missing Wehrmacht visual inspection scene');
assert(source.includes("rig.armyUnit.t==='blue'"),'British asset exclusion missing');
console.log('STATIC PASS: German-only rollout, full roster, reversible proximity LOD, syntax');

if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/wehrmacht-qa/node_modules/playwright');
  (async()=>{
    const errors=[],browser=await chromium.launch({
      headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']
    });
    try{
      for(const device of [
        {name:'desktop',viewport:{width:1280,height:800},userAgent:null},
        {name:'mobile-chromium',viewport:{width:390,height:844},
         userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
      ]){
        const page=await browser.newPage({
          viewport:device.viewport,deviceScaleFactor:1,
          ...(device.userAgent?{userAgent:device.userAgent}:{}),
        });
        page.on('pageerror',e=>{
          if(!/No parent to post message/.test(e.message))errors.push(device.name+': '+e.message);
        });
        await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=wehrmacht',
          {waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>{
          try{return Array.isArray(window.__wehrmachtReview)&&window.__wehrmachtReview.length===12 &&
            !!germanPreview.armyNativeTemplate&&!!P?.germanPreview?.nativeRig;}
          catch(e){return false}
        },null,{timeout:120000});
        await page.waitForFunction(()=>{
          try{return window.__wehrmachtReview.filter(u=>u.germanPreview?.nativeRig?.armyUnit).length>=8;}
          catch(e){return false}
        },null,{timeout:45000});
        const stats=await page.evaluate(()=>{
          const troops=window.__wehrmachtReview;
          const active=troops.filter(u=>u.germanPreview?.nativeRig?.armyUnit);
          const skeletons=active.map(u=>{
            const nodes=[];u.germanPreview.nativeRig.model.traverse(n=>{if(n.isBone)nodes.push(n)});
            return nodes;
          });
          const roles=troops.map(u=>u.germanPreview?.role);
          const blue=mk('blue',false,false);
          blue.x=P.x+3;blue.z=P.z+5;blue.g.position.set(blue.x,0,blue.z);
          animateGermanSoldier(blue,1/60);
          const uniformCorrect=active.every(u=>u.germanPreview.nativeRig?.ww2Uniform?.side==='red');
          const left=active[0];
          const count=germanPreview.armyNativeInstalled;
          left.x=P.x+150;left.z=P.z+150;left.g.position.set(left.x,0,left.z);
          animateGermanSoldier(left,1/60);
          const released=!left.germanPreview.nativeRig;
          return{
            count,cap:wehrmachtRollout.max,mobile:wehrmachtRollout.mobile,
            active:active.length,roles,
            skeletonsIndependent:skeletons.every((set,i)=>set.length>=60&&set.every(node=>
              skeletons.every((other,j)=>i===j||!other.includes(node)))),
            uniformCorrect,
            blueUnchanged:!blue.germanPreview?.nativeRig,
            released,afterRelease:germanPreview.armyNativeInstalled,
            preservedPosition:Math.abs(left.g.position.x-left.x)<1e-6
          };
        });
        assert(stats.active>=8,'Too few Wehrmacht native soldiers '+JSON.stringify(stats));
        assert(stats.skeletonsIndependent,'Shared skeleton bones');
        assert(stats.uniformCorrect,'Wrong German uniform');
        assert(stats.roles.includes('captain')&&stats.roles.includes('engineer'),'Role-spawn failed');
        assert(stats.blueUnchanged,'Blue faction accidentally upgraded');
        assert(stats.count<=stats.cap,'Mobile/desktop LOD budget exceeded');
        assert(stats.preservedPosition,'Gameplay soldier position was modified');
        if(device.name==='mobile-chromium'){
          assert(stats.mobile,'Mobile budget not detected');
          assert(stats.released&&stats.afterRelease<stats.count,'Far-away native LOD did not release');
        }
        await page.screenshot({path:'/tmp/wehrmacht-'+device.name+'.png'});
        console.log('BROWSER PASS',device.name,JSON.stringify(stats));
        await page.close();
      }
      assert(!errors.length,'Browser page errors: '+JSON.stringify(errors));
    }finally{await browser.close()}
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
