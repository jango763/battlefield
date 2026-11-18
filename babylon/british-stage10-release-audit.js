/* Battlefield · British 10/10 · final release gate.
 * A successful prototype CI run is NOT authorization to ship unverified
 * original British character models. Safari measurements cannot be supplied
 * by Chromium. No automatic false-positive approval.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldBritishStage10Audit=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const STAGE_PAGES=Object.freeze([
  Object.freeze({step:2,label:"Скелет и skinning",path:"british-stage2-iphone.html",kind:"3D-контроль"}),
  Object.freeze({step:3,label:"Idle / Walk / Jog / Sprint",path:"british-stage3-iphone.html",kind:"3D-контроль"}),
  Object.freeze({step:4,label:"Стойка и двуручный хват",path:"british-stage4-iphone.html",kind:"3D-контроль"}),
  Object.freeze({step:5,label:"Lee-Enfield",path:"british-stage5-iphone.html",kind:"3D-контроль"}),
  Object.freeze({step:6,label:"Sten",path:"british-stage6-iphone.html",kind:"3D-контроль"}),
  Object.freeze({step:7,label:"Bren",path:"british-stage7-iphone.html",kind:"3D-контроль"}),
  Object.freeze({step:8,label:"PIAT",path:"british-stage8-iphone.html",kind:"3D-контроль"}),
  Object.freeze({step:9,label:"Британские отряды (схема)",path:"british-stage9-iphone.html",kind:"2D-симуляция"})
 ]);
 const SAFARI_MANUAL=Object.freeze([
  Object.freeze({id:"load",label:"Все экраны открываются, без чёрного экрана"}),
  Object.freeze({id:"hands",label:"Обе кисти на оружии, без переворота или дублирования"}),
  Object.freeze({id:"locomotion",label:"Idle / Walk / Jog / Sprint переключаются без рывков"}),
  Object.freeze({id:"weapons",label:"Все четыре оружия: прицел, выстрел, перезарядка и смена"}),
  Object.freeze({id:"controls",label:"Сенсорные кнопки, удержание огня, возврат в игру"}),
  Object.freeze({id:"reload",label:"Повторное открытие не создаёт лишних скелетов/ресурсов"})
 ]);
 const WEAPONS=Object.freeze(["uk-lee-enfield","uk-sten","uk-bren","uk-piat"]);
 const EXPECTED=Object.freeze({
  originalBritishModels:3,armySlots:12,infantry:8,commando:3,
  hero:1,fireteams:3,clipsPerActor:4,skeletonBones:65
 });
 const isSafariUA=ua=>{
  const s=String(ua||"");
  return /Safari\//.test(s)&&/Version\//.test(s)&&
   !/(?:CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Android)/.test(s);
 };
 function canMeasureMemory(performanceObject){
  return Number.isFinite(performanceObject?.memory?.usedJSHeapSize) &&
   Number.isFinite(performanceObject?.memory?.jsHeapSizeLimit);
 }
 function evaluate({catalog,pipeline,army,manifest,presentFiles=[],
  assignments={},headwearApproved={},actors=[],
  safariManual={},safariUA="",deviceActual=false,
  measured3d=null,visualAcceptance=false}={}){
  if(!catalog||!pipeline||!army||!manifest)
   throw Error("Stage10 requires original catalog, manifest and squad plan");
  const p=army.plan({catalog,pipeline,manifest,presentFiles,
   bindings:assignments,approvedHeadwear:headwearApproved});
  if(p.total!==EXPECTED.armySlots||p.infantry!==EXPECTED.infantry||
    p.commando!==EXPECTED.commando||p.hero!==EXPECTED.hero||
    p.fireteams?.length!==EXPECTED.fireteams)
   throw Error("Unexpected Allied army makeup");
  const blockers=[];
  for(const item of p.sourceModels){
   if(!item.ready)blockers.push(item.id+": "+item.reasons.join("; "));
  }
  for(const role of ["infantry","commando"]){
   if(!assignments[role])blockers.push(role+": original model not assigned");
   if(headwearApproved[role]!==true)
    blockers.push(role+": headwear and outfit not approved on original GLB");
  }
  let rigAudit=null;
  if(actors.length===EXPECTED.armySlots){
   try{rigAudit=army.verifyUniqueVisualActors(actors,{headwearApproved});}
   catch(e){blockers.push("Independent skinned rigs: "+e.message)}
  }else blockers.push("12 real independent 3D actors not imported/inspected");
  const checklist=Object.freeze(SAFARI_MANUAL.map(x=>Object.freeze({
   ...x,checked:safariManual[x.id]===true
  })));
  const allManual=checklist.every(x=>x.checked);
  const actualSafari=!!deviceActual&&isSafariUA(safariUA);
  if(!actualSafari)blockers.push("Physical iPhone Safari check not confirmed");
  if(!allManual)blockers.push("Safari visual/touch checklist incomplete");
  if(!measured3d||measured3d.controlOnly!==false)
   blockers.push("No full-scene measured performance on real British models");
  if(visualAcceptance!==true)blockers.push("Actual gameplay integration not visually accepted");
  const ready=blockers.length===0&&p.britishVisualsReady&&!!rigAudit?.ok;
  return Object.freeze({
   releaseReady:ready,
   technicalPrototypeReady:true,
   realBritish3dSpawns:actors.length===12&&!!rigAudit?.ok?11:0,
   originalBritishModelsReady:p.sourceModels.filter(x=>x.ready).length,
   britishModelsExpected:EXPECTED.originalBritishModels,
   originalModelAudit:p.sourceModels,
   safariUserAgent:isSafariUA(safariUA),
   physicalSafariTested:actualSafari,
   safariChecklist:checklist,
   fullSceneMeasured:!!measured3d&&measured3d.controlOnly===false,
   readyToMergeMain:ready,
   army:{slots:p.total,infantry:p.infantry,commando:p.commando,
    fireteams:p.fireteams.map(x=>({id:x.id,size:x.slots.length}))},
   blockers:Object.freeze(blockers)
  });
 }
 function probeSummary({loadMs=NaN,renderFps=NaN,bones=0,
  source="control-hero",memoryBytes=null}={}){
  const numbers={loadMs,renderFps,bones};
  if(Object.values(numbers).some(x=>!Number.isFinite(x)||x<0))
   throw Error("Invalid measured frame/load/rig data");
  const controlOnly=source==="control-hero";
  const raw=memoryBytes===null?null:Number(memoryBytes);
  return Object.freeze({controlOnly,loadMs,renderFps,bones,
   memoryBytes:Number.isFinite(raw)&&raw>=0?raw:null,
   browserMeasurement:true,notSafariCertification:true,
   passes65BoneControl:bones===EXPECTED.skeletonBones,
   performanceGatePassed:false
  });
 }
 return Object.freeze({STAGE_PAGES,SAFARI_MANUAL,WEAPONS,EXPECTED,
  isSafariUA,canMeasureMemory,evaluate,probeSummary});
});
