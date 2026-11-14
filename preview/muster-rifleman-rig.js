/*
 * EXPERIMENTAL ONE-SOLDIER SKIN TRANSFER (Muster WWII -> Quaternius).
 * Original British rifleman model © 2026 Kenton Wang, MIT.
 * Credit and license: assets/muster-british/LICENSE-MUSTER.txt
 *
 * This is NOT a production skin/animation. Source GLB is static and the
 * per-vertex influences are an approximate inferred anatomical segmentation.
 * Real weight painting/rigging is still needed for high-quality deformation.
 *
 * This experiment is active ONLY with:
 * ?inspect=muster-rig&armyRig=pilot
 * No battlefield unit, weapon damage, AI, formation or animation source changes.
 */
const musterRifleRig={
  scene:null,camera:null,sourceLoaded:false,ready:false,error:null,
  skinnedMeshes:[],rig:null,motion:'jog',lastTime:0,
  progress:null,buttons:[],skinnedVerts:0,triangles:0
};

function musterRigAddWeight(out,index,value){
  if(value>1e-6)out[index]=(out[index]||0)+value;
}
function musterRigSemantic(mesh){
  let p=mesh,names=[];
  while(p){if(p.name)names.push(p.name.toLowerCase());p=p.parent;}
  const route=names.join(' ');
  if(route.includes('weapon'))return 'weapon';
  if(/helmet|headband|liner-fingers|crown-pad/.test(route))return 'helmet';
  if(/(^| )head( |$)|(^| )eye( |$)|hair/.test(route))return 'head';
  if(/hand-l|hand_l/.test(route))return 'hand_l';
  if(/hand-r|hand_r/.test(route))return 'hand_r';
  if(/boot-l|sole-l|lace-l/.test(route))return 'foot_l';
  if(/boot-r|sole-r|lace-r/.test(route))return 'foot_r';
  return 'body';
}
// Anatomical envelope weights use original model vertex positions, not the
// current animated positions. Blends at knee, hip, shoulder and elbows are
// smooth so source trouser and sleeve triangles actually deform.
function musterRigWeights(x,y,z,kind,bones){
  const scores={};
  const add=(name,w)=>musterRigAddWeight(scores,bones[name],w);
  const clamp=(v)=>Math.max(0,Math.min(1,v));
  const blend=(y,a,b)=>clamp((y-a)/Math.max(1e-6,b-a));
  if(kind==='weapon'){add('hand_r',1);}
  else if(kind==='helmet'||kind==='head'){add('Head',1);}
  else if(kind==='hand_l'||kind==='hand_r'){add(kind,1);}
  else if(kind==='foot_l'||kind==='foot_r'){add(kind,1);}
  else if(y<1.26){
    const side=x>=0?'l':'r';
    const leg=1-blend(y,1.06,1.26);
    const foot=1-blend(y,.17,.29);
    const calf=blend(y,.13,.26)*(1-blend(y,.50,.71));
    const thigh=blend(y,.49,.72)*(1-blend(y,1.05,1.24));
    add('pelvis',1-leg);
    add('foot_'+side,leg*foot);
    add('calf_'+side,leg*calf*(1-foot));
    add('thigh_'+side,leg*Math.max(.03,thigh+(1-calf)*(1-foot)*.65));
  }else{
    const shoulder=clamp((Math.abs(x)-.19)/.20)*
      blend(y,1.26,1.46)*(1-blend(y,1.94,2.12));
    const side=x>=0?'l':'r';
    const forearm=blend(Math.abs(x),.32,.55);
    add('clavicle_'+side,shoulder*.10);
    add('upperarm_'+side,shoulder*.9*(1-forearm));
    add('lowerarm_'+side,shoulder*.9*forearm);
    const chest=1-shoulder;
    if(y<1.38){add('spine_01',chest);}
    else if(y<1.64){
      const t=blend(y,1.38,1.64);
      add('spine_02',chest*(1-t));add('spine_03',chest*t);
    }else{
      const t=blend(y,1.74,2.13);
      add('spine_03',chest*(1-t));add('neck_01',chest*t);
    }
  }
  const sorted=Object.entries(scores)
    .filter(([k,w])=>k!=='undefined'&&Number.isFinite(w)&&w>0)
    .sort((a,b)=>b[1]-a[1]).slice(0,4);
  if(!sorted.length)return [[bones.spine_02,1]];
  const total=sorted.reduce((a,[_k,w])=>a+w,0);
  return sorted.map(([k,w])=>[Number(k),w/total]);
}
function musterRigCreateSkinnedGeometry(srcMesh,modelMatrix,offset,boneIndices){
  const geometry=srcMesh.geometry.clone();
  geometry.applyMatrix4(modelMatrix.clone().multiply(srcMesh.matrixWorld));
  geometry.translate(offset.x,offset.y,offset.z);
  const pos=geometry.getAttribute('position');
  const indices=new Uint16Array(pos.count*4);
  const weights=new Float32Array(pos.count*4);
  const semantic=musterRigSemantic(srcMesh);
  for(let i=0;i<pos.count;i++){
    const candidates=musterRigWeights(
      pos.getX(i),pos.getY(i),pos.getZ(i),semantic,boneIndices);
    for(let j=0;j<candidates.length;j++){
      indices[4*i+j]=candidates[j][0];
      weights[4*i+j]=candidates[j][1];
    }
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  return geometry;
}
function musterRigMotion(mode){
  const state=musterRifleRig;
  if(!['idle','jog','sprint'].includes(mode))return;
  state.motion=mode;
  for(const btn of state.buttons)
    btn.style.background=btn.dataset.motion===mode?'#727e51':'#253629';
  const r=state.rig;if(!r)return;
  if(r.state!==mode){
    r.actions[r.state]?.fadeOut(.25);
    r.actions[mode].reset().fadeIn(.25).play();
    r.state=mode;
  }
}
function musterRigBuild(source){
  const state=musterRifleRig;
  const template=germanPreview.armyNativeTemplate,clips=germanPreview.armyNativeClips;
  if(!template||!clips?.idle||!clips?.jog||!clips?.sprint)
    throw new Error('Native skeleton/animation library unavailable');
  const model=germanSkeletonClone(template);
  const group=new THREE.Group();group.name='MusterRigAnimatedRifleman';
  state.scene.add(group);
  model.updateMatrixWorld(true);
  const nativeBounds=new THREE.Box3().setFromObject(model);
  const nativeHeight=nativeBounds.max.y-nativeBounds.min.y;
  if(!Number.isFinite(nativeHeight)||nativeHeight<=.1)
    throw new Error('Native rig dimensions invalid');
  const factor=2.55/nativeHeight;
  model.scale.multiplyScalar(factor);
  model.position.set(
    -(nativeBounds.min.x+nativeBounds.max.x)*factor/2,
    -nativeBounds.min.y*factor,
    -(nativeBounds.min.z+nativeBounds.max.z)*factor/2
  );
  group.add(model);group.updateMatrixWorld(true);
  const names=[
    'pelvis','spine_01','spine_02','spine_03','neck_01','Head',
    'clavicle_l','upperarm_l','lowerarm_l','hand_l',
    'clavicle_r','upperarm_r','lowerarm_r','hand_r',
    'thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r'
  ];
  const boneMap=new Map();
  model.traverse(node=>{if(node.isBone)boneMap.set(node.name,node);});
  if(names.some(name=>!boneMap.has(name)))
    throw new Error('Native joint map incomplete: '+
      names.filter(name=>!boneMap.has(name)).join(','));
  const bones=names.map(n=>boneMap.get(n));
  const boneIndices=Object.fromEntries(names.map((n,i)=>[n,i]));
  const skeleton=new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  source.updateMatrixWorld(true);
  const srcBox=new THREE.Box3().setFromObject(source);
  const srcHeight=srcBox.max.y-srcBox.min.y;
  if(!Number.isFinite(srcHeight)||srcHeight<.9||srcHeight>2.7)
    throw new Error('Muster source proportions invalid: '+srcHeight);
  const sf=2.55/srcHeight;
  const norm=new THREE.Matrix4().makeScale(sf,sf,sf);
  const offset=new THREE.Vector3(
    -(srcBox.min.x+srcBox.max.x)*sf/2,
    -srcBox.min.y*sf,
    -(srcBox.min.z+srcBox.max.z)*sf/2
  );
  const materials=new Map();
  let vertices=0,parts=0,triangles=0;
  source.traverse(part=>{
    if(!part.isMesh)return;
    const geo=musterRigCreateSkinnedGeometry(part,norm,offset,boneIndices);
    const cloned=(mat)=>{
      const id=mat.uuid;
      if(!materials.has(id)){
        const copy=mat.clone();copy.skinning=true;copy.needsUpdate=true;
        materials.set(id,copy);
      }
      return materials.get(id);
    };
    const material=Array.isArray(part.material)?
      part.material.map(cloned):cloned(part.material);
    const skin=new THREE.SkinnedMesh(geo,material);
    skin.name='MusterSkinned_'+(part.name||parts);
    skin.castShadow=true;skin.receiveShadow=true;skin.frustumCulled=false;
    group.add(skin);
    skin.bind(skeleton);
    state.skinnedMeshes.push(skin);
    vertices+=geo.getAttribute('position').count;
    triangles+=geo.index?geo.index.count/3:geo.getAttribute('position').count/3;
    parts++;
  });
  if(parts<25||vertices<10000||state.skinnedMeshes.some(
      m=>!m.geometry.getAttribute('skinWeight')))
    throw new Error('Not a complete skinned source model');
  // Hide original Quaternius geometry. Its 65-bone rig is the animator only.
  model.traverse(n=>{if(n.isMesh)n.visible=false;});
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const [name,clip] of Object.entries(clips)){
    const safe=clip.clone();
    safe.tracks=safe.tracks.filter(t=>!/\.scale$/.test(t.name)&&
      !/(?:^|[./])root(?:\]|\.|_)?(?:position)?\.position$/.test(t.name));
    actions[name]=mixer.clipAction(safe);
  }
  actions.idle.play();
  state.rig={model,group,mixer,actions,state:'idle',skeleton,
    nativeBones:boneMap,names,sourceHeight:srcHeight,parts,vertices,triangles};
  state.skinnedVerts=vertices;state.triangles=triangles;
  state.ready=true;
  musterRigMotion(state.motion);
  window.__musterRifleRig=state;
  const label=state.progress;
  if(label)label.textContent='MUSTER · СТРЕЛОК НА '+bones.length+
    ' КОСТЯХ · '+Math.round(vertices/1000)+'k ВЕРШИН · ЭКСПЕРИМЕНТАЛЬНЫЕ ВЕСА';
}
function musterRiflemanRigTick(){
  if(new URLSearchParams(location.search).get('inspect')!=='muster-rig')return;
  const state=musterRifleRig;
  if(!state.scene){
    state.scene=new THREE.Scene();
    state.scene.background=new THREE.Color(0x787d73);
    state.scene.add(new THREE.HemisphereLight(0xffffff,0x444940,1.55));
    const light=new THREE.DirectionalLight(0xfff2d6,1.65);
    light.position.set(2.8,5,3);state.scene.add(light);
    state.camera=new THREE.PerspectiveCamera(35,1,.1,50);
    const panel=document.createElement('div');
    panel.style.cssText='position:fixed;top:calc(env(safe-area-inset-top,0px) + 117px);left:8px;right:8px;z-index:997;max-width:570px';
    const title=document.createElement('div');
    title.style.cssText='font:700 12px Arial;color:white;background:#283b30ed;padding:8px;border:1px solid #a6b19c;border-radius:6px';
    title.textContent='MUSTER → НАШ СКЕЛЕТ · ПРОБНАЯ ПРИВЯЗКА';
    panel.appendChild(title);state.progress=title;
    const buttons=document.createElement('div');
    buttons.style.cssText='display:flex;gap:5px;margin-top:5px';
    for(const [mode,name] of [['idle','Стоит'],['jog','Идёт'],['sprint','Бежит']]){
      const btn=document.createElement('button');btn.type='button';
      btn.dataset.motion=mode;btn.textContent=name;
      btn.style.cssText='flex:1;font:700 12px Arial;padding:9px;color:white;background:#253629;border:1px solid #c1c5b2;border-radius:5px';
      btn.addEventListener('click',()=>musterRigMotion(mode));
      buttons.appendChild(btn);state.buttons.push(btn);
    }
    panel.appendChild(buttons);document.body.appendChild(panel);
    musterRigMotion('jog');
    P.g.visible=false;
  }
  if(!state.ready&&!state.loading&&!state.error&&
      germanPreview.armyNativeTemplate&&germanPreview.armyNativeClips){
    state.loading=true;
    new THREE.GLTFLoader().load(
      new URL('../assets/muster-british/rifleman.glb',location.href).href,
      gltf=>{
        try{musterRigBuild(gltf.scene);}
        catch(error){
          state.error=String(error?.stack||error);
          console.error('Muster rig pilot failed',error);
          if(state.progress)state.progress.textContent='ОШИБКА СКЕЛЕТА · '+error.message;
        }
      },undefined,error=>{
        state.error=String(error?.message||error);
        if(state.progress)state.progress.textContent='ОШИБКА ЗАГРУЗКИ · '+state.error;
      }
    );
  }
}
function musterRiflemanRigDraw(){
  if(new URLSearchParams(location.search).get('inspect')!=='muster-rig')return;
  const state=musterRifleRig;
  if(!state.scene)return;
  if(state.rig){
    const now=performance.now();
    const dt=state.lastTime?Math.max(0,Math.min(.04,(now-state.lastTime)/1000)):.016;
    state.lastTime=now;
    state.rig.mixer.update(dt);
  }
  const camera=state.camera;
  camera.aspect=R.domElement.clientWidth/Math.max(1,R.domElement.clientHeight);
  camera.updateProjectionMatrix();
  // Full 2.55m figure; look at the middle of the animated body.
  camera.position.set(0,2.75,5.3);
  camera.lookAt(0,1.35,0);
  const clear=R.autoClear;
  R.autoClear=false;R.clearDepth();
  R.render(state.scene,camera);
  R.autoClear=clear;
}
