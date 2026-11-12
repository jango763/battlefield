// German infantry integration v2. Gameplay, damage and input stay in the original game.
// Model: britdawgmasterfunk, CC BY 4.0; see assets/soldiers/CREDITS.md.
const creditsLink=document.createElement('a');creditsLink.textContent='Авторы моделей';creditsLink.href='../assets/soldiers/CREDITS.md';creditsLink.target='_blank';creditsLink.rel='noopener';creditsLink.style.cssText='position:fixed;z-index:23;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 113px);font:10px Arial;color:#e7dec8;background:#20251dcc;padding:3px 5px';document.body.appendChild(creditsLink);
const germanPreview={template:null,pending:[],bounds:null,limit:8,showNew:true,error:null};
function germanPreviewLabel(message){const e=document.getElementById('german-preview-status');if(e&&e.textContent!==message)e.textContent=message;}
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
  const rifle=new THREE.Group(),machineGun=new THREE.Group(),launcher=new THREE.Group();root.add(rifle,machineGun,launcher);
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
  const flash=new THREE.Mesh(new THREE.SphereGeometry(.08,6,4),new THREE.MeshBasicMaterial({color:0xffd487}));flash.position.set(0,.05,.87);flash.scale.set(.7,.7,2.2);flash.visible=false;root.add(flash);
  const rear=new THREE.Object3D(),front=new THREE.Object3D();rear.position.set(-.025,-.07,-.035);front.position.set(.03,-.065,.20);root.add(rear,front);
  root.name='GermanWeapon';return{root,flash,rear,front,rifle,machineGun,launcher};
}
function attachGermanSoldier(unit){
  if(unit.t!=='red'||unit.cmd||unit.eng||unit.germanPreview)return;
  if(!germanPreview.template){if(!germanPreview.pending.includes(unit))germanPreview.pending.push(unit);return;}
  if(U.filter(u=>u.germanPreview&&u.hp>0).length>=germanPreview.limit)return;
  let figure;
  try{figure=germanSkeletonClone(germanPreview.template);}catch(e){console.warn(e);return;}
  const anchor=new THREE.Group();anchor.name='GermanVisual';anchor.add(figure);
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
    if(type==='RingGeometry'||type==='CircleGeometry')continue;
    legacy.add(child);
  }
  const weapon=makeGermanWeapon();anchor.add(weapon.root);unit.m.g.add(legacy,anchor);
  const local=(bone)=>{anchor.updateWorldMatrix(true,true);return anchor.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));};
  const feet={left:local(bones.lFoot),right:local(bones.rFoot)};
  const anchorQ=anchor.getWorldQuaternion(new THREE.Quaternion()).invert();
  const footQ={left:anchorQ.clone().multiply(bones.lFoot.getWorldQuaternion(new THREE.Quaternion())),right:anchorQ.clone().multiply(bones.rFoot.getWorldQuaternion(new THREE.Quaternion()))};
  unit.germanPreview={anchor,figure,legacy,bones,rest,feet,footQ,weapon,phase:0,walk:0,aim:0,yaw:0,
    targets:{left:new THREE.Vector3(),right:new THREE.Vector3(),rear:new THREE.Vector3(),front:new THREE.Vector3()},
    poles:{left:new THREE.Vector3(.72,1.35,-.12),right:new THREE.Vector3(-.72,1.35,-.12),lKnee:new THREE.Vector3(.24,.6,.9),rKnee:new THREE.Vector3(-.24,.6,.9)}};
  legacy.visible=!germanPreview.showNew;anchor.visible=germanPreview.showNew;
  animateGermanSoldier(unit,0);
  refreshGermanPreviewLabel();
}
function refreshGermanPreviewLabel(){
  const count=U.filter(u=>u.hp>0&&u.germanPreview).length;
  germanPreviewLabel('🇩🇪 Новая пехота: '+count+' / '+germanPreview.limit);
}
function disposeGermanSoldier(unit){
  const v=unit.germanPreview;if(!v)return;
  const materials=new Set();v.weapon.root.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material)materials.add(n.material);});
  for(const m of materials)m.dispose();
  v.figure.traverse(n=>{if(n.skeleton&&n.skeleton.boneTexture)n.skeleton.boneTexture.dispose();});
}
function animateGermanSoldier(unit,dt=.016){
  const v=unit.germanPreview;if(!v)return;
  v.legacy.visible=!germanPreview.showNew;v.anchor.visible=germanPreview.showNew;
  if(!germanPreview.showNew)return;
  const blend=1-Math.exp(-Math.max(0,dt)*12),speed=unit.sv||0;
  v.walk+=(Math.min(1,speed/4.5)-v.walk)*blend;v.aim+=((unit.aim>0?1:0)-v.aim)*blend;
  // One full gait cycle per 1.7 game units, with a continuous phase at stops.
  v.phase=(v.phase+dt*speed/1.7*Math.PI*2)%(Math.PI*2);
  for(const r of v.rest){r.bone.quaternion.copy(r.q);r.bone.position.copy(r.p);}
  unit.g.position.set(unit.x,0,unit.z);unit.g.rotation.x=0;unit.g.rotation.z=0;
  let yaw=unit.aimT==null?0:Math.atan2(Math.sin(unit.aimT-unit.g.rotation.y),Math.cos(unit.aimT-unit.g.rotation.y));
  if(speed<.6&&unit.aim>0){const turn=yaw*(1-Math.exp(-dt*7));unit.g.rotation.y+=turn;yaw-=turn;}
  v.yaw+=(THREE.MathUtils.clamp(yaw,-.9,.9)*v.aim-v.yaw)*blend;
  GermanRig.rotate(v.bones.spine,[.08*v.walk,v.yaw*.4,0]);
  GermanRig.rotate(v.bones.chest,[0,v.yaw*.6,0]);
  const bob=Math.abs(Math.cos(v.phase))*.018*v.walk;
  v.anchor.position.y=-.015*v.walk+bob;
  const stride=.38*v.walk,lift=.15*v.walk;
  for(const [side,offset] of [['left',0],['right',Math.PI]]){
    const p=v.phase+offset,t=v.targets[side],f=v.feet[side];
    t.copy(f);t.z+=Math.cos(p)*stride;t.y+=Math.max(0,Math.sin(p))*lift;
    GermanRig.solve(v.anchor,side==='left'?v.bones.lUp:v.bones.rUp,side==='left'?v.bones.lKnee:v.bones.rKnee,side==='left'?v.bones.lFoot:v.bones.rFoot,t,side==='left'?v.poles.lKnee:v.poles.rKnee);
    GermanRig.orient(v.anchor,side==='left'?v.bones.lFoot:v.bones.rFoot,v.footQ[side]);
  }
  const recoil=unit.kick>0?Math.min(1,unit.kick/.1)*.035:0;
  const w=v.weapon.root;w.position.set(-.11,1.78+v.aim*.12+Math.sin(v.phase*2)*.012*v.walk,.19-recoil);
  w.position.applyAxisAngle(new THREE.Vector3(0,1,0),v.yaw);
  w.rotation.set(.28*(1-v.aim),v.yaw,-.04,'YXZ');
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
  const heavy=!!(unit.hv&&unit.ammo>0);
  v.weapon.rifle.visible=!heavy;v.weapon.machineGun.visible=!heavy&&unit.type==='mg';v.weapon.launcher.visible=heavy;
  v.anchor.updateWorldMatrix(true,true);
}
function toggleGermanSoldierPreview(){
  germanPreview.showNew=!germanPreview.showNew;
  for(const u of U){const v=u.germanPreview;if(v){v.legacy.visible=!germanPreview.showNew;v.anchor.visible=germanPreview.showNew;}}
  const b=document.getElementById('german-compare');if(b)b.textContent=germanPreview.showNew?'🇩🇪 Показать старую':'🇩🇪 Показать новую';
}
document.getElementById('german-compare').addEventListener('click',toggleGermanSoldierPreview);
function loadGermanSoldierPreview(){
  if(typeof THREE.GLTFLoader!=='function'){germanPreviewLabel('Модель недоступна — исходные бойцы');return;}
  try{
    const base64=document.getElementById('preview-german-glb').textContent.trim(),bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    new THREE.GLTFLoader().parse(bytes.buffer,'',gltf=>{
      try{
        const figure=gltf.scene;figure.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(figure);
        if(!Number.isFinite(bounds.min.y)||bounds.max.y<=bounds.min.y)throw new Error('Размеры модели');
        figure.traverse(n=>{if(!n.isMesh)return;n.castShadow=true;n.receiveShadow=true;
          const prep=m=>{m=m.clone();m.metalness=/helmet/i.test(m.name)?.15:0;m.roughness=.86;
            m.emissive.setHex(0x171b13);m.emissiveIntensity=.24;return m;};
          n.material=Array.isArray(n.material)?n.material.map(prep):prep(n.material);
        });
        germanPreview.template=figure;germanPreview.bounds=bounds;
        const queue=[...germanPreview.pending];germanPreview.pending.length=0;
        for(const u of queue)if(u.hp>0)attachGermanSoldier(u);
        refreshGermanPreviewLabel();
      }catch(e){console.error(e);germanPreviewLabel('Ошибка модели — исходные бойцы');}
    },e=>{console.error(e);germanPreviewLabel('Ошибка загрузки — исходные бойцы');});
  }catch(e){console.error(e);germanPreviewLabel('Ошибка модели — исходные бойцы');}
}
setTimeout(loadGermanSoldierPreview,200);
