'use strict';
const assert=require('node:assert/strict');
const A=require('../first-game-army-core');
const T=require('../tactical-ai');
function fixture(){
 const hero={id:'hero',x:150,z:25,alive:true};
 const blues=Array.from({length:9},(_,i)=>({id:'blue-'+i,x:65+i*.7,z:78,alive:true,weapon:'Kar98k',suppressed:0}));
 const reds=Array.from({length:9},(_,i)=>({id:'red-'+i,x:235-i*.7,z:225,alive:true,weapon:'Kar98k',suppressed:0}));
 const farms=[
  {id:'south-west',x:70,z:95,owner:'blue'},
  {id:'north-east',x:230,z:205,owner:'red'},
  {id:'north-west',x:70,z:205,owner:null},
  {id:'center',x:150,z:150,owner:null}
 ];
 const tactical=T.create({layout:{positions:[]},navigation:{free:()=>true,lineOfSight:()=>true},
  design:{coverAt:()=>0}});
 const orders=A.create({hero,allies:[hero,...blues],enemies:reds,farms,
  centralOpen:()=>false,tactical});
 return {orders,tactical,farms,blues,reds};
}
const {orders,tactical,farms,blues,reds}=fixture();
orders.updateAllies(.05);orders.updateEnemies(.05);
let goals=orders.snapshot().goals;
const blueGoals=blues.map(u=>goals[u.id]),redGoals=reds.map(u=>goals[u.id]);
assert.equal(blueGoals.filter(x=>x==='south-west').length,1,
 'One of nine independent blues must defend the held southern farm');
assert.equal(redGoals.filter(x=>x==='north-east').length,1,
 'Independent Wehrmacht soldiers must also leave a defender');
assert(blueGoals.some(x=>x==='north-west'||x==='north-east'),
 'Other soldiers must continue advancing rather than all camping');
assert(reds.some(u=>u.tacticalState==='defend')&&blues.some(u=>u.tacticalState==='defend'),
 'Autonomous defenders must actually use tactical defense orders');
assert(blues.some(u=>u.tacticalState==='advance')&&reds.some(u=>u.tacticalState==='advance'),
 'Assault must still run concurrently with defense');
assert(!Object.values(goals).includes('center'),'Locked center must not attract units');
assert(tactical.setStance('attack'),'The original user ATTACK command must still be available');
orders.updateAllies(.05);
goals=orders.snapshot().goals;
assert(!blues.some(u=>goals[u.id]==='south-west'),
 'Explicit ATTACK order must release garrisons immediately');
assert(tactical.setStance('auto'));
farms[0].owner='red';farms[2].owner='blue';
orders.updateAllies(.05);
goals=orders.snapshot().goals;
assert(blues.some(u=>goals[u.id]==='north-west'),
 'Garrison must retarget immediately when ownership changes');
assert(!blues.some(u=>goals[u.id]==='south-west'&&u.tacticalState==='defend'),
 'A lost farm is not an owned defensive objective');
const ai=T.create({layout:{positions:[]},navigation:{free:()=>true,lineOfSight:()=>true},
 design:{coverAt:()=>0}});
const unit={id:'cache-check',alive:true,x:80,z:80,weapon:'Kar98k',suppressed:0};
const own={id:'f',x:70,z:95,owner:'blue'};
assert.equal(ai.decide(unit,{side:'blue',farm:own,dt:.05}).state,'defend');
own.owner='red';assert.equal(ai.decide(unit,{side:'blue',farm:own,dt:.05}).state,'advance',
 'Cached plans must notice farm capture / loss immediately');
console.log('BATTLEFIELD_GARRISON_AND_RETASK_PASS');
