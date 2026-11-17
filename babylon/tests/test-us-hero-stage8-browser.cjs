"use strict";
const {chromium}=require("/tmp/stage8-qa/node_modules/playwright");
const fs=require("node:fs");
const dir="babylon-qa-results/us-hero-stage8";
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 const read=()=>page.evaluate(()=>{
  const qa=window.__US_HERO_STAGE8_QA__,s=window.BABYLON.EngineStore.LastCreatedScene;
  return {ready:qa.ready,error:qa.error,weapon:qa.weapon,motion:qa.motion,
   combat:qa.combat?.snapshot(),fx:{...qa.effects?.report},
   rig:{error:qa.rig?.error,mountCount:qa.rig?.mountCount,
    muzzle:qa.rigInstance?.getMuzzlePose(),
    left:qa.rig?.leftGripMeters,right:qa.rig?.rightGripMeters,
    reloadWave:qa.rig?.combatReloadWave},
   playing:s.animationGroups.filter(g=>g.isPlaying).map(g=>g.name),
   skeletons:s.skeletons.length,piatMesh:s.meshes.filter(m=>m.name.startsWith("PIAT ")).length};
 });
 const tap=async()=>page.locator("[data-fire]").click();
 const press=async()=>page.locator("[data-fire]").dispatchEvent("pointerdown",
  {pointerId:33,button:0,bubbles:true});
 const release=async()=>page.locator("[data-fire]").dispatchEvent("pointerup",
  {pointerId:33,button:0,bubbles:true});
 const move=async id=>{await page.locator('[data-motion="'+id+'"]').click();await page.waitForTimeout(300);};
 const equip=async id=>{
  await page.locator('[data-weapon="'+id+'"]').click();
  await page.waitForFunction(id=>window.__US_HERO_STAGE8_QA__?.weapon===id||
   window.__US_HERO_STAGE8_QA__?.error,id,{timeout:80000});
  const state=await read();
  if(state.error)throw Error("Equip error "+state.error);
  if(state.weapon!==id)throw Error("Weapon not equipped "+id);
 };
 const advance=async sec=>page.evaluate(s=>window.__US_HERO_STAGE8_QA__.combat.tick(s),sec);
 function check(x,label){
  if(x.rig.error||x.error||x.skeletons!==1)throw Error(label+" rig error: "+JSON.stringify(x));
  if(x.rig.muzzle?.parent!=="mixamorig:Weapon_R")throw Error(label+" muzzle not on weapon/right socket");
  if(x.rig.right>.012||x.rig.left>.035)throw Error(label+" left/right grip drift "+x.rig.left+"/"+x.rig.right);
 }
 try{
  await page.goto("http://127.0.0.1:8788/babylon/us-hero-stage8-combat-iphone.html",
   {waitUntil:"domcontentloaded",timeout:50000});
  await page.waitForFunction(()=>window.__US_HERO_STAGE8_QA__?.ready||
   window.__US_HERO_STAGE8_QA__?.error,null,{timeout:120000});
  let x=await read();
  if(!x.ready)throw Error("Stage8 failed boot "+JSON.stringify(x));
  check(x,"initial");
  if(x.combat.ammoTotal!==null&&x.combat.ammoTotal!=="Infinity"){
   // Infinity returned from page.evaluate is serialized to null.
   if(x.combat.magazineSize!==null)throw Error("Rifle must have infinite ammo");
  }
  await tap();await page.waitForTimeout(130);
  x=await read();check(x,"rifle-shot");
  if(x.combat.shots!==1||x.fx.shotEvents!==1)
   throw Error("Rifle single shot failed "+JSON.stringify(x));
  await move("jog");
  await advance(2.3);await tap();x=await read();
  if(x.combat.shots!==1||x.combat.motion!=="jog")
   throw Error("Rifle fired while jogging");
  console.log("STAGE8_RIFLE_SEMI_AUTO_AND_MOVE_LOCK_PASS");
  await page.screenshot({path:dir+"/lee-enfield-jog-mobile.png"});
  await equip("uk-sten");check(await read(),"sten-equipped");
  await press();await advance(3.3);await release();await page.waitForTimeout(300);
  x=await read();check(x,"sten-32");
  if(x.combat.shots!==32||!x.combat.reloading||x.combat.reserve!==128)
   throw Error("Sten magazine / reload incorrect "+JSON.stringify(x.combat));
  await advance(.9);await page.waitForTimeout(260);
  x=await read();
  if(x.rig.reloadWave<=0)throw Error("Procedural reload upper-body motion not active");
  await page.screenshot({path:dir+"/sten-reloading-mobile.png"});
  await advance(2);x=await read();
  if(x.combat.reloading||x.combat.loaded!==32||x.combat.reserve!==96)
   throw Error("Sten reload did not complete "+JSON.stringify(x.combat));
  console.log("STAGE8_STEN_32_ROUNDS_RELOAD_2_5S_PASS");
  await equip("uk-bren");await move("sprint");await press();await advance(6.7);
  await release();await page.waitForTimeout(230);
  x=await read();check(x,"bren-100");
  if(x.combat.shots!==100||!x.combat.reloading||x.combat.reserve!==300)
   throw Error("Bren magazine/reload failure "+JSON.stringify(x.combat));
  await advance(7.5);x=await read();
  if(x.combat.loaded!==100||x.combat.reserve!==200)
   throw Error("Bren 7.5s reload failure "+JSON.stringify(x.combat));
  console.log("STAGE8_BREN_100_ROUNDS_MOVING_RELOAD_7_5S_PASS");
  await page.screenshot({path:dir+"/bren-sprint-mobile.png"});
  await equip("uk-piat");await move("sprint");await tap();x=await read();
  if(x.combat.shots!==0)throw Error("PIAT fired while sprinting");
  await move("idle");await tap();await page.waitForTimeout(170);
  x=await read();check(x,"piat-shot");
  if(x.combat.shots!==1||!x.combat.reloading||x.combat.reserve!==3||
    x.piatMesh<8||x.fx.lastShotWeapon!=="uk-piat")
   throw Error("PIAT shot/reload/projectile error "+JSON.stringify(x));
  await page.screenshot({path:dir+"/piat-reloading-mobile.png"});
  await advance(9);x=await read();
  if(x.combat.loaded!==1||x.combat.reserve!==2)
   throw Error("PIAT 9-sec reload failed "+JSON.stringify(x.combat));
  console.log("STAGE8_PIAT_ONE_SHOT_AND_9S_RELOAD_PASS");
  for(let n=0;n<3;n++){
   await tap();await page.waitForTimeout(110);
   if(n<2)await advance(9);
  }
  await page.waitForFunction(()=>window.__US_HERO_STAGE8_QA__?.weapon==="uk-lee-enfield",
   null,{timeout:75000});
  await page.waitForTimeout(230);
  x=await read();check(x,"auto-rifle-fallback");
  if(x.piatMesh!==0||x.weapon!=="uk-lee-enfield")
   throw Error("PIAT depletion did not fall back to rifle");
  console.log("STAGE8_PIAT_FOUR_BOMBS_AND_FALLBACK_PASS");
  for(const motion of ["walk","jog","sprint","idle"]){
   await move(motion);
   x=await read();
   if(x.combat.motion!==motion||!x.playing.some(n=>n.startsWith(
    ({idle:"Idle",walk:"Walk",jog:"Jog",sprint:"Sprint"})[motion])))
    throw Error("Quaternius motion lost: "+motion+" "+JSON.stringify(x.playing));
   check(x,"motion-"+motion);
  }
  console.log("STAGE8_FOUR_QUATERNIUS_MOTION_CLIPS_PASS");
  if(errors.length)throw Error("Browser errors: "+JSON.stringify(errors));
  await page.screenshot({path:dir+"/final-rifle-mobile.png"});
  console.log("STAGE8_MOBILE_BROWSER_PASS",JSON.stringify({
   originalSkeleton:x.skeletons,weapon:x.weapon,
   totalShots:x.combat.totalShots,totalReloads:x.combat.totalReloads,
   effects:x.fx.shotEvents,piatMeshRemaining:x.piatMesh
  }));
 }catch(e){
  console.error("STAGE8_MOBILE_BROWSER_FAIL",e.stack||String(e));
  console.error("BROWSER_ERRORS",JSON.stringify(errors));
  await page.screenshot({path:dir+"/failed.png",fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});