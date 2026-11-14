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
 // Torso-mounted weapon: independent of the swinging right wrist.
 // Two-handed pose is an experimental procedural aim constraint.
 let weaponContainer=null,weaponRoot=null,grip=null,weaponGeneration=0;
 const weaponSelect=document.querySelector('#weapon');
 const findPart=(...names)=>modelTargets.find(n=>names.some(x=>norm(n.name)===norm(x)));
 const chest=findPart('spine_03','spine_02','spine2','chest','upperchest','spine1');
 const rightHand=findPart('hand_r','righthand','RightHand');
 const leftHand=findPart('hand_l','lefthand','LeftHand');
 const rightUpper=findPart('upperarm_r','rightarm','RightArm');
 const leftUpper=findPart('upperarm_l','leftarm','LeftArm');
 const rightLower=findPart('lowerarm_r','rightforearm','RightForeArm');
 const leftLower=findPart('lowerarm_l','leftforearm','LeftForeArm');
 const manifest=await fetch(new URL('../../assets/ww2-weapons/manifest.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('manifest HTTP '+r.status);return r.json();});
 const toVec=a=>new B.Vector3(...a);
 const positionOf=node=>node?.getAbsolutePosition?.()||B.Vector3.Zero();
 const targetAt=(node,target,strength)=>{
  if(!node||!target)return;
  const parent=node.parent;
  if(!parent)return;
  const joint=positionOf(node);
  const direction=target.subtract(joint);
  if(direction.lengthSquared()<.0001)return;
  // Procedural shoulder alignment will be refined with two-bone IK.
  // Keep native rotation when the rig has no reliable local arm axis.
 };
 function updateWeaponPose(){
  if(!weaponRoot||!grip)return;
  // Use a stable chest socket rather than a swinging animated hand.
  // Weapon's original trigger is at its local origin; +Z points down barrel.
  const mode=state.animation;
  const isSprint=mode==='sprint';
  const combat=mode==='combat';
  grip.position.set(combat?.12:.24,combat?-.10:(isSprint?-.24:-.16),combat?.28:(isSprint?.24:.36));
  grip.rotationQuaternion=null;
  grip.rotation.set(combat?0:(isSprint?.19:.04),combat?0:(isSprint?-.19:-.08),combat?0:(isSprint?-.15:0));
  // Record grip-point errors for next IK pass without mutating working animations.
  const trigger=weaponRoot.getAbsolutePosition();
  const support=toVec(grip.metadata?.support||[0,0,.25]);
  const supportWorld=B.Vector3.TransformCoordinates(support,weaponRoot.getWorldMatrix());
  state.gripDistances={
   right:rightHand?Number(B.Vector3.Distance(positionOf(rightHand),trigger).toFixed(3)):null,
   left:leftHand?Number(B.Vector3.Distance(positionOf(leftHand),supportWorld).toFixed(3)):null
  };
 }
 async function equipWeapon(id){
  const generation=++weaponGeneration;
  state.weapon=id;state.weaponError=null;state.weaponAttached=false;
  try{
   const meta=manifest.weapons[id];if(!meta)throw Error('Unknown weapon '+id);
   const url=new URL('../../assets/ww2-weapons/'+meta.file,import.meta.url);
   const incoming=await B.SceneLoader.LoadAssetContainerAsync('',url.href,scene);
   if(generation!==weaponGeneration){incoming.dispose();return;}
   if(weaponRoot){weaponRoot.dispose(false,false);weaponRoot=null;}
   if(weaponContainer){weaponContainer.dispose();weaponContainer=null;}
   weaponContainer=incoming;weaponContainer.addAllToScene();
   if(!chest)throw Error('Грудная кость не найдена: '+modelTargets.map(n=>n.name).filter(n=>/spine|chest/i.test(n)).join(', '));
   grip=new B.TransformNode('chestWeaponSocket',scene);grip.parent=chest;
   weaponRoot=new B.TransformNode('weaponTrigger',scene);weaponRoot.parent=grip;
   weaponRoot.metadata={support:meta.support,trigger:meta.trigger};
   for(const mesh of weaponContainer.meshes.filter(m=>!m.parent))mesh.parent=weaponRoot;
   for(const node of weaponContainer.transformNodes.filter(n=>!n.parent))node.parent=weaponRoot;
   state.weaponAttached=true;updateWeaponPose();
  }catch(e){state.weaponError=String(e);console.error('Weapon load',e);}
  select(state.animation);
 }
 weaponSelect.addEventListener('change',()=>equipWeapon(weaponSelect.value));
 state.equipWeapon=equipWeapon;
 function select(mode){
  state.animation=mode;
  for(const group of Object.values(remapped))group.stop();
  if(mode==='combat'&&remapped.idle){remapped.idle.start(true,1,remapped.idle.from,remapped.idle.to,false);remapped.idle.pause();}
  else if(remapped[mode])remapped[mode].start(true,1,remapped[mode].from,remapped[mode].to,false);
  for(const btn of document.querySelectorAll('[data-clip]'))btn.setAttribute('aria-pressed',String(btn.dataset.clip===mode));
  log('Babylon.js | meshes: '+state.meshes+' | skeletons: '+state.skeletons+' | tracks: '+JSON.stringify(counts)+'\nAnimation: '+mode+' | '+(mode==='combat'?'static inspection pose; grip not yet solved':remapped[mode]?'active':'НЕ ПРИВЯЗАНА — требуется адаптация')+'\nSource groups: '+state.groups.join(', '));
 }
 for(const btn of document.querySelectorAll('[data-clip]'))btn.addEventListener('click',()=>select(btn.dataset.clip));
 select('idle');await equipWeapon(weaponSelect.value);state.ready=true;state.scene=scene;state.engineInstance=engine;
 engine.runRenderLoop(()=>{updateWeaponPose();scene.render();state.fps=Math.round(engine.getFps());});
 window.addEventListener('resize',()=>engine.resize());
}
start().catch(err=>{state.error=String(err?.stack||err);log('ОШИБКА: '+state.error);console.error(err);});
