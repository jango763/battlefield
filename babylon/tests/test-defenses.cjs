const assert=require('node:assert/strict'),D=require('../defense-layout'),N=require('../navigation-core');
const layout=D.create(),nav=N.create({obstacles:layout.obstacles});
assert.equal(new Set(layout.trenches.map(t=>t.z)).size,2);
for(const t of layout.trenches){
 assert.equal(D.heightAt(layout,t.x,t.z),-.85);
 assert.equal(D.heightAt(layout,t.a,t.z),0);
 assert(nav.free({x:t.x,z:t.z}));
 assert(D.coverAt(layout,{x:t.x,z:t.z},{x:t.x,z:t.z+20})>=.7);
 assert(!nav.clear({x:t.x,z:t.z},{x:t.x,z:t.z+4}),'Cannot walk over parapet');
 const u={x:t.a-2,z:t.z};for(let i=0;i<200;i++)nav.follow(u,{x:t.a+5,z:t.z},9,.05);
 assert(Math.hypot(u.x-t.a-5,u.z-t.z)<.4,'Trench entrance reachable');
}
assert(nav.clear({x:150,z:70},{x:150,z:90}),'Central supply road remains open');
const combat=require('../combat-balance-core'),{create}=require('../squad-combat-core');
const battle=combat.createBattle({random:()=>0}),a=battle.addUnit({id:'a',team:'a',x:10,z:10}),b=battle.addUnit({id:'b',team:'b',x:20,z:10});
const ctl=create({battle,allies:[a],enemies:[b],driveAllies:()=>new Set(),driveEnemies:()=>new Set(),lineOfSight:()=>false});ctl.start();ctl.update(.1);assert.equal(a.shots,0);assert.equal(b.shots,0);
assert(combat.hitChance('Kar98k',30,{cover:.8})<combat.hitChance('Kar98k',30));
for(const f of layout.fortifications){
 assert(layout.obstacles.some(o=>o.id===f.id||o.id.startsWith(f.id+'-')),'Every fortification has collision');
 if(f.type==='bunker'){
  assert(nav.free({x:f.x,z:f.z}),'Bunker interior walkable');
  assert(nav.clear({x:f.x,z:f.z-f.facing*5},{x:f.x,z:f.z}),'Rear entrance open');
  assert(nav.lineOfSight({x:f.x,z:f.z},{x:f.x,z:f.z+f.facing*10}),'Gun slit has line of fire');
 }
}
console.log('TRENCHES_FORTIFICATIONS_COVER_AND_LINE_OF_SIGHT_PASS');
