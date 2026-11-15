// Battlefield · independent reference viewer using the source author's REAL 90-joint rig.
// No binary assets are redistributed. The GLBs are fetched directly from the source repo.
// Revision: start the rendering loop immediately, check GLB headers, surface download errors,
// and do not let a broken animation pack hide a successfully loaded model.
const B=window.BABYLON;
const view=document.querySelector('#view');
const status=document.querySelector('#status');
const retry=document.querySelector('#retry');
const state={ready:false,modelReady:false,animationsReady:false,error:null,stage:'init',source:'duolahypercho/ar-rifle-demo',
 clip:null,matched:{},boneCount:0,downloaded:{},loadErrors:[],renderFrames:0};
window.__rifle90=state;
const sha='a6734b81a0679647cf26a30f1a0f6807b8f3b4bc';
const prefix='/public/characters/';
const hosts=[
 {name:'GitHub Raw',base:'https://raw.githubusercontent.com/duolahypercho/ar-rifle-demo/'+sha+prefix},
 {name:'GitHack',base:'https://raw.githack.com/duolahypercho/ar-rifle-demo/'+sha+prefix},
 // Important: jsDelivr GitHub delivery is limited to 20MB per file.
 {name:'jsDelivr (files under 20MB)',base:'https://cdn.jsdelivr.net/gh/duolahypercho/ar-rifle-demo@'+sha+prefix}
];
const milestones=[];
function report(message){
 state.stage=message;
 milestones.push(message);if(milestones.length>8)milestones.shift();
 status.textContent=message+'\n'+(state.modelReady?'Модель: ЗАГРУЖЕНА · '+state.boneCount+' костей':'Модель: ещё не загружена')
 +'\n'+(state.animationsReady?'Анимации: загружены':'Анимации: ожидание / загрузка')
 +(state.loadErrors.length?'\nОшибки источников:\n'+state.loadErrors.slice(-3).join('\n'):'');
 console.info('[Rifle90]',message);
}
const fail=e=>{
 state.error=String(e?.stack||e);
 report('ОШИБКА: '+(e?.message||String(e)));
 console.error('[Rifle90]',e);
 retry.hidden=false;
};
// Fetch ourselves to detect 404, HTML error pages, size limits and invalid binary.
// Blob URLs require explicit ".glb" loader selection.
async function downloadGLB(filename){
 const failures=[];
 for(const host of hosts){
  const url=host.base+filename;
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort('Timeout'),45000);
  try{
   report('Скачивание '+filename+' · '+host.name+'…');
   const response=await fetch(url,{mode:'cors',signal:abort.signal,cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status+' '+response.statusText);
   const parts=[];let received=0;
   if(response.body?.getReader){
    const reader=response.body.getReader();
    while(true){
     const {done,value}=await reader.read();if(done)break;
     parts.push(value);received+=value.byteLength;
     if(received%1048576<value.byteLength)report(filename+' · '+host.name+' · '+(received/1048576).toFixed(1)+' МБ');
    }
   }else{
    const buf=await response.arrayBuffer();parts.push(buf);received=buf.byteLength;
   }
   const blob=new Blob(parts,{type:'model/gltf-binary'});
   if(await blob.slice(0,4).text()!=='glTF')throw Error('Получен не GLB (первые байты отличаются от glTF)');
   if(blob.size<20)throw Error('GLB-файл пустой');
   state.downloaded[filename]={source:host.name,bytes:blob.size};
   state.loadErrors.push(...failures);
   report('Файл '+filename+' загружен: '+(blob.size/1048576).toFixed(1)+' МБ · '+host.name);
   return URL.createObjectURL(blob);
  }catch(e){
   const message=host.name+' '+filename+': '+(e?.name==='AbortError'?'тайм-аут 45 с':String(e?.message||e));
   failures.push(message);
   console.warn('[Rifle90]',message);
  }finally{clearTimeout(timeout);}
 }
 state.loadErrors.push(...failures);
 throw Error('Ни один источник не отдал '+filename+'. '+failures.join(' | '));
}
function playerScene(){
 const engine=new B.Engine(view,true,{stencil:true,preserveDrawingBuffer:false,disableWebGL2Support:false});
 const scene=new B.Scene(engine);
 scene.clearColor=new B.Color4(.19,.26,.22,1);
 const camera=new B.ArcRotateCamera('inspection',Math.PI/2.65,1.12,4.3,new B.Vector3(0,1,0),scene);
 camera.attachControl(view,true);camera.lowerRadiusLimit=2;camera.upperRadiusLimit=10;
 const ambient=new B.HemisphericLight('fill',new B.Vector3(0,1,0),scene);ambient.intensity=1.5;
 const sun=new B.DirectionalLight('sun',new B.Vector3(-1,-1,-.5),scene);sun.intensity=1.1;
 const floor=B.MeshBuilder.CreateGround('terrain',{width:12,height:12},scene);
 const mat=new B.StandardMaterial('earth',scene);
 mat.diffuseColor=new B.Color3(.25,.32,.24);floor.material=mat;
 // Visible from the FIRST frame, including while remote assets are downloading.
 const ring=B.MeshBuilder.CreateTorus('inspection-circle',{diameter:2,thickness:.012,tessellation:48},scene);
 ring.position.y=.008;
 const ringMat=new B.StandardMaterial('inspection-guide',scene);
 ringMat.emissiveColor=new B.Color3(.55,.69,.43);ring.material=ringMat;
 const marker=B.MeshBuilder.CreateSphere('preview-loading-marker',{diameter:.13,segments:10},scene);
 marker.position.set(0,1.0,0);
 const markerMat=new B.StandardMaterial('preview-loading',scene);
 markerMat.emissiveColor=new B.Color3(.95,.67,.20);marker.material=markerMat;
 engine.runRenderLoop(()=>{marker.rotation.y+=.015;scene.render();state.renderFrames++;});
 window.addEventListener('resize',()=>engine.resize());
 return {scene,engine,marker,camera};
}
async function loadModel(scene){
 const blobUrl=await downloadGLB('civilian-m-01-player-ue5.glb');
 let model;
 try{
  // Legacy loader signature: meshNames, rootUrl, sceneFilename, scene, progress, extension.
  model=await B.SceneLoader.ImportMeshAsync('','',blobUrl,scene,undefined,'.glb');
 }finally{URL.revokeObjectURL(blobUrl);}
 const bones=model.skeletons.reduce((n,s)=>n+s.bones.length,0);
 if(bones!==90)throw Error('Количество костей: '+bones+' вместо 90');
 const root=new B.TransformNode('reference90-world',scene);
 const roots=[...model.meshes,...model.transformNodes].filter(n=>!n.parent&&n!==root);
 for(const node of roots)node.parent=root;
 const skins=model.meshes.filter(m=>m.getBoundingInfo&&m.getTotalVertices()>0);
 if(!skins.length)throw Error('В GLB нет видимой геометрии');
 // Use the model's original authored rest-pose. No hand/bone math in the viewer.
 for(const mesh of skins)mesh.computeWorldMatrix(true);
 const bounds=skins.map(m=>m.getBoundingInfo().boundingBox);
 const lo=Math.min(...bounds.map(b=>b.minimumWorld.y)),hi=Math.max(...bounds.map(b=>b.maximumWorld.y));
 if(Number.isFinite(hi-lo)&&hi-lo>.1){
  const scale=1.85/(hi-lo);root.scaling.setAll(scale);root.position.y=-lo*scale;
 }
 state.modelAudit={
  meshes:skins.map(m=>({name:m.name,vertices:m.getTotalVertices(),material:m.material?.name,subMaterials:m.material?.subMaterials?.map(x=>x?.name),bounds:{low:m.getBoundingInfo().boundingBox.minimumWorld.asArray(),high:m.getBoundingInfo().boundingBox.maximumWorld.asArray()}})),
  materials:scene.materials.map(m=>({name:m.name,class:m.getClassName?.(),albedo:m.albedoColor?.toHexString?.(),diffuse:m.diffuseColor?.toHexString?.(),hasTexture:!!(m.albedoTexture||m.diffuseTexture)})),
  transforms:model.transformNodes.filter(n=>/head|spine|neck|pelvis|clavicle|foot/i.test(n.name)).slice(0,30).map(n=>({name:n.name,parent:n.parent?.name||null,local:n.position?.asArray?.()}))
 };
 console.info('WEHRMACHT_BODY_AUDIT '+JSON.stringify(state.modelAudit));
 state.boneCount=bones;state.modelReady=true;state.modelSource=state.downloaded['civilian-m-01-player-ue5.glb'];
 report('Оригинальная модель: 90 костей подтверждены. Загружаем анимации…');
 return model;
}
async function loadAnimations(scene,model){
 const blobUrl=await downloadGLB('rifle-motion-ue5-v1.glb');
 let pack;
 try{pack=await B.SceneLoader.LoadAssetContainerAsync('',blobUrl,scene,undefined,'.glb');}
 finally{URL.revokeObjectURL(blobUrl);}
 const norm=s=>String(s||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const nodes=[...model.transformNodes,...model.meshes,...model.skeletons.flatMap(s=>s.bones)];
 const lookup=new Map();
 for(const node of nodes){const key=norm(node.name);if(key&&!lookup.has(key))lookup.set(key,node);}
 const names=['rifle-idle','rifle-walk-f','rifle-jog-f','rifle-sprint','rifle-aim-level','rifle-hold-high'];
 const groups={};const matched={};const missing={};
 for(const name of names){
  const original=pack.animationGroups.find(g=>g.name===name||g.name.endsWith(name));
  if(!original){matched[name]=0;missing[name]=['missing animation group'];continue;}
  const group=new B.AnimationGroup('reference-'+name,scene);let count=0;
  const misses=[];
  for(const track of original.targetedAnimations){
   const boneName=track.target?.name||'';
   // The original demo moves its character using gameplay/root motion.
   // Keep this viewer stationary, while preserving limb/pelvis rotations.
   if(track.animation.targetProperty==='position'&&/^(root|pelvis)$/i.test(boneName))continue;
   const target=lookup.get(norm(boneName));
   if(!target){if(misses.length<12)misses.push(boneName);continue;}
   group.addTargetedAnimation(track.animation.clone(),target);count++;
  }
  if(count>0){group.normalize();groups[name]=group;}else group.dispose();
  matched[name]=count;missing[name]=misses;
 }
 state.matched=matched;state.missing=missing;
 if(!groups['rifle-idle']||!groups['rifle-walk-f']||!groups['rifle-aim-level']){
  throw Error('Анимации не связаны со скелетом: '+JSON.stringify(matched));
 }
 const stop=()=>Object.values(groups).forEach(group=>group.stop());
 const select=name=>{
  const group=groups[name];if(!group){report('Недоступная анимация: '+name);return;}
  stop();group.start(true);state.clip=name;
  for(const button of document.querySelectorAll('[data-clip]'))
   button.setAttribute('aria-pressed',String(button.dataset.clip===name));
  report('Анимация: '+name+' · '+matched[name]+' дорожек · FPS '+Math.round(state.engine.getFps()));
 };
 for(const button of document.querySelectorAll('[data-clip]'))button.onclick=()=>select(button.dataset.clip);
 state.groups=groups;state.animationsReady=true;state.ready=true;state.packSource=state.downloaded['rifle-motion-ue5-v1.glb'];
 select('rifle-idle');
}
async function main(){
 if(!B||!B.SceneLoader){fail(Error('Не удалось загрузить Babylon.js. Проверь подключение к cdn.babylonjs.com'));return;}
 // Immediately render even if model/animation download fails.
 let sceneParts;
 try{sceneParts=playerScene();}catch(e){fail(e);return;}
 const {scene,engine,marker}=sceneParts;
 state.scene=scene;state.engine=engine;report('3D-сцена создана. Подключаем источник оригинального скелета…');
 try{
  if(!B.SceneLoader.IsPluginForExtensionAvailable('.glb'))throw Error('GLB-плагин Babylon не загружен');
  const model=await loadModel(scene);
  marker.setEnabled(false);retry.hidden=true;
  await loadAnimations(scene,model);
 }catch(e){fail(e);}
}
retry.onclick=()=>location.reload();
main();
