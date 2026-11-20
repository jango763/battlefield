'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sources=require('../character-sources.js');
const loader=require('../allied-asset-loader.js');
const root=path.resolve(__dirname,'../..');
function glb(file,minBytes){
 const name=path.join(root,file);
 assert(fs.existsSync(name),'Missing original GLB: '+file);
 const stat=fs.statSync(name);
 assert(stat.size>=minBytes,'Unexpectedly short original GLB: '+file);
 const fd=fs.openSync(name,'r'),header=Buffer.alloc(12);
 try{assert.equal(fs.readSync(fd,header,0,12,0),12);}
 finally{fs.closeSync(fd);}
 assert.equal(header.toString('ascii',0,4),'glTF','Not a glTF binary: '+file);
 assert.equal(header.readUInt32LE(4),2,'Unsupported GLB version: '+file);
 assert.equal(header.readUInt32LE(8),stat.size,'Truncated GLB: '+file);
}
const expected=['americanHero',...Array(8).fill('britishJakeli'),
 ...Array(3).fill('britishFab'),...Array(12).fill('approvedGerman')];
assert.deepEqual(expected.map((_,i)=>sources.forSlot(i).id),expected);
assert.throws(()=>sources.forSlot(-1));assert.throws(()=>sources.forSlot(24));
assert(sources.validateTrialFiles(loader.FEATURE_TRIAL_FILES));
assert.throws(()=>sources.validateTrialFiles({americanHero:'german.glb'}));
glb('assets/soldiers/german.glb',3000000);
glb('assets/allied-soldiers/us-hero-quaternius.glb',4000000);
glb('assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb',4000000);
glb('assets/allied-soldiers/uk-jakeli-mobile-static.glb',5000000);
glb('assets/allied-soldiers/uk-jakeli-battle-lod1.glb',5000000);
glb('babylon/animstudio-preview/models/all-combat-run.glb',3000000);
const german=sources.audit(12,null);
assert.equal(german.realModelLoaded,true);
assert.equal(german.releaseApproved,true);
const us=sources.audit(0,{modelId:'americanHero',
 sourceFile:loader.FEATURE_TRIAL_FILES.americanHero,
 nativeClips:true,previewOnly:true});
assert.equal(us.realModelLoaded,true);assert.equal(us.releaseApproved,false);
const jakeli=sources.audit(1,{modelId:'britishJakeli',
 sourceFile:loader.FEATURE_TRIAL_FILES.britishJakeli,
 nativeClips:true,previewOnly:true});
assert.equal(jakeli.realModelLoaded,true);
assert(jakeli.blocker.includes('Skinning'));
assert.equal(sources.audit(9,null).realModelLoaded,false);
assert.throws(()=>sources.audit(1,{modelId:'americanHero',sourceFile:'x'}));
const html=fs.readFileSync(path.join(root,'babylon/index.html'),'utf8');
const game=fs.readFileSync(path.join(root,'babylon/game.js'),'utf8');
assert(html.includes('src="./character-sources.js"'));
assert(html.indexOf('src="./character-sources.js"')<html.indexOf('src="./game.js"'));
assert(game.includes('characters.forSlot(slot).id'));
assert(game.includes('characters.audit(i,externalModel)'));
assert(game.includes('characters.validateTrialFiles(alliedLoader.FEATURE_TRIAL_FILES)'));
assert(game.includes('state.actorSources[i]='));
assert(!game.includes('retarget(B,root,[...source.values()],current.rig,tag);')||loader.FEATURE_TRIAL_FILES.britishJakeli===jakeli.displayGlb?.split('/').at(-1));
console.log('BATTLEFIELD_THREE_ORIGINAL_CHARACTERS_IN_COMMON_BABYLON_SCENE_PASS');
