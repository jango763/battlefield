'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('/tmp/battlefield-actual-allies/node_modules/playwright');
const ROOT='babylon-qa-results/actual-three-soldier-integrated';
fs.mkdirSync(ROOT,{recursive:true});
async function inspect(browserType,name){
 const browser=await browserType.launch({headless:true,...(name==='chromium'
  ?{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result={browser:name,success:false,checkpoints:[]};
 try{
  await page.goto('http://127.0.0.1:8855/babylon/index.html',{waitUntil:'domcontentloaded',timeout:75000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||!!window.__BATTLEFIELD_GAME__?.error,
    null,{timeout:150000});
  let state=await page.evaluate(()=>({...window.__BATTLEFIELD_GAME__}));
  result.initialState=state;
  console.log('REAL_ALLIED_INITIAL_STATE',name,JSON.stringify(state).slice(0,6000));
  assert(!state.error,JSON.stringify({error:state.error,modelErrors:state.modelErrors}));
  assert(state.ready,'Main game never became ready');
  assert(state.importedAlliedCount>=1,'Approved real US hero missing from initial duel');
  assert(!state.modelErrors.americanHero,'US hero file rejected: '+state.modelErrors.americanHero);
  result.checkpoints.push({step:'duel',models:state.models,importedAllies:state.importedAlliedCount});
  await page.screenshot({path:ROOT+'/'+name+'-hero-duel.png'});
  await page.locator('#enter-game').click();
  await page.locator('[data-scenario="squads"]').click();
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.models>=24||
    !!window.__BATTLEFIELD_GAME__?.error,null,{timeout:200000});
  state=await page.evaluate(()=>({...window.__BATTLEFIELD_GAME__}));
  result.fullState=state;
  assert(!state.error,JSON.stringify({error:state.error,modelErrors:state.modelErrors}));
  assert.equal(state.models,24,'24 independent soldier instances');
  assert.equal(state.importedAlliedCount,9,'US hero and eight real Jakeli British infantry');
  assert(!state.modelErrors.britishJakeli,'Jakeli import failed: '+state.modelErrors.britishJakeli);
  assert(!state.modelErrors.americanHero);
  result.checkpoints.push({step:'squads',models:state.models,importedAllies:state.importedAlliedCount});
  await page.screenshot({path:ROOT+'/'+name+'-24-soldiers.png'});
  assert.equal(errors.length,0,'Browser scripts failed: '+errors.join('|'));
  result.success=true;
 }catch(e){
  result.error=String(e.stack||e);result.pageErrors=errors;
  await page.screenshot({path:ROOT+'/'+name+'-failure.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{await browser.close();}
 return result;
}
(async()=>{
 const results=[await inspect(chromium,'chromium'),await inspect(webkit,'webkit')];
 fs.writeFileSync(ROOT+'/report.json',JSON.stringify(results,null,2));
 console.log('BATTLEFIELD_REAL_ALLIES_MAIN_GAME_QA',JSON.stringify(results.map(x=>({
  browser:x.browser,success:x.success,checkpoints:x.checkpoints,error:x.error||null}))));
})().catch(e=>{console.error(e);process.exitCode=1});
