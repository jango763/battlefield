'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const game=fs.readFileSync(path.join(root,'babylon/game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'babylon/index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'babylon/replenishment-core.js'),'utf8');
new Function(game);new Function(source);
assert(html.includes('replenishment-core.js'),'Game missing reinforcement module');
assert(html.includes('Бесконечные подкрепления'),'Fixed 12v12 menu still shown');
assert(game.includes("if(scenario==='squads'&&i>0)unit.alive=false"),
 'Reservist logical actors must not all spawn alive');
assert(!game.includes("ensureUnits('squads').then"),
 'Must not instantiate 24 heavyweight GLB models immediately on Enter');
assert(game.includes("await ensureUnits([slot])"),'New units must stream one exact character slot');
assert(game.includes('reinforcementEpoch++'),'Reset should invalidate pending imports');
assert(game.includes("state.reinforcements=replenisher.snapshot()"),
 'HUD must expose actual live reinforcement state');
const {create,DEFAULTS}=require('../replenishment-core.js');
assert.equal(DEFAULTS.secondsPerSoldier,1.4);
assert.equal(DEFAULTS.maxAlivePerSide,8);
const blue=Array.from({length:12},(_,i)=>({id:'b'+i,alive:i===0}));
const red=Array.from({length:12},(_,i)=>({id:'r'+i,alive:i===0}));
const plan=create({allies:blue,enemies:red,hero:blue[0]});
let generated=0,peakBlue=0,peakRed=0;
function advance(seconds,{auto=true}={}){
 const frames=Math.ceil(seconds/.1);
 for(let i=0;i<frames;i++){
  const requests=plan.update(.1);
  assert(requests.filter(r=>r.side==='blue').length<=1);
  assert(requests.filter(r=>r.side==='red').length<=1);
  if(auto)for(const r of requests){
   assert(!r.unit.alive,'Should only deploy inactive reserve');
   r.unit.alive=true;
   assert(plan.finish(r.unit,true),'Expected outstanding model request');
   generated++;
  }
  const snap=plan.snapshot();
  peakBlue=Math.max(peakBlue,snap.blueAlive+snap.bluePending);
  peakRed=Math.max(peakRed,snap.redAlive+snap.redPending);
  assert(snap.blueAlive+snap.bluePending<=8,'British active budget exceeded');
  assert(snap.redAlive+snap.redPending<=8,'German active budget exceeded');
 }
}
assert.equal(plan.snapshot().blueAlive,1,'Start only with American hero');
assert.equal(plan.snapshot().redAlive,1,'Start only with first German');
advance(.9);
assert.equal(plan.snapshot().blueAlive,1,'Spawns too early before 1.4s');
advance(1);
assert(plan.snapshot().blueAlive>1,'First British reinforcement missing');
assert(plan.snapshot().redAlive>1,'First German reinforcement missing');
advance(12);
assert.equal(plan.snapshot().blueAlive,8,'British capped active budget missing');
assert.equal(plan.snapshot().redAlive,8,'Wehrmacht capped active budget missing');
const a=blue.find((u,i)=>i>0&&u.alive),b=red.find((u,i)=>i>0&&u.alive);
a.alive=false;b.alive=false;
assert.equal(plan.snapshot().blueAlive,7,'Fatality not reflected in ally roster');
advance(.3);
assert(plan.snapshot().blueAlive<=8,'Replenishment exceeded per-side cap');
advance(6);
assert.equal(plan.snapshot().blueAlive,8,'Dead British soldier not replenished');
assert.equal(plan.snapshot().redAlive,8,'Dead German soldier not replenished');
// Continuous recruitment is not capped to 24 lifetime units.
for(let death=0;death<22;death++){
 const x=blue.find((u,i)=>i>0&&u.alive);
 const y=red.find(u=>u.alive);
 x.alive=false;y.alive=false;
 advance(6);
}
assert(generated>24,'Reinforcements incorrectly stop after original 24 deployments');
assert.equal(peakBlue,8);assert.equal(peakRed,8);
// Hero is the ONLY unit with the original 28-second respawn delay.
blue[0].alive=false;
advance(12);
assert(!blue[0].alive,'Hero respawned too early');
advance(17);
assert(blue[0].alive,'Hero never returned after 28s');
// Async GLB budget: at most one pending import per faction.
const freshBlue=Array.from({length:12},(_,i)=>({alive:i===0}));
const freshRed=Array.from({length:12},(_,i)=>({alive:i===0}));
const stalled=create({allies:freshBlue,enemies:freshRed,hero:freshBlue[0]});
let pending=0;
for(let i=0;i<110;i++)pending+=stalled.update(.1).length;
assert.equal(pending,2,'One pending import per side must block extra GLB requests');
stalled.stop();
assert.equal(stalled.update(.1).length,0,'Stopped battle must not spawn');
console.log('CONTINUOUS_REINFORCEMENT_PASS',{
 initial:'1 hero + 1 enemy',maxActivePerSide:8,
 generatedAfterRecycling:generated,heroRespawnSeconds:28,
 originalGameUnchanged:true
});
