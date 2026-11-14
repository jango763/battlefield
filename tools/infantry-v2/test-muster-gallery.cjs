'use strict';
// Actual original Muster GLB assets must load in the real Battlefield scene,
// with normal gameplay unmodified. These are STATIC reference models.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const loader=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
const preview=fs.readFileSync(path.join(root,'preview/muster-british-review.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/muster-british/manifest.json'),'utf8'));
new Function(preview);
const script=loader.match(/<script>([\s\S]*?)<\/script>/);
assert(script);
new Function(script[1]);
assert(loader.includes("musterBritishPreviewTick();"));
assert(loader.includes("work[1]"));
assert.equal(manifest.models.length,3);
assert(manifest.models.every(x=>fs.existsSync(path.join(root,'assets/muster-british',x.file))));
assert(manifest.animated===false);
console.log('MUSTER_STATIC_QA_PASS',manifest.models.map(x=>({id:x.id,triangles:x.triangles,bytes:x.bytes})));
if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/muster-gallery-qa/node_modules/playwright');
  (async()=>{
    const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
    try{
      for(const device of [
        {name:'desktop',viewport:{width:1280,height:850}},
        {name:'mobile-chromium',viewport:{width:390,height:844},
          userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
      ]){
        const context=await browser.newContext({
          viewport:device.viewport,
          deviceScaleFactor:1,
          ...(device.userAgent?{userAgent:device.userAgent,isMobile:true,hasTouch:true}:{})
        });
        const page=await context.newPage();
        const errors=[];page.on('pageerror',e=>{
          if(!/No parent to post message/.test(e.message))errors.push(e.message)
        });
        await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=muster&armyRig=off',
          {waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForFunction(()=>{
          try{return window.__musterBritishModels?.length===3||
            (typeof musterBritishPreview!=='undefined'&&musterBritishPreview.errors.length>0);}
          catch(e){return false;}
        },null,{timeout:180000});
        const stats=await page.evaluate(()=>{
          return{
            models:musterBritishPreview.models.map(v=>({role:v.role,height:v.height,scale:v.scale,visible:v.object.visible,
              materials:(()=>{let n=0;v.object.traverse(x=>{if(x.isMesh)n++});return n;})()})),
            errors:musterBritishPreview.errors,
            playerSide:P.side,playerHealth:P.hp,
            label:document.getElementById('muster-british-review')?.textContent
          };
        });
        assert.equal(stats.models.length,3,'All three original Muster GLBs must load: '+JSON.stringify(stats));
        assert.deepEqual(stats.models.map(x=>x.role).sort(),['bren','leader','rifleman']);
        assert(stats.models.every(x=>x.height>1.2&&x.height<2.5&&x.materials>20),'Invalid model dimensions');
        assert.equal(stats.errors.length,0,'GLB load errors');
        assert(!errors.length,'Uncaught browser errors: '+JSON.stringify(errors));
        const screenshot=await page.screenshot({
          path:'/tmp/muster-gallery-'+device.name+'.png',
          type:'png'
        });
        const jpeg=await page.screenshot({type:'jpeg',quality:58});
        console.log('MUSTER_GALLERY_SCREENSHOT_'+device.name.toUpperCase().replace('-','_'),
          jpeg.toString('base64'));
        if(device.name==='desktop'){
          const bones=await page.evaluate(()=>{
            const r=P.germanPreview?.nativeRig,records=[];
            r?.model?.traverse(n=>{
              if(n.isBone){
                const pos=n.getWorldPosition(new THREE.Vector3());
                records.push({name:n.name,x:pos.x,y:pos.y,z:pos.z});
              }
            });
            return records;
          });
          console.log('MUSTER_NATIVE_RIG_BONES',JSON.stringify(bones));
        }
        console.log('MUSTER_BROWSER_PASS',device.name,JSON.stringify(stats));
        await context.close();
      }
    }finally{await browser.close()}
  })().catch(e=>{console.error('MUSTER_BROWSER_FAIL',e.stack||e);process.exitCode=1;});
}
