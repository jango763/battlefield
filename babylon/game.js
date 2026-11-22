/* Battlefield Babylon: primary playable hero and squad scene using the approved animated Panzergrenadier.
 * AssetContainer instantiates independent 65-bone skeletons + 16 clips per unit.
 * Preserves the original GLB/weapon rig and legacy Three.js in its separate main branch.
 */
(async function(){
'use strict';
const $=id=>document.getElementById(id);
const B=window.BABYLON;
const combat=window.BattlefieldBalance;
const tactics=window.BattlefieldSquadController;
const presentation=window.BattlefieldCombatPresentation;
const orders=window.BattlefieldFirstGameArmy;
const replenishment=window.BattlefieldReplenishment;
const goldRules=window.BattlefieldGoldEconomy;
const worldBuilder=window.BattlefieldWorld300;
const legacyVisual=window.BattlefieldLegacyVisualStyle;
const modernArt=window.BattlefieldModernArt;
const villageModels=window.BattlefieldModernVillageModels;
const factions=window.BattlefieldBritishFaction;
const britishSoldier=window.BattlefieldBritishSoldier;
const nativeBlend=window.BattlefieldNativeClipBlend;
const unitMotion=window.BattlefieldUnitMotionUnifier;
const alliedModels=window.BattlefieldAlliedModels;
const alliedLoader=window.BattlefieldAlliedAssetLoader;
const characters=window.BattlefieldCharacterSources;
const briefing=$('battlefield-brief'),enterButton=$('enter-game'),briefingProgress=$('brief-progress');
const canvas=$('view');
// Retry and menu work even if CDN scripts or the 3D model failed to load.
$('retry').addEventListener('click',()=>location.reload());
$('hud-toggle').addEventListener('click',()=>{
 const panel=$('panel'),closed=panel.classList.toggle('closed');
 $('hud-toggle').setAttribute('aria-pressed',String(!closed));
 $('hud-toggle').textContent=closed?'Меню':'Скрыть';
});
if(!B||!combat||!tactics||!presentation||!orders||!goldRules||!worldBuilder||!modernArt||!factions||!britishSoldier||!alliedModels||!alliedLoader||!characters||!nativeBlend||!replenishment||!window.BattlefieldWeaponRig){
 const message='Не загружены Babylon.js или боевые модули. Проверьте подключение к сети.';
 $('loading').textContent=message;
 $('failure-text').textContent=message;
 $('failure').style.display='block';
 briefingProgress.textContent=message;
 enterButton.textContent='Не удалось загрузить игру';
 return;
}
// Refuse a silent source swap that could replace the approved appearance.
characters.validateTrialFiles(alliedLoader.FEATURE_TRIAL_FILES);
const META={Kar98k:'de-kar98k',MP40:'de-mp40',MG42:'de-mg42',
 Panzerschreck:'de-panzerschreck'};
// Preserve existing gameplay weapon IDs for identical damage, ammo and motion.
const weaponAsset=(view,weapon)=>factions.asset(view.faction,weapon);
const britishLabel=weapon=>factions.label('british',weapon);
const PRICES={MP40:{weapon:100,magazine:15},MG42:{weapon:240,magazine:40},
 Panzerschreck:{weapon:350,magazine:70}};
const UNIT_SCALE=1,BASE_X=-150,BASE_Z=-150;
const SCENARIOS={duel:[1,1],assault:[1,4],squads:[12,12]};
const CLIP_POSES={ready:'Hold',aim:'Aim',fire:'Fire',run:'Run'};
const CLIP_IDS=Object.keys(META).flatMap(w=>Object.values(CLIP_POSES).map(p=>w+'_'+p));
// Feature-branch controlled rollout: one hero, eight real Jakeli infantry,
// and three UNAPPROVED Commando slots still using the existing prototype.
// Do not change the source catalog or the locked release manifest.
const FEATURE_REAL_ALLIES=true;
const featureCasting=slot=>characters.forSlot(slot).id;
const NATIVE_POSES=Object.freeze({
 americanHero:Object.freeze({ready:'Idle_Quaternius',aim:'Idle_Quaternius',
  fire:'Idle_Quaternius',run:'Jog_Quaternius'}),
 britishJakeli:Object.freeze({ready:'Ready',aim:'Aim',fire:'Fire',run:'Jog'})
});

const state={ready:false, loading:true, error:null, models:0, clips:0,
 scenario:'squads',atBase:true,selected:'Kar98k',focus:null, fps:0,
 importedAlliedCount:0,modelErrors:{},alliedManifest:null,actorSources:{},unitMotionReports:{}};
// The diagnostics below are local-only; no paid telemetry or account.
state.engineering={version:'10-stage-20261122',parts:10,privacy:'local-only',
 glbFallbacks:0,assetRetries:0,frameStats:{},source:'original-ww2-babylon'};
window.__BATTLEFIELD_GAME__=state;
let engine,scene,camera,asset,views=[],battle,controller,allies=[],enemies=[];
let modelDepot=null,modelDepotRetryAfter=0;
const motionDonors={germanRun:null,britishReady:null};
// Cross-rig locomotion failed visual acceptance in the isolated soldier range.
// Keep native authored clips in gameplay unless deliberately reviewing that
// experimental branch with a URL flag. Never silently ship stiff donor legs.
const DONOR_RUN_RESEARCH=new URLSearchParams(location.search).get('experimentalDonorRun')==='1';
function promoteUnitMotion(view){
 if(!unitMotion||!view||!DONOR_RUN_RESEARCH)return;
 const previous=view.clip,pose=view.lastPose;
 try{
  const result=unitMotion.install(view,{B,...motionDonors});
  state.unitMotionReports[view.index]=result.reports||{error:result.reason};
  if(pose&&view.unit&&view.clips.get(view.weapon+'_'+CLIP_POSES[pose])!==previous)
   setClip(view,pose);
 }catch(error){
  state.unitMotionReports[view.index]={error:String(error?.message||error)};
  console.warn('Infantry motion fallback',view.index,error);
 }
}

let actors=new Map(),fx=[],scenario='squads',atBase=true,world=null;
const TRACER_LIMIT=48;
const tracerPool=[];
let replenisher=null,reinforcementEpoch=0;
const REINFORCEMENT_LIMIT=8;
let statusAt=0,lastFarmSyncAt=0,starting=false,fieldOrders=null,terrain=null,destinationMark=null,inputMode='move';
let weaponQueue=[],weaponWorker=false;
let support=null,tacticalAI=null;
let economy=null,gameStarted=false,gamePausedForBriefing=true,lastEconomyBlue=0;
const touchJoystick={active:false,pointer:null,x:0,y:0,cooldown:0};
const movementKeys={w:false,a:false,s:false,d:false,ArrowUp:false,ArrowDown:false,ArrowLeft:false,ArrowRight:false};
// Reinforcement clocks are owned by replenishment-core.js.
function alertStatus(message){$('event').textContent=message}
enterButton.addEventListener('click',()=>{
 if(!state.ready||gameStarted)return;
 const r=controller.start();
 if(!r.ok){alertStatus('Бой не удалось начать: '+r.reason);return;}
 gameStarted=true;gamePausedForBriefing=false;
 // Character models now load individually when a reinforcement leaves its base.
 // No eager 24-skeleton load on iPhone.
 briefing.hidden=true;briefing.setAttribute('aria-hidden','true');
 // The first game's combat screen prioritised the battlefield, not a settings panel.
 $('panel').classList.add('closed');
 $('hud-toggle').setAttribute('aria-pressed','false');
 $('hud-toggle').textContent='Меню';
 document.body.classList.add('battle-active');
 atBase=false;state.atBase=false;
 alertStatus('Бой начался: британцы 🔵 против Вермахта 🔴. Касайтесь земли, чтобы управлять героем.');
 drawHud();
});
function position(unit,y=0){
 return new B.Vector3(BASE_X+unit.x*UNIT_SCALE,y+(world?.heightAt?.(unit.x,unit.z)||0),BASE_Z+unit.z*UNIT_SCALE);
}
function color(hex){return B.Color3.FromHexString(hex)}
const graphicsPreference=new URLSearchParams(location.search).get('quality');
const graphicsMode=['low','high','auto'].includes(graphicsPreference)?graphicsPreference:'auto';
const deviceScale=Math.max(1,window.devicePixelRatio||1);
const renderQuality={
 mode:graphicsMode,low:Math.max(1,deviceScale/2.0),
 high:Math.max(1,deviceScale/1.5),fpsElapsed:0,
 scale:Math.max(1,deviceScale/(graphicsMode==='low'?1.15:
  graphicsMode==='high'?2.1:1.7))
};
const qualityLabels={auto:'Авто',low:'Низкое',high:'Высокое'};
function changeGraphicsMode(mode){
 if(!qualityLabels[mode])return;
 renderQuality.mode=mode;
 renderQuality.scale=Math.max(1,deviceScale/(mode==='low'?1.15:
  mode==='high'?2.1:1.7));
 renderQuality.fpsElapsed=0;
 if(engine)engine.setHardwareScalingLevel(renderQuality.scale);
 if(state.graphics){
  state.graphics.mode=mode;
  state.graphics.adaptive=mode==='auto';
  state.graphics.hardwareScale=+renderQuality.scale.toFixed(2);
  state.graphics.changes++;
 }
 const button=$('quality-cycle');
 if(button)button.textContent='Качество: '+qualityLabels[mode];
}
$('quality-cycle')?.addEventListener('click',()=>{
 const modes=['auto','low','high'];
 changeGraphicsMode(modes[(modes.indexOf(renderQuality.mode)+1)%modes.length]);
});
function createWorld(){
 engine=new B.Engine(canvas,true,{powerPreference:'high-performance'});
 engine.setHardwareScalingLevel(renderQuality.scale);
 state.graphics={mode:graphicsMode,hardwareScale:renderQuality.scale,
  adaptive:graphicsMode==='auto',changes:0};
 $('quality-cycle').textContent='Качество: '+qualityLabels[graphicsMode];
 scene=new B.Scene(engine);
 scene.useRightHandedSystem=true;
 scene.skipPointerMovePicking=true;
 scene.clearColor=new B.Color4(.11,.16,.13,1);
 scene.ambientColor=new B.Color3(.25,.29,.23);
 const hemi=new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene);
 hemi.intensity=1.35;
 const sun=new B.DirectionalLight('sun',new B.Vector3(-.5,-1,.3),scene);
 sun.intensity=1.55;sun.diffuse=new B.Color3(1,.94,.83);
 world=worldBuilder.create(scene,B,goldRules.MAP);
 terrain=world.ground;
 void world.loadOriginalBTR().then(info=>{
  world.navigation?.invalidate();
  if(info.ok)console.info('Loaded '+info.loaded+' original wrecked armored cars (Tykryk / CC BY 4.0)');
  else console.warn('Vehicle asset fallback in use',info.error);
 });
 destinationMark=B.MeshBuilder.CreateTorus('destination-marker',{diameter:.75,thickness:.055,tessellation:16},scene);
 destinationMark.rotation.x=Math.PI/2;destinationMark.position.y=.055;
 destinationMark.isVisible=false;destinationMark.isPickable=false;
 const markMaterial=new B.StandardMaterial('destination-mat',scene);
 markMaterial.emissiveColor=color('#eed58b');destinationMark.material=markMaterial;

 // Mirror the FIRST Three.js game's camera: elevated follow, stable heading.
 // Babylon map's northern direction is +Z, so stand behind the blue hero.
 // A higher, wider tactical view keeps the hero readable while exposing cover.
 // Keep the original north-up fixed bearing; thumbstick never turns the camera.
 camera=new B.ArcRotateCamera('camera',Math.PI*1.5,.96,23,
  new B.Vector3(0,1,-107),scene);
 camera.lowerRadiusLimit=22;camera.upperRadiusLimit=24;
 camera.lowerBetaLimit=.92;camera.upperBetaLimit=1.02;
 state.cameraProfile={mode:'elevated-tactical-follow',radius:camera.radius,
  beta:camera.beta,alpha:camera.alpha};
 camera.wheelDeltaPercentage=.013;camera.pinchDeltaPercentage=.012;
 state.visualProfile=legacyVisual?.apply({scene,B,camera,sun,world,ambient:hemi})||null;
 // Real photographed materials and geometry; Babylon skinned soldiers, game AI,
 // colliders, controls and camera remain entirely unchanged.
 if(new URLSearchParams(location.search).get('art')!=='classic'){
  try{
   state.modernArt=modernArt.apply({scene,B,world,camera,sun,map:goldRules.MAP});
   if(villageModels?.install){
    state.villageModels={started:true,loaded:0,pending:3};
    void villageModels.install({scene,B,world,art:state.modernArt}).then(
     result=>{state.villageModels=result},
     error=>{state.villageModels={error:String(error)}});
   }
  }
  catch(error){console.warn('Modern art fallback to native map',error);
   state.modernArt={error:String(error)};}
 }else state.modernArt={profile:'original-babylon',ready:false};
 world.defenses=window.BattlefieldDefenseLayout.create();
 world.field=window.BattlefieldTacticalField.install({B,scene,world,layout:world.defenses,design:window.BattlefieldDefenseLayout});
 state.defenses={trenches:world.defenses.trenches.length,lines:2};
 state.optimization=world.field.optimization;
 world.navigation=window.BattlefieldNavigation.create({obstacles:world.obstacles});
 state.navigation=world.navigation.stats;
 state.vehicleBounds=world.vehicleBounds;
 const artTag=$('graphics-tag');
 if(artTag)artTag.textContent=state.modernArt?.ready?'HD 2026 · PBR · CC0':'ORIGINAL · BABYLON';
 // The first game never let a one-finger drag spin the battlefield.
 // Keep direct touch joystick + tap-to-move; camera is follow-locked.
 camera.detachControl();
 state.controls='first-game-free-walking';
 state.armyBehavior='autonomous-capture-and-magnet';
 scene.onPointerObservable.add(info=>{
  if(info.type!==B.PointerEventTypes.POINTERPICK||!info.pickInfo?.hit)return;
  let mesh=info.pickInfo.pickedMesh;
  while(mesh&&!mesh.metadata?.squadSlot)mesh=mesh.parent;
  if(mesh?.metadata?.squadSlot !== undefined) {
   const slot=Number(mesh.metadata.squadSlot);
   const unit=views[slot]?.unit;
   if(unit?.alive && unit.team==='враг' && controller){
    controller.setFocus(unit);
    alertStatus('Приказ атаковать: '+unit.id);
    drawHud();
   }
   return;
  }
  if(info.pickInfo.pickedMesh===terrain && fieldOrders && state.ready){
   const point=info.pickInfo.pickedPoint;
   if(!point)return;
   if(inputMode==='attack'){
    alertStatus('Выберите врага. Для движения нажмите «Движение».');
    return;
   }
   const x=(point.x-BASE_X)/UNIT_SCALE,z=(point.z-BASE_Z)/UNIT_SCALE;
   const move=fieldOrders.setDestination(x,z);
   if(move.ok){
    destinationMark.position.set(BASE_X+move.destination.x*UNIT_SCALE,.06,
     BASE_Z+move.destination.z*UNIT_SCALE);
    destinationMark.isVisible=true;
    if(gameStarted&&!controller.snapshot().active&&!controller.snapshot().done){
     controller.start();atBase=false;state.atBase=false;
    }
    alertStatus('Приказ: двигаться. Отряд следует за героем.');
   }
  }
 });
 engine.runRenderLoop(frame);
 window.addEventListener('resize',()=>engine.resize());
}
// Squad markers and health bars share faction GPU materials without
// sharing health state, hit boxes, or independent skinned character rigs.
const soldierMaterialCache=new Map();
function factionMat(kind,side,hex,{alpha=1,disableLighting=false}={}){
 const key=kind+'-'+side;
 if(soldierMaterialCache.has(key))return soldierMaterialCache.get(key);
 const m=new B.StandardMaterial('soldier-shared-'+key,scene);
 m.emissiveColor=color(hex);m.alpha=alpha;m.disableLighting=disableLighting;
 soldierMaterialCache.set(key,m);
 return m;
}
function unitVisual(index,entries,{externalModel=null}={}){
 const anchor=new B.TransformNode('soldier-anchor-'+index,scene);
 const root=new B.TransformNode('approved-animated-rig-'+index,scene);
 root.parent=anchor;
 const descendants=[...entries.rootNodes];
 for(const n of entries.rootNodes)descendants.push(...n.getDescendants(false));
 const unique=[...new Set(descendants)];
 const meshes=unique.filter(n=>n instanceof B.AbstractMesh);
 const transforms=unique.filter(n=>n instanceof B.TransformNode);
 const drawable=meshes.filter(m=>m.getTotalVertices?.()>0);
 if(drawable.length<4||!entries.skeletons.some(s=>s.bones.length>=(externalModel?65:60)))
  throw Error('У отряда '+(index+1)+' не обнаружена утверждённая 65-костная модель');
 for(const node of entries.rootNodes)if(!node.parent)node.parent=root;
 const min=new B.Vector3(Infinity,Infinity,Infinity);
 const max=new B.Vector3(-Infinity,-Infinity,-Infinity);
 for(const mesh of drawable){
  mesh.computeWorldMatrix(true);
  const box=mesh.getBoundingInfo().boundingBox;
  min.minimizeInPlace(box.minimumWorld);
  max.maximizeInPlace(box.maximumWorld);
 }
 const height=max.y-min.y;
 if(!Number.isFinite(height)||height<=0)throw Error('Некорректная высота копии солдата');
 const factor=1.8/height;
 root.scaling.setAll(factor);
 root.position.set(-.5*(min.x+max.x)*factor,-min.y*factor,
  -.5*(min.z+max.z)*factor);
 const clips=new Map();
 if(externalModel?.nativeClips){
  const selected=NATIVE_POSES[externalModel.modelId];
  if(!selected)throw Error('Missing native motion map for '+externalModel.modelId);
  for(const id of CLIP_IDS){
   const pose=id.split('_').at(-1);
   const logical=Object.keys(CLIP_POSES).find(p=>CLIP_POSES[p]===pose);
   const clipName=selected[logical];
   const group=entries.animationGroups.find(g=>g.name===clipName||
    g.name.endsWith(clipName)||g.name.startsWith(clipName+'-'));
   if(!group)throw Error('Нет исходной анимации '+clipName+' для '+externalModel.modelId);
   clips.set(id,group);
  }
 }else{
  for(const id of CLIP_IDS){
   const matches=entries.animationGroups.filter(group=>group.name.endsWith(id));
   if(matches.length!==1)throw Error('Отряд '+(index+1)+': отсутствует анимация '+id);
   clips.set(id,matches[0]);
  }
 }
 const marker=B.MeshBuilder.CreateDisc('squad-ring-'+index,{radius:.47,tessellation:24},scene);
 marker.parent=anchor;marker.rotation.x=Math.PI/2;marker.position.y=.025;
 const ringMat=factionMat('ring',index<12?'blue':'red',
  index<12?'#77bcea':'#e98668',{alpha:.75});
 marker.material=ringMat;marker.isPickable=false;
 const hpBack=B.MeshBuilder.CreatePlane('health-bg-'+index,{width:.8,height:.085},scene);
 hpBack.parent=anchor;hpBack.billboardMode=B.Mesh.BILLBOARDMODE_ALL;
 hpBack.position.y=2.08;
 const hpBgMat=factionMat('hp-background','both','#27332a',
  {disableLighting:true});
 hpBack.material=hpBgMat;hpBack.isPickable=false;
 const hpFill=B.MeshBuilder.CreatePlane('health-fill-'+index,{width:.76,height:.061},scene);
 hpFill.parent=anchor;hpFill.billboardMode=B.Mesh.BILLBOARDMODE_ALL;
 hpFill.position.y=2.081;hpFill.position.z=-.01;
 const hpMat=factionMat('hp-fill',index<12?'blue':'red',
  index<12?'#8bdaa0':'#e78f6b',{disableLighting:true});hpFill.material=hpMat;hpFill.isPickable=false;
 for(const mesh of drawable)mesh.metadata={...(mesh.metadata||{}),squadSlot:index};
 return {index,faction:factions.sideForSlot(index),
  chosenAlliedModel:index<12?(FEATURE_REAL_ALLIES?featureCasting(index):alliedModels.forBlueSlot(index).id):null,
  importedAlliedModel:!!externalModel,
  importedAlliedName:externalModel?.modelId||null,
  nativeAlliedClips:!!externalModel?.nativeClips,
  anchor,root,entries,clips,imported:{
  meshes,transformNodes:transforms,skeletons:entries.skeletons,
  animationGroups:entries.animationGroups
 },unit:null,rig:null,clip:null,weapon:'Kar98k',lastPose:null,
  inactive:true,marker,hpBack,hpFill,healthMaterial:hpMat,
  hitEffect:0,animationChanges:0,weaponError:null};
}
const SCENE_SLOTS={
 duel:[0,12],assault:[0,12,13,14,15],
 squads:Array.from({length:24},(_,i)=>i)
};
// Prevent racing initial 12v12 load and a rapidly tapped scenario button.
// A second request rechecks slots after the first has finished, without
// instantiating overlapping skeletons or double-counting soldier models.
let ensureUnitsInFlight=null;
async function ensureUnits(scenarioName){
 while(ensureUnitsInFlight){try{await ensureUnitsInFlight;}catch(_){/* retry next slot */}}
 const task=ensureUnitsUnlocked(scenarioName);
 ensureUnitsInFlight=task;
 try{return await task;}
 finally{if(ensureUnitsInFlight===task)ensureUnitsInFlight=null;}
}
async function ensureUnitsUnlocked(scenarioName){
 const slots=Array.isArray(scenarioName)?scenarioName:SCENE_SLOTS[scenarioName];
 if(!slots)throw Error('Неизвестный режим отряда: '+scenarioName);
 if(!asset){
  $('loading').textContent='Загружаю анимированного немецкого стрелка…';
  asset=await B.SceneLoader.LoadAssetContainerAsync(
   './animstudio-preview/models/','all-combat-run.glb',scene);
  motionDonors.germanRun=unitMotion?.findGroup(asset.animationGroups,'Kar98k_Run')||null;
  if(asset.animationGroups.length<16)
   throw Error('В GLB отсутствуют 16 согласованных боевых анимаций');
 }
 if(!modelDepot&&Date.now()>=modelDepotRetryAfter){
  modelDepot=alliedLoader.create({B,scene,catalog:alliedModels,
   sourceGroups:asset.animationGroups,featureTrial:FEATURE_REAL_ALLIES});
  try{
   state.alliedManifest=await modelDepot.init();
  }catch(error){
   state.modelErrors.manifest=String(error?.message||error);
   // Missing manifest does not make 12v12 unplayable; no false model import.
   console.warn('Allied GLB manifest unavailable; source models not installed',error);
   modelDepot=null;
   modelDepotRetryAfter=Date.now()+30000;
   state.engineering.assetRetries++;
  }
 }
 for(const i of slots){
  if(views[i])continue;
  $('loading').textContent='Загружаю бойцов: '+state.models+'/'+slots.length+
   ' · создание №'+(i+1);
  // Preserve exact Mixamo joint names in clone-local hierarchies for IK.
  let externalModel=null;
  if(i<12&&modelDepot){
   const selected=FEATURE_REAL_ALLIES?featureCasting(i):alliedModels.forBlueSlot(i).id;
   try{
    externalModel=await modelDepot.instantiate(selected,i);
   }catch(error){
    state.modelErrors[selected]=String(error?.message||error);
    state.engineering.glbFallbacks++;
    console.error('Allied licensed model rejected',selected,error);
   }
  }
  // Retarget Jakeli READY only after its original native rig is available.
  if(externalModel?.modelId==='britishJakeli'&&!motionDonors.britishReady){
   motionDonors.britishReady=unitMotion?.findGroup(externalModel.entries.animationGroups,'Ready')||null;
   if(motionDonors.britishReady)for(const previous of views.filter(Boolean))
    promoteUnitMotion(previous);
  }
  // No invented download: if the original licensed file is missing, only
  // the explicitly labelled pre-existing prototype is available.
  // Record the real GLB identity (or a clearly marked fallback) per squad slot.
   const sourceReport=characters.audit(i,externalModel);
   const entries=externalModel?.entries||asset.instantiateModelsToScene(
   name=>name,false,{doNotInstantiate:true});
  const view=unitVisual(i,entries,{externalModel});
  // This is the SAME original German rig as the approved soldier-only lab.
  // Transfer its tested leg-only native Run into the actual Babylon squad.
  // Never overwrite American/UK authored animation tracks or weapon grips.
  if(!externalModel&&unitMotion?.installNativeGermanLegRun){
   const local=unitMotion.installNativeGermanLegRun(view,{B,scene});
   state.unitMotionReports[i]={nativeGermanRun:local.ok?
    'seven-leg-tracks':String(local.reason)};
   if(!local.ok)console.warn('Original German run fallback',i,local.reason);
  }
  promoteUnitMotion(view);
  if(view.faction==='british'&&!externalModel){
   // These are ORIGINAL procedural placeholders, not new skins. Commando
   // stays blocked until its previously selected source is actually acquired.
   const soldier=britishSoldier.create({B,scene,view});
   if(!soldier.applied)throw Error('Temporary British prototype: '+soldier.reason);
  }
  if(externalModel)state.importedAlliedCount++;
  // A shared skeleton or shared track would animate two actors at once.
  for(const prev of views.filter(Boolean)){
   if(prev.imported.skeletons[0]===view.imported.skeletons[0])
    throw Error('У бойцов общий скелет: клонирование отклонено');
   const clipA=prev.clips.get('Kar98k_Run');
   const clipB=view.clips.get('Kar98k_Run');
   if(!clipA||!clipB)throw Error('No squad run animation for comparison');
   if(clipA===clipB ||
      clipA.targetedAnimations[0]?.target===clipB.targetedAnimations[0]?.target)
    throw Error('У бойцов общая анимация бега');
  }
  // A soldier's existing GLB + 16 clips render without weapon IK.
  // Do not block the *entire game* on several 1.7 MB rifle loads or IK errors.
  view.rig={combatPose:{active:false,stage:'ready',crouch:0,recoilPulse:0}};
  view.anchor.setEnabled(false);
  views[i]=view;state.actorSources[i]=sourceReport;
   state.models++;state.clips+=new Set(view.clips.values()).size;
  weaponQueue.push(view);
  const unit=i<12?allies[i]:enemies[i-12];
  if(state.ready&&unit?.alive){
   unit.characterModelImported=!!externalModel;
   assignView(view,unit);actors.set(unit,view);
  }
  // Allow browser to paint loading progress on mobile between clones.
  await new Promise(resolve=>requestAnimationFrame(resolve));
 }
 $('loading').textContent='Готово: '+state.models+
  ' анимированных бойцов · выберите режим и нажмите «Начать бой»';
}
async function processWeaponQueue(){
 if(weaponWorker||!state.ready)return;
 weaponWorker=true;
 try{
  while(weaponQueue.length){
   // Stream visible guns before reserve models; mobile start stays responsive.
   const liveIndex=weaponQueue.findIndex(v=>v?.unit?.alive&&!v.rig?.weaponRigReady);
   const view=liveIndex>=0?weaponQueue.splice(liveIndex,1)[0]:weaponQueue.shift();
   state.engineering.pendingWeaponAssets=weaponQueue.length;
   if(!view||!view.rig||view.rig.weaponRigReady)continue;
   try{
    const rig=view.rig;
    if(view.nativeAlliedClips&&view.importedAlliedName==='americanHero'){
     const maker=window.BattlefieldUSLeeEnfieldStage4;
     if(typeof maker?.create!=='function')
      throw Error('Approved American four-weapon grip controller missing');
     const realGrip=await maker.create({
      scene,imported:view.imported,stage:view.root,
      weaponRoot:'../assets/ww2-weapons/',
      initialWeaponId:weaponAsset(view,view.unit?.weapon||view.weapon)
     });
     rig.weaponRigReady=true;
     rig.nativeGrip=realGrip;
     rig.equipWeapon=id=>realGrip.equipWeapon(id);
     rig.weaponRig={get weapon(){return realGrip.state?.weaponId||null}};
     rig.getMuzzleWorld=()=>realGrip.getMuzzleWorld();
     view.weaponError=null;
     continue;
    }
    if(view.nativeAlliedClips&&view.importedAlliedName==='britishJakeli'){
     // The exact pre-baked Lee-Enfield rig has physically checked hand
     // contact. Legacy German IK would deform this licensed British mesh.
     // Do not attach a second rifle or overwrite the approved pose.
     rig.weaponRigReady=true;
     rig.nativeBakedWeapon=true;
     view.weaponError=null;
     continue;
    }
    await window.BattlefieldWeaponRig.create({
     scene,imported:view.imported,root:view.root,state:rig,
     animationDriven:true,bindUI:false,acceptExportSockets:true,
     allowRetargetedSkeleton:view.importedAlliedModel,
     initialWeaponId:weaponAsset(view,view.unit?.weapon||view.weapon),
     weaponRoot:'../assets/ww2-weapons/'
    });
    if(!rig.weaponRigReady)throw Error('Двухручный IK не подготовлен');
    configureGermanRifleCarry(view,view.lastPose||'ready');
    rig.setWeaponPose?.(view.lastPose||'ready');
    const wanted=view.unit?.weapon||view.weapon;
    if(rig.weaponRig?.weapon!==weaponAsset(view,wanted)&&rig.equipWeapon)
     await rig.equipWeapon(weaponAsset(view,wanted));
    view.weaponError=null;
    if(view.importedAlliedModel){
     // Sample after the IK render observer has run. A numerical PASS does
     // not replace the final close-up visual acceptance on iPhone.
     const assessment=modelDepot.gripAssessment(rig.weaponRig,
      weaponAsset(view,wanted));
     view.gripStatus=assessment;
     if(!assessment.ok)console.warn('Allied hand sockets pending QA',
      view.importedAlliedName,assessment.reason);
    }
   }catch(error){
    state.engineering.weaponFailures=(state.engineering.weaponFailures||0)+1;
    // The animated approved soldier stays visible and game logic works.
    view.weaponError=String(error?.message||error);
    console.error('Weapon model for soldier '+(view.index+1),error);
    if(view.index===0)
     alertStatus('Боец загружен, но оружейный IK недоступен: '+view.weaponError);
   }
   // British body follows the same Mixamo animations. Start observer after
   // weapon IK so the new bare hands track its corrected wrist pose.
   if(view.britishSoldier?.applied)view.britishSoldier.start();
   // Keep the UI responsive between expensive weapon imports on mobile.
   await new Promise(resolve=>requestAnimationFrame(resolve));
  }
 }finally{weaponWorker=false;}
}
async function chooseScenario(name){
 if(starting||!state.ready)return;
 starting=true;
 for(const button of document.querySelectorAll('button'))button.disabled=true;
 try{
  await ensureUnits(name==='squads'?'duel':name);
  setup(name);
  void processWeaponQueue();
  const launch=gameStarted?controller.start():{ok:false};
  if(launch.ok){atBase=false;state.atBase=false;}
  alertStatus('Подкрепление прибыло. Нажмите на землю, чтобы управлять отрядом.');
 }catch(error){
  state.error=String(error?.stack||error);
  $('loading').textContent='Не удалось добавить отряд: '+(error?.message||error);
  alertStatus('Подкрепление не загрузилось. Герой остаётся доступен для управления.');
  console.error('Squad load',error);
 }finally{
  starting=false;
  for(const button of document.querySelectorAll('button'))button.disabled=false;
  drawHud();
 }
}
function stopAnimations(view){
 nativeBlend.stop(view);
}
function configureGermanRifleCarry(view,pose){
 const rig=view?.rig;
 if(!rig)return;
 const originalRifle=!!view.nativeGermanLegsRun&&
  !view.importedAlliedModel&&rig.weaponRig?.weapon==='de-kar98k';
 // Only the approved German Kar98k receives the validated ~horizontal
 // run carry and the anatomically measured 2-hand finger curl.
 // MP40, MG42, launchers and allied rigs retain their existing controllers.
 rig.weaponMotionRunCarryTest=originalRifle;
 rig.weaponMotionRun=originalRifle&&pose==='run';
 rig.weaponMotionRightWristMax=originalRifle&&pose==='run'?120:55;
 rig.weaponMotionGripDebug=originalRifle&&pose==='run'?'reverseAxisX':null;
}
function setClip(view,pose){
 configureGermanRifleCarry(view,pose);
 const id=view.weapon+'_'+CLIP_POSES[pose];
 const target=view.clips.get(id);
 if(!target){
  view.weaponError='Нет готовой анимации '+id;
  throw Error(view.weaponError);
 }
 const didChange=nativeBlend.play(view,target,pose,{loop:pose!=='fire'||view.nativeAlliedClips&&view.importedAlliedName==='americanHero'});
 if(didChange)view.rig?.setWeaponPose?.(pose);
}
function assignView(view,unit){
 view.unit=unit;view.inactive=!unit;
 if(!unit){
  stopAnimations(view);
  view.anchor.setEnabled(false);
  return;
 }
 view.weapon='Kar98k';
 view.lastUnitX=unit.x;view.lastUnitZ=unit.z;
 view.anchor.setEnabled(true);
 view.anchor.position.copyFrom(position(unit));
 view.anchor.rotation.y=unit.team==='враг'?-Math.PI/2:Math.PI/2;
 view.hpFill.scaling.x=1;view.hpFill.position.x=0;
 view.marker.setEnabled(true);
 stopAnimations(view);
 setClip(view,'ready');
 view.rig.combatPose={active:false,stage:'ready',crouch:0,recoilPulse:0};
 // Approved rig starts with Kar98k loaded; avoid duplicate requests.
}
// Lightweight session objectives are earned through real combat/capture,
 // not daily login gates, advertising, paywalls, or duplicated army gold.
const SESSION_OBJECTIVES=Object.freeze([
 {kind:'kills',target:1,title:'Первое устранение'},
 {kind:'farms',target:1,title:'Первая ферма'},
 {kind:'kills',target:3,title:'Три устранения'},
 {kind:'farms',target:3,title:'Удержать три фермы'}
]);
let missionIndex=0;
function advanceObjectives(hero,econ){
 let advanced=false;
 while(missionIndex<SESSION_OBJECTIVES.length){
  const task=SESSION_OBJECTIVES[missionIndex];
  const progress=task.kind==='kills'?hero.kills:(econ?.owners?.blue?.length||0);
  if(progress<task.target)break;
  missionIndex++;advanced=true;
 }
 const task=SESSION_OBJECTIVES[missionIndex];
 const progress=task?(task.kind==='kills'?hero.kills:
  econ?.owners?.blue?.length||0):SESSION_OBJECTIVES.length;
 state.mission={completed:missionIndex,total:SESSION_OBJECTIVES.length,
  current:task?.title||'Все цели выполнены',progress,
  target:task?.target||SESSION_OBJECTIVES.length,finished:!task};
 if(advanced&&gameStarted)alertStatus(task?
  'Задача выполнена! Следующая: '+task.title:
  'Все боевые задачи выполнены! Продолжайте защищать фермы.');
 return state.mission;
}
function setup(scenarioName){
 if(!state.ready)return;
 if(!SCENARIOS[scenarioName])throw Error('Unknown scenario');
 controller?.stop();
 replenisher?.stop();replenisher=null;
 reinforcementEpoch++;
 scenario=scenarioName;atBase=true;
 missionIndex=0;state.mission={completed:0,total:SESSION_OBJECTIVES.length,
  current:SESSION_OBJECTIVES[0].title,progress:0,target:1,finished:false};
 if(destinationMark)destinationMark.isVisible=false;
 state.scenario=scenario;state.atBase=true;state.focus=null;
 const [ours,theirs]=SCENARIOS[scenario];
 economy=goldRules.create({onEvent:event=>{
  if(event.type==='central-countdown-start')
   alertStatus('Первый бот погиб! До открытия центральной фермы — 05:00.');
  if(event.type==='central-open')
   alertStatus('ЦЕНТРАЛЬНАЯ ФЕРМА ОТКРЫТА! Захватите её ради большого золота.');
 }});
 lastEconomyBlue=economy.treasury.blue;
 battle=combat.createBattle({funds:goldRules.START_TREASURY,prices:PRICES});
 allies=[];enemies=[];
 // Symmetric army deployments around each approved base; one hero + 11 bots.
 const alliesXY=Array.from({length:ours},(_,i)=>{
  if(i===0)return {x:150,z:43};
  const n=i-1;
  return {x:150+(n%4-1.5)*6,z:32+Math.floor(n/4)*4};
 });
 const enemiesXY=Array.from({length:theirs},(_,i)=>({
  x:150+(i%4-1.5)*6,z:267-Math.floor(i/4)*4
 }));
 for(let i=0;i<ours;i++){
  const unit=battle.addUnit({id:i===0?'hero':'британец-'+(i+1),
   team:'свои',...alliesXY[i]});
  if(scenario==='squads'&&i>0)unit.alive=false;
  unit.reinforcementSlot=i;
  allies.push(unit);
 }
 for(let i=0;i<theirs;i++){
  const unit=battle.addUnit({id:'вермахт-'+(i+1),
   team:'враг',...enemiesXY[i]});
  if(scenario==='squads'&&i>0)unit.alive=false;
  unit.reinforcementSlot=i+12;
  enemies.push(unit);
 }
 for(const [i,u] of allies.entries()){
  u.economyTeam='blue';u.isHero=i===0;
  // Selected casting, not a claim that original asset has been imported.
  u.characterModel=views[i]?.chosenAlliedModel||alliedModels.forBlueSlot(i).id;
  u.characterModelImported=!!views[i]?.importedAlliedModel;
  u.spawn={x:u.x,z:u.z};
 }
 for(const u of enemies){u.economyTeam='red';u.spawn={x:u.x,z:u.z};}
 for(const u of [...allies,...enemies]){const safe=world.navigation.nearestFree(u);if(safe){u.x=safe.x;u.z=safe.z;u.spawn={...safe};}}
 tacticalAI=window.BattlefieldTacticalAI.create({layout:world.defenses,navigation:world.navigation,design:window.BattlefieldDefenseLayout});
 support=window.BattlefieldEmplacements.create({definitions:world.defenses.emplacements,allies,enemies,battle,navigation:world.navigation,
  coverFor:(u,a)=>window.BattlefieldDefenseLayout.coverAt(world.defenses,u,a),
  onShot:drawShot});
 fieldOrders=orders.create({hero:allies[0],allies,enemies,
  farms:economy.farms,navigation:world.navigation,support,tactical:tacticalAI,
  centralOpen:()=>economy.summary().central.open,
  onArrive:()=>{if(destinationMark)destinationMark.isVisible=false;}
 });
 controller=tactics.create({battle,allies,enemies,driveAllies:dt=>fieldOrders.updateAllies(dt),driveEnemies:dt=>fieldOrders.updateEnemies(dt),endWhenEliminated:scenario!=='squads',
  canFire:u=>!support.operating(u),
  lineOfSight:(a,b)=>world.navigation.lineOfSight(a,b),
  coverFor:(u,a)=>window.BattlefieldDefenseLayout.coverAt(world.defenses,u,a),
  onShot:drawShot,
  onFinish:result=>alertStatus(result.winner==='allies'?
   'Победа! Отряд удержал позицию. Нажмите «Новый бой» для продолжения.':
   'Отряд разгромлен. Нажмите «Новый бой», чтобы повторить атаку.')
 });
 if(scenario==='squads'){
  replenisher=replenishment.create({allies,enemies,hero:allies[0],
   maxAlivePerSide:REINFORCEMENT_LIMIT});
  state.reinforcements=replenisher.snapshot();
 }else state.reinforcements=null;
 actors=new Map();
 for(let i=0;i<12;i++){
  if(views[i]){
   assignView(views[i],allies[i]?.alive?allies[i]:null);
   if(allies[i])allies[i].characterModelImported=views[i].importedAlliedModel;
  }
  if(views[i]&&allies[i]?.alive)actors.set(allies[i],views[i]);
 }
 for(let i=0;i<12;i++){
  if(views[i+12])assignView(views[i+12],enemies[i]?.alive?enemies[i]:null);
  if(views[i+12]&&enemies[i]?.alive)actors.set(enemies[i],views[i+12]);
 }
 for(const button of document.querySelectorAll('[data-scenario]'))
  button.setAttribute('aria-pressed',String(button.dataset.scenario===scenario));
 state.selected='Kar98k';
 alertStatus('Готов к приказам. Нажмите на землю, чтобы бежать; на врага — атаковать.');
 drawHud();
}
function findActor(){return allies[0]||null}
function addEffect(mesh,ttl,material=null,pooled=null){
 fx.push({mesh,ttl,material,pooled});
}
function drawTracer(start,impact,colour,ttl){
 let slot=tracerPool.find(t=>!t.active);
 if(!slot){
  if(tracerPool.length>=TRACER_LIMIT){
   state.engineering.droppedTracerVisuals=
    (state.engineering.droppedTracerVisuals||0)+1;
   return; // Drop a VISUAL under load, never a real hit or its damage.
  }
  const mesh=B.MeshBuilder.CreateLines('tracer-pooled',{
   points:[start,impact],updatable:true},scene);
  slot={mesh,active:false};tracerPool.push(slot);
 }else B.MeshBuilder.CreateLines('tracer-pooled',{
  points:[start,impact],instance:slot.mesh},scene);
 slot.mesh.color=colour;slot.mesh.isPickable=false;
 slot.mesh.setEnabled(true);slot.active=true;
 addEffect(slot.mesh,ttl,null,slot);
 state.engineering.tracerPoolSize=tracerPool.length;
}
function drawShot({unit,target,result,mount}){
 // Bounties are credited to the killer's army; the hero also earns
 // personal gold, exactly as in the original Three.js economy.
 if(economy && result.hits?.length){
  for(const hit of result.hits){
   if(hit.hp>0)continue;
   const victim=[...allies,...enemies].find(u=>u.id===hit.id);
   if(victim&&!victim.alive){
    // A hero dying must not start the countdown. Either army's first
    // dead BOT starts exactly one five-minute game-time timer.
    economy.reportBotDeath(victim);
    economy.kill(unit.economyTeam,{team:victim.economyTeam},
     {heroKill:unit.isHero,armoured:false});
   }
  }
 }
 if(mount?.kind==='cannon'&&result.phase==='launch'){
  const start=position({x:mount.x+Math.sin(mount.yaw)*2.5,z:mount.z+Math.cos(mount.yaw)*2.5},1.25),end=position(result.impact,.25);
  const shell=B.MeshBuilder.CreateSphere('field-shell',{diameter:.23,segments:6},scene);
  const mat=new B.StandardMaterial('field-shell-glow',scene);mat.emissiveColor=color('#e2ac63');shell.material=mat;shell.isPickable=false;
  addEffect(shell,result.duration,mat);fx[fx.length-1].flight={start,end,duration:result.duration};return;
 }
 const source=actors.get(unit),targetView=actors.get(target);
 if(!source||!targetView)return;
 const muzzle=source.rig?.getMuzzleWorld?.()?.position||
  source.rig?.weaponRig?.muzzleWorldPosition;
 const start=mount?position({x:mount.x+Math.sin(mount.yaw)*1.65,z:mount.z+Math.cos(mount.yaw)*1.65},1.3):Array.isArray(muzzle)&&muzzle.length===3 ?
  new B.Vector3(...muzzle):source.anchor.position.add(new B.Vector3(0,1.5,0));
 const impact=result.impact?position(result.impact,.7):
  targetView.anchor.position.add(new B.Vector3(0,1.15,0));
 if(!result.hit&&!result.impact)impact.z+=(Math.random()-.5)*1.4;
 if(result.phase!=='impact')drawTracer(start,impact,result.weapon==='Panzerschreck'?color('#ff9945'):
  color(unit.team==='свои'?'#ffe5a0':'#ff866f'),
  result.weapon==='Panzerschreck'?.24:.095);
 if(result.weapon==='Panzerschreck'){
  const diameter=(result.blastRadius||combat.WEAPONS.Panzerschreck.blastRadius)*UNIT_SCALE*2;
  const sphere=B.MeshBuilder.CreateSphere('blast',{diameter,segments:10},scene);
  sphere.position.copyFrom(impact);
  const mat=new B.StandardMaterial('blast glow',scene);
  mat.emissiveColor=color('#fd7a2d');mat.alpha=.45;
  sphere.material=mat;sphere.isPickable=false;
  addEffect(sphere,.30,mat);
 }
 if(unit===findActor()){
  const hit=result.hits.length?result.hits.map(h=>h.id+' −'+h.damage+' HP').join(', '):
   'промах';
  alertStatus(britishLabel(result.weapon)+': '+hit+(result.lethal?' · СМЕРТЕЛЬНЫЙ ВЫСТРЕЛ':''));
 }
}
function syncVisual(view){
 const unit=view.unit;
 if(!unit)return;
 if(!unit.alive){
  if(view.inactive)return; // Dead rig was previously stopped every frame.
  view.inactive=true;
  view.marker.setEnabled(false);
  view.hpBack.setEnabled(false);
  view.hpFill.setEnabled(false);
  view.anchor.setEnabled(false);
  stopAnimations(view);
  return;
 }
 view.inactive=false;
 view.anchor.setEnabled(true);view.marker.setEnabled(true);
 view.hpBack.setEnabled(true);view.hpFill.setEnabled(true);
 const nextHP=Math.max(0,unit.hp/unit.maxHp);
 view.hpFill.scaling.x=Math.max(.001,nextHP);
 view.hpFill.position.x=-.38*(1-nextHP);
 view.anchor.position.copyFrom(position(unit));
 const target=controller?.getTarget(unit);
 const dx=unit.x-(view.lastUnitX??unit.x);
 const dz=unit.z-(view.lastUnitZ??unit.z);
 const moving=controller?.isMoving(unit);
 // Face the direction of actual movement. Previously every autonomous unit
 // ran sideways while staring at an enemy hundreds of metres away.
 if(moving && Math.hypot(dx,dz)>.005){
  view.anchor.rotation.y=Math.atan2(dx,dz);
 }else if(target && Math.hypot(target.x-unit.x,target.z-unit.z)<42){
  view.anchor.rotation.y=Math.atan2(target.x-unit.x,target.z-unit.z);
 }
 view.lastUnitX=unit.x;view.lastUnitZ=unit.z;
 if(unit.weapon!==view.weapon){
  view.weapon=unit.weapon;
  view.lastPose=null; // Force matching animation after fallback.
  if(view.rig?.equipWeapon){
   view.rig.equipWeapon(weaponAsset(view,unit.weapon)).catch(error=>{
    view.weaponError=String(error);
    alertStatus('Оружие не загрузилось: '+error);
   });
  }
 }
 const visual=presentation.describe(unit,{active:!!controller?.snapshot().active,
  moving:controller?.isMoving(unit),shotAge:controller?.shotAge(unit)});
 if(view.lastPose!==visual.pose)setClip(view,visual.pose);
 view.rig.combatPose={active:visual.running||visual.firing,stage:visual.stage,
  crouch:0,recoilPulse:visual.recoilPulse};
 if(visual.stage==='reload'&&view.lastPose==='fire')
  throw Error('Reload incorrectly displaying Fire animation');
}
function drawMiniMap(econ){
 const map=$('battle-minimap');
 if(!map)return;
 const c=map.getContext('2d');
 if(!c)return;
 // Draw logical 116px into a higher-DPI canvas for readable iPhone map.
 const W=116,H=116,dpi=map.width/W;
 c.setTransform(dpi,0,0,dpi,0,0);
 const xy=(x,z)=>[x/300*W,H-z/300*H];
 c.fillStyle='#303b2c';c.fillRect(0,0,W,H);
 c.strokeStyle='#786b4c';c.lineWidth=4;
 c.beginPath();c.moveTo(W/2,0);c.lineTo(W/2,H);c.moveTo(0,H/2);c.lineTo(W,H/2);c.stroke();
 for(const t of world.defenses.trenches){const [x1,y]=xy(t.a,t.z),[x2]=xy(t.b,t.z);c.strokeStyle=t.team==='blue'?'#7398a3':'#ad8173';c.lineWidth=1.5;c.beginPath();c.moveTo(x1,y);c.lineTo(x2,y);c.stroke();}
 for(const m of support?.snapshot()||[]){const [x,y]=xy(m.x,m.z);c.strokeStyle=m.team==='blue'?'#a0d3e5':'#e5a08c';c.lineWidth=1;c.strokeRect(x-1.7,y-1.7,3.4,3.4);}
 // Bases and gold farms are visible without covering the live battlefield.
 for(const base of goldRules.MAP.bases){
  const [x,y]=xy(base.x,base.z);
  c.fillStyle=base.team==='blue'?'#83b8db':'#d57868';
  c.fillRect(x-4,y-4,8,8);
 }
 for(const farm of (econ?.farms||goldRules.MAP.farms)){
  const [x,y]=xy(farm.x,farm.z);
  c.fillStyle=farm.owner==='blue'?'#76b6db':farm.owner==='red'?'#dc8269':'#e7c771';
  c.fillRect(x-2.3,y-2.3,4.6,4.6);
 }
 for(const army of [enemies,allies]){
  const isBlue=army===allies;
  c.fillStyle=isBlue?'#9bdaff':'#f18d7b';
  for(const unit of army){
   if(!unit?.alive)continue;
   const [x,y]=xy(unit.x,unit.z);
   c.beginPath();c.arc(x,y,1.6,0,Math.PI*2);c.fill();
  }
 }
 const hero=findActor();
 if(hero?.alive){
  const [x,y]=xy(hero.x,hero.z);
  c.strokeStyle='#fff6d0';c.lineWidth=1.6;
  c.beginPath();c.arc(x,y,4.1,0,Math.PI*2);c.stroke();
 }
}
function drawHud(){
 if(!state.ready||!battle||!controller)return;
 const hero=findActor();
 const snap=controller.snapshot();
 state.firstGameArmy=fieldOrders?.snapshot()||null;
 state.emplacements=support?.snapshot()||[];
 state.tactical=tacticalAI?.snapshot();
 state.heroCover=window.BattlefieldDefenseLayout.coverAt(world.defenses,hero,controller.getTarget(hero));
 state.heroPosition={x:hero.x,z:hero.z};
 state.cameraPosition=camera?{radius:camera.radius,alpha:camera.alpha,
  beta:camera.beta,targetX:camera.target.x,targetZ:camera.target.z}:null;
 const inventory=hero.weapon==='Kar98k'?null:hero.inventory[hero.weapon];
 const funds=battle.getFunds();
 const econ=economy?.summary();
 const mission=advanceObjectives(hero,econ);
 const central=econ?.central;
 const left=central?.started?Math.ceil(central.remainingSeconds):0;
 const timerLabel=central?.open?'ОТКРЫТА':
  central?.started?'Откроется через '+String(Math.floor(left/60)).padStart(2,'0')+
   ':'+String(left%60).padStart(2,'0'):
   'ЗАКРЫТА — ждём гибель первого бота';
 $('fight').textContent=atBase?'▶ Продолжить бой':'Ⅱ Пауза / снаряжение';
 $('supply').disabled=!atBase||!hero.alive;
 $('reload-manual').disabled=!hero.alive||hero.weapon==='Kar98k'||
  hero.reloadRemaining>0||!hero.inventory[hero.weapon]?.reserve||
  hero.inventory[hero.weapon]?.loaded>=combat.WEAPONS[hero.weapon].magazineSize;
 for(const button of document.querySelectorAll('[data-weapon]'))
  button.setAttribute('aria-pressed',String(hero.weapon===button.dataset.weapon));
 const paid=Object.keys(hero.inventory).map(w=>w+':'+battle.totalAmmo(hero,w)).join(' · ');
 $('readout').textContent=
  'Бой: '+(snap.active?'ИДЁТ':snap.done?'ЗАВЕРШЁН':'ОЖИДАНИЕ')+
  ' · британцы '+snap.alliesAlive+'/'+(state.reinforcements?.maxAlivePerSide||allies.length)+' · Вермахт '+snap.enemiesAlive+'/'+(state.reinforcements?.maxAlivePerSide||enemies.length)+
  '\nГерой 🇺🇸 ('+(hero.characterModelImported?'модель загружена':'3D-файл ещё не получен')+'): '+Math.round(hero.hp)+'/100 HP · оружие: '+britishLabel(hero.weapon)+
  (inventory?' · '+inventory.loaded+'+'+inventory.reserve+' патр.':' · ∞ патронов')+
  (hero.reloadRemaining>0?'\nПерезарядка: '+hero.reloadRemaining.toFixed(1)+' c':'')+
  '\nБританцы 🔵: '+funds+' · Вермахт 🔴: '+(econ?.treasury.red??'—')+
  '\nФермы: '+(econ?.owners.blue.length||0)+' синих · '+(econ?.owners.red.length||0)+' красных'+
  '\nЦентр: '+timerLabel+
  (paid?'\nЗапас: '+paid:'')+
  '\nСтрой: '+(fieldOrders?.snapshot().mode==='semicircle'?'боевой полукруг':'черепаха')+
  '\nАрмия: охрана героя '+(state.firstGameArmy?.aliveGuards||0)+
   ' · самостоятельные 🔵 '+(state.firstGameArmy?.autonomousBlue||0)+
   ' / 🔴 '+(state.firstGameArmy?.autonomousRed||0)+
  '\nВыстрелы героя: '+hero.shots+' · поражено: '+hero.kills+
  '\nЗадача: '+mission.current+
   (mission.finished?' ✓':' · '+Math.min(mission.progress,mission.target)+
    '/'+mission.target)+' · награды: '+mission.completed+'/'+mission.total+
  (state.reinforcements?'\nПополнение каждые 1,4 с · лимит '+REINFORCEMENT_LIMIT+' на сторону'+
    '\nЗа бой прибыло: 🔵 '+state.reinforcements.totalBlueReinforced+
    ' · 🔴 '+state.reinforcements.totalRedReinforced:'')+
  '\nИмпортировано союзных GLB (эксперимент): '+state.importedAlliedCount+'/12'+
   '\nНемец: утверждён · Герой: '+(state.actorSources[0]?.realModelLoaded?'загружен':'нет GLB')+
   ' · Jakeli: '+(Object.values(state.actorSources).some(r=>r.id==='britishJakeli'&&r.realModelLoaded)?'импортирован, деформация требует приёмки':'ожидает загрузки')+
  '\nFPS: '+Math.round(engine.getFps())+
  (snap.focus?'\nПриоритетная цель: '+snap.focus:'');
 const duration=combat.WEAPONS[hero.reloadWeapon]?.reloadSeconds||0;
 const progress=duration?100*(1-hero.reloadRemaining/duration):0;
 $('reload-fill').style.width=Math.max(0,Math.min(100,progress))+'%';
 state.fps=Math.round(engine.getFps());
 drawMiniMap(econ);
 const short=$('quick-status');
 if(short)short.textContent='HP '+Math.round(hero.hp)+' · Золото '+funds+
  (state.heroCover?' · Укрытие '+Math.round(state.heroCover*100)+'%':'')+(hero.suppressed>0?' · Подавлен':'')+
  ' · 🔵 '+snap.alliesAlive+' : '+snap.enemiesAlive+' 🔴'+(state.reinforcements?' · ⟳':'');
 const pause=$('quick-pause');
 if(pause)pause.textContent=atBase?'▶':'Ⅱ';
}
async function chooseGun(weapon){
 const hero=findActor();
 if(!state.ready||!hero||!combat.WEAPONS[weapon]||!hero.alive)return;
 let result;
 if(weapon==='Kar98k'||hero.inventory[weapon])result=battle.switchWeapon(hero,weapon);
 else result=battle.buyWeapon(hero,weapon,{atBase});
 if(!result.ok){
  alertStatus(result.reason==='return-to-base'?'Оружие покупается на базе.':
   result.reason==='insufficient-funds'?'Недостаточно денег.':
   'Не удалось выбрать оружие: '+result.reason);
  return;
 }
 if(economy&&result.cost>0){
  if(!economy.pay('blue',result.cost))
   throw Error('Несоответствие игровой казны стоимости оружия');
  lastEconomyBlue=economy.treasury.blue;
 }
 state.selected=weapon;
 const visual=actors.get(hero);
 if(visual){
  visual.weapon=weapon;
  if(visual.rig?.equipWeapon){
   await visual.rig.equipWeapon(weaponAsset(visual,weapon)).catch(e=>{
    visual.weaponError=String(e);alertStatus('Ошибка модели оружия: '+e);
   });
  }
  const snapshot=presentation.describe(hero);
  setClip(visual,snapshot.pose);
 }
 alertStatus('Боец вооружён: '+britishLabel(weapon)+' · БК '+(battle.totalAmmo(hero,weapon)||'∞'));
 drawHud();
}
function resupplyHero(){
 const hero=findActor();
 const last=state.selected!=='Kar98k'?state.selected:
  Object.keys(hero.inventory)[0];
 if(!last){alertStatus('Бесплатной Kar98k боеприпасы не требуются.');return;}
 const result=battle.resupply(hero,last,{atBase});
 if(!result.ok){alertStatus('БК не пополнен: '+result.reason);return;}
 if(economy&&result.cost>0){
  if(!economy.pay('blue',result.cost))
   throw Error('Несоответствие игровой казны расходам на БК');
  lastEconomyBlue=economy.treasury.blue;
 }
 alertStatus('Пополнение '+britishLabel(last)+': +'+result.added+' за '+result.cost+' монет.');
 drawHud();
}
function registerUI(){
 document.querySelectorAll('[data-scenario]').forEach(button=>
  button.addEventListener('click',()=>chooseScenario(button.dataset.scenario)));
 document.querySelectorAll('[data-weapon]').forEach(button=>
  button.addEventListener('click',()=>chooseGun(button.dataset.weapon)));
 $('fight').addEventListener('click',()=>{
  const hero=findActor();
  if(!hero?.alive){alertStatus('Герой погиб. Нажмите «Сброс».');return;}
  if(atBase){
   const result=controller.start();
   if(!result.ok){alertStatus('Бой не начат: '+result.reason);return;}
   atBase=false;state.atBase=false;alertStatus('Продолжаем бой. Коснитесь земли для движения героя.');
  }else{
   controller.stop();atBase=true;state.atBase=true;
   alertStatus('Пауза: доступна смена оружия и пополнение БК.');
  }
  drawHud();
 });
 $('reset').addEventListener('click',()=>{
  setup(scenario);
  const start=controller.start();
  if(start.ok){atBase=false;state.atBase=false;}
  alertStatus('Новый бой. Выбирайте направление движения касанием земли.');
  drawHud();
 });
 $('supply').addEventListener('click',resupplyHero);
 $('order-move').addEventListener('click',()=>{
  inputMode='move';
  $('order-move').setAttribute('aria-pressed','true');
  $('order-attack').setAttribute('aria-pressed','false');
  alertStatus('Движение: коснитесь земли для приказа.');
 });
 $('order-attack').addEventListener('click',()=>{
  inputMode='attack';
  $('order-move').setAttribute('aria-pressed','false');
  $('order-attack').setAttribute('aria-pressed','true');
  alertStatus('Атака: коснитесь противника для выбора цели.');
 });
 $('reload-manual').addEventListener('click',()=>{
  const r=battle.startReload(findActor());
  alertStatus(r.ok?'Перезарядка началась: '+r.seconds+' с.':
   'Перезарядка невозможна: '+r.reason);
  drawHud();
 });
}
// First game's direct WASD/joystick walking. No repeating waypoint commands.
// Screen-up means NORTH (+Z) on the Babylon 300x300 battlefield.
function updateTouchJoystick(dt){
 if(!fieldOrders)return;
 if(touchJoystick.active){
  // The north-up camera looks along +Z; screen-right is world -X.
  fieldOrders.setMovement(-touchJoystick.x,touchJoystick.y);
  return;
 }
 const x=Number(movementKeys.d||movementKeys.ArrowRight)-
  Number(movementKeys.a||movementKeys.ArrowLeft);
 const z=Number(movementKeys.w||movementKeys.ArrowUp)-
  Number(movementKeys.s||movementKeys.ArrowDown);
 const magnitude=Math.hypot(x,z);
 fieldOrders.setMovement(magnitude>1?-x/magnitude:-x,magnitude>1?z/magnitude:z);
}
function registerTouchControls(){
 for(const button of document.querySelectorAll('[data-stance]'))button.addEventListener('click',()=>{
  tacticalAI?.setStance(button.dataset.stance,findActor());
  for(const b of document.querySelectorAll('[data-stance]'))b.setAttribute('aria-pressed',String(b===button));
  alertStatus(button.dataset.stance==='hold'?'Армия удерживает район героя. Расчёты остаются на позициях.':button.dataset.stance==='attack'?'Самостоятельная армия наступает на ближайшую доступную ферму.':'Армия самостоятельно выбирает цели и защищает захваченное.');
 });
 // Match the first game's W/A/S/D and arrow-key walking on desktop.
 // Key events only change a movement vector; the combat loop owns physics.
 for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{
  if(!(e.key in movementKeys))return;
  if(e.target?.matches?.('input,textarea,select,[contenteditable=true]'))return;
  movementKeys[e.key]=type==='keydown';
  if(e.key.startsWith('Arrow'))e.preventDefault();
 });
 const zone=$('touch-zone'),pad=$('touch-stick'),knob=$('touch-stick-knob');
 if(!zone||!pad||!knob)return;
 function resetStick(){
  touchJoystick.active=false;touchJoystick.pointer=null;
  touchJoystick.x=touchJoystick.y=0;touchJoystick.cooldown=0;
  knob.style.transform='translate3d(0,0,0)';
  pad.style.left='';pad.style.top='';pad.style.bottom='';
  fieldOrders?.clearMovement();
 }
 function move(e){
  const rect=pad.getBoundingClientRect();
  const radius=Math.max(28,Math.min(rect.width,rect.height)*.36);
  const dx=(e.clientX-rect.left-rect.width/2)/radius;
  const dy=(e.clientY-rect.top-rect.height/2)/radius;
  const length=Math.hypot(dx,dy);
  // Small dead-zone prevents idle twitch; full analog travel remains smooth.
  const strength=Math.min(1,Math.max(0,(length-.09)/.91));
  touchJoystick.x=length>.001?dx/length*strength:0;
  touchJoystick.y=length>.001?-dy/length*strength:0;
  knob.style.transform='translate3d('+(touchJoystick.x*radius*.65)+'px,'+
   (-touchJoystick.y*radius*.65)+'px,0)';
 }
 zone.addEventListener('pointerdown',e=>{
  if(!state.ready||!gameStarted||!findActor()?.alive||touchJoystick.active)return;
  e.preventDefault();
  touchJoystick.active=true;touchJoystick.pointer=e.pointerId;
  // Spawn the stick under the thumb, anywhere in the left movement zone.
  const bounds=zone.getBoundingClientRect(),half=pad.offsetWidth/2;
  const cx=Math.max(half+8,Math.min(bounds.width-half-8,e.clientX-bounds.left));
  const cy=Math.max(half+8,Math.min(bounds.height-half-8,e.clientY-bounds.top));
  pad.style.left=(cx-half)+'px';pad.style.top=(cy-half)+'px';pad.style.bottom='auto';
  zone.setPointerCapture(e.pointerId);
  move(e);
 });
 zone.addEventListener('pointermove',e=>{
  if(touchJoystick.active&&e.pointerId===touchJoystick.pointer){
   e.preventDefault();move(e);
  }
 });
 function release(e){
  if(e.pointerId!==touchJoystick.pointer)return;
  resetStick();
 }
 zone.addEventListener('pointerup',release);
 zone.addEventListener('pointercancel',release);
 zone.addEventListener('lostpointercapture',release);
 window.addEventListener('blur',()=>{
  for(const key of Object.keys(movementKeys))movementKeys[key]=false;
  resetStick();
 });
 window.addEventListener('pagehide',resetStick);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)resetStick();});
 $('quick-fire').addEventListener('click',()=>{
  if(!state.ready||!gameStarted||!controller)return;
  const hero=findActor();
  if(!hero?.alive)return;
  // O(n) nearest living enemy without sorting or allocating arrays.
  let target=null,best=Infinity;
  for(const enemy of enemies){
   if(!enemy?.alive)continue;
   const d=(enemy.x-hero.x)**2+(enemy.z-hero.z)**2;
   if(d<best){best=d;target=enemy;}
  }
  if(!target)return;
  controller.setFocus(target);
  alertStatus('ОГОНЬ · приоритетная цель: '+target.id);
 });
 $('quick-gear').addEventListener('click',()=>$('hud-toggle').click());
 $('quick-pause').addEventListener('click',()=>$('fight').click());
 $('quick-reload').addEventListener('click',()=>$('reload-manual').click());
}
async function deployReinforcement({unit,side,hero},epoch){
 const slot=unit.reinforcementSlot;
 try{
  // Stream ONLY this requested approved model; never create all 24 at launch.
  await ensureUnits([slot]);
  if(epoch!==reinforcementEpoch||scenario!=='squads'||!replenisher?.snapshot().active)
   return; // A Reset or mode switch invalidated an in-flight asset request.
  if(!controller?.snapshot().active){
   replenisher.finish(unit,false);
   return;
  }
  const view=views[slot];
  if(!view)throw Error('Model was not created for reserve slot '+slot);
  unit.alive=true;unit.hp=unit.maxHp;
  // Always start from the correct army base, never at the location of death.
  unit.x=unit.spawn.x;unit.z=unit.spawn.z;
  unit.cooldown=0;unit.reloadRemaining=0;unit.reloadWeapon=null;
  unit.suppressed=0;unit.weapon='Kar98k';
  if(unit.isHero)fieldOrders?.clearDestination();
  unit.characterModelImported=!!view.importedAlliedModel;
  assignView(view,unit);
  actors.set(unit,view);
  replenisher.finish(unit,true);
  state.reinforcements=replenisher.snapshot();
  // Existing weapon assets/IK remain attached to the original rig.
  // Subsequent equip requests use the existing weapon queue.
  if(unit.isHero)alertStatus('Герой вернулся на базу. Подкрепления продолжают прибывать.');
  else if(state.reinforcements.totalBlueReinforced+
   state.reinforcements.totalRedReinforced<=6)
   alertStatus(side==='blue'?'Подкрепление союзников вышло с базы.':
    'Подкрепление Вермахта вышло с базы.');
  void processWeaponQueue();
 }catch(error){
  if(epoch!==reinforcementEpoch)return;
  replenisher?.finish(unit,false);
  const key='reinforcement-'+slot;
  state.modelErrors[key]=String(error?.message||error);
  console.warn('Не удалось загрузить подкрепление',side,slot,error);
 }
}
function updateReinforcements(dt){
 if(scenario!=='squads'||!gameStarted||!controller?.snapshot().active||!replenisher)
  return;
 const requests=replenisher.update(dt);
 const epoch=reinforcementEpoch;
 for(const request of requests)void deployReinforcement(request,epoch);
 state.reinforcements=replenisher.snapshot();
}
function frame(){
 // Under mobile software rendering, clamping to 50ms made real-time
 // walking, army spawning and gold clocks slow down dramatically at <20 FPS.
 // 120ms is still safely below every core's maximum simulation step (200ms).
 const dt=Math.max(0,Math.min(.12,engine.getDeltaTime()/1000));
 if(state.ready&&controller){
  if(!gamePausedForBriefing){
   updateTouchJoystick(dt);
   if(controller.snapshot().active)support.crewUpdate();
   controller.update(dt);
   if(controller.snapshot().active){support.update(dt);world.field.update(support);}
   updateReinforcements(dt);
   // Stop economic and unlock clocks while the actual battle is paused
   // (not merely when the map briefing is dismissed).
   if(economy&&controller.snapshot().active){
    economy.update(dt,[...allies,...enemies]);
    // Only newly earned income enters the combat treasury. Purchases
    // deduct from BOTH treasuries, preventing an accidental money refund.
    const credited=economy.treasury.blue-lastEconomyBlue;
    if(credited>0)battle.grantFunds(credited);
    lastEconomyBlue=economy.treasury.blue;
   }
  }
  for(const view of views)if(view?.unit){
   syncVisual(view);
   nativeBlend.update(view,dt);
  }
  // Fixed original Three.js follow profile, without rotating on the joystick.
  if(allies[0]?.alive&&camera){
   // Leave room ahead to see enemies and cover, as in the original.
   const dest=position(allies[0],1.55).add(new B.Vector3(0,0,3.0));
   camera.target=B.Vector3.Lerp(camera.target,dest,Math.min(1,dt*2.8));
  }
  const now=performance.now();
  // The five capture-ring meshes change slowly. Rebuilding the complete
  // economy summary and ring materials every rendered frame wastes CPU.
  if(world&&economy&&now-lastFarmSyncAt>400){
   world.syncFarms(economy.summary());lastFarmSyncAt=now;
  }
  if(now-statusAt>220){statusAt=now;drawHud();}
 }
 for(let i=fx.length-1;i>=0;i--){
  const f=fx[i];f.ttl-=dt;
  if(f.flight){const t=Math.max(0,Math.min(1,1-f.ttl/f.flight.duration));f.mesh.position.copyFrom(B.Vector3.Lerp(f.flight.start,f.flight.end,t));f.mesh.position.y+=Math.sin(Math.PI*t)*2;}
  if(f.ttl<=0){
   if(f.pooled){f.pooled.active=false;f.mesh.setEnabled(false);}
   else{f.mesh.dispose();f.material?.dispose();}
   fx.splice(i,1);
  }
 }
 // Adaptive GPU resolution affects graphics only: simulation, targeting,
 // ballistics, UI hit targets and all native skeleton animations stay fixed.
 if(renderQuality.mode==='auto'&&gameStarted){
  renderQuality.fpsElapsed+=Math.min(1,Math.max(0,engine.getDeltaTime()/1000)); // real frame time
  if(renderQuality.fpsElapsed>=8){
   renderQuality.fpsElapsed=0;
   const fps=engine.getFps();
   const old=renderQuality.scale;
   const next=fps<34?Math.min(renderQuality.high,old+.08):
    fps>57?Math.max(renderQuality.low,old-.06):old;
   if(Math.abs(next-old)>.04){
    renderQuality.scale=next;engine.setHardwareScalingLevel(next);
    state.graphics.hardwareScale=+next.toFixed(2);
    state.graphics.changes++;
   }
   state.engineering.frameStats={fps:+fps.toFixed(1),scale:+next.toFixed(2),
    visibleActors:views.filter(v=>v?.unit?.alive).length,
    activeTracers:fx.filter(f=>f.pooled).length,
    sharedSoldierMaterials:soldierMaterialCache.size,
    staticDrawCallsSaved:world?.field?.optimization?.drawCallsSaved||0,
    dynamicWeaponMounts:world?.field?.optimization?.dynamicMountMeshes||0,
    activeMeshes:scene.getActiveMeshes().length};
  }
 }
 scene.render();
}
try{
 createWorld();
 await ensureUnits('duel'); // Two actors first, not eight blocking the entire UI.
 state.loading=false;state.ready=true;
 for(const el of document.querySelectorAll('button'))el.disabled=false;
 registerUI();
 registerTouchControls();
 setup('squads');
 briefingProgress.textContent='Бойцы загружены. Читайте карту и нажмите «В бой».';
 enterButton.disabled=false;
 enterButton.textContent='В бой · начать игру';
 // The first playable frame is available before armature IK/weapon loading.
 void processWeaponQueue();
// Do not start combat under the briefing: player chooses the start time.
 $('loading').textContent='Готово. На заставке нажмите «В бой», когда прочитаете правила.';
 drawHud();
}catch(error){
 state.loading=false;state.error=String(error?.stack||error);
 $('loading').textContent='Ошибка: '+(error?.message||error);
 $('readout').textContent='Не удалось запустить игру. Проверьте загрузку модели.';
 $('failure-text').textContent=(error?.message||String(error));
 $('failure').style.display='block';
 briefingProgress.textContent='Ошибка загрузки: '+(error?.message||error);
 enterButton.textContent='Ошибка загрузки. Перезапустите игру';
 console.error('Battlefield main game',error);
}
})();