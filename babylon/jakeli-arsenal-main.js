/* Battlefield Jakeli: isolated, anatomically baked four-weapon gallery.
 * No runtime arm IK / skeleton changes, no shared Three.js or gameplay state.
 * Each GLB contains original British surfaces, 65 bones, genuine Quaternius
 * lower-body cycles, its own weapon mesh and individually baked two-hand aim.
 */
(async()=>{
 'use strict';
 const B=window.BABYLON;
 const status=document.getElementById('status'), error=document.getElementById('error');
 const controls=document.getElementById('controls');
 const FILES=Object.freeze({
  'uk-lee-enfield':'uk-jakeli-anatomical-v2.glb',
  'uk-sten':'uk-jakeli-anatomical-sten.glb',
  'uk-bren':'uk-jakeli-anatomical-bren.glb',
  'uk-piat':'uk-jakeli-anatomical-piat.glb'
 });
 const state=window.__JAKELI_ARSENAL_QA__={
  loaded:false,ready:false,busy:false,weapon:null,pose:'Ready',error:null,
  skeletonBones:0,skinnedMeshes:0,weaponMeshes:0,animationNames:[],
  variantSource:'anatomical Blender GLB',locomotion:'pre-Work Quaternius',
  gameApproved:false,realIphoneSafariTested:false,swaps:0
 };
 if(!B?.Engine||!B.SceneLoader) {
  state.error='Babylon.js недоступен';state.ready=true;error.textContent=state.error;return;
 }
 const canvas=document.getElementById('renderCanvas');
 const engine=new B.Engine(canvas,true,{stencil:true});
 engine.setHardwareScalingLevel(Math.max(1,(window.devicePixelRatio||1)/1.5));
 const scene=new B.Scene(engine);scene.useRightHandedSystem=true;
 scene.clearColor=new B.Color4(.1,.13,.12,1);
 const camera=new B.ArcRotateCamera('camera',Math.PI*.32,Math.PI*.44,3.25,new B.Vector3(0,.95,0),scene);
 camera.lowerRadiusLimit=.65;camera.upperRadiusLimit=5;camera.attachControl(canvas,true);
 camera.wheelDeltaPercentage=.015;camera.pinchDeltaPercentage=.015;
 new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene).intensity=1.1;
 new B.DirectionalLight('key',new B.Vector3(-.6,-1,-.8),scene).intensity=2;
 let current=null;
 function clean(item){
  if(!item)return;
  if(item.piatVisualCleanup)item.piatVisualCleanup();
  for(const group of item.animationGroups)group.stop();
  for(const group of item.animationGroups)group.dispose();
  for(const mesh of item.meshes)if(!mesh.isDisposed())mesh.dispose();
  for(const node of item.transformNodes)if(!node.isDisposed())node.dispose();
  for(const skeleton of item.skeletons)skeleton.dispose();
 }
 function activate(name){
  if(!current)throw Error('Модель ещё загружается');
  const clip=current.animationGroups.find(g=>g.name===name);
  if(!clip)throw Error('В модели отсутствует анимация '+name);
  for(const g of current.animationGroups)g.stop();
  clip.start(true,1,clip.from,clip.to);
  state.pose=name;
  for(const btn of document.querySelectorAll('[data-pose]'))
   btn.setAttribute('aria-pressed',String(btn.dataset.pose===name));
 }
 async function weapon(id){
  if(state.busy||!FILES[id])return;
  if(current&&id===state.weapon){controls.open=false;return}
  state.busy=true;error.textContent='';state.error=null;
  status.dataset.ready='false';
  status.textContent='Загрузка '+id.replace('uk-','')+'…';
  for(const b of document.querySelectorAll('[data-weapon]'))b.disabled=true;
  let incoming=null;
  try{
   incoming=await B.SceneLoader.ImportMeshAsync('','../assets/allied-soldiers/',FILES[id],scene);
   const ss=incoming.skeletons, groups=incoming.animationGroups;
   const bones=ss[0]?.bones?.length||0;
   const skinned=incoming.meshes.filter(m=>m.skeleton).length;
   const props=incoming.meshes.filter(m=>!m.skeleton&&(m.getTotalVertices?.()||0)>0).length;
   if(ss.length!==1||bones!==65||skinned!==13||props<1)
    throw Error('Некорректная модель '+id+': '+JSON.stringify({skins:ss.length,bones,skinned,props}));
   const expected=['Ready','Aim','Fire','Walk','Jog','Sprint'];
   if(expected.some(n=>!groups.some(g=>g.name===n)))
    throw Error('Отсутствуют анимации: '+id);
   // The anatomical PIAT GLB is a pose/mesh QA carrier. For the actual
   // viewer use the detailed original Battlefield procedural PIAT, not
   // the simplified Blender geometry used to fit the hands.
   if(id==='uk-piat'){
    const create=window.BattlefieldJakeliWeaponRig?.createPiatVisual;
    const holder=[...incoming.transformNodes,...incoming.meshes].find(n=>n.name==='Piat');
    if(typeof create!=='function'||!holder)throw Error('Original PIAT model unavailable');
    const sourcePieces=incoming.meshes.filter(m=>!m.skeleton&&(m.getTotalVertices?.()||0)>0);
    incoming.piatVisualCleanup=create(scene,holder);
    for(const piece of sourcePieces)piece.setEnabled(false);
   }
   const previous=current;
   current=incoming;state.weapon=id;
   state.skeletonBones=bones;state.skinnedMeshes=skinned;
   state.weaponMeshes=props;state.animationNames=groups.map(g=>g.name);
   state.loaded=true;state.ready=true;
   activate(state.pose);
   clean(previous);
   state.swaps++;
   status.textContent='Загружено · 65 костей · '+id;
   status.dataset.ready='true';
   for(const b of document.querySelectorAll('[data-weapon]'))
    b.setAttribute('aria-pressed',String(b.dataset.weapon===id));
   controls.open=false;
  }catch(e){
   if(incoming&&incoming!==current)clean(incoming);
   state.error=String(e.message||e);
   error.textContent='Не удалось загрузить '+id+': '+state.error;
   status.textContent='Ошибка: '+state.error;
   state.ready=true;
  }finally{
   state.busy=false;
   for(const b of document.querySelectorAll('[data-weapon]'))b.disabled=false;
  }
 }
 function view(name){
  camera.alpha=name==='right'?Math.PI*1.08:Math.PI*.32;
  camera.radius=name==='full'?3.25:1.30;
  camera.target.set(0,name==='full'?.95:1.35,name==='full'?0:.25);
  controls.open=false;
 }
 for(const b of document.querySelectorAll('[data-weapon]'))
  b.addEventListener('click',()=>{void weapon(b.dataset.weapon)});
 for(const b of document.querySelectorAll('[data-pose]'))
  b.addEventListener('click',()=>{if(!state.busy&&current){activate(b.dataset.pose);controls.open=false}});
 for(const b of document.querySelectorAll('[data-view]'))
  b.addEventListener('click',()=>view(b.dataset.view));
 window.__JAKELI_ARSENAL__={scene,camera,weapon,view,activate,current:()=>current};
 engine.runRenderLoop(()=>scene.render());
 window.addEventListener('resize',()=>engine.resize());
 const request=new URLSearchParams(location.search).get('weapon');
 await weapon(FILES[request]?request:'uk-lee-enfield');
})();