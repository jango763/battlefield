const {chromium}=require('/tmp/bf-pc-playwright/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const external=[],errors=[],failed=[];
 await page.route('**/*',r=>{const url=r.request().url();if(/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:8877/')){external.push(url);return r.abort();}return r.continue();});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('requestfailed',r=>failed.push({url:r.url(),reason:r.failure()?.errorText}));
 try{
  await page.goto('http://127.0.0.1:8877/babylon/index.html?quality=low',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__BATTLEFIELD_GAME__?.ready||window.__BATTLEFIELD_GAME__?.error||document.getElementById('enter-game')?.textContent.includes('Не удалось'),null,{timeout:180000});
  const state=await page.evaluate(()=>({ready:!!window.__BATTLEFIELD_GAME__?.ready,error:window.__BATTLEFIELD_GAME__?.error,engine:window.BABYLON?.Engine?.Version,button:document.getElementById('enter-game')?.textContent}));
  console.log(JSON.stringify({state,external,errors,failed},null,2));
  if(!state.ready||state.error||external.length)throw Error('Offline startup failed');
  await page.locator('#enter-game').click({timeout:10000});
  await page.waitForTimeout(1500);
  await page.screenshot({path:'pc-qa.png'});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
