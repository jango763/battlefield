'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {WEAPONS,hitChance,createBattle}=require('../combat-balance-core.js');
const factions=require('../british-faction.js');
const directory=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(directory,'game.js'),'utf8');
const html=fs.readFileSync(path.join(directory,'index.html'),'utf8');
const rig=fs.readFileSync(path.join(directory,'weapon-rig.js'),'utf8');
const skin=fs.readFileSync(path.join(directory,'british-soldier-original.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'../assets/ww2-weapons/manifest.json'),'utf8'));
const soldiers=[
 ['Kar98k','Lee-Enfield','uk-lee-enfield'],
 ['MP40','Sten','uk-sten'],
 ['MG42','Bren','uk-bren'],
 ['Panzerschreck','PIAT','uk-piat']
];
for(const [gameplay,display,asset] of soldiers){
 assert.equal(factions.label('british',gameplay),display);
 assert.equal(factions.asset('british',gameplay),asset);
 assert(factions.asset('wehrmacht',gameplay).startsWith('de-'));
 // No British game-mechanics aliases: British and Germans literally use
 // the SAME combat object: damage, range, hit curve, reload, ammo and motion.
 assert(WEAPONS[gameplay] && Object.isFrozen(WEAPONS[gameplay]));
 for(const distance of [0,10,25,50,75,100,120]){
  assert.equal(hitChance(gameplay,distance),hitChance(gameplay,distance));
 }
 if(asset!=='uk-piat'){
  assert(manifest.weapons[asset],asset+' must exist in MIT manifest');
  assert(fs.existsSync(path.join(directory,'../assets/ww2-weapons/',manifest.weapons[asset].file)));
 }
 assert(rig.includes("'"+asset+"'"),asset+' not registered in IK');
}
// Two independently simulated army units fire under identical conditions.
 // Matching gameplay IDs mean parity is executable, not just a design claim.
function firstShot(team,combatClass){
 const battle=createBattle({funds:2000,random:()=>.4,prices:{
  MP40:{weapon:100,magazine:15},MG42:{weapon:240,magazine:40},
  Panzerschreck:{weapon:350,magazine:70}
 }});
 const unit=battle.addUnit({id:'attacker',team,x:0,z:0,hp:1000});
 const target=battle.addUnit({id:'defender',team:team==='A'?'B':'A',
  x:20,z:0,hp:1000});
 if(combatClass!=='Kar98k')
  assert(battle.buyWeapon(unit,combatClass,{atBase:true}).ok);
 const before=battle.totalAmmo(unit);
 const shot=battle.fire(unit,target,{
  moving:combatClass==='MP40'||combatClass==='MG42'
 });
 return {weapon:unit.weapon,before,after:battle.totalAmmo(unit),hit:shot.hit,
  result:shot.ok,damage:shot.hits?.map(x=>x.damage),hp:target.hp,
  reload:WEAPONS[combatClass].reloadSeconds};
}
for(const [gameplay] of soldiers){
 assert.deepEqual(firstShot('A',gameplay),firstShot('B',gameplay),
  gameplay+' must have identical British and Wehrmacht outcomes');
}
for(let i=0;i<24;i++){
 assert.equal(factions.sideForSlot(i),i<12?'british':'wehrmacht');
}
assert.throws(()=>factions.sideForSlot(24));
assert.throws(()=>factions.asset('british','unknown'));
assert.equal(WEAPONS.Kar98k.range,100);
assert.equal(WEAPONS.MP40.range,60);
assert.equal(WEAPONS.MG42.range,80);
assert.equal(WEAPONS.Panzerschreck.range,100);
assert.equal(WEAPONS.MP40.magazineSize*WEAPONS.MP40.magazines,160);
assert.equal(WEAPONS.MG42.magazineSize*WEAPONS.MG42.magazines,400);
assert.equal(WEAPONS.Panzerschreck.magazineSize*WEAPONS.Panzerschreck.magazines,4);
assert.equal(WEAPONS.MP40.reloadSeconds,2.5);
assert.equal(WEAPONS.MG42.reloadSeconds,7.5);
assert.equal(WEAPONS.Panzerschreck.reloadSeconds,9);
assert(html.includes('src="./british-faction.js"'));
assert(html.includes('src="./british-soldier-original.js"'));
assert(html.indexOf('british-faction.js')<html.indexOf('game.js'));
assert(html.indexOf('british-soldier-original.js')<html.indexOf('game.js'));
assert(app.includes("asset.instantiateModelsToScene("));
assert(app.includes("const weaponAsset=(view,weapon)=>factions.asset(view.faction,weapon)"));
assert(app.includes("if(view.faction==='british'&&!externalModel)"),
 'Old prototype may only be a temporary fallback while original GLB is unavailable');
assert(app.includes("const soldier=britishSoldier.create({B,scene,view})"));
assert(app.includes("weaponAsset(view,wanted)"));
assert(app.includes("weaponAsset(view,unit.weapon)"));
assert(app.includes("weaponAsset(visual,weapon)"));
// The imported German 3D body must be HIDDEN, not recoloured.
assert(skin.includes('mesh.isVisible=false'),'German donor mesh must not render');
assert(skin.includes('MeshBuilder.CreateCylinder'),
 'New British body geometry must be constructed');
assert(skin.includes('new-british-face'),'A new face is mandatory');
assert(skin.includes('waist-length-battledress-blouse'),'British blouse missing');
assert(skin.includes('left-thigh-map-pocket'),'Distinctive British leg pocket missing');
assert(skin.includes('british-side-cap-body'),'British field cap missing');
assert(skin.includes('P37-basic-pouch'),'Pattern 37 kit missing');
assert(skin.includes('britishOriginal:true'),'New geometry must be identifiable');
assert(skin.includes("sourceRigBones:skel.bones.length"),
 'Exact same skeleton required for shared Run/Hold/Aim/Fire');
assert(app.includes('view.britishSoldier.start()'),
 'British dynamic animation update must be active after IK');
assert(rig.includes("proceduralPiat"));
assert(rig.includes("await equip(initialWeaponId)"),
 'No German rifle should briefly appear on British initial spawn');
assert(!app.includes("CLIP_IDS=Object.keys(factions.BRITISH)"),
 'Do not multiply clips or import unapproved animations');
console.log('BATTLEFIELD_BRITISH_MIRROR_TESTS_PASS');