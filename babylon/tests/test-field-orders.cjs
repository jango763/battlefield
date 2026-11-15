'use strict';
const assert=require('node:assert/strict');
const {create:makeOrders}=require('../field-orders-core.js');
const {create:makeTactics}=require('../squad-combat-core.js');
const balance=require('../combat-balance-core.js');

function build({distance=90,random=()=>.99}={}){
 const battle=balance.createBattle({random});
 const allies=[
  battle.addUnit({id:'hero',team:'ally',x:0,z:0}),
  battle.addUnit({id:'guard-1',team:'ally',x:-20,z:-10}),
  battle.addUnit({id:'guard-2',team:'ally',x:-18,z:0}),
  battle.addUnit({id:'guard-3',team:'ally',x:-20,z:10})
 ];
 const enemies=[battle.addUnit({id:'enemy',team:'enemy',x:distance,z:0,hp:100000})];
 const orders=makeOrders({hero:allies[0],allies,enemies});
 return {battle,allies,enemies,orders};
}
{
 const {allies,orders}=build();
 const hero=allies[0];
 assert.equal(orders.snapshot().mode,'turtle');
 assert.equal(orders.setDestination(Infinity,0).ok,false);
 assert.equal(orders.setDestination(22,0).ok,true);
 let heroMoved=false,escortMoved=false;
 for(let i=0;i<120;i++){
  const moved=orders.update(1/60);
  if(moved.has(hero))heroMoved=true;
  if(moved.has(allies[1]))escortMoved=true;
 }
 assert(heroMoved&&escortMoved,'Hero or magnet escorts stood still');
 assert(hero.x>21.5&&hero.x<=22.1,'Hero did not reach ordered destination');
 assert.equal(orders.snapshot().destination,null);
 assert.equal(orders.snapshot().arrivalCount,1);
 assert.equal(orders.snapshot().aliveGuards,3);
 assert(orders.snapshot().heading.x>0);
}
{
 const {allies,enemies,orders}=build({distance:20});
 orders.update(1/60);
 assert.equal(orders.snapshot().mode,'semicircle');
 assert.equal(orders.snapshot().focus,enemies[0].id);
 allies[2].alive=false;
 for(let i=0;i<60;i++)orders.update(1/60);
 assert.equal(orders.snapshot().aliveGuards,2);
 assert.equal(orders.snapshot().mode,'semicircle');
 enemies[0].alive=false;
 orders.update(1/60);
 assert.equal(orders.snapshot().mode,'turtle');
}
{
 const {battle,allies,enemies,orders}=build({distance:100});
 const shots=[];
 const controller=makeTactics({battle,allies,enemies,
  driveAllies:dt=>orders.update(dt),onShot:shot=>shots.push(shot)});
 assert(controller.start().ok);
 assert(orders.setDestination(30,0).ok);
 let heroMoved=false;
 for(let i=0;i<70;i++){
  const before=allies[0].x;
  controller.update(1/60);
  if(allies[0].x>before)heroMoved=true;
 }
 assert(heroMoved,'Hero not controlled by tap-to-move orders');
 assert(controller.isMoving(allies[0]));
 assert.equal(allies[0].shots,0,'Rifle cannot fire during active running');
 controller.stop();
 const atPause=allies[0].x;
 controller.update(1/60);
 assert.equal(allies[0].x,atPause,'Paused battle moved hero');
 assert(shots.every(s=>s.result.ok),'Unsuccessful shots leaked to visual events');
}
{
 const {battle,allies,enemies}=build();
 const controller=makeTactics({battle,allies,enemies,
  driveAllies:()=>new Set([enemies[0]])});
 controller.start();
 assert.throws(()=>controller.update(1/60),/non-allied/);
}
console.log('BATTLEFIELD_MAIN_HERO_MAGNET_AND_FORMATION_TESTS_PASS');