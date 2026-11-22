/* First three actual Battlefield characters — one at a time.
 * This is an inspection range, never a replacement for game production.
 * Preserve the exact approved German source/16 combat clips, and show
 * the user's original American and Jakeli trial GLBs without a fallback mesh.
 */
(async function(){
'use strict';
const B=window.BABYLON, canvas=document.getElementById('view');
const unitMotion=window.BattlefieldUnitMotionUnifier;
const nativeBlend=window.BattlefieldNativeClipBlend;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const specs=Object.freeze({
 german:Object.freeze({
  label:'Вермахт · утверждённый немецкий стрелок',source:'animstudio-preview/models/all-combat-run.glb',
  approval:'ИСХОДНАЯ МОДЕЛЬ УТВЕРЖДЕНА',color:'#a9b7a3',
  clips:{idle:'Kar98k_Hold',walk:'Kar98k_Run',run:'Kar98k_Run',aim:'Kar98k_Aim',fire:'Kar98k_Fire'},
  speeds:{walk:.67,run:1.1,fire:1},
  warning:'Оригинальная немецкая сетка и 16 боевых клипов. Kar98k установлен отдельным штатным модулем, обе руки удерживают оружие.'
 }),
 american:Object.freeze({
  label:'Американский герой · оригинальная модель',source:'../assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb',
  approval:'ТРЕБУЕТ ПРИЁМКИ',color:'#c6b394',
  clips:{idle:'Idle_Quaternius',walk:'Walk_Quaternius',run:'Jog_Quaternius',
   aim:'Idle_Quaternius',fire:null},
  speeds:{walk:1,run:1,aim:1},
  warning:'Quaternius отвечает за ноги; готовый контроллер Lee-Enfield отвечает за две руки, пальцы, локти и приклад. Выстрел пока не имеет собственного клипа.'
 }),
 jakeli:Object.freeze({
  label:'Британский пехотинец · George Jakeli',source:'../assets/allied-soldiers/uk-jakeli-battle-lod1.glb',
  approval:'ДЕФОРМАЦИЯ НЕ УСТРАНЕНА',color:'#bcae87',
  clips:{idle:'Ready',walk:'Walk',run:'Jog',aim:'Aim',fire:'Fire'},
  speeds:{walk:1,run:1,aim:1,fire:1},
  warning:'Риг 65 костей экспериментальный. Проверь плечи, кисти, ноги и контакт Lee-Enfield.'
 })
});
const state=window.__BF_UNIT_REVIEW__={
 ready:false,selected:'german',motion:'idle',error:null,sharedMotion:true,panelOpen:false,motionReports:{},createdGroups:0,
 realModels:{},approved:{german:true,american:false,jakeli:false},
 trialOnly:true,characters:{},loadedCount:0,skinFailures:[]
};
try{
 if(!B?.Engine||!B.SceneLoader)throw Error('Babylon.js или загрузчик GLB недоступен');
 const engine=new B.Engine(canvas,true,{powerPreference:'high-performance',stencil:true,
  preserveDrawingBuffer:false});
 engine.setHardwareScalingLevel(Math.max(1,devicePixelRatio/1.5));
 const scene=new B.Scene(engine);scene.useRightHandedSystem=true;
 scene.clearColor=new B.Color4(.075,.11,.095,1);
 const ambient=new B.HemisphericLight('soft-ambient',new B.Vector3(0,1,0),scene);
 ambient.intensity=1.35;ambient.diffuse=B.Color3.FromHexString('#e8e5d9');
 const key=new B.DirectionalLight('sun',new B.Vector3(-.45,-1,-.6),scene);
 key.intensity=1.75;
 const rim=new B.DirectionalLight('rim',new B.Vector3(.65,-.6,.75),scene);
 rim.intensity=.7;rim.diffuse=B.Color3.FromHexString('#afc6ad');
 const camera=new B.ArcRotateCamera('figure',Math.PI*.58,Math.PI*.46,3.6,
  new B.Vector3(0,1.1,0),scene);
 camera.lowerRadiusLimit=1.15;camera.upperRadiusLimit=7;
 camera.lowerBetaLimit=.15;camera.upperBetaLimit=Math.PI*.79;
 camera.pinchDeltaPercentage=.018;camera.wheelDeltaPercentage=.018;
 camera.attachControl(canvas,true);scene.activeCamera=camera;
 const ground=B.MeshBuilder.CreateDisc('inspection-ground',{radius:2.2,tessellation:60},scene);
 ground.rotation.x=Math.PI/2;ground.position.y=-.028;
 ground.isPickable=false;
 const groundMat=new B.PBRMaterial('inspection-soil',scene);
 groundMat.albedoColor=B.Color3.FromHexString('#4a5845');
 groundMat.roughness=.97;groundMat.metallic=0;ground.material=groundMat;
 const floorMat=new B.PBRMaterial('figure-backplate',scene);
 floorMat.albedoColor=B.Color3.FromHexString('#3b4235');
 floorMat.roughness=.98;
 const cache=new Map();
 let active=null,requestIndex=0;
 function rebuildSharedMotion(){
  if(!unitMotion)return;
  const donor=unitMotion.findGroup(cache.get('german')?.clips,'Kar98k_Run');
  for(const model of cache.values()){
   model.sharedClips||=new Map();
   model.sharedReports||={};
   model.sharedReports.idle={status:'native-weapon-ready',reason:'Hands remain controlled by original soldier rig'};
   if(model.id==='german'){
    model.sharedReports.run={status:'native-donor'};
   }else if(!donor){
    model.sharedReports.run={status:'pending'};
   }else if(!model.sharedClips.has('run')){
    const made=unitMotion.retarget({B,sourceGroup:donor,
     targetRoot:model.pivot,skeletons:model.container.skeletons,
     tag:'review-'+model.id+'-legs-run'});
    if(made.ok){
     const lower=unitMotion.legsOnly(made.group);
     if(lower.ok){
      model.sharedClips.set('run',made.group);
      model.sharedReports.run={status:'legs-only',joints:lower.kept,protectedChannels:lower.removed};
      state.createdGroups++;
     }else{
      made.group.dispose?.();
      model.sharedReports.run={status:'native-fallback',reason:lower.reason};
     }
    }else model.sharedReports.run={status:'native-fallback',reason:made.reason};
   }
   state.motionReports[model.id]=model.sharedReports;
  }
 }

 const pos=new B.Vector3(0,1.1,0);
 function status(message){$('#status').textContent=message;}
 function error(message){$('#error').style.display='block';$('#error').textContent=message;}
 function groupFor(model,motion){
  if(state.sharedMotion&&model.sharedClips?.has(motion))
   return model.sharedClips.get(motion);
  const clip=model.spec.clips[motion];
  if(!clip)return null;
  return model.clips.find(g=>g.name===clip||g.name.replace(/-\d+$/,'')===clip);
 }
 function updateButtons(){
  $$('[data-unit]').forEach(button=>
   button.setAttribute('aria-pressed',String(button.dataset.unit===state.selected)));
  $$('[data-motion]').forEach(button=>{
   button.disabled=!specs[state.selected].clips[button.dataset.motion];
   button.setAttribute('aria-pressed',String(state.motion===button.dataset.motion));
  });
 }
 function play(mode){
  const model=active;
  if(!model)return;
  const clip=groupFor(model,mode);
  if(!clip){status('У '+model.spec.label+' ещё нет утверждённой анимации '+mode);return;}
  const speed=state.sharedMotion&&mode==='run'?1.1:(model.spec.speeds?.[mode]||1);
  if(nativeBlend){
   nativeBlend.play(model,clip,mode,{loop:mode!=='fire'});
   clip.speedRatio=speed;
  }else{
   for(const group of [...model.clips,...(model.sharedClips?.values()||[])])group.stop();
   clip.start(mode!=='fire',speed,clip.from,clip.to);
  }
  // The real two-handed rigs work AFTER the native animation and before rendering.
  // No foreign soldier's arm/shoulder tracks are allowed to fight their IK.
  if(model.id==='german')
   model.rigState?.setWeaponPose?.(mode==='run'||mode==='walk'?'run':
    mode==='aim'?'aim':mode==='fire'?'fire':'ready');
  if(model.id==='american')
   model.rig?.setPose?.(mode==='aim'||mode==='fire'?'aim':'ready');
  state.motion=mode;
  state.characters[state.selected].activeClip=clip.name;
  updateButtons();
  const c=state.characters[state.selected];
  status(model.spec.label+' · '+model.spec.approval+'\n'+
   'Реальная модель: '+c.triangles.toLocaleString('ru-RU')+
   ' треугольников · '+c.skinned+' скелетных сеток · '+c.bones+' костей\n'+
   'Клип: '+clip.name+' · '+
   (state.sharedMotion?'Движение: '+JSON.stringify(model.sharedReports?.[mode]||{status:'native'}):'Исходная анимация')+
   '\n'+model.spec.warning);
 }
 function area(container){
  const meshes=container.meshes.filter(m=>m.getTotalVertices?.()>0);
  let min=new B.Vector3(Infinity,Infinity,Infinity),
      max=new B.Vector3(-Infinity,-Infinity,-Infinity);
  for(const mesh of meshes){
   mesh.computeWorldMatrix(true);
   const b=mesh.getBoundingInfo().boundingBox;
   min.minimizeInPlace(b.minimumWorld);
   max.maximizeInPlace(b.maximumWorld);
  }
  const height=max.y-min.y;
  if(!Number.isFinite(height)||height<.1||height>200)
   throw Error('Недопустимый размер GLB: '+height);
  return {min,max,height,meshes};
 }
 async function load(id){
  if(cache.has(id))return cache.get(id);
  const spec=specs[id],container=await B.SceneLoader.LoadAssetContainerAsync('',spec.source,
    scene,undefined,'.glb');
  const skel=container.skeletons;
  const {min,max,height,meshes}=area(container);
  const skinned=meshes.filter(m=>!!m.skeleton);
  const bones=skel[0]?.bones?.length||0;
  // Approved German GLB: 5 mesh skins x 68 glTF joints (including
  // three equipment helpers). Allied trial rigs: 1 x 65 joints.
  const valid=id==='german'
   ?skel.length===5&&skel.every(r=>r.bones.length===68)
   :skel.length===1&&bones===65;
  if(!valid||skinned.length<2)
   throw Error('Подлинный GLB отклонён: '+id+'; скелеты '+skel.length+
    ', кости '+bones+', skinned меши '+skinned.length);
  const clips=container.animationGroups||[];
  for(const mode of ['idle','walk','run']){
   const name=spec.clips[mode];
   if(!clips.some(g=>g.name===name||g.name.replace(/-\d+$/,'')===name))
    throw Error('Нет оригинального движения '+name+' для '+id);
  }
  const pivot=new B.TransformNode('original-unit-'+id,scene);
  for(const root of container.rootNodes)if(!root.parent)root.parent=pivot;
  const scale=1.8/height;
  pivot.scaling.setAll(scale);
  pivot.position.set(-(min.x+max.x)*.5*scale,
   -min.y*scale,-(min.z+max.z)*.5*scale);
  container.addAllToScene();
  for(const clip of clips)clip.stop();
  // Preserve ALL source geometry. The reported "second rifle" came from
  // another soldier's independently loaded weapon, not the US source mesh.
  let hiddenSourceGun=0;
  if(id==='american'){
   // Reuse the tested Stage 8 source-hand skin material calibration.
   const donorSkin=container.materials.find(mat=>
    mat.name.includes('Battlefield_US_Donor_Hands_Skin'));
   if(donorSkin?.albedoColor){
    donorSkin.albedoColor=new B.Color3(.39,.275,.235);
    donorSkin.metallic=0;donorSkin.roughness=.95;
   }
  }
  // Reuse the ALREADY WORKING soldier-specific rigs instead of showing bare
  // animation skeletons or a weaponless American mannequin.
  const sceneMeshesBeforeRig=new Set(scene.meshes);
  let rig=null,rigState=null;
  if(id==='german'){
   if(typeof window.BattlefieldWeaponRig?.create!=='function')
    throw Error('Нет штатного немецкого оружейного IK');
   rigState={combatPose:{active:false,crouch:0}};
   rig=await window.BattlefieldWeaponRig.create({scene,imported:container,
    root:pivot,state:rigState,animationDriven:true,bindUI:false,
    acceptExportSockets:true,initialWeaponId:'de-kar98k',
    weaponRoot:'../assets/ww2-weapons/'});
   if(!rigState.weaponRigReady)throw Error('Не удалось собрать руки и Kar98k');
  }
  if(id==='american'){
   if(typeof window.BattlefieldUSLeeEnfieldStage4?.create!=='function')
    throw Error('Нет американского контроллера двух рук');
   rig=await window.BattlefieldUSLeeEnfieldStage4.create({
    scene,imported:container,stage:pivot,weaponRoot:'../assets/ww2-weapons/'});
   if(!rig?.report?.ready)throw Error('Не удалось собрать американца с винтовкой');
  }
  // Weapon meshes are created by their separate controllers under scene
  // roots, NOT under the original character pivot. Preserve ownership so
  // switching a character cannot leave a floating gun from a previous unit.
  const weaponMeshes=scene.meshes.filter(m=>
   !sceneMeshesBeforeRig.has(m)&&m.getTotalVertices?.()>0);
  const triangles=meshes.reduce((sum,m)=>
   sum+Math.round((m.getTotalIndices?.()||m.getTotalVertices())/3),0);
  const data={id,spec,container,pivot,clips,skinned:skinned.length,bones,triangles,
   rig,rigState,rigReady:id==='jakeli'||!!rig,hiddenSourceGun,weaponMeshes,
   textures:container.textures?.length||0};
  cache.set(id,data);
  rebuildSharedMotion();
  state.realModels[id]=true;
  state.characters[id]={source:spec.source,skinned:skinned.length,
   skeletons:skel.length,bones,triangles,clips:clips.map(g=>g.name),activeClip:null,
   approved:state.approved[id],hasFallback:false,
   assembled:id==='german'?'original soldier + German weapon rig + Kar98k':
    id==='american'?'original US skin + Quaternius + Lee-Enfield hand IK':
     'original British skin + native ready/weapon',
   rigReady:data.rigReady,hiddenSourceGun:data.hiddenSourceGun,
   weaponMeshCount:data.weaponMeshes.length};
  state.loadedCount=cache.size;
  return data;
 }
 async function select(id){
  if(!Object.hasOwn(specs,id))return;
  const ticket=++requestIndex;
  $$('[data-unit]').forEach(b=>b.disabled=true);
  status('Загружаю реальный GLB: '+specs[id].label+'…');
  try{
   const model=await load(id);
   if(ticket!==requestIndex)return;
   if(active) {
    nativeBlend?.stop(active);
    for(const clip of [...active.clips,...(active.sharedClips?.values()||[])])clip.stop();
    active.pivot.setEnabled(false);
   }
   active=model;
   for(const [key,other] of cache){
    const selected=key===id;
    other.pivot.setEnabled(selected);
    // A disabled character must never leave its independently mounted gun
    // on screen. IK still owns positions; the preview owns only visibility.
    for(const weapon of other.weaponMeshes||[])weapon.setEnabled(selected);
   }
   state.selected=id;
   state.motion='idle';
   play('idle');state.ready=true;
   $('#error').style.display='none';state.error=null;
  }catch(ex){
   state.error=String(ex?.message||ex);
   state.skinFailures.push({id,reason:state.error});
   error('Не удалось показать оригинальную модель '+id+': '+state.error);
   status('Ошибка загрузки · реальные модели не заменяются манекенами');
  }finally{$$('[data-unit]').forEach(b=>b.disabled=false);updateButtons();}
 }
 $$('[data-unit]').forEach(b=>b.addEventListener('click',()=>void select(b.dataset.unit)));
 document.querySelectorAll('[data-motion]').forEach(b=>b.addEventListener('click',()=>play(b.dataset.motion))); // animated unit controls
 const toggleControls=$('#toggle-controls'),controlsBody=$('#controls-body'),panel=$('#control');
 function setPanel(open){
  state.panelOpen=!!open;
  panel.classList.toggle('open',state.panelOpen);
  controlsBody.hidden=!state.panelOpen;
  toggleControls.setAttribute('aria-expanded',String(state.panelOpen));
  toggleControls.textContent=state.panelOpen?'Скрыть управление':'Показать управление';
 }
 toggleControls.addEventListener('click',()=>setPanel(!state.panelOpen));
 setPanel(false); // Opening the range never hides the legs behind a giant menu.
 $('#motion-standard').addEventListener('click',()=>{
  state.sharedMotion=!state.sharedMotion;
  $('#motion-standard').setAttribute('aria-pressed',String(state.sharedMotion));
  $('#motion-standard').textContent='Ноги: бег немца '+(state.sharedMotion?'ВКЛ':'ВЫКЛ');
  if(active)play(state.motion);
 });
 window.__BF_UNIT_REVIEW_ACT__={select,play,
  getLoaded:()=>[...cache.keys()],getScene:()=>scene};
 engine.runRenderLoop(()=>{
  if(active)nativeBlend?.update(active,Math.max(0,Math.min(.1,engine.getDeltaTime()/1000)));
  scene.render();
 });
 window.addEventListener('resize',()=>engine.resize());
 await select(new URLSearchParams(location.search).get('unit')||'german');
}catch(e){state.error=String(e?.message||e);error(state.error);console.error('Battlefield unit lab',e);}
})();