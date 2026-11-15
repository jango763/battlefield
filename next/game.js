// New Babylon gameplay foundation. No imports from the legacy Three.js game.
// Prototype mechanics are intentionally isolated from the 65-bone animation lab.
const B=window.BABYLON,canvas=document.getElementById('view'),status=document.getElementById('status');
const state={ready:false,units:[],enemies:[],shots:0,kills:0,selected:true,mode:'move',errors:[]};
window.__battlefieldNext=state;
if(!B){status.textContent='Ошибка: Babylon.js не загружен';throw Error('Babylon unavailable');}
const engine=new B.Engine(canvas,true,{stencil:true,preserveDrawingBuffer:false});
const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.55,.63,.59,1);
const camera=new B.ArcRotateCamera('tactical',-Math.PI/2,1.03,24,new B.Vector3(0,0,0),scene);
camera.attachControl(canvas,true);camera.lowerRadiusLimit=10;camera.upperRadiusLimit=42;camera.lowerBetaLimit=.55;camera.upperBetaLimit=1.35;
const hemi=new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene);hemi.intensity=.9;
const sun=new B.DirectionalLight('sun',new B.Vector3(-.5,-1,-.6),scene);sun.intensity=1.2;
const shadow=new B.ShadowGenerator(1024,sun);shadow.useBlurExponentialShadowMap=true;
const material=(name,color)=>{const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);return m;};
const olive=material('british-olive','#72795d'),grey=material('german-fieldgrey','#69716b'),skin=material('skin','#bd987b'),earth=material('earth','#747e65'),wallMat=material('wall','#8e8c7e'),baseMat=material('base','#777367'),gunMat=material('weapon','#353b38');
const ground=B.MeshBuilder.CreateGround('terrain',{width:44,height:44},scene);ground.material=earth;ground.receiveShadows=true;
const obstacles=[];
function block(name,x,z,w,d,h){const mesh=B.MeshBuilder.CreateBox(name,{width:w,depth:d,height:h},scene);mesh.position.set(x,h/2,z);mesh.material=wallMat;mesh.receiveShadows=true;shadow.addShadowCaster(mesh);obstacles.push({x,z,w,d});return mesh;}
block('wall-north',-4,-5,6,.7,1.2);block('wall-east',6,4,.7,6,1.2);block('tank-trap',0,6,1.5,1.5,.8);
const base=B.MeshBuilder.CreateBox('command-base',{width:3,height:2.6,depth:3},scene);base.position.set(-10,1.3,-9);base.material=baseMat;base.receiveShadows=true;shadow.addShadowCaster(base);
function soldier(id,team,x,z){const root=new B.TransformNode(id,scene);root.position.set(x,0,z);
 const body=B.MeshBuilder.CreateCapsule(id+'-body',{height:1.65,radius:.29,tessellation:8},scene);body.parent=root;body.position.y=.88;body.material=team==='ally'?olive:grey;shadow.addShadowCaster(body);
 const head=B.MeshBuilder.CreateSphere(id+'-head',{diameter:.38,segments:8},scene);head.parent=root;head.position.y=1.7;head.material=skin;shadow.addShadowCaster(head);
 const weapon=B.MeshBuilder.CreateBox(id+'-rifle',{width:.10,height:.10,depth:.78},scene);weapon.parent=root;weapon.position.set(.23,1.23,.30);weapon.material=gunMat;
 const unit={id,team,root,hp:100,speed:team==='ally'?3.0:1.35,target:null,cooldown:Math.random()*.6,alive:true,body,head,weapon};
 root.getChildMeshes().forEach(m=>m.metadata={unit});return unit;}
for(let i=0;i<4;i++)state.units.push(soldier('brit-'+i,'ally',-8+(i%2)*1.2,2+Math.floor(i/2)*1.3));
for(let i=0;i<4;i++)state.enemies.push(soldier('german-'+i,'enemy',8+(i%2)*1.5,-3+Math.floor(i/2)*1.5));
// Stage 2: one real rigged soldier, isolated from the squad combat simulation.
// The other seven placeholders remain available if asset loading fails.
async function installAnimatedHero(unit){
 const base=new URL('../assets/native-hero-quaternius/',import.meta.url);
 const imported=await B.SceneLoader.ImportMeshAsync('','',new URL('night-striker-lite.glb',base).href,scene);
 const rig=new B.TransformNode(unit.id+'-rig',scene);
 for(const node of imported.meshes.filter(m=>!m.parent))node.parent=rig;
 const bounds=imported.meshes.filter(m=>m.getBoundingInfo&&m.getTotalVertices()>0).map(m=>m.getBoundingInfo().boundingBox);
 let lo=Infinity,hi=-Infinity;
 for(const b of bounds){lo=Math.min(lo,b.minimumWorld.y);hi=Math.max(hi,b.maximumWorld.y);}
 if(Number.isFinite(hi-lo)&&hi-lo>.01)rig.scaling.scaleInPlace(1.8/(hi-lo));
 rig.parent=unit.root;
 const clips=await B.SceneLoader.LoadAssetContainerAsync('',new URL('hero-three-clips-lite.glb',base).href,scene);
 const normalize=name=>String(name||'').replace(/^mixamorig[:_]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const targets=new Map();
 for(const node of [...imported.transformNodes,...imported.meshes,...imported.skeletons.flatMap(sk=>sk.bones)]){
  const key=normalize(node.name);if(key&&!targets.has(key))targets.set(key,node);
 }
 const groups={};const counts={};
 for(const [mode,name] of Object.entries({idle:'Idle_Loop',jog:'Jog_Fwd_Loop',sprint:'Sprint_Loop'})){
  const source=clips.animationGroups.find(g=>g.name===name||g.name.includes(name));
  if(!source)continue;
  const group=new B.AnimationGroup(unit.id+'-'+mode,scene);let count=0;
  for(const track of source.targetedAnimations){
   const target=targets.get(normalize(track.target?.name));
   if(target){group.addTargetedAnimation(track.animation.clone(),target);count++;}
  }
  if(count){group.normalize();groups[mode]=group;counts[mode]=count;}else group.dispose();
 }
 if(!groups.idle||!groups.jog)throw Error('Rig animation mapping incomplete: '+JSON.stringify(counts));
 unit.body.setEnabled(false);unit.head.setEnabled(false);unit.weapon.setEnabled(false);
 unit.visualRig=rig;unit.animations=groups;unit.activeAnimation=null;
 unit.animationTracks=counts;
 const play=mode=>{if(unit.activeAnimation===mode)return;for(const group of Object.values(groups))group.stop();groups[mode]?.start(true);unit.activeAnimation=mode;};
 unit.updateVisual=()=>play(unit.target?'jog':'idle');
 play('idle');
 // Loaded clip containers are only used as animation sources; their scene
 // nodes are not added, preventing a second visible character.
 state.heroRig={loaded:true,bones:imported.skeletons.reduce((n,sk)=>n+sk.bones.length,0),tracks:counts};
}
installAnimatedHero(state.units[0]).catch(error=>{
 state.errors.push('Hero rig: '+String(error));state.heroRig={loaded:false,error:String(error)};
 console.error('Animated hero failed; procedural soldier remains',error);
});
const marker=B.MeshBuilder.CreateTorus('destination',{diameter:.7,thickness:.06,tessellation:16},scene);marker.position.y=.07;marker.isVisible=false;marker.material=material('marker','#e9d487');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function free(x,z){if(Math.abs(x)>20||Math.abs(z)>20)return false;return !obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.36&&Math.abs(z-o.z)<o.d/2+.36);}
function command(x,z){if(!state.selected)return;marker.position.x=x;marker.position.z=z;marker.isVisible=true;
 state.units.filter(u=>u.alive).forEach((u,i)=>{const tx=x+((i%2)-.5)*1.35,tz=z+(Math.floor(i/2)-.5)*1.35;u.target={x:tx,z:tz};});}
function moveUnit(u,dt){if(!u.target)return;const p=u.root.position,dx=u.target.x-p.x,dz=u.target.z-p.z,len=Math.hypot(dx,dz);if(len<.13){u.target=null;return;}
 const step=Math.min(len,u.speed*dt),nx=p.x+dx/len*step,nz=p.z+dz/len*step;
 if(free(nx,nz)){p.x=nx;p.z=nz;}else{const sideA={x:p.x+(-dz/len)*step,z:p.z+(dx/len)*step},sideB={x:p.x+(dz/len)*step,z:p.z+(-dx/len)*step};const side=free(sideA.x,sideA.z)?sideA:free(sideB.x,sideB.z)?sideB:null;if(side){p.x=side.x;p.z=side.z;}}
 u.root.rotation.y=Math.atan2(dx,dz);}
function shoot(u,v){u.cooldown=.7+Math.random()*.5;v.hp-=24;state.shots++;const line=B.MeshBuilder.CreateLines('tracer',{points:[new B.Vector3(u.root.position.x,1.2,u.root.position.z),new B.Vector3(v.root.position.x,1.2,v.root.position.z)]},scene);line.color=new B.Color3(1,.8,.3);setTimeout(()=>line.dispose(),95);
 if(v.hp<=0){v.alive=false;v.root.setEnabled(false);state.kills++;}}
function fight(u,targets,dt){if(!u.alive)return;u.cooldown=Math.max(0,u.cooldown-dt);const candidates=targets.filter(v=>v.alive).sort((a,b)=>distance(u.root.position,a.root.position)-distance(u.root.position,b.root.position));const target=candidates[0];if(!target)return;
 const range=distance(u.root.position,target.root.position);if(u.team==='enemy'&&range>6.5)u.target={x:target.root.position.x,z:target.root.position.z};if(range<7.5&&u.cooldown===0){u.root.rotation.y=Math.atan2(target.root.position.x-u.root.position.x,target.root.position.z-u.root.position.z);shoot(u,target);}}
function handlePointer(ev){if(ev.button===2)ev.preventDefault();const pick=scene.pick(scene.pointerX,scene.pointerY);if(!pick?.hit)return;const unit=pick.pickedMesh?.metadata?.unit;if(state.mode==='attack'&&unit?.team==='enemy'){command(unit.root.position.x,unit.root.position.z);return;}
 const point=pick.pickedPoint;if(point&&pick.pickedMesh===ground)command(point.x,point.z);}
scene.onPointerObservable.add(e=>{if(e.type===B.PointerEventTypes.POINTERDOWN&&e.event.button!==1)handlePointer(e.event);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.getElementById('select').onclick=()=>{state.selected=!state.selected;document.getElementById('select').textContent=state.selected?'Выбрать отряд ✓':'Выбрать отряд';};
for(const mode of ['move','attack'])document.getElementById(mode).onclick=()=>{state.mode=mode;for(const m of ['move','attack'])document.getElementById(m).setAttribute('aria-pressed',String(m===mode));};
document.getElementById('reset').onclick=()=>location.reload();
let last=performance.now();engine.runRenderLoop(()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
 for(const u of [...state.units,...state.enemies])if(u.alive){moveUnit(u,dt);u.updateVisual?.();}
 for(const u of state.units)fight(u,state.enemies,dt);for(const u of state.enemies)fight(u,state.units,dt);
 status.textContent='Британцы '+state.units.filter(u=>u.alive).length+'/4 · Немцы '+state.enemies.filter(u=>u.alive).length+'/4 · Выстрелы '+state.shots+' · FPS '+Math.round(engine.getFps());
 if(state.heroRig&&!state.heroRig.loaded)status.textContent+=' · Модель: резервная';
 scene.render();});
window.addEventListener('resize',()=>engine.resize());state.ready=true;