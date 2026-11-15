const {test,expect}=require('@playwright/test');
test('Audit skinned model material slots and rig attachment joints',async({page})=>{
 test.setTimeout(120000);
 await page.goto('http://127.0.0.1:8765/lab/wehrmacht90/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__rifle90?.ready||window.__rifle90?.error,null,{timeout:110000});
 const info=await page.evaluate(()=>({error:window.__rifle90.error,bones:window.__rifle90.boneCount,materials:window.__rifle90.modelAudit}));
 console.log('WEHRMACHT_AUDIT '+JSON.stringify(info));
 expect(info.error).toBeNull();expect(info.bones).toBe(90);
 expect(info.materials.meshes.length).toBeGreaterThan(0);
 await page.screenshot({path:'test-results/wehrmacht-before.png'});
});