'use strict';
const assert=require('node:assert/strict');
const balance=require('../combat-balance-core.js');
const squad=require('../squad-combat-core.js');
assert.deepEqual(squad.formation({side:'ally',count:4}),[
 {x:-5,z:0},{x:0,z:-5},{x:0,z:0},{x:0,z:5}
]);
assert.equal(squad.formation({side:'enemy',distance:60,count:4}).length,4);
assert.equal(squad.formation({side:'enemy',distance:60,count:4})[0].x,60);
assert.throws(()=>squad.formation({count:3}),/1 or 4/);
function make(weapon='Kar98k',targetHP=100000,initial=70,random=()=>.99){
 const b=balance.createBattle({funds:1000,prices:{
  MP40:{weapon:100,magazine:12},MG42:{weapon:200,magazine:20},
  Panzerschreck:{weapon:300,magazine:30}
 },random});
 const a=b.addUnit({team:'a',x:0,z:0});
 const e=b.addUnit({team:'e',x:initial,z:0,hp:targetHP});
 if(weapon!=='Kar98k')assert(b.buyWeapon(a,weapon,{atBase:true}).ok);
 const shots=[],done=[];
 const c=squad.create({battle:b,allies:[a],enemies:[e],
  onShot:info=>shots.push(info),onFinish:info=>done.push(info)});
 return {b,a,e,c,shots,done};
}
{
 const {a,e,c,shots}=make('Kar98k',100000,80);
 assert(c.start().ok);
 let moved=0;
 for(let i=0;i<180;i++){
  const before=a.x;
  c.update(1/60);
  if(a.x>before)moved++;
 }
 assert(moved>0);
 assert(a.x>=15); // Both riflemen advance until they enter engagement distance.
 assert(shots.length>0);
 assert(shots.every(s=>s.moving===false));
 assert(shots.every(s=>s.unit===a||s.unit===e));
}
{
 const {a,c,shots}=make('MP40',100000,60,()=>.99);
 assert(c.start().ok);
 for(let i=0;i<150;i++)c.update(1/60);
 assert(shots.some(s=>s.unit===a&&s.moving&&s.result.weapon==='MP40'));
 assert(a.shots>0);
}
{
 const {a,c,b}=make('MG42',100000,20,()=>.99);
 assert(c.start().ok);
 for(let i=0;i<60;i++)c.update(1/60);
 assert(a.shots>0);
 assert.equal(a.weapon,'MG42');
 assert(b.totalAmmo(a,'MG42')<400);
}
{
 const {a,e,c,shots,done}=make('Kar98k',100,20,()=>0);
 assert(c.start().ok);
 for(let i=0;i<160;i++)c.update(1/60);
 assert(c.snapshot().done);
 assert.equal(done.length,1);
 assert.equal(done[0].winner,'allies');
 assert(!e.alive);
 const firstShotCount=shots.length;
 for(let i=0;i<100;i++)c.update(1/60);
 assert.equal(shots.length,firstShotCount);
}
{
 const {a,e,c}=make('Kar98k',100000,30);
 assert.equal(c.setFocus(a).reason,'enemy-not-available');
 assert(c.setFocus(e).ok);
 assert.equal(c.snapshot().focus,e.id);
 assert(c.setFocus(null).ok);
}
{
 const b=balance.createBattle({random:()=>.99});
 const allies=squad.formation({side:'ally',count:4}).map((p,i)=>b.addUnit({id:'a'+i,team:'a',...p}));
 const enemies=squad.formation({side:'enemy',distance:60,count:4}).map((p,i)=>b.addUnit({id:'e'+i,team:'e',...p}));
 const c=squad.create({battle:b,allies,enemies});
 assert(c.start().ok);
 for(let i=0;i<300;i++)c.update(1/60);
 assert(c.snapshot().soldiers.length===8);
 assert(allies.some(a=>a.shots>0)&&enemies.some(e=>e.shots>0));
 assert.equal(b.units.length,8);
}
console.log('EIGHT_SOLDIER_INDEPENDENT_SQUAD_COMBAT_TESTS_PASS');