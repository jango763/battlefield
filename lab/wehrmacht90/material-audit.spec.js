const {test,expect}=require('@playwright/test');
for(const cfg of [{name:'desktop',width:1200,height:850},{name:'mobile',width:390,height:844}]){
 test('Wehrmacht M40 dress + native 90-bone clips / '+cfg.name,async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setViewportSize({width:cfg.width,height:cfg.height});
  await page.goto('http://127.0.0.1:8765/lab/wehrmacht90/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__rifle90?.ready||window.__rifle90?.error,null,{timeout:110000});
  const state=await page.evaluate(()=>({
   error:window.__rifle90.error,bones:window.__rifle90.boneCount,
   matched:window.__rifle90.matched,wardrobe:window.__rifle90.wardrobe,materials:window.__rifle90.modelAudit
  }));
  console.log('WEHRMACHT_AUDIT '+JSON.stringify({bones:state.bones,matched:state.matched,wardrobe:state.wardrobe,materials:state.materials}));
  expect(state.error,'No fatal GLB load errors').toBeNull();expect(state.bones).toBe(90);
  expect(state.wardrobe?.ready,'Uniform installation failed: '+JSON.stringify(state.wardrobe)).toBe(true);
  expect(state.wardrobe.coloredVertices).toBeGreaterThan(10000);
  expect(state.wardrobe.kitParts).toBeGreaterThan(20);
  expect(state.wardrobe.sleeveParts).toBe(6);
  expect(state.wardrobe.errors).toEqual([]);
  expect(state.wardrobe.capMeshCounts.m43).toBeGreaterThan(0);
  expect(state.wardrobe.capMeshCounts.sidecap).toBeGreaterThan(0);
  expect(state.matched['rifle-walk-f']).toBeGreaterThan(50);
  await page.screenshot({path:'test-results/wehrmacht-m43-'+cfg.name+'.png',fullPage:true});
  await page.locator('[data-headwear="sidecap"]').click();
  expect(await page.evaluate(()=>window.__rifle90.wardrobe.selected)).toBe('sidecap');
  await page.screenshot({path:'test-results/wehrmacht-sidecap-'+cfg.name+'.png',fullPage:true});
  await page.locator('[data-clip="rifle-walk-f"]').click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>window.__rifle90.clip)).toBe('rifle-walk-f');
  await page.locator('[data-clip="rifle-aim-level"]').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.__rifle90.clip)).toBe('rifle-aim-level');
  await page.screenshot({path:'test-results/wehrmacht-aim-'+cfg.name+'.png',fullPage:true});
  expect(errors).toEqual([]);
 });
}