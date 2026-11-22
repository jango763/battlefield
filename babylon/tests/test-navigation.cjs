const assert=require('node:assert/strict');
const {create}=require('../navigation-core');
const n=create({obstacles:[{x:15,z:15,hw:5,hd:5},{x:28,z:15,hw:.05,hd:10}],size:50});
assert(!n.lineOfSight({x:5,z:15},{x:25,z:15}));
const u={x:5,z:15},goal={x:24,z:15};
for(let i=0;i<500;i++){n.follow(u,goal,9,.05);assert(n.free(u),'Actor penetrated obstacle');}
assert(Math.hypot(u.x-goal.x,u.z-goal.z)<.4,'A* must navigate around building');
n.slide(u,100,0);assert(u.x<27.54,'Swept collision must stop a high-speed move at thin wall');
assert(n.free(n.nearestFree({x:15,z:15})),'Blocked destination projected to reachable ground');
const concave=create({size:50,obstacles:[{x:20,z:15,hw:1,hd:8},{x:30,z:15,hw:1,hd:8},{x:25,z:23,hw:6,hd:1}]});
const bot={x:25,z:18};for(let i=0;i<1000;i++){concave.follow(bot,{x:25,z:30},9,.05);assert(concave.free(bot));}
assert(Math.hypot(bot.x-25,bot.z-30)<.4,'Escape U-shaped obstruction without oscillation');
const {create:army}=require('../first-game-army-core');const hero={id:'hero',x:5,z:15,alive:true};
const orders=army({hero,allies:[hero],enemies:[],farms:[{id:'f',x:40,z:40}],navigation:n});
orders.setMovement(1,0);for(let i=0;i<100;i++)orders.updateAllies(.1);
assert(hero.x<9.59&&n.free(hero),'Direct controls stop at wall');
orders.setDestination(24,15);for(let i=0;i<700;i++)orders.updateAllies(.05);
assert(Math.hypot(hero.x-24,hero.z-15)<.4,'Tap order navigates around wall');
console.log('NAVIGATION_PASS',n.stats);
