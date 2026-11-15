/* Battlefield 300 x 300 playable map for Babylon.js.
   British south / Wehrmacht north; five farms, seven pillboxes and wreck positions.
   All coordinates are battlefield game coordinates 0..300; the 3D scene uses
   matching metres centered at (150,150). Approved infantry is loaded by game.js.
   This scene intentionally does not contain replacement humanoid models.
*/
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldWorld300=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const SIZE=300,ORIGIN=150;
function at(x,z,y=0,B){return new B.Vector3(x-ORIGIN,y,z-ORIGIN)}
function from(v){return {x:v.x+ORIGIN,z:v.z+ORIGIN}}
function create(scene,B,map){
 if(!scene||!B||map?.size!==SIZE)throw Error('World300 requires 300x300 map');
 const nodes=[],obstacles=[],rings=new Map(),farmMats=new Map();
 const wreckProxies=new Map();let originalWrecksLoaded=0;
 const mats={};
 function material(id,hex,emissive=null){
  if(mats[id])return mats[id];
  const m=new B.StandardMaterial('map-'+id,scene);
  m.diffuseColor=B.Color3.FromHexString(hex);
  m.specularColor=new B.Color3(.04,.04,.04);
  if(emissive)m.emissiveColor=B.Color3.FromHexString(emissive);
  return mats[id]=m;
 }
 const mat={
  earth:material('earth','#777957'),grass:material('grass','#555f43'),
  dirt:material('dirt','#6b5945'),road:material('road','#80705a'),
  track:material('track','#4c4237'),stone:material('stone','#777a76'),
  roof:material('roof','#4b463a'),wood:material('wood','#6b513a'),
  burnt:material('burnt','#242624'),rust:material('rust','#513c2d'),
  black:material('black','#161c19'),sand:material('sand','#96886a'),
  blue:material('blue','#517f99'),red:material('red','#9b5046'),
  gold:material('gold','#be9336','#493711'),
  corn:material('corn','#a3a079'),hedge:material('hedge','#465542'),
  trunk:material('trunk','#554b37'),stem:material('stem','#aaa080')
 };
 function box(id,w,h,d,x,y,z,m,rot=0,pickable=false){
  const o=B.MeshBuilder.CreateBox(id,{width:w,height:h,depth:d},scene);
  o.position.copyFrom(at(x,z,y,B));o.rotation.y=rot;o.material=m;
  o.isPickable=pickable;nodes.push(o);return o;
 }
 function cylinder(id,diameter,height,x,y,z,m,tessellation=8){
  const o=B.MeshBuilder.CreateCylinder(id,{diameter,height,tessellation},scene);
  o.position.copyFrom(at(x,z,y,B));o.material=m;o.isPickable=false;
  nodes.push(o);return o;
 }
 function obstacle(x,z,w,d,type){
  obstacles.push({x,z,hw:w/2,hd:d/2,type});
 }
 function ring(id,x,z,r,color){
  const mesh=B.MeshBuilder.CreateTorus('map-ring-'+id,{
   diameter:r*2,thickness:.24,tessellation:32},scene);
  mesh.position.copyFrom(at(x,z,.15,B));
  mesh.material=material('ring-'+id,color,color);
  mesh.isPickable=false;nodes.push(mesh);return mesh;
 }
 // Ground: procedural diffuse texture adds spatial detail without network assets.
 const ground=B.MeshBuilder.CreateGround('map-ground-300',{width:SIZE,height:SIZE,
  subdivisions:60},scene);
 const groundMaterial=new B.StandardMaterial('map-ground-material',scene);
 const canvas=(typeof document!=='undefined')?document.createElement('canvas'):null;
 if(canvas&&B.DynamicTexture){
  canvas.width=canvas.height=1024;
  const c=canvas.getContext('2d');
  if(c){
   c.fillStyle='#686b50';c.fillRect(0,0,1024,1024);
   let seed=721;const rnd=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
   for(let i=0;i<14500;i++){
    const x=rnd()*1024,z=rnd()*1024,r=1+rnd()*8;
    c.fillStyle=['#4f5d40','#857653','#91805a','#667148','#505742','#8b765a'][Math.floor(rnd()*6)];
    c.globalAlpha=.12+rnd()*.18;c.beginPath();c.ellipse(x,z,r*2,r,0,0,Math.PI*2);c.fill();
   }
   c.globalAlpha=1;
   const tx=new B.DynamicTexture('battlefield-earth',canvas,scene,false);
   tx.hasAlpha=false;groundMaterial.diffuseTexture=tx;
  }else groundMaterial.diffuseColor=mat.earth.diffuseColor;
 }else groundMaterial.diffuseColor=mat.earth.diffuseColor;
 groundMaterial.specularColor=new B.Color3(.04,.04,.04);
 ground.material=groundMaterial;ground.isPickable=true;
 // Main central supply road, two farm access branches and vehicle tracks.
 box('north-south-road',14,.04,265,150,.025,150,mat.road);
 box('west-east-road',246,.045,12,150,.028,150,mat.road);
 for(const side of [-1,1]){
  box('lane-farm-west-'+side,135,.05,4,81,.055,150+side*52,mat.dirt);
  box('lane-farm-east-'+side,135,.05,4,219,.055,150+side*52,mat.dirt);
 }
 for(let z=18;z<=282;z+=7)for(const x of [146,154])
  box('rut-'+x+'-'+z,.26,.04,3.6,x,.064,z,mat.track);
 // Both main bases face towards the center of the map.
 for(const base of map.bases){
  const m=base.team==='blue'?mat.blue:mat.red;
  const south=base.team==='blue';
  box('base-square-'+base.id,26,.14,19,base.x,.10,base.z,mat.stone);
  box('base-hq-'+base.id,13,5,9,base.x,2.7,base.z,m);
  box('base-hq-roof-'+base.id,15,1,11,base.x,5.65,base.z,mat.roof);
  box('base-door-'+base.id,2.5,3,.22,base.x,1.6,
    base.z+(south?4.61:-4.61),mat.wood);
  for(const side of [-1,1]){
   box('barrack-'+base.id+'-'+side,9,3.7,5.5,base.x+side*20,1.91,
    base.z+2,mat.sand);
   box('barrack-roof-'+base.id+'-'+side,9.8,.5,6.1,base.x+side*20,4.1,
    base.z+2,mat.roof);
  }
  obstacle(base.x,base.z,13,9,'base');
  ring(base.id,base.x,base.z,14,south?'#72b8e3':'#ed7a70');
 }
 // Five production farms — four normal and one central gold prize.
 for(const farm of map.farms){
  const mid=farm.id==='center';
  const m=material('farm-'+farm.id,mid?'#a48b53':'#90795a');
  box('farm-yard-'+farm.id,18,.1,17,farm.x,.08,farm.z,mat.dirt);
  box('farm-house-'+farm.id,9,4.8,7,farm.x-2,2.45,farm.z,m);
  const roof=box('farm-roof-'+farm.id,10.2,1.9,7.8,
    farm.x-2,5.75,farm.z,mat.roof);
  roof.rotation.z=.09;
  box('farm-barn-'+farm.id,5,3.8,7,farm.x+6,1.97,farm.z,mat.wood);
  box('farm-barn-roof-'+farm.id,5.7,.6,8,farm.x+6,4.2,farm.z,mat.roof);
  for(let i=0;i<5;i++){
   const x=farm.x-9+i*4;
   box('farm-hay-'+farm.id+'-'+i,2.2,1.2,1.6,x,.66,farm.z+10,mat.corn);
  }
  obstacle(farm.x-2,farm.z,9,7,'farm-building');
  obstacle(farm.x+6,farm.z,5,7,'barn');
  const r=ring(farm.id,farm.x,farm.z,10,mid?'#f8bc48':'#d5c78d');
  rings.set(farm.id,r);farmMats.set(farm.id,r.material);
  if(mid){
   const goldMarker=cylinder('rich-gold-center',3,1.1,farm.x,7.25,farm.z,mat.gold,10);
   goldMarker.metadata={mapTag:'locked-center',farmId:farm.id};
  }
 }
 // 7 pillboxes with gun slit and concrete parapet.
 for(const fort of map.pillboxes){
  cylinder('pillbox-bunker-'+fort.id,9,2.8,fort.x,1.44,fort.z,mat.stone,8);
  cylinder('pillbox-roof-'+fort.id,10.5,.55,fort.x,3,fort.z,mat.roof,8);
  box('pillbox-slit-'+fort.id,3,.35,.24,fort.x,1.95,fort.z+4.1,mat.black);
  obstacle(fort.x,fort.z,9,9,'pillbox');
 }
 // Three burned-out APCs in the exact approved broken-column positions.
 // This geometry deliberately represents *positions/roadblocks only*.
 // The original GLB is embedded in a huge legacy HTML file and must be
 // extracted before the intact BTR model is substituted here.
 for(const w of map.wrecks){
  const proxies=[];
  const hull=box('legacy-btr-position-'+w.id,7.4,1.6,3.1,w.x,1.0,w.z,mat.burnt,w.heading);
  proxies.push(hull);
  proxies.push(box('btr-top-'+w.id,4.1,.85,2.7,w.x,2.0,w.z,mat.rust,w.heading));
  for(const sign of [-1,1])for(const offset of [-2.3,0,2.3]){
   const wheel=cylinder('btr-wheel-'+w.id+'-'+sign+'-'+offset,1.35,.62,
    w.x+Math.cos(w.heading)*offset-Math.sin(w.heading)*sign*1.7,
    .78,w.z+Math.sin(w.heading)*offset+Math.cos(w.heading)*sign*1.7,
    mat.black,10);
   wheel.rotation.z=Math.PI/2;proxies.push(wheel);
  }
  obstacle(w.x,w.z,8,4,'btr-wreck');
  const burn=cylinder('btr-scorch-'+w.id,10,.018,w.x,.07,w.z,mat.burnt,16);
  burn.scaling.z=.5;proxies.push(burn);
  wreckProxies.set(w.id,proxies);
 }
 // Source: the original project's embedded Tykryk Sketchfab GLB,
 // CC BY 4.0 ("Cartoon Dieselpunk armored cars Polygonal Style").
 // Use its actual Object_2, Object_3, Object_4 meshes rather than new cars.
 async function loadOriginalBTR(){
  try{
   const container=await B.SceneLoader.LoadAssetContainerAsync(
    './assets/','btr-convoy-legacy.glb',scene);
   container.addAllToScene();
   const list=[...(container.meshes||[]),...(container.transformNodes||[])];
   const originals=['Object_2','Object_3','Object_4'];
   const unused=list.find(node=>node.name==='Object_5');
   unused?.setEnabled(false);
   for(let i=0;i<map.wrecks.length;i++){
    const w=map.wrecks[i],name=originals[i],mesh=list.find(node=>node.name===name);
    if(!mesh || !mesh.getHierarchyBoundingVectors)throw Error('Missing original '+name);
    mesh.computeWorldMatrix(true);
    const bound=mesh.getHierarchyBoundingVectors(true);
    const center=bound.min.add(bound.max).scale(.5);
    const bounds=bound.max.subtract(bound.min);
    const span=Math.max(bounds.x,bounds.z);
    if(!Number.isFinite(span)||span<.01)throw Error('Original BTR dimensions invalid');
    const anchor=new B.TransformNode('real-btr-'+w.id,scene);
    anchor.position.copyFrom(at(w.x,w.z,0,B));
    anchor.rotation.y=w.heading;
    anchor.scaling.setAll(7.6/span);
    // The original GLB nodes have identity parents and baked geometry.
    mesh.parent=anchor;
    mesh.position.x-=center.x;
    mesh.position.z-=center.z;
    mesh.position.y-=bound.min.y;
    const placeholder=wreckProxies.get(w.id)||[];
    for(const part of placeholder)part.dispose();
    wreckProxies.delete(w.id);
    originalWrecksLoaded++;
   }
   return {ok:true,loaded:originalWrecksLoaded};
  }catch(error){
   console.warn('Original convoy GLB unavailable; retaining collision-safe silhouettes.',error);
   return {ok:false,loaded:originalWrecksLoaded,error:String(error)};
  }
 }
 // Sandbags and intermittent trees — use instances for low draw-call count.
 for(let i=0;i<50;i++){
  const side=i%2?-1:1;
  const x=20+(i*47)%261;
  const z=side*(19+(i*23)%114)+150;
  if(x<18||x>282||z<15||z>285)continue;
  if(Math.hypot(x-150,z-150)<24)continue;
  cylinder('tree-trunk-'+i,1.1,4.2,x,2.1,z,mat.trunk,6);
  const tree=cylinder('tree-crown-'+i,6.5,7,x,8,z,mat.hedge,7);
  tree.scaling.x=.95;
 }
 for(const p of [[86,123],[210,120],[120,175],[190,181],[150,83],[152,220]]){
  for(let i=-3;i<=3;i++)box('sandbag-'+p[0]+'-'+p[1]+'-'+i,1.5,.5,.85,
   p[0]+i*1.3,.4,p[1],mat.sand);
 }
 function syncFarms(economy){
  if(!economy)return;
  const central=economy.central;
  for(const farm of economy.farms||[]){
   const m=farmMats.get(farm.id);if(!m)continue;
   const locked=farm.id==='center'&&!central?.open;
   const col=locked?'#5b5b59':farm.owner==='blue'?'#4e9abb':
    farm.owner==='red'?'#c85c4d':farm.id==='center'?'#e2bd56':'#d5c78d';
   m.diffuseColor=B.Color3.FromHexString(col);
   m.emissiveColor=B.Color3.FromHexString(col).scale(.6);
   rings.get(farm.id).isVisible=true;
  }
 }
 return {ground,nodes,obstacles,rings,syncFarms,loadOriginalBTR,
  getOriginalWreckCount:()=>originalWrecksLoaded,
  toScene:(x,z,y=0)=>at(x,z,y,B),
  fromScene:from,
  inBase:(x,z,team,radius=25)=>{
   const b=map.bases.find(b=>b.team===team);
   return !!b&&Math.hypot(x-b.x,z-b.z)<=radius;
  },
  isInside:(x,z)=>x>=0&&x<=300&&z>=0&&z<=300
 };
}
return {create,SIZE,ORIGIN};
});