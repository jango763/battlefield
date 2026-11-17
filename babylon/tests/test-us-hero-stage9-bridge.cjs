"use strict";
const assert=require("node:assert/strict");
const balance=require("../combat-balance-core.js");
const {create,DEFAULT_TARGETS,SCALE,ID_TO_BALANCE}=require("../us-hero-stage9-combat-bridge.js");
function setup(random=()=>0){
 const events=[];
 const sim=create({balance,random,onEvent:e=>events.push(e)});
 return {sim,events};
}
{
 const {sim}=setup();
 const s=sim.status();
 assert.equal(s.targets.length,3);
 assert.deepEqual(s.targets.map(t=>t.hp),[100,100,100]);
 assert.equal(sim.currentTarget().id,"enemy-b");
 assert.equal(s.playerHp,100);
 assert.equal(s.friendlyHp,100);
 assert.equal(SCALE,5);
 assert.deepEqual(Object.keys(ID_TO_BALANCE).sort(),
   ["uk-lee-enfield","uk-sten","uk-bren","uk-piat"].sort());
 const b=sim.getBattle();
 assert.equal(b.units.length,5,"1 player, 1 friendly, 3 enemies");
 assert.equal(b.getFunds(),0);
 assert.equal(sim.selectTarget("missing").ok,false);
 assert.equal(sim.selectTarget("enemy-c").ok,true);
 assert.equal(sim.currentTarget().id,"enemy-c");
}
{
 const {sim,events}=setup();
 const a=sim.fire("uk-lee-enfield",{moving:true});
 assert.equal(a.reason,"stop-to-fire");
 assert.equal(sim.status().shots,0);
 const b=sim.fire("uk-lee-enfield");
 assert(b.ok&&b.hit&&b.hits.length>=1);
 assert.equal(sim.status().shots,1);
 assert.equal(sim.status().kills,1,"Seed 0 rifle lethal chance");
 assert.equal(sim.availableTargets().find(t=>t.id==="enemy-b").hp,0);
 assert.equal(sim.status().targetId,"enemy-a","Select next alive target");
 assert(events.some(e=>e.type==="death"&&e.id==="enemy-b"));
 assert(events.some(e=>e.type==="damage"&&e.id==="enemy-b"));
 assert.equal(sim.status().friendlyHp,100);
}
{
 const {sim}=setup(()=>.999);
 const shot=sim.fire("uk-lee-enfield");
 assert(shot.ok&&!shot.hit);
 assert.equal(sim.status().targets[1].hp,100);
 assert.equal(sim.status().shots,1);
 assert.equal(sim.status().hits,0);
}
{
 const {sim}=setup();
 const eq=sim.equip("uk-sten");
 assert(eq.ok);
 assert.equal(sim.status().playerWeapon,"MP40");
 for(let i=0;i<5;i++){
  const shot=sim.fire("uk-sten",{moving:true});
  assert(shot.ok,JSON.stringify(shot));
  if(i<4)sim.tick(.106);
 }
 assert.equal(sim.status().shots,5);
 assert.equal(sim.status().friendlyHp,100);
 assert.equal(sim.getPlayer().inventory.MP40.loaded,27);
 assert.equal(sim.status().kills,1);
 assert.equal(sim.status().targets.filter(t=>t.alive).length,2);
 assert.equal(sim.equip("uk-bren").ok,true);
 assert.equal(sim.status().playerWeapon,"MG42");
 assert.equal(sim.equip("uk-sten").ok,true);
 assert.equal(sim.getPlayer().inventory.MP40.loaded,27,"Weapon inventory persists");
}
{
 const {sim}=setup();
 assert(sim.equip("uk-bren").ok);
 const shot=sim.fire("uk-bren",{moving:true});
 assert(shot.ok);
 assert.equal(sim.getPlayer().weapon,"MG42");
 assert.equal(sim.status().targets[1].suppressed,1.8);
 sim.tick(.2);
 assert(Math.abs(sim.status().targets[1].suppressed-1.6)<1e-6);
 assert.equal(sim.status().friendlyHp,100);
}
{
 const {sim}=setup();
 assert(sim.equip("uk-piat").ok);
 assert.equal(sim.fire("uk-piat",{moving:true}).reason,"stop-to-fire");
 const shot=sim.fire("uk-piat");
 assert(shot.ok,JSON.stringify(shot));
 assert(shot.impact&&Number.isFinite(shot.impact.x));
 assert.equal(shot.hits.length,3,"PIAT splash must hit close trio");
 assert.equal(sim.status().friendlyHp,100,"No friendly fire");
 assert.equal(sim.status().targets[1].hp,0,"Direct hit lethality");
 assert(sim.status().targets[0].hp<100);
 assert(sim.status().targets[2].hp<100);
 assert.equal(sim.status().reloadRemaining,9);
 sim.tick(9.1);
 assert.equal(sim.getPlayer().inventory.Panzerschreck.loaded,1);
 assert.equal(sim.getPlayer().inventory.Panzerschreck.reserve,2);
}
{
 const {sim}=setup();
 assert(sim.equip("uk-sten").ok);
 const before=sim.status();
 assert.equal(sim.fire("uk-bren").reason,"visual-balance-weapon-mismatch");
 assert.equal(sim.status().shots,before.shots);
}
{
 const {sim}=setup();
 for(const id of ["enemy-a","enemy-b","enemy-c"]){
  assert(sim.selectTarget(id).ok);
  const shot=sim.fire("uk-lee-enfield");
  assert(shot.ok);
  sim.tick(2.2);
 }
 assert.equal(sim.status().targets.filter(t=>t.alive).length,0);
 assert.equal(sim.fire("uk-lee-enfield").reason,"all-targets-destroyed");
 sim.reset();
 assert.equal(sim.status().shots,0);
 assert.equal(sim.status().targets.filter(t=>t.alive).length,3);
 assert.equal(sim.status().playerWeapon,"Kar98k");
 assert.equal(sim.status().friendlyHp,100);
}
console.log("STAGE9_AUTHORITATIVE_BATTLE_DAMAGE_TESTS_PASS");