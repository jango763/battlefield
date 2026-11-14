import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Non-production lab: use actual assets/weapon pivot coordinates and the same
// two-bone IK principle as the r128 game. No imported gameplay code.
const $=id=>document.getElementById(id);
const select={side:$('side'),weapon:$('weapon'),animation:$('animation'),retarget:$('retarget')};
const asset=new URL('../../assets/',import.meta.url);
const pages=new URL('../../preview/parts/',import.meta.url);
const loader=new GLTFLoader();
const manifestURL=new URL('ww2-weapons/manifest.json',asset);
const state={ready:false,side:'blue',weapon:'smg',animation:'idle',
  retarget:'project',markers:true,aim:false,error:null,fps:0,stats:null};
window.__rigLab=state;

const names={
 left:{upper:'upperarm_l',lower:'lowerarm_l',hand:'hand_l'},
 right:{upper:'upperarm_r',lower:'lowerarm_r',hand:'hand_r'}
};
const matched={
 Hips:'pelvis',Spine:'spine_01',Spine1:'spine_02',Spine2:'spine_03',
 Neck:'neck_01',Head:'Head',
 LeftShoulder:'clavicle_l',LeftArm:'upperarm_l',LeftForeArm:'lowerarm_l',LeftHand:'hand_l',
 RightShoulder:'clavicle_r',RightArm:'upperarm_r',RightForeArm:'lowerarm_r',RightHand:'hand_r',
 LeftUpLeg:'thigh_l',LeftLeg:'calf_l',LeftFoot:'foot_l',LeftToeBase:'ball_l',
 RightUpLeg:'thigh_r',RightLeg:'calf_r',RightFoot:'foot_r',RightToeBase:'ball_r'
};
for(const side of ['Left','Right']){
 const suffix=side==='Left'?'l':'r';
 for(const finger of ['Thumb','Index','Middle','Ring','Pinky'])
   for(let n=1;n<=3;n++)matched[side+'Hand'+finger+n]=finger.toLowerCase()+'_0'+n+'_'+suffix;
}
const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
function fail(message){
 state.error=String(message);$('busy').hidden=false;$('busy').textContent='Ошибка лаборатории: '+state.error;
 $('message').textContent='Ошибка: '+state.error;$('message').setAttribute('role','alert');
 console.error('R187 rig lab failed',message);
}
function status(message){$('busy').textContent=message;$('message').textContent=message;}
async function fetchText(url){const r=await fetch(url);if(!r.ok)throw Error(url.pathname+' HTTP '+r.status);return await r.text();}
async function extractBundledCostume(){
 status('Чтение настоящего Panzergrenadier GLB из существующих частей HTML…');
 const parts=await Promise.all(Array.from({length:10},(_,i)=>
  fetchText(new URL('german-'+String(i).padStart(3,'0')+'.txt',pages))));
 const joined=parts.join('');
 const head=joined.indexOf('id="preview-german-glb"');
 if(head<0)throw Error('Не найден встроенный GLB формы');
 const start=joined.indexOf('>',head)+1,end=joined.indexOf('</script>',start);
 if(end<0)throw Error('Данные формы обрезаны');
 const encoded=joined.slice(start,end).trim();
 if(encoded.length<4000000||!encoded.startsWith('Z2xURg'))
  throw Error('Оригинальный Panzergrenadier GLB не распознан');
 const binary=Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0));
 status('Декодирован Panzergrenadier '+(binary.byteLength/1024/1024).toFixed(1)+' МБ; обработка glTF 2.0…');
 const result=await loader.parseAsync(binary.buffer,new URL('../../preview/',import.meta.url).href);
 return result.scene;
}
function vertices(mesh){
 const meshList=[];
 mesh.traverse(n=>{if(n.isSkinnedMesh)meshList.push(n);});
 return meshList;
}
function boneMap(scene,donor=false){
 const map=new Map();
 scene.traverse(n=>{
  if(n.isBone)map.set(donor?n.name.replace(/_\d+$/,'').replace(/^mixamorig[:_]?/i,''):n.name,n);
 });
 return map;
}
function boxScaleToHeight(model,height){
 model.updateWorldMatrix(true,true);
 const box=new THREE.Box3().setFromObject(model);
 const raw=box.max.y-box.min.y;
 if(!Number.isFinite(raw)||raw<=0)throw Error('Неверная высота GLB: '+raw);
 const scale=height/raw;
 model.scale.multiplyScalar(scale);
 model.position.set(-(box.min.x+box.max.x)*scale/2,
   -box.min.y*scale,-(box.min.z+box.max.z)*scale/2);
}
function colorWw2Donor(model,side){
 model.traverse(n=>{
  if(!n.isSkinnedMesh)return;
  // Cache per-faction materials, do not progressively recolor the same
  // texture every time the viewer switches faction in the lab.
  n.userData.rigLabBaseMaterial??=n.material;
  n.userData.rigLabMaterials??={};
  const base=n.userData.rigLabBaseMaterial;
  const name=Array.isArray(base)?base.map(m=>m.name).join(' '):base?.name||'';
  n.visible=!/helmet|scrim/i.test(name);
  n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;
  if(!n.visible)return;
  if(!n.userData.rigLabMaterials[side]){
    const tint=side==='red'?0x5e695e:0xc7b798;
    const adjust=m=>{
      const out=m.clone();
      if(out.color)out.color.lerp(new THREE.Color(tint),.18);
      out.side=THREE.DoubleSide;
      return out;
    };
    n.userData.rigLabMaterials[side]=Array.isArray(base)?base.map(adjust):adjust(base);
  }
  n.material=n.userData.rigLabMaterials[side];
 });
}
function solveArm(root,upper,lower,hand,endLocal,poleLocal){
 const a=upper.getWorldPosition(V()),b=lower.getWorldPosition(V()),c=hand.getWorldPosition(V());
 const lengthA=a.distanceTo(b),lengthB=b.distanceTo(c);
 const desired=root.localToWorld(endLocal.clone()),pole=root.localToWorld(poleLocal.clone());
 const direction=desired.clone().sub(a);
 const d0=direction.length();
 direction.multiplyScalar(1/Math.max(d0,1e-6));
 const d=THREE.MathUtils.clamp(d0,Math.abs(lengthA-lengthB)+1e-5,lengthA+lengthB-1e-5);
 const along=(lengthA*lengthA-lengthB*lengthB+d*d)/(2*d);
 const bend=pole.sub(a);
 bend.addScaledVector(direction,-bend.dot(direction));
 if(bend.lengthSq()<1e-8)bend.set(0,0,1).cross(direction);
 bend.normalize();
 const elbow=a.clone().addScaledVector(direction,along).addScaledVector(
   bend,Math.sqrt(Math.max(0,lengthA*lengthA-along*along)));
 aimBone(upper,lower,elbow);
 aimBone(lower,hand,desired);
}
function aimBone(bone,child,target){
 const start=bone.getWorldPosition(V()),current=child.getWorldPosition(V()).sub(start).normalize();
 const next=target.clone().sub(start).normalize();
 const delta=Q().setFromUnitVectors(current,next);
 const world=bone.getWorldQuaternion(Q()),inv=bone.parent.getWorldQuaternion(Q()).invert();
 bone.quaternion.copy(inv.multiply(delta.multiply(world)));
 bone.updateWorldMatrix(false,true);
}
function orient(root,bone,q){
 const world=root.getWorldQuaternion(Q()).multiply(q);
 const inv=bone.parent.getWorldQuaternion(Q()).invert();
 bone.quaternion.copy(inv.multiply(world));
 bone.updateWorldMatrix(false,true);
}
function arr(a){return a.toArray().map(v=>+v.toFixed(3));}
const manifestPromise=fetch(manifestURL).then(r=>{if(!r.ok)throw Error('Оружие: '+r.status);return r.json();});
const weaponCache=new Map();
const weaponIds={
 blue:{rifle:'uk-lee-enfield',smg:'uk-sten',mg:'uk-bren'},
 red:{rifle:'de-kar98k',smg:'de-mp40',mg:'de-mg42'}
};
async function loadWeaponSource(id){
 if(!weaponCache.has(id)){
  weaponCache.set(id,loader.loadAsync(new URL('ww2-weapons/'+id+'.glb',asset).href));
 }
 return await weaponCache.get(id);
}
function setupWorld(){
 const viewport=$('viewport'),canvas=document.createElement('canvas');
 viewport.appendChild(canvas);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.14;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(0x36463b);
 scene.fog=new THREE.Fog(0x36463b,9,24);
 scene.add(new THREE.HemisphereLight(0xe2f1ff,0x595a43,2.1));
 const directional=new THREE.DirectionalLight(0xffefdc,3.0);
 directional.position.set(-3.5,7,5);directional.castShadow=true;
 directional.shadow.mapSize.set(1024,1024);
 directional.shadow.camera.left=-7;directional.shadow.camera.right=7;
 directional.shadow.camera.top=7;directional.shadow.camera.bottom=-7;
 scene.add(directional);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(24,24),
  new THREE.MeshStandardMaterial({color:0x565d4d,roughness:.96}));
 ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 for(const x of [-1.65,1.65]){
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(.92,.92,.07,40),
   new THREE.MeshStandardMaterial({color:x<0?0x465a63:0x6a5b4b,roughness:.87}));
  disc.position.set(x,.035,0);disc.receiveShadow=true;scene.add(disc);
 }
 const camera=new THREE.PerspectiveCamera(41,1,.1,100);
 camera.position.set(0,2.7,8.6);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.target.set(0,1.36,0);
 controls.enableDamping=true;controls.minDistance=4;
 controls.maxDistance=15;controls.maxPolarAngle=Math.PI/2-.06;
 const focus=x=>{
  // Close-up only changes inspection camera, never pose or gameplay.
  const mobile=viewport.clientWidth<720;
  camera.position.set(x,2.12,mobile?4.45:3.15);
  controls.target.set(x,1.91,0);
  controls.update();
 };
 $('focusDual').onclick=()=>focus(1.65);
 $('focusSingle').onclick=()=>focus(-1.65);
 $('resetCam').onclick=()=>{
  camera.position.set(0,2.7,8.6);controls.target.set(0,1.36,0);controls.update();
 };
 $('handsCam').onclick=()=>{
  // Zoom onto the actual donor wrists and weapon while keeping OrbitControls.
  camera.position.set(2.15,2.15,2.9);
  controls.target.set(1.65,1.73,0);
  controls.update();
 };
 let sizeW=0,sizeH=0;
 const resize=()=>{
  const rect=viewport.getBoundingClientRect();
  if(rect.width===sizeW&&rect.height===sizeH)return;
  sizeW=rect.width;sizeH=rect.height;
  camera.aspect=sizeW/sizeH;camera.updateProjectionMatrix();
  renderer.setSize(sizeW,sizeH,false);
 };
 return{scene,camera,renderer,controls,resize};
}
function makePanel(x,character,costume,library,side){
 const anchor=new THREE.Group();anchor.name=x<0?'OneSkeleton':'TwoSkeletons';
 anchor.position.x=x;
 world.scene.add(anchor);
 const native=cloneSkinned(character);
 boxScaleToHeight(native,2.55);
 anchor.add(native);
 const anatomy=boneMap(native);
 for(const namesForSide of Object.values(names))
  for(const key of Object.values(namesForSide))
   if(!anatomy.has(key))throw Error('В Quaternius отсутствует '+key);
 const mixer=new THREE.AnimationMixer(native),actions={};
 for(const [key,name] of Object.entries({
   idle:'Idle_Loop',jog:'Jog_Fwd_Loop',sprint:'Sprint_Loop'
 })){
  const found=library.find(c=>c.name===name);
  if(!found)throw Error('Отсутствует анимация '+name);
  const clip=found.clone();
  clip.tracks=clip.tracks.filter(t=>!/\.scale$/.test(t.name)&&
   !/(?:^|[./])root(?:\]|\.|_)?(?:position)?\.position$/.test(t.name));
  actions[key]=mixer.clipAction(clip);
 }
 actions.idle.play();
 const panel={anchor,native,anatomy,mixer,actions,state:'idle',
   hands:{left:{},right:{}},sourceHandQ:{},weapon:null,costume:null,
   bindings:[],skinMeshes:[],mode:x<0?'single':'dual',side,metrics:null};
 for(const [name,bones] of Object.entries(names)){
  panel.hands[name]={
   upper:anatomy.get(bones.upper),elbow:anatomy.get(bones.lower),hand:anatomy.get(bones.hand)
  };
 }
 native.updateWorldMatrix(true,true);
 for(const hand of ['left','right']){
  panel.sourceHandQ[hand]=anchor.getWorldQuaternion(Q()).invert().multiply(
    panel.hands[hand].hand.getWorldQuaternion(Q()));
 }
 if(costume){
  const donor=cloneSkinned(costume);
  boxScaleToHeight(donor,2.55);
  anchor.add(donor);
  donor.updateWorldMatrix(true,true);
  colorWw2Donor(donor,side);
  const donorBones=boneMap(donor,true);
  for(const [targetName,sourceName] of Object.entries(matched)){
   const sourceBone=anatomy.get(sourceName),target=donorBones.get(targetName);
   if(!sourceBone||!target)continue;
   panel.bindings.push({
    source:sourceBone,target,
    restSourceInv:sourceBone.getWorldQuaternion(Q()).invert(),
    restTarget:target.getWorldQuaternion(Q())
   });
  }
  if(panel.bindings.length<35)throw Error('Не совпадают кости одежды: '+panel.bindings.length);
  panel.skinMeshes=vertices(donor).filter(n=>n.visible);
  const donorHands={};
  for(const hand of ['left','right']){
   const id=hand==='left'?'Left':'Right';
   donorHands[hand]={
     upper:donorBones.get(id+'Arm'),
     elbow:donorBones.get(id+'ForeArm'),
     hand:donorBones.get(id+'Hand')
   };
  }
  if(Object.values(donorHands).some(v=>!v.upper||!v.elbow||!v.hand))
   throw Error('Mixamo-руки в исходной военной форме не найдены');
  panel.donorHands=donorHands;
  panel.donorOffsets={};
  for(const hand of ['left','right']){
   panel.donorOffsets[hand]=panel.hands[hand].hand.getWorldQuaternion(Q()).invert()
     .multiply(donorHands[hand].hand.getWorldQuaternion(Q())).normalize();
  }
  vertices(native).forEach(n=>n.visible=false);
  panel.costume=donor;
 }else panel.skinMeshes=vertices(native);
 panel.markers={};
 for(const hand of ['left','right']){
  panel.markers[hand]={};
  for(const [which,color] of [['grip',0xf7bc52],['surface',0x29d4dd],['wrist',0xff5d62]]){
   const mesh=new THREE.Mesh(new THREE.SphereGeometry(.027,9,7),
     new THREE.MeshBasicMaterial({color,depthTest:false}));
   mesh.renderOrder=100;anchor.add(mesh);
   panel.markers[hand][which]=mesh;
  }
 }
 return panel;
}

/**
 * Experimental *single skeleton* surface rebind. All donor geometry is baked
 * into the native armature's rest world-space; original donor weight groups
 * are mapped through donor/native rest-bone matrices by corresponding bone name (unmapped groups fall back to a
 * mapped ancestor). One THREE.Skeleton references only Quaternius bones.
 * This is not yet a Blender export or production-quality re-skin.
 */
function makeSingleRigPanel(x,character,costume,library,side){
 const panel=makePanel(x,character,null,library,side);
 panel.anchor.name='OneRigReboundCostume';
 panel.anchor.updateWorldMatrix(true,true);
 const donor=cloneSkinned(costume);
 boxScaleToHeight(donor,2.55);
 panel.anchor.add(donor);
 donor.updateWorldMatrix(true,true);
 colorWw2Donor(donor,side);
 const original=vertices(panel.native);
 const baseSkeleton=original[0]?.skeleton;
 if(!baseSkeleton || baseSkeleton.bones.length<60)
  throw Error('Единый скелет: не найдены кости Quaternius');
 const rigBones=baseSkeleton.bones;
 const nativeIndex=new Map(rigBones.map((bone,index)=>[bone.name,index]));
 // Use the actual native *rest* bone positions; never capture animated frames.
 panel.anchor.updateWorldMatrix(true,true);
 const rig=new THREE.Skeleton(rigBones,rigBones.map(b=>b.matrixWorld.clone().invert()));
 const originInverse=panel.anchor.matrixWorld.clone().invert();
 const meshes=vertices(donor).filter(n=>n.visible);
 const group=new THREE.Group();group.name='NativeOneRigUniform';
 panel.anchor.add(group);
 let remapped=0,fallback=0,unmapped=0;
 const mapBone=bone=>{
  let current=bone;
  while(current){
   const id=current.name.replace(/_\d+$/,'').replace(/^mixamorig[:_]?/i,'');
   const nativeName=matched[id];
   if(nativeName && nativeIndex.has(nativeName)){
    if(current!==bone)fallback++;
    else remapped++;
    return nativeIndex.get(nativeName);
   }
   current=current.parent?.isBone?current.parent:null;
  }
  unmapped++;
  return nativeIndex.get('pelvis')??0;
 };
 for(const mesh of meshes){
  mesh.updateWorldMatrix(true,false);
  const geometry=mesh.geometry.clone(),position=geometry.getAttribute('position');
  const oldIndex=geometry.getAttribute('skinIndex'),oldWeight=geometry.getAttribute('skinWeight');
  if(!position||!oldIndex||!oldWeight)throw Error('Нет skin weights в форме: '+mesh.name);
  const nativeIndices=mesh.skeleton.bones.map(mapBone);
  // Rest-space fit: convert every donor bone's rest-space influence into the
  // native bone's rest-space. A mere index swap puts hands metres away.
  // GLB armatures have incompatible authored scales. A direct world-matrix
  // product explodes garment size (measured 60+ units for a 2.55-unit body).
  // Keep only world-space joint position and orientation; intentionally drop
  // per-rig basis scale before building donor-rest -> native-rest transforms.
  const unitScale=new THREE.Vector3(1,1,1);
  const restToNative=mesh.skeleton.bones.map((bone,i)=>{
   const source=rigBones[nativeIndices[i]];
   const targetMatrix=new THREE.Matrix4().compose(
     source.getWorldPosition(V()),source.getWorldQuaternion(Q()),unitScale);
   const donorMatrix=new THREE.Matrix4().compose(
     bone.getWorldPosition(V()),bone.getWorldQuaternion(Q()),unitScale);
   return targetMatrix.multiply(donorMatrix.invert());
  });
  const ids=new Uint16Array(position.count*4),weights=new Float32Array(position.count*4);
  const temp=V(), fitted=V(), touched=V();
  for(let i=0;i<position.count;i++){
   const merged=new Map();
   let total=0;
   temp.fromBufferAttribute(position,i);
   mesh.applyBoneTransform(i,temp); // donor skinned rest pose in donor mesh space
   temp.applyMatrix4(mesh.matrixWorld); // scene/world space
   fitted.set(0,0,0);
   for(let k=0;k<4;k++){
    const weight=oldWeight.getComponent(i,k);
    if(weight<=0)continue;
    const donorIndex=oldIndex.getComponent(i,k);
    const nativeBone=nativeIndices[donorIndex];
    if(nativeBone===undefined)throw Error('Invalid donor skinIndex '+donorIndex);
    merged.set(nativeBone,(merged.get(nativeBone)||0)+weight);
    touched.copy(temp).applyMatrix4(restToNative[donorIndex]);
    fitted.addScaledVector(touched,weight);
    total+=weight;
   }
   if(total<=0)throw Error('Vertex with zero skin weights: '+mesh.name+' '+i);
   fitted.multiplyScalar(1/total).applyMatrix4(originInverse);
   position.setXYZ(i,fitted.x,fitted.y,fitted.z);
   const sorted=[...merged.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
   const sum=sorted.reduce((s,a)=>s+a[1],0)||1;
   for(let k=0;k<sorted.length;k++){
    ids[i*4+k]=sorted[k][0];weights[i*4+k]=sorted[k][1]/sum;
   }
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  // Surface geometry is already in anchor-local coordinates; recompute
  // normals to avoid donor-space normals on repositioned native anatomy.
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  if(!Number.isFinite(geometry.boundingSphere?.radius)||geometry.boundingSphere.radius>4)
   throw Error('One-rig garment rest-space exploded: radius='+
     geometry.boundingSphere?.radius+' mesh='+mesh.name);
  const single=new THREE.SkinnedMesh(geometry,mesh.material);
  single.name='ONE_RIG_'+(mesh.name||'uniform');
  single.castShadow=true;single.receiveShadow=true;single.frustumCulled=false;
  group.add(single);
  single.updateWorldMatrix(true,false);
  single.bind(rig, single.matrixWorld.clone());
 }
 if(!group.children.length)throw Error('No costume meshes were rebound to the native rig');
 // Native geometry is deliberately hidden: only the real WW2 costume renders.
 original.forEach(mesh=>{mesh.visible=false;});
 panel.anchor.remove(donor);
 panel.oneRigUniform=group;
 panel.oneRigRig=rig;
 panel.skinMeshes=group.children;
 panel.oneRigDetails={sourceBones:rigBones.length,sourceSkinMeshes:original.length,
  visibleCostumeMeshes:group.children.length,remappedBoneEntries:remapped,
  fallbackBoneEntries:fallback,unmappedBoneEntries:unmapped};
 return panel;
}

function configureWeapon(panel,source,info,id){
 if(panel.weapon){panel.anchor.remove(panel.weapon.root);}
 const root=new THREE.Group();root.name='WW2Weapon_'+id;
 panel.anchor.add(root);
 const model=source.scene.clone(true);
 model.scale.setScalar(1.4);root.add(model);
 const trigger=new THREE.Object3D(),support=new THREE.Object3D();
 root.add(trigger,support);
 panel.weapon={root,trigger,support,info,id,model};
 panel.weaponLoaded=true;
}
function chooseWeaponForPanel(panel){
 if(!panel.weapon)return;
 const w=panel.weapon,info=w.info,fac=1.4;
 const trig=new THREE.Vector3(...info.trigger).multiplyScalar(fac)
   .addScaledVector(new THREE.Vector3(...info.triggerPalm),.013);
 const supp=new THREE.Vector3(...info.support).multiplyScalar(fac)
   .addScaledVector(new THREE.Vector3(...info.supportPalm),.014);
 if(w.id==='de-mp40')trig.add(new THREE.Vector3(0,.058,-.016));
 if(w.id==='uk-sten')supp.add(new THREE.Vector3(0,.015,0));
 if(w.id==='de-mp40')supp.add(new THREE.Vector3(0,.055,.08));
 w.trigger.position.copy(trig);w.support.position.copy(supp);
}
function setRigPose(panel,dt){
 if(panel.state!==state.animation){
  panel.actions[panel.state]?.fadeOut(.14);
  panel.actions[state.animation]?.reset().fadeIn(.14).play();
  panel.state=state.animation;
 }
 panel.mixer.update(Math.min(.06,dt));
 panel.anchor.updateWorldMatrix(true,true);
 const w=panel.weapon;
 if(!w)return;
 chooseWeaponForPanel(panel);
 const local=o=>panel.anchor.worldToLocal(o.getWorldPosition(V()));
 const right=local(panel.hands.right.upper),left=local(panel.hands.left.upper);
 const sign=Math.sign(right.x-left.x)||-1;
 const shooting=state.aim;
 w.root.rotation.set(shooting?-.04:state.animation==='sprint'?.08:-.095,
   -sign*(shooting?.47:1.10),sign*(shooting?.018:.015),'YXZ');
 const center=right.clone().add(left).multiplyScalar(.5);
 const targetTrigger=new THREE.Vector3(
   center.x+sign*.17,center.y-(shooting?.135:.20),center.z+(shooting?.31:.29)
 );
 w.root.position.copy(targetTrigger).sub(w.trigger.position.clone().applyQuaternion(w.root.quaternion));
 panel.anchor.updateWorldMatrix(true,true);
 const targets={right:local(w.trigger),left:local(w.support)};
 const poles={
  right:right.clone().add(new THREE.Vector3(sign*.51,-.27,-.10)),
  left:left.clone().add(new THREE.Vector3(-sign*.48,-.27,.23))
 };
 for(const hand of ['right','left']){
  const b=panel.hands[hand];
  solveArm(panel.anchor,b.upper,b.elbow,b.hand,targets[hand],poles[hand]);
  orient(panel.anchor,b.hand,w.root.quaternion.clone().multiply(panel.sourceHandQ[hand]));
 }
 panel.anchor.updateWorldMatrix(true,true);
 if(panel.costume){
  panel.native.updateWorldMatrix(true,true);panel.costume.updateWorldMatrix(true,true);
  const sourceQ=Q(),targetQ=Q(),invParent=Q();
  for(const b of panel.bindings){
   b.source.getWorldQuaternion(sourceQ);
   targetQ.copy(sourceQ).multiply(b.restSourceInv).multiply(b.restTarget);
   b.target.parent.getWorldQuaternion(invParent).invert();
   b.target.quaternion.copy(invParent.multiply(targetQ));
   b.target.updateWorldMatrix(false,true);
  }
  if(state.retarget==='project'){
   const localDonor=o=>panel.anchor.worldToLocal(o.getWorldPosition(V()));
   const sr=localDonor(panel.donorHands.right.upper),sl=localDonor(panel.donorHands.left.upper);
   const sign=Math.sign(sr.x-sl.x)||-1;
   const poles={
    right:sr.clone().add(new THREE.Vector3(sign*.47,-.28,-.04)),
    left:sl.clone().add(new THREE.Vector3(-sign*.50,-.29,.18))
   };
   for(const hand of ['right','left']){
    const arm=panel.donorHands[hand];
    const goal=localDonor(hand==='right'?w.trigger:w.support);
    const q=panel.anchor.getWorldQuaternion(Q()).invert().multiply(
      panel.hands[hand].hand.getWorldQuaternion(Q()))
      .multiply(panel.donorOffsets[hand]);
    const roll=state.side==='red'
      ?(hand==='right'?-.17:.48):(hand==='right'?-.12:.18);
    q.multiply(Q().setFromAxisAngle(new THREE.Vector3(0,0,1),roll));
    if(state.side==='blue'&&state.weapon==='smg')
      q.multiply(Q().setFromAxisAngle(new THREE.Vector3(1,0,0),hand==='right'?-.8:.8));
    solveArm(panel.anchor,arm.upper,arm.elbow,arm.hand,goal,poles[hand]);
    orient(panel.anchor,arm.hand,q);
   }
  }
  panel.costume.updateWorldMatrix(true,true);
 }
 panel.anchor.updateWorldMatrix(true,true);
}
function handSurface(panel,hand){
 const anchor=panel.weapon?.[hand==='left'?'support':'trigger'];
 if(!anchor)return null;
 const grip=anchor.getWorldPosition(V());
 const wrist=(panel.donorHands||panel.hands)[hand].hand.getWorldPosition(V());
 let sum=V(),samples=0,nearest=Infinity;
 for(const mesh of panel.skinMeshes){
  mesh.updateWorldMatrix(true,false);
  mesh.skeleton?.update();
  const g=mesh.geometry,idx=g.getAttribute('skinIndex'),
   weight=g.getAttribute('skinWeight'),pos=g.getAttribute('position');
  if(!idx||!weight||!pos)continue;
  const step=Math.max(1,Math.ceil(pos.count/8000)),p=V();
  for(let i=0;i<pos.count;i+=step){
   const bones=[idx.getX(i),idx.getY(i),idx.getZ(i),idx.getW(i)],
     weights=[weight.getX(i),weight.getY(i),weight.getZ(i),weight.getW(i)];
   let wt=0;
   for(let k=0;k<4;k++){
    const name=mesh.skeleton.bones[bones[k]]?.name||'';
    const normalized=name.replace(/_\d+$/,'').replace(/^mixamorig[:_]?/i,'');
    if(panel.costume
      ?normalized.startsWith(hand==='left'?'LeftHand':'RightHand')
      :/^(hand_|(?:thumb|index|middle|ring|pinky)_)/.test(normalized)&&normalized.endsWith(hand==='left'?'_l':'_r')
    )wt+=weights[k];
   }
   if(wt<.58)continue;
   p.fromBufferAttribute(pos,i);
   mesh.applyBoneTransform(i,p);
   p.applyMatrix4(mesh.matrixWorld);
   sum.add(p);nearest=Math.min(nearest,p.distanceTo(grip));samples++;
  }
 }
 const centroid=samples?sum.divideScalar(samples):wrist.clone();
 const markers=panel.markers[hand];
 markers.grip.position.copy(panel.anchor.worldToLocal(grip.clone()));
 markers.surface.position.copy(panel.anchor.worldToLocal(centroid.clone()));
 markers.wrist.position.copy(panel.anchor.worldToLocal(wrist.clone()));
 for(const m of Object.values(markers))m.visible=state.markers;
 return{
  sampledVisibleVertices:samples,
  wristToGrip:+wrist.distanceTo(grip).toFixed(4),
  surfaceToGrip:+centroid.distanceTo(grip).toFixed(4),
  closestVertexToGrip:+nearest.toFixed(4)
 };
}
let world,panels=[],reportTimer=0,last=0,frames=0,second=0,lastSurface={};
function report(){
 if(!panels.length)return;
 const stats={revision:THREE.REVISION,webgl2:world.renderer.capabilities.isWebGL2,
  faction:state.side,weapon:state.weapon,animation:state.animation,retarget:state.retarget,
  fps:state.fps,people:panels.length,loadedWeapon:panels[0].weapon?.id||null};
 for(const [index,p] of panels.entries()){
  const bones=boneMap(p.native),second=p.costume?boneMap(p.costume,true):null;
  const left=handSurface(p,'left'),right=handSurface(p,'right');
  stats[p.mode]={sourceBones:bones.size,donorBones:second?.size||0,oneRigDetails:p.oneRigDetails||null,
   matchedBones:p.bindings.length,skinMeshes:p.skinMeshes.length,left,right};
 }
 state.stats=stats;
 $('report').textContent=[
 'Текущая версия Three.js: r'+stats.revision+' | WebGL 2: '+stats.webgl2+' | '+state.fps+' FPS',
 'Слева: военная форма на ЕДИНОМ скелете Quaternius:',
 '  кисть Л: сустав→оружие '+stats.single.left.wristToGrip+'; геометрия→оружие '+stats.single.left.surfaceToGrip,
 '  кисть П: сустав→оружие '+stats.single.right.wristToGrip+'; геометрия→оружие '+stats.single.right.surfaceToGrip,
 'Справа: прежние ДВА скелета, совпало костей: '+stats.dual.matchedBones,
 '  кисть Л: сустав→оружие '+stats.dual.left.wristToGrip+'; геометрия→оружие '+stats.dual.left.surfaceToGrip,
 '  кисть П: сустав→оружие '+stats.dual.right.wristToGrip+'; геометрия→оружие '+stats.dual.right.surfaceToGrip,
 'Числа приведены в единицах игрового мира. Контакт не гарантирует правильные пальцы.'
 ].join('\n');
}
function animate(now){
 const dt=Math.min(.06,(now-last)/1000||0);last=now;
 frames++;second+=dt;
 if(second>=1){state.fps=Math.round(frames/second);frames=0;second=0;}
 if(state.ready){
  for(const p of panels)setRigPose(p,dt);
  reportTimer+=dt;
  if(reportTimer>.32){reportTimer=0;report();}
 }
 world.controls.update();world.resize();
 world.renderer.render(world.scene,world.camera);
}
async function refreshWeapon(){
 if(!state.ready)return;
 state.ready=false;status('Загрузка оригинального оружия '+state.weapon+'…');
 const id=weaponIds[state.side][state.weapon];
 const [source,manifest]=await Promise.all([loadWeaponSource(id),manifestPromise]);
 if(!manifest.weapons?.[id])throw Error('Отсутствует точка хвата '+id);
 for(const p of panels){
  configureWeapon(p,source,manifest.weapons[id],id);
  p.side=state.side;
  if(p.costume)colorWw2Donor(p.costume,state.side);
  if(p.oneRigUniform)colorWw2Donor(p.oneRigUniform,state.side);
 }
 state.ready=true;$('busy').hidden=true;
 $('message').textContent='Модели r187 работают. Сравнивай геометрию кистей, не только координаты костей.';
}
function controls(){
 const read=()=>({
  side:select.side.value,weapon:select.weapon.value,
  animation:select.animation.value,retarget:select.retarget.value
 });
 for(const [key,element] of Object.entries(select)){
  element.onchange=async()=>{
   const previous=state[key];state[key]=element.value;
   if(key==='weapon'||key==='side'){
    try{await refreshWeapon();}catch(e){state[key]=previous;fail(e.message);}
   }
  };
 }
 $('markers').onclick=()=>{
  state.markers=!state.markers;
  $('markers').setAttribute('aria-pressed',String(state.markers));
 };
 $('aim').onclick=()=>{
  state.aim=!state.aim;
  $('aim').setAttribute('aria-pressed',String(state.aim));
 };
}
async function main(){
 if(!document.createElement('canvas').getContext('webgl2'))
  throw Error('WebGL 2 недоступен: миграция r187 на этом устройстве небезопасна');
 world=setupWorld();controls();
 status('Загрузка Quaternius, анимаций и нашего настоящего костюма…');
 const [character,animations,donor]=await Promise.all([
  loader.loadAsync(new URL('native-hero-quaternius/night-striker-lite.glb',asset).href),
  loader.loadAsync(new URL('native-hero-quaternius/hero-three-clips-lite.glb',asset).href),
  extractBundledCostume()
 ]);
 panels=[
  makeSingleRigPanel(-1.65,character.scene,donor,animations.animations,'blue'),
  makePanel(1.65,character.scene,donor,animations.animations,'blue')
 ];
 state.ready=true;await refreshWeapon();
 // Compute the very first actual IK/glove pose BEFORE reporting ready.
 // Otherwise first-frame metrics measured unpositioned wrists (~2m error).
 for(const panel of panels)setRigPose(panel,0);
 window.__rigLab.scene=world.scene;window.__rigLab.panels=panels;
 window.__rigLab.getReport=()=>state.stats;
 window.__rigLab.setState=async args=>{
  for(const [k,v] of Object.entries(args)){if(k in state){state[k]=v;if(select[k])select[k].value=v;}}
  if(args.side||args.weapon)await refreshWeapon();
  for(const p of panels)setRigPose(p,1/60);
  report();
 };
 world.renderer.setAnimationLoop(animate);
 report();
 console.info('R187 ONE RIG LAB READY',state.stats);
}
main().catch(e=>fail(e?.stack||e));
