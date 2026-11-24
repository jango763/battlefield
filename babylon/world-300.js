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
 const wreckProxies=new Map(),vehicleBounds=[];let originalWrecksLoaded=0;
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
  earth:material('earth','#c8ae82'),grass:material('grass','#b6a277'),
  dirt:material('dirt','#b99b72'),road:material('road','#d1b18a'),
  track:material('track','#927657'),stone:material('stone','#ccb38b'),
  roof:material('roof','#a98267'),wood:material('wood','#8d704e'),
  burnt:material('burnt','#242624'),rust:material('rust','#513c2d'),
  black:material('black','#161c19'),sand:material('sand','#e0c5a0'),
  blue:material('blue','#517f99'),red:material('red','#9b5046'),
  gold:material('gold','#be9336','#493711'),
  corn:material('corn','#d0b87c'),hedge:material('hedge','#8b8d63'),
  trunk:material('trunk','#725941'),stem:material('stem','#c7b38a'),
  leaves:material('leaves','#99976c')
 };
 function box(id,w,h,d,x,y,z,m,rot=0,pickable=false){
  const o=B.MeshBuilder.CreateBox(id,{width:w,height:h,depth:d},scene);
  o.position.copyFrom(at(x,z,y,B));o.rotation.y=rot;o.material=m;
  o.isPickable=pickable;nodes.push(o);
  if(/^(barrack-(?!roof)|legacy-ruin-|fence-rail-|sandbag-)/.test(id)){
   const c=Math.abs(Math.cos(rot)),s=Math.abs(Math.sin(rot));
   obstacle(x,z,w*c+d*s,d*c+w*s,id);
   obstacles[obstacles.length-1].blocksSight=!id.startsWith('sandbag-');
  }
  return o;
 }
 function cylinder(id,diameter,height,x,y,z,m,tessellation=8){
  const o=B.MeshBuilder.CreateCylinder(id,{diameter,height,tessellation},scene);
  o.position.copyFrom(at(x,z,y,B));o.material=m;o.isPickable=false;
  nodes.push(o);if(id.startsWith('tree-trunk-'))obstacle(x,z,diameter,diameter,'tree');return o;
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
 // Legacy CoH-style terrain: warm earth, olive grass and weathered tracks.
 // DynamicTexture takes a size object, not an HTMLCanvasElement. Always call
 // update() after painting; otherwise mobile WebGL may display WHITE ground.
 const ground=B.MeshBuilder.CreateGround('map-ground-300',{width:SIZE,height:SIZE,
  subdivisions:60},scene);
 const groundMaterial=new B.StandardMaterial('map-ground-material',scene);
 // Muted tint prevents bright sunlight from blowing earthy tones to white.
 groundMaterial.diffuseColor=B.Color3.FromHexString('#e8d7b5');
 let groundTextureReady=false;
 if(typeof document!=='undefined' && B.DynamicTexture){
  try{
   const tx=new B.DynamicTexture('battlefield-earth',
    {width:1024,height:1024},scene,false);
   const c=tx.getContext();
   if(!c||typeof c.fillRect!=='function')throw Error('No 2D terrain context');
   c.fillStyle='#cbb08a';c.fillRect(0,0,1024,1024);
   let seed=721;
   const rnd=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
   // Broad, overlapping variations are readable from the RTS camera.
   for(let i=0;i<2800;i++){
    const x=rnd()*1024,y=rnd()*1024,r=12+rnd()*65;
    c.globalAlpha=.04+rnd()*.10;
    c.fillStyle=['#d4ba91','#aa8964','#c7a77b','#e0c79e','#967755'][Math.floor(rnd()*5)];
    c.beginPath();c.ellipse(x,y,r*(.6+rnd()),r*(.25+rnd()*.35),
      rnd()*Math.PI,0,Math.PI*2);c.fill();
   }
   // Fine earth and grass breakup; deterministic across game sessions.
   for(let i=0;i<24000;i++){
    const x=rnd()*1024,y=rnd()*1024,r=.5+rnd()*3.6;
    c.fillStyle=['#a48a64','#dac098','#b99d77','#927456','#e9d4b2'][Math.floor(rnd()*5)];
    c.globalAlpha=.15+rnd()*.31;
    c.fillRect(x,y,r*2,r);
   }
   c.globalAlpha=1;
   tx.update(false); // Required: upload the painted 2D canvas to the GPU.
   tx.uScale=2.3;tx.vScale=2.3;
   tx.wrapU=B.Texture?.WRAP_ADDRESSMODE??1;
   tx.wrapV=B.Texture?.WRAP_ADDRESSMODE??1;
   groundMaterial.diffuseTexture=tx;
   groundTextureReady=true;
  }catch(error){
   console.warn('Terrain texture fallback',error);
  }
 }
 if(!groundTextureReady)groundMaterial.diffuseColor=B.Color3.FromHexString('#cbb08a');
 groundMaterial.specularColor=new B.Color3(.02,.02,.02);
 ground.material=groundMaterial;ground.isPickable=true;ground.receiveShadows=true;
 // Dirt road is narrow, weathered and textured: no featureless white highway.
 // Preserve the exact road positions and collision-free gameplay routes.
 if(typeof document!=='undefined' && B.DynamicTexture){
  try{
   const tx=new B.DynamicTexture('battlefield-dirt-track',
    {width:512,height:512},scene,false);
   const c=tx.getContext();
   c.fillStyle='#b69b77';c.fillRect(0,0,512,512);
   let seed=1776;
   const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
   for(let i=0;i<9000;i++){
    c.globalAlpha=.10+rand()*.22;
    c.fillStyle=['#92734f','#e1c59f','#b89a73','#82664a'][Math.floor(rand()*4)];
    const x=rand()*512,y=rand()*512,r=.8+rand()*5.5;
    c.fillRect(x,y,r*1.6,r);
   }
   c.globalAlpha=1;
   tx.update(false);tx.uScale=2;tx.vScale=30;
   tx.wrapU=B.Texture?.WRAP_ADDRESSMODE??1;
   tx.wrapV=B.Texture?.WRAP_ADDRESSMODE??1;
   mat.road.diffuseTexture=tx;
  }catch(error){console.warn('Dirt-road texture fallback',error);}
 }
 // Main central supply road, two farm access branches and vehicle tracks.
 box('north-south-road',9.4,.04,265,150,.025,150,mat.road);
 box('west-east-road',246,.045,8,150,.028,150,mat.road);
 for(const side of [-1,1]){
  box('lane-farm-west-'+side,135,.05,4,81,.055,150+side*52,mat.dirt);
  box('lane-farm-east-'+side,135,.05,4,219,.055,150+side*52,mat.dirt);
 }
 for(let z=18;z<=282;z+=7)for(const x of [147.2,152.8])
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
  obstacles[obstacles.length-1].id=w.id;
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
    // GLB has a -90 degree X rotation on Sketchfab_model. Detaching via
    // setParent preserves that WORLD rotation; assigning parent alone lost it.
    mesh.setParent(null,true,true);
    mesh.parent=anchor; // Identity parent, then center in the preserved frame.
    mesh.position.x-=center.x;
    mesh.position.z-=center.z;
    mesh.position.y-=bound.min.y;
    anchor.scaling.setAll(7.6/span);
    anchor.rotation.y=w.heading;
    anchor.position.copyFrom(at(w.x,w.z,.025,B));
    anchor.computeWorldMatrix(true);mesh.computeWorldMatrix(true);
    const placed=mesh.getHierarchyBoundingVectors(true);
    const collider=obstacles.find(o=>o.id===w.id);
    if(collider){
     collider.x=(placed.min.x+placed.max.x)/2+ORIGIN;
     collider.z=(placed.min.z+placed.max.z)/2+ORIGIN;
     collider.hw=(placed.max.x-placed.min.x)/2;
     collider.hd=(placed.max.z-placed.min.z)/2;
    }
    vehicleBounds.push({id:w.id,minY:placed.min.y,height:placed.max.y-placed.min.y,
     width:placed.max.x-placed.min.x,depth:placed.max.z-placed.min.z});
    // Clone and darken the original vehicle materials as in the old game.
    // Avoid mutating shared source materials or altering the GLB asset.
    const parts=[mesh,...(mesh.getChildMeshes?mesh.getChildMeshes():[])];
    for(const part of parts){
     if(!part.material||!part.material.clone)continue;
     const burnt=part.material.clone('burnt-'+w.id+'-'+part.name);
     if(burnt.albedoColor)burnt.albedoColor=burnt.albedoColor.scale(.42);
     else if(burnt.diffuseColor)burnt.diffuseColor=burnt.diffuseColor.scale(.42);
     part.material=burnt;
    }
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
 // Ruins, shell craters and debris from the approved first-generation battlefield.
 // Non-pickable decoration never intercepts click-to-move or enemy targeting.
 const rubble=material('rubble','#b49a79'),crater=material('shell-crater','#87684d');
 const craterRim=material('shell-rim','#c4aa81');
 for(let i=0;i<35;i++){
  const x=19+(i*47)%261,z=23+(i*71)%253;
  if(Math.hypot(x-150,z-43)<25||Math.hypot(x-150,z-275)<25)continue;
  if(map.farms.some(f=>Math.hypot(f.x-x,f.z-z)<16))continue;
  const radius=1.2+(i%5)*.42;
  const scorch=cylinder('shell-impact-'+i,radius*2,.018,x,.009,z,crater,12);
  scorch.scaling.z=.76;scorch.isPickable=false;
  const rim=B.MeshBuilder.CreateTorus('shell-rim-'+i,
    {diameter:radius*2.1,thickness:.18,tessellation:14},scene);
  rim.position.copyFrom(at(x,z,.023,B));rim.scaling.z=.78;
  rim.material=craterRim;rim.isPickable=false;nodes.push(rim);
  for(let j=0;j<2;j++){
   const rock=box('shell-debris-'+i+'-'+j,.4+(i%3)*.17,.3,.55,
    x+Math.cos(i+j*2.3)*radius*1.3,.15,z+Math.sin(i+j*2.3)*radius*1.3,rubble,i*.21);
   rock.isPickable=false;
  }
 }
 // Collapsed wall fragments and timber fences make the map read as a WWII
 // battlefield rather than an empty test grid. Keep spawn routes clear.
 for(const [x,z] of [[57,53],[84,111],[210,88],[232,184],[75,182],
    [117,206],[181,218],[48,145],[249,139],[120,237]]){
  for(let i=0;i<3;i++){
   const piece=box('legacy-ruin-'+x+'-'+i,2.4,.6+i*.5,.85,
    x+i*2.2,(.6+i*.5)/2,z+(i%2)*.55,mat.stone,(i%2)*.2);
   piece.isPickable=false;
  }
  for(let i=0;i<4;i++){
   const beam=box('broken-fence-'+x+'-'+i,.14,1.3,.14,
    x-5+i*2.1,.65,z+5,mat.wood);
   beam.isPickable=false;
  }
  for(let i=0;i<2;i++){
   const beam=box('fence-rail-'+x+'-'+i,6.4,.12,.13,
    x-1.9,.8+i*.35,z+5,mat.wood);
   beam.isPickable=false;
  }
 }
 // Farm trim, windows and roof ridge preserve readable building silhouettes.
 for(const farm of map.farms){
  box('farm-door-'+farm.id,1.65,2.5,.15,farm.x-2,1.28,farm.z+3.56,mat.wood);
  for(const dx of [-3.2,3.2]){
   box('farm-window-'+farm.id+'-'+dx,1.15,1.15,.17,
    farm.x-2+dx,2.8,farm.z+3.6,mat.black);
   box('farm-window-sill-'+farm.id+'-'+dx,1.4,.17,.32,
    farm.x-2+dx,2.15,farm.z+3.66,mat.stone);
  }
  box('farm-roof-ridge-'+farm.id,10.5,.2,.22,
   farm.x-2,6.7,farm.z,mat.wood);
 }
 for(const base of map.bases){
  for(const dx of [-4.6,4.6]){
   box('hq-window-'+base.id+'-'+dx,1.5,1.4,.2,
    base.x+dx,3.1,base.z+4.58,mat.black);
  }
 }
 // Sandbags and intermittent trees — use instances for low draw-call count.
  // Correct one-sided frond winding for stable upward vertex normals.
  // Both-face triangles shared the same vertices and cancelled normals.
  mat.leaves.backFaceCulling=false;
  mat.leaves.emissiveColor=B.Color3.FromHexString('#797352');
  mat.hedge.emissiveColor=B.Color3.FromHexString('#635c47');
  // 17 date palms / 33 wind-shaped acacias. Palm leaves are compiled into
  // a single faceted world mesh for one draw call; trunk collisions unchanged.
  // Matte olive ensures fine leaflets stay legible, not overexposed white.
  const palmLeafMat=material('palm-leaves','#4a5738','#64734e');
  palmLeafMat.disableLighting=true;
  palmLeafMat.backFaceCulling=false;
  const palmPositions=[],palmIndices=[],palmNormals=[];
  function addLeaflet(x0,y0,z0,x1,y1,z1,x2,y2,z2){
   const start=palmPositions.length/3;
   palmPositions.push(x0,y0,z0,x1,y1,z1,x2,y2,z2);
   palmIndices.push(start,start+1,start+2);
  }
  function palmFronds(x,z,top,phase){
   const arms=9,steps=4;
   for(let a=0;a<arms;a++){
    const angle=phase+a*Math.PI*2/arms,dirX=Math.cos(angle),dirZ=Math.sin(angle);
    const sideX=-dirZ,sideZ=dirX;
    const start=palmPositions.length/3;
    for(let k=0;k<=steps;k++){
     const t=k/steps,reach=4.5*t;
     const yy=top+.82*Math.sin(t*Math.PI)-1.9*t*t;
     // Slender leaf midrib instead of an oversized flat polygon fan.
     const w=.055+.095*Math.sin(t*Math.PI);
     for(const sign of [-1,1]){
      palmPositions.push(x-150+dirX*reach+sideX*w*sign,yy,
       z-150+dirZ*reach+sideZ*w*sign);
     }
    }
    for(let k=0;k<steps;k++){
     const a0=start+k*2,b0=a0+1,c0=a0+2,d0=a0+3;
     palmIndices.push(a0,b0,c0,b0,d0,c0);
    }
    // Thin staggered leaflets form a serrated date-palm silhouette.
    // All 17 palm crowns are still drawn in one existing indexed mesh.
    for(let k=1;k<=steps*2;k++){
     const t=(k-.25)/(steps*2),reach=4.5*t;
     const y=top+.82*Math.sin(t*Math.PI)-1.9*t*t;
     const half=.48*Math.sin(t*Math.PI);
     const radial=reach+.34*(1-t);
     for(const sign of [-1,1]){
      const bx=x-150+dirX*reach,bz=z-150+dirZ*reach;
      addLeaflet(
       bx-dirX*.15,y,bz-dirZ*.15,
       x-150+dirX*radial+sideX*sign*half,y-.27*(1-t),
       z-150+dirZ*radial+sideZ*sign*half,
       bx+dirX*.21,y+.035,bz+dirZ*.21);
     }
    }
   }
  }
 for(let i=0;i<50;i++){
  const side=i%2?-1:1;
  const x=20+(i*47)%261;
  const z=side*(19+(i*23)%114)+150;
  if(x<18||x>282||z<15||z>285)continue;
  if(Math.hypot(x-150,z-150)<24)continue;
  const isPalm=i%3===0,topY=isPalm?7.7:5.7;
  cylinder('tree-trunk-'+i,1.1,isPalm?7.6:5.7,x,topY/2,z,mat.trunk,7);
  const crown=B.MeshBuilder.CreateSphere('tree-crown-'+i,
   {diameter:1,segments:5},scene);
  crown.position.copyFrom(at(x-.44,z+.26,isPalm?topY:5.65,B));
  crown.scaling.copyFrom(new B.Vector3(isPalm?1.05:6.0,
   isPalm?.60:1.28,isPalm?1.02:4.45));
  crown.material=mat.hedge;crown.isPickable=false;nodes.push(crown);
  const top=B.MeshBuilder.CreateSphere('tree-top-'+i,
   {diameter:1,segments:5},scene);
  top.position.copyFrom(at(x+.70,z-.31,isPalm?topY+.20:6.37,B));
  top.scaling.copyFrom(new B.Vector3(isPalm?.58:4.7,
   isPalm?.40:1.10,isPalm?.62:3.75));
  top.material=mat.leaves;top.isPickable=false;nodes.push(top);
  if(isPalm)palmFronds(x,z,topY,i*.43);
 }
 if(palmPositions.length){
  const mesh=new B.Mesh('north-africa-palm-fronds',scene);
  B.VertexData.ComputeNormals(palmPositions,palmIndices,palmNormals);
  const data=new B.VertexData();
  data.positions=palmPositions;data.indices=palmIndices;data.normals=palmNormals;
  data.applyToMesh(mesh);
  mesh.material=palmLeafMat;mesh.isPickable=false;mesh.receiveShadows=false;
  nodes.push(mesh);
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
  getOriginalWreckCount:()=>originalWrecksLoaded,vehicleBounds,
  addObstacle:o=>{obstacles.push(o);return o;},
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