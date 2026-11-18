"use strict";
const assert=require("node:assert/strict");
const piat=require("../british-stage8-piat.js");
const balance=require("../combat-balance-core.js");
const bridge=require("../us-hero-stage9-combat-bridge.js");
const stages=require("../british-army-pipeline.js");
assert.equal(stages.STAGES[7],"piat");
assert.equal(piat.WEAPON_ID,"uk-piat");
assert.equal(piat.SOURCE_ID,"Panzerschreck");
const approved=balance.WEAPONS.Panzerschreck;
assert.equal(approved.magazineSize,1);
assert.equal(approved.magazines,4);
assert.equal(approved.reloadSeconds,9);
assert.equal(approved.blastRadius,5);
assert.equal(approved.canFireMoving,false);
const state={id:"uk-lee-enfield",swaps:[],overlays:[],effects:[],hits:0,blasts:0,disposed:0,fxreset:0};
const stance={
 status:()=>({weaponId:state.id,
  report:{weaponSource:state.id==="uk-piat"?"Procedural · original Battlefield":"GLB · Muster WW2"},
  mounted:{attached:true,parent:"mixamorig:Weapon_R",mountCount:state.swaps.length+1},
  quality:{ok:true,rightGripMeters:0,leftGripMeters:0},
  aim:{barrelDot:1},pose:"aim"}),
 async equipWeapon(id){state.id=id;state.swaps.push(id);return this.status();},
 getMuzzleWorld:()=>({weaponId:state.id,position:[0,1,-.4],direction:[0,0,-1]}),
 setCombatOverlay:o=>state.overlays.push(o),
 targetAt:t=>({aim:{barrelDot:1},quality:{ok:true},target:t}),
 sync:()=>({aim:{barrelDot:1},quality:{ok:true}})
};
const vfx={create:()=>({
 shoot:id=>{state.effects.push(id);if(id==="uk-piat")state.blasts++;},
 tick(){},reset(){state.fxreset++},
 status:()=>({shots:state.effects.length,missiles:state.blasts}),
 dispose(){state.disposed++}
})};
const visuals={create:({bridge:b})=>({
 reactShot:r=>{assert(r.ok);assert(r.impact);state.hits+=r.hits.length},
 setSelected:()=>true,tick(){},reset(){b.reset()},
 dispose(){state.disposed++},status:()=>({damageEvents:state.hits})
})};
const targets=piat.TARGETS.map(t=>({...t,hp:1000}));
(async()=>{
 const c=await piat.create({scene:{skeletons:[{}]},stance,balance,bridge,visuals,vfx,
  random:()=>.1,controlOnly:true,targets});
 let st=c.status();
 assert.equal(st.controlOnly,true);
 assert.equal(st.readyForBritishDeployment,false);
 assert.equal(st.proceduralPiatModel,true);
 assert.equal(st.magazine,1);
 assert.equal(st.reserve,3);
 assert.equal(st.fullPiatAmmo,4);
 assert.equal(st.reloadSeconds,9);
 assert.equal(st.blastRadius,5);
 assert.equal(st.canFireMoving,false);
 assert.equal(st.mounted.parent,"mixamorig:Weapon_R");
 const moving=c.fire({moving:true});
 assert.equal(moving.ok,false);
 assert.equal(moving.reason,"stop-to-fire");
 assert.equal(c.status().fullPiatAmmo,4);
 assert.equal(state.effects.length,0);
 const first=c.fire({moving:false});
 assert.equal(first.ok,true);
 assert.equal(first.sourceWeapon,"Panzerschreck");
 assert.equal(first.weaponId,"uk-piat");
 assert(first.impact&&Number.isFinite(first.impact.x));
 assert(first.hits.length>=1);
 assert.equal(c.status().shots,1);
 assert.equal(c.status().magazine,0);
 assert.equal(c.status().reserve,3);
 assert.equal(c.status().reloading,true);
 assert(c.status().reloadRemaining>8.9);
 assert.equal(c.status().friendlyHp,100);
 assert.equal(state.effects.length,1);
 assert.equal(state.blasts,1);
 assert.equal(c.fire({moving:false}).reason,"reloading");
 assert.equal(c.status().shots,1);
 const reload=c.reload();
 assert.equal(reload.ok,false);
 assert.equal(reload.reason,"already-reloading");
 c.tick(.5);
 assert.equal(state.overlays.at(-1).reloadActive,true);
 assert(state.overlays.at(-1).reloadPhase>0);
 for(let i=0;i<86;i++)c.tick(.1);
 st=c.status();
 assert.equal(st.reloading,false);
 assert.equal(st.magazine,1);
 assert.equal(st.reserve,2);
 assert.equal(st.fullPiatAmmo,3);
 assert.equal(state.overlays.at(-1).reloadActive,false);
 assert(c.selectTarget("enemy-a").ok);
 assert.equal(c.status().targetId,"enemy-a");
 for(let n=2;n<=4;n++){
  const result=c.fire({moving:false});
  assert.equal(result.ok,true);
  assert(result.impact);
  assert.equal(c.status().shots,n);
  assert.equal(c.status().fullPiatAmmo,4-n);
  assert.equal(c.status().friendlyHp,100,"Friendly-fire protection must remain");
  if(n<4){
   assert.equal(c.status().reloading,true);
   for(let i=0;i<91;i++)c.tick(.1);
   assert.equal(c.status().reloading,false);
  }else await c.awaitFallback();
 }
 assert.equal(c.status().fullPiatAmmo,0);
 assert.equal(c.status().fallback,true);
 assert.equal(c.status().weapon,"uk-lee-enfield");
 assert.equal(state.id,"uk-lee-enfield");
 assert.equal(c.status().canFireMoving,false);
 assert.equal(c.fire({moving:true}).reason,"stop-to-fire");
 assert.equal(state.blasts,4);
 const reset=await c.reset();
 assert.equal(reset.magazine,1);
 assert.equal(reset.reserve,3);
 assert.equal(reset.fullPiatAmmo,4);
 assert.equal(reset.shots,0);
 assert.equal(reset.weapon,"uk-piat");
 assert.equal(reset.targets.filter(t=>t.alive).length,3);
 assert.equal(reset.friendlyHp,100);
 assert.equal(reset.mounted.parent,"mixamorig:Weapon_R");
 c.dispose();
 assert.equal(state.disposed,2);
 assert.throws(()=>c.fire(),/disposed/);
 console.log("BRITISH_STAGE8_PIAT_CONTRACT_PASS",JSON.stringify({
  acceptedShots:4,autoReloads:3,reloadSeconds:9,
  launcherAmmo:4,blastRadius:5,damage:120,movingBlocked:true,
  AoE:true,friendlyFireDisabled:true,rifleFallback:true,reset:true,
  approvedModel:"Procedural original Battlefield",mount:"mixamorig:Weapon_R"
 }));
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
