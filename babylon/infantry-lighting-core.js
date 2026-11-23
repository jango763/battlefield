/* Battlefield: limited additional hemisphere illumination for imported soldiers.
 * No PBR/GLB mutation, no shared-world brightening, no extra draw geometry.
 * This is not an environment light. Registered animated meshes only.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldInfantryLighting=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const PROFILE=Object.freeze({name:'infantry-fill-light',intensity:1.08});
 function create({B,scene}={}){
  if(!B?.HemisphericLight||!B?.Color3||!B?.Vector3||!scene)
   throw Error('Infantry fill requires a Babylon scene');
  const light=new B.HemisphericLight(PROFILE.name,
   new B.Vector3(-.45,.72,.62),scene);
  light.intensity=PROFILE.intensity;
  light.diffuse=B.Color3.FromHexString('#f2e8d7');
  light.groundColor=B.Color3.FromHexString('#a0a18d');
  light.specular=B.Color3.FromHexString('#1e1b16');
  // A light with an empty includedOnlyMeshes array lights *everything*.
  // Keep disabled until at least one verified soldier mesh is registered.
  light.includedOnlyMeshes=[];
  light.setEnabled(false);
  const tracked=new Set();
  function track(meshes){
   if(!Array.isArray(meshes))throw Error('Soldier lighting expects mesh array');
   let added=0;
   for(const mesh of meshes){
    if(!mesh||typeof mesh.getTotalVertices!=='function'||
     mesh.getTotalVertices()<=0||tracked.has(mesh))continue;
    tracked.add(mesh);added++;
   }
   if(added){
    // Reassign the property, not in-place push: this invalidates Babylon
    // material/light inclusion caches for newly loaded reinforcements.
    light.includedOnlyMeshes=[...tracked];
    light.setEnabled(true);
   }
   return added;
  }
  function snapshot(){return {name:PROFILE.name,intensity:light.intensity,
   trackedMeshes:tracked.size,enabled:tracked.size>0,
   worldIllumination:false,modifiedImportedMaterials:0};}
  return Object.freeze({track,snapshot,light});
 }
 return Object.freeze({PROFILE,create});
});
