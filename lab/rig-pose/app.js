// Battlefield rig laboratory: one imported Quaternius character; no weapon or duplicates.
// Stage 1: retarget the existing 195-channel clips, then create a procedural
// two-arm raise/aim animation from the 65-joint skeleton's frozen idle pose.
const B=window.BABYLON,canvas=document.querySelector('#view'),label=document.querySelector('#status');
const state={ready:false,mode:'idle',error:null,rig:null,pose:null,tracks:{},facing:1,showGuides:true};
window.__rig65=state;
function info(s){label.textContent=s;console.info('[Rig65]',s);}
async function boot(){
 if(!B)throw Error('Babylon.js не загрузился');
 const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true});
 const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.18,.24,.21,1);
 const camera=new B.ArcRotateCamera('inspection-camera',-Math.PI/3,Math.PI/2.42,4.65,new B.Vector3(0,1.15,0),scene);
 camera.attachControl(canvas,true);camera.lowerRadiusLimit=2.5;camera.upperRadiusLimit=9;
 const ambient=new B.HemisphericLight('sky',new B.Vector3(0,1,0),scene);ambient.intensity=1.25;
 const sun=new B.DirectionalLight('sun',new B.Vector3(-.5,-1,-.4),scene);sun.intensity=1.3;
 const floor=B.MeshBuilder.CreateGround('floor',{width:11,height:11},scene);
 const soil=new B.StandardMaterial('soil',scene);soil.diffuseColor=new B.Color3(.29,.36,.27);floor.material=soil;
 const base=new URL('../../assets/native-hero-quaternius/',import.meta.url);
 info('Загружается исходный 65-костный солдат…');
 const model=await B.SceneLoader.ImportMeshAsync('','',new URL('night-striker-lite.glb',base).href,scene);
 const root=new B.TransformNode('soldier-root',scene);
 for(const node of model.meshes.filter(mesh=>!mesh.parent))node.parent=root;
 const bounds=model.meshes.filter(m=>m.getBoundingInfo&&m.getTotalVertices()>0).map(m=>m.getBoundingInfo().boundingBox);
 let low=Infinity,high=-Infinity;for(const b of bounds){low=Math.min(low,b.minimumWorld.y);high=Math.max(high,b.maximumWorld.y);}
 if(Number.isFinite(high-low)&&high-low>.01)root.scaling.scaleInPlace(2.0/(high-low));
 const norm=n=>String(n||'').replace(/^mixamorig[:_]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const nodes=[...model.transformNodes,...model.meshes,...model.skeletons.flatMap(s=>s.bones)];
 const byName=new Map();for(const node of nodes){const key=norm(node.name);if(key&&!byName.has(key))byName.set(key,node);}
 const joint=name=>model.transformNodes.find(n=>norm(n.name)===norm(name))||byName.get(norm(name));
 const joints={
  chest:joint('spine_03'),rightUpper:joint('upperarm_r'),rightLower:joint('lowerarm_r'),
  rightHand:joint('hand_r'),leftUpper:joint('upperarm_l'),
  leftLower:joint('lowerarm_l'),leftHand:joint('hand_l')
 };
 const missing=Object.entries(joints).filter(([name,node])=>!node||!node.computeWorldMatrix||!node.getAbsolutePosition).map(([name])=>name);
 if(missing.length)throw Error('Не найдены управляющие кости рук: '+missing.join(', '));
 for(const side of ['right','left']){
  const upper=joints[side+'Upper'],lower=joints[side+'Lower'],hand=joints[side+'Hand'];
  const inHierarchy=(child,parent)=>{for(let n=child?.parent;n;n=n.parent)if(n===parent)return true;return false;};
  if(!inHierarchy(lower,upper)||!inHierarchy(hand,lower))throw Error('Неверная цепочка руки '+side);
 }
 const clips=await B.SceneLoader.LoadAssetContainerAsync('',new URL('hero-three-clips-lite.glb',base).href,scene);
 const groups={};const tracks={};
 for(const [mode,name] of Object.entries({idle:'Idle_Loop',jog:'Jog_Fwd_Loop',sprint:'Sprint_Loop'})){
  const original=clips.animationGroups.find(g=>g.name===name||g.name.includes(name));
  if(!original)throw Error('Нет клипа '+name);
  const group=new B.AnimationGroup('rig65-'+mode,scene);let count=0;
  for(const item of original.targetedAnimations){
   const target=byName.get(norm(item.target?.name));
   if(target){group.addTargetedAnimation(item.animation.clone(),target);count++;}
  }
  if(count<60)throw Error('Анимация '+name+' не привязана: '+count+' дорожек');
  group.normalize();groups[mode]=group;tracks[mode]=count;
 }
 state.tracks=tracks;state.rig={bones:model.skeletons.reduce((n,s)=>n+s.bones.length,0),nodes:nodes.length,chains:'left + right'};
 const armNodes=[joints.rightUpper,joints.rightLower,joints.leftUpper,joints.leftLower];
 const quaternionOf=n=>n.rotationQuaternion?.clone()||B.Quaternion.FromEulerAngles(n.rotation.x,n.rotation.y,n.rotation.z);
 const setQuats=(quats)=>armNodes.forEach((n,i)=>n.rotationQuaternion=quats[i].clone());
 const refresh=n=>{const chain=[];for(let p=n;p;p=p.parent)chain.unshift(p);for(const p of chain)p.computeWorldMatrix?.(true);};
 const at=n=>{refresh(n);return n.getAbsolutePosition().clone();};
 function aimJoint(jointNode,hand,target){
  refresh(hand);refresh(jointNode);
  const pivot=jointNode.getAbsolutePosition(),a=hand.getAbsolutePosition().subtract(pivot),b=target.subtract(pivot);
  if(a.lengthSquared()<1e-10||b.lengthSquared()<1e-10)return;
  a.normalize();b.normalize();
  const cross=B.Vector3.Cross(a,b),sin=cross.length(),dot=B.Vector3.Dot(a,b);
  if(sin<1e-7&&dot>0)return;
  if(sin<1e-7){const ref=Math.abs(a.y)<.8?B.Axis.Y:B.Axis.X;cross.copyFrom(B.Vector3.Cross(a,ref));}
  cross.normalize();
  const parentQ=new B.Quaternion();
  jointNode.parent.getWorldMatrix().decompose(undefined,parentQ,undefined);
  const inverse=parentQ.clone();inverse.conjugateInPlace();
  const localAxis=B.Vector3.TransformNormal(cross,B.Matrix.FromQuaternion(inverse)).normalize();
  const delta=B.Quaternion.RotationAxis(localAxis,Math.min(Math.acos(B.Scalar.Clamp(dot,-1,1)),.16));
  jointNode.rotationQuaternion=delta.multiply(quaternionOf(jointNode)).normalize();
  refresh(hand);
 }
 function solveArm(upper,lower,hand,target){
  for(let step=0;step<32;step++){
   aimJoint(lower,hand,target);aimJoint(upper,hand,target);
   if(B.Vector3.DistanceSquared(at(hand),target)<.00012)break;
  }
 }
 const angle=(upper,lower,hand)=>{
  const elbow=at(lower),a=at(upper).subtract(elbow).normalize(),b=at(hand).subtract(elbow).normalize();
  return Math.acos(B.Scalar.Clamp(B.Vector3.Dot(a,b),-1,1))*180/Math.PI;
 };
 const markers=[B.MeshBuilder.CreateSphere('right-hand-goal',{diameter:.075},scene),
  B.MeshBuilder.CreateSphere('left-hand-goal',{diameter:.075},scene)];
 const yellow=new B.StandardMaterial('hand-goal',scene);yellow.emissiveColor=new B.Color3(.95,.75,.20);
 for(const m of markers){m.material=yellow;m.setEnabled(false);m.isPickable=false;}
 let rest=null,posed=null,transition=null,active=null;
 function stopClips(){for(const group of Object.values(groups))group.stop();}
 function play(mode){stopClips();groups[mode].start(true);active=mode;}
 function freezeIdle(){stopClips();groups.idle.start(true);groups.idle.goToFrame(groups.idle.from);groups.idle.pause();active=null;refresh(joints.rightHand);refresh(joints.leftHand);}
 function createAimPose(){
  freezeIdle();rest=armNodes.map(quaternionOf);
  // Keep the target within measured arm reach. This avoids reaching
  // for imaginary weapon coordinates unrelated to the real skeleton.
  const chestPos=at(joints.chest);
  const chestWorld=joints.chest.getWorldMatrix();
  const forward=B.Vector3.TransformNormal(B.Axis.Z,chestWorld).normalize().scale(state.facing);
  const up=B.Vector3.TransformNormal(B.Axis.Y,chestWorld).normalize();
  const rightShoulder=at(joints.rightUpper),leftShoulder=at(joints.leftUpper);
  const candidates=[
   {forwardR:.65,forwardL:.74,down:.13,inward:.18},
   {forwardR:.59,forwardL:.68,down:.18,inward:.18},
   {forwardR:.72,forwardL:.81,down:.10,inward:.23},
   {forwardR:.53,forwardL:.62,down:.12,inward:.25}
  ];
  let best=null;
  for(const candidate of candidates){
   setQuats(rest);
   const buildGoal=(side,shoulder,other)=>{
    const lower=joints[side+'Lower'],hand=joints[side+'Hand'],reach=at(shoulder).subtract(at(lower)).length()+at(lower).subtract(at(hand)).length();
    const inward=at(other).subtract(at(shoulder)).normalize();
    return at(shoulder).add(forward.scale(reach*candidate[side==='right'?'forwardR':'forwardL']))
     .add(up.scale(-reach*candidate.down)).add(inward.scale(reach*candidate.inward));
   };
   const rightGoal=buildGoal('right',joints.rightUpper,joints.leftUpper);
   const leftGoal=buildGoal('left',joints.leftUpper,joints.rightUpper);
   solveArm(joints.rightUpper,joints.rightLower,joints.rightHand,rightGoal);
   solveArm(joints.leftUpper,joints.leftLower,joints.leftHand,leftGoal);
   const residual=[B.Vector3.Distance(at(joints.rightHand),rightGoal),B.Vector3.Distance(at(joints.leftHand),leftGoal)];
   const elbowAngles=[angle(joints.rightUpper,joints.rightLower,joints.rightHand),angle(joints.leftUpper,joints.leftLower,joints.leftHand)];
   const penalty=elbowAngles.reduce((n,d)=>n+(d<40?40-d:d>155?d-155:0)*.02,0);
   const score=residual[0]+residual[1]+penalty;
   if(!best||score<best.score)best={score,quats:armNodes.map(quaternionOf),targets:[rightGoal,leftGoal],residual,elbowAngles};
  }
  posed=best.quats;setQuats(rest);
  best.targets.forEach((p,i)=>markers[i].position.copyFrom(p));
  const passes=best.residual.every(d=>d<.08)&&best.elbowAngles.every(d=>d>=40&&d<=155);
  state.pose={passes,distances:best.residual.map(n=>+n.toFixed(3)),elbows:best.elbowAngles.map(n=>+n.toFixed(1)),
   result:passes?'Цели достигнуты':'ТРЕБУЕТ ПРОВЕРКИ / КОРРЕКЦИИ',note:'Тест геометрии; положение кистей следует осмотреть визуально'};
  return best;
 }
 const smooth=t=>t*t*(3-2*t);
 function switchMode(mode){
  if(mode==='aim'){
   try{
    state.error=null;createAimPose();state.mode='aim';
    transition={type:'up',start:armNodes.map(quaternionOf),end:posed,elapsed:0,duration:.55};
   }catch(error){state.error=String(error);state.mode='idle';play('idle');console.error(error);}
  }else if(groups[mode]){
   if(state.mode==='aim'&&rest){
    transition={type:'down',start:armNodes.map(quaternionOf),end:rest,elapsed:0,duration:.38,next:mode};state.mode=mode;
   }else{transition=null;state.mode=mode;play(mode);}
  }
  for(const btn of document.querySelectorAll('[data-mode]'))btn.setAttribute('aria-pressed',String(btn.dataset.mode===state.mode));
 }
 for(const btn of document.querySelectorAll('[data-mode]'))btn.onclick=()=>switchMode(btn.dataset.mode);
 document.querySelector('#flip').onclick=()=>{
  state.facing*=-1;document.querySelector('#flip').textContent='Направление: '+(state.facing>0?'+Z':'−Z');
  if(state.mode==='aim')switchMode('aim');
 };
 const guides=document.querySelector('#guides');
 guides.onclick=()=>{state.showGuides=!state.showGuides;guides.setAttribute('aria-pressed',String(state.showGuides));guides.textContent='Маркеры: '+(state.showGuides?'вкл.':'выкл.');};
 play('idle');
 let last=performance.now(),lastReport=0;
 engine.runRenderLoop(()=>{
  const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;
  if(transition){
   transition.elapsed=Math.min(transition.duration,transition.elapsed+dt);
   const factor=smooth(transition.elapsed/transition.duration);
   const q=transition.start.map((from,i)=>B.Quaternion.Slerp(from,transition.end[i],factor));
   setQuats(q);
   if(transition.elapsed>=transition.duration){
    const completed=transition;transition=null;
    if(completed.type==='down')play(completed.next);
   }
  }
  const visible=state.showGuides&&state.mode==='aim';
  for(const m of markers)m.setEnabled(visible);
  scene.render();
  if(now-lastReport>350){
   lastReport=now;
   label.textContent='Скелет: '+state.rig.bones+' костей | дорожки Idle/Jog/Sprint: '+Object.values(state.tracks).join('/')+
    '\nРежим: '+state.mode+(transition?' · переход '+Math.round(transition.elapsed/transition.duration*100)+'%':'')+
    (state.pose?'\nБоевая стойка: '+state.pose.result+' | кисти: '+state.pose.distances.join('/')+' м | локти: '+state.pose.elbows.join('/')+'°':'')+
    (state.error?'\nОШИБКА: '+state.error:'')+'\nFPS: '+Math.round(engine.getFps());
  }
 });
 window.addEventListener('resize',()=>engine.resize());
 state.scene=scene;state.engine=engine;state.ready=true;
}
boot().catch(e=>{state.error=String(e?.stack||e);info('ОШИБКА: '+state.error);console.error(e);});
