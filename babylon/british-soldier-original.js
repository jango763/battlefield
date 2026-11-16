/* Battlefield / original British 1944 soldier — procedural mesh v1.
 * This is NOT a recoloured German soldier: the donor GLB contributes ONLY
 * the validated 65-bone animation skeleton. Every visible face, body, limb,
 * Battledress garment, boot, and 1937-pattern webbing mesh is built here.
 * Babylon docs: linked glTF joints; rigid gear follows animated joints.
 * Body is articulated; a final deforming high-poly sculpt is a later stage.
 */
(function(root){
'use strict';
function create({B,scene,view}){
 if(!B||!scene||!view||view.faction!=='british')
  return {applied:false,reason:'British faction required'};
 const source=view.imported;
 if(!source?.skeletons?.length) return {applied:false,reason:'Missing 65-bone donor rig'};
 const skel=source.skeletons[0];
 if(skel.bones.length<65) return {applied:false,reason:'Original 65-bone rig required'};
 const canon=x=>String(x||'').replace(/^mixamorig[:_]?/i,'')
  .replace(/_\d+$/,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const joints=skel.bones.map(b=>b.getTransformNode?.()).filter(Boolean);
 const find=x=>joints.find(n=>canon(n.name)===canon(x));
 const j={
  hips:find('Hips'),spine:find('Spine'),chest:find('Spine2'),neck:find('Neck'),
  head:find('Head'),
  lArm:find('LeftArm'),lElbow:find('LeftForeArm'),lHand:find('LeftHand'),
  rArm:find('RightArm'),rElbow:find('RightForeArm'),rHand:find('RightHand'),
  lHip:find('LeftUpLeg'),lKnee:find('LeftLeg'),lFoot:find('LeftFoot'),
  rHip:find('RightUpLeg'),rKnee:find('RightLeg'),rFoot:find('RightFoot')
 };
 const required=['hips','chest','neck','lArm','lElbow','lHand',
  'rArm','rElbow','rHand','lHip','lKnee','lFoot','rHip','rKnee','rFoot'];
 if(required.some(k=>!j[k]))
  return {applied:false,reason:'Missing donor joints: '+required.filter(k=>!j[k]).join(',')};
 // All legacy German skins/gear are hidden. No second faces or four wrists.
 const germanMeshes=source.meshes.filter(m=>m.getTotalVertices?.()>0);
 for(const mesh of germanMeshes){mesh.isVisible=false;mesh.isPickable=false;}
 const container=new B.TransformNode('uk-original-infantry-'+view.index,scene);
 // In a 12v12 match the Babylon anchor controls visibility and world movement.
 // In close-up the preview has no anchor and meshes live in world coordinates.
 if(view.anchor)container.parent=view.anchor;
 const meshes=[],materials=[];
 const palette={
  cloth:'#61583e',trousers:'#554c38',collar:'#726746',
  web:'#b1a382',webDark:'#81775b',boot:'#252521',sole:'#161713',
  skin:'#c99b7b',skinShade:'#b6856a',hair:'#3e3428',
  cap:'#646047',capEdge:'#484838',metal:'#696d5d',button:'#958667',
  blue:'#406b90',iris:'#3b4b48',sclera:'#d7d6c4'
 };
 function material(name,hex){
  const m=new B.StandardMaterial('uk-'+name+'-'+view.index,scene);
  m.diffuseColor=B.Color3.FromHexString(hex);
  m.specularColor=new B.Color3(.035,.035,.028);
  materials.push(m);return m;
 }
 const mats=Object.fromEntries(Object.entries(palette).map(([k,v])=>[k,material(k,v)]));
 function make(mesh,parent,mat,name){
  mesh.name='british-'+name+'-'+view.index;
  mesh.parent=parent||container;mesh.material=mat;
  mesh.isPickable=true;
  mesh.metadata={...(mesh.metadata||{}),britishOriginal:true,squadSlot:view.index};
  meshes.push(mesh);return mesh;
 }
 function box(name,parent,size,at,mat,rotation){
  const m=make(B.MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},scene),parent,mat,name);
  m.position.set(...at);
  if(rotation)m.rotation.set(...rotation);
  return m;
 }
 function round(name,parent,radii,at,mat,segments=10){
  const m=make(B.MeshBuilder.CreateSphere(name,{diameter:1,segments},scene),parent,mat,name);
  m.scaling.set(radii[0]*2,radii[1]*2,radii[2]*2);
  m.position.set(...at);
  return m;
 }
 function tapered(name,parent,length,rt,rb,mat,segments=10){
  const m=make(B.MeshBuilder.CreateCylinder(name,{height:length,
   diameterTop:rt*2,diameterBottom:rb*2,tessellation:segments},scene),parent,mat,name);
  return m;
 }
 const P=(x,y,z)=>new B.Vector3(x,y,z);
 const qmat=B.Matrix.Identity();
 const anchor=view.anchor||null;
 function place(node,where,quat){
  if(anchor){
   anchor.computeWorldMatrix(true);
   const inverse=anchor.getWorldMatrix().clone().invert();
   node.position.copyFrom(B.Vector3.TransformCoordinates(where,inverse));
   const wq=B.Quaternion.Identity();
   anchor.getWorldMatrix().decompose(undefined,wq,undefined);
   node.rotationQuaternion=wq.conjugate().multiply(quat).normalize();
  }else{
   node.position.copyFrom(where);
   node.rotationQuaternion=quat.clone();
  }
 }
 function orient(x,y){
  const yy=y.clone().normalize();
  let xx=x.subtract(yy.scale(B.Vector3.Dot(x,yy)));
  if(xx.lengthSquared()<1e-8)xx=B.Vector3.Cross(yy,B.Axis.Z);
  xx.normalize();
  const zz=B.Vector3.Cross(xx,yy).normalize();
  xx=B.Vector3.Cross(yy,zz).normalize();
  B.Matrix.FromXYZAxesToRef(xx,yy,zz,qmat);
  return B.Quaternion.FromRotationMatrix(qmat).normalize();
 }
 const loc=node=>{node.computeWorldMatrix(true);return node.getAbsolutePosition()};
 const midpoint=(a,b)=>a.add(b).scale(.5);
 const upper=new B.TransformNode('uk-battledress-animated',scene);upper.parent=container;
 // Body shape is custom British blouse, NOT the German original skinned uniform.
 const jacket=tapered('waist-length-battledress-blouse',upper,.56,.225,.195,mats.cloth,12);
 jacket.position.y=-.005;
 round('shoulder-line',upper,[.227,.092,.132],[0,.224,0],mats.cloth,12);
 box('buttoned-waistband',upper,[.40,.076,.30],[0,-.265,0],mats.cloth);
 box('fly-front',upper,[.035,.38,.015],[0,.005,.137],mats.collar);
 box('left-chest-pocket',upper,[.126,.135,.040],[-.115,.084,.154],mats.cloth);
 box('right-chest-pocket',upper,[.126,.135,.040],[.115,.084,.154],mats.cloth);
 for(const side of [-1,1]){
  box('box-pleat-'+side,upper,[.013,.10,.015],[side*.115,.084,.178],mats.collar);
  box('pocket-flap-'+side,upper,[.138,.037,.050],[side*.115,.15,.177],mats.collar);
  box('collar-'+side,upper,[.142,.065,.06],[side*.091,.257,.083],mats.collar,[.18,0,side*.26]);
  box('epaulette-'+side,upper,[.107,.026,.20],[side*.205,.214,.012],mats.collar);
  box('P37-vertical-brace-'+side,upper,[.047,.48,.036],[side*.177,.02,.152],mats.web,[0,0,side*.10]);
  box('P37-basic-pouch-'+side,upper,[.16,.18,.112],[side*.154,-.232,.202],mats.web);
  box('pouch-top-'+side,upper,[.17,.035,.122],[side*.154,-.155,.211],mats.webDark);
  box('pouch-buckle-'+side,upper,[.035,.021,.010],[side*.154,-.163,.277],mats.metal);
  box('blue-side-patch-'+side,upper,[.055,.036,.018],[side*.246,.18,0],mats.blue);
 }
 for(let i=0;i<4;i++)round('jacket-button-'+i,upper,[.009,.009,.007],[0,.17-i*.105,.152],mats.button,6);
 box('P37-waist-webbing',upper,[.434,.063,.316],[0,-.248,0],mats.web);
 box('P37-belt-buckle',upper,[.072,.048,.015],[0,-.249,.164],mats.metal);
 box('small-pack-on-back',upper,[.345,.37,.153],[0,-.04,-.204],mats.web);
 box('small-pack-flap',upper,[.35,.075,.17],[0,.116,-.203],mats.webDark);
 for(const x of [-.103,.103]){
  box('small-pack-strap',upper,[.026,.29,.020],[x,-.015,-.292],mats.webDark);
 }
 const head=new B.TransformNode('uk-head-animated',scene);head.parent=container;
 // New face and new British side cap: the original German head is invisible.
 round('new-british-face',head,[.106,.13,.095],[0,.086,0],mats.skin,16);
 round('jaw',head,[.087,.065,.075],[0,.016,.022],mats.skinShade,10);
 round('nose',head,[.025,.043,.036],[0,.077,.096],mats.skinShade,10);
 for(const side of [-1,1]){
  round('ear-'+side,head,[.020,.031,.016],[side*.104,.069,0],mats.skin,8);
  round('eye-white-'+side,head,[.020,.009,.007],[side*.039,.112,.087],mats.sclera,8);
  round('eye-pupil-'+side,head,[.006,.008,.007],[side*.039,.111,.095],mats.iris,6);
  box('eyebrow-'+side,head,[.045,.008,.011],[side*.040,.139,.088],mats.hair);
 }
 box('hair-front',head,[.195,.035,.11],[0,.192,.012],mats.hair);
 // Narrow folded Field Service Cap (not a German cap, not a beret).
 const crown=tapered('british-side-cap-body',head,.102,.111,.113,mats.cap,12);
 crown.position.set(0,.209,-.012);crown.scaling.z=.95;
 box('cap-fold-left',head,[.030,.075,.188],[-.095,.222,-.014],mats.capEdge,[0,0,-.25]);
 box('cap-fold-right',head,[.030,.075,.188],[.095,.222,-.014],mats.capEdge,[0,0,.25]);
 box('cap-front-ridge',head,[.18,.026,.045],[0,.205,.098],mats.capEdge,[.18,0,0]);
 for(let i=0;i<2;i++)round('cap-button-'+i,head,[.009,.009,.008],[-.035+i*.07,.195,.120],mats.button,6);
 // Separately articulated British arms and legs. Their transform comes from
 // the real Mixamo bone endpoints, so Run/Aim/Fire use exactly the same clips.
 function segment(name,rt,rb,mat){
  const pivot=new B.TransformNode('uk-'+name+'-animated',scene);
  pivot.parent=container;
  const shell=tapered(name,pivot,1,rt,rb,mat,10);
  const decoration=[];
  return {name,pivot,shell,decoration,rt,rb};
 }
 const limbs={
  lUpper:segment('left-battledress-upper-sleeve',.110,.091,mats.cloth),
  lFore:segment('left-battledress-fore-sleeve',.087,.067,mats.cloth),
  rUpper:segment('right-battledress-upper-sleeve',.110,.091,mats.cloth),
  rFore:segment('right-battledress-fore-sleeve',.087,.067,mats.cloth),
  lThigh:segment('left-trouser-leg-upper',.124,.110,mats.trousers),
  lShin:segment('left-trouser-leg-lower',.111,.085,mats.trousers),
  rThigh:segment('right-trouser-leg-upper',.124,.110,mats.trousers),
  rShin:segment('right-trouser-leg-lower',.111,.085,mats.trousers)
 };
 function segmentedTrim(name,which,diameter,mat){
  const m=tapered(name,which.pivot,.075,diameter,diameter,mat,10);
  which.decoration.push(m);return m;
 }
 const sleeveTrimL=segmentedTrim('uk-left-cuff',limbs.lFore,.083,mats.collar);
 const sleeveTrimR=segmentedTrim('uk-right-cuff',limbs.rFore,.083,mats.collar);
 const gaiterL=segmentedTrim('uk-left-web-anklet',limbs.lShin,.102,mats.web);
 const gaiterR=segmentedTrim('uk-right-web-anklet',limbs.rShin,.102,mats.web);
 const mapPocket=box('large-left-thigh-map-pocket',limbs.lThigh.pivot,
  [.128,.177,.042],[-.033,0,.115],mats.trousers);
 const mapFlap=box('left-thigh-map-flap',limbs.lThigh.pivot,
  [.14,.038,.048],[-.033,.093,.12],mats.collar);
 box('first-field-dressing-pocket',limbs.rThigh.pivot,[.11,.125,.037],
  [.053,.125,.10],mats.trousers);
 function palm(side){
  const p=new B.TransformNode('uk-'+side+'-hand-animated',scene);p.parent=container;
  round(side+'-new-human-palm',p,[.043,.066,.019],[0,-.011,.002],mats.skin,12);
  round(side+'-new-thumb',p,[.018,.044,.016],[side==='left'?.045:-.045,-.018,.022],mats.skin,8);
  for(let i=0;i<4;i++)
   round(side+'-finger-'+i,p,[.010,.037-i*.003,.010],
    [(-.028+i*.019),-.078+i*.006,.009],mats.skin,8);
  return p;
 }
 const hands={left:palm('left'),right:palm('right')};
 function boot(side){
  const p=new B.TransformNode('uk-'+side+'-foot-animated',scene);p.parent=container;
  round(side+'-boot-leather',p,[.075,.070,.145],[0,-.023,.058],mats.boot,12);
  box(side+'-boot-sole',p,[.156,.021,.306],[0,-.088,.068],mats.sole);
  round(side+'-toe-cap',p,[.071,.034,.073],[0,-.061,.17],mats.boot,10);
  for(let i=0;i<3;i++)box(side+'-boot-lace-'+i,p,[.068,.006,.009],
   [0,.01-i*.023,.093],mats.webDark);
  return p;
 }
 const feet={left:boot('left'),right:boot('right')};
 const workSide=B.Vector3.Zero();
 function update(){
  const pos=Object.fromEntries(Object.entries(j).filter(([,n])=>n)
   .map(([k,n])=>[k,loc(n)]));
  const axisX=pos.lArm.subtract(pos.rArm).normalize();
  const upright=pos.neck.subtract(pos.hips).normalize();
  const bodyQ=orient(axisX,upright);
  const w=Math.max(.72,Math.min(1.3,B.Vector3.Distance(pos.lArm,pos.rArm)/.43));
  const center=midpoint(pos.hips,pos.neck);
  place(upper,center,bodyQ);
  upper.scaling.set(w,Math.max(.77,Math.min(1.4,B.Vector3.Distance(pos.hips,pos.neck)/.53)),w);
  const skull=pos.head||pos.neck.add(upright.scale(.075));
  const headQ=orient(axisX,skull.subtract(pos.neck));
  place(head,skull,headQ);
  head.scaling.setAll(w);
  // MeshBuilder cylinder model axis is +Y. Tip radius is larger near shoulder.
  function poseSegment(part,a,b,axis){
   const vector=b.subtract(a);
   const len=vector.length();
   if(!(len>.015))return;
   const q=orient(axis||axisX,vector);
   place(part.pivot,midpoint(a,b),q);
   part.shell.scaling.y=len;
   return len;
  }
  const lArmLen=poseSegment(limbs.lUpper,pos.lArm,pos.lElbow,axisX);
  const rArmLen=poseSegment(limbs.rUpper,pos.rArm,pos.rElbow,axisX);
  const lForeLen=poseSegment(limbs.lFore,pos.lElbow,pos.lHand,axisX);
  const rForeLen=poseSegment(limbs.rFore,pos.rElbow,pos.rHand,axisX);
  poseSegment(limbs.lThigh,pos.lHip,pos.lKnee,axisX);
  poseSegment(limbs.rThigh,pos.rHip,pos.rKnee,axisX);
  const lShinLen=poseSegment(limbs.lShin,pos.lKnee,pos.lFoot,axisX);
  const rShinLen=poseSegment(limbs.rShin,pos.rKnee,pos.rFoot,axisX);
  if(lForeLen)sleeveTrimL.position.y=-lForeLen*.47;
  if(rForeLen)sleeveTrimR.position.y=-rForeLen*.47;
  if(lShinLen)gaiterL.position.y=-lShinLen*.40;
  if(rShinLen)gaiterR.position.y=-rShinLen*.40;
  const qhandLeft=j.lHand.rotationQuaternion?worldRotation(j.lHand):bodyQ;
  const qhandRight=j.rHand.rotationQuaternion?worldRotation(j.rHand):bodyQ;
  place(hands.left,pos.lHand,qhandLeft);
  place(hands.right,pos.rHand,qhandRight);
  // Shoes have independently tracked ankles, with toe direction fixed to torso.
  place(feet.left,pos.lFoot,bodyQ);
  place(feet.right,pos.rFoot,bodyQ);
  // Keeps 24 soldier copies visually distinct from donor while preserving joint animation.
  void mapPocket;void mapFlap;void workSide;void lArmLen;void rArmLen;
 }
 function worldRotation(node){
  node.computeWorldMatrix(true);
  const q=B.Quaternion.Identity();node.getWorldMatrix().decompose(undefined,q,undefined);
  return q.normalize();
 }
 const originalVisible=germanMeshes.map(m=>m.isVisible);
 // Capture BEFORE hiding for disposal-safe restore. Old meshes stay hidden.
 const result={
  applied:true,originalGeometry:true,sourceRigBones:skel.bones.length,
  meshCount:meshes.length,sourceMeshesHidden:germanMeshes.length,
  status:'original procedurally built British body; prototype pending visual approval',
  update,
  start(){
   if(this.observer)return;
   this.observer=scene.onBeforeRenderObservable.add(update);
   update();
  },
  dispose(){
   if(this.observer)scene.onBeforeRenderObservable.remove(this.observer);
   container.dispose(false,false);
   for(const mesh of meshes)if(!mesh.isDisposed?.())mesh.dispose(false,false);
   for(const mat of materials)mat.dispose();
  }
 };
 // A genuine British body is visible only when animated donor joints update.
 // start() must be called after weapon IK is installed for correct hand position.
 update();
 view.britishSoldier=result;
 return result;
}
root.BattlefieldBritishSoldier=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);