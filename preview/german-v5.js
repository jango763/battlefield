// Unified soldier visuals: faction palettes and distinct hero/captain/engineer roles.
// Gameplay, damage and input stay in the original game.
// Model: britdawgmasterfunk, CC BY 4.0; see assets/soldiers/CREDITS.md.
const creditsLink=document.createElement('a');creditsLink.textContent='Авторы моделей';creditsLink.href='../assets/soldiers/CREDITS.md';creditsLink.target='_blank';creditsLink.rel='noopener';creditsLink.style.cssText='position:fixed;z-index:23;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 113px);font:10px Arial;color:#e7dec8;background:#20251dcc;padding:3px 5px';document.body.appendChild(creditsLink);
const germanPreview={template:null,pending:[],bounds:null,materials:new Map(),error:null,visualSequence:0};
function germanPreviewLabel(message){const e=document.getElementById('german-preview-status');if(e){e.hidden=!message;if(e.textContent!==message)e.textContent=message;}}
function soldierRole(unit){return unit.kind==='p'?'hero':unit.cmd?'captain':unit.eng?'engineer':'infantry';}
function soldierPalette(unit){return unit.kind==='p'?'hero':unit.t==='red'?'grey':'khaki';}
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
function soldierMaterial(source,palette,customTint){
  const key=source.uuid+':'+palette+(customTint==null?'':':'+customTint);if(germanPreview.materials.has(key))return germanPreview.materials.get(key);
  const m=source.clone(),cloth=m.name==='Material.003',helmet=/helmet/.test(m.name);
  m.metalness=helmet?.08:0;m.metalnessMap=null;m.roughness=.88;m.aoMapIntensity=.62;
  m.emissive.setHex(0x292b2c);m.emissiveIntensity=.16;
  if(cloth||helmet){
    const tint=new THREE.Color(customTint==null?(palette==='hero'?0x555960:palette==='grey'?0x93979b:0xb4ad85):customTint);
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
  legacy.visible=false;anchor.visible=true;
  animateGermanSoldier(unit,0);
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
  if(v.nativeRig&&animateNativeHeroRig(unit,v,dt))return;
  v.legacy.visible=false;v.anchor.visible=true;
  // Visual locomotion is independent of combat speed, collision and gameplay.
  // Filter speed so the stride cycle decelerates naturally instead of snapping.
  const safeDt=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.08);
  const speed=Math.max(0,Number.isFinite(unit.sv)?unit.sv:0);
  const blend=1-Math.exp(-safeDt*10);
  v.gaitSpeed+=(Math.min(6,speed)-v.gaitSpeed)*(1-Math.exp(-safeDt*7));
  v.walk+=(Math.min(1,speed/4.5)-v.walk)*(1-Math.exp(-safeDt*(speed>.2?8:11)));
  v.aim+=((unit.aim>0?1:0)-v.aim)*blend;
  v.idleClock+=safeDt;
  // Walk cadence is linked to actual unit speed; a slightly longer cycle reduces the hurried gait.
  v.phase=(v.phase+safeDt*v.gaitSpeed/3.1*v.cadence*Math.PI*2)%(Math.PI*2);
  for(const r of v.rest){r.bone.quaternion.copy(r.q);r.bone.position.copy(r.p);}
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
// Native rig diagnostic: Quaternius mesh + its OWN skeleton + animation library.
// No retargeting and no changes to the army or gameplay. Only the HERO.
// Assets from https://github.com/Seyamalam/blood-league-kickoff/ (CC0
// Quaternius, see docs/ASSET_CREDITS.md in upstream), pinned to source commit.
// Keep every fallback on the same exact test build and use the stripped
// assets. Derive the commit from the immutable GitHack preview URL.
const NATIVE_HERO_REF=location.pathname.split('/').filter(Boolean)[2]||'main';
const NATIVE_HERO_ASSET_ROOTS=[
  new URL('../assets/native-hero-quaternius/',location.href).href,
  'https://raw.githubusercontent.com/jango763/battlefield/'+NATIVE_HERO_REF+'/assets/native-hero-quaternius/',
  'https://cdn.jsdelivr.net/gh/jango763/battlefield@'+NATIVE_HERO_REF+'/assets/native-hero-quaternius/'
];
function nativeHeroLabel(msg){
  let node=document.getElementById('native-hero-rig-label');
  if(!node){
    node=document.createElement('div');node.id='native-hero-rig-label';
    node.style.cssText='position:fixed;z-index:1000;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 118px);max-width:390px;min-height:44px;padding:10px 12px;color:white;background:#6d280bfa;border:2px solid #ffd45b;border-radius:8px;box-shadow:0 2px 14px #000c;font:700 15px/1.3 Arial;pointer-events:none';
    document.body.appendChild(node);
  }
  if(/^НОВЫЙ СКЕЛЕТ v17: АКТИВЕН/.test(msg)&&!new URLSearchParams(location.search).has('rigdebug')){node.remove();return;}
  node.textContent=msg;
  node.style.background=/^НОВЫЙ СКЕЛЕТ v17: АКТИВЕН/.test(msg)?'#16582efa':/^СТАРЫЙ СКЕЛЕТ/.test(msg)?'#314255f5':'#6d280bfa';
}
// Hero-only native Quaternius rifle hold. This applies AFTER the native
// animation mixer, so the accepted walk/run/leg clips stay unchanged.
// Right hand controls the stock/trigger, left palm supports the fore-end.
function makeNativeHeroAssaultRifle(){
  const root=new THREE.Group();
  root.name='NativeHeroTwoHandRifle';
  const steel=new THREE.MeshLambertMaterial({color:0x313733}),
    dark=new THREE.MeshLambertMaterial({color:0x212623}),
    wood=new THREE.MeshLambertMaterial({color:0x6a4730}),
    edge=new THREE.MeshLambertMaterial({color:0x464c44}),
    flashMat=new THREE.MeshBasicMaterial({color:0xffe09b});
  const cube=(mat,x,y,z,px,py,pz,group=root)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),mat);
    mesh.position.set(px,py,pz);mesh.castShadow=true;group.add(mesh);return mesh;
  };
  // STG-44-inspired field rifle, recognizable side profile, one rigid object.
  // +Z is forward. Stock remains against the right upper torso.
  cube(wood,.115,.135,.36,0,-.017,-.32);
  cube(wood,.19,.18,.11,0,-.08,-.49);
  cube(steel,.13,.12,.38,0,.006,-.055);
  cube(edge,.11,.10,.29,0,.025,.18);
  cube(wood,.14,.105,.29,0,-.033,.31);
  cube(dark,.045,.11,.13,0,-.112,-.12); // pistol grip
  cube(steel,.095,.18,.095,0,-.156,.025).rotation.x=-.17; // magazine
  cube(edge,.047,.038,.11,0,.097,-.15);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.022,.026,.45,9),steel);
  barrel.rotation.x=Math.PI/2;barrel.position.set(0,.022,.57);barrel.castShadow=true;root.add(barrel);
  cube(dark,.055,.043,.065,0,.045,.84);
  cube(dark,.021,.075,.017,0,.101,.48);
  // Grip positions are wrist attachment points in rifle-local coordinates,
  // never applied as world or gameplay positions.
  const trigger=new THREE.Object3D();
  trigger.position.set(0,-.105,-.16);root.add(trigger);
  const support=new THREE.Object3D();
  support.position.set(0,-.10,.35);root.add(support);
  const muzzleFlash=new THREE.Mesh(new THREE.SphereGeometry(.072,7,5),flashMat);
  muzzleFlash.position.set(0,.022,.89);muzzleFlash.scale.set(.7,.7,1.8);
  muzzleFlash.visible=false;root.add(muzzleFlash);
  // Preserve the old test model as a safe fallback; it is hidden when a
  // historically modelled WW2 GLB has loaded. Launcher slots are separate.
  const fallback=new THREE.Group();fallback.name='LegacyTestRifle';
  for(const n of [...root.children])if(n!==trigger&&n!==support&&n!==muzzleFlash)fallback.add(n);
  root.add(fallback);
  const launcher=makeGermanWeapon().launcher;
  launcher.name='PrototypeLauncher';launcher.visible=false;root.add(launcher);
  return{root,trigger,support,muzzleFlash,fallback,launcher,
    ww2Models:new Map(),ww2Pending:new Set(),ww2Failed:new Map(),
    ww2Manifest:null,activeModel:null,activeModelId:'fallback'};
}

const WW2_WEAPON_GAME_SCALE=1.32;
function initNativeHeroWW2WeaponCatalog(rig){
  const w=rig.weapon;
  if(!w)return;
  const url=new URL('../assets/ww2-weapons/manifest.json',location.href);
  fetch(url).then(async response=>{
    if(!response.ok)throw new Error('WW2 manifest HTTP '+response.status);
    return response.json();
  }).then(manifest=>{
    const expected=['de-kar98k','de-mp40','de-mg42','uk-lee-enfield','uk-sten','uk-bren'];
    if(expected.some(key=>!manifest.weapons?.[key]?.trigger||!manifest.weapons[key]?.support))
      throw new Error('Incomplete licensed WW2 weapon catalog');
    w.ww2Manifest=manifest;
  }).catch(error=>{w.ww2CatalogError=String(error);console.warn('WW2 catalog fallback:',error);});
}
function selectNativeHeroWW2Weapon(unit,rig){
  const w=rig.weapon;
  const side=unit.side==='red'?'red':'blue',slot=Math.max(0,Math.min(5,unit.wpn|0));
  const ids=side==='red'?['de-kar98k','de-mp40','de-mg42','de-kar98k']:
    ['uk-lee-enfield','uk-sten','uk-bren','uk-lee-enfield'];
  const key=slot>=4?null:ids[slot],catalog=w.ww2Manifest,info=key?catalog?.weapons?.[key]:null;
  if(info&&!w.ww2Models.has(key)&&!w.ww2Pending.has(key)&&!w.ww2Failed.has(key)){
    w.ww2Pending.add(key);
    const url=new URL('../assets/ww2-weapons/'+info.file,location.href);
    new THREE.GLTFLoader().load(url.href,gltf=>{
      if(!rig.weapon||rig.weapon!==w)return;
      const obj=gltf.scene;
      obj.name='WW2_'+key;
      obj.scale.setScalar(WW2_WEAPON_GAME_SCALE);
      obj.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
      w.root.add(obj);
      w.ww2Models.set(key,obj);
      w.ww2Pending.delete(key);
    },undefined,error=>{
      w.ww2Pending.delete(key);
      w.ww2Failed.set(key,String(error?.message||error));
      console.warn('WW2 weapon fallback '+key,error);
    });
  }
  const active=!!(info&&w.ww2Models.has(key));
  for(const [name,model] of w.ww2Models)model.visible=active&&name===key;
  w.fallback.visible=!active&&slot<4;
  w.launcher.visible=slot>=4;
  w.activeModelId=active?key:slot>=4?'launcher-prototype':'fallback';
  w.activeModel=active?info:null;
  const vec=(data)=>new THREE.Vector3().fromArray(data).multiplyScalar(WW2_WEAPON_GAME_SCALE);
  if(active){
    w.trigger.position.copy(vec(info.trigger)).addScaledVector(new THREE.Vector3().fromArray(info.triggerPalm),.013);
    w.support.position.copy(vec(info.support)).addScaledVector(new THREE.Vector3().fromArray(info.supportPalm),.014);
    w.muzzleFlash.position.copy(vec(info.muzzle));
  }else{
    w.trigger.position.set(0,-.105,-.16);
    w.support.position.set(0,-.10,slot>=4?.32:.35);
    w.muzzleFlash.position.set(0,.022,slot>=4?1.0:.89);
  }
  // Sniper slots keep their established game rules and use the same
  // rifle mesh with a small optical attachment. No stat changes.
  if(!w.scope){
    const scope=new THREE.Group();scope.name='SniperOpticOnly';
    const mat=new THREE.MeshLambertMaterial({color:0x272d2b});
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(.023,.025,.20,12),mat);
    tube.rotation.x=Math.PI/2;tube.position.set(0,.13,.12);scope.add(tube);
    w.root.add(scope);w.scope=scope;
  }
  w.scope.visible=active&&slot===3;
  return w.activeModelId;
}

function initNativeHeroWeapon(v,rig){
  const boneMap=new Map();
  rig.model.traverse(n=>{if(n.isBone)boneMap.set(n.name,n);});
  const names=['upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l'];
  if(names.some(name=>!boneMap.has(name)))throw new Error('Нет костей хвата оружия: '+names.filter(name=>!boneMap.has(name)).join(','));
  const hands={
    right:{upper:boneMap.get('upperarm_r'),elbow:boneMap.get('lowerarm_r'),hand:boneMap.get('hand_r')},
    left:{upper:boneMap.get('upperarm_l'),elbow:boneMap.get('lowerarm_l'),hand:boneMap.get('hand_l')}
  };
  v.anchor.updateWorldMatrix(true,true);
  const weapon=makeNativeHeroAssaultRifle();
  rig.visual.add(weapon.root);
  rig.weapon=weapon;
  rig.hands=hands;
  rig.weaponHandQ={};
  for(const side of ['right','left']){
    const q=hands[side].hand.getWorldQuaternion(new THREE.Quaternion());
    const inv=rig.visual.getWorldQuaternion(new THREE.Quaternion()).invert();
    rig.weaponHandQ[side]=inv.multiply(q);
  }
  rig.weaponDiagnostics={ready:false,rightError:null,leftError:null,poseUpdates:0};
  initNativeHeroWW2WeaponCatalog(rig);
}
function updateNativeHeroWeapon(unit,v,rig,dt){
  if(!rig.weapon||!rig.hands)return;
  const vis=rig.visual,w=rig.weapon;
  vis.updateWorldMatrix(true,true);
  const local=bone=>vis.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
  const sr=local(rig.hands.right.upper),sl=local(rig.hands.left.upper);
  const sign=Math.sign(sr.x-sl.x)||-1;
  const aimed=unit.aim>0,speed=Math.max(0,unit.sv||0);
  const sprint=speed>4.2;
  const selection=selectNativeHeroWW2Weapon(unit,rig);
  const heading=unit.aimT==null?0:
    Math.atan2(Math.sin(unit.aimT-unit.g.rotation.y),Math.cos(unit.aimT-unit.g.rotation.y));
  w.root.rotation.set(aimed?-.055:sprint?.095:-.17,
    THREE.MathUtils.clamp(heading,-.55,.55)*(aimed?.4:0)-sign*.62,
    sign*(aimed?.02:.038),'YXZ');
  const center=new THREE.Vector3().addVectors(sr,sl).multiplyScalar(.5);
  const desiredTrigger=new THREE.Vector3(
    center.x+sign*.17,
    center.y-(aimed?.17:.245),
    center.z+(aimed?.22:.15)
  );
  // The physical trigger hand grip is the weapon's placement pivot.
  // Compensate source model's real grip offset before solving either arm.
  w.root.position.copy(desiredTrigger).sub(w.trigger.position.clone().applyQuaternion(w.root.quaternion));
  w.muzzleFlash.visible=unit.kick>0;
  vis.updateWorldMatrix(true,true);
  const targets={right:local(w.trigger),left:local(w.support)};
  const poles={
    right:sr.clone().add(new THREE.Vector3(sign*.51,-.27,-.10)),
    left:sl.clone().add(new THREE.Vector3(-sign*.48,-.27,.23))
  };
  for(const side of ['right','left']){
    const a=rig.hands[side];
    GermanRig.solve(vis,a.upper,a.elbow,a.hand,targets[side],poles[side]);
    // Wrist rotation tracks the weapon instead of preserving a frozen world
    // orientation as the muzzle moves between carry, aiming and sprint.
    const orientation=w.root.quaternion.clone().multiply(rig.weaponHandQ[side]);
    GermanRig.orient(vis,a.hand,orientation);
  }
  vis.updateWorldMatrix(true,true);
  const rightError=rig.hands.right.hand.getWorldPosition(new THREE.Vector3())
    .distanceTo(w.trigger.getWorldPosition(new THREE.Vector3()));
  const leftError=rig.hands.left.hand.getWorldPosition(new THREE.Vector3())
    .distanceTo(w.support.getWorldPosition(new THREE.Vector3()));
  rig.weaponDiagnostics={
    ready:true,rightError,leftError,
    poseUpdates:(rig.weaponDiagnostics.poseUpdates||0)+1,
    gaitState:rig.state,aimed,sprint,
    weaponId:selection,weaponSlot:unit.wpn,side:unit.side,
    visible:w.root.visible,handTargets:{right:targets.right.toArray(),left:targets.left.toArray()}
  };
}

/* Corporal's field-grey equipment. Cosmetic-only: original Quaternius
   skeleton, native walk cycles, assault-rifle hand IK and gameplay intact. */
function dressNativeHeroPrimitiveUniform(rig){
  const bones=new Map();
  rig.model.traverse(n=>{
    if(n.isBone)bones.set(n.name,n);
    if(!n.isSkinnedMesh)return;
    const recolor=original=>{
      const m=original.clone();
      if(/MI_Superhero_Male/i.test(m.name)){
        // Palette follows native vertex skin weights. Bare face/hands retain
        // a skin tone, while clothing and feet are independently coloured.
        const geom=n.geometry.clone();
        const indices=geom.getAttribute('skinIndex');
        const weights=geom.getAttribute('skinWeight');
        if(!indices||!weights)throw new Error('Нет skin weights для одежды героя');
        const skinTone=new Float32Array(indices.count);
        const bootTone=new Float32Array(indices.count);
        const read=[indices.getX.bind(indices),indices.getY.bind(indices),indices.getZ.bind(indices),indices.getW.bind(indices)];
        const weight=[weights.getX.bind(weights),weights.getY.bind(weights),weights.getZ.bind(weights),weights.getW.bind(weights)];
        for(let i=0;i<indices.count;i++){
          for(let k=0;k<4;k++){
            const joint=n.skeleton.bones[Math.round(read[k](i))];
            if(!joint)continue;
            const influence=weight[k](i);
            if(/^(Head$|neck_|hand_|thumb_|index_|middle_|ring_|pinky_)/i.test(joint.name))skinTone[i]+=influence;
            if(/^(foot_|ball_)/i.test(joint.name))bootTone[i]+=influence;
          }
        }
        geom.setAttribute('heroSkinTone',new THREE.BufferAttribute(skinTone,1));
        geom.setAttribute('heroBootTone',new THREE.BufferAttribute(bootTone,1));
        n.geometry=geom;
        m.color.setHex(0xffffff);
        m.vertexColors=false;
        m.map=null;
        m.roughness=1;
        m.metalness=0;
        if(m.emissive)m.emissive.setHex(0x000000);
        m.onBeforeCompile=shader=>{
          shader.vertexShader='attribute float heroSkinTone; attribute float heroBootTone; varying float vHeroSkinTone; varying float vHeroBootTone;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeroSkinTone=heroSkinTone; vHeroBootTone=heroBootTone;');
          shader.fragmentShader='varying float vHeroSkinTone; varying float vHeroBootTone;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
            vec3 fieldGrey=vec3(.18,.21,.22);
            vec3 exposedSkin=vec3(.64,.45,.32);
            vec3 bootLeather=vec3(.045,.05,.052);
            diffuseColor.rgb=mix(fieldGrey,exposedSkin,smoothstep(.20,.75,vHeroSkinTone));
            diffuseColor.rgb=mix(diffuseColor.rgb,bootLeather,smoothstep(.16,.70,vHeroBootTone));`);
        };
        m.customProgramCacheKey=()=> 'native-hero-field-skin-boots-v2';
      }
      return m;
    };
    n.material=Array.isArray(n.material)?n.material.map(recolor):recolor(n.material);
    n.castShadow=true;n.receiveShadow=true;
  });
  for(const name of ['Head','spine_03','calf_l','calf_r','foot_l','foot_r'])
    if(!bones.has(name))throw new Error('Не найдена кость формы: '+name);
  const steel=new THREE.MeshLambertMaterial({color:0x434a4b});
  const cloth=new THREE.MeshLambertMaterial({color:0x505954});
  const leather=new THREE.MeshLambertMaterial({color:0x483c32});
  const webbing=new THREE.MeshLambertMaterial({color:0x676858});
  const dark=new THREE.MeshLambertMaterial({color:0x292f31});
  const add=(group,geo,material,x,y,z)=>{
    const mesh=new THREE.Mesh(geo,material);
    mesh.position.set(x,y,z);
    mesh.castShadow=true;mesh.receiveShadow=true;
    group.add(mesh);return mesh;
  };
  const helmet=new THREE.Group();
  helmet.name='CorporalFieldHelmet';
  const shell=add(helmet,new THREE.SphereGeometry(1,20,12),steel,0,.20,0);
  shell.scale.set(.255,.17,.265);
  const rim=add(helmet,new THREE.SphereGeometry(1,20,8),steel,0,.072,.015);
  rim.scale.set(.305,.035,.305);
  const rear=add(helmet,new THREE.SphereGeometry(1,16,8),steel,0,.058,-.19);
  rear.scale.set(.25,.03,.14);
  for(const sign of [-1,1]){
    const rivet=add(helmet,new THREE.SphereGeometry(.018,8,6),dark,sign*.245,.113,.01);
    rivet.scale.set(1,.65,1);
  }
  const strapPoints=[
    [-.235,.10,.02],[-.17,-.075,.085],[0,-.12,.155],
    [.17,-.075,.085],[.235,.10,.02]
  ].map(p=>new THREE.Vector3(...p));
  const strap=add(helmet,new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(strapPoints),16,.008,5,false),leather,0,0,0);
  strap.castShadow=false;
  const gear=new THREE.Group();gear.name='CorporalFieldWebbing';
  for(const sign of [-1,1]){
    const sling=add(gear,new THREE.BoxGeometry(.06,.40,.028),webbing,sign*.14,-.13,.19);
    sling.rotation.z=sign*.38;
    add(gear,new THREE.BoxGeometry(.15,.17,.10),leather,sign*.16,-.39,.21);
    add(gear,new THREE.BoxGeometry(.15,.035,.115),webbing,sign*.16,-.32,.21);
    const epaulette=add(gear,new THREE.BoxGeometry(.22,.038,.14),cloth,sign*.23,.055,.01);
    epaulette.rotation.z=sign*.1;
  }
  add(gear,new THREE.BoxGeometry(.47,.072,.08),leather,0,-.47,.135);
  add(gear,new THREE.BoxGeometry(.062,.068,.018),steel,0,-.47,.19);
  add(gear,new THREE.BoxGeometry(.36,.31,.14),cloth,0,-.23,-.19);
  add(gear,new THREE.BoxGeometry(.38,.045,.15),leather,0,-.15,-.23);
  const boots={},shoes={};
  for(const sign of ['l','r']){
    const boot=add(rig.visual,new THREE.CylinderGeometry(.108,.114,1,12),dark,0,0,0);
    boot.name='CorporalFieldBoot-'+sign;
    boots[sign]=boot;
    const shoe=add(rig.visual,new THREE.SphereGeometry(1,14,10),dark,0,0,0);
    shoe.name='CorporalFieldShoe-'+sign;
    shoe.scale.set(.145,.11,.25);
    shoes[sign]=shoe;
  }
  // Small collar gives the smooth base model a uniform neckline.
  for(const sign of [-1,1]){
    const lapel=add(gear,new THREE.BoxGeometry(.1,.19,.035),cloth,sign*.085,.075,.16);
    lapel.rotation.z=-sign*.22;
  }
  rig.visual.add(helmet,gear);
  rig.fieldUniform={bones,helmet,gear,boots,shoes};
  updateNativeHeroFieldUniform(rig);
}
function updateNativeHeroPrimitiveUniform(rig){
  const suit=rig.fieldUniform;if(!suit)return;
  const vis=rig.visual,bones=suit.bones;
  vis.updateWorldMatrix(true,true);
  const position=name=>vis.worldToLocal(bones.get(name).getWorldPosition(new THREE.Vector3()));
  const rotation=name=>{
    const worldQ=bones.get(name).getWorldQuaternion(new THREE.Quaternion());
    return vis.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQ);
  };
  suit.helmet.position.copy(position('Head'));
  suit.helmet.quaternion.copy(rotation('Head'));
  suit.gear.position.copy(position('spine_03'));
  suit.gear.quaternion.copy(rotation('spine_03'));
  for(const side of ['l','r']){
    const foot=position('foot_'+side),calf=position('calf_'+side);
    const displacement=calf.sub(foot);
    const length=displacement.length();
    const boot=suit.boots[side];
    if(length<.05){boot.visible=false;suit.shoes[side].visible=false;continue;}
    boot.visible=true;
    boot.position.copy(foot).addScaledVector(displacement,.43);
    boot.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),displacement.normalize());
    boot.scale.set(1,length*.77,1);
    const shoe=suit.shoes[side];
    shoe.visible=true;
    shoe.position.copy(foot).add(new THREE.Vector3(0,-.03,.11));
  }
}


// --- WWII donor wardrobe: an already bundled and credited Panzergrenadier GLB.
// Its original skinned WW2 jacket, trousers, belt, pockets and web gear replace
// the previous hard-edged procedural boxes. The native Quaternius clip mixer
// and rifle IK remain untouched; a separate outfit skeleton only follows pose.
// This is intentionally a preview until visual acceptance on mobile Safari.
function dressNativeHeroFieldUniform(rig){
  if(new URLSearchParams(location.search).get('uniform')==='prototype'){
    dressNativeHeroPrimitiveUniform(rig);
    return;
  }
  let ww2=null;
  try{
    if(!germanPreview.template||!germanPreview.bounds)throw Error('Panzergrenadier donor not loaded');
    const donor=germanSkeletonClone(germanPreview.template);
    rig.ww2OutfitTemporary=donor;
    donor.name='WW2PanzergrenadierClothing';
    const box=germanPreview.bounds,h=box.max.y-box.min.y;
    if(h<=.1)throw Error('Invalid WW2 donor bounds');
    const scale=2.55/h;
    donor.scale.setScalar(scale);
    donor.position.set(-(box.min.x+box.max.x)*scale*.5,-box.min.y*scale,-(box.min.z+box.max.z)*scale*.5);
    rig.visual.add(donor);
    const originalMeshes=[],donorMeshes=[];
    rig.model.traverse(n=>{if(n.isSkinnedMesh)originalMeshes.push(n);});
    donor.traverse(n=>{
      if(!n.isSkinnedMesh)return;
      const mat=n.material,name=mat&&mat.name||'';
      const type=/helmet|scrim/i.test(name)?'headgear':/ammopouches/i.test(name)?'pouches':'garment';
      const german=soldierMaterial(mat,'hero',0x4a5450);
      const british=soldierMaterial(mat,'khaki',0xa28d69);
      if(type==='pouches'){
        german.color.setHex(0xddd0b9);
        british.color.setHex(0xe3d7b9);
      }
      donorMeshes.push({mesh:n,type,german,british});
      n.material=german;
      n.visible=type!=='headgear';
      n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;
    });
    if(!donorMeshes.some(p=>p.type==='garment'))throw Error('WW2 uniform mesh missing');
    const nativeBones=new Map(),garmentBones=new Map();
    rig.model.traverse(n=>{if(n.isBone)nativeBones.set(n.name,n);});
    donor.traverse(n=>{
      if(!n.isBone)return;
      garmentBones.set(n.name.replace(/_\d+$/,'').replace(/^mixamorig[:_]?/i,''),n);
    });
    const map={
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
        for(let i=1;i<=3;i++)
          map[side+'Hand'+finger+i]=finger.toLowerCase()+'_0'+i+'_'+suffix;
    }
    rig.model.updateWorldMatrix(true,true);
    donor.updateWorldMatrix(true,true);
    const bindings=[];
    for(const [targetName,sourceName] of Object.entries(map)){
      const target=garmentBones.get(targetName),source=nativeBones.get(sourceName);
      if(!target||!source)continue;
      bindings.push({
        target,source,
        sourceRestInv:source.getWorldQuaternion(new THREE.Quaternion()).invert(),
        targetRest:target.getWorldQuaternion(new THREE.Quaternion())
      });
    }
    if(bindings.length<16)throw Error('Too few compatible WW2 outfit joints: '+bindings.length+
      '; nativeNames='+JSON.stringify([...nativeBones.keys()].slice(0,24))+
      '; donorNames='+JSON.stringify([...garmentBones.keys()].slice(0,24))+
      '; rawDonor='+JSON.stringify([...garmentBones.values()].slice(0,10).map(n=>n.name)));
    ww2={donor,bindings,donorMeshes,originalMeshes,side:null,modelType:'existing-panzergrenadier',
      headwear:'none',headBone:garmentBones.get('Head'),matchedBones:bindings.length};
    rig.ww2Uniform=ww2;
    rig.ww2OutfitTemporary=null;
    for(const mesh of originalMeshes)mesh.visible=false; // preserve animation skeleton
    updateNativeHeroFieldUniform(rig);
    loadNativeHeroM43Cap(rig);
  }catch(error){
    rig.ww2UniformError=String(error&&error.stack||error);
    console.warn('WW2 wardrobe fallback (original native skeleton unaffected):',error);
    if(ww2?.donor)rig.visual.remove(ww2.donor);
    if(rig.ww2Uniform)rig.visual.remove(rig.ww2Uniform.donor);
    if(rig.ww2OutfitTemporary)rig.visual.remove(rig.ww2OutfitTemporary);
    rig.ww2OutfitTemporary=null;
    rig.ww2Uniform=null;
    rig.model.traverse(n=>{if(n.isSkinnedMesh)n.visible=true;});
    dressNativeHeroPrimitiveUniform(rig);
    // The rejected pot-shaped helmet must never return as fallback.
    rig.fieldUniform.helmet.visible=false;
  }
}
function updateNativeHeroFieldUniform(rig){
  const uniform=rig.ww2Uniform;
  if(!uniform){
    updateNativeHeroPrimitiveUniform(rig);
    return;
  }
  const side=(P&&P.side)==='red'?'red':'blue';
  if(uniform.side!==side){
    uniform.side=side;
    if(uniform.cap)uniform.cap.visible=side==='red';
    for(const item of uniform.donorMeshes){
      item.mesh.material=side==='red'?item.german:item.british;
      // Original WWII M42 helmet is deliberately NOT substituted for M43.
      item.mesh.visible=item.type==='garment'||(item.type==='pouches'&&side==='red');
    }
  }
  // Re-target the already tested Quaternius anatomical pose to the secondary
  // clothing skin, without modifying a single native bone / clip / rifle IK.
  rig.model.updateWorldMatrix(true,true);
  uniform.donor.updateWorldMatrix(true,true);
  const sourceQ=new THREE.Quaternion(),targetQ=new THREE.Quaternion(),parentQ=new THREE.Quaternion();
  for(const binding of uniform.bindings){
    binding.source.getWorldQuaternion(sourceQ);
    targetQ.copy(sourceQ).multiply(binding.sourceRestInv).multiply(binding.targetRest);
    binding.target.parent.getWorldQuaternion(parentQ).invert();
    binding.target.quaternion.copy(parentQ.multiply(targetQ));
    binding.target.updateWorldMatrix(false,true);
  }
  if(uniform.cap&&uniform.headBone){
    const cap=uniform.cap,head=uniform.headBone,space=rig.visual;
    space.updateWorldMatrix(true,true);
    // Cap pivot is the wearer's forehead band, ~0.27m above Mixamo Head joint.
    cap.position.copy(space.worldToLocal(head.getWorldPosition(new THREE.Vector3())));
    cap.position.y+=.155;
    // The donor Head joint is behind the modelled brow; fit the whole cap
    // forward and slightly to the wearer's left rather than exposing scalp.
    cap.position.add(new THREE.Vector3(-.062,0,.068).applyQuaternion(cap.quaternion));
    const localQ=space.getWorldQuaternion(new THREE.Quaternion()).invert();
    cap.quaternion.copy(localQ.multiply(head.getWorldQuaternion(new THREE.Quaternion())));
  }
}


function loadNativeHeroM43Cap(rig){
  const u=rig.ww2Uniform;
  if(!u||!u.headBone)return;
  if(new URLSearchParams(location.search).get('headwear')==='none')return;
  const url=new URL('../assets/ww2-headwear/m43-field-cap.glb',location.href).href;
  new THREE.GLTFLoader().load(url,gltf=>{
    if(!rig.ww2Uniform||rig.ww2Uniform!==u)return;
    const cap=gltf.scene;
    cap.name='WW2_M43_Real_Geometry_MIT';
    // Metre-scale model; parent already inherits WW2 soldier scale.
    cap.scale.setScalar(1.30);
    cap.position.set(0,.205,0);
    cap.rotation.set(0,0,0);
    cap.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
    // Head bones in the donor GLB inherit a ~1/30 scale: do NOT parent the
    // full-size cap under the bone or it becomes invisible inside the skull.
    rig.visual.add(cap);
    u.cap=cap;
    u.headwear='M43 (MIT source)';
    cap.visible=u.side==='red';
    updateNativeHeroFieldUniform(rig);
  },undefined,error=>{
    console.warn('M43 headwear not loaded; using uncovered head:',error);
    u.headwearError=String(error&&error.message||error);
  });
}

function nativeHeroLoad(){
  const oldMode=new URLSearchParams(location.search).get('rig')==='original';
  if(oldMode){nativeHeroLabel('СТАРЫЙ СКЕЛЕТ: выбран для сравнения. Новая модель отключена.');return;}
  if(germanPreview.nativeHeroRequested)return;
  germanPreview.nativeHeroRequested=true;
  if(typeof THREE.GLTFLoader!=='function'){nativeHeroLabel('ОШИБКА: нет загрузчика GLTFLoader. Используется старая модель.');return;}
  nativeHeroLabel('СКЕЛЕТ v17: облегчённые GLB 1,5 МБ — начинаю загрузку.');
  // Try GitHub raw first, then a pinned jsDelivr mirror. Errors are
  // visible instead of silently falling back to the unchanged hero.
  const nativeHeroOrigins={};
  const loadFile=async(name)=>{
    let lastError=null;
    for(let i=0;i<NATIVE_HERO_ASSET_ROOTS.length;i++){
      const url=NATIVE_HERO_ASSET_ROOTS[i]+name;
      const loader=new THREE.GLTFLoader();
      let timer;
      try{
        const gltf=await Promise.race([
          new Promise((resolve,reject)=>loader.load(url,resolve,e=>{
            if(e&&e.total>0){
              const percent=Math.min(99,Math.round(e.loaded/e.total*100));
              nativeHeroLabel('СКЕЛЕТ v17: '+name+' '+percent+'% (источник '+(i+1)+'/3)');
            }
          },error=>reject(error||new Error('Ошибка GLB')))),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Превышено время загрузки: '+name)),18000);})
        ]);
        nativeHeroOrigins[name]=(i===0?'LOCAL':i===1?'GitHub Raw':'jsDelivr');
        return gltf;
      }catch(e){
        lastError=e;
        console.warn('Native GLB origin failed',url,e);
      }finally{clearTimeout(timer);}
    }
    throw new Error(name+': '+(lastError&&lastError.message||'оба источника недоступны'));
  };
  Promise.all([loadFile('night-striker-lite.glb'),loadFile('hero-three-clips-lite.glb')]).then(([character,library])=>{
    const unit=P,v=unit&&unit.germanPreview;
    if(!v||v.role!=='hero'||v.nativeRig)throw new Error('Нет подготовленного героя');
    const model=character.scene;
    const bones=new Set();
    let meshCount=0;
    model.traverse(n=>{if(n.isBone)bones.add(n.name);if(n.isSkinnedMesh)meshCount++;});
    const required=['pelvis','thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r'];
    if(meshCount===0||required.some(name=>!bones.has(name)))throw new Error('Не найден полный скелет Quaternius');
    const clips=new Map((library.animations||[]).map(a=>[a.name,a]));
    const selected={
      idle:clips.get('Idle_Loop'),
      jog:clips.get('Jog_Fwd_Loop'),
      sprint:clips.get('Sprint_Loop')
    };
    if(Object.values(selected).some(clip=>!clip||!clip.tracks.length||!Number.isFinite(clip.duration)||clip.duration<=0)){
      throw new Error('В библиотеке нет Idle / Jog / Sprint');
    }
    model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model);
    const height=box.max.y-box.min.y;
    if(!Number.isFinite(height)||height<.2||height>1000)throw new Error('Неверный размер исходной модели');
    const factor=2.55/height;
    // Bounds are applied at the SAME visual-anchor height as the old hero.
    // The original skeleton, its skin weights and relative bone transforms
    // stay together. Only the whole model gets a single uniform scale.
    const visual=new THREE.Group();visual.name='QuaterniusHeroRigDiagnostic';
    model.scale.multiplyScalar(factor);
    model.position.set(-(box.min.x+box.max.x)*.5*factor,-box.min.y*factor,-(box.min.z+box.max.z)*.5*factor);
    visual.add(model);
    // Native clips only: this avoids passing their joint transforms into
    // the unrelated Panzergrenadier (Mixamo) skeleton entirely.
    const mixer=new THREE.AnimationMixer(model);
    const actions={};
    for(const [key,clip] of Object.entries(selected)){
      // Game simulation owns locomotion position; a GLB must not drive a root
      // object across the map. Keep local hip motion for natural foot plants.
      const safe=clip.clone();
      safe.tracks=safe.tracks.filter(t=>!/\.scale$/.test(t.name)&&
        !/(?:^|[./])root(?:\]|\.|_)?(?:position)?\.position$/.test(t.name));
      if(safe.tracks.length<6)throw new Error('Недостаточно скелетных каналов: '+clip.name);
      actions[key]=mixer.clipAction(safe);
    }
    actions.idle.play();
    const oldFigureVisible=v.figure.visible;
    const oldIdentityVisible=v.identity.root.visible;
    const oldWeaponVisible=v.weapon.root.visible;
    try{
      v.anchor.add(visual);
      v.nativeRig={visual,model,mixer,actions,state:'idle',previous:{oldFigureVisible,oldIdentityVisible,oldWeaponVisible}};
      // Visual-only replacement; the old rig stays available as an instant
      // fallback. No army mesh/skeleton or gameplay unit is touched.
      v.figure.visible=false;
      v.identity.root.visible=false;
      v.weapon.root.visible=false;
      initNativeHeroWeapon(v,v.nativeRig);
      dressNativeHeroFieldUniform(v.nativeRig);
      // Green badge plus geometric marker: the native visual swap is
      // unambiguous, even when the costume looks similar from the RTS camera.
      const marker=new THREE.Mesh(
        new THREE.TorusGeometry(.32,.055,6,16),
        new THREE.MeshBasicMaterial({color:0x00ffbc,depthTest:false})
      );
      marker.name='NativeRigDiagnosticMarker';
      marker.rotation.x=Math.PI/2;
      marker.position.set(0,2.92,0);
      marker.renderOrder=120;
      if(new URLSearchParams(location.search).has('rigdebug'))visual.add(marker);
      nativeHeroLabel('НОВЫЙ СКЕЛЕТ v17: АКТИВЕН ✓ '+nativeHeroOrigins['night-striker-lite.glb']+' + '+nativeHeroOrigins['hero-three-clips-lite.glb']+'. Полевая форма.');
      console.info('Quaternius native hero rig ready',{
        skeletonBones:bones.size,skinnedMeshes:meshCount,clips:Object.keys(actions)
      });
    }catch(e){
      v.figure.visible=oldFigureVisible;v.identity.root.visible=oldIdentityVisible;
      v.weapon.root.visible=oldWeaponVisible;
      v.nativeRig=null;
      v.anchor.remove(visual);
      throw e;
    }
  }).catch(e=>{
    console.warn('Native hero rig fallback to original:',e);
    nativeHeroLabel('ОШИБКА СКЕЛЕТА v17: прежний герой. Причина: '+e.message);
  });
}
function animateNativeHeroRig(unit,v,dt){
  const r=v.nativeRig;
  if(!r)return false;
  const speed=Math.max(0,Number.isFinite(unit.sv)?unit.sv:0);
  const next=speed<.28?'idle':speed<4.2?'jog':'sprint';
  if(r.state!==next){
    const old=r.actions[r.state],action=r.actions[next];
    old.fadeOut(.16);
    action.reset().fadeIn(.16).play();
    r.state=next;
  }
  r.mixer.update(THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.08));
  updateNativeHeroWeapon(unit,v,r,dt);
  updateNativeHeroFieldUniform(r);
  unit.g.position.set(unit.x,0,unit.z);
  unit.g.rotation.x=0;unit.g.rotation.z=0;
  if(speed<.6&&unit.aim>0&&unit.aimT!=null){
    const yaw=Math.atan2(Math.sin(unit.aimT-unit.g.rotation.y),Math.cos(unit.aimT-unit.g.rotation.y));
    unit.g.rotation.y+=yaw*(1-Math.exp(-Math.max(0,dt)*7));
  }
  v.legacy.visible=false;v.anchor.visible=true;
  return true;
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
        const queue=[P,...U,...germanPreview.pending];germanPreview.pending.length=0;
        for(const u of queue)if(u.hp>0)attachGermanSoldier(u);
        nativeHeroLoad();
        refreshGermanPreviewLabel();
      }catch(e){console.error(e);germanPreviewLabel('Ошибка модели — исходные бойцы');}
    },e=>{console.error(e);germanPreviewLabel('Ошибка загрузки — исходные бойцы');});
  }catch(e){console.error(e);germanPreviewLabel('Ошибка модели — исходные бойцы');}
}
setTimeout(loadGermanSoldierPreview,200);
