/* Optional high-detail original CC0 European village GLB props.
 * Authoritative source manifests: art/models/SOURCE_LICENSES.json.
 * Never substitute character GLBs or alter tactical colliders.
 * Failure leaves the already-tested procedural village playable.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldModernVillageModels=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const PLACES=Object.freeze([
 {asset:'normandy-timber-house',name:'normandy-country-house',x:166,z:64,size:9,rotate:.18},
 {asset:'normandy-hay-barn',name:'normandy-hay-store',x:130,z:50,size:10,rotate:-.12},
 {asset:'village-church',name:'stone-church-ruin-backdrop',x:217,z:222,size:11,rotate:Math.PI}
]);
/* Authored North African hamlet: no imported European church or hay barn.
 * Three original stucco buildings retain real navigation collisions at the
 * same approved scenery positions. No proprietary game art is required.
 */
function installNorthAfrica({scene,B,world}){
 const output={started:true,loaded:0,pending:0,finished:false,
  style:'libya-adobe-procedural',errors:[],assets:[],drawMeshes:0};
 const adobe=scene.getMaterialByName('hd2026-battered-plaster');
 const stone=scene.getMaterialByName('hd2026-pitted-stone');
 const brick=scene.getMaterialByName('hd2026-weathered-brick');
 if(!adobe||!stone||!brick)throw Error('Libya hamlet needs local scanned stucco and stone');
 // Imported PBR walls appeared almost black without an environment IBL.
 // Keep the licensed local stucco scan but render it with bounded, lit
 // StandardMaterial + subtle warm ambient so the facade stays readable.
 const sunStucco=new B.StandardMaterial('libya-sunlit-stucco',scene);
 sunStucco.diffuseTexture=adobe.albedoTexture;
 sunStucco.diffuseColor=B.Color3.FromHexString('#f2dbb5');
 sunStucco.ambientColor=B.Color3.FromHexString('#c5a17e');
 sunStucco.emissiveColor=B.Color3.FromHexString('#4e3f2c');
 sunStucco.specularColor=B.Color3.Black();
 const recessed=new B.StandardMaterial('libya-arched-recess-shadow',scene);
 recessed.diffuseColor=B.Color3.FromHexString('#493e31');
 recessed.specularColor=B.Color3.Black();
 const dust=new B.StandardMaterial('libya-weathered-ochre',scene);
 dust.diffuseColor=B.Color3.FromHexString('#c5a47a');
 dust.specularColor=B.Color3.Black();
 function cuboid(id,x,y,z,w,h,d,mat,rot=0){
  const m=B.MeshBuilder.CreateBox('libya-'+id,
   {width:w,height:h,depth:d},scene);
  m.position.set(x-150,y,z-150);m.rotation.y=rot;
  m.material=mat;m.isPickable=false;m.receiveShadows=true;
  output.drawMeshes++;return m;
 }
 for(let i=0;i<PLACES.length;i++){
  const p=PLACES[i],width=p.size*(i===2?.76:.85);
  const depth=p.size*(i===1?.68:.72),height=i===2?5.2:i===1?3.5:4.1;
  // Broad rendered volumes and matching pathfinding obstacle: no walking
  // through walls, unlike purely decorative no-collision buildings.
  world?.addObstacle?.({x:p.x,z:p.z,hw:width/2+.45,
   hd:depth/2+.45,type:'libya-village-wall',blocksSight:true});
  cuboid('adobe-body-'+i,p.x,height/2,p.z,width,height,depth,sunStucco);
  cuboid('stone-footing-'+i,p.x,.18,p.z,width+.45,.36,depth+.5,stone);
  cuboid('flat-roof-'+i,p.x,height+.18,p.z,width+.55,.36,depth+.55,stone);
  const wall=.28,rise=.76;
  for(const sx of [-1,1])cuboid('roof-rail-x-'+i+'-'+sx,
   p.x+sx*(width/2),height+.57,p.z,wall,rise,depth+.66,sunStucco);
  for(const sz of [-1,1])cuboid('roof-rail-z-'+i+'-'+sz,
   p.x,height+.57,p.z+sz*depth/2,width+.66,rise,wall,sunStucco);
  // Recessed door + sandstone lintel and two narrow shielded windows.
  cuboid('deep-door-'+i,p.x,1.27,p.z+depth/2+.035,1.45,2.5,.10,recessed);
  cuboid('door-lintel-'+i,p.x,2.55,p.z+depth/2+.14,1.9,.30,.40,stone);
  for(const side of [-1,1]){
   cuboid('window-'+i+'-'+side,p.x+side*width*.28,2.48,
    p.z+depth/2+.045,.67,.89,.10,recessed);
   cuboid('window-sill-'+i+'-'+side,p.x+side*width*.28,1.96,
    p.z+depth/2+.16,.92,.18,.35,stone);
  }
  // Patchy lower stucco and corner buttresses break the toy-box silhouette.
  for(const side of [-1,1]){
   cuboid('buttress-'+i+'-'+side,p.x+side*(width/2-.25),
    1.05,p.z+depth/2-.10,.65,2.1,.66,dust);
  }
  if(i===2){
   // Partially collapsed merchant tower with an asymmetric roofline.
   cuboid('broken-crest-'+i,p.x-width*.23,height+1.15,
    p.z-depth*.30,width*.20,1.3,depth*.25,brick);
   cuboid('broken-crest-small-'+i,p.x+width*.28,height+.94,
    p.z+depth*.26,width*.16,.9,depth*.25,stone);
  }else{
   cuboid('awning-'+i,p.x,height*.64,p.z+depth/2+1.0,
    width*.64,.16,2.0,brick);
   cuboid('awning-support-'+i,p.x-width*.23,height*.32,
    p.z+depth/2+1.85,.18,height*.63,.18,stone);
  }
  output.assets.push({asset:'authored-libya-adobe-'+i,
   targetMetres:p.size,triangles:output.drawMeshes*12});
  output.loaded++;
 }
 world?.navigation?.invalidate();
 output.finished=true;
 scene.metadata=scene.metadata||{};
 scene.metadata.battlefieldNorthAfricaVillage={style:output.style,
  buildings:output.loaded,collision:true};
 if(typeof window!=='undefined')window.__BF_CC0_VILLAGE__=output;
 return output;
}
async function install({scene,B,art,world}){
 if(art?.theatre==='north-africa-libya-sunlit-v1')
  return installNorthAfrica({scene,B,world});
 if(!scene||!B||!art)throw Error('Missing historical village scene');
 const output={started:true,loaded:0,pending:PLACES.length,errors:[],assets:[]};
 window.__BF_CC0_VILLAGE__=output;
 for(const place of PLACES){
  let container=null;
  const blocker=world?.addObstacle?.({x:place.x,z:place.z,hw:place.size*.55,hd:place.size*.55,type:'village-building'});
  try{
   container=await B.SceneLoader.LoadAssetContainerAsync(
    './art/models/',place.asset+'.glb',scene);
   const nodes=container.meshes||[];
   const real=nodes.filter(m=>m.getTotalVertices?.()>0);
   if(!real.length)throw Error('GLB has no triangles');
   container.addAllToScene();
   const outer=new B.TransformNode('cc0-'+place.name,scene);
   const centered=new B.TransformNode('cc0-'+place.name+'-center',scene);
   centered.parent=outer;
   const assetNodes=new Set([...container.meshes,...container.transformNodes]);
   // Preserve intra-asset hierarchy while attaching its top-level roots.
   for(const top of assetNodes){
    if(!top.parent||!assetNodes.has(top.parent))top.parent=centered;
   }
   let min=new B.Vector3(Infinity,Infinity,Infinity);
   let max=new B.Vector3(-Infinity,-Infinity,-Infinity);
   for(const m of real){
    m.computeWorldMatrix(true);
    const bounds=m.getBoundingInfo()?.boundingBox;
    if(!bounds)continue;
    min=B.Vector3.Minimize(min,bounds.minimumWorld);
    max=B.Vector3.Maximize(max,bounds.maximumWorld);
    m.isPickable=false;
    m.receiveShadows=true;
   }
   if(!Number.isFinite(min.x)||!Number.isFinite(max.x))
    throw Error('Invalid model bounds');
   const width=Math.max(.001,max.x-min.x,max.z-min.z);
   const size=place.size/width;
   centered.position.set(-(min.x+max.x)/2,-min.y,-(min.z+max.z)/2);
   outer.scaling.setAll(size);
   outer.position.set(place.x-150,0,place.z-150);
   outer.rotation.y=place.rotate;
   if(blocker){
    outer.computeWorldMatrix(true);let lo=new B.Vector3(Infinity,Infinity,Infinity),hi=new B.Vector3(-Infinity,-Infinity,-Infinity);
    for(const m of real){m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;lo=B.Vector3.Minimize(lo,b.minimumWorld);hi=B.Vector3.Maximize(hi,b.maximumWorld);}
    blocker.x=(lo.x+hi.x)/2+150;blocker.z=(lo.z+hi.z)/2+150;blocker.hw=(hi.x-lo.x)/2;blocker.hd=(hi.z-lo.z)/2;world.navigation?.invalidate();
   }
   output.loaded++;
   output.assets.push({asset:place.asset,triangles:real.reduce((sum,m)=>sum+
      (m.getTotalIndices?.()||0)/3,0),targetMetres:place.size});
  }catch(error){
   const message=String(error?.message||error);
   output.errors.push({asset:place.asset,message});
   console.warn('Optional CC0 historical GLB fallback:',place.asset,error);
   try{container?.dispose();}catch(_){}
   if(blocker){blocker.solid=false;world.navigation?.invalidate();}
  }finally{
   output.pending--;
  }
 }
 output.finished=true;
 return output;
}
return Object.freeze({install,PLACES});
});