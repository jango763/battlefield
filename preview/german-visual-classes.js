// Wehrmacht visual identities: NO new rig, animation or gameplay rules.
// All accessories mount to the existing animated Mixamo WW2 uniform bones.
// Geometry and materials are shared between units for iPhone memory use.
function wehrmachtVisualClass(unit){
  if(!unit||unit.kind==='p')return 'hero';
  if(unit.cmd)return 'captain';
  if(unit.eng)return 'engineer';
  if(unit.type==='mg')return 'machinegunner';
  if(unit.type==='smg')return 'submachinegunner';
  return 'rifleman';
}
function wehrmachtVisualTint(role){
  // Distinct WW2 field-grey cloth shades, within the same muted game palette.
  const colors={
    hero:0x48534d,
    rifleman:0x68746a,
    submachinegunner:0x57685e,
    machinegunner:0x535e55,
    engineer:0x5d6357,
    captain:0x646e65
  };
  return colors[role]||colors.rifleman;
}
function wehrmachtVisualResources(){
  if(germanPreview.visualClassResources)return germanPreview.visualClassResources;
  const mat=(color,metalness=0)=>new THREE.MeshStandardMaterial({
    color,roughness:.96,metalness
  });
  return germanPreview.visualClassResources={
    box:new THREE.BoxGeometry(1,1,1),
    sphere:new THREE.SphereGeometry(1,10,7),
    cylinder:new THREE.CylinderGeometry(.5,.5,1,10),
    torus:new THREE.TorusGeometry(.5,.065,5,12),
    material:{
      webbing:mat(0x777660),olive:mat(0x565f50),
      linen:mat(0x8c876a),leather:mat(0x473a30),
      darkLeather:mat(0x332e29),metal:mat(0x515950,.12),
      brass:mat(0x9d9564,.16),canvas:mat(0x666851),
      black:mat(0x252a28),stitch:mat(0xaaa48a)
    }
  };
}
function installWehrmachtVisualIdentity(rig){
  const u=rig.ww2Uniform;
  if(!u||u.visualIdentityKit)return;
  const type=rig.armyUnit?wehrmachtVisualClass(rig.armyUnit):'hero';
  // Britain never receives German accessories, including the UK pilot.
  const kit={type,parts:[],meshNames:[],meshes:0,lowDetail:true};
  const donor=u.donor,visual=rig.visual;
  const boneMap=new Map();
  donor.traverse(n=>{if(n.isBone)boneMap.set(n.name.replace(/_\d+$/,'').replace(/^mixamorig[:_]?/i,''),n);});
  visual.updateWorldMatrix(true,true);
  const chest=boneMap.get('Spine2'),hip=boneMap.get('Hips');
  if(!chest||!hip)throw new Error('WW2 identity needs animated Spine2 and Hips bones');
  const cache=wehrmachtVisualResources();
  const base=cache.material;
  const mount=(bone,position,name)=>{
    const point=new THREE.Vector3(...position);
    const world=visual.localToWorld(point.clone());
    const group=new THREE.Group();
    group.name='GermanKit_'+type+'_'+name;
    group.position.copy(bone.worldToLocal(world));
    const vq=visual.getWorldQuaternion(new THREE.Quaternion());
    const bq=bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    group.quaternion.copy(bq.multiply(vq)).normalize();
    bone.add(group);kit.parts.push(group);
    return group;
  };
  const torso=mount(chest,[0,1.70,0],'chest');
  const waist=mount(hip,[0,1.14,0],'waist');
  function add(parent,name,shape,material,xyz,size,rot){
    const m=new THREE.Mesh(cache[shape],base[material]);
    m.name='GermanKit_'+type+'_'+name;
    m.position.set(...xyz);m.scale.set(...size);
    if(rot)m.rotation.set(...rot);
    m.castShadow=true;m.receiveShadow=true;
    parent.add(m);kit.meshes++;kit.meshNames.push(name);
    return m;
  }
  const box=(p,n,c,xyz,dim,rot)=>add(p,n,'box',c,xyz,dim,rot);
  const oval=(p,n,c,xyz,dim,rot)=>add(p,n,'sphere',c,xyz,dim,rot);
  const tube=(p,n,c,xyz,dim,rot)=>add(p,n,'cylinder',c,xyz,dim,rot);
  // Belt equipment is deliberately low profile: it must not clip the
  // animated two-hand weapon or obscure the accepted soldier's face.
  if(type==='hero'){
    box(torso,'officer-map-strap','darkLeather',[.10,-.06,.24],[.044,.48,.022],[0,0,-.40]);
    oval(waist,'unique-map-case','leather',[.30,-.07,.08],[.22,.23,.12]);
    box(waist,'map-case-flap','linen',[.30,.025,.145],[.21,.05,.028]);
    oval(torso,'field-collar','darkLeather',[0,.25,.04],[.30,.065,.15]);
    box(torso,'hero-rank-tab','brass',[-.22,.05,.20],[.085,.025,.03]);
  }else if(type==='rifleman'){
    for(const side of [-1,1]){
      for(let k=0;k<2;k++){
        const x=side*(.16+k*.086);
        oval(waist,'kar98k-cartridge-'+side+'-'+k,'leather',[x,.01,.24],[.097,.18,.09]);
        box(waist,'cartridge-flap-'+side+'-'+k,'webbing',[x,.075,.297],[.087,.025,.019]);
      }
    }
    tube(torso,'rolled-shelter-half','canvas',[0,-.04,-.29],[.53,.16,.16],[0,0,Math.PI/2]);
    box(torso,'shelter-roll-binding','webbing',[0,-.04,-.365],[.045,.19,.015]);
  }else if(type==='submachinegunner'){
    for(const side of [-1,1]){
      box(torso,'mp40-magazine-pouch-'+side,'linen',[side*.22,-.21,.25],[.125,.37,.09],[0,0,side*.10]);
      for(let k=0;k<3;k++)
        box(torso,'mp40-magazine-channel-'+side+'-'+k,'leather',
          [side*.22+(k-1)*.033,-.18,.303],[.023,.28,.015],[0,0,side*.10]);
      box(torso,'mp40-magazine-flap-'+side,'darkLeather',[side*.22,-.03,.31],[.119,.05,.024]);
    }
    box(waist,'smg-webbing-belt','webbing',[0,.13,.13],[.43,.055,.095]);
    oval(waist,'smg-side-pouch','leather',[-.28,-.09,-.05],[.20,.18,.12]);
  }else if(type==='machinegunner'){
    oval(torso,'mg42-spare-barrel-sleeve','canvas',[-.23,-.01,-.32],[.16,.65,.16],[0,0,-.23]);
    box(torso,'mg42-ammo-shoulder-strap','webbing',[.06,-.01,.205],[.065,.66,.035],[0,0,.34]);
    box(waist,'mg42-ammo-tin','metal',[.32,-.02,.075],[.29,.29,.145]);
    box(waist,'mg42-ammo-lid','darkLeather',[.32,.132,.075],[.31,.034,.162]);
    box(waist,'mg42-ammo-latch','brass',[.32,.015,.162],[.044,.095,.018]);
    oval(torso,'mg42-backpack','canvas',[.10,-.11,-.33],[.45,.46,.21]);
    box(torso,'mg42-pack-strap','leather',[.10,-.12,-.455],[.035,.49,.02]);
  }else if(type==='engineer'){
    oval(torso,'pioneer-backpack','canvas',[0,-.05,-.34],[.50,.50,.25]);
    box(torso,'pioneer-pack-fastener','leather',[0,-.06,-.47],[.04,.49,.025]);
    tube(torso,'pioneer-shovel-handle','leather',[.29,-.10,-.42],[.045,.72,.045],[0,0,-.22]);
    oval(torso,'pioneer-shovel-blade','metal',[.36,-.38,-.42],[.16,.24,.045],[0,0,-.22]);
    oval(waist,'pioneer-tool-roll','leather',[.30,-.03,.04],[.25,.23,.13]);
    box(waist,'pioneer-roll-strap','webbing',[.30,-.03,.12],[.035,.23,.015]);
  }else if(type==='captain'){
    // Binoculars and dispatch case give an officer a distinct silhouette
    // without the oversized geometric epaulettes of the old donor model.
    for(const side of [-1,1]){
      tube(torso,'officer-binocular-'+side,'black',[side*.06,-.14,.29],
        [.086,.22,.086],[Math.PI/2,0,0]);
      box(torso,'officer-collar-tab-'+side,'brass',[side*.15,.17,.21],[.09,.025,.025]);
    }
    box(torso,'binoculars-neckstrap','darkLeather',[0,.035,.23],[.03,.39,.016]);
    oval(waist,'officer-dispatch-case','leather',[.29,-.03,.04],[.29,.26,.12]);
    box(waist,'officer-dispatch-flap','linen',[.29,.074,.105],[.27,.036,.020]);
    oval(waist,'officer-holster','darkLeather',[-.27,-.09,.08],[.18,.24,.095]);
  }
  u.visualIdentityKit=kit;
  rig.ww2VisualClass=type;
  return kit;
}
function updateWehrmachtVisualIdentity(rig,side){
  const kit=rig.ww2Uniform?.visualIdentityKit;
  if(!kit)return;
  // Hide German-only webbing when player switches to the British faction.
  for(const g of kit.parts)g.visible=side==='red';
}
