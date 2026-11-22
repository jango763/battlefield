'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const army=require('../first-game-army-core.js');
const combat=require('../combat-balance-core.js');
const {create:makeController}=require('../squad-combat-core.js');
const gold=require('../gold-economy-core.js');
const ROOT=path.resolve(__dirname,'../..');
const game=fs.readFileSync(path.join(ROOT,'babylon/game.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'babylon/index.html'),'utf8');
new Function(game);
assert(html.includes('<script src="./first-game-army-core.js"></script>'));
assert(game.includes('window.BattlefieldFirstGameArmy'));
assert(game.includes('driveEnemies:dt=>fieldOrders.updateEnemies(dt)'));
assert(game.includes('driveAllies:dt=>fieldOrders.updateAllies(dt)'));

assert(game.includes('camera.detachControl()'));

assert(!game.includes('touchJoystick.cooldown-=dt'));
assert(game.includes("movementKeys.w"),'WASD direct movement missing');
const {createBattle}=combat;
const battle=createBattle({random:()=>.99999});
const allies=Array.from({length:12},(_,i)=>battle.addUnit({
 id:i?'blue-'+i:'hero',team:'ally',x:150+(i%4)*2,z:43+i%4}));
const enemies=Array.from({length:12},(_,i)=>battle.addUnit({
 id:'red-'+i,team:'enemy',x:150+(i%4)*2,z:265}));
const hero=allies[0];
const econ=gold.create();
const orders=army.create({hero,allies,enemies,farms:econ.farms,
 centralOpen:()=>econ.summary().central.open});
const ctrl=makeController({battle,allies,enemies,driveAllies:orders.updateAllies,
 driveEnemies:orders.updateEnemies,endWhenEliminated:false});
assert(ctrl.start().ok);
const xy=()=>({x:hero.x,z:hero.z});
const start=xy();
orders.setMovement(0,1);
for(let i=0;i<60;i++)ctrl.update(1/60);
assert(hero.z>start.z+8.5&&hero.z<start.z+9.5,
 'Thumbstick up must WALK north continuously at first-game speed');
assert(orders.snapshot().destination===null,'Joystick cannot manufacture waypoints');
assert(orders.snapshot().direct.z===1);
orders.clearMovement();
const coast=xy();
for(let i=0;i<12;i++)ctrl.update(1/60);
assert.equal(hero.z,coast.z,'Hero must STOP after releasing joystick');
assert(orders.setDestination(165,82).ok,'Tap to move remains optional');
for(let i=0;i<360;i++)ctrl.update(1/60);
assert(Math.hypot(hero.x-165,hero.z-82)<.5,'Tap destination inaccessible');
const snap=orders.snapshot();
assert(snap.mode==='turtle'||snap.mode==='semicircle');
assert(snap.aliveGuards<=6,'First-game guard contract has a six-soldier cap');
assert(snap.autonomousBlue+snap.aliveGuards===11,
 'Every living blue bot must be autonomous or guarded, not forced to escort');
// Test fresh near-hero magnetic recruits with stable slots through casualty.
const guardBattle=createBattle({random:()=>.99});
const guardHero=guardBattle.addUnit({id:'h',team:'ally',x:150,z:50});
const near=Array.from({length:8},(_,i)=>guardBattle.addUnit({
 id:'g'+i,team:'ally',x:151+i*.6,z:50}));
const foe=guardBattle.addUnit({id:'enemy',team:'enemy',x:150,z:280});
const g=army.create({hero:guardHero,allies:[guardHero,...near],enemies:[foe],
 farms:gold.FARMS});
g.updateAllies(.05);
let guards=g.snapshot().guards;
assert.equal(guards.length,6,'Only six nearest soldiers should magnetize');
assert.equal(g.snapshot().autonomousBlue,2,'Free soldiers must remain autonomous');
assert.equal(new Set(guards.map(x=>x.slot)).size,6,'Slots must be unique');
const lost=guards[0],survivors=new Map(guards.slice(1).map(x=>[x.id,x.slot]));
near.find(u=>u.id===lost.id).alive=false;
g.updateAllies(.05);
guards=g.snapshot().guards;
for(const x of guards)if(survivors.has(x.id))
 assert.equal(x.slot,survivors.get(x.id),'Casualty must not shuffle living guards');
assert.equal(guards.length,6,'Nearest free soldier must fill open guard slot');
foe.x=152;foe.z=52;
g.updateAllies(.05);
assert.equal(g.snapshot().mode,'semicircle','Combat formation must change to arc');
foe.alive=false;
g.updateAllies(.05);
assert.equal(g.snapshot().mode,'turtle','Return to calm turtle after fighting');
// Independent enemy objective selection: no global hero-chasing until contact.
const redBattle=createBattle({random:()=>.99});
const redHero=redBattle.addUnit({id:'h',team:'ally',x:150,z:27});
const redUnit=redBattle.addUnit({id:'r',team:'enemy',x:149,z:275});
const randomArmy=army.create({hero:redHero,allies:[redHero],
 enemies:[redUnit],farms:gold.FARMS});
const before={x:redUnit.x,z:redUnit.z};
for(let i=0;i<100;i++)randomArmy.updateEnemies(.05);
assert(Math.hypot(redUnit.x-before.x,redUnit.z-before.z)>25,
 'Wehrmacht must independently walk toward a strategic objective');
assert(randomArmy.snapshot().goals.r,
 'Enemy must have an objective instead of camping until the hero approaches');
// Squad-controller no-regression: existing test callers omit driveEnemies.
const original=makeController({battle,allies,enemies,driveAllies:()=>new Set()});
assert(original.start().ok);
original.update(.01);
console.log('BATTLEFIELD_FIRST_GAME_PARITY_STATIC_OK',{
 heroMove:'direct WASD and joystick',walkSpeed:army.HERO_SPEED,
 escortSlots:6,freeBlueBots:'independent',redAI:'independent farm objectives',
 formation:'turtle/semicircle',reuseOldWeapons:true
});
