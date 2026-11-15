/* Battlefield weapon fitting test: original 65-bone Panzergrenadier + source Kar98k GLB.
   No garment geometry, materials, texture maps or battle mechanics modified. */
(function(){
'use strict';
const THREE=window.THREE;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function world(bone){return bone.getWorldPosition(V())}
function getBone(figure,name){
 const found=[];
 figure.traverse(n=>{if(n.isBone&&(n.name===name||new RegExp('^(?:mixamorig)?'+name+'_\\d+$','i').test(n.name)))found.push(n)});
 return found[0]||null;
}
function aimChildAt(bone,child,targetWorld){
 bone.updateWorldMatrix(true,true);
 const a=world(bone),b=world(child),src=b.sub(a).normalize(),dst=targetWorld.clone().sub(a).normalize();
 if(src.lengthSq()<.00001||dst.lengthSq()<.00001)return;
 const delta=new THREE.Quaternion().setFromUnitVectors(src,dst);
 const current=bone.getWorldQuaternion(new THREE.Quaternion());
 const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 bone.quaternion.copy(parent.multiply(delta.multiply(current)));
 bone.updateWorldMatrix(false,true);
}
function aimTwoBone(figure,upper,lower,hand,targetWorld,poleWorld){
 figure.updateWorldMatrix(true,true);
 const shoulder=world(upper),elbow0=world(lower),wrist0=world(hand);
 const a=shoulder.distanceTo(elbow0),b=elbow0.distanceTo(wrist0);
 const delta=targetWorld.clone().sub(shoulder),distance=delta.length();
 if(!Number.isFinite(distance)||distance<1e-5||a<1e-5||b<1e-5)throw Error('Некорректные размеры рук');
 const direction=delta.divideScalar(distance);
 const maxReach=a+b-.0005;
 const d=THREE.MathUtils.clamp(distance,Math.abs(a-b)+.001,maxReach);
 const along=(a*a-b*b+d*d)/(2*d);
 const sideways=poleWorld.clone().sub(shoulder).addScaledVector(direction,-poleWorld.clone().sub(shoulder).dot(direction));
 if(sideways.lengthSq()<1e-9)sideways.set(1,0,0);
 sideways.normalize();
 const elbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(sideways,Math.sqrt(Math.max(0,a*a-along*along)));
 aimChildAt(upper,lower,elbow);
 aimChildAt(lower,hand,targetWorld);
 figure.updateWorldMatrix(true,true);
 return {shoulder:shoulder.toArray(),elbow:world(lower).toArray(),hand:world(hand).toArray(),target:targetWorld.toArray(),
   distance:world(hand).distanceTo(targetWorld),reach:a+b,requested:distance};
}
window.installPanzerKar98k=function({figure,scene,status,state}){
 if(!THREE?.GLTFLoader)throw Error('GLTFLoader not ready');
 state.weaponStatus='loading';
 return new Promise((resolve,reject)=>{
 new THREE.GLTFLoader().load('../../assets/ww2-weapons/de-kar98k.glb',gltf=>{
 try{
  state.availableBones=[];figure.traverse(n=>{if(n.isBone)state.availableBones.push(n.name)});
  const bones={};
  for(const n of ['RightArm','RightForeArm','RightHand','LeftArm','LeftForeArm','LeftHand'])bones[n]=getBone(figure,n);
  if(Object.values(bones).some(n=>!n))throw Error('Оригинальный скелет: не найдены кости рук '+Object.entries(bones).filter(([,v])=>!v).map(([k])=>k).join(','));
  const rightShoulder=world(bones.RightArm),leftShoulder=world(bones.LeftArm);
  const shoulderMid=rightShoulder.clone().add(leftShoulder).multiplyScalar(.5);
  const towardLeft=V().subVectors(leftShoulder,rightShoulder).normalize();
  // The rifle grip (trigger) sits just below the right chest; its muzzle faces the enemy (+Z).
  const trigger=rightShoulder.clone().lerp(leftShoulder,.14);
  trigger.y=shoulderMid.y-.24;
  trigger.z=shoulderMid.z+.25;
  const barrelDir=V(towardLeft.x*.29,.075,.954).normalize();
  const weaponRoot=new THREE.Group();weaponRoot.name='ApprovedGermanKar98k';
  weaponRoot.position.copy(trigger);
  weaponRoot.quaternion.setFromUnitVectors(V(0,0,1),barrelDir);
  const weapon=gltf.scene;weapon.name='Kar98kSourceGLB';weaponRoot.add(weapon);
  weaponRoot.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});
  scene.add(weaponRoot);
  weaponRoot.updateMatrixWorld(true);
  const rightGrip=weaponRoot.localToWorld(V(0,0,0));
  const leftGrip=weaponRoot.localToWorld(V(0,.0403422158,.3505));
  const rightPole=rightShoulder.clone().add(V(-Math.sign(towardLeft.x)*.36,-.18,-.08));
  const leftPole=leftShoulder.clone().add(V(Math.sign(towardLeft.x)*.39,-.19,-.12));
  const right=aimTwoBone(figure,bones.RightArm,bones.RightForeArm,bones.RightHand,rightGrip,rightPole);
  const left=aimTwoBone(figure,bones.LeftArm,bones.LeftForeArm,bones.LeftHand,leftGrip,leftPole);
  figure.updateMatrixWorld(true);
  state.weaponId='de-kar98k';
  state.weaponStatus='ready';
  state.weaponMeshCount=0;weapon.traverse(n=>{if(n.isMesh)state.weaponMeshCount++});
  state.grip={right,left};
  state.weaponDisplay={trigger:rightGrip.toArray(),support:leftGrip.toArray(),muzzle:weaponRoot.localToWorld(V(0,.0474937894,.8155)).toArray(),
   shoulder:weaponRoot.localToWorld(V(0,-.0466562106,-.2945)).toArray()};
  state.modelBones=Object.fromEntries(Object.entries(bones).map(([name,bone])=>[name,{name:bone.name,world:world(bone).toArray()}]));
  status.textContent='Kar98k: установлена · обе руки подведены к оружию · модель и форма оригинальные';
  resolve({root:weaponRoot,bones,weapon});
 }catch(err){state.weaponStatus='error';state.weaponError=String(err);status.textContent='Ошибка установки Kar98k: '+String(err.message||err);reject(err)}
 },undefined,err=>{state.weaponStatus='error';state.weaponError=String(err);status.textContent='Ошибка загрузки Kar98k';reject(err)});
 });
};
})();,'i').test(n.name)))found.push(n)});
 return found[0]||null;
}
function aimChildAt(bone,child,targetWorld){
 bone.updateWorldMatrix(true,true);
 const a=world(bone),b=world(child),src=b.sub(a).normalize(),dst=targetWorld.clone().sub(a).normalize();
 if(src.lengthSq()<.00001||dst.lengthSq()<.00001)return;
 const delta=new THREE.Quaternion().setFromUnitVectors(src,dst);
 const current=bone.getWorldQuaternion(new THREE.Quaternion());
 const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 bone.quaternion.copy(parent.multiply(delta.multiply(current)));
 bone.updateWorldMatrix(false,true);
}
function aimTwoBone(figure,upper,lower,hand,targetWorld,poleWorld){
 figure.updateWorldMatrix(true,true);
 const shoulder=world(upper),elbow0=world(lower),wrist0=world(hand);
 const a=shoulder.distanceTo(elbow0),b=elbow0.distanceTo(wrist0);
 const delta=targetWorld.clone().sub(shoulder),distance=delta.length();
 if(!Number.isFinite(distance)||distance<1e-5||a<1e-5||b<1e-5)throw Error('Некорректные размеры рук');
 const direction=delta.divideScalar(distance);
 const maxReach=a+b-.0005;
 const d=THREE.MathUtils.clamp(distance,Math.abs(a-b)+.001,maxReach);
 const along=(a*a-b*b+d*d)/(2*d);
 const sideways=poleWorld.clone().sub(shoulder).addScaledVector(direction,-poleWorld.clone().sub(shoulder).dot(direction));
 if(sideways.lengthSq()<1e-9)sideways.set(1,0,0);
 sideways.normalize();
 const elbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(sideways,Math.sqrt(Math.max(0,a*a-along*along)));
 aimChildAt(upper,lower,elbow);
 aimChildAt(lower,hand,targetWorld);
 figure.updateWorldMatrix(true,true);
 return {shoulder:shoulder.toArray(),elbow:world(lower).toArray(),hand:world(hand).toArray(),target:targetWorld.toArray(),
   distance:world(hand).distanceTo(targetWorld),reach:a+b,requested:distance};
}
window.installPanzerKar98k=function({figure,scene,status,state}){
 if(!THREE?.GLTFLoader)throw Error('GLTFLoader not ready');
 state.weaponStatus='loading';
 return new Promise((resolve,reject)=>{
 new THREE.GLTFLoader().load('../../assets/ww2-weapons/de-kar98k.glb',gltf=>{
 try{
  state.availableBones=[];figure.traverse(n=>{if(n.isBone)state.availableBones.push(n.name)});
  const bones={};
  for(const n of ['RightArm','RightForeArm','RightHand','LeftArm','LeftForeArm','LeftHand'])bones[n]=getBone(figure,n);
  if(Object.values(bones).some(n=>!n))throw Error('Оригинальный скелет: не найдены кости рук '+Object.entries(bones).filter(([,v])=>!v).map(([k])=>k).join(','));
  const rightShoulder=world(bones.RightArm),leftShoulder=world(bones.LeftArm);
  const shoulderMid=rightShoulder.clone().add(leftShoulder).multiplyScalar(.5);
  const towardLeft=V().subVectors(leftShoulder,rightShoulder).normalize();
  // The rifle grip (trigger) sits just below the right chest; its muzzle faces the enemy (+Z).
  const trigger=rightShoulder.clone().lerp(leftShoulder,.14);
  trigger.y=shoulderMid.y-.24;
  trigger.z=shoulderMid.z+.25;
  const barrelDir=V(towardLeft.x*.29,.075,.954).normalize();
  const weaponRoot=new THREE.Group();weaponRoot.name='ApprovedGermanKar98k';
  weaponRoot.position.copy(trigger);
  weaponRoot.quaternion.setFromUnitVectors(V(0,0,1),barrelDir);
  const weapon=gltf.scene;weapon.name='Kar98kSourceGLB';weaponRoot.add(weapon);
  weaponRoot.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});
  scene.add(weaponRoot);
  weaponRoot.updateMatrixWorld(true);
  const rightGrip=weaponRoot.localToWorld(V(0,0,0));
  const leftGrip=weaponRoot.localToWorld(V(0,.0403422158,.3505));
  const rightPole=rightShoulder.clone().add(V(-Math.sign(towardLeft.x)*.36,-.18,-.08));
  const leftPole=leftShoulder.clone().add(V(Math.sign(towardLeft.x)*.39,-.19,-.12));
  const right=aimTwoBone(figure,bones.RightArm,bones.RightForeArm,bones.RightHand,rightGrip,rightPole);
  const left=aimTwoBone(figure,bones.LeftArm,bones.LeftForeArm,bones.LeftHand,leftGrip,leftPole);
  figure.updateMatrixWorld(true);
  state.weaponId='de-kar98k';
  state.weaponStatus='ready';
  state.weaponMeshCount=0;weapon.traverse(n=>{if(n.isMesh)state.weaponMeshCount++});
  state.grip={right,left};
  state.weaponDisplay={trigger:rightGrip.toArray(),support:leftGrip.toArray(),muzzle:weaponRoot.localToWorld(V(0,.0474937894,.8155)).toArray(),
   shoulder:weaponRoot.localToWorld(V(0,-.0466562106,-.2945)).toArray()};
  state.modelBones=Object.fromEntries(Object.entries(bones).map(([name,bone])=>[name,{name:bone.name,world:world(bone).toArray()}]));
  status.textContent='Kar98k: установлена · обе руки подведены к оружию · модель и форма оригинальные';
  resolve({root:weaponRoot,bones,weapon});
 }catch(err){state.weaponStatus='error';state.weaponError=String(err);status.textContent='Ошибка установки Kar98k: '+String(err.message||err);reject(err)}
 },undefined,err=>{state.weaponStatus='error';state.weaponError=String(err);status.textContent='Ошибка загрузки Kar98k';reject(err)});
 });
};
})();