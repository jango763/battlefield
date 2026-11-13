// Unified soldier visuals: faction palettes and distinct hero/captain/engineer roles.
// Gameplay, damage and input stay in the original game.
// Model: britdawgmasterfunk, CC BY 4.0; see assets/soldiers/CREDITS.md.
const creditsLink=document.createElement('a');creditsLink.textContent='Авторы моделей';creditsLink.href='../assets/soldiers/CREDITS.md';creditsLink.target='_blank';creditsLink.rel='noopener';creditsLink.style.cssText='position:fixed;z-index:23;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 113px);font:10px Arial;color:#e7dec8;background:#20251dcc;padding:3px 5px';document.body.appendChild(creditsLink);
const germanPreview={template:null,pending:[],bounds:null,materials:new Map(),error:null,visualSequence:0,clips:[],heroSource:null,heroLoading:false};
function germanPreviewLabel(message){const e=document.getElementById('german-preview-status');if(e){e.hidden=!message;if(e.textContent!==message)e.textContent=message;}}
function soldierRole(unit){return unit.kind==='p'?'hero':unit.cmd?'captain':unit.eng?'engineer':'infantry';}
function soldierPalette(unit){return unit.kind==='p'?'hero':unit.t==='red'?'grey':'khaki';}
// Hero-only state controller. The clip mixer is prepared for validated humanoid
// animations; until compatible source clips are supplied the existing IK pose
// generator remains the safe fallback. Army units never instantiate this.
// Three.js r128 classic is used in this game; keep the retarget utility on
// that same runtime. Source: official three.js Soldier.glb animation example.
// The source model is used ONLY for animation; its mesh is never displayed.
const HERO_SOURCE_GLTF='https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/Soldier.glb';
const HERO_RETARGET_JS='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js';
function heroMotionStatus(message){
  let el=document.getElementById('hero-motion-status');
  if(!el){
    el=document.createElement('div');el.id='hero-motion-status';
    el.style.cssText='position:fixed;left:12px;top:calc(env(safe-area-inset-top,0px) + 66px);z-index:24;max-width:235px;padding:5px 8px;background:#273026dd;color:#f0e9d4;border:1px solid #91876b;font:11px Arial;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent=message;
}
function heroSkinnedMesh(scene){
  let best=null;
  scene.traverse(n=>{if(n.isSkinnedMesh&&n.skeleton&&(!best||n.skeleton.bones.length>best.skeleton.bones.length))best=n;});
  return best;
}
function heroBoneKey(name){
  return name.replace(/^.*[:|]/,'').replace(/^mixamorig/i,'').replace(/_\d+$/,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
}
function createHeroMotionController(figure){
  const weights={idle:1,walk:0,aim:0};
  return {
    mixer:new THREE.AnimationMixer(figure),weights,state:'idle',ready:false,actions:null,
    install(mixer,idle,walk){
      this.mixer=mixer;this.actions={idle,walk};
      idle.setEffectiveWeight(1);walk.setEffectiveWeight(0);
      idle.play();walk.play();this.ready=true;
      this.mixer.update(0);
    },
    update(dt,speed,aiming){
      const walkTarget=THREE.MathUtils.clamp(speed/4.5,0,1);
      const aimTarget=aiming?1:0;
      const walkEase=1-Math.exp(-dt*(walkTarget>weights.walk?7:10));
      const aimEase=1-Math.exp(-dt*(aimTarget>weights.aim?9:12));
      weights.walk+=(walkTarget-weights.walk)*walkEase;
      weights.aim+=(aimTarget-weights.aim)*aimEase;
      weights.idle=1-weights.walk;
      this.state=weights.aim>.55?'aim':weights.walk>.18?'walk':'idle';
      if(this.ready){
        this.actions.idle.setEffectiveWeight(weights.idle);
        this.actions.walk.setEffectiveWeight(weights.walk);
      }
      this.mixer.update(dt);
      return weights;
    }
  };
}
function tryInstallHeroSource(unit){
  const v=unit&&unit.germanPreview;
  if(!v||v.role!=='hero'||!v.heroMotion||v.heroMotion.ready||!germanPreview.heroSource||!THREE.SkeletonUtils)return;
  const source=germanPreview.heroSource;
  const sourceMesh=heroSkinnedMesh(source.scene),targetMesh=heroSkinnedMesh(v.figure);
  if(!sourceMesh||!targetMesh)throw new Error('У модели нет SkinnedMesh');
  const sourceByKey=new Map();
  for(const bone of sourceMesh.skeleton.bones)sourceByKey.set(heroBoneKey(bone.name),bone.name);
  const names={};
  for(const bone of targetMesh.skeleton.bones){
    const match=sourceByKey.get(heroBoneKey(bone.name));
    if(match)names[bone.name]=match;
  }
  const required=[v.bones.hips,v.bones.lUp,v.bones.rUp,v.bones.lKnee,v.bones.rKnee,v.bones.lFoot,v.bones.rFoot];
  if(required.some(b=>!names[b.name]))throw new Error('Кости ног не сопоставлены');
  const idle=source.animations.find(a=>/^idle$/i.test(a.name))||source.animations.find(a=>/idle/i.test(a.name));
  const walk=source.animations.find(a=>/^walk$/i.test(a.name))||source.animations.find(a=>/walk/i.test(a.name));
  if(!idle||!walk)throw new Error('В Soldier.glb нет Idle или Walk');
  const saved=v.rest.map(r=>({bone:r.bone,q:r.bone.quaternion.clone(),p:r.bone.position.clone()}));
  const options={names,hip:names[v.bones.hips.name],fps:24,preservePosition:true,preseveMatrix:true};
  try{
    const makeClip=(clip)=>{
      sourceMesh.skeleton.pose();source.scene.updateMatrixWorld(true);
      targetMesh.skeleton.pose();v.figure.updateMatrixWorld(true);
      const converted=THREE.SkeletonUtils.retargetClip(targetMesh,sourceMesh,clip,options);
      // Reject root translation: gameplay already owns the hero position.
      converted.tracks=converted.tracks.filter(t=>/\.quaternion$/.test(t.name));
      if(converted.tracks.length<7||converted.tracks.some(t=>t.values.some(x=>!Number.isFinite(x))))throw new Error('Недостаточно корректных каналов: '+clip.name);
      converted.resetDuration();return converted;
    };
    const idleClip=makeClip(idle),walkClip=makeClip(walk);
    const mixer=new THREE.AnimationMixer(targetMesh);
    const idleAction=mixer.clipAction(idleClip),walkAction=mixer.clipAction(walkClip);
    v.heroMotion.install(mixer,idleAction,walkAction);
    heroMotionStatus('Герой: Idle / Walk из Soldier.glb');
    console.info('Hero retarget active:',{clips:[idle.name,walk.name],mappedBones:Object.keys(names).length});
  }finally{
    // Retargeting samples bind poses: restore the original figure after baking.
    for(const r of saved){r.bone.quaternion.copy(r.q);r.bone.position.copy(r.p);}
    v.figure.updateMatrixWorld(true);
    sourceMesh.skeleton.pose();source.scene.updateMatrixWorld(true);
  }
}
function loadHeroSourceAnimation(){
  if(germanPreview.heroLoading)return;
  germanPreview.heroLoading=true;
  heroMotionStatus('Герой: загрузка анимаций Idle / Walk…');
  const utility=new Promise((resolve,reject)=>{
    if(THREE.SkeletonUtils&&THREE.SkeletonUtils.retargetClip){resolve();return;}
    const el=document.createElement('script');el.src=HERO_RETARGET_JS;el.async=true;
    el.onload=()=>THREE.SkeletonUtils&&THREE.SkeletonUtils.retargetClip?resolve():reject(new Error('Нет SkeletonUtils'));
    el.onerror=()=>reject(new Error('SkeletonUtils не загрузился'));
    document.head.appendChild(el);
  });
  const source=new Promise((resolve,reject)=>{
    new THREE.GLTFLoader().load(HERO_SOURCE_GLTF,resolve,undefined,()=>reject(new Error('Soldier.glb не загрузился')));
  });
  Promise.all([utility,source]).then(([,gltf])=>{
    if(!gltf.animations||!gltf.animations.length)throw new Error('В Soldier.glb нет анимаций');
    germanPreview.heroSource=gltf;
    tryInstallHeroSource(P);
  }).catch(err=>{
    console.warn('Hero clip fallback: procedural animation retained',err);
    heroMotionStatus('Герой: резервная анимация — '+err.message);
  });
}
// A shared cloth mask excludes skin, hands and boots. Texture detail remains,
// while the uniform's hue is controlled separately from leather and equipment.
function prepareSoldierGeometry(figure){
  figure.traverse(n=>{
    if(!n.isSkinnedMesh||n.material.name!=='Material.003')return;
    const g=n.geometry,indices=g.attributes.skinIndex,weights=g.attributes.skinWeight;
    const mask=new Float32Array(indices.count);
    for(let i=0;i<mask.length;i++){
      let cloth=0;
      for(let k=0;k<4;k++){
        const name=n.skeleton.bones[indices.array[i*4+k]].name;
        if(!/Head|Neck|Hand|Foot|Toe/i.test(name))cloth+=weights.array[i*4+k];
      }
      mask[i]=THREE.MathUtils.smoothstep(cloth,.25,.8);
    }
    g.setAttribute('uniformMask',new THREE.BufferAttribute(mask,1));
  });
}
function soldierMaterial(source,palette){
  const key=source.uuid+':'+palette;if(germanPreview.materials.has(key))return germanPreview.materials.get(key);
  const m=source.clone(),cloth=m.name==='Material.003',helmet=/helmet/.test(m.name);
  m.metalness=helmet?.08:0;m.metalnessMap=null;m.roughness=.88;m.aoMapIntensity=.62;
  m.emissive.setHex(0x292b2c);m.emissiveIntensity=.16;
  if(cloth||helmet){
    const tint=new THREE.Color(palette==='hero'?0x555960:palette==='grey'?0x93979b:0xb4ad85);
    m.userData.uniformTint=tint.toArray();m.userData.clothMask=cloth;
    m.onBeforeCompile=shader=>{
      shader.uniforms.uniformTint={value:tint};
      if(cloth){
        shader.vertexShader='attribute float uniformMask; varying float vUniformMask;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvUniformMask=uniformMask;');
      }
      shader.fragmentShader='uniform vec3 uniformTint;\n'+(cloth?'varying float vUniformMask;\n':'')+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float fabricLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        vec3 fabric=uniformTint*clamp(.28+sqrt(max(fabricLight,0.0))*.95,.28,1.0);
        diffuseColor.rgb=mix(diffuseColor.rgb,fabric,${cloth?'vUniformMask':'1.0'});`);
    };
    m.customProgramCacheKey=()=>cloth?'soldier-cloth-v3':'soldier-helmet-v3';
  }
  germanPreview.materials.set(key,m);return m;
}
function makeSoldierIdentity(role,palette){
  const root=new THREE.Group(),head=new THREE.Group(),body=new THREE.Group();root.add(head,body);root.name='Identity-'+role;
  const cloth=new THREE.MeshLambertMaterial({color:palette==='hero'?0x4e5259:palette==='grey'?0x858b8e:0x928968});
  const leather=new THREE.MeshLambertMaterial({color:0x4d3c30}),metal=new THREE.MeshLambertMaterial({color:0x62676b}),brass=new THREE.MeshLambertMaterial({color:0xc1a66b}),dark=new THREE.MeshLambertMaterial({color:0x252b2c});
  const add=(group,geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);group.add(m);return m;};
  const box=(group,mat,w,h,d,x,y,z)=>add(group,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const oval=(group,mat,x,y,z,sx,sy,sz)=>{const m=add(group,new THREE.SphereGeometry(1,16,10),mat,x,y,z);m.scale.set(sx,sy,sz);return m;};
  if(role==='hero'){
    oval(head,new THREE.MeshLambertMaterial({color:0x593d44}),.03,.245,0,.235,.075,.22).rotation.z=-.16;
    oval(head,brass,-.09,.25,.20,.028,.032,.012);
    box(body,leather,.06,.43,.025,.16,-.14,.18).rotation.z=-.3;
    box(body,dark,.12,.27,.12,.31,-.61,.06);
    box(body,cloth,.35,.40,.20,0,-.13,-.27);
  }else if(role==='captain'){
    add(head,new THREE.CylinderGeometry(.205,.18,.09,20),cloth,0,.295,0);
    add(head,new THREE.CylinderGeometry(.19,.19,.075,20),dark,0,.22,0);
    oval(head,dark,0,.205,.16,.18,.02,.14);oval(head,brass,0,.285,.195,.025,.03,.012);
    for(const side of [-1,1])box(body,brass,.14,.035,.12,side*.27,.05,0);
    box(body,leather,.30,.32,.09,.29,-.47,.20).rotation.z=-.12;
    for(const side of [-1,1])add(body,new THREE.CylinderGeometry(.045,.05,.16,10),dark,side*.055,-.18,.26).rotation.x=Math.PI/2;
  }else if(role==='engineer'){
    box(body,leather,.44,.53,.24,0,-.15,-.28);
    for(const side of [-1,1])box(body,cloth,.055,.48,.035,side*.14,-.15,-.415);
    box(body,leather,.32,.15,.13,.29,-.52,.12);
    const handle=box(body,leather,.045,.66,.045,.30,-.27,-.39);handle.rotation.z=-.18;
    box(body,metal,.17,.22,.035,.35,-.62,-.39).rotation.z=-.18;
    box(body,metal,.18,.07,.045,-.23,-.48,.19);
  }
  if(palette==='khaki'&&role!=='hero'&&role!=='captain'){
    oval(head,cloth,0,.23,0,.255,.13,.255);
    add(head,new THREE.CylinderGeometry(.32,.32,.025,20),cloth,0,.18,0);
  }
  const band=box(body,new THREE.MeshLambertMaterial({color:0x777777}),.028,.10,.16,.31,-.10,0);
  root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
  return{root,head,body,band};
}
function germanSkeletonClone(source){
  const originals=[],copies=[];source.traverse(n=>originals.push(n));
  const clone=source.clone(true);clone.traverse(n=>copies.push(n));
  const map=new Map(originals.map((n,i)=>[n,copies[i]]));
  originals.forEach((n,i)=>{if(!n.isSkinnedMesh)return;
    const bones=n.skeleton.bones.map(b=>map.get(b));
    if(bones.some(b=>!b))throw new Error('Неполный скелет');
    copies[i].skeleton=n.skeleton.clone();copies[i].skeleton.bones=bones;
    copies[i].bind(copies[i].skeleton,n.bindMatrix.clone());copies[i].frustumCulled=false;
  });return clone;
}
const GermanRig=(()=>{
  const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
  const a=V(),b=V(),c=V(),target=V(),pole=V(),direction=V(),bend=V(),elbow=V(),axis=V();
  const delta=Q(),world=Q(),parent=Q();
  function aim(bone,child,end){
    bone.getWorldPosition(a);child.getWorldPosition(b);
    b.sub(a).normalize();c.copy(end).sub(a).normalize();
    delta.setFromUnitVectors(b,c);bone.getWorldQuaternion(world);
    bone.parent.getWorldQuaternion(parent).invert();
    bone.quaternion.copy(parent.multiply(delta.multiply(world)));
    bone.updateWorldMatrix(false,true);
  }
  function solve(root,upper,lower,tip,end,hint){
    root.updateWorldMatrix(true,true);
    upper.getWorldPosition(a);lower.getWorldPosition(b);tip.getWorldPosition(c);
    const l1=a.distanceTo(b),l2=b.distanceTo(c);
    target.copy(end);root.localToWorld(target);pole.copy(hint);root.localToWorld(pole);
    direction.copy(target).sub(a);const distance=direction.length();
    direction.multiplyScalar(1/Math.max(distance,1e-6));
    const d=THREE.MathUtils.clamp(distance,Math.abs(l1-l2)+1e-5,l1+l2-1e-5);
    const along=(l1*l1-l2*l2+d*d)/(2*d);
    bend.copy(pole).sub(a);bend.addScaledVector(direction,-bend.dot(direction));
    if(bend.lengthSq()<1e-8)bend.set(0,0,1).cross(direction);
    bend.normalize();elbow.copy(a).addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    // aim mutates shared temporary vectors; cache the final target first.
    const endWorld=target.clone();aim(upper,lower,elbow);aim(lower,tip,endWorld);
  }
  function rotate(bone,rotation){
    if(!bone)return;bone.quaternion.multiply(delta.setFromEuler(new THREE.Euler(rotation[0],rotation[1],rotation[2],'YXZ')));
  }
  function orient(root,bone,q){
    root.getWorldQuaternion(world).multiply(q);bone.parent.getWorldQuaternion(parent).invert();
    bone.quaternion.copy(parent.multiply(world));bone.updateWorldMatrix(false,true);
  }
  return{solve,rotate,orient};
})();
function makeGermanWeapon(){
  const root=new THREE.Group(),wood=new THREE.MeshLambertMaterial({color:0x705039}),metal=new THREE.MeshLambertMaterial({color:0x343c3c}),strap=new THREE.MeshLambertMaterial({color:0x3f3727});
  const rifle=new THREE.Group(),machineGun=new THREE.Group(),launcher=new THREE.Group(),scope=new THREE.Group(),magazine=new THREE.Group();root.add(rifle,machineGun,launcher,scope,magazine);
  const box=(mat,x,y,z,px,py,pz,group=rifle)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),mat);m.position.set(px,py,pz);group.add(m);return m;};
  // +Z is the muzzle direction; geometry is in the same units as the soldier.
  box(wood,.095,.12,.46,0,-.015,-.22);box(wood,.085,.075,.45,0,0,.20);
  box(metal,.075,.07,.32,0,.045,.12);box(metal,.05,.10,.12,0,-.065,.08);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.018,.021,.48,8),metal);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.05,.60);rifle.add(barrel);
  box(metal,.035,.045,.018,0,.09,.77);box(metal,.045,.035,.04,0,.095,.18);
  box(metal,.10,.018,.018,.055,.035,.08);box(strap,.016,.025,.62,.053,-.11,.1);
  box(metal,.12,.11,.50,0,.04,.39,machineGun);box(metal,.22,.18,.19,.10,-.06,.12,machineGun);
  for(const side of [-1,1])box(metal,.025,.18,.035,side*.06,-.10,.65,machineGun).rotation.z=side*.24;
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1.02,10),strap);tube.rotation.x=Math.PI/2;tube.position.z=.22;launcher.add(tube);
  const rocket=new THREE.Mesh(new THREE.ConeGeometry(.13,.30,10),metal);rocket.rotation.x=Math.PI/2;rocket.position.z=.86;launcher.add(rocket);
  box(metal,.04,.13,.035,0,.12,.32,launcher);
  const optic=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.24,10),metal);optic.rotation.x=Math.PI/2;optic.position.set(0,.15,.12);scope.add(optic);
  box(metal,.055,.23,.08,0,-.16,.16,magazine);
  const flash=new THREE.Mesh(new THREE.SphereGeometry(.08,6,4),new THREE.MeshBasicMaterial({color:0xffd487}));flash.position.set(0,.05,.87);flash.scale.set(.7,.7,2.2);flash.visible=false;root.add(flash);
  const rear=new THREE.Object3D(),front=new THREE.Object3D();rear.position.set(-.025,-.07,-.035);front.position.set(.03,-.065,.20);root.add(rear,front);
  root.name='GermanWeapon';return{root,flash,rear,front,rifle,machineGun,launcher,scope,magazine,barrel};
}
function attachGermanSoldier(unit){
  if(unit.germanPreview||unit.hp<=0)return;
  if(!germanPreview.template){if(!germanPreview.pending.includes(unit))germanPreview.pending.push(unit);return;}
  let figure;
  try{figure=germanSkeletonClone(germanPreview.template);}catch(e){console.warn(e);return;}
  const anchor=new THREE.Group();anchor.name='GermanVisual';anchor.add(figure);
  const role=soldierRole(unit),palette=soldierPalette(unit);
  // Normalize only the visual anchor: collision radii and gameplay scales stay intact.
  anchor.scale.setScalar(1.1/unit.m.g.scale.y);
  figure.traverse(n=>{if(!n.isMesh)return;
    const name=n.material.name;
    n.visible=!/scrim/.test(name)&&!(/helmet/.test(name)&&(role==='hero'||role==='captain'||palette==='khaki'));
    n.material=soldierMaterial(n.material,palette);
  });
  const bounds=germanPreview.bounds,height=bounds.max.y-bounds.min.y,factor=2.55/height;
  figure.scale.setScalar(factor);figure.position.set(-(bounds.min.x+bounds.max.x)*factor/2,-bounds.min.y*factor,0);
  const names={hips:'Hips',spine:'Spine',chest:'Spine2',head:'Head',lUp:'LeftUpLeg',rUp:'RightUpLeg',lKnee:'LeftLeg',rKnee:'RightLeg',lFoot:'LeftFoot',rFoot:'RightFoot',lArm:'LeftArm',rArm:'RightArm',lFore:'LeftForeArm',rFore:'RightForeArm',lHand:'LeftHand',rHand:'RightHand'};
  const bones={},rest=[];
  figure.traverse(n=>{if(!n.isBone)return;rest.push({bone:n,q:n.quaternion.clone(),p:n.position.clone()});
    for(const [key,name] of Object.entries(names))if(new RegExp(name+'_\\d+$','i').test(n.name))bones[key]=n;
  });
  if(Object.values(names).some((_,i)=>!bones[Object.keys(names)[i]])){console.warn('Не найдены кости немецкого бойца');return;}
  // Hide the ENTIRE old hierarchy at one parent. Equipment code may toggle its
  // children freely without ever bringing old armor, hands or flashes back.
  const legacy=new THREE.Group();legacy.name='LegacySoldierVisual';
  for(const child of [...unit.m.g.children]){
    const type=child.geometry&&child.geometry.type;
    if(type==='RingGeometry'||type==='CircleGeometry'){child.scale.multiplyScalar(1.1/unit.m.g.scale.y);continue;}
    legacy.add(child);
  }
  const weapon=makeGermanWeapon(),identity=makeSoldierIdentity(role,palette);anchor.add(weapon.root,identity.root);unit.m.g.add(legacy,anchor);
  const local=(bone)=>{anchor.updateWorldMatrix(true,true);return anchor.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));};
  const feet={left:local(bones.lFoot),right:local(bones.rFoot)};
  const anchorQ=anchor.getWorldQuaternion(new THREE.Quaternion()).invert();
  const footQ={left:anchorQ.clone().multiply(bones.lFoot.getWorldQuaternion(new THREE.Quaternion())),right:anchorQ.clone().multiply(bones.rFoot.getWorldQuaternion(new THREE.Quaternion()))};
  const headQ=anchorQ.clone().multiply(bones.head.getWorldQuaternion(new THREE.Quaternion())).invert(),chestQ=anchorQ.clone().multiply(bones.chest.getWorldQuaternion(new THREE.Quaternion())).invert();
  // Visual-only stagger. No Math.random(): the game's RNG stays untouched.
  const visualIndex=++germanPreview.visualSequence;
  unit.germanPreview={anchor,figure,legacy,bones,rest,feet,footQ,weapon,identity,role,palette,headQ,chestQ,
    phase:(visualIndex*2.399963229728653)%(Math.PI*2),walk:0,aim:0,yaw:0,gaitSpeed:0,
    idleClock:visualIndex*.83,cadence:1+.035*Math.sin(visualIndex*2.17),strideScale:1+.035*Math.cos(visualIndex*1.71),
    prevHeading:unit.g.rotation.y,turnLean:0,
    targets:{left:new THREE.Vector3(),right:new THREE.Vector3(),rear:new THREE.Vector3(),front:new THREE.Vector3()},
    poles:{left:new THREE.Vector3(.72,1.35,-.12),right:new THREE.Vector3(-.72,1.35,-.12),lKnee:new THREE.Vector3(.18,.6,.7),rKnee:new THREE.Vector3(-.18,.6,.7)}};
  if(role==='hero')unit.germanPreview.heroMotion=createHeroMotionController(figure);
  legacy.visible=false;anchor.visible=true;
  animateGermanSoldier(unit,0);
  if(role==='hero'&&germanPreview.heroSource){
    try{tryInstallHeroSource(unit);}catch(e){console.warn(e);heroMotionStatus('Герой: резервная анимация — '+e.message);}
  }
  refreshGermanPreviewLabel();
}
function refreshGermanPreviewLabel(){
  if(germanPreview.template)germanPreviewLabel('');
}
function disposeGermanSoldier(unit){
  const v=unit.germanPreview;if(!v)return;
  const materials=new Set();for(const group of [v.weapon.root,v.identity.root])group.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material)materials.add(n.material);});
  for(const m of materials)m.dispose();
  v.figure.traverse(n=>{if(n.skeleton&&n.skeleton.boneTexture)n.skeleton.boneTexture.dispose();});
}
function animateGermanSoldier(unit,dt=.016){
  const v=unit.germanPreview;if(!v)return;
  v.legacy.visible=false;v.anchor.visible=true;
  // Visual locomotion is independent of combat speed, collision and gameplay.
  // Filter speed so the stride cycle decelerates naturally instead of snapping.
  const safeDt=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.08);
  const speed=Math.max(0,Number.isFinite(unit.sv)?unit.sv:0);
  const blend=1-Math.exp(-safeDt*10);
  v.gaitSpeed+=(Math.min(6,speed)-v.gaitSpeed)*(1-Math.exp(-safeDt*7));
  if(v.heroMotion){
    const weights=v.heroMotion.update(safeDt,speed,unit.aim>0);
    v.walk=weights.walk;v.aim=weights.aim;
  }else{
    // Preserve the army's already-tested movement and aiming transitions.
    v.walk+=(Math.min(1,speed/4.5)-v.walk)*(1-Math.exp(-safeDt*(speed>.2?8:11)));
    v.aim+=((unit.aim>0?1:0)-v.aim)*blend;
  }
  v.idleClock+=safeDt;
  // Walk cadence is linked to actual unit speed; a slightly longer cycle reduces the hurried gait.
  v.phase=(v.phase+safeDt*v.gaitSpeed/3.1*v.cadence*Math.PI*2)%(Math.PI*2);
  if(!v.heroMotion||!v.heroMotion.ready)for(const r of v.rest){r.bone.quaternion.copy(r.q);r.bone.position.copy(r.p);}
  unit.g.position.set(unit.x,0,unit.z);unit.g.rotation.x=0;unit.g.rotation.z=0;
  let yaw=unit.aimT==null?0:Math.atan2(Math.sin(unit.aimT-unit.g.rotation.y),Math.cos(unit.aimT-unit.g.rotation.y));
  if(speed<.6&&unit.aim>0){const turn=yaw*(1-Math.exp(-safeDt*7));unit.g.rotation.y+=turn;yaw-=turn;}
  // Follow changes in facing with restrained body lean, without steering the unit.
  const headingChange=Math.atan2(Math.sin(unit.g.rotation.y-v.prevHeading),Math.cos(unit.g.rotation.y-v.prevHeading));
  v.prevHeading=unit.g.rotation.y;
  const turnGoal=THREE.MathUtils.clamp(headingChange/Math.max(safeDt,1/120),-2,2)*.017*v.walk;
  v.turnLean+=(turnGoal-v.turnLean)*(1-Math.exp(-safeDt*8));
  v.yaw+=(THREE.MathUtils.clamp(yaw,-.9,.9)*v.aim-v.yaw)*blend;
  const sway=Math.sin(v.phase)*v.walk;
  const breathing=Math.sin(v.idleClock*1.7)*.008*(1-v.walk);
  // The shoulder girdle counter-rotates against the pelvis during a stride.
  // Small, phase-offset motion preserves a steady rifle while reducing the
  // rigid, synchronized "robot march" silhouette.
  if(!v.heroMotion||!v.heroMotion.ready){
  const shoulderCounter=Math.sin(v.phase+.32)*.025*v.walk;
  GermanRig.rotate(v.bones.hips,[.01*v.walk,0,sway*.012]);
  GermanRig.rotate(v.bones.spine,[.03*v.walk+breathing,v.yaw*.4+shoulderCounter*.55,-sway*.020+v.turnLean]);
  GermanRig.rotate(v.bones.chest,[breathing*.35,v.yaw*.6-shoulderCounter*.8,sway*.014+v.turnLean*.35]);
  GermanRig.rotate(v.bones.head,[0,-v.yaw*.12-shoulderCounter*.24,0]);
  // Keep the silhouette upright while gently transferring weight toward
  // the planted leg. Use the rig's actual left/right axes, not an assumed axis.
  const bob=(1-Math.cos(v.phase*2))*.0055*v.walk;
  const leftAxis=Math.sign(v.feet.left.x-v.feet.right.x)||-1;
  v.anchor.position.x=leftAxis*Math.sin(v.phase)*.024*v.walk;
  v.anchor.position.y=-.012*v.walk+bob;
  // Feet follow continuous stance/swing arcs in the character's local space.
  // Keep IK targets conservative to avoid snapping the knees on turns.
  const stride=.26*v.walk*v.strideScale,lift=.105*v.walk,stance=.60;
  for(const [side,offset] of [['left',0],['right',.5]]){
    const phase=((v.phase/(Math.PI*2)+offset)%1+1)%1;
    const t=v.targets[side],f=v.feet[side];
    const footBone=side==='left'?v.bones.lFoot:v.bones.rFoot;
    t.copy(f);
    let footRoll=0;
    if(phase<stance){
      const q=phase/stance,smooth=q*q*(3-2*q);
      t.z+=stride*(1-2*smooth);
      // Slight toe-off near the end of stance, not the whole planted phase.
      const toe=THREE.MathUtils.clamp((q-.72)/.28,0,1);
      const toeArc=Math.sin(Math.PI*toe);
      footRoll=.065*toeArc*toeArc*v.walk;
    }else{
      const q=(phase-stance)/(1-stance),smooth=q*q*(3-2*q);
      t.z+=stride*(-1+2*smooth);
      // Squared sine eases the foot off and back onto the ground with
      // zero vertical velocity at contact, avoiding a robotic kick.
      const arc=Math.sin(Math.PI*q);
      t.y+=lift*arc*arc;
      footRoll=-.045*arc*arc*v.walk;
    }
    GermanRig.solve(v.anchor,side==='left'?v.bones.lUp:v.bones.rUp,side==='left'?v.bones.lKnee:v.bones.rKnee,footBone,t,side==='left'?v.poles.lKnee:v.poles.rKnee);
    GermanRig.orient(v.anchor,footBone,v.footQ[side]);
    GermanRig.rotate(footBone,[footRoll,0,0]);
  }
  }else{
    // Imported leg/torso animation comes from the retargeted clips. Arm/hand
    // IK below still locks both palms onto the game's existing weapon.
    v.anchor.position.x=0;v.anchor.position.y=0;
    GermanRig.rotate(v.bones.chest,[0,v.yaw*.3,0]);
    GermanRig.rotate(v.bones.head,[0,-v.yaw*.12,0]);
  }
  const recoil=unit.kick>0?Math.min(1,unit.kick/.1)*.035:0;
  // Both hands remain IK-locked to the weapon. The entire weapon-and-hands
  // assembly follows a restrained carry rhythm which fades while aiming.
  const carry=v.walk*(1-.7*v.aim);
  const carrySway=Math.sin(v.phase-.35)*carry;
  const carryRise=Math.sin(v.phase*2-.45)*carry;
  const w=v.weapon.root;
  w.position.set(-.11+carrySway*.012,1.78+v.aim*.12+carryRise*.008+breathing*.6,.19-recoil+Math.cos(v.phase)*carry*.009);
  w.position.applyAxisAngle(new THREE.Vector3(0,1,0),v.yaw);
  w.rotation.set(.28*(1-v.aim)+carryRise*.007,v.yaw+carrySway*.012,-.04+sway*.009*(1-.6*v.aim),'YXZ');
  v.anchor.updateWorldMatrix(true,true);
  v.targets.rear.copy(v.weapon.rear.getWorldPosition(new THREE.Vector3()));v.anchor.worldToLocal(v.targets.rear);
  v.targets.front.copy(v.weapon.front.getWorldPosition(new THREE.Vector3()));v.anchor.worldToLocal(v.targets.front);
  const handQ=w.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));
  const palmOffset=new THREE.Vector3(0,.11,0).applyQuaternion(handQ);
  v.targets.rear.sub(palmOffset);v.targets.front.sub(palmOffset);
  GermanRig.solve(v.anchor,v.bones.rArm,v.bones.rFore,v.bones.rHand,v.targets.rear,v.poles.right);
  GermanRig.solve(v.anchor,v.bones.lArm,v.bones.lFore,v.bones.lHand,v.targets.front,v.poles.left);
  GermanRig.orient(v.anchor,v.bones.rHand,handQ);GermanRig.orient(v.anchor,v.bones.lHand,handQ);
  for(const r of v.rest){if(/Hand(Index|Middle|Ring|Pinky)[123]_/.test(r.bone.name))GermanRig.rotate(r.bone,[-.7,0,0]);}
  v.weapon.flash.visible=unit.kick>0;
  const hero=unit.kind==='p',heavy=hero?unit.wpn>=4:!!(unit.hv&&unit.ammo>0),smg=hero?unit.wpn===1:unit.type==='smg';
  v.weapon.rifle.visible=!heavy;v.weapon.machineGun.visible=!heavy&&(hero?unit.wpn===2:unit.type==='mg');v.weapon.launcher.visible=heavy;
  v.weapon.scope.visible=hero&&unit.wpn===3;v.weapon.magazine.visible=smg;
  v.weapon.barrel.scale.y=smg?.45:1;v.weapon.barrel.position.z=smg?.47:.60;
  v.weapon.flash.position.z=heavy?1.04:smg?.60:.87;
  const inv= v.anchor.getWorldQuaternion(new THREE.Quaternion()).invert();
  for(const [part,bone,restQ] of [[v.identity.head,v.bones.head,v.headQ],[v.identity.body,v.bones.chest,v.chestQ]]){
    part.position.copy(v.anchor.worldToLocal(bone.getWorldPosition(new THREE.Vector3())));
    part.quaternion.copy(inv).multiply(bone.getWorldQuaternion(new THREE.Quaternion())).multiply(restQ);
  }
  v.identity.band.material.color.setHex((hero?unit.side:unit.t)==='red'?0x9e4a44:0x4d7391);
  v.anchor.updateWorldMatrix(true,true);
}
function loadGermanSoldierPreview(){
  if(typeof THREE.GLTFLoader!=='function'){germanPreviewLabel('Модель недоступна — исходные бойцы');return;}
  try{
    const base64=document.getElementById('preview-german-glb').textContent.trim(),bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    new THREE.GLTFLoader().parse(bytes.buffer,'',gltf=>{
      try{
        const figure=gltf.scene;figure.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(figure);
        if(!Number.isFinite(bounds.min.y)||bounds.max.y<=bounds.min.y)throw new Error('Размеры модели');
        figure.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
        prepareSoldierGeometry(figure);
        germanPreview.template=figure;germanPreview.bounds=bounds;
        germanPreview.clips=gltf.animations||[]; // Inspect clips before retargeting; do not auto-play.
        const queue=[P,...U,...germanPreview.pending];germanPreview.pending.length=0;
        for(const u of queue)if(u.hp>0)attachGermanSoldier(u);
        loadHeroSourceAnimation();
        refreshGermanPreviewLabel();
      }catch(e){console.error(e);germanPreviewLabel('Ошибка модели — исходные бойцы');}
    },e=>{console.error(e);germanPreviewLabel('Ошибка загрузки — исходные бойцы');});
  }catch(e){console.error(e);germanPreviewLabel('Ошибка модели — исходные бойцы');}
}
setTimeout(loadGermanSoldierPreview,200);
