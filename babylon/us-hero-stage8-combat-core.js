/* Battlefield — Stage 8/10, approved US hero combat preview.
 * Pure, deterministic four-weapon combat controller; no graphics dependencies.
 * Weapon timing and magazines are read from existing BattlefieldBalance.WEAPONS.
 * UI test is intentionally isolated from the live game economy and target damage.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldUSCombatStage8=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const IDS=Object.freeze(["uk-lee-enfield","uk-sten","uk-bren","uk-piat"]);
const SOURCE=Object.freeze({
 "uk-lee-enfield":"Kar98k",
 "uk-sten":"MP40",
 "uk-bren":"MG42",
 "uk-piat":"Panzerschreck"
});
const NAME=Object.freeze({
 "uk-lee-enfield":"Lee-Enfield",
 "uk-sten":"Sten",
 "uk-bren":"Bren",
 "uk-piat":"PIAT"
});
const ensure=(p,msg)=>{if(!p)throw Error(msg)};
function create({balance,onEvent=()=>{}}={}){
 const available=balance?.WEAPONS||
   (typeof window!=="undefined"?window.BattlefieldBalance?.WEAPONS:null);
 ensure(available,"BattlefieldBalance.WEAPONS is required");
 ensure(typeof onEvent==="function","Expected combat event handler");
 const entries={};
 for(const id of IDS){
  const original=available[SOURCE[id]];
  ensure(original,"Missing existing BattlefieldBalance "+SOURCE[id]);
  const {magazineSize,magazines,interval,reloadSeconds,canFireMoving}=original;
  ensure(interval>0&&Number.isFinite(interval),"Invalid fire interval for "+id);
  ensure(magazineSize===Infinity||(Number.isInteger(magazineSize)&&magazineSize>0),
     "Invalid magazine capacity "+id);
  ensure(magazineSize===Infinity||(Number.isInteger(magazines)&&magazines>0),
     "Invalid magazine count "+id);
  entries[id]={
   id,name:NAME[id],sourceRule:SOURCE[id],magazineSize,magazines,
   interval,reloadSeconds,canFireMoving,
   loaded:magazineSize,reserve:magazineSize===Infinity?Infinity:magazineSize*(magazines-1),
   cooldown:0,reloadRemaining:0,shots:0,reloads:0
  };
 }
 let selected=IDS[0],triggerHeld=false,moving=false,simTime=0;
 const events=[];
 function emit(type,extra={}){
  const ev={type,weapon:selected,at:simTime,...extra};
  events.push(ev);if(events.length>120)events.shift();
  onEvent(ev);
  return ev;
 }
 function current(){return entries[selected]}
 function snapshot(id=selected){
  ensure(entries[id],"Unknown combat weapon "+id);
  const w=entries[id];
  return {...w,
   total:w.loaded===Infinity?Infinity:w.loaded+w.reserve,
   reloading:w.reloadRemaining>0,
   moving,triggerHeld,selected,clock:simTime};
 }
 function weapon(id){
  ensure(entries[id],"Only the four Allied weapons may be selected");
  triggerHeld=false;
  selected=id;
  emit("equip",{loaded:entries[id].loaded,reserve:entries[id].reserve});
  return snapshot();
 }
 function setTrigger(on){triggerHeld=!!on;return triggerHeld}
 function setMoving(value){moving=!!value;return moving}
 function startReload(w=current()){
  if(w.loaded===Infinity)return {ok:false,reason:"infinite-rifle"};
  if(w.reloadRemaining>0)return {ok:false,reason:"reloading"};
  if(w.loaded>=w.magazineSize)return {ok:false,reason:"full"};
  if(w.reserve<=0)return {ok:false,reason:"no-reserve"};
  w.reloadRemaining=w.reloadSeconds;
  w.cooldown=0;
  emit("reload-start",{seconds:w.reloadSeconds,loaded:w.loaded,reserve:w.reserve});
  return {ok:true,seconds:w.reloadSeconds};
 }
 function reload(){return startReload()}
 function finishReload(w){
  const supply=Math.min(w.magazineSize-w.loaded,w.reserve);
  w.loaded+=supply;w.reserve-=supply;
  w.reloadRemaining=0;w.reloads++;
  emit("reload-end",{loaded:w.loaded,reserve:w.reserve});
 }
 function shoot(w){
  if(w.loaded!==Infinity)w.loaded--;
  w.shots++;
  w.cooldown+=w.interval;
  emit("shot",{shotNo:w.shots,loaded:w.loaded,reserve:w.reserve,
    interval:w.interval,moving});
  if(w.loaded===0){
   if(w.reserve>0)startReload(w);
   else emit("out-of-ammo",{loaded:0,reserve:0});
  }
 }
 // Piecewise timeline simulation keeps cooldown/reloads consistent at 30/60/144 FPS.
 // A long frame is capped by the caller, not dropped by this pure controller.
 function tick(dt){
  ensure(Number.isFinite(dt)&&dt>=0&&dt<=10,"Invalid combat dt");
  const w=current();
  let left=dt,limit=0;
  simTime+=dt;
  const eps=1e-9;
  while(limit++<200){
   if(w.reloadRemaining>eps){
    const step=Math.min(left,w.reloadRemaining);
    w.reloadRemaining=Math.max(0,w.reloadRemaining-step);
    left-=step;
    if(w.reloadRemaining<=eps)finishReload(w);
    else break;
    if(left<=eps)break;
    continue;
   }
   if(w.cooldown>eps){
    const step=Math.min(left,w.cooldown);
    w.cooldown=Math.max(0,w.cooldown-step);
    left-=step;
    if(w.cooldown>eps||left<=eps)break;
    continue;
   }
   if(!triggerHeld)break;
   if(moving&&!w.canFireMoving)break;
   if(w.loaded===0){
    if(w.reserve>0)startReload(w);
    break;
   }
   shoot(w);
   if(left<=eps)break;
  }
  ensure(limit<200,"Combat state machine exceeded shot safety bound");
  return snapshot();
 }
 function reset(){
  for(const id of IDS){
   const w=entries[id];
   w.loaded=w.magazineSize;
   w.reserve=w.magazineSize===Infinity?Infinity:w.magazineSize*(w.magazines-1);
   w.cooldown=0;w.reloadRemaining=0;w.shots=0;w.reloads=0;
  }
  triggerHeld=false;moving=false;simTime=0;selected=IDS[0];events.length=0;
  emit("reset");
  return snapshot();
 }
 return Object.freeze({
  current,snapshot,weapon,setTrigger,setMoving,reload,tick,reset,
  getSelected:()=>selected,getEvents:()=>events.slice(),
  getAll:()=>IDS.map(id=>snapshot(id))
 });
}
return Object.freeze({create,IDS,SOURCE,NAME});
});