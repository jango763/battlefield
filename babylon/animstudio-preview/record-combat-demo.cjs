const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
(async()=>{
 let browser;
 const out='babylon/animstudio-preview/combat-qa';
 fs.mkdirSync(out,{recursive:true});
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const context=await browser.newContext({viewport:{width:1280,height:800},
   deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1280,height:800}}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html?combatDemo=1',
    {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.ready===true,
    null,{timeout:90000});
  await page.waitForTimeout(900);
  await page.click('#combat-play');
  await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.done===true,
    null,{timeout:45000});
  const rifle=await page.evaluate(()=>window.__BATTLEFIELD_COMBAT_DEMO__);
  if(rifle.errors.length||rifle.state?.fired!==1||rifle.state?.boltCount!==1)
    throw Error('Rifle demo invalid '+JSON.stringify(rifle.errors));
  await page.waitForTimeout(800);
  await page.click('#combat-pz');
  await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.weapon==='Panzerschreck',
    null,{timeout:30000});
  await page.click('#combat-camera');
  await page.waitForTimeout(400);
  await page.click('#combat-play');
  await page.waitForFunction(()=>window.__BATTLEFIELD_COMBAT_DEMO__?.done===true,
    null,{timeout:45000});
  const launcher=await page.evaluate(()=>window.__BATTLEFIELD_COMBAT_DEMO__);
  if(launcher.errors.length||launcher.state?.fired!==1||launcher.state?.boltCount!==0)
    throw Error('Rocket demo invalid '+JSON.stringify(launcher.errors));
  await page.waitForTimeout(700);
  if(errors.length)throw Error('Browser errors '+JSON.stringify(errors));
  const v=page.video();
  await page.close();
  const raw=await v.path();
  await context.close();
  const dest=path.join(out,'Battlefield-Kar98k-Panzerschreck-Combat-Cycle.mp4');
  const proc=spawnSync('ffmpeg',['-y','-i',raw,'-an','-vf','fps=15,scale=960:-2',
    '-c:v','libx264','-preset','veryfast','-crf','27','-pix_fmt','yuv420p',dest],{encoding:'utf8'});
  if(proc.status!==0)throw Error('Video encoding failed: '+proc.stderr.slice(-1300));
  console.log('BABYLON_COMBAT_VIDEO_PASS',dest,fs.statSync(dest).size);
 }catch(e){console.error('BABYLON_COMBAT_VIDEO_FAILED',e);process.exitCode=1}
 finally{await browser?.close()}
})();