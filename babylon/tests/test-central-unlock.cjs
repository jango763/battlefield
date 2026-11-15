'use strict';
const assert=require('node:assert/strict');
const economy=require('../gold-economy-core.js');
const events=[];
const game=economy.create({onEvent:e=>events.push(e)});
const soldier=(id,team,x=150,z=150)=>({id,team,x,z,hp:100,alive:true,isHero:false});
const bot=soldier('bot-blue','blue');
const german=soldier('bot-red','red',70,95);
const hero={id:'hero',team:'blue',x:150,z:150,isHero:true,hp:100,alive:true};
function step(seconds,units=[hero]){
 for(let i=0;i<seconds*4;i++)game.update(.25,units);
}
assert.equal(economy.CENTRAL_DELAY_SECONDS,300);
assert.equal(game.summary().central.open,false);
assert.equal(game.summary().central.started,false);
assert.equal(game.summary().central.remainingSeconds,null);
// Centre does not capture even if a team stands there for minutes.
step(301,[hero,bot]);
assert.equal(game.summary().farms.find(p=>p.id==='center').owner,null);
assert.equal(game.summary().central.started,false);
// Normal farm is available from match start, independently of central point.
step(6,[german]);
assert.equal(game.summary().farms.find(p=>p.id==='south-west').owner,'red');
assert.equal(game.summary().central.started,false);
// Hero death does not count as the first bot kill.
hero.alive=false;hero.hp=0;
assert.equal(game.reportBotDeath(hero),false);
assert.equal(game.summary().central.started,false);
// First non-hero casualty, whichever team, starts exactly once.
bot.alive=false;bot.hp=0;
assert.equal(game.reportBotDeath(bot),true);
assert.equal(game.summary().central.firstBotId,'bot-blue');
assert.equal(game.reportBotDeath(bot),false);
const redBot=soldier('another-red','red');
redBot.alive=false;redBot.hp=0;
assert.equal(game.reportBotDeath(redBot),false);
assert.equal(events.filter(e=>e.type==='central-countdown-start').length,1);
// The capture ring stays locked while the timer counts down.
step(299,[soldier('standing-blue','blue')]);
assert.equal(game.summary().central.open,false);
assert(Math.abs(game.summary().central.remainingSeconds-1)<1e-8);
assert.equal(game.summary().farms.find(p=>p.id==='center').owner,null);
// Pausing is achieved by NOT calling update; countdown is based on gameplay dt.
const before=game.summary().central.remainingSeconds;
assert.equal(game.summary().central.remainingSeconds,before);
// Exactly one more second unlocks, but it does not instantly grant gold.
step(1,[soldier('standing-blue','blue')]);
assert.equal(game.summary().central.open,true);
assert.equal(game.summary().central.remainingSeconds,0);
assert.equal(game.summary().farms.find(p=>p.id==='center').owner,null);
assert.equal(events.filter(e=>e.type==='central-open').length,1);
assert.equal(game.summary().periodicGold.blue,0);
// After unlock the usual 5-second uncontested capture is required.
step(5,[soldier('standing-blue','blue')]);
assert.equal(game.summary().farms.find(p=>p.id==='center').owner,'blue');
assert.equal(events.filter(e=>e.type==='capture'&&e.farm==='center').length,1);
const prior=game.treasury.blue;
step(5,[soldier('standing-blue','blue')]);
assert.equal(game.treasury.blue-prior,125);
assert.equal(game.summary().periodicGold.blue,125);
// A live German can capture the same opened point after 5 seconds.
step(5,[soldier('occupying-red','red')]);
assert.equal(game.summary().farms.find(p=>p.id==='center').owner,'red');
assert.equal(game.summary().central.open,true);
assert.equal(events.filter(e=>e.type==='central-open').length,1);
// Bot first death from German side also starts the timer in a fresh match.
const game2=economy.create();
const victim=soldier('first-red','red');
victim.alive=false;victim.hp=0;
assert.equal(game2.reportBotDeath(victim),true);
assert.equal(game2.summary().central.started,true);
assert.equal(game2.summary().central.firstBotId,'first-red');
assert.equal(game2.summary().central.remainingSeconds,300);
console.log('BATTLEFIELD_CENTRAL_UNLOCK_AFTER_FIRST_BOT_DEATH_TESTS_PASS');
