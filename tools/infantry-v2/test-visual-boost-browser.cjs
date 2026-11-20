'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('/tmp/bf-threejs-visual/node_modules/playwright');
const path='visual-qa/threejs-original';
fs.mkdirSync(path,{recursive:true});
const results=[];
async function verify(type,name,graphics){
 const browser=await type.launch({headless:true,
  ...(name==='chromium'?{args:['--no-sandbox','--use-gl=angle',
   '--use-angle=swiftshader','--enable-webgl']}: {})});
 const errors=[];
 const page=await browser.newPage({viewport:{width:390,height:844},
  deviceScaleFactor:1,isMobile:true,hasTouch:true});
 page.on('pageerror',e=>errors.push(e.message));
 const result={browser:name,graphics,pass:false};
 try{
  const qs=graphics==='original'?'?graphics=original':'?graphics=boost';
  await page.goto('http://127.0.0.1:8856/preview/formation-replenishment-v3.html'+qs,
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>{
   try{
    return (typeof P!=='undefined'&&typeof gr!=='undefined'&&
     typeof R!=='undefined'&&R.domElement?.isConnected) ||
     !!document.querySelector('#retry:not([hidden])');
   }catch(e){return false;}
  },null,{timeout:150000});
  const error=await page.evaluate(()=>document.getElementById('error')?.textContent||'');
  if(error?.trim())throw Error('Original loader failed: '+error);
  // Wait until approved hero model is visible, avoiding splash-screen QA.
  await page.waitForFunction(()=>{
   try{return !!germanPreview.startupHeroReady;}catch(e){return false}
  },null,{timeout:110000});
  await page.waitForTimeout(450);
  result.game=await page.evaluate(()=>{
   const visual=window.__BATTLEFIELD_VISUAL_BOOST__||null;
   const texture=gr.material.map;
   return {
    visual,
    worldArt:window.__BATTLEFIELD_WORLD_ART__||null,
    versionLabel:document.getElementById('graphics-build-label')?.textContent||null,
    materialReport:scene.children.filter(group=>group.isGroup&&
      group.children.some(mesh=>mesh.isMesh&&
       String(mesh.material?.name||'').startsWith('WWII-textured-'))).length,
    forestCrowns:scene.children.filter(mesh=>mesh.name==='visual-only-live-pines-crowns').length,
    textureSites:{
     objectiveMeshes:PTS.filter(pt=>pt.g.children.some(m=>m?.material?.map?.name?.startsWith('battlefield-ww2-'))).length,
     bunkers:TW.filter(t=>t.g?.children.some(m=>m?.material?.map?.name?.startsWith('battlefield-ww2-'))).length,
     bases:scene.children.filter(g=>g.isGroup&&Math.abs(Math.abs(g.position.x)-88)<.01&&
      g.children.some(m=>m?.material?.map?.name?.startsWith('battlefield-ww2-'))).length
    },
    groundWidth:texture?.image?.width,
    groundHeight:texture?.image?.height,
    groundRepeat:[texture.repeat.x,texture.repeat.y],
    cameras:{fov:cam.fov,y:cam.position.y},
    units:U.length,
    heroAlive:P.hp>0,
    moveInputPresent:typeof moveInput!=='undefined'||!!document.querySelector('canvas'),
    canvas:!!R.domElement?.isConnected,
    controls:!!document.querySelector('[id]'),
    pixelRatio:R.getPixelRatio(),
    source:scene.isScene?'original THREE.Scene':'unknown',
    ruins:scene.children.filter(x=>x.name==='visual-only-ruin-contact-shadows').length
   };
  });
  if(graphics==='boost'){
   assert(result.game.visual,'Visual pass was not installed');
   assert(!result.game.visual.error,'Visual pass error: '+result.game.visual.error);
   assert.equal(result.game.groundWidth,1024,'Old ground is still low resolution');
   assert.equal(result.game.groundHeight,768);
   assert.deepEqual(result.game.groundRepeat,[1,1],'Terrain is still heavily tiled');
   assert(result.game.visual.props>=400,'Lack of vegetation and ruins');
   assert(result.game.ruins>0,'Ruin contact shadows missing');
   assert(result.game.pixelRatio<=1.65,'iPhone pixel ratio not capped');
   assert(result.game.worldArt,'WWII texture maps not installed');
   assert.equal(Object.keys(result.game.worldArt.textures).length,6,
    'Missing some high-resolution material maps');
   assert(result.game.worldArt.texturedWalls>=40,
    'Original ruins still use untextured flat-color materials');
   assert(result.game.worldArt.texturedRuins>=10,
    'Textured ruins missing from main scene');
   assert(result.game.forestCrowns>=1,'New forest details are invisible');
   assert.equal(result.game.textureSites.objectiveMeshes,5,
    'Some capture buildings still have flat walls');
   assert(result.game.worldArt.texturedBunkers>=5,'Bunker texture import missing');
   assert.equal(result.game.textureSites.bases,2,
    'Both faction HQs must be textured');
   assert.equal(result.game.worldArt.errors.length,0,
    'Actual game structure texture load failed');
   assert(result.game.versionLabel?.includes('HD'),'New game lacks version label');
  }else{
   assert.equal(result.game.visual,null,'Original bypass must not touch scene');
   assert.equal(result.game.groundWidth,256,'Comparison no longer original');
   assert.equal(result.game.worldArt,null,'HD materials leaked into approved original mode');
   assert(result.game.versionLabel?.includes('ОРИГИНАЛ'),'Original version label absent');
  }
  assert.equal(result.game.source,'original THREE.Scene','Engine was replaced');
  assert.equal(result.game.cameras.fov,40,'Approved camera angle changed');
  assert(result.game.heroAlive,'Approved hero missing');
  assert(result.game.canvas&&result.game.controls,'Playable controls missing');
  assert(errors.filter(e=>!/No parent to post message|ResizeObserver loop/i.test(e)).length===0,
   'New JS errors: '+errors.join(' | '));
  await page.screenshot({path:path+'/'+name+'-'+graphics+'-iphone.png'});
  result.pass=true;
 }catch(e){
  result.error=String(e?.stack||e);
  result.pageErrors=errors;
  await page.screenshot({path:path+'/'+name+'-'+graphics+'-FAILED.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{await page.close();await browser.close();}
 results.push(result);
 console.log('THREEJS_VISUAL_BROWSER_QA',name,graphics,JSON.stringify(result).slice(0,4000));
}
(async()=>{
 await verify(chromium,'chromium','original');
 await verify(chromium,'chromium','boost');
 await verify(webkit,'webkit','boost');
 fs.writeFileSync(path+'/report.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
