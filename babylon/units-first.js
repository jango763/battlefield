/* First three actual Battlefield characters — one at a time.
 * This is an inspection range, never a replacement for game production.
 * Preserve the exact approved German source/16 combat clips, and show
 * the user's original American and Jakeli trial GLBs without a fallback mesh.
 */
(async function(){
'use strict';
const B=window.BABYLON, canvas=document.getElementById('view');
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const specs=Object.freeze({
 german:Object.freeze({
  label:'Вермахт · утверждённый немецкий стрелок',source:'animstudio-preview/models/all-combat-run.glb',
  approval:'ИСХОДНАЯ МОДЕЛЬ УТВЕРЖДЕНА',color:'#a9b7a3',
  clips:{idle:'Kar98k_Hold',walk:'Kar98k_Run',run:'Kar98k_Run',aim:'Kar98k_Aim',fire:'Kar98k_Fire'},
  speeds:{walk:.67,run:1.1,fire:1},
  warning:'Это исходный анимированный GLB. Комплект немецкой формы, головного убора и оружия из Three.js ещё нужно перенести в Babylon.js.'
 }),
 american:Object.freeze({
  label:'Американский герой · оригинальная модель',source:'../assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb',
  approval:'ТРЕБУЕТ ПРИЁМКИ',color:'#c6b394',
  clips:{idle:'Idle_Quaternius',walk:'Walk_Quaternius',run:'Jog_Quaternius',
   aim:'Idle_Quaternius',fire:null},
  speeds:{walk:1,run:1,aim:1},
  warning:'Прицел — пока исходная стойка. Отдельной утверждённой анимации выстрела в этом GLB нет.'
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
 ready:false,selected:'german',motion:'idle',error:null,
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
 const pos=new B.Vector3(0,1.1,0);
 function status(message){$('#status').textContent=message;}
 function error(message){$('#error').style.display='block';$('#error').textContent=message;}
 function groupFor(model,motion){
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
  for(const group of model.clips)group.stop();
  const speed=model.spec.speeds?.[mode]||1;
  clip.start(mode!=='fire',speed,clip.from,clip.to);
  state.motion=mode;
  state.characters[state.selected].activeClip=clip.name;
  updateButtons();
  const c=state.characters[state.selected];
  status(model.spec.label+' · '+model.spec.approval+'\n'+
   'Реальная модель: '+c.triangles.toLocaleString('ru-RU')+
   ' треугольников · '+c.skinned+' скелетных сеток · '+c.bones+' костей\n'+
   'Клип: '+clip.name+' · '+model.spec.warning);
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
  const triangles=meshes.reduce((sum,m)=>
   sum+Math.round((m.getTotalIndices?.()||m.getTotalVertices())/3),0);
  const data={id,spec,container,pivot,clips,skinned:skinned.length,bones,triangles,
   textures:container.textures?.length||0};
  cache.set(id,data);
  state.realModels[id]=true;
  state.characters[id]={source:spec.source,skinned:skinned.length,
   skeletons:skel.length,bones,triangles,clips:clips.map(g=>g.name),activeClip:null,
   approved:state.approved[id],hasFallback:false};
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
    for(const clip of active.clips)clip.stop();
    active.pivot.setEnabled(false);
   }
   active=model;
   for(const [key,other] of cache)other.pivot.setEnabled(key===id);
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
 $$('[data-motion]').forEach(b=>b.addEventListener('click',()=>play(b.dataset.motion)));
 window.__BF_UNIT_REVIEW_ACT__={select,play,
  getLoaded:()=>[...cache.keys()],getScene:()=>scene};
 engine.runRenderLoop(()=>{scene.render();});
 window.addEventListener('resize',()=>engine.resize());
 await select(new URLSearchParams(location.search).get('unit')||'german');
}catch(e){state.error=String(e?.message||e);error(state.error);console.error('Battlefield unit lab',e);}
})();