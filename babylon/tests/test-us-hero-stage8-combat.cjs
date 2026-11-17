"use strict";
const assert=require("node:assert/strict");
const {PROFILES,create,MOTIONS}=require("../us-hero-stage8-combat.js");
assert.deepEqual(MOTIONS,["idle","walk","jog","sprint"]);
assert.deepEqual(Object.keys(PROFILES),["uk-lee-enfield","uk-sten","uk-bren","uk-piat"]);
assert.equal(PROFILES["uk-sten"].magazineSize*PROFILES["uk-sten"].magazines,160);
assert.equal(PROFILES["uk-bren"].magazineSize*PROFILES["uk-bren"].magazines,400);
assert.equal(PROFILES["uk-piat"].magazineSize*PROFILES["uk-piat"].magazines,4);
assert.equal(PROFILES["uk-sten"].reloadSeconds,2.5);
assert.equal(PROFILES["uk-bren"].reloadSeconds,7.5);
assert.equal(PROFILES["uk-piat"].reloadSeconds,9);
function tap(c){c.setTrigger(true);c.tick(0);c.setTrigger(false)}
{
 const c=create();c.setMotion("jog");tap(c);
 assert.equal(c.snapshot().shots,0,"Lee-Enfield must stop to shoot");
 c.setMotion("idle");tap(c);
 assert.equal(c.snapshot().shots,1);
 c.setTrigger(true);c.tick(24);c.setTrigger(false);
 assert.equal(c.snapshot().shots,1,"Lee-Enfield is semi-auto, held trigger must not repeat");
 tap(c);assert.equal(c.snapshot().shots,2);
 assert.equal(c.snapshot().ammoTotal,Infinity);
 assert.equal(c.beginReload().reason,"infinite-rifle-ammo");
}
{
 const events=[];const c=create({weapon:"uk-sten",onEvent:e=>events.push(e)});
 c.setMotion("jog");c.setTrigger(true);c.tick(3.30);c.setTrigger(false);
 let s=c.snapshot();assert.equal(s.shots,32);assert.equal(s.loaded,0);
 assert.equal(s.reserve,128);assert(s.reloading);assert.equal(s.reloadSeconds,2.5);
 assert(events.some(e=>e.type==="reload-start"));
 c.tick(2.5);s=c.snapshot();
 assert.equal(s.loaded,32);assert.equal(s.reserve,96);assert.equal(s.totalShots,32);
 assert(events.some(e=>e.type==="reload-complete"));
 const before=c.snapshot().loaded;
 c.beginReload({manual:true}); // full, no ammo consumed
 assert.equal(c.snapshot().loaded,before);
}
{
 const c=create({weapon:"uk-bren"});
 c.setMotion("sprint");c.setTrigger(true);c.tick(6.70);c.setTrigger(false);
 const during=c.snapshot();
 assert.equal(during.shots,100);
 assert(during.reloading);
 c.tick(7.5);
 assert.equal(c.snapshot().loaded,100);
 assert.equal(c.snapshot().reserve,200);
}
{
 const events=[];const c=create({weapon:"uk-piat",onEvent:e=>events.push(e)});
 c.setMotion("walk");tap(c);assert.equal(c.snapshot().shots,0);
 c.setMotion("idle");
 for(let i=1;i<=4;i++){
  tap(c);
  assert.equal(c.snapshot().shots,i);
  if(i<4){
   assert(c.snapshot().reloading);
   c.tick(9);
   assert.equal(c.snapshot().loaded,1);
  }
 }
 assert.equal(c.snapshot().ammoTotal,0);
 assert(!c.snapshot().reloading);
 assert.equal(events.filter(e=>e.type==="depleted").length,1);
 tap(c);assert.equal(c.snapshot().shots,4);
}
{
 const c=create({weapon:"uk-sten"});
 c.setTrigger(true);c.tick(.8);c.setTrigger(false);
 const used=c.snapshot().loaded;
 c.equip("uk-bren");c.tick(10);c.equip("uk-sten");
 assert.equal(c.snapshot().loaded,used,"Equipping must preserve consumable ammo");
 assert.equal(c.snapshot().reserve,128);
}
for(const id of ["uk-sten","uk-bren"]){
 const shotCounts=[];
 for(const fps of [30,60,144]){
  const c=create({weapon:id});c.setMotion("jog");c.setTrigger(true);
  for(let n=0;n<fps*3;n++)c.tick(1/fps);
  shotCounts.push(c.snapshot().shots);
 }
 assert(Math.max(...shotCounts)-Math.min(...shotCounts)<=1,
  id+" firing rate changes with FPS: "+shotCounts);
 console.log("STAGE8_FRAME_INDEPENDENCE",id,shotCounts.join("/"));
}
console.log("STAGE8_ALLIED_AMMO_RELOAD_MOTION_UNIT_PASS");