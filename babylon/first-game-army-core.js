/* Battlefield Babylon — first Three.js game's MOVEMENT and ARMY BEHAVIOUR.
 * One freely walking hero, up to 6 magnetic guards (turtle -> battle arc),
 * independently roaming blue/red infantry taking and defending farm points.
 * Everything here is pure gameplay math. It never alters GLB rig, animation
 * groups, visual scale, weapon metadata or approved character models.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldFirstGameArmy=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const SIZE=300, HERO_SPEED=9, INFANTRY_SPEED=10, MAGNET_SPEED=16;
 const MAX_GUARDS=6, ENEMY_ALERT=30, FOLLOW_RECRUIT=14, FOLLOW_DROP=32;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 function create({hero,allies,enemies,farms,centralOpen=()=>false,onArrive=()=>{},navigation=null}={}){
  if(!hero||!Array.isArray(allies)||allies[0]!==hero||
     !Array.isArray(enemies)||!Array.isArray(farms)||!farms.length)
   throw Error('Invalid first Battlefield hero/army inputs');
  let direct={x:0,z:0},destination=null,heading={x:0,z:1};
  let threat=null,mode='turtle',arrivalCount=0;
  const guardSlots=new Map(),guardOrder=[1,0,2,4,3,5];
  const goalCache=new Map();
  let ticks=0;
  const toUnit=(side)=>side==='blue'?allies.slice(1):enemies;
  const teamOf=(u)=>u===hero||allies.includes(u)?'blue':'red';
  const opposite=(side)=>side==='blue'?enemies:allies;
  function setMovement(x,z){
   if(!Number.isFinite(x)||!Number.isFinite(z))return {ok:false};
   const len=Math.hypot(x,z);
   if(len<.08){direct={x:0,z:0};return {ok:true};}
   direct={x:x/Math.max(1,len),z:z/Math.max(1,len)};
   destination=null; // Real thumbstick always wins over a stale tap waypoint.
   return {ok:true};
  }
  function clearMovement(){direct={x:0,z:0}}
  function setDestination(x,z){
   if(!Number.isFinite(x)||!Number.isFinite(z))return {ok:false};
   destination=navigation?navigation.nearestFree({x,z}):{x:clamp(x,0,SIZE),z:clamp(z,0,SIZE)};
   if(!destination)return {ok:false,reason:'blocked-destination'};
   direct={x:0,z:0};
   const dx=destination.x-hero.x,dz=destination.z-hero.z;
   if(Math.hypot(dx,dz)>.05)heading={x:dx/Math.hypot(dx,dz),z:dz/Math.hypot(dx,dz)};
   return {ok:true,destination:{...destination}};
  }
  function clearDestination(){destination=null}
  function advance(u,point,speed,dt,stop=.3){
   if(navigation)return navigation.follow(u,point,speed,dt,stop);
   const dx=point.x-u.x,dz=point.z-u.z,d=Math.hypot(dx,dz);
   if(d<=stop)return false;
   const amount=Math.min(speed*dt,d-stop);
   if(amount<=1e-5)return false;
   u.x=clamp(u.x+dx/d*amount,1,SIZE-1);
   u.z=clamp(u.z+dz/d*amount,1,SIZE-1);
   return true;
  }
  function soldierThreat(u,other,range=ENEMY_ALERT){
   let near=null,d=range;
   for(const v of other){
    if(!v.alive)continue;
    const rd=dist(u,v);
    if(rd<d){near=v;d=rd}
   }
   return near;
  }
  function reconcileGuards(){
   for(const [u] of guardSlots){
    if(!u.alive||!allies.includes(u)||!hero.alive||dist(u,hero)>FOLLOW_DROP)
     guardSlots.delete(u);
   }
   if(!hero.alive)return;
   // Magnet recruitment replicates the first Three.js game: ONLY nearby
   // uncommitted allies join the six-person escort. Others remain autonomous.
   const available=allies.slice(1).filter(u=>u.alive&&!guardSlots.has(u)&&
    dist(u,hero)<FOLLOW_RECRUIT).sort((a,b)=>dist(a,hero)-dist(b,hero));
   for(const u of available){
    if(guardSlots.size>=MAX_GUARDS)break;
    const occupied=new Set(guardSlots.values());
    const slot=guardOrder.find(i=>!occupied.has(i));
    if(slot===undefined)break;
    guardSlots.set(u,slot);
   }
  }
  function updateHero(dt,moved){
   if(!hero.alive)return;
   const length=Math.hypot(direct.x,direct.z);
   if(length>.08){
    // Direct analog motion like the ORIGINAL WASD/joystick, not a chain of
    // short-click destinations that makes the character hesitate.
    const oldX=hero.x,oldZ=hero.z;
    if(navigation)navigation.slide(hero,direct.x*HERO_SPEED*dt,direct.z*HERO_SPEED*dt);
    else {hero.x=clamp(hero.x+direct.x*HERO_SPEED*dt,1,SIZE-1);
    hero.z=clamp(hero.z+direct.z*HERO_SPEED*dt,1,SIZE-1);}
    if(Math.hypot(hero.x-oldX,hero.z-oldZ)>.001)moved.add(hero);
    heading={x:direct.x/length,z:direct.z/length};
   }else if(destination){
    const dx=destination.x-hero.x,dz=destination.z-hero.z,d=Math.hypot(dx,dz);
    if(d<.35){destination=null;arrivalCount++;onArrive();}
    else {
     heading={x:dx/d,z:dz/d};
     if(advance(hero,destination,HERO_SPEED,dt,.1))moved.add(hero);
    }
   }
  }
  function escortTarget(u,slot,count){
   const fx=heading.x,fz=heading.z;
   let forward,lateral;
   if(mode==='turtle'){
    // 3 across × 2 rows in front; slot ownership survives casualties.
    const row=Math.floor(slot/3),lane=slot%3-1;
    forward=3.6+row*2.9;lateral=lane*2.45;
   }else{
    // Six fixed positions along one forward-facing half-circle.
    const angle=(slot/5-.5)*Math.PI*.82;
    forward=5.25*Math.cos(angle);lateral=5.25*Math.sin(angle);
   }
   return {x:hero.x+fx*forward-fz*lateral,
    z:hero.z+fz*forward+fx*lateral};
  }
  function availableFarms(side){
   const open=centralOpen();
   return farms.filter(f=>(f.id!=='center'||open)&&f.owner!==side);
  }
  function objective(u,side){
   const candidates=availableFarms(side);
   if(!candidates.length){
    const defended=farms.filter(f=>f.owner===side);
    return defended.length?defended[Math.abs(hash(u.id))%defended.length]:null;
   }
   // Reserve stable lane goals for autonomous units; different IDs fan out
   // across farms instead of all 8+ soldiers piling onto the nearest one.
   const index=Math.abs(hash(u.id))%candidates.length;
   const preferred=candidates[index];
   const nearest=candidates.slice().sort((a,b)=>dist(u,a)-dist(u,b))[0];
   if(!nearest)return preferred;
   return dist(u,nearest)+25<dist(u,preferred)?nearest:preferred;
  }
  function hash(str){
   let h=2166136261;
   for(const c of String(str??''))h=Math.imul(h^c.charCodeAt(0),16777619)|0;
   return h;
  }
  function moveAutonomous(u,side,dt,moved){
   if(!u.alive)return;
   const enemy=soldierThreat(u,opposite(side));
   if(enemy){
    const d=dist(u,enemy);
    // Stop and engage while within effective rifle range, preserving
    // firing stance and the original ammunition/reloading simulation.
    if(d>37&&advance(u,enemy,INFANTRY_SPEED,dt,36.5))moved.add(u);
    return;
   }
   const farm=objective(u,side);
   if(farm){
    goalCache.set(u,farm.id);
    if(advance(u,farm,INFANTRY_SPEED,dt,4.1))moved.add(u);
   }
  }
  function updateAllies(dt){
   if(!Number.isFinite(dt)||dt<0||dt>.2)throw Error('Invalid first-game army delta');
   const moved=new Set();
   reconcileGuards();
   updateHero(dt,moved);
   threat=soldierThreat(hero,enemies,27);
   if(!threat){
    for(const [u] of guardSlots){
     threat=soldierThreat(u,enemies,21);
     if(threat)break;
    }
   }
   mode=threat?'semicircle':'turtle';
   // In combat the guard line turns toward its actual closest opponent.
   // Outside combat it follows the last hero movement direction.
   let hx=heading.x,hz=heading.z;
   if(threat&&hero.alive){
    const dx=threat.x-hero.x,dz=threat.z-hero.z,d=Math.hypot(dx,dz);
    if(d>.01){hx=dx/d;hz=dz/d;}
   }
   for(const u of allies.slice(1)){
    if(!u.alive)continue;
    if(guardSlots.has(u) && hero.alive){
     const forward=heading;heading={x:hx,z:hz};
     const target=escortTarget(u,guardSlots.get(u),guardSlots.size);
     heading=forward;
     const speed=dist(u,hero)>16?MAGNET_SPEED:INFANTRY_SPEED*1.2;
     if(advance(u,target,speed,dt,.6))moved.add(u);
    }else moveAutonomous(u,'blue',dt,moved);
   }
   ticks++;
   return moved;
  }
  function updateEnemies(dt){
   if(!Number.isFinite(dt)||dt<0||dt>.2)throw Error('Invalid enemy army delta');
   const moved=new Set();
   for(const u of enemies)moveAutonomous(u,'red',dt,moved);
   return moved;
  }
  function snapshot(){
   const goals={};
   for(const [u,id] of goalCache)if(u.alive)goals[u.id]=id;
   return {mode,focus:threat?.alive?threat.id:null,
    heading:{...heading},destination:destination?{...destination}:null,
    direct:{...direct},arrivalCount,aliveGuards:[...guardSlots.keys()].filter(u=>u.alive).length,
    guards:[...guardSlots].filter(([u])=>u.alive).map(([u,slot])=>({id:u.id,slot})),
    autonomousBlue:allies.slice(1).filter(u=>u.alive&&!guardSlots.has(u)).length,
    autonomousRed:enemies.filter(u=>u.alive).length,
    goals,ticks};
  }
  return Object.freeze({setMovement,clearMovement,setDestination,
   clearDestination,updateAllies,updateEnemies,snapshot});
 }
 return Object.freeze({create,SIZE,HERO_SPEED,INFANTRY_SPEED,MAGNET_SPEED,MAX_GUARDS});
});