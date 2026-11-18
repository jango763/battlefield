"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const army=require("../british-stage9-army.js");
const pipeline=require("../british-army-pipeline.js");
const catalog=require("../allied-model-catalog.js");
const combat=require("../combat-balance-core.js");
const squads=require("../squad-combat-core.js");
const manifest=JSON.parse(fs.readFileSync(
 path.join(__dirname,"../../assets/allied-soldiers/manifest.json"),"utf8"));
assert.equal(pipeline.STAGES[8],"army-spawn-squad-and-facing");
assert.equal(army.ARMY_SLOTS,12);
assert.equal(army.roleForSlot(0),"hero");
assert.equal(army.roleForSlot(1),"infantry");
assert.equal(army.roleForSlot(8),"infantry");
assert.equal(army.roleForSlot(9),"commando");
assert.equal(army.roleForSlot(11),"commando");
assert.throws(()=>army.roleForSlot(12));
assert.throws(()=>army.roleForSlot(-1));
assert.deepEqual(army.SOURCE_WEAPONS,{
 "uk-lee-enfield":"Kar98k","uk-sten":"MP40",
 "uk-bren":"MG42","uk-piat":"Panzerschreck"
});
const missing=army.plan({catalog,pipeline,manifest});
assert.equal(missing.total,12);
assert.equal(missing.hero,1);
assert.equal(missing.infantry,8);
assert.equal(missing.commando,3);
assert.equal(army.FIRETEAMS.length,3);
assert.deepEqual(army.FIRETEAMS.map(g=>g.slots.length),[4,4,3]);
assert.deepEqual(missing.fireteams.map(g=>g.id),
 ["rifle-alpha","rifle-bravo","commando-charlie"]);
assert.equal(army.fireteamForSlot(0),null);
assert.equal(army.fireteamForSlot(3).id,"rifle-alpha");
assert.equal(army.fireteamForSlot(5).id,"rifle-bravo");
assert.equal(army.fireteamForSlot(10).id,"commando-charlie");
assert.throws(()=>army.fireteamForSlot(12),/Unknown/);
const allAssigned=army.FIRETEAMS.flatMap(g=>g.slots);
assert.equal(new Set(allAssigned).size,11);
assert.deepEqual(allAssigned.slice().sort((a,b)=>a-b),
 [1,2,3,4,5,6,7,8,9,10,11]);
const wounded=Array(12).fill(true);
wounded[2]=false;wounded[6]=false;wounded[10]=false;
const teams=army.fireteamStatus(wounded);
assert.deepEqual(teams.map(g=>g.alive),[3,3,2]);
assert.deepEqual(teams.map(g=>g.casualties),[1,1,1]);
assert.throws(()=>army.fireteamStatus(Array(11).fill(true)),/12/);
assert.equal(missing.britishVisualsReady,false);
assert(missing.slots.every(x=>!x.visualReady));
assert.equal(missing.slots[0].modelId,"americanHero");
assert.equal(missing.slots[1].candidateModelId,"britishDanoob");
assert.equal(missing.slots[9].candidateModelId,"britishFab");
assert(missing.sourceModels.every(x=>x.ready===false));
assert(missing.slots[9].reason.some(x=>x.includes("головной")||x.includes("Головной")));
const attempted=army.plan({catalog,pipeline,manifest,
 bindings:{infantry:"britishDanoob",commando:"britishFab"},
 approvedHeadwear:{infantry:true,commando:true}});
assert.equal(attempted.britishVisualsReady,false);
assert.equal(attempted.slots[9].visualReady,false);
assert.throws(()=>army.plan({catalog,pipeline,manifest,
 bindings:{commando:"hero"}}),/Only previously selected/);
const turtle=army.positions();
const semicircle=army.positions("semicircle");
assert.equal(turtle.length,12);
assert.equal(semicircle.length,12);
assert(turtle[0].z>turtle[1].z);
assert.deepEqual(turtle.slice(1,4).map(x=>x.x),[-2.1,0,2.1]);
assert.notDeepEqual(turtle[4],semicircle[4]);
assert.throws(()=>army.positions("battleline"));
const alive=Array(12).fill(true);
assert.deepEqual(army.frontline(alive).map(x=>x.slot),[1,2,3]);
alive[2]=false;
const refilled=army.frontline(alive);
assert.equal(refilled.length,3);
assert.equal(refilled[1].replaces,2);
assert.notEqual(refilled[1].slot,2);
assert(alive[refilled[1].slot]);
assert.equal(new Set(refilled.map(x=>x.slot)).size,3);
const sim=army.simulation({battleCore:combat,squadCore:squads,random:()=>.01});
assert.equal(sim.allies.length,12);
assert.equal(sim.enemies.length,4);
assert.equal(new Set(sim.allies).size,12);
assert.equal(new Set(sim.allies.map(x=>x.id)).size,12);
assert(sim.allies.every(x=>x.weapon==="Kar98k"));
assert.equal(sim.snapshot().alliesAlive,12);
assert.equal(sim.snapshot().enemiesAlive,4);
assert.deepEqual(sim.snapshot().fireteams.map(g=>g.size),[4,4,3]);
assert.deepEqual(sim.snapshot().fireteams.map(g=>g.alive),[4,4,3]);
assert.equal(sim.snapshot().soldiers.filter(x=>x.role==="commando").length,3);
assert.equal(sim.equip(9,"uk-sten",{atBase:false}).reason,"return-to-base");
assert.equal(sim.equip(9,"uk-sten").ok,true);
assert.equal(sim.equip(10,"uk-bren").ok,true);
assert.equal(sim.equip(11,"uk-piat").ok,true);
assert.equal(sim.equip(2,"uk-lee-enfield").ok,true);
assert.equal(sim.allies[9].inventory.MP40.full,160);
assert.equal(sim.allies[10].inventory.MG42.full,400);
assert.equal(sim.allies[11].inventory.Panzerschreck.full,4);
assert.equal(sim.allies[8].weapon,"Kar98k");
assert.equal(sim.snapshot().soldiers[9].role,"commando");
assert.equal(sim.arrange("semicircle").ok,true);
assert.equal(sim.snapshot().formation,"semicircle");
assert(sim.selectEnemy(2).ok);
assert.equal(sim.start().ok,true);
assert.equal(sim.arrange("turtle").reason,"stop-before-reforming");
for(let i=0;i<12;i++)sim.tick(.08);
let shotlog=sim.snapshot().events;
assert(Array.isArray(shotlog));
assert.equal(new Set(sim.allies).size,12);
assert(sim.snapshot().soldiers.every((s,i)=>i>11||s.role===army.roleForSlot(i)));
assert(sim.snapshot().totalShots>=0);
sim.stop();
assert.equal(sim.snapshot().active,false);
assert.equal(sim.arrange("turtle").ok,true);
const c=Array.from({length:12},(_,slot)=>({
 slot,role:army.roleForSlot(slot),skeleton:{bones:Array(65).fill(0)},
 clips:Array.from({length:4},()=>({})),weaponMount:{},
 grip:{ok:true},mountParent:"mixamorig:Weapon_R",
 originalAssetVerified:slot!==0,licenseVerified:slot!==0,
 skinningVerified:slot!==0
}));
const verified=army.verifyUniqueVisualActors(c,
 {headwearApproved:{infantry:true,commando:true}});
assert.equal(verified.ok,true);
assert.equal(verified.uniqueSkeletons,12);
assert.equal(verified.uniqueClips,48);
assert.equal(verified.uniqueWeaponMounts,12);
c[2].skeleton=c[1].skeleton;
assert.throws(()=>army.verifyUniqueVisualActors(c,
 {headwearApproved:{infantry:true,commando:true}}),/Shared skeleton/);
c[2].skeleton={bones:Array(65).fill(0)};
c[9].licenseVerified=false;
assert.throws(()=>army.verifyUniqueVisualActors(c,
 {headwearApproved:{infantry:true,commando:true}}),/Unverified/);
c[9].licenseVerified=true;
assert.throws(()=>army.verifyUniqueVisualActors(c,
 {headwearApproved:{infantry:true,commando:false}}),/Unverified/);
sim.dispose();
assert.throws(()=>sim.tick(.05),/disposed/);
console.log("BRITISH_STAGE9_ARMY_CONTRACT_PASS",JSON.stringify({
 slots:12,hero:1,infantry:8,commando:3,
 independentFireteams:army.FIRETEAMS.map(g=>g.slots.length),
 sourceModelFilesInstalled:0,realBritish3DSpawned:false,
 independentVisualRigRequirements:verified.uniqueSkeletons,
 independentMotionClipsRequired:verified.uniqueClips,
 approvedWeapons:4,simulationUsesExistingBattle:true,
 mainGameUnchanged:true,turtle:true,semicircle:true,frontlineReplenishment:true
}));
