'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const playwright=require('/tmp/bf-acceptance/node_modules/playwright');
const name=process.argv[2]||'chromium',out='babylon-qa-results/modernization';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await playwright[name].launch({headless:true,...(name==='chromium'?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{})});
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const report={browser:name,errors:[],requests:[],success:false};
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('requestfailed',r=>report.requests.push({url:r.url(),error:r.failure()?.errorText}));
 try{
  await page.goto('http://127.0.0.1:8877/babylon/index.html?quality=low',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||window.__BATTLEFIELD_GAME__?.error,null,{timeout:180000});
  report.loaded=await page.evaluate(()=>JSON.parse(JSON.stringify(window.__BATTLEFIELD_GAME__)));
  assert(report.loaded.ready&&!report.loaded.error,report.loaded.error||'Game not ready');
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.vehicleBounds?.length===3,null,{timeout:90000});
  report.vehicles=await page.evaluate(()=>window.__BATTLEFIELD_GAME__.vehicleBounds);
  for(const b of report.vehicles){assert(Math.abs(b.minY-.025)<.02,'Floating APC: '+JSON.stringify(b));assert(b.height<5&&b.height>1,'Vertical APC: '+JSON.stringify(b));}
  await page.locator('#enter-game').click();
  await page.waitForTimeout(2500);
  await page.screenshot({path:out+'/'+name+'-field.png'});
  report.scene=await page.evaluate(()=>{const s=BABYLON.EngineStore.LastCreatedScene;return {meshes:s.meshes.length,fps:s.getEngine().getFps(),glbs:window.__BATTLEFIELD_GAME__.models,hero:window.__BATTLEFIELD_GAME__.heroPosition,navigation:window.__BATTLEFIELD_GAME__.navigation};});
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.success=true;
 }catch(e){report.error=String(e.stack||e);process.exitCode=1;await page.screenshot({path:out+'/'+name+'-FAILED.png'}).catch(()=>{});}
 finally{fs.writeFileSync(out+'/'+name+'.json',JSON.stringify(report,null,2));console.log('MODERNIZATION_BROWSER',JSON.stringify(report));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
