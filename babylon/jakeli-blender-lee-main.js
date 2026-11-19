/* Isolated anatomical Jakeli. All poses are baked against this model's bind pose.
 * No shared German controller, runtime bone stretching or IK parameter overrides.
 */
(async()=>{
 'use strict';
 const B=window.BABYLON,status=document.getElementById('status'),controls=document.getElementById('controls');
 const state=window.__BABYLON_SOLDIER__={loaded:false,ready:false,error:null,pose:null,model:'Jakeli anatomical v2',runtimeIK:false};
 try {
  const engine=new B.Engine(document.getElementById('renderCanvas'),true,{stencil:true});
  engine.setHardwareScalingLevel(Math.max(1,devicePixelRatio/1.5));
  const scene=new B.Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.10,.13,.12,1);
  const camera=new B.ArcRotateCamera('camera',Math.PI*.32,Math.PI*.44,3.25,new B.Vector3(0,.95,0),scene);
  camera.lowerRadiusLimit=.6;camera.upperRadiusLimit=5;camera.attachControl(engine.getRenderingCanvas(),true);camera.wheelDeltaPercentage=.015;camera.pinchDeltaPercentage=.015;
  const ambient=new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene);ambient.intensity=1.1;
  const key=new B.DirectionalLight('key',new B.Vector3(-.6,-1,-.8),scene);key.intensity=2;
  const imported=await B.SceneLoader.ImportMeshAsync('','../assets/allied-soldiers/','uk-jakeli-anatomical-v2.glb',scene);
  const groups=imported.animationGroups;
  groups.forEach(g=>g.stop());
  state.skeletonBones=imported.skeletons[0].bones.length;
  state.skinnedMeshes=imported.meshes.filter(m=>m.skeleton).length;
  state.animationNames=groups.map(g=>g.name);state.animationCount=groups.length;
  const nodes=[...imported.transformNodes,...imported.meshes];
  const find=n=>nodes.find(o=>o.name===n);
  const joints={};for(const bone of imported.skeletons[0].bones)joints[bone.name]=bone.getTransformNode();
  const start=(name)=>{
   const g=groups.find(g=>g.name===name);if(!g)throw Error('Нет анимации '+name);
   groups.forEach(a=>a.stop());g.start(true,1,g.from,g.to);state.pose=name;
   for(const b of document.querySelectorAll('[data-pose]'))b.setAttribute('aria-pressed',String(b.dataset.pose===name));
  };
  document.querySelectorAll('[data-pose]').forEach(b=>b.addEventListener('click',()=>{start(b.dataset.pose);controls.open=false}));
  const view=(name)=>{
   camera.alpha=name==='right'?Math.PI*1.08:Math.PI*.32;
   camera.radius=name==='full'?3.25:1.3;camera.target.set(0,name==='full'?.95:1.35,name==='full'?0:.25);
  };
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view(b.dataset.view);controls.open=false}));
  window.__JAKELI_QA__={scene,imported,groups,start,view,joints,gun:find('LeeEnfield')};
  start(new URLSearchParams(location.search).get('pose')||'Ready');
  state.loaded=true;state.ready=true;
  status.dataset.ready='true';status.textContent='Модель загружена · 65 костей · 6 анимаций';
  engine.runRenderLoop(()=>scene.render());window.addEventListener('resize',()=>engine.resize());
 } catch(e){state.error=String(e.message||e);state.ready=true;status.textContent='Ошибка: '+state.error;document.getElementById('error').textContent=state.error;console.error(e);}
})();
