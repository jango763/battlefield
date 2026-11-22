/* Battlefield Babylon — 2026 art direction: scanned CC0 PBR, damaged WWII
 * architecture, foliage and cinematic daylight. PURE RENDERING ONLY.
 * Preserve the original game's map positions, collision, combat, capture,
 * character GLBs, skeletons, clip layers and controls.
 *
 * Real scan maps: Poly Haven CC0 (tracked in art/SOURCE_LICENSES.json).
 * All assets are local, no runtime texture CDN or login.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldModernArt=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const PROFILE='modern-battlefield-pbr-v1';
function apply({scene,B,world,camera,sun,map}){
 if(!scene||!B||!world||!camera||!sun||!map)
  throw Error('Modern-art scene dependencies are incomplete');
 const report={profile:PROFILE,scannedMaterialMaps:0,meshSurfaces:0,
  architecturalDetails:0,damagedRuins:0,groundDebris:0,
  foliageInstances:0,drawCallBatches:0,errors:[],ready:false};
 const nodes=world.nodes||[];
 const byName=new Map(nodes.map(n=>[n.name,n]));
 // Stable seeded geometry and weathering. Visual-only geometry is collisionless.
 let seed=20261121;
 const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const between=(a,b)=>a+(b-a)*rand();
 const choose=a=>a[Math.min(a.length-1,Math.floor(rand()*a.length))];
 const pos=(x,y,z)=>new B.Vector3(x-150,y,z-150);
 const material={};
 const textures=[];
 function pbr(label,scan,{scale=2,tint='#ffffff',rough=.94}={}){
  const m=new B.PBRMaterial('hd2026-'+label,scene);
  m.albedoColor=B.Color3.FromHexString(tint);
  m.metallic=0;m.roughness=rough;
  m.backFaceCulling=true;
  m.specularIntensity=.22;
  const base=new B.Texture('./art/'+scan+'-base.jpg',scene,true,false,
   B.Texture.TRILINEAR_SAMPLINGMODE,
   ()=>{report.scannedMaterialMaps++},
   (_msg,exception)=>report.errors.push('missing '+scan+' diffuse '+String(exception||_msg)));
  const normal=new B.Texture('./art/'+scan+'-normal.jpg',scene,true,false,
   B.Texture.TRILINEAR_SAMPLINGMODE,
   ()=>{report.scannedMaterialMaps++},
   (_msg,exception)=>report.errors.push('missing '+scan+' normal '+String(exception||_msg)));
  for(const t of [base,normal]){
   t.wrapU=t.wrapV=B.Texture.WRAP_ADDRESSMODE;
   t.uScale=t.vScale=scale;
   textures.push(t);
  }
  normal.level=.52;
  m.albedoTexture=base;m.bumpTexture=normal;
  material[label]=m;
  return m;
 }
 const mud=pbr('scanned-mud','mud',{scale:32,tint:'#bbc1b1',rough:1});
 // Road boxes are 265 x 9 metres. Texture UVs need DISTANCE-PROPORTIONAL
 // repeat counts or photoscanned soil stretches into ugly vertical streaks.
 const mudRoad=pbr('tracked-earth','mud',{scale:1,tint:'#b5a486',rough:1});
 const crossRoad=pbr('tracked-earth-east-west','mud',{scale:1,tint:'#b5a486',rough:1});
 for(const tex of [mudRoad.albedoTexture,mudRoad.bumpTexture]){
  tex.uScale=1.6;tex.vScale=45;
 }
 for(const tex of [crossRoad.albedoTexture,crossRoad.bumpTexture]){
  tex.uScale=40;tex.vScale=1.3;
 }
 const plaster=pbr('battered-plaster','plaster',{scale:2,tint:'#d4c8b5'});
 const brick=pbr('weathered-brick','brick',{scale:2,tint:'#c4aa9b',rough:1});
 const stone=pbr('pitted-stone','stone',{scale:2,tint:'#c4bfaf',rough:1});
 const roof=pbr('old-roof-tiles','brick',{scale:4,tint:'#817166',rough:1});
 const timber=pbr('warped-timber','wood',{scale:2,tint:'#9b8b76',rough:1});
 const dirt=pbr('soil-patches','mud',{scale:2,tint:'#9c927f',rough:1});
 // Ground was previously a single hand-painted 1024x1024 canvas that faded
 // into flat brown. Photographically scanned multi-surface PBR adds fine relief.
 const oldGround=world.ground.material;
 world.ground.material=mud;
 world.ground.receiveShadows=true;
 report.meshSurfaces++;
 if(oldGround&&oldGround!==mud)oldGround.dispose(true,true);
 const classify={
  'base-square-':stone,'base-hq-':plaster,'barrack-':plaster,
  'farm-yard-':dirt,'farm-house-':plaster,'farm-barn-':timber,
  'pillbox-bunker-':stone,'pillbox-roof-':stone,
  'legacy-ruin-':brick,'broken-fence-':timber,'fence-rail-':timber,
  'farm-door-':timber,'farm-window-sill-':stone,'farm-roof-ridge-':timber,
  'base-door-':timber,'farm-barn-roof-':roof,
  'base-hq-roof-':roof,'barrack-roof-':roof,'farm-roof-':roof,
  'north-south-road':mudRoad,'west-east-road':crossRoad,
  'lane-farm-':dirt,'btr-top-':timber
 };
 // Mesh semantics drive art, not blanket traversal. Faction capture rings,
 // uniforms, skinned soldier rigs and road collisions retain their identity.
 const entries=Object.entries(classify).sort((a,b)=>b[0].length-a[0].length);
 for(const mesh of nodes){
  // Babylon.Mesh has no Three.js-style "isMesh" property: all genuine map
  // geometry was erroneously skipped in the first art test.
  if(!mesh?.material||mesh.skeleton)continue;
  // Hundreds of raised rectangular road ruts looked like 1990s scenery.
  if(mesh.name.startsWith('rut-')){mesh.isVisible=false;continue;}
  const match=entries.find(([prefix])=>mesh.name.startsWith(prefix));
  if(!match)continue;
  // Clan/faction indicators remain unmodified by the texture pass.
  mesh.material=match[1];
  mesh.receiveShadows=true;report.meshSurfaces++;
 }
 // Strong white 28-metre circles across the hero's screen were base rings,
 // not ground art. Faction bases are already marked on the minimap.
 for(const base of map.bases){
  const circle=scene.getMeshByName('map-ring-'+base.id);
  if(circle)circle.isVisible=false;
 }
 const batches=new Map();
 function addShape(mesh,matName){
  mesh.material=material[matName];
  mesh.isPickable=false;
  mesh.receiveShadows=true;
  const arr=batches.get(matName)||[];
  arr.push(mesh);batches.set(matName,arr);
  report.architecturalDetails++;
  return mesh;
 }
 function box(name,x,y,z,w,h,d,matName,angle=0){
  const mesh=B.MeshBuilder.CreateBox('hd2026-'+name,{width:w,height:h,depth:d},scene);
  mesh.position.copyFrom(pos(x,y,z));
  mesh.rotation.z=angle;
  return addShape(mesh,matName);
 }
 function roofPair(label,x,z,y,width,depth){
  // Pitched gable roof, not a flat rectangular slab. Two separate slopes.
  const half=width/2, rise=1.25;
  for(const side of [-1,1]){
   const slope=Math.atan2(rise,half);
   const horizontal=Math.sqrt(half*half+rise*rise);
   const panel=box(label+'-'+side,x+side*half/2,y+rise/2,z,
    horizontal+.18,.28,depth+.35,'old-roof-tiles',side*slope);
   panel.receiveShadows=true;
  }
  box(label+'-ridge',x,y+rise+.02,z,width*.04,.24,depth+.6,
   'warped-timber');
 }
 function frameWindow(label,x,y,z,facesBack=false){
  // Deep window reveal, diagonal broken shutter, stone sill.
  box(label+'-top',x,y+.72,z,1.65,.16,.24,'pitted-stone');
  box(label+'-bottom',x,y-.69,z,1.75,.16,.37,'pitted-stone');
  box(label+'-left',x-.8,y,z,.14,1.42,.20,'warped-timber');
  box(label+'-right',x+.8,y,z,.14,1.42,.20,'warped-timber');
  const shutter=box(label+'-shutter',x+1.06,y-.08,z,
   .43,1.35,.16,'warped-timber',between(-.19,.22));
  shutter.rotation.y=facesBack?Math.PI*.13:0;
  box(label+'-lintel',x,y+.85,z,2.15,.23,.42,'weathered-brick');
 }
 // Make existing five capture buildings credible WWII stone/plaster villages.
 // Original shells remain intact for collision, interaction and capture.
 for(const farm of map.farms){
  const x=farm.x-2,z=farm.z;
  const old=byName.get('farm-roof-'+farm.id);
  if(old)old.isVisible=false;
  roofPair('farm-'+farm.id,x,z,5.6,9.8,7.7);
  // Same art on both facades, with timber frames and actual shutter details.
  for(const direction of [-1,1]){
   const face=z+direction*3.59;
   for(const offset of [-2.9,2.9]){
    frameWindow('farm-'+farm.id+'-window-'+direction+'-'+offset,
     x+offset,2.98,face);
   }
   box('farm-'+farm.id+'-base-course-'+direction,x,.62,face,
    9,.42,.40,'pitted-stone');
   for(const side of [-1,1])
    box('farm-'+farm.id+'-edge-column-'+direction+'-'+side,
     x+side*4.38,2.45,face,.47,4.5,.48,'weathered-brick');
  }
  // Wooden beams and soot-darkened chimney.
  box('farm-chimney-'+farm.id,x+2.2,7.45,z-1,1.3,3.2,1.2,'weathered-brick');
  box('farm-chimney-top-'+farm.id,x+2.2,9.13,z-1,1.55,.32,1.55,'pitted-stone');
  for(let i=0;i<8;i++){
   const dx=between(-5,5),dz=between(-5,5);
   box('farm-rubble-'+farm.id+'-'+i,x+dx,.13,z+3.7+Math.abs(dz)*.34,
    between(.35,.9),between(.15,.38),between(.4,1),'pitted-stone',
    between(-.35,.35));
   report.groundDebris++;
  }
 }
 // Country headquarters: rough stone base, timber pilasters, windows,
 // pitched tiled roof. Faction banner stays separate for color recognition.
 for(const base of map.bases){
  const x=base.x,z=base.z,y=5.72;
  const old=byName.get('base-hq-roof-'+base.id);
  if(old)old.isVisible=false;
  roofPair('hq-'+base.id,x,z,y,13.4,9.25);
  for(const faceZ of [z-4.58,z+4.58]){
   for(const dx of [-4.5,-1.8,1.8,4.5]){
    frameWindow('hq-'+base.id+'-'+faceZ+'-'+dx,
     x+dx,3.2,faceZ,true);
   }
   box('hq-'+base.id+'-foundation-'+faceZ,x,.55,faceZ,
    13.8,1,.5,'pitted-stone');
  }
  for(const side of [-1,1]){
   const left=x+side*6.25;
   box('hq-'+base.id+'-corner-'+side,left,2.9,z-3,.66,5.2,.73,'weathered-brick');
   box('hq-'+base.id+'-second-corner-'+side,left,2.9,z+3,.66,5.2,.73,'weathered-brick');
  }
  box('hq-chimney-'+base.id,x+3.4,7.7,z-1.5,1.7,3.6,1.3,'weathered-brick');
  // Blue/red equipment banner is cloth, not a whole neon-blue building.
  const banner=new B.StandardMaterial('hd2026-banner-'+base.team,scene);
  banner.diffuseColor=B.Color3.FromHexString(base.team==='blue'?'#6b9aaa':'#aa6755');
  banner.specularColor=B.Color3.Black();
  const cloth=B.MeshBuilder.CreatePlane('hd2026-faction-banner-'+base.id,
   {width:2.4,height:3.1},scene);
  cloth.position.copyFrom(pos(x,3.8,z+(base.team==='blue'?4.88:-4.88)));
  if(base.team==='red')cloth.rotation.y=Math.PI;
  cloth.material=banner;cloth.isPickable=false;
 }
 // A ruined rural wall near the playable route gets real wall openings and
 // thickness; never block the hero/AI path or add undocumented collisions.
 for(const [index,rx,rz] of [[0,126,72],[1,174,86],[2,98,188],
  [3,202,199],[4,110,244],[5,165,62]]){
  const h=between(3.2,4.9),wallLength=between(7,11);
  // Segmented walls with missing central sections, not intact boxes.
  for(const side of [-1,1]){
   const ww=wallLength*.30;
   const wall=box('ruin-'+index+'-main-'+side,rx+side*wallLength*.35,
    h*.47,rz,ww,h*.95,.52,'battered-plaster');
   wall.rotation.y=between(-.11,.11);
   box('ruin-'+index+'-stone-course-'+side,rx+side*wallLength*.35,
    .45,rz,ww+.1,.86,.68,'pitted-stone');
   for(let j=0;j<2;j++)
    box('ruin-'+index+'-exposed-brick-'+side+'-'+j,
     rx+side*wallLength*.35+between(-ww*.4,ww*.4),
     between(1.2,h*.8),rz+.30,.53,.45,.15,'weathered-brick',between(-.2,.2));
  }
  // Splintered roof beams and collapsed rubble catch the low sun.
  for(let j=0;j<5;j++){
   box('ruin-'+index+'-joist-'+j,
    rx+between(-5,5),between(.3,2.8),rz+between(-1.8,1.8),
    between(1,3.9),.25,.21,'warped-timber',between(-.5,.5));
  }
  for(let j=0;j<12;j++){
   box('ruin-'+index+'-stone-'+j,rx+between(-6,6),
    between(.12,.3),rz+between(-2.7,2.7),
    between(.32,.99),between(.22,.62),between(.3,.82),
    j%3?'pitted-stone':'weathered-brick',between(-.45,.45));
   report.groundDebris++;
  }
  report.damagedRuins++;
 }
 // Merge only identical static materials. This avoids hundreds of extra draw
 // calls on WebKit yet leaves *original* gameplay meshes/obstacles unchanged.
 for(const [name,parts] of batches){
  if(parts.length<2)continue;
  try{
   const joined=B.Mesh.MergeMeshes(parts,true,true);
   if(joined){joined.name='hd2026-merged-'+name;
    joined.material=material[name];joined.isPickable=false;joined.receiveShadows=true;
    joined.freezeWorldMatrix();report.drawCallBatches++;}
  }catch(error){report.errors.push('mesh merge '+name+' '+String(error));}
 }
 // Mobile-friendly grass cards, generated once with alpha and instanced.
 // Cards replace no gameplay objects and are deliberately away from the road.
 try{
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,128,128);
  for(let i=0;i<48;i++){
   const x=between(28,100),blade=between(35,107);
   ctx.strokeStyle=choose(['#384c31','#596b3b','#7a8051','#8a8158','#485d37']);
   ctx.lineWidth=between(1.5,4.2);
   ctx.beginPath();ctx.moveTo(64,127);
   ctx.quadraticCurveTo(x+between(-25,25),blade,x,between(25,85));ctx.stroke();
  }
  const tex=new B.DynamicTexture('hd2026-grass-alpha',{width:128,height:128},scene,true);
  tex.getContext().drawImage(canvas,0,0);tex.hasAlpha=true;tex.update(false);
  const gm=new B.StandardMaterial('hd2026-grass-mat',scene);
  gm.diffuseTexture=tex;gm.opacityTexture=tex;
  gm.backFaceCulling=false;gm.specularColor=B.Color3.Black();
  gm.useAlphaFromDiffuseTexture=true;gm.transparencyMode=B.Material.MATERIAL_ALPHATEST;
  const mesh=B.MeshBuilder.CreatePlane('hd2026-meadow-blades',{width:1.5,height:1.55},scene);
  mesh.material=gm;mesh.isPickable=false;
  const matrices=[];
  // Avoid alpha overdraw on low-power phones while preserving the original
  // photogrammetry/PBR surfaces, colliders, actors and animation systems.
  const lowPower=new URLSearchParams(
   typeof location!=='undefined'?location.search:'').get('quality')==='low';
  const foliageBudget=lowPower?120:260;
  for(let i=0;i<foliageBudget;i++){
   const x=between(20,280),z=between(20,280);
   // Keep spawn lanes, farm yards and the two center roads readable.
   if(Math.abs(x-150)<8||Math.abs(z-150)<8)continue;
   if(map.farms.some(f=>Math.hypot(f.x-x,f.z-z)<12))continue;
   if(map.bases.some(b=>Math.hypot(b.x-x,b.z-z)<22))continue;
   const q=B.Quaternion.FromEulerAngles(0,between(0,Math.PI),0);
   const w=between(.6,1.8);
   const m=B.Matrix.Compose(new B.Vector3(w,w,w),q,pos(x,.75*w,z));
   matrices.push(...m.asArray());
   report.foliageInstances++;
  }
  if(matrices.length){
   mesh.thinInstanceSetBuffer('matrix',new Float32Array(matrices),16,true);
   mesh.thinInstanceRefreshBoundingInfo();
  }
 }catch(error){report.errors.push('foliage '+String(error));}
 // Restrained warm light — no extreme color filters, high-cost bloom or SSAO
 // at mobile resolution. Original sun casts PCF shadows where already supported.
 sun.intensity=1.2;
 if(scene.fogMode!==B.Scene.FOGMODE_NONE){
  scene.fogDensity=.0026;
  scene.fogColor=B.Color3.FromHexString('#9a9b8e');
 }
 const config=scene.imageProcessingConfiguration;
 if(config){config.toneMappingEnabled=true;config.exposure=1.06;config.contrast=1.11;}
 report.ready=true;
 scene.metadata=scene.metadata||{};
 scene.metadata.battlefieldModernArt=report;
 return report; // Asynchronous local JPG loads increment report.scannedMaterialMaps.
}
return Object.freeze({apply,PROFILE});
});