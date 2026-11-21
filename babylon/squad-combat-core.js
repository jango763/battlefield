/* Battlefield Babylon — isolated squad tactics over the approved weapon battle core.
 * Fully deterministic (given Battle random); no Babylon, DOM, or glTF dependency.
 * Movement is intentionally obstacle-free in this combat RANGE, not the RTS map.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BattlefieldSquadController=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const SPEED=18; // game-distance units per second, temporary range tuning.
const ENGAGE=Object.freeze({Kar98k:42,MP40:23,MG42:39,Panzerschreck:52});
function create({battle,allies,enemies,onShot=()=>{},onFinish=()=>{},driveAllies=null,driveEnemies=null,endWhenEliminated=true}){
 if(!battle||!Array.isArray(allies)||!Array.isArray(enemies))throw Error('Invalid teams');
 if(!allies.length||!enemies.length)throw Error('At least one soldier per team required');
 const members=[...allies,...enemies];
 if(new Set(members).size!==members.length||members.some(u=>!battle.units.includes(u)))
  throw Error('Squad members must be unique battle units');
 const ages=new Map(members.map(u=>[u,Infinity]));
 const moving=new Map(members.map(u=>[u,false]));
 let active=false,done=false,focus=null,elapsed=0,ending=null;
 function opposite(unit){return allies.includes(unit)?enemies:allies;}
 function nearest(unit,targets){
   let selected=null,dist=Infinity;
   for(const enemy of targets){
     if(!enemy.alive)continue;
     const d=Math.hypot(unit.x-enemy.x,unit.z-enemy.z);
     if(d<dist){selected=enemy;dist=d;}
   }
   return selected;
 }
 function setFocus(unit) {
   if(unit!==null&&(!enemies.includes(unit)||!unit.alive))
     return {ok:false,reason:'enemy-not-available'};
   focus=unit;
   return {ok:true};
 }
 function getTarget(unit){
   if(allies.includes(unit)&&focus?.alive)return focus;
   return nearest(unit,opposite(unit));
 }
 function start() {
   if(done)return {ok:false,reason:'battle-complete'};
   if(members.every(u=>!u.alive))return {ok:false,reason:'no-survivors'};
   active=true;
   return {ok:true};
 }
 function stop(){active=false;}
 function update(dt){
   if(!Number.isFinite(dt)||dt<0||dt>.2)throw Error('Invalid squad delta');
   // Reload and suppression clocks continue on the training base, even if paused.
   battle.tick(dt);
   if(!active)return snapshot();
   elapsed+=dt;
   for(const unit of members){ages.set(unit,ages.get(unit)+dt);moving.set(unit,false);}
   // Step 1: movement. The playable Babylon game supplies tap-to-move
   // for allied hero + magnetic escort; test ranges retain autonomous motion.
   if(driveAllies){
     const commanded=driveAllies(dt);
     if(!(commanded instanceof Set))throw Error('driveAllies must return moved-unit Set');
     for(const unit of commanded){
       if(!allies.includes(unit))throw Error('Cannot drive non-allied unit');
       moving.set(unit,true);
     }
   }
   if(driveEnemies){
     const directed=driveEnemies(dt);
     if(!(directed instanceof Set))throw Error('driveEnemies must return moved-unit Set');
     for(const unit of directed){
       if(!enemies.includes(unit))throw Error('Cannot drive non-enemy unit');
       moving.set(unit,true);
     }
   }
   for(const unit of members){
     if(driveAllies && allies.includes(unit))continue;
     if(driveEnemies && enemies.includes(unit))continue;
     if(!unit.alive)continue;
     const target=getTarget(unit);
     if(!target)continue;
     const weapon=unit.weapon;
     const plan=ENGAGE[weapon]||ENGAGE.Kar98k;
     const d=Math.hypot(unit.x-target.x,unit.z-target.z);
     const halt=unit.reloadRemaining>0&&weapon!=='MP40';
     if(halt||d<=plan+1e-5)continue;
     const travel=Math.min(SPEED*dt,Math.max(0,d-plan));
     if(travel<=0||d<1e-6)continue;
     unit.x+=(target.x-unit.x)*(travel/d);
     unit.z+=(target.z-unit.z)*(travel/d);
     moving.set(unit,true);
   }
   // Step 2: fire only when the gameplay core authorizes the shot.
   for(const unit of members){
     if(!unit.alive)continue;
     const target=getTarget(unit);
     if(!target)continue;
     const response=battle.fire(unit,target,{moving:moving.get(unit)});
     if(!response.ok)continue;
     ages.set(unit,0);
     onShot({unit,target,result:response,moving:moving.get(unit),elapsed});
   }
   const allyAlive=allies.some(u=>u.alive),enemyAlive=enemies.some(u=>u.alive);
   if(endWhenEliminated&&(!allyAlive||!enemyAlive)){
     done=true;active=false;ending=allyAlive?'allies':enemyAlive?'enemies':'draw';
     onFinish({winner:ending,elapsed});
   }
   return snapshot();
 }
 function snapshot(){
   return {active,done,winner:ending,elapsed,focus:focus?.alive?focus.id:null,
     alliesAlive:allies.filter(u=>u.alive).length,
     enemiesAlive:enemies.filter(u=>u.alive).length,
     soldiers:members.map(u=>({id:u.id,x:u.x,z:u.z,hp:u.hp,alive:u.alive,
       weapon:u.weapon,moving:!!moving.get(u),shotAge:ages.get(u),
       reloadRemaining:u.reloadRemaining,shots:u.shots}))};
 }
 return {start,stop,update,snapshot,setFocus,getTarget,
  isMoving:unit=>!!moving.get(unit),shotAge:unit=>ages.get(unit),
  ENGAGE,SPEED};
}
function formation({side='ally',distance=60,count=4}={}){
 if(count!==1&&count!==4)throw Error('Range supports only 1 or 4 soldiers');
 if(!Number.isFinite(distance)||distance<10||distance>100)throw Error('Invalid distance');
 if(side==='ally')return count===1?[{x:0,z:0}]:
   [{x:-5,z:0},{x:0,z:-5},{x:0,z:0},{x:0,z:5}];
 if(side==='enemy')return count===1?[{x:distance,z:0}]:
   [-5,-1.67,1.67,5].map(z=>({x:distance,z}));
 throw Error('Unknown squad side');
}
return {create,formation,SPEED,ENGAGE};
});