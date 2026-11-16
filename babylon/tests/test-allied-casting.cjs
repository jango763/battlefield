'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const roster=require('../allied-model-catalog.js');
const game=fs.readFileSync(path.resolve(__dirname,'../game.js'),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
const preview=fs.readFileSync(path.resolve(__dirname,'../allied-model-review.html'),'utf8');
assert.equal(roster.IDS.length,4);
assert.equal(roster.BLUE_SLOTS.length,12);
assert.equal(roster.forBlueSlot(0).id,'americanHero');
assert.equal(roster.forBlueSlot(0).nationality,'american');
assert.equal(roster.forBlueSlot(0).role,'hero');
const uk=roster.roster().slice(1);
assert.equal(uk.length,11);
assert(uk.every(x=>roster.byId(x.characterId).nationality==='british'));
for(const role of ['britishDanoob','britishJakeli','britishFab'])
 assert(uk.some(x=>x.characterId===role),'Missing British variant '+role);
assert.equal(new Set(uk.map(x=>x.characterId)).size,3);
for(const m of Object.values(roster.MODELS)){
 assert(m.source.startsWith('https://'),'Missing author link');
 assert(m.expectedGlb.startsWith('../assets/allied-soldiers/'));
 assert.equal(m.ready,false,'Cannot claim unacquired external asset is ready');
}
assert.equal(roster.MODELS.americanHero.licenseVerified,true);
assert.equal(roster.MODELS.britishFab.licenseVerified,false);
assert.throws(()=>roster.forBlueSlot(12));
assert(game.includes('u.characterModel=alliedModels.forBlueSlot(i).id'));
assert(game.includes('u.characterModelImported=!!views[i]?.importedAlliedModel'));
assert(game.includes("view.faction==='british'"));
assert(html.includes('src="./allied-model-catalog.js"'));
assert(html.indexOf('src="./allied-model-catalog.js"')<html.indexOf('src="./game.js"'));
assert(html.includes('allied-model-review.html'));
assert(preview.includes('https://sketchfab.com/models/'));
assert(preview.includes("show('americanHero')"));
assert(preview.includes('Открыть оригинал у автора'));
const loader=require('../allied-asset-loader.js');
const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,
 '../../assets/allied-soldiers/manifest.json'),'utf8'));
assert(loader.validateManifest(manifest,roster));
assert.deepEqual(loader.CLIPS.length,16);
assert.equal(Object.values(manifest.models).filter(r=>r.installed).length,0,
 'Never report external GLBs installed before they exist');
assert(game.includes('modelDepot.instantiate(casting.id,i)'),
 'Real selected character must flow into game scene');
assert(game.includes('unitVisual(i,entries,{externalModel})'),
 'Source model must drive actual soldier meshes');
assert(html.includes('src="./allied-asset-loader.js"'));
const lab=fs.readFileSync(path.resolve(__dirname,'../allied-ik-lab.html'),'utf8');
assert(lab.includes('type="file"'),'GLB browser upload lab missing');
assert(lab.includes('loader.gripAssessment'),'Live arm/grip QA missing');
assert(lab.includes('loader.retarget'),'No Babylon animation retarget workflow');
console.log('ALLIED_4_CASTING_BLUE_TEAM_12_SLOT_PASS');
