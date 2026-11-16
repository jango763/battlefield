/* Experimental WWII British P37 visual skin for the approved 65-bone Panzergrenadier.
 * First-party geometry built on the existing animated rig; NOT a separately
 * authored/approved British humanoid GLB. No extra bones or second skin mesh.
 * Historical reference: British Battledress 1937 and Pattern 1937 web equipment.
 */
(function(root){
 'use strict';
 function apply({B,scene,view}){
  if(!B||!scene||!view||view.faction!=='british')return {applied:false};
  const linked=view.imported.skeletons.flatMap(s=>(s.bones||[])
    .map(b=>b.getTransformNode?.()).filter(Boolean));
  const canonical=name=>String(name||'').replace(/^mixamorig[:_]?/i,'')
    .replace(/_\d+$/,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const joint=name=>linked.find(n=>canonical(n.name)===canonical(name));
  const chest=joint('Spine2'),hips=joint('Hips'),neck=joint('Neck');
  const left=joint('LeftArm'),right=joint('RightArm');
  if(!chest||!hips||!neck||!left||!right)
   return {applied:false,reason:'British P37 requires the approved Mixamo spine/arms'};
  for(const n of [chest,hips,neck,left,right])n.computeWorldMatrix(true);
  const origin=chest.getAbsolutePosition();
  let x=left.getAbsolutePosition().subtract(right.getAbsolutePosition());
  let y=neck.getAbsolutePosition().subtract(hips.getAbsolutePosition());
  x.normalize();y.subtractInPlace(x.scale(B.Vector3.Dot(y,x))).normalize();
  const z=B.Vector3.Cross(x,y).normalize();
  y=B.Vector3.Cross(z,x).normalize();
  const frame=B.Matrix.Identity();
  B.Matrix.FromXYZAxesToRef(x,y,z,frame);
  const kit=new B.TransformNode('british-p37-kit-'+view.index,scene);
  kit.position.copyFrom(origin);
  kit.rotationQuaternion=B.Quaternion.FromRotationMatrix(frame);
  kit.setParent(chest); // preserve world transform, follow animated chest
  const canvas=new B.StandardMaterial('british-p37-web-'+view.index,scene);
  canvas.diffuseColor=B.Color3.FromHexString('#aa9d75');
  canvas.specularColor=B.Color3.Black();
  const tunic=new B.StandardMaterial('british-battledress-'+view.index,scene);
  tunic.diffuseColor=B.Color3.FromHexString('#796b4a');
  tunic.specularColor=B.Color3.Black();
  const strap=new B.StandardMaterial('british-p37-dark-'+view.index,scene);
  strap.diffuseColor=B.Color3.FromHexString('#887f59');
  strap.specularColor=B.Color3.Black();
  const insignia=new B.StandardMaterial('british-side-identifier-'+view.index,scene);
  insignia.diffuseColor=B.Color3.FromHexString('#567b9b');
  insignia.specularColor=B.Color3.Black();
  const geometry=[];
  function box(name,size,at,mat,angle=0){
   const mesh=B.MeshBuilder.CreateBox('uk-'+name+'-'+view.index,{
    width:size[0],height:size[1],depth:size[2]},scene);
   mesh.parent=kit;
   mesh.position.set(...at);mesh.rotation.z=angle;mesh.material=mat;
   mesh.metadata={squadSlot:view.index,britishKit:true};
   geometry.push(mesh);return mesh;
  }
  // Short Battledress blouse silhouette, paired box pockets and P37 webbing.
  // All kit parts are attached to ONE chest joint; no duplicate limbs/caps.
  box('blouse-front',[.39,.34,.065],[0,-.155,.065],tunic);
  box('left-breast-pocket',[.115,.105,.024],[-.115,-.082,.110],tunic);
  box('right-breast-pocket',[.115,.105,.024],[.115,-.082,.110],tunic);
  box('p37-waist-belt',[.43,.058,.078],[0,-.31,.098],canvas);
  box('p37-left-brace',[.060,.43,.040],[-.153,-.10,.118],canvas,-.16);
  box('p37-right-brace',[.060,.43,.040],[.153,-.10,.118],canvas,.16);
  box('p37-left-ammo',[.145,.165,.092],[-.158,-.236,.177],canvas);
  box('p37-right-ammo',[.145,.165,.092],[.158,-.236,.177],canvas);
  box('left-pouch-flap',[.145,.042,.103],[-.158,-.165,.177],strap);
  box('right-pouch-flap',[.145,.042,.103],[.158,-.165,.177],strap);
  box('p37-small-pack',[.33,.32,.16],[0,-.155,-.19],canvas);
  // Blue is a team identifier, not the colour of historic British battledress.
  box('small-blue-identification-patch',[.055,.035,.012],[.195,.03,.082],insignia);
  // Retexture only clearly-named textile materials. If the model has anonymous
  // PBR materials, leave them untouched rather than recolour the face/skin.
  const clones=new Map();
  let recoloured=0;
  for(const mesh of view.imported.meshes){
   if(!mesh.material||!mesh.getTotalVertices?.())continue;
   const id=(mesh.name+' '+mesh.material.name).toLowerCase();
   if(!/uniform|jacket|coat|trouser|cloth|tunic|shirt|fabric|pants/.test(id)||
      /skin|face|head|hand|eye|hair|boot|teeth/.test(id))continue;
   let material=clones.get(mesh.material);
   if(!material){
    material=mesh.material.clone('british-cloth-'+view.index+'-'+clones.size);
    if(material.albedoColor)material.albedoColor=B.Color3.FromHexString('#b7a17a');
    else if(material.diffuseColor)material.diffuseColor=B.Color3.FromHexString('#b7a17a');
    clones.set(mesh.material,material);
   }
   mesh.material=material;recoloured++;
  }
  const result={applied:true,kit,parts:geometry.length,
   recolouredMeshes:recoloured,source:'approved German 65-bone animation rig',
   status:'provisional British P37 kit; standalone British model pending'};
  view.britishSkin=result;
  return result;
 }
 root.BattlefieldBritishSkin=Object.freeze({apply});
})(typeof window!=='undefined'?window:globalThis);