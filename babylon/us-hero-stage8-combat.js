/* Battlefield · Stage 8 · isolated Allied hero weapon timing.
 * Renderer independent. The four Allied variants share the existing Battlefield
 * balance timings; they do not mutate the approved German combat system.
 * Rifles have infinite ammunition by design (no mandatory reload).
 * The external host owns meshes, muzzle effects and animation clips.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.BattlefieldUSStage8Combat=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const PROFILES=Object.freeze({
 "uk-lee-enfield":Object.freeze({label:"Lee-Enfield",interval:2.1,magazineSize:Infinity,magazines:Infinity,reloadSeconds:0,canFireMoving:false,automatic:false,kind:"rifle"}),
 "uk-sten":Object.freeze({label:"Sten",interval:.105,magazineSize:32,magazines:5,reloadSeconds:2.5,canFireMoving:true,automatic:true,kind:"smg"}),
 "uk-bren":Object.freeze({label:"Bren",interval:.067,magazineSize:100,magazines:4,reloadSeconds:7.5,canFireMoving:true,automatic:true,kind:"lmg"}),
 "uk-piat":Object.freeze({label:"PIAT",interval:1,magazineSize:1,magazines:4,reloadSeconds:9,canFireMoving:false,automatic:false,kind:"launcher"})
});
const MOTIONS=Object.freeze(["idle","walk","jog","sprint"]);
const EPS=1e-8;
const copy=x=>JSON.parse(JSON.stringify(x));
function create({weapon="uk-lee-enfield",onEvent=()=>{}}={}){
 if(!PROFILES[weapon])throw Error("Unknown Allied weapon "+weapon);
 if(typeof onEvent!=="function")throw Error("onEvent must be a function");
 const inventory={};
 let time=0,nextFireAt=0,active=weapon,motion="idle",triggerHeld=false;
 let reload=null,totalShots=0,totalReloads=0;
 const events=[];
 const slot=id=>{
  if(!inventory[id]){
   const c=PROFILES[id];
   inventory[id]={loaded:c.magazineSize,reserve:c.magazines===Infinity?Infinity:c.magazineSize*(c.magazines-1),shots:0,reloads:0,exhaustedNotified:false};
  }
  return inventory[id];
 };
 slot(active);
 function emit(type,info={}){
  const e={type,at:time,weapon:active,...info};
  events.push(e);
  if(events.length>320)events.shift();
  onEvent(e);
  return e;
 }
 function snapshot(){
  const p=PROFILES[active],s=slot(active);
  const remaining=reload?Math.max(0,reload.endsAt-time):0;
  return {time,weapon:active,label:p.label,kind:p.kind,
   loaded:s.loaded,reserve:s.reserve,ammoTotal:s.loaded+s.reserve,
   magazineSize:p.magazineSize,magazines:p.magazines,
   reloadSeconds:p.reloadSeconds,reloading:!!reload,
   reloadRemaining:remaining,reloadProgress:reload?Math.max(0,Math.min(1,1-remaining/reload.seconds)):0,
   motion,moving:motion!=="idle",canFireMoving:p.canFireMoving,
   triggerHeld,cooldownRemaining:Math.max(0,nextFireAt-time),
   shots:s.shots,totalShots,totalReloads,
   empty:s.loaded===0&&s.reserve===0,
   weaponSlots:Object.fromEntries(Object.entries(inventory).map(([id,x])=>[id,{...x}]))};
 }
 function finishReload(){
  if(!reload)return false;
  const id=reload.weapon,c=PROFILES[id],s=slot(id);
  if(id!==active){reload=null;return false;}
  const add=Math.min(c.magazineSize-s.loaded,s.reserve);
  s.loaded+=add;s.reserve-=add;
  s.reloads++;totalReloads++;reload=null;
  emit("reload-complete",{loaded:s.loaded,reserve:s.reserve});
  return true;
 }
 function beginReload({manual=false}={}){
  const c=PROFILES[active],s=slot(active);
  if(reload)return {ok:false,reason:"already-reloading"};
  if(c.magazineSize===Infinity)return {ok:false,reason:"infinite-rifle-ammo"};
  if(s.reserve<=0)return {ok:false,reason:"no-reserve"};
  if(s.loaded>=c.magazineSize)return {ok:false,reason:"magazine-full"};
  reload={weapon:active,endsAt:time+c.reloadSeconds,seconds:c.reloadSeconds};
  emit("reload-start",{manual,seconds:c.reloadSeconds,loaded:s.loaded,reserve:s.reserve});
  return {ok:true,endsAt:reload.endsAt};
 }
 function doShot(){
  const c=PROFILES[active],s=slot(active);
  if(reload)return {ok:false,reason:"reloading"};
  if(!c.canFireMoving&&motion!=="idle")return {ok:false,reason:"stop-to-fire"};
  if(time+EPS<nextFireAt)return {ok:false,reason:"cooldown"};
  if(s.loaded===0){
   if(s.reserve>0)beginReload();
   return {ok:false,reason:s.reserve>0?"reloading":"out-of-ammo"};
  }
  if(Number.isFinite(s.loaded))s.loaded--;
  s.shots++;totalShots++;
  nextFireAt=time+c.interval;
  emit("shot",{seq:totalShots,loaded:s.loaded,reserve:s.reserve,kind:c.kind});
  if(s.loaded===0){
   if(s.reserve>0)beginReload();
   else if(!s.exhaustedNotified){
    s.exhaustedNotified=true;
    emit("depleted",{fallback:"uk-lee-enfield"});
   }
  }
  return {ok:true,shot:totalShots,weapon:active};
 }
 function setTrigger(held){
  triggerHeld=!!held;
  return snapshot();
 }
 function setMotion(next){
  if(!MOTIONS.includes(next))throw Error("Invalid Quaternius motion "+next);
  if(motion===next)return snapshot();
  motion=next;
  emit("motion",{motion});
  return snapshot();
 }
 function equip(id){
  if(!PROFILES[id])throw Error("Unknown Allied weapon "+id);
  if(id===active)return snapshot();
  triggerHeld=false;reload=null;active=id;slot(active);nextFireAt=time;
  emit("equipped",{loaded:slot(active).loaded,reserve:slot(active).reserve});
  return snapshot();
 }
 function tick(delta){
  if(!Number.isFinite(delta)||delta<0||delta>60)throw Error("Invalid frame delta");
  const end=time+delta;
  // Integrate events at exact simulation timestamps: identical counts at
  // 30/60/144 FPS. No setTimeout, no Date.now or background process required.
  let steps=0;
  while(steps++<2500){
   const c=PROFILES[active],s=slot(active);
   const finishAt=reload?reload.endsAt:Infinity;
   const eligible=triggerHeld&&
     (c.automatic||s.shots===0||true)&&
     (c.canFireMoving||motion==="idle")&&!reload&&s.loaded>0;
   const shotAt=eligible?Math.max(time,nextFireAt):Infinity;
   const due=Math.min(finishAt,shotAt);
   if(due>end+EPS||!Number.isFinite(due))break;
   time=Math.max(time,due);
   if(finishAt<=shotAt+EPS)finishReload();
   else doShot();
  }
  if(steps>2500)throw Error("Excessive simulated shot events");
  time=end;
  return snapshot();
 }
 function shotOnce(){
  return doShot();
 }
 function reset(){
  for(const id of Object.keys(inventory))delete inventory[id];
  time=0;nextFireAt=0;reload=null;triggerHeld=false;
  motion="idle";active=weapon;slot(active);totalShots=0;totalReloads=0;
  events.length=0;
  emit("reset");
  return snapshot();
 }
 return Object.freeze({tick,shotOnce,setTrigger,setMotion,equip,beginReload,snapshot,reset,
  history:()=>events.slice(),profiles:PROFILES});
}
return Object.freeze({create,PROFILES,MOTIONS});
});