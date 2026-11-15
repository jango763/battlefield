const assert=require('node:assert/strict');
const {create,PROFILES,RELOAD,RUN_AND_GUN,FPS}=require('./combat-cycle-core.js');
assert.equal(FPS,30);
assert.equal(RELOAD.MP40.seconds,2.5);
assert.equal(RELOAD.MG42.seconds,7.5);
assert.equal(RELOAD.MP40.frames,75);
assert.equal(RELOAD.MG42.frames,225);
const all=[];
function simulate(weapon,fps){
 const events=[],phaseHistory=[];
 const c=create({weapon,
  onStage:st=>phaseHistory.push({phase:st.phase,moving:st.moving,crouch:st.crouch}),
  onMarker:(m,st)=>events.push({name:m.name,phase:st.phase,frame:m.frame,
    speed:st.speed,moving:st.moving,reloading:st.reloading,
    elapsed:st.reloadElapsedFrames,ammo:st.ammoRemaining,fired:st.fired})
 });
 c.start();
 let state;
 for(let i=0;i<Math.ceil(fps*35);i++){
  state=c.update(1/fps);
  if(state.done)break;
 }
 assert(state.done,weapon+' did not complete at '+fps+' FPS');
 assert.equal(state.shotsOnMove,0,weapon+' fired illegally while moving');
 const shots=events.filter(e=>e.name==='shot');
 assert.equal(shots.length,state.fired);
 assert(shots.length>0);
 assert.equal(phaseHistory.at(-1).phase,'complete');
 if(RUN_AND_GUN.has(weapon)){
  assert(shots.length>=5);
  assert(shots.every(e=>e.phase==='runFire'&&e.moving&&e.speed>.06),
   weapon+' did not continue running while firing');
  assert.equal(state.movingShots,shots.length);
  assert.equal(state.reloadCount,1);
  const reloadStart=events.find(e=>e.name==='reload-start');
  const reloadDone=events.find(e=>e.name==='reload-complete');
  assert(reloadStart&&reloadDone,weapon+' reload markers missing');
  assert.equal(reloadStart.phase,'reload');
  assert.equal(reloadDone.phase,'reload');
  assert.equal(reloadDone.elapsed,RELOAD[weapon].frames);
  assert.equal(state.ammoRemaining,RELOAD[weapon].capacity);
  assert(shots.every(e=>e.phase!=='reload'),
   'Reload allowed a shot');
  assert(events.indexOf(reloadStart)>events.indexOf(shots.at(-1)),
   'Reload began before final burst shot');
  assert(events.indexOf(reloadDone)>events.indexOf(reloadStart),
   'Reload completed before it started');
  const reloadPhases=phaseHistory.filter(x=>x.phase==='reload');
  assert.equal(reloadPhases.length,1);
  if(weapon==='MP40'){
   assert(reloadStart.moving&&reloadStart.speed>.06,
    'MP40 should keep moving during reload');
   assert(!events.some(e=>e.name==='stop-confirmed'));
  }else{
   const confirmed=events.find(e=>e.name==='stop-confirmed');
   assert(confirmed,'MG42 did not stop for belt change');
   assert(events.indexOf(confirmed)>events.indexOf(shots.at(-1)),
    'MG42 stopped too early');
   assert(events.indexOf(confirmed)<events.indexOf(reloadStart),
    'MG42 reload before confirmed stop');
   assert(!reloadStart.moving&&reloadStart.speed===0);
  }
 }else{
  assert.equal(shots.length,1);
  assert.equal(state.reloadCount,0);
  const stop=events.findIndex(e=>e.name==='stop-confirmed');
  const shot=events.findIndex(e=>e.name==='shot');
  assert(stop>=0&&shot>stop,'Fired without confirmed stop');
  assert.equal(events[shot].speed,0);
  if(weapon==='Kar98k'){
   assert.deepEqual(events.filter(e=>e.name.startsWith('bolt-')).map(e=>e.name),
    ['bolt-handle-lift','bolt-back','bolt-forward','bolt-locked']);
   assert.equal(state.boltCount,1);
   assert(state.boltLocked);
   assert(phaseHistory.some(x=>x.phase==='lower'&&x.crouch===1));
  }else{
   assert.equal(state.boltCount,0);
   assert.equal(phaseHistory.find(x=>x.phase==='fire').crouch,.11);
  }
 }
 return {weapon,fps,events:events.map(e=>e.name),shots:state.fired,
  reloadFrames:RELOAD[weapon]?.frames||0,reloadSeconds:RELOAD[weapon]?.seconds||0};
}
for(const weapon of Object.keys(PROFILES)){
 const a=simulate(weapon,30);
 const b=simulate(weapon,60);
 const c=simulate(weapon,144);
 assert.deepEqual(a.events,b.events,weapon+' differed 30 vs 60 FPS');
 assert.deepEqual(b.events,c.events,weapon+' differed 60 vs 144 FPS');
 all.push(a);
}
// Existing rifle/launcher safety: external movement keeps stop phase parked.
let speed=1.5,stopCount=0,observed=[];
const external=create({weapon:'Kar98k',measureSpeed:()=>speed,
 requestStop:()=>stopCount++,onMarker:m=>observed.push(m.name)});
external.start();
for(let i=0;i<250;i++)external.update(1/60);
assert.equal(external.snapshot().phase,'stop');
assert.equal(external.snapshot().fired,0);
speed=0;
for(let i=0;i<400;i++)external.update(1/60);
assert.equal(external.snapshot().fired,1);
assert(observed.includes('shot'));
assert.equal(stopCount,1);
// Cancelling MG42 while reloading must never refill ammo or fire.
let mgMarks=[];
const mg=create({weapon:'MG42',onMarker:m=>mgMarks.push(m.name)});
mg.start();
for(let i=0;i<1500;i++){
 mg.update(1/60);
 if(mg.snapshot().phase==='reload'&&mg.snapshot().reloadElapsedFrames>20)break;
}
const half=mg.snapshot();assert(half.reloading);
assert(half.ammoRemaining<RELOAD.MG42.capacity);
mg.stop();
for(let i=0;i<200;i++)mg.update(1/60);
assert.equal(mg.snapshot().reloadCount,0);
assert.equal(mg.snapshot().ammoRemaining,half.ammoRemaining);
assert(!mgMarks.includes('reload-complete'));
console.log('FOUR_WEAPON_COMBAT_RELOAD_TESTS_PASS '+JSON.stringify(all));
console.log('MP40_2_5S_MG42_7_5S_EXACT_FRAME_RELOAD_PASS');
console.log('RIFLE_ROCKET_STOP_FIRE_AND_RELOAD_CANCELLATION_PASS');
