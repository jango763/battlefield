/* Small terrain-conforming contact shadows, pooled into one draw mesh.
 * Original vertex-alpha geometry: no textures, shadow maps or extra lights.
 */
(function(root,factory){const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldInfantryContactShadows=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const CAPACITY=24,SEGMENTS=16,VERTICES=1+SEGMENTS*3,LIFT=.018;
 function geometry(){
  const offsets=[0,0],alphas=[.34],indices=[];
  for(const [radius,alpha] of [[.36,.24],[.7,.08],[1,0]])
   for(let j=0;j<SEGMENTS;j++){
    const a=j*Math.PI*2/SEGMENTS;
    offsets.push(Math.cos(a)*radius*.62,Math.sin(a)*radius*.44);
    alphas.push(alpha);
   }
  for(let j=0;j<SEGMENTS;j++){
   const next=(j+1)%SEGMENTS;
   indices.push(0,1+j,1+next);
   for(let ring=0;ring<2;ring++){
    const a=1+ring*SEGMENTS+j,b=1+ring*SEGMENTS+next;
    indices.push(a,a+SEGMENTS,b,b,a+SEGMENTS,b+SEGMENTS);
   }
  }
  return {offsets,alphas,indices};
 }
 function createPool({capacity=CAPACITY,heightAt=()=>0}={}){
  const shape=geometry(),positions=new Float32Array(capacity*VERTICES*3);
  const colors=new Float32Array(capacity*VERTICES*4),normals=[],indices=[];
  const previous=new Array(capacity).fill(null);
  for(let slot=0;slot<capacity;slot++){
   for(let v=0;v<VERTICES;v++){
    colors.set([1,1,1,shape.alphas[v]],(slot*VERTICES+v)*4);
    normals.push(0,1,0);
   }
   for(const i of shape.indices)indices.push(slot*VERTICES+i);
  }
  let active=0;
  function update(views){
   let changed=false;active=0;
   for(let slot=0;slot<capacity;slot++){
    const view=views[slot],p=view?.anchor?.position;
    const live=!!(view?.unit?.alive&&p&&view.anchor.isEnabled());
    if(live)active++;
    const old=previous[slot];
    if(!live&&!old)continue;
    if(live&&old&&old.x===p.x&&old.z===p.z)continue;
    changed=true;
    for(let v=0;v<VERTICES;v++){
     const i=(slot*VERTICES+v)*3;
     if(!live){positions[i]=positions[i+1]=positions[i+2]=0;continue;}
     const x=p.x+shape.offsets[v*2],z=p.z+shape.offsets[v*2+1];
     positions[i]=x;positions[i+1]=heightAt(x,z)+LIFT;positions[i+2]=z;
    }
    previous[slot]=live?{x:p.x,z:p.z}:null;
   }
   return changed;
  }
  return {positions,colors,normals,indices,update,get active(){return active;}};
 }
 function createSurfaceSampler({scene,world}){
  // Cache only shallow walkable map surfaces, after art has narrowed roads.
  // Querying their bounds once also covers base paving above the sand.
  const surfaces=scene.meshes.filter(m=>
   /^(north-south-road|west-east-road|lane-farm-|base-square-)/.test(m.name)
   &&m.isEnabled()&&m.isVisible).map(m=>{
    m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;
    return {minX:b.minimumWorld.x,maxX:b.maximumWorld.x,
     minZ:b.minimumWorld.z,maxZ:b.maximumWorld.z,y:b.maximumWorld.y};
   });
  for(const t of world.defenses?.trenches||[])surfaces.push({
   minX:t.a+3-150,maxX:t.b-3-150,minZ:t.z-.85-150,maxZ:t.z+.85-150,y:-.76});
  return (x,z)=>{
   let y=world.heightAt?.(x+150,z+150)||0;
   for(const s of surfaces)if(x>=s.minX&&x<=s.maxX&&z>=s.minZ&&z<=s.maxZ)
    y=Math.max(y,s.y);
   return y;
  };
 }
 function create({B,scene,world}){
  const pool=createPool({heightAt:createSurfaceSampler({scene,world})});
  const mesh=new B.Mesh('infantry-contact-shadows',scene),data=new B.VertexData();
  Object.assign(data,{positions:pool.positions,colors:pool.colors,
   normals:pool.normals,indices:pool.indices});data.applyToMesh(mesh,true);
  const material=new B.StandardMaterial('infantry-contact-shadow-mat',scene);
  material.disableLighting=true;material.emissiveColor=B.Color3.FromHexString('#352c22');
  material.diffuseColor=B.Color3.Black();material.specularColor=B.Color3.Black();
  material.transparencyMode=B.Material.MATERIAL_ALPHABLEND;
  material.disableDepthWrite=true;material.backFaceCulling=false;
  mesh.material=material;mesh.hasVertexAlpha=true;mesh.useVertexColors=true;
  mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
  mesh.alphaIndex=-10;mesh.alwaysSelectAsActiveMesh=true;mesh.setEnabled(false);
  const report={profile:'pooled-soft-contact-v1',capacity:CAPACITY,active:0,
   meshes:1,materials:1,textures:0,vertices:CAPACITY*VERTICES};
  function update(views){
   if(pool.update(views))mesh.updateVerticesData(B.VertexBuffer.PositionKind,pool.positions,false,false);
   report.active=pool.active;mesh.setEnabled(pool.active>0);
  }
  return {update,report,mesh};
 }
 return Object.freeze({CAPACITY,VERTICES,LIFT,createPool,createSurfaceSampler,create});
});
