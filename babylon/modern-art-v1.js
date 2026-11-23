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
  const base=new B.Texture('./art/'+scan+'-base.jpg',scene,false,false,
   B.Texture.TRILINEAR_SAMPLINGMODE,
   ()=>{report.scannedMaterialMaps++},
   (_msg,exception)=>report.errors.push('missing '+scan+' diffuse '+String(exception||_msg)));
  const normal=new B.Texture('./art/'+scan+'-normal.jpg',scene,false,false,
   B.Texture.TRILINEAR_SAMPLINGMODE,
   ()=>{report.scannedMaterialMaps++},
   (_msg,exception)=>report.errors.push('missing '+scan+' normal '+String(exception||_msg)));
  for(const t of [base,normal]){
   t.wrapU=t.wrapV=B.Texture.WRAP_ADDRESSMODE;
   t.anisotropicFilteringLevel=4;
   t.uScale=t.vScale=scale;
   textures.push(t);
  }
  normal.level=.22;
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
 // Quiet tactical terrain: the 32x tiled high-frequency photo mud produced
 // severe moire on iPhone while the elevated camera moved. Generate ONLY
 // broad, low-contrast brush patches and build real mipmaps for minification.
 const canvasGround=document.createElement('canvas');
 canvasGround.width=canvasGround.height=512;
 const brush=canvasGround.getContext('2d');
 if(!brush)throw Error('No terrain painting context');
 brush.fillStyle='#687957';brush.fillRect(0,0,512,512);
 for(let i=0;i<230;i++){
  const x=between(0,512),y=between(0,512);
  const radius=between(14,50);
  brush.globalAlpha=between(.12,.25);
  brush.fillStyle=choose(['#8b8768','#4b654a','#8d8265','#596746','#a08a68']);
  brush.beginPath();
  brush.ellipse(x,y,radius*between(.7,1.6),radius*between(.45,1.15),
   between(0,Math.PI),0,Math.PI*2);
  brush.fill();
 }
 // Reset the canvas alpha before painting feathered washes; otherwise the
 // final random brush alpha multiplies every gradient into invisibility.
 brush.globalAlpha=1;
 // Paint large, gently feathered fields, shell scars and road shoulders in
 // the ground albedo. Unlike micro-noise decals these survive minification.
 function earthWash(x,z,r,hex,opacity){
  const px=x*512/300,pz=z*512/300,rr=r*512/300;
  const gradient=brush.createRadialGradient(px,pz,rr*.10,px,pz,rr);
  gradient.addColorStop(0,hex.replace('ALPHA',String(opacity)));
  gradient.addColorStop(.54,hex.replace('ALPHA',String(opacity*.48)));
  gradient.addColorStop(1,hex.replace('ALPHA','0'));
  brush.fillStyle=gradient;brush.fillRect(px-rr,pz-rr,rr*2,rr*2);
 }
 for(let i=0;i<330;i++){
  const x=between(3,297),z=between(3,297);
  if(Math.abs(x-150)<7||Math.abs(z-150)<7)continue;
  earthWash(x,z,between(7,22),
   choose(['rgba(43,65,35,ALPHA)','rgba(115,91,56,ALPHA)','rgba(95,102,62,ALPHA)']),
   between(.11,.29));
 }
 // Large fallow-meadow belts break up the uniform 300m green slab from
 // the elevated mobile camera. Painted into the same 512px albedo: 0 draw calls.
 for(const [x,z,shade,area] of [
  [54,62,'rgba(139,119,78,ALPHA)',30],
  [246,63,'rgba(91,117,67,ALPHA)',34],
  [45,152,'rgba(84,111,59,ALPHA)',36],
  [245,158,'rgba(133,111,76,ALPHA)',29],
  [72,244,'rgba(134,119,77,ALPHA)',31],
  [228,241,'rgba(93,115,64,ALPHA)',33]
 ]){
  for(let j=0;j<10;j++)earthWash(x+between(-area,area),
   z+between(-area*.6,area*.6),between(8,20),shade,between(.20,.36));
 }
 // Continuous dusty road margins avoid a blank straight brown runway.
 for(let z=20;z<281;z+=7)for(const side of [-1,1]){
  earthWash(150+side*between(4,7),z+between(-3,3),between(3.4,7.5),
   'rgba(121,98,63,ALPHA)',between(.12,.24));
 }
 for(const t of [{z:82},{z:218}]){
  for(let x=35;x<=265;x+=10)
   earthWash(x,t.z+between(-2,2),between(4.5,8.5),
    'rgba(91,69,45,ALPHA)',between(.16,.29));
 }
 for(const w of map.wrecks||[])
  earthWash(w.x,w.z,between(5,8),'rgba(43,39,31,ALPHA)',.32);
 brush.globalAlpha=1;
 const terrainTexture=new B.DynamicTexture('hd2026-soft-painted-earth',
  {width:512,height:512},scene,true);
 terrainTexture.getContext().drawImage(canvasGround,0,0);
 terrainTexture.wrapU=terrainTexture.wrapV=B.Texture.CLAMP_ADDRESSMODE;
 terrainTexture.anisotropicFilteringLevel=4;
 terrainTexture.update(false);
 terrainTexture.updateSamplingMode(B.Texture.TRILINEAR_SAMPLINGMODE);
 // Painted countryside uses a matte diffuse shader instead of washed-out
 // high-exposure PBR ground. Historic buildings retain full scanned PBR.
 const smoothEarth=new B.StandardMaterial('hd2026-matte-terrain',scene);
 smoothEarth.diffuseTexture=terrainTexture;
 smoothEarth.diffuseColor=B.Color3.FromHexString('#cbd2bd');
 smoothEarth.specularColor=B.Color3.Black();
 smoothEarth.ambientColor=B.Color3.FromHexString('#414f34');
 // Right-handed scene + custom trench vertex winding can leave the large
 // terrain culled. A double-sided matte ground prevents sky-colour holes.
 smoothEarth.backFaceCulling=false;
 const oldGround=world.ground.material;
 world.ground.material=smoothEarth;
 world.ground.receiveShadows=true;
 report.meshSurfaces++;report.terrainStyle='low-frequency-mipmapped-matte';
 if(oldGround&&oldGround!==smoothEarth)oldGround.dispose(true,true);
 // Preserve all route coordinates and collisions; replace only the harsh
 // rectangular road surfaces with broad, smoothly irregular ribbons.
 const northRoad=scene.getMeshByName('north-south-road');
 const eastRoad=scene.getMeshByName('west-east-road');
 const roadCanvas=document.createElement('canvas');
 roadCanvas.width=roadCanvas.height=256;
 const rc=roadCanvas.getContext('2d');
 if(!rc)throw Error('No road painting context');
 rc.fillStyle='#716b54';rc.fillRect(0,0,256,256);
 for(let i=0;i<130;i++){
  rc.globalAlpha=between(.045,.14);
  rc.fillStyle=choose(['#99896b','#59644b','#5c5545','#9a8868']);
  rc.beginPath();
  rc.ellipse(between(0,256),between(0,256),between(9,35),
   between(12,49),between(0,Math.PI),0,Math.PI*2);
  rc.fill();
 }
 rc.globalAlpha=1;
 // Two wheel ruts + soft vegetated road shoulders. Repeating cross-section
 // is authored without high-frequency particles that shimmer on iPhone.
 for(const trackX of [68,188]){
  const rut=rc.createLinearGradient(trackX-28,0,trackX+28,0);
  rut.addColorStop(0,'rgba(42,38,30,0)');
  rut.addColorStop(.34,'rgba(48,40,31,.22)');
  rut.addColorStop(.5,'rgba(43,37,28,.32)');
  rut.addColorStop(.66,'rgba(48,40,31,.22)');
  rut.addColorStop(1,'rgba(42,38,30,0)');
  rc.fillStyle=rut;rc.fillRect(trackX-28,0,56,256);
 }
 for(const edge of [0,256]){
  const shoulder=rc.createLinearGradient(edge===0?0:229,0,
   edge===0?27:256,0);
  if(edge===0){shoulder.addColorStop(0,'rgba(52,66,43,.31)');
   shoulder.addColorStop(1,'rgba(52,66,43,0)');}
  else{shoulder.addColorStop(0,'rgba(52,66,43,0)');
   shoulder.addColorStop(1,'rgba(52,66,43,.31)');}
  rc.fillStyle=shoulder;rc.fillRect(edge===0?0:229,0,27,256);
 }
 rc.globalAlpha=1;
 const roadTexture=new B.DynamicTexture('hd2026-soft-road',
  {width:256,height:256},scene,true);
 roadTexture.getContext().drawImage(roadCanvas,0,0);
 roadTexture.wrapU=B.Texture.CLAMP_ADDRESSMODE;
 roadTexture.wrapV=B.Texture.WRAP_ADDRESSMODE;
 roadTexture.anisotropicFilteringLevel=4;
 roadTexture.update(false);
 roadTexture.updateSamplingMode(B.Texture.TRILINEAR_SAMPLINGMODE);
 for(const road of [mudRoad,crossRoad]){
  road.albedoTexture=roadTexture;
  road.bumpTexture=null;
  road.albedoColor=B.Color3.FromHexString('#ece5d3');
  road.roughness=1;road.specularIntensity=0;
 }
 // Avoid disconnected green ellipses: actual road boundaries undulate
 // at metre scale. This is geometry (not alpha/noise) and stays stable in Safari.
 function makeOrganicRoad(name,alongZ,begin,end,width,mat,height){
  const sideA=[],sideB=[],sections=100;
  const phase=alongZ?0:1.4;
  for(let i=0;i<=sections;i++){
   const t=i/sections,along=begin+(end-begin)*t;
   const wobble=.23*Math.sin(t*20+phase)+.12*Math.sin(t*51+phase);
   const half=width*.5*(1+.055*Math.sin(t*16+phase)+.035*Math.sin(t*39));
   if(alongZ){
    sideA.push(pos(150-half+wobble,height,along));
    sideB.push(pos(150+half+wobble,height,along));
   }else{
    sideA.push(pos(along,height,150-half+wobble));
    sideB.push(pos(along,height,150+half+wobble));
   }
  }
  const mesh=B.MeshBuilder.CreateRibbon('hd2026-organic-road-'+name,
   {pathArray:[sideA,sideB],sideOrientation:B.Mesh.DOUBLESIDE},scene);
  // Default UVs stretch one 256px image over the full 265m route.
  // Metre-based texture coordinates repeat longitudinally every 11m.
  const uv=mesh.getVerticesData(B.VertexBuffer.UVKind);
  if(!uv)throw Error('Road ribbon has no UV channel');
  const sideLength=sections+1,front=sideLength*2;
  for(let k=0;k<uv.length/2;k++){
   const vertex=k%front;
   uv[k*2]=Math.floor(vertex/sideLength);
   uv[k*2+1]=(vertex%sideLength)/sections*(end-begin)/11;
  }
  mesh.setVerticesData(B.VertexBuffer.UVKind,uv);
  mesh.material=mat;mesh.isPickable=false;mesh.receiveShadows=true;
  report.roadTextureRepeats=Math.round((end-begin)/11);
  report.roadUvTiled=true;
  return mesh;
 }
 makeOrganicRoad('north-south',true,17.5,282.5,4.2,mudRoad,.055);
 makeOrganicRoad('east-west',false,27,273,4.6,crossRoad,.062);
 if(northRoad)northRoad.isVisible=false;
 if(eastRoad)eastRoad.isVisible=false;
 report.roadVisualWidth=4.2;
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
   const c=Math.abs(Math.cos(wall.rotation.y)),sn=Math.abs(Math.sin(wall.rotation.y));
   world.addObstacle?.({x:rx+side*wallLength*.35,z:rz,hw:(ww*c+.68*sn)/2,hd:(ww*sn+.68*c)/2,type:'ruin-wall'});
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
 // Opaque low-poly grass clumps avoid alpha-tested edge crawl and flicker.
 // They are decorative thin instances and do not change terrain collisions.
 try{
  const gm=new B.StandardMaterial('hd2026-grass-mat',scene);
  gm.diffuseColor=B.Color3.FromHexString('#596b48');
  gm.specularColor=B.Color3.Black();
  const mesh=B.MeshBuilder.CreateCylinder('hd2026-meadow-tuft',
   {diameterTop:.055,diameterBottom:.65,height:.60,tessellation:5},scene);
  mesh.material=gm;mesh.isPickable=false;
  const matrices=[];
  const lowPower=new URLSearchParams(
   typeof location!=='undefined'?location.search:'').get('quality')==='low';
  const foliageBudget=lowPower?105:160;
  for(let i=0;i<foliageBudget;i++){
   const x=between(20,280),z=between(20,280);
   if(Math.abs(x-150)<9||Math.abs(z-150)<9)continue;
   if(map.farms.some(f=>Math.hypot(f.x-x,f.z-z)<12))continue;
   if(map.bases.some(b=>Math.hypot(b.x-x,b.z-z)<22))continue;
   const w=between(.8,1.6);
   const q=B.Quaternion.FromEulerAngles(0,between(0,Math.PI),0);
   const m=B.Matrix.Compose(new B.Vector3(w,w,w),q,pos(x,.30*w,z));
   matrices.push(...m.asArray());
   report.foliageInstances++;
  }
  if(matrices.length){
   mesh.thinInstanceSetBuffer('matrix',new Float32Array(matrices),16,true);
   mesh.thinInstanceRefreshBoundingInfo();
  }
 }catch(error){report.errors.push('foliage '+String(error));}
 // Group three differently shaped low-poly canopy lobes per site:
 // the previous single sphere read like a scattered green stone at RTS zoom.
 // Each lobe is one thin-instance draw call, regardless of site count.
 // This remains purely decorative; farm positions and collisions are intact.
 try{
  const lowPower=new URLSearchParams(
   typeof location!=='undefined'?location.search:'').get('quality')==='low';
  const plots=[],budget=lowPower?72:132;
  function acceptSite(x,z,roadside){
   if(Math.abs(x-150)<(roadside?7:11)||Math.abs(z-150)<(roadside?0:11))return false;
   if(map.farms.some(f=>Math.hypot(f.x-x,f.z-z)<(roadside?10:14)))return false;
   if(map.bases.some(b=>Math.hypot(b.x-x,b.z-z)<(roadside?24:26)))return false;
   return true;
  }
  for(let k=0;k<budget;k++){
   const x=between(10,290),z=between(10,290);
   if(!acceptSite(x,z,false))continue;
   plots.push({x,z,w:between(.65,1.55),angle:between(0,Math.PI*2)});
  }
  for(let k=0;k<(lowPower?140:230);k++){
   const side=k%2?1:-1;
   const x=150+side*between(8.4,24.5),z=between(18,282);
   if(!acceptSite(x,z,true))continue;
   plots.push({x,z,w:between(.65,1.85),angle:between(0,Math.PI*2)});
  }
  const lobes=[
   {id:'hedgerow',shade:'#455e39',dx:0,dz:0,h:.43,sx:1.4,sy:.7,sz:1.06},
   {id:'hedgerow-leaf-west',shade:'#577047',dx:-.48,dz:.31,h:.64,sx:.88,sy:.66,sz:.78},
   {id:'hedgerow-leaf-east',shade:'#3b5637',dx:.55,dz:-.22,h:.58,sx:.83,sy:.61,sz:.85}
  ];
  for(const lobe of lobes){
   const shrubMat=new B.StandardMaterial('hd2026-'+lobe.id+'-mat',scene);
   shrubMat.diffuseColor=B.Color3.FromHexString(lobe.shade);
   shrubMat.specularColor=B.Color3.Black();
   const shrub=B.MeshBuilder.CreateSphere('hd2026-'+lobe.id,
    {diameter:1,segments:5},scene);
   shrub.material=shrubMat;shrub.isPickable=false;shrub.receiveShadows=false;
   const buf=[];
   for(const p of plots){
    const yaw=B.Quaternion.FromEulerAngles(0,p.angle,0);
    const dx=(lobe.dx*Math.cos(p.angle)-lobe.dz*Math.sin(p.angle))*p.w;
    const dz=(lobe.dx*Math.sin(p.angle)+lobe.dz*Math.cos(p.angle))*p.w;
    const matrix=B.Matrix.Compose(new B.Vector3(
     p.w*lobe.sx,p.w*lobe.sy,p.w*lobe.sz),yaw,
     pos(p.x+dx,p.w*lobe.h,p.z+dz));
    buf.push(...matrix.asArray());
   }
   if(buf.length){
    shrub.thinInstanceSetBuffer('matrix',new Float32Array(buf),16,true);
    shrub.thinInstanceRefreshBoundingInfo();
   }
  }
  report.shrubInstances=plots.length;
  report.shrubLobes=lobes.length;
 }catch(error){report.errors.push('hedgerows '+String(error));}
 // Restrained warm light — no extreme color filters, high-cost bloom or SSAO
 // at mobile resolution. Original sun casts PCF shadows where already supported.
 sun.intensity=1.04;
 if(scene.fogMode!==B.Scene.FOGMODE_NONE){
  scene.fogDensity=.0020;
  scene.fogColor=B.Color3.FromHexString('#939a86');
 }
 const config=scene.imageProcessingConfiguration;
 if(config){config.toneMappingEnabled=true;config.exposure=.96;config.contrast=1.105;}
 report.colorGrade='muted-olive-earth-v4';
 report.mipmappedScans=true;report.opaqueHedgerows=true;
 report.roadStyle='dual-ruts-with-meadow-shoulders';
 report.terrainReadability='lightened-earth-with-fallow-belts';
 report.ready=true;
 scene.metadata=scene.metadata||{};
 scene.metadata.battlefieldModernArt=report;
 return report; // Asynchronous local JPG loads increment report.scannedMaterialMaps.
}
return Object.freeze({apply,PROFILE});
});