/* Procedural earthworks. Original geometry; no downloaded or paid assets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldTacticalField=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
function install({B,scene,world,layout,design}){
 const meshes=[],materials=new Map(),batches=new Map();
 function mat(name,hex){if(materials.has(name))return materials.get(name);const m=new B.StandardMaterial('field-'+name,scene);m.diffuseColor=B.Color3.FromHexString(hex);m.specularColor=B.Color3.Black();materials.set(name,m);return m;}
 const earth=mat('earth','#69533f'),timber=mat('timber','#544936'),sand=mat('sand','#a39370');
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
 const concrete=mat('concrete','#74766b'),metal=mat('steel','#3f4640');
 for(const f of layout.fortifications){
  const {x,z,id}=f;
  if(f.type==='sandbags'){
   for(let layer=0;layer<2;layer++)for(let i=0;i<8;i++)
    box(id+'-'+layer+'-'+i,x-4.7+i*1.34+(layer?.2:0),.25+layer*.4,z,1.37,.43,.95,sand,Math.sin(i*8)*.04);
  }else if(f.type==='bunker'){
   for(const side of [-1,1]){
    box(id+'-side-'+side,x+side*3,1.35,z,.8,2.7,6,concrete);
    for(const end of [-1,1])box(id+'-front-'+side+'-'+end,x+side*2,1.35,z+end*2.7,2,2.7,.7,concrete);
   }
   // Real front aperture and rear entry; overhead lintel never blocks feet.
   box(id+'-slit-lintel',x,2.25,z+f.facing*2.7,2,1,.7,concrete);
   box(id+'-roof',x,2.95,z,7,.55,6.8,concrete);
   box(id+'-threshold',x,.08,z-f.facing*3,1.8,.16,1.5,concrete);
  }else if(f.type==='hedgehog'){
   for(const [i,angle] of [-.8,.8].entries()){const beam=box(id+'-'+i,x,1,z,.25,2.9,.28,metal);beam.rotation.z=angle;}
   const cross=box(id+'-cross',x,1,z,.25,2.9,.28,metal);cross.rotation.x=Math.PI/2;
  }else if(f.type==='wire'){
   for(let i=0;i<5;i++)box(id+'-post-'+i,x-6+i*3,.65,z,.16,1.3,.16,timber);
   for(const y of [.4,.85])box(id+'-wire-'+y,x,y,z,12,.075,.075,metal);
   for(let i=0;i<12;i++){const bar=box(id+'-barb-'+i,x-5.5+i,.85,z,.2,.15,.15,metal);bar.rotation.z=.7;}
  }
 }
 const mounts=new Map();
 for(const def of layout.emplacements){
  const {x,z,id}=def,pivot=new B.TransformNode(id+'-turret',scene);pivot.position.set(x-150,0,z-150);
  function part(label,dx,y,dz,w,h,d,m){const p=box(id+'-'+label,x+dx,y,z+dz,w,h,d,m);p.setParent(pivot);return p;}
  if(def.kind==='cannon'){
   part('breech',0,1.15,-.25,.55,.48,.9,metal);
   part('barrel',0,1.25,1.1,.19,.19,2.5,metal);
   part('muzzle',0,1.25,2.42,.26,.26,.24,metal);
   part('shield',0,1.15,.15,2.35,1.7,.15,metal);
   part('axle',0,.62,-.25,2.7,.17,.2,metal);
   for(const side of [-1,1]){
    const wheel=B.MeshBuilder.CreateTorus(id+'-wheel-'+side,{diameter:1.15,thickness:.2,tessellation:16},scene);
    wheel.position.set(x-150+side*1.2,.62,z-150-.25);wheel.rotation.z=Math.PI/2;wheel.material=metal;wheel.isPickable=false;wheel.setParent(pivot);
    const trail=part('trail-'+side,side*.55,.28,-1.3,.16,.23,2,metal);trail.rotation.y=side*.3;
   }
  }else{
   part('receiver',0,1.25,0,.23,.25,.75,metal);
   part('barrel',0,1.3,.95,.095,.095,1.35,metal);
   part('muzzle',0,1.3,1.65,.16,.16,.18,metal);
   part('stock',0,1.2,-.6,.18,.22,.5,timber);
   part('ammo-box',-.38,1.05,-.05,.38,.37,.45,metal);
   part('sight',0,1.47,.55,.08,.18,.07,metal);
   for(const side of [-1,1]){const leg=part('tripod-'+side,side*.4,.55,.22,.09,1.15,.09,metal);leg.rotation.z=side*.45;}
   const rear=part('rear-leg',0,.55,-.5,.09,1.15,.09,metal);rear.rotation.x=-.5;
  }
  pivot.rotation.y=def.heading;mounts.set(id,pivot);
  // Visible sector boundary, broad enough to remain stable in mobile view.
  const points=[new B.Vector3(x-150,.09,z-150)];
  for(let i=0;i<=20;i++){const arc=def.kind==='cannon'?Math.PI*2/9:Math.PI/3,a=def.heading-arc+i*arc/10;points.push(new B.Vector3(x-150+Math.sin(a)*8,.09,z-150+Math.cos(a)*8));}
  points.push(points[0]);const sector=B.MeshBuilder.CreateLines(id+'-sector',{points},scene);sector.color=B.Color3.FromHexString(def.team==='blue'?'#557f8b':'#9d6355');sector.isPickable=false;
 }
 const api={layout,meshes,materials,box,mat,earth,timber,sand,world,scene,B,mounts,
  update:support=>{for(const m of support.mounts){const p=mounts.get(m.id);if(p)p.rotation.y=m.yaw;}}};
 world.field=api;return api;
}
return {install};
});
