// Automated Babylon soldier checks. Run: npm install --no-save playwright
// then npx playwright install chromium; node babylon/tests/verify-combat.mjs
import { chromium } from 'playwright';
const url=process.env.BATTLEFIELD_LAB_URL || 'http://127.0.0.1:8765/babylon/prototypes/armory.html';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>window.__babylonLab?.ready||window.__babylonLab?.error,{timeout:60000});
 const initial=await page.evaluate(()=>({ready:window.__babylonLab.ready,error:window.__babylonLab.error,mapped:window.__babylonLab.mappedTracks}));
 if(!initial.ready)throw Error('Model not ready: '+initial.error);
 for(const mode of ['idle','jog','sprint','combat','idle','combat']){
  await page.locator('[data-clip="'+mode+'"]').click();
  await page.waitForTimeout(400);
  const state=await page.evaluate(()=>({mode:window.__babylonLab.animation,pose:window.__babylonLab.combatPoseStatus,accept:window.__babylonLab.combatAcceptance,error:window.__babylonLab.poseError,weapon:window.__babylonLab.weaponAttached,rig:window.__babylonLab.rigAudit}));
  console.log(mode,JSON.stringify(state));
  if(state.mode!==mode||state.error||!state.weapon)throw Error('Broken mode '+mode+': '+JSON.stringify(state));
  if(mode==='combat'){
   await page.screenshot({path:'combat-inspection.png'});
   if(!state.accept?.passed)throw Error('Combat grip failed geometric gate: '+JSON.stringify(state));
  }
 }
 if(errors.length)throw Error('Browser errors: '+errors.join(' | '));
 console.log('PASS: six mode transitions and combat geometry; screenshot: combat-inspection.png');
} catch(error){
 await page.screenshot({path:'combat-failure.png',fullPage:true}).catch(()=>{});
 console.error('FAIL:',error);
 process.exitCode=1;
} finally {await browser.close();}
