const {chromium}=require('/tmp/panzer-pw/node_modules/playwright');
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
   await page.waitForFunction(()=>window.__PANZER_PREVIEW__?.ready===true,null,{timeout:90000});
   const state=await page.evaluate(()=>window.__PANZER_PREVIEW__);
   console.log('ORIGINAL_PANZER_'+screen.label+' '+JSON.stringify({state,errors}));
   if(state.error||errors.length)throw Error('Page errors '+JSON.stringify({state,errors}));
   if(state.bones<60||state.meshes<4||state.skinnedMeshes<1||!state.originalMaterials)
    throw Error('Not the native Panzergrenadier mesh: '+JSON.stringify(state));
   fs.mkdirSync('panzer-test-results',{recursive:true});
   await page.waitForTimeout(500);
   await page.screenshot({path:'panzer-test-results/panzer-original-'+screen.label+'-quarter.png'});
   await page.locator('[data-view=front]').click();
   await page.waitForTimeout(350);
   await page.screenshot({path:'panzer-test-results/panzer-original-'+screen.label+'-front.png'});
   await page.locator('[data-view=side]').click();
   await page.waitForTimeout(350);
   await page.screenshot({path:'panzer-test-results/panzer-original-'+screen.label+'-side.png'});
   await page.close();
  }
  console.log('ORIGINAL_PANZER_TESTS_OK');
 }catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();}
})();
