'use strict';
const fs=require('fs'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
const js=fs.readFileSync(path.join(root,'preview/german-v5.js'),'utf8');
const html=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(js);
const script=html.match(/<script>([\s\S]*?)<\/script>/);assert(script);
new Function(script[1]);
for(const flag of ["mode==='british'","attachNativeArmyBritishBrodie","uk-lee-enfield","uk-sten","uk-bren"]){
  assert(js.includes(flag),'UK native rig source missing: '+flag);
}
assert(html.includes("get('inspect')==='british'"),'No four-man British inspection');
console.log('BRITISH STATIC PASS');
if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/british-pilot/node_modules/playwright');
  (async()=>{
    const browser=await chromium.launch({headless:true,args:[
      '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox'
    ]});
    try{
      const errors=[];
      const page=await browser.newPage({viewport:{width:844,height:540},deviceScaleFactor:1});
      page.on('pageerror',err=>{
        if(!/No parent to post message/.test(err.message))errors.push(err.message);
      });
      await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html?armyRig=british&inspect=british',
        {waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>{
        try{return !!P?.germanPreview?.nativeRig &&
          window.__britishReview?.length===4 &&
          window.__britishReview.every(u=>!!u.germanPreview?.nativeRig?.ww2Uniform);}
        catch(e){return false}
      },null,{timeout:120000});
      await page.waitForTimeout(2000);
      const stats=await page.evaluate(()=>{
        const soldiers=window.__britishReview,rigs=soldiers.map(u=>u.germanPreview.nativeRig);
        const bones=rigs.map(r=>{const a=[];r.model.traverse(n=>{if(n.isBone)a.push(n)});return a;});
        const diagnostics=soldiers.map((u,i)=>({
          role:u.germanPreview.role,
          side:u.t,
          headwear:rigs[i].ww2Uniform.headwear,
          variant:rigs[i].armyHeadwearChoice,
          uniformSide:rigs[i].ww2Uniform.side,
          visibleKnitCap:!!rigs[i].ww2Uniform.knitCap?.visible,
          hatSource:rigs[i].ww2Uniform.cap?.userData?.headwearSource||null,
          selectedGun:rigs[i].weapon?.activeModelId,
          leftGripError:rigs[i].weaponDiagnostics?.visibleLeftError
        }));
        return{count:soldiers.length,active:germanPreview.armyNativeInstalled,
          helmets:germanPreview.britishBrodieLoaded||0,
          errors:rigs.map(r=>r.britishBrodieLoadError||null),
          roles:diagnostics,uniqueBones:bones.every((bb,i)=>bb.length>=60&&bb.every(b=>
            bones.every((other,j)=>i===j||!other.includes(b))))};
      });
      assert.equal(stats.count,4);
      assert(stats.uniqueBones,'British soldier skeletons are shared');
      assert(stats.roles.every(s=>s.side==='blue'&&s.uniformSide==='blue'),'Wrong UK palette');
      assert(stats.roles.some(s=>s.role==='captain'&&s.visibleKnitCap),'Captain lacks dark olive knitted cap');
      assert(stats.roles.some(s=>s.role==='captain'&&s.variant==='knit'&&
        s.headwear==='British dark olive knitted cap'),
        'British officer has wrong headwear assignment');
      assert(stats.roles.every(s=>s.role==='captain'||!s.visibleKnitCap),'British regular incorrectly wears officer knitted cap');
      assert(stats.roles.some(s=>s.selectedGun==='uk-lee-enfield'),'No British Lee-Enfield');
      assert(stats.roles.some(s=>s.selectedGun==='uk-sten'),'No British Sten');
      assert(stats.roles.some(s=>s.selectedGun==='uk-bren'),'No British Bren');
      assert(stats.helmets>=1,'Field helmet GLB failed to load: '+JSON.stringify(stats.errors));
      assert(!errors.length,'Page exceptions: '+JSON.stringify(errors));
      await page.screenshot({path:'/tmp/british-four-pilot.png'});
      console.log('BRITISH BROWSER PASS',JSON.stringify(stats));
    }finally{await browser.close()}
  })().catch(err=>{console.error(err);process.exitCode=1;});
}
