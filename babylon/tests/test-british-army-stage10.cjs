"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const audit=require("../british-stage10-release-audit.js");
const pipeline=require("../british-army-pipeline.js");
const army=require("../british-stage9-army.js");
const catalog=require("../allied-model-catalog.js");
const manifest=JSON.parse(fs.readFileSync(path.join(
 __dirname,"../../assets/allied-soldiers/manifest.json"),"utf8"));
const root=path.resolve(__dirname,"../..");
const existing=Object.values(manifest.models)
 .filter(row=>fs.existsSync(path.join(root,"assets/allied-soldiers",row.file)))
 .map(row=>"assets/allied-soldiers/"+row.file);
assert.equal(pipeline.STAGES[9],"iphone-safari-regression");
assert.equal(audit.STAGE_PAGES.length,8);
assert.deepEqual(audit.STAGE_PAGES.map(x=>x.step),[2,3,4,5,6,7,8,9]);
assert.equal(audit.SAFARI_MANUAL.length,6);
assert.deepEqual(audit.WEAPONS,pipeline.WEAPONS);
for(const page of audit.STAGE_PAGES)
 assert(fs.existsSync(path.join(root,"babylon",page.path)),
  "Missing preview "+page.path);
assert.equal(audit.isSafariUA(
 "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) "+
 "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"),true);
assert.equal(audit.isSafariUA(
 "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 (KHTML, like Gecko) "+
 "CriOS/130 Mobile/15E148 Safari/604.1"),false);
assert.equal(audit.isSafariUA(
 "Mozilla/5.0 Chrome/131.0 Safari/537.36"),false);
assert.equal(audit.canMeasureMemory({memory:{usedJSHeapSize:100,jsHeapSizeLimit:200}}),true);
assert.equal(audit.canMeasureMemory({}),false);
const rejected=audit.evaluate({catalog,pipeline,army,manifest,
 presentFiles:existing});
assert.equal(rejected.technicalPrototypeReady,true);
assert.equal(rejected.releaseReady,false);
assert.equal(rejected.readyToMergeMain,false);
assert.equal(rejected.realBritish3dSpawns,0);
assert.equal(rejected.army.slots,12);
assert.deepEqual(rejected.army.fireteams.map(x=>x.size),[4,4,3]);
assert(rejected.blockers.some(x=>x.includes("12 real independent 3D actors")));
assert(rejected.blockers.some(x=>x.includes("Safari")));
assert.equal(rejected.originalBritishModelsReady,0);
assert.equal(rejected.britishModelsExpected,3);
assert.equal(rejected.safariChecklist.every(x=>!x.checked),true);
// Even if all source filenames appear, false rights and not-installed
// flags must remain release blockers. Never infer license from an HTTP 200.
const fakeFiles=pipeline.MODEL_IDS.map(id=>
 "assets/allied-soldiers/"+manifest.models[id].file);
const manual=Object.fromEntries(audit.SAFARI_MANUAL.map(x=>[x.id,true]));
const safari="Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) "+
 "AppleWebKit/605.1.15 Version/18.1 Mobile Safari/604.1";
const forged=audit.evaluate({catalog,pipeline,army,manifest,
 presentFiles:fakeFiles,
 assignments:{infantry:"britishDanoob",commando:"britishFab"},
 headwearApproved:{infantry:true,commando:true},
 safariManual:manual,safariUA:safari,deviceActual:true,
 measured3d:{controlOnly:true,bones:65,renderFps:250},
 visualAcceptance:true});
assert.equal(forged.releaseReady,false);
assert.equal(forged.fullSceneMeasured,false);
assert(forged.blockers.some(x=>x.includes("licensed")||
 x.includes("лицензия")));
const goodManifest=structuredClone(manifest);
for(const id of pipeline.MODEL_IDS){
 Object.assign(goodManifest.models[id],{
  installed:true,rightsCleared:true,optimized:true
 });
}
function actor(slot){
 return {slot,role:army.roleForSlot(slot),
  skeleton:{bones:Array.from({length:65},(_,i)=>({name:"bone-"+i}))},
  clips:Array.from({length:4},(_,i)=>({slot,clip:i})),
  weaponMount:{slot},grip:{ok:true},mountParent:"mixamorig:Weapon_R",
  originalAssetVerified:slot!==0,licenseVerified:slot!==0,
  skinningVerified:slot!==0
 };
}
const actors=Array.from({length:12},(_,i)=>actor(i));
const fullArgs={
 catalog,pipeline,army,manifest:goodManifest,presentFiles:fakeFiles,
 assignments:{infantry:"britishDanoob",commando:"britishFab"},
 headwearApproved:{infantry:true,commando:true},
 actors,safariManual:manual,safariUA:safari,deviceActual:true,
 measured3d:{controlOnly:false,actors:12,fpsP10:35,observedSeconds:12,
  contextLosses:0},visualAcceptance:true
};
// This is a SYNTHETIC POSITIVE CONTRACT test, not actual user acceptance.
const synthetic=audit.evaluate(fullArgs);
assert.equal(synthetic.releaseReady,true);
assert.equal(synthetic.readyToMergeMain,true);
assert.equal(synthetic.realBritish3dSpawns,11);
assert.equal(synthetic.originalBritishModelsReady,3);
assert.equal(synthetic.blockers.length,0);
assert.equal(audit.evaluate({...fullArgs,
 measured3d:{controlOnly:false,actors:12,fpsP10:29,observedSeconds:12,
  contextLosses:0}}).releaseReady,false);
assert.equal(audit.evaluate({...fullArgs,
 measured3d:{controlOnly:false,actors:12,fpsP10:45,observedSeconds:5,
  contextLosses:0}}).releaseReady,false);
const duplicate=actors.map(a=>({...a}));
duplicate[7].skeleton=duplicate[6].skeleton;
assert.equal(audit.evaluate({...fullArgs,actors:duplicate}).releaseReady,false);
const q=audit.probeSummary({loadMs:2200,renderFps:40,bones:65});
assert.equal(q.controlOnly,true);
assert.equal(q.memoryBytes,null);
assert.equal(q.passes65BoneControl,true);
assert.equal(q.performanceGatePassed,false);
assert.throws(()=>audit.probeSummary({loadMs:NaN,renderFps:50,bones:65}));
const reference="assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb";
const weapons=["uk-lee-enfield","uk-sten","uk-bren"].map(x=>
 "assets/ww2-weapons/"+x+".glb");
const critical=[reference,...weapons];
const bytes=critical.map(f=>fs.statSync(path.join(root,f)).size);
assert(bytes.every(n=>n>0));
assert(bytes[0]<8*1024*1024,"Control hero GLB exceeds 8 MB preflight budget");
assert(bytes.slice(1).every(n=>n<4*1024*1024),
 "Weapon GLB exceeds 4 MB preflight budget");
const totalBytes=bytes.reduce((a,b)=>a+b,0);
assert(totalBytes<16*1024*1024,
 "Combined control hero + three modelled weapons exceeds 16 MB");
console.log("BRITISH_STAGE10_RELEASE_GATE_PASS",JSON.stringify({
 technicalCode:true,realUKGlbs:rejected.originalBritishModelsReady,
 allowedToShip:rejected.releaseReady,stageLinks:audit.STAGE_PAGES.length,
 safaritest:"manual required",teams:[4,4,3],positiveSyntheticGate:true,
 actualOriginals:false,combinedControlFilesMiB:+(totalBytes/1048576).toFixed(2),
 budgetMiB:16
}));
