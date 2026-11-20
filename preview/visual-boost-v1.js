/* Battlefield original Three.js: visual boost v1.
 * Injected directly after the original ground creation.
 * Intentionally never touches unit AI, movement, camera, controls or weapons.
 * Compatible with Three.js r128, WebKit/iPhone and Chromium.
 */
(function(){
'use strict';
const stats={version:'threejs-visual-boost-v2',base:'original-threejs',
 terrain:'original',terrainSize:null,road:'original',props:0,
 mobile:false,dynamicShadows:false,error:null};
window.__BATTLEFIELD_VISUAL_BOOST__=stats;
try{
 const mobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||
  Math.min(innerWidth,innerHeight)<=800;
 stats.mobile=mobile;
 // In the approved first game, avoid iPhone's costly native 3x pixel ratio.
 // This does NOT change the camera field of view or game dimensions.
 const density=Math.min(window.devicePixelRatio||1,mobile?1.65:2);
 R.setPixelRatio(density);
 R.outputEncoding=THREE.sRGBEncoding;
 R.toneMapping=THREE.ACESFilmicToneMapping;
 R.toneMappingExposure=1.13;
 scene.background.setHex(0x888c82);
 if(scene.fog){scene.fog.color.setHex(0x888b82);scene.fog.near=68;scene.fog.far=176;}
 sun.color.setHex(0xffedcf);
 sun.intensity=1.02;
 // Static real-time sun shadows are desktop-only. Mobile receives cheap
 // baked contact shadows instead, so the existing combat remains responsive.
 if(!mobile){
  R.shadowMap.enabled=true;
  R.shadowMap.type=THREE.PCFSoftShadowMap;
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-70;sun.shadow.camera.right=70;
  sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;
  sun.shadow.camera.near=1;sun.shadow.camera.far=150;
  sun.shadow.bias=-0.00035;
  if('normalBias' in sun.shadow)sun.shadow.normalBias=.02;
  gr.receiveShadow=true;
  stats.dynamicShadows=true;
 }
 let seed=19081945;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const range=(a,b)=>a+(b-a)*random();
 const choose=a=>a[Math.floor(random()*a.length)];
 // One complete non-repeating 1024x768 terrain map. This replaces the old
 // 256px canvas repeated 20x14, whose obvious tiling spoiled the battlefield.
 const c=document.createElement('canvas');
 c.width=1024;c.height=768;
 const x=c.getContext('2d',{alpha:false});
 if(!x)throw Error('The terrain painter could not acquire a 2D context');
 const base=x.createLinearGradient(0,0,920,768);
 base.addColorStop(0,'#95917a');base.addColorStop(.46,'#868b72');
 base.addColorStop(1,'#7e826c');
 x.fillStyle=base;x.fillRect(0,0,c.width,c.height);
 // Broad damp earth and grassy cover patches, visible from the original
 // elevated RTS camera even on an iPhone display.
 for(let i=0;i<760;i++){
  const px=range(0,1024),py=range(0,768),rx=range(12,120),ry=range(5,56);
  const grad=x.createRadialGradient(px,py,0,px,py,rx);
  const col=choose(['125,111,87','69,91,63','119,132,89',
   '111,100,76','172,151,111','87,105,76']);
  grad.addColorStop(0,'rgba('+col+','+range(.10,.34).toFixed(3)+')');
  grad.addColorStop(1,'rgba('+col+',0)');
  x.save();x.translate(px,py);x.scale(1,ry/rx);x.translate(-px,-py);
  x.fillStyle=grad;x.beginPath();x.arc(px,py,rx,0,Math.PI*2);x.fill();
  x.restore();
 }
 // Dirt patches, tiny pale pebbles and clumps of dry grass read as surface
 // texture without producing a costly extra draw call for each detail.
 const fleck=['#55614c','#9d9879','#c0aa7e','#657359','#d3c39a','#75785e'];
 for(let i=0;i<11000;i++){
  const px=range(0,1024),py=range(0,768),r=range(.4,2.8);
  x.globalAlpha=range(.12,.5);
  x.fillStyle=choose(fleck);
  x.fillRect(px,py,r*range(.8,2.3),r*.72);
 }
 for(let i=0;i<1450;i++){
  const px=range(0,1024),py=range(0,768);
  x.strokeStyle=choose(['#7b815f','#9ca080','#596c51','#bca883']);
  x.globalAlpha=range(.18,.4);x.lineWidth=range(.5,1.5);
  x.beginPath();x.moveTo(px,py);x.lineTo(px+range(-4,4),py-range(1,5));x.stroke();
 }
 // Pale worn stones and mineral flecks add the legible texture of the
 // original battlefield without a conspicuous repeating 256px stamp.
 for(let i=0;i<5700;i++){
  const px=range(0,1024),py=range(0,768),r=range(1.3,8.5);
  x.globalAlpha=range(.07,.22);
  x.fillStyle=choose(['#d1c5a8','#484f43','#a6a38d','#786c59']);
  x.beginPath();x.ellipse(px,py,r,r*range(.35,.9),
   range(0,Math.PI),0,Math.PI*2);x.fill();
 }
 x.globalAlpha=1;
 // Scorched shell marks are softly integrated into the soil, rather than
 // drawn as bright rings. Existing 3D craters/trenches stay untouched.
 for(let i=0;i<48;i++){
  const px=range(25,999),py=range(22,746),r=range(9,28);
  const halo=x.createRadialGradient(px,py,0,px,py,r);
  halo.addColorStop(0,'rgba(40,35,30,.38)');
  halo.addColorStop(.45,'rgba(65,54,40,.21)');
  halo.addColorStop(1,'rgba(91,75,54,0)');
  x.globalAlpha=1;x.fillStyle=halo;
  x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill();
 }
 x.globalAlpha=1;
 const texture=new THREE.CanvasTexture(c);
 texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;
 texture.anisotropy=Math.min(4,R.capabilities?.getMaxAnisotropy?.()||1);
 texture.encoding=THREE.sRGBEncoding;
 if(gr.material.map)gr.material.map.dispose();
 gr.material.map=texture;gr.material.needsUpdate=true;
 stats.terrain='single non-repeating hand-painted texture';
 stats.terrainSize=[c.width,c.height];
 // Dedicated road texture keeps the original road locations/geometry;
 // exposed as a function because the unchanged mapExtras() creates roads later.
 window.__BF_VISUAL_ROAD_TEXTURE__=function(){
  const road=document.createElement('canvas');
  road.width=512;road.height=128;
  const ctx=road.getContext('2d');
  ctx.fillStyle='#74654b';ctx.fillRect(0,0,512,128);
  for(let i=0;i<4600;i++){
   ctx.fillStyle=choose(['#4c4336','#8b7658','#a08d65','#5f513c']);
   ctx.globalAlpha=range(.12,.42);
   const px=range(0,512),py=range(0,128);
   ctx.fillRect(px,py,range(.4,4),range(.5,2.1));
  }
  ctx.globalAlpha=.33;
  ctx.strokeStyle='#433c31';ctx.lineWidth=4;
  for(const track of [33,93]){
   ctx.beginPath();ctx.moveTo(0,track);
   for(let px=12;px<=512;px+=12)ctx.lineTo(px,track+Math.sin(px*.036)*2.0);
   ctx.stroke();
  }
  ctx.globalAlpha=1;
  const tx=new THREE.CanvasTexture(road);
  tx.wrapS=tx.wrapT=THREE.RepeatWrapping;
  tx.repeat.set(24,1);
  tx.encoding=THREE.sRGBEncoding;
  tx.anisotropy=Math.min(4,R.capabilities?.getMaxAnisotropy?.()||1);
  stats.road='weathered wheel-rutted dirt';
  return tx;
 };
 // Sparse instanced grass/pebbles: 3 draw calls total, without collisions.
 const weedColors=[0x65724d,0x777a50,0x4b6146];
 const dummy=new THREE.Object3D();
 for(let layer=0;layer<3;layer++){
  const count=mobile?135:235;
  const g=new THREE.ConeGeometry(.22,.85,3);
  const m=new THREE.MeshLambertMaterial({color:weedColors[layer],flatShading:true,side:THREE.DoubleSide});
  const inst=new THREE.InstancedMesh(g,m,count);
  inst.name='visual-only-meadow-'+layer;
  for(let i=0;i<count;i++){
   let px=range(-103,103),pz=range(-68,68);
   if(Math.abs(pz-22)<3||Math.abs(pz+22)<3)pz+=8;
   dummy.position.set(px,.30,pz);
   dummy.rotation.set(range(-.15,.15),range(0,Math.PI*2),range(-.14,.14));
   dummy.scale.set(range(.45,1.65),range(.3,1.3),range(.45,1.6));
   dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate=true;
  inst.frustumCulled=false;inst.castShadow=false;inst.receiveShadow=false;
  scene.add(inst);stats.props+=count;
 }
 // Full-map giant foliage was intentionally avoided: the original soldiers
 // remain immediately visible and the tactical controls are unaffected.
 window.__BF_VISUAL_DECORATE_RUINS__=function(){
  try{
   const groups=scene.children.filter(g=>g.isGroup&&g.children.length>=16&&
    Math.abs(g.position.x)<60&&Math.abs(g.position.z)<70).slice(0,14);
   if(!groups.length)return;
   const shade=document.createElement('canvas');
   shade.width=128;shade.height=128;
   const ctx=shade.getContext('2d');
   const grad=ctx.createRadialGradient(64,64,4,64,64,63);
   grad.addColorStop(0,'rgba(20,22,18,.62)');
   grad.addColorStop(.48,'rgba(23,26,19,.25)');
   grad.addColorStop(1,'rgba(25,25,25,0)');
   ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
   const smap=new THREE.CanvasTexture(shade);
   const geometry=new THREE.PlaneGeometry(1,1);
   geometry.rotateX(-Math.PI/2);
   const shadows=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({
    map:smap,transparent:true,opacity:.5,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1
   }),groups.length);
   shadows.name='visual-only-ruin-contact-shadows';
   for(let i=0;i<groups.length;i++){
    const g=groups[i];
    dummy.position.set(g.position.x+.6,.018,g.position.z+.9);
    dummy.rotation.set(0,g.rotation.y,0);
    dummy.scale.set(16,1,13);
    dummy.updateMatrix();shadows.setMatrixAt(i,dummy.matrix);
    if(!mobile){
     let budget=0;
     g.traverse(n=>{if(n.isMesh&&budget++<11)n.castShadow=true});
    }
   }
   shadows.instanceMatrix.needsUpdate=true;
   shadows.frustumCulled=false;
   scene.add(shadows);stats.props+=groups.length;
   // Weathered fragments near ruined walls; one instanced mesh, no collision.
   const chips=new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(.38,0),
    new THREE.MeshLambertMaterial({color:0x8f8875,flatShading:true}),
    groups.length*9);
   let idx=0;
   for(const group of groups)for(let i=0;i<9;i++){
    dummy.position.set(group.position.x+range(-5,5),
      range(.08,.31),group.position.z+range(-5,5));
    dummy.rotation.set(range(0,3),range(0,6),range(0,3));
    dummy.scale.set(range(.38,1.9),range(.22,.65),range(.42,1.3));
    dummy.updateMatrix();chips.setMatrixAt(idx++,dummy.matrix);
   }
   chips.instanceMatrix.needsUpdate=true;
   chips.frustumCulled=false;
   chips.name='visual-only-broken-masonry';
   scene.add(chips);stats.props+=idx;
  }catch(error){console.warn('Optional ruin dressing skipped',error)}
 };
}catch(error){
 stats.error=String(error?.message||error);
 console.warn('Optional first-game visual boost failed; original game remains playable',error);
}
})();