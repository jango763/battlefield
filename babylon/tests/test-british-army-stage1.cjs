"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const pipeline=require("../british-army-pipeline.js");
const catalog=require("../allied-model-catalog.js");
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,
 "../../assets/allied-soldiers/manifest.json"),"utf8"));
const treeRoot=path.join(__dirname,"../..");
const files=Object.values(manifest.models)
 .map(x=>"assets/allied-soldiers/"+x.file)
 .filter(p=>fs.existsSync(path.join(treeRoot,p)));
const models=pipeline.auditModels({catalog,manifest,presentFiles:files});
assert.equal(pipeline.STAGES.length,10);
assert.deepEqual(pipeline.ROLE_IDS,["infantry","commando"]);
assert.equal(pipeline.ROLES.infantry.headwear,"steel-mk2-helmet");
assert.equal(pipeline.ROLES.commando.headwear,"beret");
assert.equal(pipeline.MODEL_IDS.length,3);
assert.equal(models.length,3);
assert(models.every(m=>m.filePresent===files.includes("assets/allied-soldiers/"+m.filename)));
assert.deepEqual(pipeline.MOTION_CLIPS,["Idle_Quaternius","Walk_Quaternius",
 "Jog_Quaternius","Sprint_Quaternius"]);
assert.deepEqual(pipeline.WEAPONS,["uk-lee-enfield","uk-sten","uk-bren","uk-piat"]);
assert.equal(pipeline.AUDIT_LIMITS.heroBaselineBones,65);
const unassigned=pipeline.validateBindings({},models);
assert.equal(unassigned.infantry.pipelineReady,false);
assert.equal(unassigned.commando.pipelineReady,false);
assert.equal(unassigned.infantry.modelId,null);
assert.equal(unassigned.commando.modelId,null);
assert.throws(()=>pipeline.validateBindings({commando:"americanHero"},models));
assert.throws(()=>pipeline.validateBindings({infantry:"nonexistent"},models));
for(const m of models){
 const s=pipeline.validateBindings({infantry:m.id,commando:m.id},models);
 assert.equal(s.infantry.assetReady,m.ready);
 assert.equal(s.commando.assetReady,m.ready);
 assert.equal(m.ready,!!(m.filePresent&&m.installed&&m.optimized&&m.rightsCleared));
}
// These approved source identities and 12 squad slots are not modified by stage 1.
assert.equal(catalog.BLUE_SLOTS.length,12);
assert.equal(catalog.BLUE_SLOTS[0],"americanHero");
assert.deepEqual(new Set(catalog.BLUE_SLOTS.slice(1)),new Set(pipeline.MODEL_IDS));
console.log("BRITISH_STAGE1_AUDIT_PASS",JSON.stringify({
 stages:pipeline.STAGES.length,
 roles:pipeline.ROLE_IDS,
 selectedBritishModels:models.map(m=>({id:m.id,ready:m.ready,reasons:m.reasons})),
 eligibleWeapons:pipeline.WEAPONS,
 heroRigBones:pipeline.AUDIT_LIMITS.heroBaselineBones
}));
