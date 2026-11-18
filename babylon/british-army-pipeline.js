/* Battlefield · British army 10-stage pipeline.
 * Only previously selected licensed British models are eligible.
 * No substitution, no pretend install, no changes to approved US hero or combat.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldBritishArmyPipeline=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const ROLE_IDS=Object.freeze(["infantry","commando"]);
 const ROLES=Object.freeze({
  infantry:Object.freeze({id:"infantry",label:"Британская пехота",
   headwear:"steel-mk2-helmet",uniform:"british-battledress",
   sourceModelId:null}),
  commando:Object.freeze({id:"commando",label:"Коммандос / десантники",
   headwear:"beret",uniform:"british-battledress",
   sourceModelId:null})
 });
 // Same four original weapon assets + hero-approved handling and ammunition.
 const WEAPONS=Object.freeze(["uk-lee-enfield","uk-sten","uk-bren","uk-piat"]);
 const MOTION_CLIPS=Object.freeze([
  "Idle_Quaternius","Walk_Quaternius","Jog_Quaternius","Sprint_Quaternius"
 ]);
 const POSES=Object.freeze(["ready","aim","fire","reload"]);
 const STAGES=Object.freeze([
  "selected-model-audit",
  "skinning-and-65-bone-target",
  "quaternius-four-motion-clips",
  "combat-stance-and-two-hand-ik",
  "lee-enfield",
  "sten",
  "bren",
  "piat",
  "army-spawn-squad-and-facing",
  "iphone-safari-regression"
 ]);
 const MODEL_IDS=Object.freeze(["britishDanoob","britishJakeli","britishFab"]);
 const AUDIT_LIMITS=Object.freeze({
  maxTrianglesPerSoldier:65000,heroBaselineBones:65,
  maxRightGripMeters:.06,maxLeftGripMeters:.06
 });
 const safeFile=file=>typeof file==="string"&&/^[a-z0-9-]+\.glb$/.test(file);
 function auditModels({catalog,manifest,presentFiles=[]}={}){
  if(!catalog?.MODELS||manifest?.schemaVersion!==1||!manifest?.models)
   throw Error("Selected Allied catalog and manifest are required");
  if(!Array.isArray(presentFiles))throw Error("Expected explicit local asset listing");
  const found=new Set(presentFiles);
  return Object.freeze(MODEL_IDS.map(id=>{
   const entry=catalog.MODELS[id],row=manifest.models[id];
   if(!entry||entry.nationality!=="british"||!row||!safeFile(row.file))
    throw Error("Missing selected British model: "+id);
   if(row.file!==entry.expectedGlb.split("/").at(-1))
    throw Error("Model identity/manifest filename mismatch: "+id);
   const filePresent=found.has("assets/allied-soldiers/"+row.file);
   const rightsCleared=!!row.rightsCleared,optimized=!!row.optimized;
   const installed=!!row.installed;
   const ready=filePresent&&rightsCleared&&optimized&&installed;
   const reasons=[];
   if(!filePresent)reasons.push("GLB отсутствует");
   if(!rightsCleared)reasons.push("лицензия не подтверждена");
   if(!optimized)reasons.push("оптимизация не подтверждена");
   if(!installed)reasons.push("не установлен в манифесте");
   return Object.freeze({id,title:entry.title,filename:row.file,
    filePresent,rightsCleared,optimized,installed,ready,
    reasons:Object.freeze(reasons)});
  }));
 }
 function validateBindings(bindings,models){
  const known=new Map((models||[]).map(row=>[row.id,row]));
  const output={};
  for(const role of ROLE_IDS){
   const id=bindings?.[role]||null;
   if(id!==null&&!MODEL_IDS.includes(id))
    throw Error("Only previously selected British models can be assigned: "+role);
   const info=id?known.get(id):null;
   if(id&&!info)throw Error("Model not audited: "+id);
   output[role]=Object.freeze({role,modelId:id,assetReady:!!info?.ready,
    pipelineReady:!!id&&!!info?.ready,headwear:ROLES[role].headwear});
  }
  return Object.freeze(output);
 }
 return Object.freeze({ROLE_IDS,ROLES,WEAPONS,MOTION_CLIPS,POSES,STAGES,
  MODEL_IDS,AUDIT_LIMITS,auditModels,validateBindings});
});
