"use strict";
const {chromium}=require("/tmp/stage9-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/us-hero-stage9";
const BASE="http://127.0.0.1:8799/babylon/us-hero-stage9-iphone.html";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({
  headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]
 });
 const page=await browser.newPage({viewport:{width:390,height:844},
   deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 try{
  // Deterministic hits for the CI only; normal iPhone visitors use native RNG.
  await page.addInitScript(()=>{Math.random=()=>0;});
  await page.goto(BASE,{waitUntil:"domcontentloaded",timeout:50000});
  await page.waitForFunction(()=>window.__US_HERO_STAGE9_QA__?.ready||
    window.__US_HERO_STAGE9_QA__?.error,null,{timeout:115000});
  const ready=await page.evaluate(()=>window.__US_HERO_STAGE9_QA__.ready);
  if(!ready)throw Error("Stage9 did not initialize: "+await page.evaluate(()=>window.__US_HERO_STAGE9_QA__.error));
  const first=await page.evaluate(()=>{
   const q=window.__US_HERO_STAGE9_QA__,sc=window.BABYLON.EngineStore.LastCreatedScene;
   return {stage:q.stage,bones:q.bones,skeletons:sc.skeletons.length,
     weapons:document.querySelectorAll("[data-weapon]").length,
     motionButtons:document.querySelectorAll("[data-motion]").length,
     targetButtons:document.querySelectorAll("[data-target]").length,
     battle:q.battle.status(),actors:q.targets.status(),weapon:q.rig.weaponId,
     twoWayAmmo:!!q.combat};
  });
  console.log("STAGE9_INITIAL",JSON.stringify(first));
  if(first.stage!==9||first.bones!==65||first.skeletons!==1||
     first.weapons!==4||first.motionButtons!==4||first.targetButtons!==3||
     first.battle.targets.length!==3||first.actors.visualActors!==3||
     first.twoWayAmmo)throw Error("Stage9 duplicate simulation or invalid UI");
  await page.screenshot({path:dir+"/initial-range-mobile.png",fullPage:true});
  // Original rifle; authoritative combat with seeded RNG: kill on first shot.
  await page.locator('[data-target="enemy-b"]').click();
  await page.locator("#fire").dispatchEvent("pointerdown",{pointerId:71});
  await page.locator("#fire").dispatchEvent("pointerup",{pointerId:71});
  await page.waitForTimeout(190);
  const kill=await page.evaluate(()=>{
   const q=window.__US_HERO_STAGE9_QA__;
   return {battle:q.battle.status(),visual:q.targets.status(),
     muzzle:q.effects.status(),socket:q.rigInstance.getWeaponMount()};
  });
  console.log("STAGE9_RIFLE_HIT",JSON.stringify(kill));
  if(kill.battle.shots!==1||kill.battle.kills!==1||
     kill.battle.targets.find(t=>t.id==="enemy-b").alive||
     kill.visual.deathEvents!==1||kill.battle.playerWeapon!=="Kar98k"||
     kill.socket.parent!=="mixamorig:Weapon_R")throw Error("Rifle hit/damage/death not synchronized");
  await page.screenshot({path:dir+"/rifle-kill.png",fullPage:true});
  // Sten: fire while walking; one system owns ammo / damage.
  await page.locator('[data-weapon="uk-sten"]').click();
  await page.waitForFunction(()=>window.__US_HERO_STAGE9_QA__.weapon==="uk-sten",null,{timeout:80000});
  await page.locator('[data-motion="walk"]').click();
  await page.locator("#fire").dispatchEvent("pointerdown",{pointerId:72});
  await page.locator("#fire").dispatchEvent("pointerup",{pointerId:72});
  const sten=await page.evaluate(()=>{
   const q=window.__US_HERO_STAGE9_QA__;
   return {id:q.weapon,shots:q.battle.status().shots,
    inventory:q.battle.getPlayer().inventory.MP40,
    hp:q.battle.availableTargets().map(x=>x.hp),visual:q.targets.status()};
  });
  console.log("STAGE9_STEN_WALK",JSON.stringify(sten));
  if(sten.inventory.loaded!==31||sten.shots!==2||
    sten.hp[0]>=100)throw Error("Sten walking bullet or authoritative ammo failed");
  await page.locator("#reload").click();
  const begun=await page.evaluate(()=>window.__US_HERO_STAGE9_QA__.battle.status());
  if(!(begun.reloadRemaining>0))throw Error("Sten real reload not started");
  await page.evaluate(()=>window.__US_HERO_STAGE9_QA__.battle.tick(2.6));
  const ended=await page.evaluate(()=>{
   const q=window.__US_HERO_STAGE9_QA__;
   return q.battle.getPlayer().inventory.MP40;
  });
  if(ended.loaded!==32||ended.reserve!==127)throw Error("Sten true ammo reload incorrect "+JSON.stringify(ended));
  await page.screenshot({path:dir+"/sten-walking.png",fullPage:true});
  // Bren uses Battlefield MG42 suppression and existing damage.
  await page.locator('[data-weapon="uk-bren"]').click();
  await page.waitForFunction(()=>window.__US_HERO_STAGE9_QA__.weapon==="uk-bren",null,{timeout:80000});
  await page.locator('[data-motion="jog"]').click();
  await page.locator("#fire").dispatchEvent("pointerdown",{pointerId:73});
  await page.locator("#fire").dispatchEvent("pointerup",{pointerId:73});
  const bren=await page.evaluate(()=>{
   const q=window.__US_HERO_STAGE9_QA__;
   return {weapon:q.battle.status().playerWeapon,loaded:q.battle.getPlayer().inventory.MG42.loaded,
    suppressed:q.battle.currentTarget().suppressed,last:q.battle.getLast()};
  });
  console.log("STAGE9_BREN_SUPPRESS",JSON.stringify(bren));
  if(bren.weapon!=="MG42"||bren.loaded!==99||bren.last?.weaponId!=="uk-bren"||
     bren.suppressed<=0)throw Error("Bren suppression or damage failed");
  await page.screenshot({path:dir+"/bren-suppress.png",fullPage:true});
  // PIAT rocket: blocked while running, allowed when stationary, AoE.
  await page.locator('[data-weapon="uk-piat"]').click();
  await page.waitForFunction(()=>window.__US_HERO_STAGE9_QA__.weapon==="uk-piat",null,{timeout:80000});
  await page.locator('[data-motion="walk"]').click();
  let before=await page.evaluate(()=>window.__US_HERO_STAGE9_QA__.battle.status().shots);
  await page.locator("#fire").dispatchEvent("pointerdown",{pointerId:74});
  await page.locator("#fire").dispatchEvent("pointerup",{pointerId:74});
  const blocked=await page.evaluate(()=>window.__US_HERO_STAGE9_QA__.battle.status().shots);
  if(blocked!==before)throw Error("PIAT fired on the move");
  await page.locator('[data-motion="idle"]').click();
  await page.locator("#fire").dispatchEvent("pointerdown",{pointerId:75});
  await page.locator("#fire").dispatchEvent("pointerup",{pointerId:75});
  await page.waitForTimeout(100);
  const piat=await page.evaluate(()=>{
   const q=window.__US_HERO_STAGE9_QA__,sc=window.BABYLON.EngineStore.LastCreatedScene;
   return {last:q.battle.getLast(),shots:q.battle.status().shots,
    mag:q.battle.getPlayer().inventory.Panzerschreck.loaded,
    reserve:q.battle.getPlayer().inventory.Panzerschreck.reserve,
    fx:q.effects.status(),view:q.targets.status(),
    piatMeshes:sc.meshes.filter(m=>m.name.startsWith("PIAT ")).length};
  });
  console.log("STAGE9_PIAT_SPLASH",JSON.stringify(piat));
  if(piat.shots<=before||!piat.last?.impact||
    piat.mag!==0||piat.reserve!==3||piat.fx.missiles!==1||
    piat.piatMeshes!==12||!piat.last.hits.length)
   throw Error("PIAT splash/rocket/ammo invalid");
  await page.screenshot({path:dir+"/piat-splash.png",fullPage:true});
  // Reset range, no extra skeleton or leaked PIAT geometry.
  await page.locator("#reset-range").click();
  await page.waitForFunction(()=>window.__US_HERO_STAGE9_QA__.weapon==="uk-lee-enfield",
   null,{timeout:80000});
  const final=await page.evaluate(()=>{
   const q=window.__US_HERO_STAGE9_QA__,sc=window.BABYLON.EngineStore.LastCreatedScene;
   return {battle:q.battle.status(),visual:q.targets.status(),skeletons:sc.skeletons.length,
    piatMeshLeak:sc.meshes.filter(m=>m.name.startsWith("PIAT ")).length,
    effectMeshes:sc.meshes.filter(m=>m.name.startsWith("stage8-")).length};
  });
  console.log("STAGE9_RESET",JSON.stringify(final));
  if(final.battle.targets.some(t=>!t.alive||t.hp!==100)||
     final.battle.shots!==0||final.skeletons!==1||final.piatMeshLeak!==0||
     final.effectMeshes!==2||final.visual.deathEvents!==0)
    throw Error("Battle range reset or GPU resource cleanup failed");
  await page.screenshot({path:dir+"/reset-range.png",fullPage:true});
  if(errors.length)throw Error("Browser errors: "+JSON.stringify(errors));
  console.log("STAGE9_MOBILE_BROWSER_PASS",JSON.stringify({
   skeletons:final.skeletons,enemies:final.visual.visualActors,
   testedWeapons:4,damageAndDeath:true,piatSplash:true,noDuplicateAmmo:true,shots:4}));
 }catch(e){
  console.error("STAGE9_MOBILE_BROWSER_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/error-mobile.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});