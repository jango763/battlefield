"use strict";
const assert=require("node:assert/strict");
const rifle=require("../british-stage5-lee-enfield.js");
const balance=require("../combat-balance-core.js");
const bridge=require("../us-hero-stage9-combat-bridge.js");
const pipeline=require("../british-army-pipeline.js");
assert.equal(pipeline.STAGES[4],"lee-enfield");
assert.equal(rifle.SOURCE_ID,"Kar98k");
assert.equal(rifle.WEAPON_ID,"uk-lee-enfield");
assert.equal(balance.WEAPONS.Kar98k.magazineSize,Infinity);
assert.equal(balance.WEAPONS.Kar98k.canFireMoving,false);
assert.equal(balance.WEAPONS.Kar98k.interval,2.1);
let overlays=[],shots=0,visualShots=0,disposals=0,resets=0;
const stance={
 status:()=>({weaponId:"uk-lee-enfield",
  mounted:{attached:true,parent:"mixamorig:Weapon_R",mountCount:1},
  quality:{ok:true,rightGripMeters:0,leftGripMeters:0},
  aim:{barrelDot:1},pose:"aim"}),
 getMuzzleWorld:()=>({weaponId:"uk-lee-enfield",position:[0,1,-.5],direction:[0,0,-1]}),
 setCombatOverlay:o=>{overlays.push(o);},
 targetAt:t=>({aim:{barrelDot:1},quality:{ok:true},target:t}),
 sync:()=>({aim:{barrelDot:1},quality:{ok:true}})
};
const vfx={create:()=>({
 shoot:id=>{assert.equal(id,"uk-lee-enfield");shots++;},
 tick(){},status:()=>({shots,flashVisible:shots>0}),
 reset(){resets++;},dispose(){disposals++}
})};
const visuals={create:({bridge:b})=>({
 reactShot:r=>{assert.equal(r.ok,true);visualShots++;},
 setSelected(){return true},tick(){},reset(){b.reset();resets++;},
 dispose(){disposals++},
 status:()=>({shots:visualShots,visibleTracer:visualShots>0})
})};
const scene={skeletons:[{}]};
const c=rifle.create({scene,stance,balance,bridge,visuals,vfx,random:()=>.1,controlOnly:true});
let s=c.status();
assert.equal(s.controlOnly,true);
assert.equal(s.readyForBritishDeployment,false);
assert.equal(s.infiniteAmmo,true);
assert.equal(s.interval,2.1);
assert.equal(s.canFireMoving,false);
assert.equal(s.shots,0);
const move=c.fire({moving:true});
assert.equal(move.ok,false);
assert.equal(move.reason,"stop-to-fire");
assert.equal(shots,0);
const fired=c.fire({moving:false});
assert.equal(fired.ok,true);
assert.equal(c.status().shots,1);
assert.equal(c.status().last.targetId,"enemy-b");
assert.equal(shots,1);
assert.equal(visualShots,1);
assert(c.status().cooldownRemaining>2);
assert.equal(c.status().infiniteAmmo,true);
assert.equal(c.status().mounted.parent,"mixamorig:Weapon_R");
assert.equal(c.status().recoil,1);
const blocked=c.fire();
assert.equal(blocked.ok,false);
assert.equal(blocked.reason,"cooldown");
assert.equal(shots,1);
c.tick(.05);
assert(overlays.at(-1).recoil>0&&overlays.at(-1).recoil<1);
assert.equal(overlays.at(-1).reloadActive,false);
for(let i=0;i<25;i++)c.tick(.1);
assert.equal(c.status().cooldownRemaining,0);
const turn=c.selectTarget("enemy-a");
assert.equal(turn.ok,true);
const next=c.fire();
assert.equal(next.ok,true);
assert.equal(next.targetId,"enemy-a");
assert.equal(c.status().shots,2);
const reset=c.reset();
assert.equal(reset.shots,0);
assert.equal(reset.targetId,"enemy-b");
assert(reset.targets.every(t=>t.alive&&t.hp===100));
assert.equal(reset.infiniteAmmo,true);
assert(resets>=2);
c.dispose();
assert.equal(disposals,2);
assert.throws(()=>c.fire(),/disposed/);
assert.throws(()=>rifle.create({scene,stance:{...stance,
 status:()=>({weaponId:"uk-sten"})},balance,bridge,visuals,vfx}),
 /Lee-Enfield/);
console.log("BRITISH_STAGE5_LEE_ENFIELD_CONTRACT_PASS",JSON.stringify({
 source:"BattlefieldBalance",cooldown:balance.WEAPONS.Kar98k.interval,
 movingBlocked:true,acceptedShots:2,infiniteAmmo:true,
 twoHandWeaponMount:"mixamorig:Weapon_R",reset:true,visualEvents:visualShots
}));
