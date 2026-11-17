/* Battlefield Stage 9 — authoritative target combat adapter for US hero preview.
 * NO new damage/accuracy simulation. The existing BattlefieldBalance.createBattle
 * owns shot acceptance, hit chance, ammunition, cooldown, splash damage,
 * suppression, kills and friendly-fire rules.
 * Stage8 remains only a presentation/controller layer for the iPhone preview.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldUSStage9Combat=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const ID_TO_BALANCE=Object.freeze({
 "uk-lee-enfield":"Kar98k",
 "uk-sten":"MP40",
 "uk-bren":"MG42",
 "uk-piat":"Panzerschreck"
});
const DEFAULT_TARGETS=Object.freeze([
 Object.freeze({id:"enemy-a",label:"Противник 1",x:-.88,z:-2.9,hp:100}),
 Object.freeze({id:"enemy-b",label:"Противник 2",x:0,z:-3.2,hp:100}),
 Object.freeze({id:"enemy-c",label:"Противник 3",x:.85,z:-2.9,hp:100})
]);
const SCALE=5; // 1 visible scene unit = 5 combat-distance units.
function create({balance,targets=DEFAULT_TARGETS,random=Math.random,onEvent=()=>{}}={}){
 if(!balance?.createBattle||!balance?.WEAPONS)throw Error("Existing BattlefieldBalance.createBattle required");
 if(typeof random!=="function"||typeof onEvent!=="function")throw Error("Invalid stage9 callbacks");
 const prices={MP40:{weapon:0,magazine:0},MG42:{weapon:0,magazine:0},
   Panzerschreck:{weapon:0,magazine:0}};
 const battle=balance.createBattle({funds:0,prices,random});
 const player=battle.addUnit({id:"us-hero",team:"allies",x:0,z:0,hp:100});
 const trainingAlly=battle.addUnit({id:"ally-marker",team:"allies",x:0,z:-SCALE*2.9,hp:100});
 const enemies=new Map();
 const metadata=new Map();
 for(const def of targets){
  if(!def||!def.id||enemies.has(def.id))throw Error("Duplicate or invalid enemy");
  if(![def.x,def.z,def.hp].every(Number.isFinite)||def.hp<=0)
    throw Error("Invalid enemy location/health");
  const enemy=battle.addUnit({id:def.id,team:"axis",x:def.x*SCALE,z:def.z*SCALE,hp:def.hp});
  enemies.set(def.id,enemy);
  metadata.set(def.id,{id:def.id,label:String(def.label||def.id),x:def.x,z:def.z});
 }
 // Test range grants these weapons only inside this isolated preview.
 // In the real game, combat-balance-core.js continues to require atBase purchases.
 for(const wid of ["MP40","MG42","Panzerschreck"]){
  const grant=battle.buyWeapon(player,wid,{atBase:true});
  if(!grant.ok)throw Error("Cannot provision stage9 range weapon "+wid);
 }
 const back=battle.switchWeapon(player,"Kar98k");
 if(!back.ok)throw Error("Cannot restore base rifle");
 let targetId=targets[1]?.id||targets[0]?.id||null;
 if(!targetId)throw Error("Stage9 range needs targets");
 let totalShots=0,totalHits=0,totalKills=0;
 let last=null;
 const events=[];
 function emit(type,value){
  const entry={type,...value};
  events.push(entry);
  if(events.length>300)events.shift();
  onEvent(entry);
  return entry;
 }
 function currentTarget(){
  if(!targetId)return null;
  const t=enemies.get(targetId);
  return t?.alive?t:null;
 }
 function pickAlive(){
  const alive=[...enemies.values()].find(e=>e.alive);
  targetId=alive?.id||null;
  return targetId;
 }
 function selectTarget(id){
  const t=enemies.get(id);
  if(!t||!t.alive)return {ok:false,reason:"target-not-alive",id};
  targetId=id;
  emit("select",{id});
  return {ok:true,id};
 }
 function availableTargets(){
  return [...enemies.entries()].map(([id,e])=>{
   const pos=metadata.get(id);
   return {...pos,hp:e.hp,maxHp:e.maxHp,alive:e.alive,suppressed:e.suppressed};
  });
 }
 function equip(id){
  const source=ID_TO_BALANCE[id];
  if(!source)return {ok:false,reason:"not-an-allied-weapon"};
  const result=battle.switchWeapon(player,source);
  if(result.ok)emit("equip",{id,source});
  return result;
 }
 function fire(id,{moving=false,cover=0}={}){
  if(!ID_TO_BALANCE[id])return {ok:false,reason:"unknown-weapon"};
  if(player.weapon!==ID_TO_BALANCE[id])
    return {ok:false,reason:"visual-balance-weapon-mismatch",expected:player.weapon,visual:id};
  let target=currentTarget();
  if(!target){
   pickAlive();
   target=currentTarget();
  }
  if(!target)return {ok:false,reason:"all-targets-destroyed"};
  const hpBefore=availableTargets();
  const result=battle.fire(player,target,{moving,cover,
    targets:[...enemies.values(),trainingAlly]});
  if(!result.ok)return result;
  totalShots++;
  totalHits+=result.hits.length;
  const hpAfter=availableTargets();
  const hitIds=result.hits.map(h=>h.id);
  const fallen=hpBefore.filter(b=>b.alive&&!hpAfter.find(a=>a.id===b.id)?.alive).map(x=>x.id);
  totalKills+=fallen.length;
  const detail={
   weaponId:id,sourceWeapon:ID_TO_BALANCE[id],targetId:target.id,
   distance:result.distance,hit:result.hit,probability:result.probability,
   hits:result.hits.map(h=>({...h})),fallen,impact:result.impact,
   ammo:result.ammo,totalShots,totalHits,totalKills,
   fallback:player.weapon==="Kar98k"&&id!=="uk-lee-enfield",
   friendlyHp:trainingAlly.hp
  };
  last=emit("shot",detail);
  for(const h of result.hits)emit("damage",{id:h.id,hp:h.hp,damage:h.damage,weaponId:id});
  for(const id of fallen)emit("death",{id,weaponId:id});
  if(!currentTarget())pickAlive();
  return {ok:true,...detail};
 }
 function reload(){
  const out=battle.startReload(player);
  if(out.ok)emit("reload-start",{weapon:player.weapon,seconds:out.seconds});
  return out;
 }
 function tick(dt){
  battle.tick(dt);
  return {reloading:player.reloadRemaining>0,cooldown:player.cooldown,
    targetsAlive:availableTargets().filter(x=>x.alive).length};
 }
 function status(){
  return {targetId,targets:availableTargets(),shots:totalShots,
   hits:totalHits,kills:totalKills,playerWeapon:player.weapon,
   playerHp:player.hp,friendlyHp:trainingAlly.hp,
   reloadRemaining:player.reloadRemaining,
   magazine:player.inventory[player.weapon]?.loaded??Infinity,
   reserve:player.inventory[player.weapon]?.reserve??Infinity,
   battleEvents:battle.events.length,last};
 }
 function reset(){
  for(const def of targets){
   const e=enemies.get(def.id);
   e.hp=e.maxHp;e.alive=true;e.suppressed=0;
  }
  for(const [id,w] of Object.entries(player.inventory)){
   w.loaded=balance.WEAPONS[id].magazineSize;
   w.reserve=balance.WEAPONS[id].magazineSize*(balance.WEAPONS[id].magazines-1);
  }
  player.cooldown=0;player.reloadRemaining=0;player.reloadWeapon=null;
  player.weapon="Kar98k";player.shots=0;player.kills=0;player.hits=0;
  trainingAlly.hp=trainingAlly.maxHp;trainingAlly.alive=true;
  targetId=targets[1]?.id||targets[0]?.id;
  totalShots=0;totalHits=0;totalKills=0;last=null;events.length=0;
  emit("reset",{targetId});
  return status();
 }
 return Object.freeze({equip,fire,reload,tick,reset,status,selectTarget,
  availableTargets,currentTarget,getEvents:()=>events.slice(),getLast:()=>last,
  getPlayer:()=>player,getBattle:()=>battle,DEFAULT_TARGETS,SCALE});
}
return Object.freeze({create,DEFAULT_TARGETS,SCALE,ID_TO_BALANCE});
});