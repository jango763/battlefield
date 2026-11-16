/* Battlefield: strictly validated, original GLB import for four Allied characters.
 * No generated placeholders are passed off as these authored models.
 * Animation retargeting uses Babylon.js AnimatorAvatar (v9+) and exact
 * 65-bone source clips. Missing files/rig mismatch leave the match unchanged.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldAlliedAssetLoader=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const REQUIRED=Object.freeze([
  'Hips','Spine','Spine1','Spine2','Neck','Head',
  'LeftShoulder','LeftArm','LeftForeArm','LeftHand',
  'RightShoulder','RightArm','RightForeArm','RightHand',
  'LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'
 ]);
 const WEAPONS=Object.freeze(['Kar98k','MP40','MG42','Panzerschreck']);
 const POSES=Object.freeze(['Hold','Aim','Fire','Run']);
 const CLIPS=Object.freeze(WEAPONS.flatMap(w=>POSES.map(p=>w+'_'+p)));
 const normalize=n=>String(n||'').replace(/^.*?(?=mixamorig)/i,'')
  .replace(/^mixamorig[:_]?/i,'').replace(/_\d+$/,'')
  .replace(/[^a-z0-9]/gi,'').toLowerCase();
 function byCanonical(bones){
  const out=new Map();
  for(const bone of bones||[]){
   const target=bone.getTransformNode?.()||null;
   const n=normalize(target?.name||bone.name);
   if(n&&!out.has(n))out.set(n,{bone,node:target});
  }
  return out;
 }
 function inspect(entries,{maxTriangles=65000}={}){
  const skeletons=entries?.skeletons||[];
  const drawable=(entries?.meshes||[]).filter(m=>m.getTotalVertices?.()>0);
  const skinned=drawable.filter(m=>!!m.skeleton);
  const tris=drawable.reduce((total,m)=>total+
   (m.getTotalIndices?.()>0?Math.ceil(m.getTotalIndices()/3):Math.ceil(m.getTotalVertices()/3)),0);
  const mapped=skeletons.map(s=>byCanonical(s.bones));
  // Linked glTF nodes are mandatory for the existing two-hand IK driver.
  const chosen=mapped.find(map=>REQUIRED.every(name=>map.get(normalize(name))?.node));
  const missing=chosen?[]:REQUIRED.filter(name=>!mapped.some(map=>map.has(normalize(name))));
  const issues=[];
  if(!drawable.length)issues.push('Модель не содержит видимой геометрии');
  if(!skinned.length)issues.push('Модель не привязана к скелету — требуется skinning в Blender');
  if(!skeletons.length)issues.push('Нет скелета');
  if(!chosen)issues.push('Отсутствуют обязательные linked-кости рук/ног или glTF joints');
  if(tris>maxTriangles)issues.push('Слишком тяжёлая модель: '+tris+' треугольников; предел '+maxTriangles);
  return {ok:issues.length===0,issues,
   triangles:tris,meshCount:drawable.length,skinnedMeshes:skinned.length,
   bones:chosen?.size||skeletons[0]?.bones?.length||0,rig:chosen||null};
 }
 function hideEmbeddedWeapons(entries){
  // Licensed character GLBs sometimes ship with a rifle glued into the mesh.
  // Hide only separately named prop meshes. A merged body+gun must be fixed
  // manually in Blender; guessing could erase the character itself.
  const pattern=/(?:^|[\s._-])(rifle|weapon|smg|lmg|gun|carbine|sten|bren|lee[\s._-]?enfield|pistol|kar98k)(?:$|[\s._-])/i;
  const disabled=[];
  for(const mesh of entries?.meshes||[]){
   if(!mesh.getTotalVertices?.()||!pattern.test(mesh.name||''))continue;
   if(mesh.skeleton)continue; // A skinned prop may share a mesh with the body.
   mesh.setEnabled?.(false);mesh.isVisible=false;disabled.push(mesh.name);
  }
  return disabled;
 }
 function validateManifest(manifest,catalog){
  if(manifest?.schemaVersion!==1)throw Error('Wrong Allied asset manifest schema');
  const list=manifest.models;
  if(!list||typeof list!=='object')throw Error('Allied asset manifest is empty');
  for(const [id,model] of Object.entries(catalog.MODELS)){
   const row=list[id];if(!row)throw Error('Missing manifest profile '+id);
   if(!/^[a-z0-9-]+\.glb$/.test(row.file))
    throw Error('Unsafe model file path '+id);
   if(row.file!==model.expectedGlb.split('/').at(-1))
    throw Error('Catalog/manifest file mismatch '+id);
   if(row.installed && (!row.rightsCleared||!row.optimized))
    throw Error('Uncleared/untested model cannot be marked installed: '+id);
   if(!Number.isFinite(row.maxTriangles)||row.maxTriangles<=0)
    throw Error('Invalid mobile triangle budget '+id);
  }
  return manifest;
 }
 function clipLabel(g){return CLIPS.find(id=>g.name===id||g.name.endsWith(id))}
 function sourceClips(sourceGroups){
  const out=new Map();
  for(const g of sourceGroups||[]){
   const id=clipLabel(g);
   if(id&&!out.has(id))out.set(id,g);
  }
  const missing=CLIPS.filter(id=>!out.has(id));
  if(missing.length)throw Error('Approved animation library missing: '+missing.join(', '));
  return out;
 }
 // Don't point controls to different-proportion wrists without checking
 // these joints in the source AND target hierarchies.
 function nodeMapFor(group,rig){
  const map=new Map();
  for(const ta of group.targetedAnimations||[]){
   const sourceName=ta.target?.name;
   const bone=rig.get(normalize(sourceName));
   if(bone&&sourceName)map.set(sourceName,bone.bone.name);
  }
  return map;
 }
 function retarget(B,avatarRoot,sourceGroups,rig,tag){
  if(typeof B.AnimatorAvatar!=='function')
   throw Error('Требуется Babylon.js 9+ с AnimatorAvatar для переноса 16 анимаций');
  const avatar=new B.AnimatorAvatar('allied-avatar-'+tag,avatarRoot);
  const result=[],source=sourceClips(sourceGroups);
  try{
   for(const [id,g] of source){
    const names=nodeMapFor(g,rig);
    if(names.size<18)
     throw Error('Too few mapped animated joints for '+id+': '+names.size);
    const converted=avatar.retargetAnimationGroup(g,{
     animationGroupName:'allied-'+tag+'-'+id,
     mapNodeNames:names,
     retargetAnimationKeys:true,
     fixRootPosition:true,
     fixGroundReference:false,
     fixAnimations:true,
     checkHierarchy:false,
     rootNodeName:'Hips'
    });
    if((converted?.targetedAnimations?.length||0)<18){
     converted?.dispose?.();
     throw Error('Retargeted animation has too few tracks: '+id);
    }
    converted.stop();
    result.push(converted);
   }
  }catch(e){for(const g of result)g.dispose?.();throw e}
  return result;
 }
 function gripAssessment(report,weaponId,limits){
  const reason=[];
  if(!report||report.weapon!==weaponId)reason.push('Оружие не закреплено');
  const right=Number(report?.rightGripMeters),left=Number(report?.leftGripMeters);
  if(!Number.isFinite(right)||right>limits.rightMaxMeters)
   reason.push('Правая кисть вне рукояти: '+String(report?.rightGripMeters));
  if(!Number.isFinite(left)||left>limits.leftMaxMeters)
   reason.push('Левая кисть вне цевья: '+String(report?.leftGripMeters));
  const stock=Number(report?.stockRightShoulderMeters);
  if(Number.isFinite(stock)&&stock>limits.stockMaxMeters)
   reason.push('Приклад отстоит от плеча: '+stock+' м');
  if(report?.error)reason.push(String(report.error));
  return {ok:reason.length===0,reason,rightGripMeters:right,
   leftGripMeters:left,stockRightShoulderMeters:stock,weaponId};
 }
 function create({B,scene,catalog,sourceGroups,fetchManifest}){
  if(!B?.SceneLoader||!scene||!catalog?.MODELS)
   throw Error('Missing Babylon.js scene or allied casting catalog');
  let manifest=null;
  const containers=new Map(),errors=new Map();
  const source=sourceClips(sourceGroups);
  const getManifest=fetchManifest||(()=>fetch('../assets/allied-soldiers/manifest.json')
   .then(r=>{if(!r.ok)throw Error('Manifest HTTP '+r.status);return r.json()}));
  async function init(){
   manifest=validateManifest(await getManifest(),catalog);
   return status();
  }
  function status(){
   return Object.fromEntries(Object.keys(catalog.MODELS).map(id=>[
    id,{installed:!!manifest?.models?.[id]?.installed,
     rightsCleared:!!manifest?.models?.[id]?.rightsCleared,
     optimized:!!manifest?.models?.[id]?.optimized,
     error:errors.get(id)||null}
   ]));
  }
  async function ensureAsset(id){
   if(!manifest)throw Error('Allied model manifest not initialized');
   const row=manifest.models[id];
   if(!row)throw Error('Unknown allied model: '+id);
   if(!row.installed)return null;
   if(!row.rightsCleared||!row.optimized)
    throw Error('License/optimization review pending for '+id);
   if(!containers.has(id)){
    containers.set(id,B.SceneLoader.LoadAssetContainerAsync(
     '../assets/allied-soldiers/',row.file,scene));
   }
   try{return await containers.get(id)}catch(e){
    containers.delete(id);
    errors.set(id,String(e?.message||e));throw e;
   }
  }
  async function instantiate(id,tag){
   const model=await ensureAsset(id);
   if(!model)return null;
   const entries=model.instantiateModelsToScene(name=>name+'-'+tag,false,
    {doNotInstantiate:true});
   const current=inspect(entries,{maxTriangles:manifest.models[id].maxTriangles});
   if(!current.ok){entries.dispose?.();const err=Error(current.issues.join('; '));
    errors.set(id,err.message);throw err;}
   // Reparent clone roots once. No duplicate body/skeleton to produce four hands.
   const root=new B.TransformNode('real-allied-'+id+'-'+tag,scene);
   for(const node of entries.rootNodes){
    if(!node.parent)node.parent=root;
   }
   entries.rootNodes=[root];
   let animationGroups=[];
   try{animationGroups=retarget(B,root,[...source.values()],current.rig,tag);}
   catch(e){root.dispose(false,false);entries.dispose?.();
    errors.set(id,String(e?.message||e));throw e;}
   entries.animationGroups=animationGroups;
   const hiddenWeapons=hideEmbeddedWeapons(entries);
   return {entries,modelId:id,rig:current,retargeted:animationGroups.length,hiddenWeapons};
  }
  return Object.freeze({init,status,ensureAsset,instantiate,gripAssessment:
   (report,id)=>gripAssessment(report,id,manifest?.gripQA||{
    rightMaxMeters:.06,leftMaxMeters:.06,stockMaxMeters:.15})});
 }
 return Object.freeze({REQUIRED,CLIPS,normalize,inspect,hideEmbeddedWeapons,
  validateManifest,sourceClips,retarget,gripAssessment,create});
});