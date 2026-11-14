// Babylon.js isolated migration test. Never imports or changes the existing game.
const canvas=document.querySelector('#view'),status=document.querySelector('#status');
const state={ready:false,error:null,animation:'idle',skeletons:0,groups:[],meshes:0,engine:'Babylon.js',fps:0};
window.__babylonLab=state;
const base=new URL('../../assets/native-hero-quaternius/',import.meta.url);
function log(msg){status.textContent=msg;console.info('[BABYLON LAB]',msg);}
async function start(){
 if(!window.BABYLON)throw Error('Babylon.js CDN не загрузился');
 const B=window.BABYLON;
 const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,disableWebGL2Support:false});
 const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.20,.26,.22,1);
 const camera=new B.ArcRotateCamera('camera',-Math.PI/2,Math.PI/2.25,5.6,new B.Vector3(0,1.2,0),scene);
 camera.attachControl(canvas,true);camera.lowerRadiusLimit=2;camera.upperRadiusLimit=12;
 const hemi=new B.HemisphericLight('sky',new B.Vector3(0,1,0),scene);hemi.intensity=1.4;
 const sun=new B.DirectionalLight('sun',new B.Vector3(-.5,-1,-.4),scene);sun.intensity=1.8;
 const ground=B.MeshBuilder.CreateGround('ground',{width:20,height:20},scene);
 const mat=new B.StandardMaterial('earth',scene);mat.diffuseColor=new B.Color3(.25,.32,.23);ground.material=mat;
 log('Загружаем оригинальную модель Quaternius…');
 const model=await B.SceneLoader.ImportMeshAsync('','',new URL('night-striker-lite.glb',base).href,scene);
 const root=new B.TransformNode('characterRoot',scene);
 for(const node of model.meshes.filter(m=>!m.parent))node.parent=root;
 const bounds=model.meshes.filter(m=>m.getBoundingInfo&&m.getTotalVertices()>0).map(m=>m.getBoundingInfo().boundingBox);
 if(bounds.length){let lo=Infinity,hi=-Infinity;for(const b of bounds){lo=Math.min(lo,b.minimumWorld.y);hi=Math.max(hi,b.maximumWorld.y);}
 const h=hi-lo;if(h>.01&&Number.isFinite(h))root.scaling.scaleInPlace(2.1/h);}
 state.skeletons=model.skeletons.length;state.meshes=model.meshes.length;
 log('Модель загружена. Подключаем существующие GLB-анимации…');
 const clips=await B.SceneLoader.LoadAssetContainerAsync('',new URL('hero-three-clips-lite.glb',base).href,scene);
 const all=clips.animationGroups;
 const wanted={idle:'Idle_Loop',jog:'Jog_Fwd_Loop',sprint:'Sprint_Loop'};
 // The animation GLB has its own node hierarchy. Babylon animates transform nodes,
 // not necessarily Skeleton.bones. Resolve targets against the imported character.
 const modelTargets=[...model.transformNodes,...model.meshes,...model.skeletons.flatMap(x=>x.bones)];
 const norm=name=>String(name||'').replace(/^mixamorig[:_]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const byName=new Map();
 for(const node of modelTargets){
  const key=norm(node.name);
  if(key&&!byName.has(key))byName.set(key,node);
 }
 const remapped={},counts={},unmatched={};
 for(const [mode,name] of Object.entries(wanted)){
  const group=all.find(g=>g.name===name||g.name.includes(name));
  if(!group){counts[mode]=0;unmatched[mode]=['missing group '+name];continue;}
  const output=new B.AnimationGroup('battlefield-'+mode,scene);
  const misses=[];let count=0;
  for(const ta of group.targetedAnimations){
   const old=ta.target;
   const target=byName.get(norm(old?.name));
   if(!target){misses.push(old?.name||'(unnamed)');continue;}
   // Preserve Babylon's glTF animation property (rotationQuaternion/position/scaling).
   output.addTargetedAnimation(ta.animation.clone(),target);
   count++;
  }
  if(count){output.normalize();output.stop();remapped[mode]=output;}
  else output.dispose();
  counts[mode]=count;unmatched[mode]=misses.slice(0,12);
 }
 state.unmatched=unmatched;
 state.targetNames=modelTargets.map(n=>n.name).slice(0,25);
 state.sourceNames=all.flatMap(g=>g.targetedAnimations.map(a=>a.target?.name)).filter(Boolean).slice(0,25);
 state.groups=all.map(g=>g.name);state.mappedTracks=counts;
 function select(mode){
  state.animation=mode;
  for(const group of Object.values(remapped))group.stop();\n  if(remapped[mode])remapped[mode].start(true,1,remapped[mode].from,remapped[mode].to,false);
  for(const btn of document.querySelectorAll('[data-clip]'))btn.setAttribute('aria-pressed',String(btn.dataset.clip===mode));
  log('Babylon.js | meshes: '+state.meshes+' | skeletons: '+state.skeletons+' | tracks: '+JSON.stringify(counts)+'\nAnimation: '+mode+' | '+(remapped[mode]?'active':'НЕ ПРИВЯЗАНА — требуется адаптация')+'\nSource groups: '+state.groups.join(', '));
 }
 for(const btn of document.querySelectorAll('[data-clip]'))btn.addEventListener('click',()=>select(btn.dataset.clip));
 select('idle');state.ready=true;state.scene=scene;state.engineInstance=engine;
 engine.runRenderLoop(()=>{scene.render();state.fps=Math.round(engine.getFps());});
 window.addEventListener('resize',()=>engine.resize());
}
start().catch(err=>{state.error=String(err?.stack||err);log('ОШИБКА: '+state.error);console.error(err);});
