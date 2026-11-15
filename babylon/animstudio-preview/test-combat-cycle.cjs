const assert=require('node:assert/strict');
const {create,PROFILES}=require('./combat-cycle-core.js');
function simulate(weapon,fps){
 const events=[],phases=[];
 const c=create({weapon,
  onStage:s=>phases.push({phase:s.phase,speed:s.speed,crouch:s.crouch}),
  onMarker:(m,s)=>events.push({name:m.name,phase:s.phase,speed:s.speed,shot:s.fired,
   boltLocked:s.boltLocked})
 });
 c.start();
 let snap;for(let i=0;i<1200;i++){
  snap=c.update(1/fps);
  if(snap.done)break;
 }
 assert(snap.done,'Combat cycle never finished '+weapon+' '+fps);
 assert(snap.history.filter(x=>x.kind==='phase').some(x=>x.phase==='stop'));
 assert.equal(snap.shotsOnMove,0);
 assert.equal(snap.fired,1);
 assert.equal(events.filter(x=>x.name==='shot').length,1);
 const stop=events.findIndex(x=>x.name==='stop-confirmed');
 const shot=events.findIndex(x=>x.name==='shot');
 assert(stop>=0&&shot>stop,'Shot occurred before stop');
 const fired=events[shot];
 assert.equal(fired.speed,0,'Shot while moving');
 assert.equal(phases[phases.length-1].phase,'complete');
 if(weapon==='Kar98k'){
  const keys=['bolt-handle-lift','bolt-back','bolt-forward','bolt-locked'];
  assert.deepEqual(events.filter(x=>x.name.startsWith('bolt-')).map(x=>x.name),keys);
  assert.equal(snap.boltCount,1);
  assert.equal(snap.boltLocked,true);
  assert(phases.some(x=>x.phase==='lower'&&x.crouch===1));
  assert(phases.some(x=>x.phase==='fire'&&x.crouch===1));
 }else{
  assert.equal(snap.boltCount,0,'Panzerschreck erroneously cycles bolt');
  assert.equal(events.filter(x=>x.name.startsWith('bolt-')).length,0);
  assert(phases.find(x=>x.phase==='fire').crouch<.2,'Panzerschreck wrongly crouches');
 }
 return {weapon,fps,markers:events.map(x=>x.name),phases:phases.map(x=>x.phase)};
}
const seq=[];
for(const weapon of Object.keys(PROFILES)){
 const a=simulate(weapon,30),b=simulate(weapon,60),c=simulate(weapon,144);
 assert.deepEqual(a.markers,b.markers);
 assert.deepEqual(b.markers,c.markers);
 seq.push({weapon,markers:a.markers});
}
// External movement provider: the machine must park at stop until actual speed is zero.
let measured=1.5,stops=0,markers=[];
const ext=create({weapon:'Kar98k',measureSpeed:()=>measured,
 requestStop:()=>stops++,onMarker:m=>markers.push(m.name)});
ext.start();
for(let i=0;i<250;i++)ext.update(1/60);
assert.equal(ext.snapshot().phase,'stop','did not park at stop');
assert.equal(ext.snapshot().fired,0);
measured=0;
for(let i=0;i<400;i++)ext.update(1/60);
assert(ext.snapshot().fired===1&&markers.includes('shot'));
assert.equal(stops,1);
let cancelShots=0;
const aborted=create({weapon:'Panzerschreck',onMarker:m=>{
 if(m.name==='shot')cancelShots++;
}});
aborted.start();aborted.update(.4);aborted.stop();
for(let i=0;i<200;i++)aborted.update(1/60);
assert.equal(cancelShots,0);
assert.equal(aborted.snapshot().phase,'idle');
console.log('COMBAT_FIXED_FRAME_EVENT_TESTS_PASS '+JSON.stringify(seq));
console.log('STOP_GATE_EXTERNAL_MOVEMENT_AND_CANCELLATION_PASS');
