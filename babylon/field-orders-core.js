/* Battlefield Babylon: tactical hero orders and magnetic squad formation.
 * Coordinates are in gameplay units; rendering/weapon IK remain independent.
 * Calm: hero at rear, three comrades in front (turtle).
 * Combat: stable one-row semicircle facing the enemy.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BattlefieldFieldOrders=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const HERO_SPEED=18, GUARD_SPEED=23, MAGNET_SPEED=29;
const CLAMP=(n,a,b)=>Math.max(a,Math.min(b,n));
function create({hero,allies,enemies,onArrive=()=>{}}){
 if(!hero||!allies?.includes(hero)||!Array.isArray(enemies))throw Error('Invalid field order teams');
 let destination=null,heading={x:1,z:0},mode='turtle',focus=null;
 let arrivalCount=0;
 function setDestination(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))return {ok:false,reason:'invalid-coordinates'};
  destination={x:CLAMP(x,0,300),z:CLAMP(z,0,300)};
  const dx=destination.x-hero.x,dz=destination.z-hero.z,d=Math.hypot(dx,dz);
  if(d>1e-5)heading={x:dx/d,z:dz/d};
  return {ok:true,destination:{...destination}};
 }
 function clearDestination(){destination=null;}
 function moveToward(unit,point,speed,dt){
  const dx=point.x-unit.x,dz=point.z-unit.z,d=Math.hypot(dx,dz);
  if(d<=.14)return false;
  const length=Math.min(speed*dt,d);
  unit.x+=dx/d*length;unit.z+=dz/d*length;
  return length>1e-5;
 }
 function nearestThreat(){
  let nearest=null,dist=Infinity;
  for(const enemy of enemies){
   if(!enemy.alive)continue;
   const d=Math.hypot(hero.x-enemy.x,hero.z-enemy.z);
   if(d<dist){nearest=enemy;dist=d;}
  }
  return dist<43?nearest:null;
 }
 function update(dt){
  if(!Number.isFinite(dt)||dt<0||dt>.2)throw Error('Invalid field orders delta');
  const moved=new Set();
  if(!hero.alive)return moved;
  if(destination){
   const didMove=moveToward(hero,destination,HERO_SPEED,dt);
   if(didMove)moved.add(hero);
   if(Math.hypot(hero.x-destination.x,hero.z-destination.z)<.16){
    destination=null;arrivalCount++;onArrive();
   }
  }
  const threat=nearestThreat();
  if(threat){
   mode='semicircle';focus=threat;
   const dx=threat.x-hero.x,dz=threat.z-hero.z,d=Math.hypot(dx,dz);
   if(d>.01)heading={x:dx/d,z:dz/d};
  }else{mode='turtle';focus=null;}
  const bots=allies.filter(u=>u!==hero);
  // Stable slots: a casualty does not shuffle survivors.
  for(let i=0;i<bots.length;i++){
   const bot=bots[i];
   if(!bot?.alive)continue;
   const fx=heading.x,fz=heading.z;
   let forward,lateral;
   if(mode==='turtle'){
    // 11 escorts: 3 columns with up to 4 ranks, all ahead of the hero.
    const rank=Math.floor(i/3),lane=i%3-1;
    forward=4.4+rank*3.8;lateral=lane*3.8;
   }else{
    // One row in a forward-facing semicircle, evenly spaced.
    const t=(i-(bots.length-1)/2)*Math.PI/Math.max(6,bots.length);
    forward=16*Math.cos(t);
    lateral=16*Math.sin(t);
   }
   const point={x:hero.x+fx*forward-fz*lateral,
     z:hero.z+fz*forward+fx*lateral};
   const d=Math.hypot(bot.x-hero.x,bot.z-hero.z);
   const speed=d>16?MAGNET_SPEED:GUARD_SPEED;
   // Hold stationary to shoot when already close to the intended slot.
   if(moveToward(bot,point,speed,dt))moved.add(bot);
  }
  return moved;
 }
 function snapshot(){return {destination:destination?{...destination}:null,
   heading:{...heading},mode,focus:focus?.id||null,
   arrivalCount,aliveGuards:allies.filter(u=>u!==hero&&u.alive).length};}
 return {setDestination,clearDestination,update,snapshot};
}
return {create,HERO_SPEED,GUARD_SPEED,MAGNET_SPEED};
});