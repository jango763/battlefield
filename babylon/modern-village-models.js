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
async function install({scene,B,art,world}){
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