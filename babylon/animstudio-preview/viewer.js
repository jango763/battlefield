/* Preview ONLY. Standalone from Babylon gameplay and Three.js main.
   Loads all 16 real AnimStudio exported animation groups from one GLB. */
(async function(){
  'use strict';
  const B=window.BABYLON;
  const state={loaded:false,ready:false,error:null,weapon:'Kar98k',pose:'Hold',
    clips:[],weapons:{},played:[],all:false};
  window.__BATTLEFIELD_ANIMATIONS__=state;
  const canvas=document.querySelector('#canvas');
  const status=document.querySelector('#status');
  const info=document.querySelector('#info');
  const allButton=document.querySelector('#playall');
  const variants={
    Kar98k:{path:'../../assets/ww2-weapons/',file:'de-kar98k.glb'},
    MP40:{path:'../../assets/ww2-weapons/',file:'de-mp40.glb'},
    MG42:{path:'../../assets/ww2-weapons/',file:'de-mg42.glb'},
    Panzerschreck:{path:'./models/',file:'de-panzerschreck-preview.glb'}
  };
  const poses=['Hold','Aim','Fire','Walk'];
  let scene,engine,active=null,socket=null,root=null,scale=1,autoHandle=null;
  function reportError(e){
    state.error=String(e?.stack||e);
    console.error('AnimStudio preview:',e);
    status.textContent='Ошибка просмотра: '+String(e?.message||e);
    document.querySelector('#error').textContent=state.error;
    state.ready=true;
  }
  function buttons(){
    document.querySelectorAll('[data-weapon]').forEach(el=>
      el.setAttribute('aria-pressed',String(el.dataset.weapon===state.weapon)));
    document.querySelectorAll('[data-pose]').forEach(el=>
      el.setAttribute('aria-pressed',String(el.dataset.pose===state.pose)));
    allButton.setAttribute('aria-pressed',String(state.all));
    allButton.textContent=state.all?'■ Остановить показ 16 анимаций':'▶ Показать все 16 по очереди';
    info.textContent=state.weapon+' · '+({
      Hold:'стойка с оружием',Aim:'прицеливание',Fire:'цикл стрельбы',Walk:'ходьба с оружием'
    }[state.pose]||'')+(state.weapon==='Panzerschreck'?' · макет':'');
  }
  function stopAuto(){
    state.all=false;clearInterval(autoHandle);autoHandle=null;buttons();
  }
  function findSocket(imported){
    const bones=imported.skeletons.flatMap(x=>x.bones);
    const bone=bones.find(x=>x.name==='Weapon_R');
    if(!bone)throw Error('В экспортированной модели нет Weapon_R');
    const node=bone.getTransformNode?.() || imported.transformNodes.find(n=>n.name==='Weapon_R');
    if(!node)throw Error('Не найден управляющий узел Weapon_R');
    state.socket=node.name;
    return node;
  }
  async function prepareWeapon(name){
    if(state.weapons[name])return state.weapons[name];
    const data=variants[name];
    const imported=await B.SceneLoader.ImportMeshAsync('',data.path,data.file,scene);
    const holder=new B.TransformNode('prop_'+name,scene);
    holder.parent=socket;
    holder.scaling.setAll(1/scale);
    holder.position.set(0,0,0);
    holder.rotationQuaternion=B.Quaternion.Identity();
    const children=[...imported.meshes,...imported.transformNodes];
    for(const node of children){if(!node.parent)node.parent=holder;}
    holder.setEnabled(false);
    state.weapons[name]=holder;
    return holder;
  }
  function playClip(){
    for(const group of scene.animationGroups)group.stop();
    const name=state.weapon+'_'+state.pose;
    const clip=scene.animationGroups.find(g=>g.name===name);
    if(!clip)throw Error('Отсутствует анимация '+name);
    clip.start(true,1,clip.from,clip.to,false);
    active=clip;
    state.clip=name;
    state.currentDuration=(clip.to-clip.from)/30;
    status.textContent='Сейчас: '+state.weapon+' / '+state.pose+' · 16 анимаций доступны · вращайте и увеличивайте';
    buttons();
  }
  async function show(weapon,pose){
    state.weapon=weapon;state.pose=pose;
    buttons();
    const holder=await prepareWeapon(weapon);
    if(state.weapon!==weapon)return;
    for(const [id,prop] of Object.entries(state.weapons))
      prop.setEnabled(id===weapon);
    playClip();
    state.played.push(weapon+'_'+pose);
  }
  state.show=show;
  state.playAll=async()=>{
    if(state.all){stopAuto();return;}
    state.all=true;buttons();
    let index=0;
    const sequence=Object.keys(variants).flatMap(gun=>poses.map(pose=>[gun,pose]));
    async function next(){
      if(!state.all)return;
      const [gun,pose]=sequence[index++%sequence.length];
      await show(gun,pose);
    }
    await next();
    autoHandle=setInterval(next,2700);
  };
  document.querySelectorAll('[data-weapon]').forEach(el=>el.addEventListener('click',()=>{
    stopAuto();show(el.dataset.weapon,state.pose).catch(reportError);
  }));
  document.querySelectorAll('[data-pose]').forEach(el=>el.addEventListener('click',()=>{
    stopAuto();show(state.weapon,el.dataset.pose).catch(reportError);
  }));
  allButton.addEventListener('click',()=>state.playAll().catch(reportError));
  try{
    if(!B?.SceneLoader)throw Error('Не загружен Babylon.js');
    engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,powerPreference:'high-performance'});
    engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/1.8));
    scene=new B.Scene(engine);
    scene.useRightHandedSystem=true;
    scene.clearColor=new B.Color4(.11,.17,.15,1);
    scene.ambientColor=new B.Color3(.3,.35,.33);
    const camera=new B.ArcRotateCamera('orbit',.23*Math.PI,.42*Math.PI,3.0,new B.Vector3(0,.97,0),scene);
    camera.lowerRadiusLimit=1.25;camera.upperRadiusLimit=6;camera.wheelDeltaPercentage=.013;
    camera.pinchDeltaPercentage=.015;camera.inertia=.65;camera.attachControl(canvas,true);
    const ambient=new B.HemisphericLight('soft skylight',new B.Vector3(0,1,0),scene);
    ambient.intensity=1.35;
    const key=new B.DirectionalLight('soft sun',new B.Vector3(-.58,-1,-.4),scene);
    key.intensity=1.9;key.diffuse=new B.Color3(1,.92,.81);
    const back=new B.DirectionalLight('edge',new B.Vector3(.5,-.2,.8),scene);
    back.intensity=.7;
    engine.runRenderLoop(()=>scene.render());
    window.addEventListener('resize',()=>engine.resize());

    const imported=await B.SceneLoader.ImportMeshAsync('','./models/','all-animations.glb',scene);
    const drawable=imported.meshes.filter(m=>m.getTotalVertices?.()>0);
    const min=new B.Vector3(Infinity,Infinity,Infinity);
    const max=new B.Vector3(-Infinity,-Infinity,-Infinity);
    for(const mesh of drawable){
      mesh.computeWorldMatrix(true);
      const b=mesh.getBoundingInfo().boundingBox;
      min.minimizeInPlace(b.minimumWorld);
      max.maximizeInPlace(b.maximumWorld);
    }
    const height=max.y-min.y;
    if(!Number.isFinite(height)||height<=0)throw Error('Нет видимой модели солдата');
    root=new B.TransformNode('approved-character-display',scene);
    for(const mesh of imported.meshes){if(!mesh.parent)mesh.parent=root;}
    for(const node of imported.transformNodes){if(!node.parent)node.parent=root;}
    scale=1.8/height;
    root.scaling.setAll(scale);
    root.position.set(-.5*(min.x+max.x)*scale,-min.y*scale,-.5*(min.z+max.z)*scale);
    root.computeWorldMatrix(true);
    socket=findSocket(imported);
    state.clips=scene.animationGroups.map(g=>g.name);
    state.meshCount=drawable.length;
    state.skeletonBones=Math.max(...imported.skeletons.map(x=>x.bones.length));
    if(state.clips.filter(n=>/^(Kar98k|MP40|MG42|Panzerschreck)_(Hold|Aim|Fire|Walk)$/.test(n)).length!==16)
      throw Error('Проверка обнаружила не 16 анимаций');
    await show(state.weapon,state.pose);
    state.loaded=true;state.ready=true;
  }catch(e){reportError(e);}
})();