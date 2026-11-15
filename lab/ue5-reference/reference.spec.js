const {test,expect}=require('@playwright/test');
test('Original 90-bone UE5 source animation actually changes bone rotations',async({page})=>{
 test.setTimeout(210000);
 await page.setViewportSize({width:1200,height:850});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:8765/lab/ue5-reference/index.html',{waitUntil:'domcontentloaded'});
 // The scene must render BEFORE remote GLB files arrive.
 await page.waitForFunction(()=>window.__rifle90?.renderFrames>5||window.__rifle90?.error,null,{timeout:30000});
 expect(await page.evaluate(()=>window.__rifle90.renderFrames)).toBeGreaterThan(5);
 await page.waitForFunction(()=>window.__rifle90?.ready||window.__rifle90?.error,null,{timeout:180000});
 const state=await page.evaluate(()=>({ready:window.__rifle90.ready,error:window.__rifle90.error,boneCount:window.__rifle90.boneCount,matched:window.__rifle90.matched}));
 expect(state.error||null).toBeNull();
 expect(state.ready).toBe(true);
 expect(state.boneCount).toBe(90);
 expect(state.matched['rifle-walk-f']).toBeGreaterThan(50);
 expect(state.matched['rifle-aim-level']).toBeGreaterThan(50);
 const sample=()=>page.evaluate(()=>{
  const g=window.__rifle90.groups['rifle-walk-f'];
  return g.targetedAnimations.filter(t=>t.animation.targetProperty==='rotationQuaternion')
   .slice(0,50).map(t=>{const q=t.target.rotationQuaternion;return q?[q.x,q.y,q.z,q.w]:null;});
 });
 await page.locator('[data-clip="rifle-walk-f"]').click();
 const before=await sample();await page.waitForTimeout(520);const after=await sample();
 let changed=0;for(let i=0;i<before.length;i++)if(before[i]&&after[i]&&before[i].some((v,k)=>Math.abs(v-after[i][k])>1e-4))changed++;
 expect(changed,'The walk clip did not animate the target skeleton').toBeGreaterThan(4);
 await page.locator('[data-clip="rifle-aim-level"]').click();
 await page.waitForTimeout(350);
 expect(await page.evaluate(()=>window.__rifle90.clip)).toBe('rifle-aim-level');
 await page.screenshot({path:'test-results/reference-90-aim.png',fullPage:true});
 expect(errors).toEqual([]);
 console.log('RESULT',JSON.stringify({boneCount:state.boneCount,matched:state.matched,changedKeys:changed,errors}));
});

test('A failed remote GLB never produces a silent blank screen',async({page})=>{
 test.setTimeout(60000);
 await page.setViewportSize({width:390,height:844});
 await page.route('**/*.glb',route=>route.abort('failed'));
 await page.goto('http://127.0.0.1:8765/lab/ue5-reference/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__rifle90?.error,null,{timeout:35000});
 // Fast mocked network failures can finish before the sixth render frame.
 // Let the independent scene loop continue briefly before asserting visibility.
 await page.waitForFunction(()=>window.__rifle90?.renderFrames>5,null,{timeout:12000});
 const result=await page.evaluate(()=>({
  frames:window.__rifle90.renderFrames,
  status:document.querySelector('#status').textContent,
  retryVisible:!document.querySelector('#retry').hidden
 }));
 expect(result.frames).toBeGreaterThan(5);
 expect(result.retryVisible).toBe(true);
 expect(result.status).toMatch(/ОШИБКА|HTTP|GLB/i);
 await page.screenshot({path:'test-results/reference-90-load-failure-mobile.png',fullPage:true});
});
