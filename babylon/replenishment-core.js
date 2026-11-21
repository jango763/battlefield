/* Battlefield Babylon: continuous, reusable reinforcement slots.
 * Mirrors the first Three.js game's timed army replenishment, without
 * deploying an entire 12v12 army on the first frame.
 * Pure logic: no rendering, IK, weapon stats or scene mutations.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldReplenishment=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const DEFAULTS=Object.freeze({
  secondsPerSoldier:1.4,
  maxAlivePerSide:8, // iPhone-friendly active budget, not a fixed battle of 24
  soldierReturnSeconds:4,
  heroReturnSeconds:28
 });
 function create({allies,enemies,hero,maxAlivePerSide=DEFAULTS.maxAlivePerSide,
   secondsPerSoldier=DEFAULTS.secondsPerSoldier,
   soldierReturnSeconds=DEFAULTS.soldierReturnSeconds,
   heroReturnSeconds=DEFAULTS.heroReturnSeconds}={}){
  if(!Array.isArray(allies)||!Array.isArray(enemies)||!hero||
    allies[0]!==hero||enemies.length===0||
    !Number.isInteger(maxAlivePerSide)||maxAlivePerSide<2||
    !(secondsPerSoldier>0)||!(soldierReturnSeconds>=0)||!(heroReturnSeconds>0))
   throw Error('Invalid continuous army roster or reinforcement policy');
  const roster={blue:allies,red:enemies};
  const eligible={blue:allies.slice(1),red:enemies.slice()};
  const used=new Set([...allies,...enemies].filter(u=>u.alive));
  const pending=new Set(),remaining=new Map();
  const cursors={blue:0,red:0};
  const elapsed={blue:secondsPerSoldier,red:secondsPerSoldier};
  const totals={blue:allies.filter(u=>u.alive).length,
   red:enemies.filter(u=>u.alive).length};
  const all=[...allies,...enemies];
  let active=true;
  function stop(){active=false;pending.clear();}
  function snapshot(){
   return {
    active,secondsPerSoldier,maxAlivePerSide,heroReturnSeconds,
    blueAlive:roster.blue.filter(u=>u.alive).length,
    redAlive:roster.red.filter(u=>u.alive).length,
    bluePending:[...pending].filter(u=>roster.blue.includes(u)).length,
    redPending:[...pending].filter(u=>roster.red.includes(u)).length,
    totalBlueReinforced:totals.blue,totalRedReinforced:totals.red,
    heroRespawnRemaining:hero.alive?0:Math.ceil(remaining.get(hero)??heroReturnSeconds)
   };
  }
  function reserve(side){
   if(!active||!roster[side])return null;
   const candidates=eligible[side];
   // Never queue more than one heavy GLB import for each team. The next
   // soldier leaves barracks on the next timer tick after delivery.
   if([...pending].some(u=>roster[side].includes(u)))return null;
   // Reserve one British slot for the player even while the hero is dead.
   // Otherwise eight replacements + a revived hero would exceed the cap.
   const activeBots=eligible[side].filter(u=>u.alive).length;
   const waitingBots=[...pending].filter(u=>eligible[side].includes(u)).length;
   const escortLimit=side==='blue'?maxAlivePerSide-1:maxAlivePerSide;
   if(activeBots+waitingBots>=escortLimit)return null;
   for(let k=0;k<candidates.length;k++){
    const idx=(cursors[side]+k)%candidates.length;
    const u=candidates[idx];
    if(u.alive||pending.has(u)||(remaining.get(u)||0)>0)continue;
    cursors[side]=(idx+1)%candidates.length;
    pending.add(u);
    return u;
   }
   return null;
  }
  // Returns spawn requests; caller loads exact approved GLB only on demand.
  // Do not set alive until that model is ready to be shown on the battlefield.
  function update(dt){
   if(!Number.isFinite(dt)||dt<0||dt>.2)throw Error('Invalid reinforcement dt');
   if(!active)return [];
   for(const u of all){
    if(u.alive){remaining.delete(u);used.add(u);continue;}
    if(used.has(u)&&!remaining.has(u))
     remaining.set(u,u===hero?heroReturnSeconds:soldierReturnSeconds);
   }
   for(const [u,left] of remaining)remaining.set(u,Math.max(0,left-dt));
   const requested=[];
   if(!hero.alive && (remaining.get(hero)||0)<=0 && !pending.has(hero)){
    pending.add(hero);requested.push({side:'blue',unit:hero,hero:true});
   }
   for(const side of ['blue','red']){
    elapsed[side]-=dt;
    if(elapsed[side]>0)continue;
    // Once per fixed interval. A team already at its cap simply waits.
    elapsed[side]+=secondsPerSoldier;
    const soldier=reserve(side);
    if(soldier)requested.push({side,unit:soldier,hero:false});
   }
   return requested;
  }
  function finish(unit,ok){
   if(!all.includes(unit)||!pending.has(unit))return false;
   pending.delete(unit);
   if(ok){
    used.add(unit);
    remaining.delete(unit);
    const side=roster.blue.includes(unit)?'blue':'red';
    totals[side]++;
   }else remaining.set(unit,5); // Keep failed GLB requests from hammering CDN.
   return true;
  }
  return Object.freeze({update,finish,stop,snapshot,DEFAULTS});
 }
 return Object.freeze({create,DEFAULTS});
});
