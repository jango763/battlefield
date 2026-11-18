"use strict";
const {chromium}=require("/tmp/british-stage2-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/british-stage9";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},
  deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 try{
  await page.goto("http://127.0.0.1:8799/babylon/british-stage9-iphone.html",
   {waitUntil:"domcontentloaded",timeout:55000});
  await page.waitForFunction(()=>window.__BRITISH_STAGE9_QA__?.ready||
    window.__BRITISH_STAGE9_QA__?.error,null,{timeout:110000});
  const initial=await page.evaluate(()=>{
   const q=window.__BRITISH_STAGE9_QA__,p=q.getPlan(),s=q.getSnapshot();
   return {ready:q.ready,error:q.error,stage:q.stage,slots:q.totalSlots,
    hero:q.hero,infantry:q.infantry,commando:q.commando,
    verified:q.originalBritishSkin,visualSpawns:q.modelSpawns,
    headwear:p.slots.slice(1).map(x=>x.headwear),
    icons:document.querySelectorAll("#board .marker").length,
    roles:document.querySelectorAll("#roster .roster-item").length,
    alliesAlive:s.alliesAlive,enemiesAlive:s.enemiesAlive,
    active:s.active};
  });
  console.log("BRITISH_STAGE9_INITIAL",JSON.stringify(initial));
  if(initial.error||!initial.ready||initial.stage!==9||initial.slots!==12||
   initial.hero!==1||initial.infantry!==8||initial.commando!==3||
   initial.verified||initial.visualSpawns!==0||initial.icons!==16||
   initial.roles!==12||initial.active||initial.alliesAlive!==12||
   initial.enemiesAlive!==4||
   initial.headwear.filter(x=>x==="steel-mk2-helmet").length!==8||
   initial.headwear.filter(x=>x==="beret").length!==3)
   throw Error("Stage9 model inventory/spawn honesty/roles failed "+
    JSON.stringify(initial));
  await page.screenshot({path:dir+"/twelve-army-slots-no-fake-skins.png",fullPage:true});
  await page.locator('[data-formation="semicircle"]').click();
  const half=await page.evaluate(()=>({
   mode:window.__BRITISH_STAGE9_QA__.mode,
   formation:window.__BRITISH_STAGE9_QA__.getSnapshot().formation,
   active:document.querySelector('[data-formation="semicircle"]').getAttribute("aria-pressed")
  }));
  if(half.mode!=="semicircle"||half.formation!=="semicircle"||half.active!=="true")
   throw Error("Semicircle formation broken "+JSON.stringify(half));
  await page.screenshot({path:dir+"/semicircle-formation.png",fullPage:true});
  await page.locator('[data-formation="turtle"]').click();
  const turtle=await page.evaluate(()=>({
   mode:window.__BRITISH_STAGE9_QA__.mode,
   fronts:window.__BRITISH_STAGE9_QA__.getSnapshot().fronts,
   formation:window.__BRITISH_STAGE9_QA__.getSnapshot().formation
  }));
  if(turtle.mode!=="turtle"||turtle.fronts.length!==3||
   turtle.fronts.some((r,i)=>r.slot!==i+1))
   throw Error("Turtle formation not hero-rear / three-front "+JSON.stringify(turtle));
  await page.locator('.roster-item[data-slot="9"]').click();
  const actor=await page.evaluate(()=>({
   slot:window.__BRITISH_STAGE9_QA__.selectedSlot,
   details:document.getElementById("details").textContent
  }));
  if(actor.slot!==9||!actor.details.includes("берет"))
   throw Error("Commando is not independent visual role "+JSON.stringify(actor));
  await page.locator("#weapon").selectOption("uk-sten");
  await page.locator("#equip").click();
  const armed=await page.evaluate(()=>({
   slot:window.__BRITISH_STAGE9_QA__.selectedSlot,
   weapon:window.__BRITISH_STAGE9_QA__.getSnapshot().soldiers[9].weapon,
   first:window.__BRITISH_STAGE9_QA__.getSnapshot().soldiers[1].weapon,
   originals:window.__BRITISH_STAGE9_QA__.originalBritishSkin,
   stats:window.__BRITISH_STAGE9_QA__.modelSpawns
  }));
  if(armed.slot!==9||armed.weapon!=="MP40"||armed.first!=="Kar98k"||
   armed.originals||armed.stats!==0)
   throw Error("Independent armament or UK source gate failed "+JSON.stringify(armed));
  await page.screenshot({path:dir+"/commando-weapon-at-base.png",fullPage:true});
  await page.locator("#start").click();
  await page.waitForFunction(()=>window.__BRITISH_STAGE9_QA__?.active||
   window.__BRITISH_STAGE9_QA__?.error,null,{timeout:15000});
  const active=await page.evaluate(()=>({
   active:window.__BRITISH_STAGE9_QA__.active,
   equipDisabled:document.getElementById("equip").disabled,
   roles:window.__BRITISH_STAGE9_QA__.getSnapshot().soldiers.slice(0,12).map(s=>s.role),
   scene:document.querySelectorAll("#board .marker").length,
   shots:window.__BRITISH_STAGE9_QA__.getSnapshot().totalShots
  }));
  if(!active.active||!active.equipDisabled||active.scene!==16||
   active.roles.filter(x=>x==="commando").length!==3)
   throw Error("British trial battle lost independent roles "+JSON.stringify(active));
  await page.screenshot({path:dir+"/squad-combat-simulation.png",fullPage:true});
  await page.locator("#stop").click();
  await page.locator("#reset").click();
  const reset=await page.evaluate(()=>({
   active:window.__BRITISH_STAGE9_QA__.active,
   mode:window.__BRITISH_STAGE9_QA__.mode,
   selected:window.__BRITISH_STAGE9_QA__.selectedSlot,
   shots:window.__BRITISH_STAGE9_QA__.getSnapshot().totalShots,
   allAlive:window.__BRITISH_STAGE9_QA__.getSnapshot().alliesAlive,
   noneLoaded:!window.__BRITISH_STAGE9_QA__.originalBritishSkin,
   3dActors:window.__BRITISH_STAGE9_QA__.modelSpawns
  }));
  if(reset.active||reset.mode!=="turtle"||reset.selected!==1||
   reset.shots!==0||reset.allAlive!==12||!reset.noneLoaded||
   reset["3dActors"]!==0||errors.length)
   throw Error("Army stage9 reset/3D honesty regression "+
    JSON.stringify({reset,errors}));
  await page.screenshot({path:dir+"/reset-all-army-slots.png",fullPage:true});
  console.log("BRITISH_STAGE9_MOBILE_PASS",JSON.stringify({
   hero:1,infantry:8,commando:3,trainingSlots:12,
   modelActorsInstalled:0,turtle:true,semicircle:true,
   separateWeaponInventory:true,authenticBattleCore:true,
   unsafe3dSpawnBlocked:true,reset:true
  }));
 }catch(e){
  console.error("BRITISH_STAGE9_MOBILE_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
