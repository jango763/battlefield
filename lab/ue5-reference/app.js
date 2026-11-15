// Battlefield animation reference only. Does not change legacy or new game.
const B=window.BABYLON,view=document.querySelector('#view'),status=document.querySelector('#status');
const state={ready:false,error:null,source:'duolahypercho/ar-rifle-demo',clip:null,matched:{},boneCount:0};
window.__rifle90=state;
const SHA='a6734b81a0679647cf26a30f1a0f6807b8f3b4bc';
const baseA='https://cdn.jsdelivr.net/gh/duolahypercho/ar-rifle-demo@'+SHA+'/public/characters/';
const baseB='https://raw.githack.com/duolahypercho/ar-rifle-demo/'+SHA+'/public/characters/';
const show=s=>{status.textContent=s;console.info('[Rifle90]',s);};
async function importWithFallback(name,container,scene){
 const errors=[];
 for(const url of [baseA+name,baseB+name]){
  try{
   if(container)return await B.SceneLoader.LoadAssetContainerAsync('',url,scene);
   return await B.SceneLoader.ImportMeshAsync(null,'',url,scene);
  }catch(e){errors.push(new URL(url).hostname+': '+String(e).slice(0,180));}
 }
 throw Error('Cannot load '+name+'; '+errors.join(' | '));
}
async function start(){
 if(!B)throw Error('Babylon.js CDN unavailable');
 const engine=new B.Engine(view,true,{stencil:true,preserveDrawingBuffer:false});
 const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.22,.29,.26,1);
 const cam=new B.ArcRotateCamera('inspection',-Math.PI/2.55,1.12,4.4,new B.Vector3(0,1,0),scene);
 cam.attachControl(view,true);cam.lowerRadiusLimit=2;cam.upperRadiusLimit=10;
 new B.HemisphericLight('fill',new B.Vector3(0,1,0),scene).intensity=1.5;
 const sun=new B.DirectionalLight('sun',new B.Vector3(-1,-1,-.5),scene);sun.intensity=1.25;
 const ground=B.MeshBuilder.CreateGround('ground',{width:12,height:12},scene);
 const mat=new B.StandardMaterial('grass',scene);mat.diffuseColor=new B.Color3(.25,.32,.24);ground.material=mat;
 show('Загружаем оригинальную модель UE5 (90 костей)…');
 const model=await importWithFallback('civilian-m-01-player-ue5.glb',false,scene);
 const sk=model.skeletons[0];
 state.boneCount=sk?.bones?.length||0;
 if(state.boneCount!==90)throw Error('Expected 90 joints, got '+state.boneCount);
 const root=new B.TransformNode('character-world',scene);
 // Only root-level geometry is parented. Skin and linked bone targets
 // remain a single hierarchy under root, so there are no duplicate hands.
 for(const mesh of model.meshes.filter(m=>!m.parent))mesh.parent=root;
 // Fit the full model to 1.85 meters and move feet to the ground.
 const visible=model.meshes.filter(m=>m.getBoundingInfo&&m.getTotalVertices()>0);
 const limits=()=>visible.map(mesh=>{mesh.computeWorldMatrix(true);return mesh.getBoundingInfo().boundingBox;});
 let bs=limits();let lo=Math.min(...bs.map(b=>b.minimumWorld.y)),hi=Math.max(...bs.map(b=>b.maximumWorld.y));
 if(Number.isFinite(hi-lo)&&(hi-lo)>.01){
  const scale=1.85/(hi-lo);root.scaling.setAll(scale);root.position.y=-lo*scale;
 }
 show('90 костей подтверждены. Загружаем оригинальные клипы Blender…');
 const pack=await importWithFallback('rifle-motion-ue5-v1.glb',true,scene);
 const normalize=n=>String(n||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const targets=[...model.transformNodes,...model.meshes,...model.skeletons.flatMap(s=>s.bones)];
 const index=new Map();for(const node of targets){const key=normalize(node.name);if(key&&!index.has(key))index.set(key,node);}
 const names=['rifle-idle','rifle-walk-f','rifle-jog-f','rifle-sprint','rifle-aim-level','rifle-hold-high'];
 const groups={},matched={};
 for(const name of names){
  const original=pack.animationGroups.find(g=>g.name===name||g.name.endsWith(name));
  if(!original){matched[name]=0;continue;}
  const group=new B.AnimationGroup('reference-'+name,scene);
  let count=0;
  for(const track of original.targetedAnimations){
   // Hide root-motion translations: this is a stationary inspection rig.
   if(track.animation.targetProperty==='position'&&/root|pelvis/i.test(track.target?.name||''))continue;
   const target=index.get(normalize(track.target?.name));
   if(!target)continue;
   group.addTargetedAnimation(track.animation.clone(),target);count++;
  }
  if(count){group.normalize();groups[name]=group;}else group.dispose();
  matched[name]=count;
 }
 state.matched=matched;
 if(!groups['rifle-idle']||!groups['rifle-walk-f']||!groups['rifle-aim-level'])throw Error('Missing key animation channels: '+JSON.stringify(matched));
 const stop=()=>Object.values(groups).forEach(g=>g.stop());
 const select=name=>{
  if(!groups[name]){show('Клип не найден: '+name);return;}
  stop();state.clip=name;groups[name].start(true,1,groups[name].from,groups[name].to,false);
  for(const button of document.querySelectorAll('[data-clip]'))button.setAttribute('aria-pressed',String(button.dataset.clip===name));
 };
 for(const button of document.querySelectorAll('[data-clip]'))button.onclick=()=>select(button.dataset.clip);
 select('rifle-idle');
 state.ready=true;state.scene=scene;state.engine=engine;state.groups=groups;
 engine.runRenderLoop(()=>{
  scene.render();
  if((engine.getFrameId()%20)===0)show('СКЕЛЕТ: '+state.boneCount+' костей · АНИМАЦИЯ: '+state.clip+
    '\nДорожки клипов: '+JSON.stringify(state.matched)+'\nFPS: '+Math.round(engine.getFps())+
    '\nИсточники: original UE5 rig + rifle-motion-ue5-v1.glb');
 });
 window.addEventListener('resize',()=>engine.resize());
}
start().catch(e=>{state.error=String(e?.stack||e);show('ОШИБКА ЗАГРУЗКИ: '+state.error);console.error(e);});
