const {test,expect}=require('@playwright/test');
test.setTimeout(120000);
for(const config of [{name:'desktop',width:1280,height:900},{name:'phone-sized',width:390,height:844}]){
 test('65-bone animation: '+config.name,async({page},testInfo)=>{
  await page.setViewportSize({width:config.width,height:config.height});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:8765/lab/rig-pose/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__rig65?.ready||window.__rig65?.error,{timeout:90000});
  let result=await page.evaluate(()=>({ready:window.__rig65.ready,error:window.__rig65.error,rig:window.__rig65.rig,tracks:window.__rig65.tracks}));
  expect(result.error,'Initialization failure').toBeNull();
  expect(result.ready).toBe(true);
  expect(result.rig.bones).toBe(65);
  expect(Object.values(result.tracks).every(n=>n>=60)).toBe(true);
  await page.locator('[data-mode="aim"]').click();
  await page.waitForTimeout(900);
  const pose=await page.evaluate(()=>window.__rig65.pose);
  await page.screenshot({path:'test-results/rig-aim-'+config.name+'.png',fullPage:true});
  console.log('Rig validation '+config.name,JSON.stringify({result,pose,errors}));
  expect(errors,'Browser runtime errors').toEqual([]);
  expect(pose,'No IK pose computed').toBeTruthy();
  expect(pose.animated,'All arm joints failed to move').toBe(true);
  expect(pose.passes,'IK residual or elbow-angle acceptance failed').toBe(true);
  await page.locator('[data-mode="idle"]').click();
  await page.waitForTimeout(600);
  expect(await page.evaluate(()=>window.__rig65.mode)).toBe('idle');
 });
}
