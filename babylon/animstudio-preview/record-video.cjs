const {chromium}=require('/tmp/animstudio-viewer-qa/node_modules/playwright');
const fs=require('node:fs');const {spawnSync}=require('node:child_process');
(async()=>{
 let browser;
 const out='babylon/animstudio-preview/qa';
 fs.mkdirSync(out,{recursive:true});
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const context=await browser.newContext({
   viewport:{width:1280,height:720},deviceScaleFactor:1,
   recordVideo:{dir:out,size:{width:1280,height:720}}
  });
  const page=await context.newPage();
  page.on('pageerror',e=>console.error('VIDEO_PAGE_ERROR',e));
  await page.goto('http://127.0.0.1:8758/babylon/animstudio-preview/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__BATTLEFIELD_ANIMATIONS__?.loaded===true,null,{timeout:90000});
  // Film actual running clips in Babylon, one by one. No generated stills masquerading as motion.
  for(const gun of ['Kar98k','MP40','MG42','Panzerschreck']){
   for(const pose of ['Hold','Aim','Fire','Run']){
    await page.evaluate(async([g,p])=>window.__BATTLEFIELD_ANIMATIONS__.show(g,p),[gun,pose]);
    await page.waitForTimeout(pose==='Fire'?1700:2300);
   }
  }
  const video=page.video();
  await page.close();
  const raw=await video.path();
  await context.close();
  const proc=spawnSync('ffmpeg',['-y','-i',raw,'-an','-vf','fps=15,scale=960:-2',
    '-c:v','libx264','-preset','veryfast','-crf','29','-pix_fmt','yuv420p',out+'/battlefield-16-animations.mp4'],
    {encoding:'utf8'});
  if(proc.status!==0)throw Error('ffmpeg: '+proc.stderr.slice(-2000));
  console.log('ANIMSTUDIO_16_ANIMATION_VIDEO',out+'/battlefield-16-animations.mp4',fs.statSync(out+'/battlefield-16-animations.mp4').size);
 }catch(e){console.error('ANIMSTUDIO_VIDEO_ERROR',e);process.exitCode=1}
 finally{await browser?.close()}
})();