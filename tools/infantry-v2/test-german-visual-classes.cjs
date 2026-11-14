'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const src=fs.readFileSync(path.join(root,'preview/german-v5.js'),'utf8');
const identities=fs.readFileSync(path.join(root,'preview/german-visual-classes.js'),'utf8');
const pageHtml=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(src);new Function(identities);new Function(src+'\n'+identities);
const loader=pageHtml.match(/<script>([\s\S]*?)<\/script>/);
assert(loader,'Missing HTML boot script');new Function(loader[1]);
assert(pageHtml.includes("get('german-visual-classes.js?v=1')"));
assert(pageHtml.includes("get('inspect')==='classes'"));
assert(src.includes('installWehrmachtVisualIdentity(rig)'));
assert(src.includes('wehrmachtVisualTint(visualRole)'));
assert(src.includes('updateWehrmachtVisualIdentity(rig,side)'));
assert(!/muster-british-review|muster-rifleman-rig/.test(src+identities+pageHtml),
  'Abandoned Muster source imported into active army');
console.log('GERMAN_VISUAL_CLASSES_STATIC_PASS');
if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/wehrmacht-visual-qa/node_modules/playwright');
  (async()=>{
    const browser=await chromium.launch({headless:true,
      args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
    try{
      for(const device of [
        {name:'desktop',viewport:{width:1280,height:800}},
        {name:'mobile-chromium',viewport:{width:390,height:844},
         userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
      ]){
        const context=await browser.newContext({viewport:device.viewport,
          deviceScaleFactor:1,...(device.userAgent?{
            userAgent:device.userAgent,isMobile:true,hasTouch:true
          }:{})});
        const page=await context.newPage();
        const failures=[];
        page.on('pageerror',e=>{
          if(!/No parent to post message/.test(e.message))failures.push(e.message)
        });
        await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=classes',
          {waitUntil:'domcontentloaded',timeout:65000});
        await page.waitForFunction(()=>{
          try{return window.__classReview?.length===5 &&
            !!P?.germanPreview?.nativeRig?.ww2Uniform?.visualIdentityKit &&
            window.__classReview.every(u=>
              u.germanPreview?.nativeRig?.ww2Uniform?.visualIdentityKit?.parts?.length>0);}
          catch(e){return false;}
        },null,{timeout:140000});
        // Let MP40/MG42 GLB weapon and helmet async loads complete.
        await page.waitForTimeout(800);
        const result=await page.evaluate(()=>{
          const describe=u=>{
            const r=u.germanPreview.nativeRig;
            const uniform=r.ww2Uniform,kit=uniform.visualIdentityKit;
            const tint=uniform.donorMeshes.find(x=>x.type==='garment')?.german?.userData?.uniformTint;
            const visibleMeshCount=kit.parts.reduce((n,g)=>{
              g.traverse(x=>{if(x.isMesh&&x.visible)n++});return n;
            },0);
            return{
              id:u.kind==='p'?'hero':u.cmd?'captain':u.eng?'engineer':u.type,
              class:r.ww2VisualClass,kitType:kit.type,meshes:kit.meshes,
              meshNames:kit.meshNames,visibleMeshCount,
              headwear:r.armyHeadwearChoice||uniform.headwear,
              weapon:r.weapon?.activeModelId,
              tint,skinnedClothing:uniform.donorMeshes.filter(x=>x.type==='garment'&&x.mesh.isSkinnedMesh).length,
              nativeSkeleton:r.model?.children?.length>0,
              boneBindings:uniform.matchedBones
            };
          };
          return{
            hero:describe(P),
            soldiers:window.__classReview.map(describe),
            side:P.side,
            startup:window.__heroStartupGate?.phase,
            errors:window.__heroStartupGate?.phase==='fallback',
            count:window.__classReview.length
          };
        });
        const expected=['rifleman','submachinegunner','machinegunner','engineer','captain'];
        assert.deepEqual(result.soldiers.map(x=>x.class),expected,
          'Missing distinct classes: '+JSON.stringify(result));
        assert.equal(result.hero.class,'hero');
        assert.equal(result.hero.kitType,'hero');
        assert.equal(result.startup,'native');
        assert.equal(result.side,'red');
        assert(result.soldiers.every(x=>x.kitType===x.class&&x.meshes>=5&&
          x.visibleMeshCount>=5&&x.skinnedClothing>0&&x.boneBindings>=16),
          'Accessory gear or skeleton missing: '+JSON.stringify(result));
        assert(result.hero.meshes>=5&&result.hero.skinnedClothing>0,
          'Hero is still an undifferentiated regular infantryman');
        assert(new Set(result.soldiers.map(x=>JSON.stringify(x.tint))).size>=5,
          'All German uniforms have the same color');
        assert(new Set(result.soldiers.map(x=>x.headwear)).size>=3,
          'Roles do not have distinguishable headwear');
        assert(!failures.length,'Browser JS exceptions: '+failures.join(';'));
        const jpg=await page.screenshot({
          path:'/tmp/wehrmacht-visual-'+device.name+'.png',
          type:'png',fullPage:false
        });
        const preview=await page.screenshot({type:'jpeg',quality:63});
        console.log('GERMAN_VISUAL_SCREEN_'+device.name.toUpperCase().replace('-','_'),
          preview.toString('base64'));
        console.log('GERMAN_VISUAL_CLASSES_BROWSER_PASS',device.name,
          JSON.stringify(result));
        await context.close();
      }
    }finally{await browser.close()}
  })().catch(e=>{
    console.error('GERMAN_VISUAL_CLASSES_BROWSER_FAIL',e.stack||e);
    process.exitCode=1;
  });
}
