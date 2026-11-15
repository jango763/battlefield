const {chromium}=require('/tmp/karfit-pw/node_modules/playwright');
const fs=require('fs');
(async()=>{
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
 for(const screen of [{label:'desktop',width:1200,height:850,mobile:false},{label:'mobile',width:390,height:844,mobile:true}]){
  const page=await browser.newPage({viewport:{width:screen.width,height:screen.height},deviceScaleFactor:1,
    isMobile:screen.mobile,hasTouch:screen.mobile});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/lab/original-panzergrenadier/index.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.__PANZER_PREVIEW__?.ready===true,null,{timeout:75000});
  const state=await page.evaluate(()=>window.__PANZER_PREVIEW__);
  console.log('KAR98K_FIT_'+screen.label+' '+JSON.stringify({state,errors}));
  if(state.error||errors.length)throw Error('Page errors '+JSON.stringify({state,errors}));
  if(state.bones!==65||state.skinnedMeshes!==5||state.weaponStatus!=='ready'||state.weaponId!=='de-kar98k'||state.weaponMeshCount<50)
    throw Error('Soldier or weapon load failed: '+JSON.stringify(state));
  if(!Number.isFinite(state.grip?.right?.distance)||!Number.isFinite(state.grip?.left?.distance)
     ||state.grip.right.distance>.20||state.grip.left.distance>.20)
     throw Error('Grip gaps exceed 20cm: '+JSON.stringify(state.grip));
  fs.mkdirSync('kar98k-fit-results',{recursive:true});
  await page.waitForTimeout(450);
  await page.screenshot({path:'kar98k-fit-results/kar98k-'+screen.label+'-quarter.png'});
  await page.locator('[data-view=front]').click();
  await page.waitForTimeout(280);
  await page.screenshot({path:'kar98k-fit-results/kar98k-'+screen.label+'-front.png'});
  await page.locator('[data-view=side]').click();
  await page.waitForTimeout(280);
  await page.screenshot({path:'kar98k-fit-results/kar98k-'+screen.label+'-side.png'});
  if(screen.label==='desktop'){
    await page.evaluate(()=>{
      const v=window.__PANZER_DIAG__;
      const THREE=window.THREE;
      v.controls.target.set(0,1.3,.1);
      v.camera.position.set(.55,1.55,1.63);
      v.camera.lookAt(v.controls.target);v.controls.update();
    });
    await page.waitForTimeout(500);
    await page.screenshot({path:'kar98k-fit-results/kar98k-close-hands.png'});
  }
  await page.close();
 }
 console.log('KAR98K_FITTING_CHECKS_OK');
}catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();}
})();
