/* Procedural earthworks. Original geometry; no downloaded or paid assets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldTacticalField=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
function install({B,scene,world,layout,design}){
 const meshes=[],materials=new Map(),batches=new Map();
 function mat(name,hex){if(materials.has(name))return materials.get(name);const m=new B.StandardMaterial('field-'+name,scene);m.diffuseColor=B.Color3.FromHexString(hex);m.specularColor=B.Color3.Black();materials.set(name,m);return m;}
 const earth=mat('earth','#76634b'),timber=mat('timber','#594c39'),sand=mat('sand','#9d9070');
 function box(name,x,y,z,w,h,d,m,rot=0){const o=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);o.position.set(x-150,y,z-150);o.rotation.y=rot;o.material=m;o.isPickable=false;o.receiveShadows=true;meshes.push(o);return o;}
 world.heightAt=(x,z)=>design.heightAt(layout,x,z);
 for(const o of layout.obstacles)world.addObstacle(o);
 // Nonuniform terrain grid resolves the actual trench depression and entrance
 // ramps while avoiding a uniform 90,000-vertex mobile ground mesh.
 const xs=new Set([0,300]),zs=new Set([0,300]);
 for(let v=0;v<=300;v+=10){xs.add(v);zs.add(v);}
 for(const t of layout.trenches){for(const x of [t.a,t.a+3,t.b-3,t.b])xs.add(x);for(const dz of [-2,-1.3,-1.15,0,1.15,1.3,2])zs.add(t.z+dz);}
 const X=[...xs].sort((a,b)=>a-b),Z=[...zs].sort((a,b)=>a-b),positions=[],uvs=[],indices=[],normals=[];
 for(const z of Z)for(const x of X){positions.push(x-150,world.heightAt(x,z),z-150);uvs.push(x/300,z/300);}
 for(let j=0;j<Z.length-1;j++)for(let i=0;i<X.length-1;i++){const a=j*X.length+i,b=a+1,c=a+X.length,d=c+1;indices.push(a,c,b,b,c,d);}
 const vd=new B.VertexData();B.VertexData.ComputeNormals(positions,indices,normals);Object.assign(vd,{positions,indices,normals,uvs});vd.applyToMesh(world.ground,true);
 for(const t of layout.trenches){
  for(const side of [-1,1]){
   box(t.id+'-earth-'+side,t.x,.38,t.z+side*1.75,t.b-t.a-6,.76,.9,earth);
   box(t.id+'-revett-'+side,t.x,-.3,t.z+side*1.19,t.b-t.a-6,1.1,.13,timber);
   for(let x=t.a+4;x<t.b-3;x+=3)box(t.id+'-post-'+side+'-'+x,x,-.1,t.z+side*1.1,.16,1.5,.18,timber);
  }
  // Broad duckboards are stable at RTS distance; no coplanar micro-lines.
  box(t.id+'-duckboard',t.x,-.80,t.z,t.b-t.a-6,.08,1.7,timber);
 }
 const api={layout,meshes,materials,box,mat,earth,timber,sand,world,scene,B};
 world.field=api;return api;
}
return {install};
});
