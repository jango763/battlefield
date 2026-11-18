"use strict";
const assert=require("node:assert/strict");
const bren=require("../british-stage7-bren.js");
const balance=require("../combat-balance-core.js");
const bridge=require("../us-hero-stage9-combat-bridge.js");
const pipeline=require("../british-army-pipeline.js");
assert.equal(pipeline.STAGES[6],"bren");
assert.equal(bren.SOURCE_ID,"MG42");
assert.equal(balance.WEAPONS.MG42.magazineSize,100);
assert.equal(balance.WEAPONS.MG42.magazines,4);
assert.equal(balance.WEAPONS.MG42.reloadSeconds,7.5);
assert.equal(balance.WEAPONS.MG42.canFireMoving,true);
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
 const c=await bren.create({scene:{skeletons:[{}]},stance,balance,bridge,visuals,vfx,
  random:()=>.99,controlOnly:true});
 const initial=c.status();
 assert.equal(state.swaps[0],"uk-bren");
 assert.equal(initial.controlOnly,true);
 assert.equal(initial.readyForBritishDeployment,false);
 assert.equal(initial.magazine,100);
 assert.equal(initial.reserve,300);
 assert.equal(initial.fullBrenAmmo,400);
 assert.equal(initial.magazineCount,4);
 assert.equal(initial.canFireMoving,true);
 const fired=c.fire({moving:true});
 assert.equal(fired.ok,true);
 assert.equal(fired.sourceWeapon,"MG42");
 assert.equal(c.status().magazine,99);
 assert.equal(c.status().reserve,300);
 assert.equal(c.status().shots,1);
 assert.equal(state.flashes[0],"uk-bren");
 assert(c.status().recoil>.9);
 const cooldown=c.fire({moving:true});
 assert.equal(cooldown.reason,"cooldown");
 assert.equal(c.status().magazine,99);
 const reload=c.reload();
 assert.equal(reload.ok,true);
 assert.equal(reload.seconds,7.5);
 assert.equal(c.status().reloading,true);
 assert.equal(c.fire({moving:true}).reason,"reloading");
 for(let i=0;i<76;i++)c.tick(.10);
 assert.equal(c.status().reloading,false);
 assert.equal(c.status().magazine,100);
 assert.equal(c.status().reserve,299);
 assert.equal(state.overlays.at(-1).reloadActive,false);
 assert(c.selectTarget("enemy-a").ok);
 assert.equal(c.status().targetId,"enemy-a");
 // Consume all 399 remaining rounds with real battle shot timing and reloads.
 let accepted=1,guard=0,autoReloads=0;
 while(!c.status().fallback&&guard++<2500){
  const current=c.status();
  if(current.reloading){
   autoReloads++;
   for(let i=0;i<76;i++)c.tick(.10);
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
 assert(guard<2500,"Bren failed to consume its 4×100 rounds");
 assert.equal(accepted,400);
 assert(autoReloads>=3);
 assert.equal(c.status().fullBrenAmmo,0);
 assert.equal(c.status().fallback,true);
 assert.equal(c.status().weapon,"uk-lee-enfield");
 assert.equal(state.id,"uk-lee-enfield");
 assert.equal(c.status().canFireMoving,false);
 assert.equal(c.fire({moving:true}).reason,"stop-to-fire");
 const reset=await c.reset();
 assert.equal(reset.magazine,100);
 assert.equal(reset.reserve,300);
 assert.equal(reset.shots,0);
 assert.equal(reset.fullBrenAmmo,400);
 assert.equal(reset.weapon,"uk-bren");
 assert.equal(reset.targets.filter(t=>t.alive).length,3);
 assert.equal(reset.mounted.parent,"mixamorig:Weapon_R");
 c.dispose();
 assert.equal(disposals,2);
 assert.throws(()=>c.fire(),/disposed/);
 console.log("BRITISH_STAGE7_BREN_CONTRACT_PASS",JSON.stringify({
  realBalance:true,shots:accepted,initialMagazine:100,initialReserve:300,
  autoReloads,reloadSeconds:7.5,movingFire:true,rifleFallback:true,
  reset:true,weaponSocket:"mixamorig:Weapon_R"
 }));
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
