"use strict";
const assert=require("node:assert/strict");
const sten=require("../british-stage6-sten.js");
const balance=require("../combat-balance-core.js");
const bridge=require("../us-hero-stage9-combat-bridge.js");
const pipeline=require("../british-army-pipeline.js");
assert.equal(pipeline.STAGES[5],"sten");
assert.equal(sten.SOURCE_ID,"MP40");
assert.equal(balance.WEAPONS.MP40.magazineSize,32);
assert.equal(balance.WEAPONS.MP40.magazines,5);
assert.equal(balance.WEAPONS.MP40.reloadSeconds,2.5);
assert.equal(balance.WEAPONS.MP40.canFireMoving,true);
const state={id:"uk-lee-enfield",swaps:[],overlays:[],flashes:[],vis:0};
const stance={
 status:()=>({weaponId:state.id,
  report:{weaponSource:"GLB · Muster WW2"},
  mounted:{attached:true,parent:"mixamorig:Weapon_R",mountCount:1},
  quality:{ok:true,rightGripMeters:0,leftGripMeters:0},
  aim:{barrelDot:1},pose:"aim"}),
 async equipWeapon(id){state.id=id;state.swaps.push(id);return this.status();},
 getMuzzleWorld:()=>({weaponId:state.id,position:[0,1,-.3],direction:[0,0,-1]}),
 setCombatOverlay:o=>state.overlays.push(o),
 targetAt:t=>({aim:{barrelDot:1},quality:{ok:true},target:t}),
 sync:()=>({aim:{barrelDot:1},quality:{ok:true}})
};
let disposals=0;
const vfx={create:()=>({
 shoot:id=>state.flashes.push(id),tick(){},reset(){},
 status:()=>({shots:state.flashes.length}),dispose(){disposals++}
})};
const visuals={create:({bridge:b})=>({
 reactShot:r=>{assert.equal(r.ok,true);state.vis++;},
 setSelected(){return true},tick(){},reset(){b.reset()},
 dispose(){disposals++},status:()=>({shots:state.vis})
})};
(async()=>{
 const c=await sten.create({scene:{skeletons:[{}]},stance,balance,bridge,visuals,vfx,
  random:()=>.99,controlOnly:true});
 const initial=c.status();
 assert.equal(state.swaps[0],"uk-sten");
 assert.equal(initial.controlOnly,true);
 assert.equal(initial.readyForBritishDeployment,false);
 assert.equal(initial.magazine,32);
 assert.equal(initial.reserve,128);
 assert.equal(initial.fullStenAmmo,160);
 assert.equal(initial.magazineCount,5);
 assert.equal(initial.canFireMoving,true);
 const fired=c.fire({moving:true});
 assert.equal(fired.ok,true);
 assert.equal(fired.sourceWeapon,"MP40");
 assert.equal(c.status().magazine,31);
 assert.equal(c.status().reserve,128);
 assert.equal(c.status().shots,1);
 assert.equal(state.flashes[0],"uk-sten");
 assert(c.status().recoil>.9);
 const cooldown=c.fire({moving:true});
 assert.equal(cooldown.reason,"cooldown");
 assert.equal(c.status().magazine,31);
 const reload=c.reload();
 assert.equal(reload.ok,true);
 assert.equal(reload.seconds,2.5);
 assert.equal(c.status().reloading,true);
 assert.equal(c.fire({moving:true}).reason,"reloading");
 for(let i=0;i<26;i++)c.tick(.10);
 assert.equal(c.status().reloading,false);
 assert.equal(c.status().magazine,32);
 assert.equal(c.status().reserve,127);
 assert.equal(state.overlays.at(-1).reloadActive,false);
 assert(c.selectTarget("enemy-a").ok);
 assert.equal(c.status().targetId,"enemy-a");
 // Consume all 159 remaining rounds with real battle shot timing and reloads.
 let accepted=1,guard=0,autoReloads=0;
 while(!c.status().fallback&&guard++<1000){
  const current=c.status();
  if(current.reloading){
   autoReloads++;
   for(let i=0;i<26;i++)c.tick(.10);
   continue;
  }
  if(current.cooldownRemaining>0){c.tick(.10);c.tick(.02);continue;}
  const r=c.fire({moving:true});
  if(r.ok)accepted++;
  else assert(["cooldown","magazine-empty","switching-to-rifle"].includes(r.reason),
   JSON.stringify(r));
  c.tick(.1);c.tick(.02);
  if(c.status().switching)await c.awaitFallback();
 }
 assert(guard<1000,"Sten failed to consume its 5×32 rounds");
 assert.equal(accepted,160);
 assert(autoReloads>=3);
 assert.equal(c.status().fullStenAmmo,0);
 assert.equal(c.status().fallback,true);
 assert.equal(c.status().weapon,"uk-lee-enfield");
 assert.equal(state.id,"uk-lee-enfield");
 assert.equal(c.status().canFireMoving,false);
 assert.equal(c.fire({moving:true}).reason,"stop-to-fire");
 const reset=await c.reset();
 assert.equal(reset.magazine,32);
 assert.equal(reset.reserve,128);
 assert.equal(reset.shots,0);
 assert.equal(reset.fullStenAmmo,160);
 assert.equal(reset.weapon,"uk-sten");
 assert.equal(reset.targets.filter(t=>t.alive).length,3);
 assert.equal(reset.mounted.parent,"mixamorig:Weapon_R");
 c.dispose();
 assert.equal(disposals,2);
 assert.throws(()=>c.fire(),/disposed/);
 console.log("BRITISH_STAGE6_STEN_CONTRACT_PASS",JSON.stringify({
  realBalance:true,shots:accepted,initialMagazine:32,initialReserve:128,
  autoReloads,reloadSeconds:2.5,movingFire:true,rifleFallback:true,
  reset:true,weaponSocket:"mixamorig:Weapon_R"
 }));
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
