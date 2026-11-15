'use strict';
const assert=require('node:assert/strict');
const C=require('./combat-rules.js');
const costs={weapon:{MP40:10,MG42:20,Panzerschreck:30},
 ammoPack:{MP40:2,MG42:3,Panzerschreck:4}}; // Test fixtures, NOT game prices.
const wallet={balance:10000};
const u=C.createUnit('soldier-1');
assert.equal(u.active,'Kar98k');
assert.equal(C.SPECS.MG42.damage,45);
assert.equal(C.SPECS.MG42.range,80);
assert.equal(C.SPECS.MP40.range,60);
assert.equal(C.SPECS.Panzerschreck.range,100);
assert.equal(C.hitChance('Kar98k',100),1/7);
assert.equal(C.hitChance('MP40',61),0);
assert.equal(C.hitChance('MG42',81),0);
assert(C.hitChance('MG42',60)>C.hitChance('MP40',60));
assert.equal(C.hitChance('MG42',20,{moving:true}),.65*.55);
assert.equal(C.fireAt(u,{distance:100,rollHit:()=>0,rollCritical:()=>0}).damage,100);
assert.equal(C.fireAt(u,{distance:100,rollHit:()=>0,rollCritical:()=>.99}).damage,75);
assert.equal(C.fireAt(u,{distance:101}).reason,'out-of-range');
assert.equal(C.buyWeapon(u,'MG42',{balance:0},costs).reason,'insufficient-funds');
assert(C.buyWeapon(u,'MG42',wallet,costs).ok);
assert.deepEqual([C.reportAmmo(u).loaded,C.reportAmmo(u).reserve],[100,300]);
let hits=0;
for(let n=0;n<100;n++){
 const result=C.fireAt(u,{distance:20,rollHit:()=>0});
 if(result.hit)hits++;
}
assert.equal(hits,100);
assert.equal(C.fireAt(u,{distance:20}).reason,'reload-required');
assert.equal(C.beginReload(u,0,{moving:true}).reason,'must-stop');
assert.equal(C.beginReload(u,0).durationMs,7500);
assert.equal(C.completeReload(u,7499).reason,'not-finished');
assert.equal(C.completeReload(u,7500).roundsLoaded,100);
assert.equal(C.reportAmmo(u).total,300);
for(let mag=1;mag<4;mag++){
 for(let shot=0;shot<100;shot++)C.fireAt(u,{distance:20,rollHit:()=>1});
 if(mag<3){
  assert(C.beginReload(u,mag*10000).ok);
  assert(C.completeReload(u,mag*10000+7500).ok);
 }
}
assert.equal(u.active,'Kar98k');
assert.equal(C.reportAmmo(u).total,0);
assert.equal(C.restockAtBase(u,wallet,costs,{atBase:false}).reason,'not-at-base');
assert.equal(C.restockAtBase(u,{balance:0},costs,{atBase:true}).reason,'insufficient-funds');
const resupply=C.restockAtBase(u,wallet,costs,{atBase:true});
assert.deepEqual([resupply.packsBought,C.reportAmmo(u).total],[4,400]);
assert.equal(u.active,'Kar98k');
assert.equal(C.useSpecial(u).reason,'reload-required');
assert(C.beginReload(u,100000).ok);
assert(C.completeReload(u,107500).ok);
assert.equal(u.active,'MG42');
const mp=C.createUnit('mp');
assert(C.buyWeapon(mp,'MP40',wallet,costs).ok);
assert.equal(C.reportAmmo(mp).total,160);
for(let i=0;i<32;i++)C.fireAt(mp,{distance:20,moving:true,rollHit:()=>1});
assert.equal(C.beginReload(mp,10,{moving:true}).durationMs,2500);
assert.equal(C.completeReload(mp,2510).roundsLoaded,32);
const pz=C.createUnit('pz');
assert(C.buyWeapon(pz,'Panzerschreck',wallet,costs).ok);
assert.equal(C.reportAmmo(pz).total,4);
const first=C.fireAt(pz,{distance:99,moving:false});
assert.equal(first.projectile,true);
assert.equal(C.beginReload(pz,0).durationMs,9000);
assert.equal(C.completeReload(pz,9000).roundsLoaded,1);
for(let i=0;i<3;i++){
 assert(C.fireAt(pz,{distance:50}).ok);
 if(i<2){assert(C.beginReload(pz,10000*(i+1)).ok);assert(C.completeReload(pz,10000*(i+1)+9000).ok);}
}
assert.equal(pz.active,'Kar98k');
assert.equal(C.explosionDamage(0,5),120);
assert.equal(C.explosionDamage(2.5,5),60);
assert.equal(C.explosionDamage(5,5),0);
assert.deepEqual(C.applyDamage({hp:100},45),{hp:55,dead:false});
assert.deepEqual(C.applyDamage({hp:100},135),{hp:0,dead:true});
console.log('COMBAT_BALANCE_AMMO_TESTS_PASS');
