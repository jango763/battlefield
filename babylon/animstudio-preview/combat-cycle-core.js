/* Battlefield Babylon - animation-frame-driven combat cycle.
 * Stops movement before any shot, drives an actual crouch layer (Kar98k),
 * requires the bolt cycle before resuming/re-firing, and emits shot/bolt
 * events at specified keyframe markers. No DOM/Babylon dependency.
 * All timing below is authored in 30-fps animation frames, not setTimeout.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BattlefieldCombatCycle=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const FPS=30;
const RUN_AND_GUN=new Set(['MP40','MG42']);
// Authored gameplay reload durations at 30 fps:
// MP40 2.5 s, MG42 7.5 s, shoulder launcher Panzerschreck 9 s.
const RELOAD=Object.freeze({
 MP40:Object.freeze({frames:75,seconds:2.5,capacity:32,containers:5,mayMove:true}),
 MG42:Object.freeze({frames:225,seconds:7.5,capacity:100,containers:4,mayMove:false}),
 Panzerschreck:Object.freeze({frames:270,seconds:9,capacity:1,containers:4,mayMove:false})
});
const stages={
 Kar98k:[
  {id:'run',clip:'Run',frames:36,travel:true,stance:0,markers:[]},
  {id:'stop',clip:'Hold',frames:14,travel:false,stance:.18,markers:[]},
  {id:'lower',clip:'Aim',frames:21,travel:false,stance:1,markers:[]},
  {id:'aim',clip:'Aim',frames:29,travel:false,stance:1,markers:[]},
  {id:'fire',clip:'Fire',frames:10,travel:false,stance:1,
   markers:[{frame:4,name:'shot'}]},
  {id:'bolt',clip:'Aim',frames:33,travel:false,stance:1,
   markers:[{frame:4,name:'bolt-handle-lift'},
     {frame:10,name:'bolt-back'},{frame:23,name:'bolt-forward'},
     {frame:30,name:'bolt-locked'}]},
  {id:'recover',clip:'Hold',frames:23,travel:false,stance:.18,markers:[]},
  {id:'resume',clip:'Run',frames:31,travel:true,stance:0,markers:[]}
 ],
 // MP40 and MG42 preserve the full RUN leg clip during firing.
 // Shot markers are animation-frame events; recoil is an upper-body overlay.
 MP40:[
  {id:'run',clip:'Run',frames:28,travel:true,stance:0,markers:[]},
  {id:'runFire',clip:'Run',frames:67,travel:true,stance:0,markers:[
   {frame:10,name:'shot'},{frame:19,name:'shot'},{frame:28,name:'shot'},
   {frame:43,name:'shot'},{frame:52,name:'shot'}]},
  // Tactical reload preview after a burst; also used when magazine is empty.
  // Run animation stays active while changing the MP40 magazine.
  {id:'reload',clip:'Run',frames:RELOAD.MP40.frames,travel:true,stance:0,
   markers:[{frame:1,name:'reload-start'},{frame:75,name:'reload-complete'}]},
  {id:'resume',clip:'Run',frames:25,travel:true,stance:0,markers:[]}
 ],
 MG42:[
  {id:'run',clip:'Run',frames:26,travel:true,stance:0,markers:[]},
  {id:'runFire',clip:'Run',frames:66,travel:true,stance:0,markers:[
   {frame:11,name:'shot'},{frame:15,name:'shot'},{frame:19,name:'shot'},
   {frame:23,name:'shot'},{frame:27,name:'shot'},
   {frame:43,name:'shot'},{frame:47,name:'shot'},{frame:51,name:'shot'},
   {frame:55,name:'shot'},{frame:59,name:'shot'}]},
  // The heavier MG42 belt change is performed only after a full stop.
  {id:'stop',clip:'Hold',frames:15,travel:false,stance:0,markers:[]},
  {id:'reload',clip:'Hold',frames:RELOAD.MG42.frames,travel:false,stance:0,
   markers:[{frame:1,name:'reload-start'},{frame:225,name:'reload-complete'}]},
  {id:'resume',clip:'Run',frames:29,travel:true,stance:0,markers:[]}
 ],
 Panzerschreck:[
  {id:'run',clip:'Run',frames:35,travel:true,stance:0,markers:[]},
  {id:'stop',clip:'Hold',frames:14,travel:false,stance:.03,markers:[]},
  {id:'aim',clip:'Aim',frames:32,travel:false,stance:.11,markers:[]},
  {id:'fire',clip:'Fire',frames:11,travel:false,stance:.11,
   markers:[{frame:5,name:'shot'}]},
  // Rocket already fired; stand still and reload from the rear of the tube.
  // This is a blocked 9-second gameplay state; the 3D gesture is a placeholder.
  {id:'reload',clip:'Hold',frames:RELOAD.Panzerschreck.frames,travel:false,
   stance:.08,markers:[{frame:1,name:'reload-start'},
     {frame:270,name:'reload-complete'}]},
  {id:'recover',clip:'Hold',frames:29,travel:false,stance:.03,markers:[]},
  {id:'resume',clip:'Run',frames:30,travel:true,stance:0,markers:[]}
 ]
};
for(const key of Object.keys(stages))Object.freeze(stages[key]);
function clamp(x,a,b){return Math.min(b,Math.max(a,x))}
function create({weapon='Kar98k',onStage=()=>{},onMarker=()=>{},onPose=()=>{},
  measureSpeed=null,requestStop=()=>{},speedEpsilon=.06,
  runSpeed=3.4,deceleration=9,fps=FPS,supply=null,unitId=null}={}){
 if(!stages[weapon])throw Error('Unknown firearm '+weapon);
 const linked=supply!==null;
 if(linked&&(!supply.snapshot||!supply.fire||!supply.beginReload||
    !supply.tick||unitId===null))throw Error('Supply interface or soldier ID missing');
 function inventory(){return linked?supply.snapshot(unitId).inventory[weapon]:null;}
 const timeline=stages[weapon],s={
   weapon,phase:'idle',clip:'Hold',phaseFrame:0,progress:0,
   moving:false,speed:0,crouch:0,boltProgress:0,reloading:false,
   reloadProgress:0,reloadElapsedFrames:0,reloadCount:0,
   reloadFrames:RELOAD[weapon]?.frames||0,
   reloadSeconds:RELOAD[weapon]?.seconds||0,
   ammoCapacity:RELOAD[weapon]?.capacity??null,
   ammoRemaining:RELOAD[weapon]?.capacity??null,
   reserveContainers:RELOAD[weapon]?.containers-1??0,
   fired:0,boltLocked:weapon==='Panzerschreck',
   boltCount:0,shotsOnMove:0,movingShots:0,history:[],markers:[],done:false,
   running:false,requestedStop:false
 };
 if(linked){
   const bag=inventory();
   if(RELOAD[weapon]&&!bag)throw Error('Soldier has not purchased '+weapon);
   if(bag){s.ammoRemaining=bag.loaded;s.reserveContainers=bag.spareContainers;}
 }
 function syncAmmo(){
   if(!linked)return;
   const bag=inventory();
   if(bag){s.ammoRemaining=bag.loaded;s.reserveContainers=bag.spareContainers;}
 }
 let phaseIndex=-1,phaseFrame=0,markerSeen=new Set(),sequenceId=0;
 function copy(){return {...s,history:s.history.map(x=>({...x})),markers:s.markers.map(x=>({...x}))}}
 function log(kind,fields={}){s.history.push({kind,phase:s.phase,...fields})}
 function transition(index){
   if(index<timeline.length&&timeline[index].id==='reload'&&
      RELOAD[weapon]&&s.reserveContainers<=0){
     s.phase='outOfAmmo';s.clip='Hold';s.phaseFrame=0;s.progress=1;
     s.reloading=false;s.moving=false;s.speed=0;s.running=false;s.done=true;
     log('outOfAmmo',{fired:s.fired});
     onStage(copy());return;
   }
   if(index===timeline.length){
     s.phase='complete';s.clip='Hold';s.phaseFrame=0;s.progress=1;
     s.crouch=0;s.moving=false;s.speed=0;s.done=true;s.running=false;
     onStage(copy());return;
   }
   phaseIndex=index;phaseFrame=0;markerSeen=new Set();
   const stage=timeline[index];
   s.phase=stage.id;s.clip=stage.clip;s.phaseFrame=0;s.progress=0;
   s.moving=stage.travel;s.crouch=stage.stance;s.boltProgress=0;
   s.reloading=stage.id==='reload';
   s.reloadProgress=0;s.reloadElapsedFrames=0;
   if(stage.id==='stop'){s.requestedStop=true;requestStop();}
   if(stage.id==='fire'){
     if(s.speed>speedEpsilon||s.moving){s.shotsOnMove++;throw Error('Cannot shoot while moving');}
     if(!s.markers.some(x=>x.name==='stop-confirmed'))throw Error('Stop not confirmed');
     if(weapon==='Kar98k'&&!s.boltLocked)throw Error('Bolt must be closed before shot');
   }
   if(stage.id==='bolt'&&weapon!=='Kar98k')throw Error('Only Kar98k cycles a bolt');
   if(stage.id==='reload'&&!RELOAD[weapon])
     throw Error('Weapon cannot enter reload phase');
   if(stage.id==='reload'&&linked){
     const r=supply.beginReload(unitId);
     if(!r.ok)throw Error('Supply reload rejected: '+r.reason);
   }
   log('phase',{frame:0});
   onStage(copy());
 }
 function emit(name,frame){
   const marker={name,phase:s.phase,frame,sequenceId};
   if(name==='shot'){
     if(s.reloading)throw Error('Cannot shoot during reload');
     if(RELOAD[weapon]&&s.ammoRemaining<=0)
       throw Error('No ammunition: reload required');
     if(RUN_AND_GUN.has(weapon)){
       if(s.ammoRemaining===0)throw Error('Magazine empty: reload required');
       if(s.phase!=='runFire'||!s.moving||s.speed<=speedEpsilon)
         throw Error('Moving shot requires active running velocity');
       s.movingShots++;
     }else{
       if(s.speed>speedEpsilon||s.moving){s.shotsOnMove++;throw Error('Shot fired while moving');}
       if(weapon==='Kar98k'&&!s.boltLocked)throw Error('Bolt is not ready');
       if(!s.markers.some(x=>x.name==='stop-confirmed'))
         throw Error('Shot without stopped pose');
     }
     if(linked){
       const result=supply.fire(unitId);
       if(!result.ok||result.weapon!==weapon)throw Error('Supply shot rejected: '+result.reason);
       syncAmmo();
     }else if(RELOAD[weapon])s.ammoRemaining--;
     s.fired++;
     if(weapon==='Kar98k')s.boltLocked=false;
   }
   if(name==='reload-start'){
     if(!RELOAD[weapon]||!s.reloading)
       throw Error('Reload marker outside firearm reload phase');
     if(!RELOAD[weapon].mayMove&&s.speed>speedEpsilon)
       throw Error('Heavy weapon reload requires full stop');
   }
   if(name==='reload-complete'){
     if(!RELOAD[weapon]||!s.reloading)
       throw Error('Reload-complete marker without active reload');
     if(s.reloadElapsedFrames<RELOAD[weapon].frames-1e-6)
       throw Error('Reload finished before required duration');
     if(linked){
       syncAmmo();
       if(s.ammoRemaining!==RELOAD[weapon].capacity)
         throw Error('Reload animation ended before supply completed');
     }else{
       s.ammoRemaining=RELOAD[weapon].capacity;
       s.reserveContainers--;
     }
     s.reloadCount++;
     s.reloading=false;
   }
   if(name==='bolt-locked'){s.boltLocked=true;s.boltCount++;}
   s.markers.push(marker);log('marker',{name,frame});
   onMarker(marker,copy());
 }
 function start(){
   sequenceId++;s.phase='idle';s.clip='Hold';s.progress=0;s.phaseFrame=0;
   s.running=true;s.done=false;s.moving=true;s.speed=runSpeed;s.crouch=0;
   s.boltProgress=0;s.fired=0;s.boltCount=0;s.shotsOnMove=0;s.movingShots=0;
   s.reloading=false;s.reloadCount=0;s.reloadProgress=0;s.reloadElapsedFrames=0;
   syncAmmo();s.markers=[];s.history=[];
   s.boltLocked=true;s.requestedStop=false;
   if(RELOAD[weapon]&&s.ammoRemaining===0){
     if(s.reserveContainers===0){
       s.phase='outOfAmmo';s.running=false;s.done=true;
       onStage(copy());return copy();
     }
     // Restart at the reload segment only after a cancelled reload;
     // all shot markers are blocked until the full animation has elapsed.
     if(weapon==='MP40'){transition(timeline.findIndex(x=>x.id==='reload'));}
     else{ s.speed=0;s.moving=false;transition(timeline.findIndex(x=>x.id==='reload')); }
     return copy();
   }
   transition(0);
   return copy();
 }
 function update(dt){
   if(!s.running)return copy();
   if(!Number.isFinite(dt)||dt<0)throw Error('Invalid delta');
   // Frame-rate independent fixed-time event search. 240ms tab stall cannot
   // skip a shot or cycle the bolt twice.
   let frames=Math.min(dt,1.0)*fps;
   let limit=0;
   while(frames>1e-8 && s.running){
     if(++limit>100)throw Error('Animation state machine did not advance');
     const stage=timeline[phaseIndex];
     const remaining=stage.frames-phaseFrame;
     const take=Math.min(frames,remaining);
     const before=phaseFrame;
     phaseFrame+=take;frames-=take;
     const seconds=take/fps;
     if(stage.id==='reload'&&linked)supply.tick(seconds);
     if(stage.travel){
       s.speed=typeof measureSpeed==='function'
         ?Math.max(0,Number(measureSpeed())||0):runSpeed;
     }else if(typeof measureSpeed==='function'){
       s.speed=Math.max(0,Number(measureSpeed())||0);
     }else{
       s.speed=Math.max(0,s.speed-deceleration*seconds);
     }
     s.phaseFrame=phaseFrame;s.progress=clamp(phaseFrame/stage.frames,0,1);
     if(stage.id==='lower')s.crouch=.18+.82*smooth(s.progress);
     else if(stage.id==='recover')s.crouch=1-.82*smooth(s.progress);
     else if(stage.id==='stop')s.crouch=.18*smooth(s.progress);
     else s.crouch=stage.stance;
     if(stage.id==='bolt')s.boltProgress=s.progress;
     if(stage.id==='reload'){
       s.reloadProgress=s.progress;
       s.reloadElapsedFrames=phaseFrame;
     }
     onPose(copy());
     for(const m of stage.markers){
       const key=m.name+'@'+m.frame;
       if(before<m.frame&&phaseFrame>=m.frame&&!markerSeen.has(key)){
         markerSeen.add(key);
         // A burst's remaining keyframes are silent once the last cartridge
         // is spent. The following reload uses a real spare magazine.
         if(m.name==='shot'&&RELOAD[weapon]&&s.ammoRemaining<=0)continue;
         emit(m.name,m.frame);
       }
     }
     if(phaseFrame+1e-7>=stage.frames){
       if(stage.id==='stop'){
         if(s.speed>speedEpsilon){
           // Keep the animation parked at its last stopping frame until
           // the actual movement system reports that the soldier is still.
           phaseFrame=stage.frames-1;s.phaseFrame=phaseFrame;
           s.progress=phaseFrame/stage.frames;
           if(frames>0)frames=0;
           break;
         }
         if(!s.markers.some(m=>m.name==='stop-confirmed'))
           emit('stop-confirmed',stage.frames);
       }
       // Continue firing until the *actual* magazine/belt is empty;
       // do not waste 27 MP40 rounds or 90 MG42 rounds per short demo burst.
       transition(stage.id==='runFire'&&s.ammoRemaining>0?
         phaseIndex:phaseIndex+1);
     }
   }
   return copy();
 }
 function smooth(t){t=clamp(t,0,1);return t*t*(3-2*t)}
 function stop(){
   sequenceId++;s.running=false;s.done=false;s.phase='idle';s.clip='Hold';
   s.speed=0;s.moving=false;s.crouch=0;s.boltProgress=0;
   s.reloading=false;s.reloadProgress=0;s.reloadElapsedFrames=0;
   onStage(copy());return copy();
 }
 return {start,update,stop,snapshot:copy,timeline,framesPerSecond:fps};
}
return {create,PROFILES:stages,FPS,RUN_AND_GUN,RELOAD};
});
