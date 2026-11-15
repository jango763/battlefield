const {test,expect}=require('@playwright/test');
test('Muster original German rifleman is rendered, without our custom clothes',async({page})=>{
 test.setTimeout(180000);
 const runtimeErrors=[];
 page.on('pageerror',e=>runtimeErrors.push(String(e)));
 await page.setViewportSize({width:1280,height:900});
 await page.goto('http://127.0.0.1:8765/?asset=germany/rifleman&views=q-front,front,q-rear&cols=3&w=1500&h=900&detail=low',
  {waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:150000});
 const info=await page.evaluate(()=>({error:window.__error||null,stats:window.__stats||null,
  rendered:Boolean(window.__png?.startsWith('data:image/png;base64,')),
  size:[document.querySelector('canvas#out')?.width,document.querySelector('canvas#out')?.height]}));
 console.log('ORIGINAL_MUSTER_RIFLEMAN '+JSON.stringify(info));
 expect(info.error).toBeNull();
 expect(info.stats?.id).toBe('de-rifleman');
 expect(info.stats?.triangles).toBeGreaterThan(5000);
 expect(info.size).toEqual([1500,900]);
 expect(info.rendered).toBe(true);
 expect(runtimeErrors).toEqual([]);
 await page.screenshot({path:'test-results/original-M40-Kar98k.png',fullPage:true});
});
