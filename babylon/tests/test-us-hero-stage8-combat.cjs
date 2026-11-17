"use strict";
const assert=require("node:assert/strict");
const {WEAPONS}=require("../combat-balance-core.js");
const {create,IDS,SOURCE}=require("../us-hero-stage8-combat-core.js");
const prepare=()=>create({balance:{WEAPONS}});
const map={
 "uk-lee-enfield":["Kar98k",Infinity,Infinity,0,false],
 "uk-sten":["MP40",32,128,2.5,true],
 "uk-bren":["MG42",100,300,7.5,true],
 "uk-piat":["Panzerschreck",1,3,9,false]
};
for(const id of IDS){
 const c=prepare(),w=c.snapshot(id),r=map[id];
 assert.equal(w.sourceRule,r[0]);assert.equal(w.loaded,r[1]);
 assert.equal(w.reserve,r[2]);assert.equal(w.reloadSeconds,r[3]);
 assert.equal(w.canFireMoving,r[4]);
 assert.equal(w.interval,WEAPONS[SOURCE[id]].interval);
}
{
 const c=prepare();
 c.setMoving(true);c.setTrigger(true);c.tick(2.2);
 assert.equal(c.snapshot().shots,0,"Rifle must stop before firing");
 c.setMoving(false);c.tick(.01);
 assert.equal(c.snapshot().shots,1);
 assert.equal(c.snapshot().loaded,Infinity);
 assert.equal(c.reload().reason,"infinite-rifle");
}
{
 const c=prepare();c.weapon("uk-sten");c.setMoving(true);
 c.setTrigger(true);c.tick(.001);
 assert.equal(c.snapshot().loaded,31);
 c.tick(3.26);
 assert.equal(c.snapshot().shots,32,"Sten should fire full 32-round magazine");
 assert(c.snapshot().reloadRemaining>2.3&&c.snapshot().reloadRemaining<=2.5);
 assert.equal(c.reload().reason,"reloading");
 c.setTrigger(false);c.tick(2.5);
 assert.equal(c.snapshot().loaded,32);
 assert.equal(c.snapshot().reserve,96);
 c.weapon("uk-bren");c.setTrigger(true);c.tick(.001);
 assert.equal(c.snapshot().loaded,99);
 c.weapon("uk-sten");
 assert.equal(c.snapshot().loaded,32,"Inventory must persist after switching");
}
{
 const c=prepare();c.weapon("uk-bren");c.setMoving(true);c.setTrigger(true);
 c.tick(6.67);
 assert.equal(c.snapshot().shots,100);
 assert.equal(c.snapshot().loaded,0);
 assert(c.snapshot().reloadRemaining>7);
 c.setTrigger(false);c.tick(7.6);
 assert.equal(c.snapshot().loaded,100);
 assert.equal(c.snapshot().reserve,200);
}
{
 const events=[];
 const c=create({balance:{WEAPONS},onEvent:e=>events.push(e)});
 c.weapon("uk-piat");c.setMoving(true);c.setTrigger(true);c.tick(1);
 assert.equal(c.snapshot().shots,0);
 c.setMoving(false);c.tick(.01);
 assert.equal(c.snapshot().shots,1);
 assert.equal(c.snapshot().loaded,0);
 assert(c.snapshot().reloadRemaining>8.98&&c.snapshot().reloadRemaining<=9);
 assert.equal(c.snapshot().reserve,3);
 c.setTrigger(false);c.tick(9);
 assert.equal(c.snapshot().loaded,1);
 assert.equal(c.snapshot().reserve,2);
 assert(events.some(e=>e.type==="reload-start"&&e.seconds===9));
}
{
 const c=prepare();c.weapon("uk-piat");c.setTrigger(true);
 for(let i=0;i<4;i++)c.tick(8);
 assert.equal(c.snapshot().shots,4);
 assert.equal(c.snapshot().total,0);
 assert(c.getEvents().some(e=>e.type==="out-of-ammo"));
 c.tick(1);assert.equal(c.snapshot().shots,4);
}
{
 const c=prepare();
 c.weapon("uk-sten");c.setTrigger(true);c.tick(.001);c.setTrigger(false);
 assert.equal(c.snapshot().loaded,31);
 c.weapon("uk-lee-enfield");assert.equal(c.snapshot().loaded,Infinity);
 c.weapon("uk-sten");assert.equal(c.snapshot().loaded,31);
 c.reset();
 assert.equal(c.snapshot("uk-sten").total,160);
 assert.equal(c.snapshot("uk-piat").total,4);
}
function shotsAt(fps,id,seconds){
 const c=prepare();c.weapon(id);c.setMoving(id==="uk-sten"||id==="uk-bren");
 c.setTrigger(true);
 for(let i=0;i<seconds*fps;i++)c.tick(1/fps);
 return c.snapshot().shots;
}
for(const id of IDS){
 const counts=[30,60,144].map(fps=>shotsAt(fps,id,3));
 assert(Math.max(...counts)-Math.min(...counts)<=1,
  id+" frame-dependent "+counts);
 console.log("STAGE8_FPS_"+id,counts.join("/"));
}
console.log("STAGE8_COMBAT_CORE_PASS");
