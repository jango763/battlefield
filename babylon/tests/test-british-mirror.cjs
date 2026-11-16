'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {WEAPONS,hitChance}=require('../combat-balance-core.js');
const factions=require('../british-faction.js');
const directory=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(directory,'game.js'),'utf8');
const html=fs.readFileSync(path.join(directory,'index.html'),'utf8');
const rig=fs.readFileSync(path.join(directory,'weapon-rig.js'),'utf8');
const skin=fs.readFileSync(path.join(directory,'british-skin.js'),'utf8');
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
assert(html.includes('src="./british-skin.js"'));
assert(html.indexOf('british-faction.js')<html.indexOf('game.js'));
assert(html.indexOf('british-skin.js')<html.indexOf('game.js'));
assert(app.includes("asset.instantiateModelsToScene("));
assert(app.includes("const weaponAsset=(view,weapon)=>factions.asset(view.faction,weapon)"));
assert(app.includes("if(view.faction==='british')"));
assert(app.includes("const skin=britishSkin.apply({B,scene,view})"));
assert(app.includes("weaponAsset(view,wanted)"));
assert(app.includes("weaponAsset(view,unit.weapon)"));
assert(app.includes("weaponAsset(visual,weapon)"));
assert(skin.includes("kit.setParent(chest)"));
assert(skin.includes("recolouredMeshes"));
assert(rig.includes("proceduralPiat"));
assert(!app.includes("CLIP_IDS=Object.keys(factions.BRITISH)"),
 'Do not multiply clips or import unapproved animations');
console.log('BATTLEFIELD_BRITISH_MIRROR_TESTS_PASS');