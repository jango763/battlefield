(async function(){
'use strict';
const state=window.__COMMANDO_REAL_V2_QA__={
 loaded:false,ready:false,error:null,bones:0,skinned:0,animations:[],pose:null,
 realHistoricalSource:true,actualIphoneSafariTested:false,gameApproved:false
};
const B=window.BABYLON,status=document.getElementById('status'),controls=document.getElementById('controls'),errors=document.getElementById('error');
try{
 if(!B?.Engine||!B.SceneLoader)throw Error('Babylon.js недоступен');
 const canvas=document.getElementById('renderCanvas');
 const engine=new B.Engine(canvas,true,{stencil:true});
 engine.setHardwareScalingLevel(Math.max(1,(devicePixelRatio||1)/1.5));
 const scene=new B.Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.09,.12,.11,1);
 const cam=new B.ArcRotateCamera('camera',Math.PI*.34,Math.PI*.47,3.35,new B.Vector3(.08,.24,0),scene);
 cam.lowerRadiusLimit=.85;cam.upperRadiusLimit=7;
 cam.attachControl(canvas,true);cam.pinchDeltaPercentage=.015;cam.wheelDeltaPercentage=.015;
 new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene).intensity=1.12;
 new B.DirectionalLight('key',new B.Vector3(-.65,-1,-.75),scene).intensity=2.1;
 const imported=await B.SceneLoader.ImportMeshAsync('','../assets/allied-soldiers/','uk-commando-cc0-sten-v2.glb',scene);
 state.bones=imported.skeletons[0]?.bones?.length||0;
 state.skinned=imported.meshes.filter(x=>x.skeleton).length;
 const groups=imported.animationGroups;
 state.animations=groups.map(x=>x.name);
 if(imported.skeletons.length!==1||state.bones!==65||state.skinned<3)
  throw Error('Ошибка скелета или модели: '+JSON.stringify({skins:imported.skeletons.length,bones:state.bones,meshes:state.skinned}));
 for(const n of ['Ready','Aim','Fire','Walk','Jog','Sprint'])if(!state.animations.includes(n))throw Error('Отсутствует анимация '+n);
 function play(n){
  const g=groups.find(x=>x.name===n);if(!g)throw Error('Нет движения '+n);
  groups.forEach(x=>x.stop());g.start(true,1,g.from,g.to);
  state.pose=n;
  document.querySelectorAll('[data-pose]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pose===n)));
  controls.open=false;
 }
 function view(n){
  cam.alpha=n==='right'?Math.PI*1.1:Math.PI*.34;
  cam.radius=n==='full'?3.35:1.7;
  cam.target.set(.08,n==='full'?.24:.55,n==='full'?0:.05);
  controls.open=false;
 }
 document.querySelectorAll('[data-pose]').forEach(b=>b.addEventListener('click',()=>play(b.dataset.pose)));
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
 window.__COMMANDO_REAL_V2__={scene,imported,groups,play,view};
 play(new URLSearchParams(location.search).get('pose')||'Ready');
 state.loaded=true;state.ready=true;
 status.dataset.ready='true';status.textContent='Модель загружена · настоящая геометрия · 65 костей';
 engine.runRenderLoop(()=>scene.render());addEventListener('resize',()=>engine.resize());
}catch(e){
 state.error=String(e?.message||e);state.ready=true;errors.textContent=state.error;
 status.textContent='Ошибка: '+state.error;
 console.error('COMMANDO_REAL_V2',e);
}
})();