// Battlefield · Heer M40 visual-fit test on a verified 90-bone body.
// Source references: Kenton-GMI/muster-ww2 (MIT), see SOURCES.md.
// This is a rigid-accessory + skinned-body material prototype, NOT finished re-rigging.
const B=window.BABYLON;
const palette={tunic:'#41493e',trousers:'#444b40',leather:'#26221e',canvas:'#625f4f',metal:'#87877b',
  skin:'#c39279',hair:'#3b2c20',piping:'#c9c5b2',litzen:'#8e8f86'};
const asColor=s=>B.Color3.FromHexString(s);
function material(scene,name,color,roughness=.86,metallic=0){
 const m=new B.PBRMaterial('M40-'+name,scene);m.albedoColor=asColor(color);
 m.roughness=roughness;m.metallic=metallic;return m;
}
function createBox(scene,parent,name,dimensions,at,mat){
 const mesh=B.MeshBuilder.CreateBox(name,{width:dimensions[0],height:dimensions[1],depth:dimensions[2]},scene);
 mesh.parent=parent;mesh.position.set(...at);mesh.material=mat;mesh.isPickable=false;return mesh;
}
function strap(scene,parent,name,a,b,width,mat){
 const start=new B.Vector3(...a),end=new B.Vector3(...b);
 const dir=end.subtract(start);
 const m=B.MeshBuilder.CreateBox(name,{width,height:dir.length(),depth:.006},scene);
 m.parent=parent;m.position.copyFrom(start.add(end).scale(.5));
 const rotation=B.Quaternion.FromLookDirectionLH(dir.normalize(),B.Axis.Z);
 m.rotationQuaternion=rotation;m.material=mat;m.isPickable=false;return m;
}
function makeWool(scene,model){
 const body=model.meshes.filter(m=>m.getTotalVertices?.()>1000)[0];
 if(!body)throw Error('90-костная модель не содержит основного SkinnedMesh');
 const positions=body.getVerticesData(B.VertexBuffer.PositionKind);
 if(!positions)throw Error('Missing garment vertex positions');
 const colors=new Float32Array(positions.length/3*4);
 const shade=(hex,jitter)=>asColor(hex).scale(jitter);
 const clothNames=['tunic','trousers','skin','hair','leather'];
 const areas=Object.fromEntries(clothNames.map(x=>[x,0]));
 const choose=(x,y,z)=>{
  const a=Math.abs(x);
  if(y<.23)return 'leather';
  if(y>1.69)return 'hair';
  if(y>1.47)return 'skin';
  if(y>1.4&&a<.072)return 'skin';
  // The original body is in an I-bind pose: hands hang at the sides.
  if(y>.76&&y<1.03&&a>.175)return 'skin';
  if(y<.97&&a<.20)return 'trousers';
  return 'tunic';
 };
 for(let i=0;i<positions.length;i+=3){
  const [x,y,z]=[positions[i],positions[i+1],positions[i+2]];
  const type=choose(x,y,z);areas[type]++;
  const rough=Math.sin(x*487.2+y*791.4+z*361.3)*Math.sin(x*223+y*491);
  const p=shade(palette[type],(type==='tunic'||type==='trousers')?1+.07*rough:1+.02*rough);
  const j=i/3*4;colors[j]=p.r;colors[j+1]=p.g;colors[j+2]=p.b;colors[j+3]=1;
 }
 const original=body.material,clone=original.clone('M40-vertex-colored-body');
 clone.albedoColor=B.Color3.White();
 clone.albedoTexture=null;clone.metallic=0;clone.roughness=.89;
 body.material=clone;body.setVerticesData(B.VertexBuffer.ColorKind,colors,true,4);
 body.useVertexColors=true;body.hasVertexAlpha=false;
 return {body,areas,vertices:positions.length/3,sourceMaterial:original.name};
}
function getJoint(model,name){
 const key=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 return model.transformNodes.find(n=>key(n.name)===key(name));
}
function createTracker(scene,joint){
 if(!joint?.computeWorldMatrix||!joint?.getAbsolutePosition)throw Error('Missing native joint '+joint?.name);
 joint.computeWorldMatrix(true);
 const quat=new B.Quaternion();
 joint.getWorldMatrix().decompose(undefined,quat,undefined);
 const initial=quat.clone().normalize();
 const initialInv=initial.clone();initialInv.conjugateInPlace();
 const point=joint.getAbsolutePosition().clone();
 const node=new B.TransformNode('kit-tracker-'+joint.name,scene);
 node.rotationQuaternion=B.Quaternion.Identity();
 function update(){
  joint.computeWorldMatrix(true);
  const q=new B.Quaternion();joint.getWorldMatrix().decompose(undefined,q,undefined);
  node.rotationQuaternion=q.multiply(initialInv).normalize();
  node.position.copyFrom(joint.getAbsolutePosition());
 }
 update();
 return {node,point,update};
}
function decorateM40(scene,track){
 const chest=track.node;
 const m={
  tunic:material(scene,'pocket-wool',palette.tunic),
  trim:material(scene,'seam', '#42483c'),
  leather:material(scene,'leather',palette.leather,.9),
  canvas:material(scene,'canvas',palette.canvas),
  metal:material(scene,'buckle',palette.metal,.48,.35),
  piping:material(scene,'piping',palette.piping),
  litzen:material(scene,'litzen',palette.litzen)
 };
 // spine_05 is at y ~1.24 m; head is at 1.53m. Kit positions use chest-local offsets.
 const k=new B.TransformNode('M40-tunic-hardware',scene);k.parent=chest;
 // Buttons and centre tunic closure. Small pieces are deliberately rigid.
 for(let i=0;i<5;i++){
  const x=0,y=.095-i*.07,z=.157-(i*.002);
  createBox(scene,k,'M40-front-button-'+i,[.016,.018,.009],[x,y,z],m.metal);
 }
 for(const side of [-1,1]){
  const x=side*.12;
  // Four distinctive, visible M40 patch pockets with lapels.
  for(const level of [0,1]){
   const cy=level===0?.055:-.23, w=level===0?.11:.145, h=level===0?.12:.14;
   const pocket=createBox(scene,k,'M40-pocket-'+side+'-'+level,[w,h,.016],[x,cy,.156],m.tunic);
   const flap=createBox(scene,k,'M40-pocket-flap-'+side+'-'+level,[w+.006,.037,.023],[x,cy+h*.31,.168],m.trim);
   createBox(scene,k,'M40-pocket-button-'+side+'-'+level,[.011,.014,.009],[x,cy+h*.25,.183],m.metal);
   if(!pocket||!flap)throw Error('Pocket missing');
  }
  // Infantry shoulder boards and white piping.
  createBox(scene,k,'M40-shoulder-board-'+side,[.080,.024,.15],[side*.165,.155,.005],m.trim);
  createBox(scene,k,'M40-piping-'+side,[.004,.024,.15],[side*.207,.158,.006],m.piping);
  createBox(scene,k,'M40-collar-'+side,[.12,.095,.022],[side*.066,.16,.082],m.trim).rotation.z=side*.26;
  createBox(scene,k,'M40-litzen-'+side,[.067,.013,.024],[side*.074,.154,.098],m.litzen).rotation.z=side*.30;
  // Simple belt ammo pockets and front section of the Y-straps.
  createBox(scene,k,'Kar98k-ammo-pouch-'+side,[.11,.097,.068],[side*.155,-.285,.145],m.leather);
  createBox(scene,k,'ammo-pouch-flap-'+side,[.11,.027,.071],[side*.155,-.250,.15],m.canvas);
  strap(scene,k,'Y-strap-'+side,[side*.13,.145,.093],[side*.20,-.24,.165],.025,m.leather);
 }
 // Belt and buckle. Foreground metal keeps the uniform silhouette readable.
 createBox(scene,k,'M40-belt-front',[.37,.043,.055],[0,-.285,.125],m.leather);
 createBox(scene,k,'M40-belt-buckle',[.072,.050,.016],[0,-.285,.168],m.metal);
 createBox(scene,k,'M40-buckle-inlay',[.041,.032,.019],[0,-.285,.178],m.leather);
 return {pieces:scene.meshes.filter(m=>m.name.startsWith('M40-')||m.name.startsWith('Kar98k-')||m.name.startsWith('Y-')||m.name.startsWith('ammo-')).length};
}
async function loadCap(scene,name,tracker){
 const url=new URL('../../assets/ww2-headwear/'+name+'.glb',import.meta.url);
 const glb=await B.SceneLoader.ImportMeshAsync(null,'',url.href,scene);
 const pivot=new B.TransformNode('M40-'+name+'-pivot',scene);
 // The imported source was exported from the MIT-licensed geometry as GLB.
 for(const node of [...glb.meshes,...glb.transformNodes].filter(n=>!n.parent))node.parent=pivot;
 const mesh=glb.meshes.filter(m=>m.getTotalVertices?.()>0);
 if(!mesh.length)throw Error('Headwear GLB contains no triangles: '+name);
 let low=new B.Vector3(Infinity,Infinity,Infinity),hi=new B.Vector3(-Infinity,-Infinity,-Infinity);
 for(const m of mesh){
  m.computeWorldMatrix(true);
  const b=m.getBoundingInfo().boundingBox;
  low=B.Vector3.Minimize(low,b.minimumWorld);hi=B.Vector3.Maximize(hi,b.maximumWorld);
 }
 const extent=hi.subtract(low),center=low.add(hi).scale(.5);
 const capWidth=.184;
 const scalar=capWidth/extent.x;
 // Head pivot is at ~1.525m in the reference skeleton. The native cap
 // geometry has its own height; align its lowest point ~0.16m above head joint.
 pivot.scaling.setAll(scalar);
 pivot.position.set(-center.x*scalar,.150-low.y*scalar,-center.z*scalar);
 const group=new B.TransformNode('M40-'+name+'-track',scene);
 group.parent=tracker.node;
 pivot.parent=group;
 for(const m of mesh)m.isPickable=false;
 return {root:group,meshCount:mesh.length,size:extent.asArray(),scale:scalar};
}
// Smooth, tapered cloth sleeve segments follow the real 90-bone shoulder/elbow/wrist
// positions. They add no skin joints and never duplicate the hands.
function installSleeves(scene,model){
 const wool=material(scene,'sleeve-wool',palette.tunic,.94);
 const cuff=material(scene,'wrist-cuff','#323a31',.96);
 const specs=[];
 for(const side of ['l','r']){
  const arm=getJoint(model,'upperarm_'+side);
  const elbow=getJoint(model,'lowerarm_'+side);
  const wrist=getJoint(model,'hand_'+side);
  if(!arm||!elbow||!wrist)throw Error('Missing '+side+' arm bones for sleeves');
  const sections=[
   {from:arm,to:elbow,top:.180,bottom:.146,label:'upper',material:wool},
   {from:elbow,to:wrist,top:.150,bottom:.106,label:'lower',material:wool}
  ];
  for(const seg of sections){
   const mesh=B.MeshBuilder.CreateCylinder('M40-sleeve-'+side+'-'+seg.label,
    {height:1,diameterTop:seg.top,diameterBottom:seg.bottom,tessellation:14,subdivisions:5},scene);
   mesh.material=seg.material;
   mesh.rotationQuaternion=B.Quaternion.Identity();
   mesh.isPickable=false;
   specs.push({...seg,mesh});
  }
  const ring=B.MeshBuilder.CreateCylinder('M40-cuff-'+side,
   {height:1,diameterTop:.119,diameterBottom:.113,tessellation:14},scene);
  ring.material=cuff;ring.rotationQuaternion=B.Quaternion.Identity();ring.isPickable=false;
  specs.push({from:elbow,to:wrist,top:.119,bottom:.113,label:'cuff',mesh:ring,at:.93,length:.08});
 }
 function pose(seg){
  seg.from.computeWorldMatrix(true);seg.to.computeWorldMatrix(true);
  const first=seg.from.getAbsolutePosition(),last=seg.to.getAbsolutePosition();
  const difference=last.subtract(first),length=difference.length();
  if(length<1e-5){seg.mesh.setEnabled(false);return;}
  seg.mesh.setEnabled(true);
  const dir=difference.scale(1/length);
  const cross=B.Vector3.Cross(B.Axis.Y,dir),dot=B.Scalar.Clamp(B.Vector3.Dot(B.Axis.Y,dir),-1,1);
  let rotation;
  if(cross.lengthSquared()<1e-9)
   rotation=dot<0?B.Quaternion.RotationAxis(B.Axis.Z,Math.PI):B.Quaternion.Identity();
  else rotation=B.Quaternion.RotationAxis(cross.normalize(),Math.acos(dot));
  seg.mesh.rotationQuaternion=rotation;
  const along=seg.at??.5;
  seg.mesh.position.copyFrom(first.add(last.subtract(first).scale(along)));
  seg.mesh.scaling.y=seg.length??length*1.055;
 }
 const update=()=>specs.forEach(pose);
 update();
 return {update,parts:specs.length};
}
export async function installWehrmachtOutfit(scene,model,onUpdate){
 const wool=makeWool(scene,model);
 const chest=getJoint(model,'spine_05'),head=getJoint(model,'head');
 if(!chest||!head)throw Error('90-joint model does not expose chest/head transform nodes');
 const chestTracker=createTracker(scene,chest),headTracker=createTracker(scene,head);
 const kit=decorateM40(scene,chestTracker);
 const sleeves=installSleeves(scene,model);
 const caps={};
 const errors=[];
 for(const [id,file] of Object.entries({m43:'m43-field-cap',sidecap:'field-grey-sidecap'})){
  try{caps[id]=await loadCap(scene,file,headTracker);}catch(e){errors.push(id+': '+String(e));}
 }
 let selected='m43';
 const setHeadwear=id=>{
  if(!caps[id])throw Error('No imported '+id+' headwear');
  selected=id;
  for(const [key,value] of Object.entries(caps))value.root.setEnabled(key===selected);
  return selected;
 };
 if(caps.m43)setHeadwear('m43');
 else if(caps.sidecap)setHeadwear('sidecap');
 const update=()=>{chestTracker.update();headTracker.update();sleeves.update();onUpdate?.();};
 const subscription=scene.onBeforeRenderObservable.add(update);
 return {wool,kit,caps,errors,sleeves:sleeves.parts,get selected(){return selected},setHeadwear,update,
  release:()=>scene.onBeforeRenderObservable.remove(subscription)};
}
