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
  trigger.position.set(0,-.105,-.12);root.add(trigger);
  const support=new THREE.Object3D();
  support.position.set(0,-.112,.31);root.add(support);
  const muzzleFlash=new THREE.Mesh(new THREE.SphereGeometry(.072,7,5),flashMat);
  muzzleFlash.position.set(0,.022,.89);muzzleFlash.scale.set(.7,.7,1.8);
  muzzleFlash.visible=false;root.add(muzzleFlash);
  return{root,trigger,support,muzzleFlash};
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
}
function updateNativeHeroWeapon(unit,v,rig,dt){
  if(!rig.weapon||!rig.hands)return;
  const vis=rig.visual,w=rig.weapon;
  vis.updateWorldMatrix(true,true);
  const getLocal=b=>vis.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
  const sr=getLocal(rig.hands.right.upper),sl=getLocal(rig.hands.left.upper);
  const rightSign=Math.sign(sr.x-sl.x)||-1;
  const aimed=unit.aim>0;
  const heading=unit.aimT==null?0:
    Math.atan2(Math.sin(unit.aimT-unit.g.rotation.y),Math.cos(unit.aimT-unit.g.rotation.y));
  // Stable high-ready posture while moving; raised to a proper shoulder line
  // for aiming. The body and the legs still use the original animation.
  w.root.position.set((sr.x+sl.x)*.5+rightSign*.055,
    (sr.y+sl.y)*.5-(aimed?.10:.21),
    (sr.z+sl.z)*.5+.27);
  w.root.rotation.set(aimed?.035:.115,
    THREE.MathUtils.clamp(heading,-.55,.55)*(aimed?.4:0)+rightSign*.09,
    rightSign*.032,'YXZ');
  w.muzzleFlash.visible=unit.kick>0;
  // First set the weapon placement, then solve both independent arm chains
  // to its physical grip anchors using the Quaternius shoulder and elbow.
  vis.updateWorldMatrix(true,true);
  const targets={
    right:getLocal(w.trigger),
    left:getLocal(w.support)
  };
  const poles={
    right:sr.clone().add(new THREE.Vector3(rightSign*.63,-.30,-.16)),
    left:sl.clone().add(new THREE.Vector3(-rightSign*.63,-.28,-.12))
  };
  for(const side of ['right','left']){
    const a=rig.hands[side];
    GermanRig.solve(vis,a.upper,a.elbow,a.hand,targets[side],poles[side]);
    GermanRig.orient(vis,a.hand,rig.weaponHandQ[side]);
  }
  vis.updateWorldMatrix(true,true);
  const rightError=rig.hands.right.hand.getWorldPosition(new THREE.Vector3())
    .distanceTo(w.trigger.getWorldPosition(new THREE.Vector3()));
  const leftError=rig.hands.left.hand.getWorldPosition(new THREE.Vector3())
    .distanceTo(w.support.getWorldPosition(new THREE.Vector3()));
  rig.weaponDiagnostics={
    ready:true,rightError,leftError,poseUpdates:(rig.weaponDiagnostics.poseUpdates||0)+1,
    gaitState:rig.state,aimed,visible:w.root.visible
  };
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
      visual.add(marker);
      nativeHeroLabel('НОВЫЙ СКЕЛЕТ v17: АКТИВЕН ✓ '+nativeHeroOrigins['night-striker-lite.glb']+' + '+nativeHeroOrigins['hero-three-clips-lite.glb']+'. Зелёное кольцо над героем.');
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
