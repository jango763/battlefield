/* Battlefield · British Army · stage 2.
 * Read-only inspection for original British GLBs. This does not generate,
 * pretend to install or silently substitute a model from another faction.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldBritishStage2RigAudit=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const TARGET_BONES=65;
 const MAX_TRIANGLES=65000;
 const REQUIRED=Object.freeze([
  "hips","spine","spine1","spine2","neck","head",
  "leftshoulder","leftarm","leftforearm","lefthand",
  "rightshoulder","rightarm","rightforearm","righthand",
  "leftupleg","leftleg","leftfoot","rightupleg","rightleg","rightfoot"
 ]);
 const ROLES=Object.freeze({
  infantry:Object.freeze({name:"Британская пехота",headwear:"каска Mk II",pattern:/helmet|brodie|mk[._ -]?ii/i}),
  commando:Object.freeze({name:"Коммандос",headwear:"берет",pattern:/beret/i})
 });
 const canon=n=>String(n||"").replace(/^mixamorig[:_]?/i,"")
  .replace(/_\d+$/,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
 const nameOf=b=>b?.getTransformNode?.()?.name||b?.name||"";
 const kind=(B,key,fallback)=>B?.VertexBuffer?.[key]||fallback;
 function audit({meshes=[],skeletons=[]},{B=null,role="infantry",maxTriangles=MAX_TRIANGLES}={}){
  if(!ROLES[role])throw Error("Unknown British role "+role);
  if(!Array.isArray(meshes)||!Array.isArray(skeletons))
   throw Error("Babylon import must expose meshes and skeletons");
  const problems=[],warnings=[];
  const real=meshes.filter(m=>(m?.getTotalVertices?.()||0)>0);
  const triangleCount=real.reduce((n,m)=>{
   const indices=m.getTotalIndices?.();
   const vertices=m.getTotalVertices();
   return n+Math.ceil((indices>0?indices:vertices)/3);
  },0);
  if(triangleCount>maxTriangles)
   problems.push("Слишком много треугольников: "+triangleCount+" / "+maxTriangles);
  if(!real.length)problems.push("Нет видимой геометрии");
  if(skeletons.length!==1)problems.push("Нужен один скелет (найдено "+skeletons.length+")");
  const skel=skeletons.length===1?skeletons[0]:null;
  const bones=skel?.bones||[];
  if(bones.length!==TARGET_BONES)
   problems.push("Скелет не совпадает с 65-костным ригом героя (найдено "+bones.length+")");
  const mapped=new Map();
  for(const bone of bones){
   const key=canon(nameOf(bone));
   if(mapped.has(key)&&key)problems.push("Повторяющаяся кость: "+key);
   else if(key)mapped.set(key,bone);
  }
  const missing=REQUIRED.filter(name=>!mapped.has(name));
  if(missing.length)problems.push("Нет ключевых костей: "+missing.join(", "));
  const missingLinked=REQUIRED.filter(name=>
   mapped.has(name)&&!mapped.get(name)?.getTransformNode?.());
  if(missingLinked.length)problems.push("Нет linked glTF-суставов: "+missingLinked.join(", "));
  const weightKind=kind(B,"MatricesWeightsKind","matricesWeights");
  const indexKind=kind(B,"MatricesIndicesKind","matricesIndices");
  const weightExtraKind=kind(B,"MatricesWeightsExtraKind","matricesWeightsExtra");
  const indexExtraKind=kind(B,"MatricesIndicesExtraKind","matricesIndicesExtra");
  let skinned=0,checkedVertices=0,invalidVertices=0,missingStreams=0,
   maxError=0,totalInfluences=0;
  for(const mesh of real){
   if(!mesh.skeleton)continue;
   skinned++;
   if(skel&&mesh.skeleton!==skel){
    problems.push("Часть тела привязана к другому скелету: "+(mesh.name||"mesh"));
    continue;
   }
   const count=mesh.getTotalVertices();
   const w=mesh.getVerticesData?.(weightKind),idx=mesh.getVerticesData?.(indexKind);
   const wx=mesh.getVerticesData?.(weightExtraKind),ix=mesh.getVerticesData?.(indexExtraKind);
   if(!w||!idx||w.length<count*4||idx.length<count*4){
    missingStreams++;
    problems.push("Нет JOINTS_0/WEIGHTS_0: "+(mesh.name||"mesh"));
    continue;
   }
   if((wx&&!ix)||(ix&&!wx)||((wx&&wx.length<count*4)||(ix&&ix.length<count*4))){
    missingStreams++;
    problems.push("Повреждены дополнительные веса: "+(mesh.name||"mesh"));
    continue;
   }
   for(let vi=0;vi<count;vi++){
    checkedVertices++;
    let total=0,bad=false,active=0;
    for(let c=0;c<4;c++){
     const k=vi*4+c;
     const weight=Number(w[k]),index=Number(idx[k]);
     if(!Number.isFinite(weight)||weight<0){bad=true;continue;}
     total+=weight;
     if(weight>1e-5){
      active++;
      if(!Number.isInteger(index)||index<0||index>=bones.length)bad=true;
     }
     if(wx){
      const extra=Number(wx[k]),extraIndex=Number(ix[k]);
      if(!Number.isFinite(extra)||extra<0){bad=true;continue;}
      total+=extra;
      if(extra>1e-5){
       active++;
       if(!Number.isInteger(extraIndex)||extraIndex<0||extraIndex>=bones.length)bad=true;
      }
     }
    }
    totalInfluences+=active;
    maxError=Math.max(maxError,Math.abs(total-1));
    if(total<.97||total>1.03||bad)invalidVertices++;
   }
  }
  if(!skinned)problems.push("Геометрия не привязана к скелету (skinning отсутствует)");
  if(invalidVertices)problems.push("Ошибки весов или индексов у "+invalidVertices+" вершин");
  const nonSkinned=real.filter(m=>!m.skeleton).map(m=>m.name||"mesh");
  if(nonSkinned.length)warnings.push(
   "Есть жёсткие части без skinning — проверить крепление вручную: "+nonSkinned.slice(0,8).join(", "));
  const detected=real.filter(m=>ROLES[role].pattern.test(m.name||""));
  if(!detected.length)warnings.push(
   "Нельзя подтвердить "+ROLES[role].headwear+" по названиям мешей; осмотреть визуально");
  // Some headwear is skinned to the head inside one mesh; absent keywords
  // are a MANUAL REVIEW requirement, never proof that gear is missing.
  const result={
   role,roleLabel:ROLES[role].name,expectedHeadwear:ROLES[role].headwear,
   skeletons:skeletons.length,bones:bones.length,meshCount:real.length,
   skinnedMeshes:skinned,triangles:triangleCount,checkedVertices,
   invalidVertices,missingStreams,missingBones:missing,
   averageInfluences:checkedVertices?totalInfluences/checkedVertices:0,
   maxWeightSumError:maxError,headwearCandidateMeshes:detected.map(m=>m.name),
   problems,warnings,rigCompatible:problems.length===0,
   needsHeadwearVisualApproval:true,
   readyForGameplay:false
  };
  return Object.freeze(result);
 }
 return Object.freeze({TARGET_BONES,MAX_TRIANGLES,REQUIRED,ROLES,canon,audit});
});
