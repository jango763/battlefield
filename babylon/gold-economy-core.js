/* Battlefield — map economics. Reuses the rules of the original Three.js game.
 * Two army treasuries, player purse, 5-second captures, +50 capture gold,
 * +25 gold / 5 s per ordinary farm, bonus income for central farm,
 * kill bounty (+15 regular, +30 armoured), and per-bot savings.
 * No presentation / Babylon / browser dependencies.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldGoldEconomy=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const SIZE=300;
// Blue = British; Red = German Wehrmacht. Names are presentation labels.
const TEAM_BLUE='blue',TEAM_RED='red';
const FACTIONS=Object.freeze({
 blue:Object.freeze({name:'Британцы',color:'#4b9cc2',side:'ЮГ'}),
 red:Object.freeze({name:'Немцы',color:'#cd6558',side:'СЕВЕР'})
});
const CAPTURE_SECONDS=5;
const CAPTURE_BONUS=50;
const INCOME_INTERVAL=5;
const FARM_INCOME=25;
const CENTRAL_MULTIPLIER=5; // 125 every 5 sec after the delayed unlock.
const CENTRAL_DELAY_SECONDS=300; // Exactly five gameplay minutes after first BOT death.
const START_TREASURY=560;
const START_HERO_WALLET=150;
const KILL_REWARD=15;
const ARMOURED_KILL_REWARD=30;
const FARMS=Object.freeze([
 Object.freeze({id:'south-west',name:'Южная ферма 1',x:70,z:95,weight:1}),
 Object.freeze({id:'south-east',name:'Южная ферма 2',x:230,z:95,weight:1}),
 Object.freeze({id:'center',name:'Центральная золотая ферма',x:150,z:150,weight:CENTRAL_MULTIPLIER}),
 Object.freeze({id:'north-west',name:'Северная ферма 1',x:70,z:205,weight:1}),
 Object.freeze({id:'north-east',name:'Северная ферма 2',x:230,z:205,weight:1})
]);
const MAP=Object.freeze({
 size:SIZE,
 bases:Object.freeze([{id:'south-base',team:TEAM_BLUE,x:150,z:25},
  {id:'north-base',team:TEAM_RED,x:150,z:275}]),
 farms:FARMS,
 pillboxes:Object.freeze([
  {id:'center-left',x:104,z:148},{id:'center-south',x:150,z:128},
  {id:'center-right',x:196,z:148},{id:'south-left',x:95,z:65},
  {id:'south-right',x:205,z:65},{id:'north-left',x:95,z:235},
  {id:'north-right',x:205,z:235}
 ]),
 wrecks:Object.freeze([
  {id:'btr-1',x:125,z:111,heading:-.32},
  {id:'btr-2',x:137,z:119,heading:.16},
  {id:'btr-3',x:148,z:126,heading:-.48}
 ]),
 teamsize:12
});
const validTeam=t=>t===TEAM_BLUE||t===TEAM_RED;
function create({onEvent=()=>{},centreMultiplier=CENTRAL_MULTIPLIER}={}){
 if(!Number.isFinite(centreMultiplier)||centreMultiplier<1)throw Error('Invalid central farm multiplier');
 const farms=FARMS.map(p=>({...p,weight:p.id==='center'?centreMultiplier:p.weight,
  owner:null,capturing:null,progress:0,incomeTimer:0}));
 const treasury={blue:START_TREASURY,red:START_TREASURY};
 const hero={team:TEAM_BLUE,gold:START_HERO_WALLET,kills:0};
 const events=[];
 let centralTriggered=false,centralRemaining=null,centralOpen=false,firstBotId=null;
 const countedDeaths=new Set();
 function emit(info){const event={...info};events.push(event);onEvent(event);return event}
 function pay(team,amount){
  if(!validTeam(team)||!Number.isFinite(amount)||amount<0)throw Error('Invalid treasury payment');
  if(treasury[team]+1e-8<amount)return false;
  treasury[team]-=amount;return true;
 }
 function earn(team,amount,kind='other'){
  if(!validTeam(team)||!Number.isFinite(amount)||amount<0)throw Error('Invalid treasury award');
  treasury[team]+=amount;emit({type:'gold',team,amount,kind});
 }
 function kill(killer,victim,{armoured=false,heroKill=false}={}){
  if(!validTeam(killer)||!victim||!validTeam(victim.team)||killer===victim.team)
   return false;
  const amount=armoured?ARMOURED_KILL_REWARD:KILL_REWARD;
  earn(killer,amount,'kill');
  if(heroKill&&hero.team===killer){hero.gold+=amount;hero.kills++}
  return amount;
 }
 function reportBotDeath(unit){
  if(!unit||unit.alive!==false||unit.hp>0||unit.isHero||unit.id==='hero')
   return false;
  if(unit.id==null||countedDeaths.has(unit.id))return false;
  countedDeaths.add(unit.id);
  if(centralTriggered)return false;
  centralTriggered=true;
  firstBotId=unit.id;
  centralRemaining=CENTRAL_DELAY_SECONDS;
  emit({type:'central-countdown-start',firstBotId,seconds:CENTRAL_DELAY_SECONDS});
  return true;
 }
 function advanceCentralClock(dt){
  if(!centralTriggered||centralOpen)return;
  centralRemaining=Math.max(0,centralRemaining-dt);
  if(centralRemaining<=1e-8){
   centralRemaining=0;centralOpen=true;
   emit({type:'central-open',farm:'center',seconds:CENTRAL_DELAY_SECONDS,firstBotId});
  }
 }
 function processFarm(p,dt,units){
  // The central resource point is locked until exactly 300 seconds of
  // active gameplay after the first non-hero soldier's death.
  if(p.id==='center'&&!centralOpen){
   p.owner=null;p.capturing=null;p.progress=0;p.incomeTimer=0;
   return;
  }
  let blue=false,red=false;
  for(const u of units){
   if(!u||u.alive===false||u.hp<=0)continue;
   const side=validTeam(u.economyTeam)?u.economyTeam:u.team;
   if(!validTeam(side)||Math.hypot(u.x-p.x,u.z-p.z)>=9)continue;
   if(side===TEAM_BLUE)blue=true;else red=true;
   if(blue&&red)break;
  }
  const candidate=blue&&!red?TEAM_BLUE:red&&!blue?TEAM_RED:null;
  if(candidate&&candidate!==p.owner){
   if(p.capturing!==candidate){p.capturing=candidate;p.progress=0;}
   p.progress+=dt;
   if(p.progress>=CAPTURE_SECONDS-1e-9){
    p.owner=candidate;p.capturing=null;p.progress=0;
    p.incomeTimer=0;
    earn(candidate,CAPTURE_BONUS,'capture');
    emit({type:'capture',farm:p.id,team:candidate});
   }
  }else{
   // Contested points never advance or pay new capture bonuses.
   p.capturing=null;p.progress=0;
  }
  if(p.owner){
   p.incomeTimer+=dt;
   while(p.incomeTimer>=INCOME_INTERVAL-1e-9){
    p.incomeTimer-=INCOME_INTERVAL;
    const amount=FARM_INCOME*p.weight;
    earn(p.owner,amount,p.id==='center'?'central-farm':'farm');
    emit({type:'farm-income',farm:p.id,team:p.owner,amount});
   }
  }
 }
 function update(dt,units=[]){
  if(!Number.isFinite(dt)||dt<0||dt>.25)throw Error('Invalid game delta');
  if(!Array.isArray(units))throw Error('Invalid units array');
  advanceCentralClock(dt);
  for(const p of farms)processFarm(p,dt,units);
  const rate={blue:0,red:0};
  for(const p of farms)if(p.owner)rate[p.owner]+=.25*p.weight;
  // Original game gave each regular bot its own savings proportional to controlled mines.
  for(const u of units)
   if(u&&u.alive!==false&&u.hp>0&&!u.engineer&&!u.commander&&
      !u.isHero&&u.id!=='hero'){
    const side=validTeam(u.economyTeam)?u.economyTeam:u.team;
    if(validTeam(side))u.gold=(u.gold||0)+rate[side]*dt;
   }
 }
 function changeHeroSide(team){
  if(!validTeam(team))throw Error('Invalid hero team');
  hero.team=team;
 }
 function summary(){
  const owners={blue:[],red:[],neutral:[]};
  for(const p of farms)owners[p.owner||'neutral'].push(p.id);
  return {treasury:{...treasury},hero:{...hero},
   central:{open:centralOpen,started:centralTriggered,
     remainingSeconds:centralRemaining,firstBotId,delaySeconds:CENTRAL_DELAY_SECONDS},
   farms:farms.map(p=>({...p})),owners,
   periodicGold:{blue:farms.filter(p=>p.owner==='blue').reduce((s,p)=>s+FARM_INCOME*p.weight,0),
    red:farms.filter(p=>p.owner==='red').reduce((s,p)=>s+FARM_INCOME*p.weight,0)},
   events:events.slice()};
 }
 return {update,pay,earn,kill,reportBotDeath,changeHeroSide,summary,farms,treasury,hero};
}
return {create,MAP,FARMS,SIZE,FACTIONS,TEAM_BLUE,TEAM_RED,
 CAPTURE_SECONDS,CAPTURE_BONUS,INCOME_INTERVAL,FARM_INCOME,
 CENTRAL_MULTIPLIER,CENTRAL_DELAY_SECONDS,START_TREASURY,START_HERO_WALLET,
 KILL_REWARD,ARMOURED_KILL_REWARD};
});