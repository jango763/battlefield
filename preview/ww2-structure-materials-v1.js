/* WWII environment materials and scenery for the APPROVED Three.js Battlefield.
 * This is additive visual art only: no new unit models, animation, weapons,
 * camera controls, collision, map economy or gameplay edits.
 * Real image-backed THREE.CanvasTexture maps (not flat material tinting).
 * Tested against Three.js r128, mobile WebKit and Chromium.
 */
(function(){
'use strict';
const report={version:'ww2-world-materials-v2',textures:{},texturedWalls:0,
 texturedRuins:0,texturedPoints:0,texturedBases:0,texturedBunkers:0,
 brokenBeams:0,pineTrees:0,occlusionGroups:0,terrainDetail:'',errors:[]};
window.__BATTLEFIELD_WORLD_ART__=report;
let seed=19450606;
const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const rand=(a,b)=>a+(b-a)*rnd();
const one=a=>a[Math.floor(rnd()*a.length)];
const pick=(a,n)=>a[Math.floor(rnd()*a.length)];
const mobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||
 Math.min(innerWidth,innerHeight)<=800;
function image(name,paint,size=512){
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)throw Error('Missing canvas context for '+name);
 paint(ctx,size);
 const tx=new THREE.CanvasTexture(canvas);
 tx.encoding=THREE.sRGBEncoding;
 tx.wrapS=tx.wrapT=THREE.RepeatWrapping;
 tx.minFilter=THREE.LinearMipmapLinearFilter;
 tx.magFilter=THREE.LinearFilter;
 tx.generateMipmaps=true;
 tx.anisotropy=Math.min(4,R.capabilities.getMaxAnisotropy());
 tx.name='battlefield-ww2-'+name;
 report.textures[name]={width:size,height:size};
 return tx;
}
function noise(ctx,n,palette,opacity=.32,scale=3){
 for(let i=0;i<n;i++){
  ctx.globalAlpha=rand(opacity*.18,opacity);
  ctx.fillStyle=one(palette);
  const x=rand(0,512),y=rand(0,512),r=rand(.35,scale);
  ctx.fillRect(x,y,r*rand(.6,2.5),r*rand(.35,1.7));
 }
 ctx.globalAlpha=1;
}
function wallPaint(ctx){
 // Aged village plaster with exposed red bricks: visible texture at RTS zoom.
 ctx.fillStyle='#b6a58c';ctx.fillRect(0,0,512,512);
 noise(ctx,11200,['#ddd0af','#6e5b4b','#8d8777','#b7a388'],.34,4);
 const scars=[
  {x:20,y:82,rx:115,ry:69},{x:300,y:290,rx:116,ry:96},
  {x:444,y:44,rx:88,ry:64},{x:96,y:423,rx:87,ry:67}
 ];
 for(const mark of scars){
  ctx.save();
  ctx.translate(mark.x,mark.y);
  ctx.scale(mark.rx,mark.ry);
  ctx.fillStyle='#66594d';
  ctx.beginPath();ctx.ellipse(0,0,1.04,1.05,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#9d614d';
  ctx.beginPath();ctx.ellipse(0,0,1,1,0,0,Math.PI*2);ctx.fill();
  ctx.clip();
  ctx.scale(1/mark.rx,1/mark.ry);
  const bx=-mark.rx,by=-mark.ry;
  for(let row=0;row<15;row++){
   const stagger=(row%2)*18;
   for(let col=0;col<10;col++){
    const x=bx+col*37-stagger,y=by+row*20;
    ctx.fillStyle='#594c41';ctx.fillRect(x,y,35,18);
    ctx.fillStyle=pick(['#a65e4a','#b66c51','#914e40','#b17a5c','#8a5544'],col+row);
    ctx.fillRect(x+1,y+1,33,16);
    ctx.fillStyle='rgba(252,220,172,.12)';ctx.fillRect(x+2,y+2,30,2);
   }
  }
  ctx.restore();
  ctx.strokeStyle='rgba(46,43,37,.62)';
  ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(mark.x-mark.rx*.6,mark.y-mark.ry*.9);
  ctx.lineTo(mark.x-mark.rx*.82,mark.y-mark.ry*.2);
  ctx.lineTo(mark.x-mark.rx*.52,mark.y+mark.ry*.35);
  ctx.lineTo(mark.x-mark.rx*.64,mark.y+mark.ry*.8);ctx.stroke();
 }
 // Bullet impacts, damaged plaster and hairline cracks.
 for(let i=0;i<48;i++){
  const x=rand(0,512),y=rand(0,512),r=rand(1.2,5.4);
  ctx.fillStyle='rgba(43,37,31,.48)';
  ctx.beginPath();ctx.ellipse(x,y,r*1.4,r,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(227,211,179,.7)';ctx.lineWidth=.8;
  ctx.beginPath();ctx.arc(x+.7,y+.6,r*1.5,-.4,Math.PI*.7);ctx.stroke();
 }
 const soot=ctx.createLinearGradient(0,0,0,512);
 soot.addColorStop(0,'rgba(37,34,30,.22)');
 soot.addColorStop(.55,'rgba(0,0,0,0)');
 soot.addColorStop(1,'rgba(50,44,33,.25)');
 ctx.fillStyle=soot;ctx.fillRect(0,0,512,512);
}
function brickPaint(ctx){
 ctx.fillStyle='#665f56';ctx.fillRect(0,0,512,512);
 const height=32,width=76;
 for(let row=0;row<16;row++){
  const offset=(row%2)*38;
  for(let x=-width;x<512+width;x+=width){
   const px=x+offset+2,py=row*height+2;
   ctx.fillStyle=one(['#a56650','#ad6b50','#8d5246','#bd785d','#8c594a']);
   ctx.fillRect(px,py,width-4,height-4);
   ctx.fillStyle='rgba(234,196,146,.2)';ctx.fillRect(px+1,py+1,width-7,3);
   ctx.fillStyle='rgba(41,33,28,.17)';ctx.fillRect(px+2,py+height-9,width-9,4);
  }
 }
 noise(ctx,9500,['#e2c1a3','#493c31','#5d4b3e','#c99070'],.27,2.4);
 for(let i=0;i<27;i++){
  const x=rand(0,512),y=rand(0,512);
  ctx.fillStyle='rgba(28,29,27,.36)';
  ctx.beginPath();ctx.arc(x,y,rand(2,11),0,Math.PI*2);ctx.fill();
 }
}
function concretePaint(ctx){
 ctx.fillStyle='#98958a';ctx.fillRect(0,0,512,512);
 noise(ctx,21000,['#d1c8b5','#555c54','#737269','#bbb7ac'],.43,4.2);
 for(let i=0;i<22;i++){
  let x=rand(0,512),y=rand(0,512);
  ctx.strokeStyle='rgba(55,51,48,.43)';ctx.lineWidth=rand(.7,2.3);
  ctx.beginPath();ctx.moveTo(x,y);
  for(let j=0;j<5;j++){x+=rand(-25,25);y+=rand(6,29);ctx.lineTo(x,y);}
  ctx.stroke();
 }
 for(let i=0;i<45;i++){
  ctx.globalAlpha=rand(.04,.16);ctx.fillStyle='#574c3f';
  ctx.fillRect(rand(0,512),rand(0,512),rand(2,35),rand(2,10));
 }
 ctx.globalAlpha=1;
}
function woodPaint(ctx){
 ctx.fillStyle='#4d392a';ctx.fillRect(0,0,512,512);
 for(let plank=0;plank<6;plank++){
  const y=plank*86;
  ctx.fillStyle=one(['#72523a','#685039','#89664a','#705037']);
  ctx.fillRect(0,y+2,512,82);
  ctx.fillStyle='rgba(31,25,22,.42)';ctx.fillRect(0,y+81,512,4);
  for(let j=0;j<75;j++){
   ctx.strokeStyle=one(['rgba(29,23,19,.17)','rgba(206,163,113,.21)','rgba(91,58,34,.31)']);
   ctx.lineWidth=rand(.5,2);
   const ly=rand(y+5,y+80),start=rand(0,512);
   ctx.beginPath();ctx.moveTo(start,ly);ctx.bezierCurveTo(
    start+60,ly+rand(-3,3),start+110,ly+rand(-3,3),start+160,ly);
   ctx.stroke();
  }
  for(const nx of [36,476]){
   ctx.fillStyle='#282420';ctx.beginPath();ctx.arc(nx,y+18,3.5,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='rgba(200,193,165,.55)';
   ctx.beginPath();ctx.arc(nx-1,y+17,1,0,Math.PI*2);ctx.fill();
  }
 }
}
function rubblePaint(ctx){
 ctx.fillStyle='#7f7562';ctx.fillRect(0,0,512,512);
 for(let i=0;i<1950;i++){
  const x=rand(0,512),y=rand(0,512),r=rand(2,18);
  ctx.fillStyle=one(['#c0ae8d','#a78b73','#6f6254','#a1604b','#56544b']);
  ctx.beginPath();ctx.moveTo(x-r,y+r*.3);ctx.lineTo(x,y-r*.6);
  ctx.lineTo(x+r*.9,y+r*.4);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(35,34,30,.23)';ctx.lineWidth=1;ctx.stroke();
 }
 noise(ctx,4900,['#dfcbac','#383631','#9b8473'],.27,3);
}
const sources={
 wall:image('plaster-brick',wallPaint),
 brick:image('burnt-brick',brickPaint),
 concrete:image('weathered-concrete',concretePaint),
 wood:image('splintered-wood',woodPaint),
 rubble:image('broken-masonry',rubblePaint),
 sandbag:image('sandbag-cloth',ctx=>{
  ctx.fillStyle='#b2a17d';ctx.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=4){
   ctx.fillStyle='rgba(85,74,59,.19)';ctx.fillRect(0,y,512,1.4);
  }
  for(let x=0;x<512;x+=5){
   ctx.fillStyle='rgba(215,195,153,.13)';ctx.fillRect(x,0,1.2,512);
  }
  for(let i=0;i<4700;i++){
   const x=rand(0,512),y=rand(0,512),r=rand(.5,3.2);
   ctx.globalAlpha=rand(.06,.26);ctx.fillStyle=one(['#433f34','#e2caa0','#817455']);
   ctx.fillRect(x,y,r,r);
  }
  ctx.globalAlpha=1;
 })
};
function mat(key,{bumpScale=.035,tint=0xffffff}={}){
 const tex=sources[key];
 const m=new THREE.MeshStandardMaterial({map:tex,color:tint,
  roughness:.97,metalness:0,side:THREE.DoubleSide,
  bumpMap:tex,bumpScale});
 m.name='WWII-textured-'+key;
 return m;
}
const material={
 wall:mat('wall',{bumpScale:.033}),
 brick:mat('brick',{bumpScale:.052}),
 concrete:mat('concrete',{bumpScale:.02}),
 wood:mat('wood',{bumpScale:.04}),
 rubble:mat('rubble',{bumpScale:.035}),
 black:new THREE.MeshLambertMaterial({color:0x262720}),
 iron:new THREE.MeshStandardMaterial({color:0x44463f,metalness:.65,roughness:.82})
};
window.__BF_WORLD_MATERIALS__=material;
// Capture the original material before assigning an image. Asset-authored
// model uniforms and skeleton meshes are never modified by these hooks.
function skinBuildingMesh(mesh,key,{keepColor=false}={}){
 if(!mesh?.isMesh||!mesh.material||mesh.isSkinnedMesh)return false;
 const original=mesh.material;
 if(Array.isArray(original))return false;
 // Some site materials are shared by the objective's ownership callback.
 // Mutate the SAME material instance so flag/capture recoloring still works.
 original.map=sources[key];
 original.bumpMap=sources[key];
 original.bumpScale=key==='wood'?.035:.028;
 if(!keepColor&&original.color)original.color.setHex(0xffffff);
 original.needsUpdate=true;
 return true;
}
window.__BF_WORLD_TEXTURE_SITES__=function({points=[],bunkers=[],bases=[]}={}){
 try{
  for(const site of points){
   const meshes=site?.g?.children||[];
   let cnt=0;
   for(const mesh of meshes){
    const hex=mesh.material?.color?.getHex?.();
    const kind={
     0xc79a5a:'wall',0x8a7a5a:'wall',0x8e8e8a:'concrete',
     0xa8793e:'wood',0x5a4a3a:'wood',0x2a2218:'wood',
     0xc9b07a:'sandbag'
    }[hex];
    if(kind&&skinBuildingMesh(mesh,kind,
      {keepColor:hex===0x8e8e8a})){cnt++;}
   }
   if(cnt)report.texturedPoints++;
   // Site walls now show actual masonry maps, while its capture ring,
   // material recoloring and gold-production code are untouched.
  }
  for(const base of bases){
   let cnt=0;
   for(const mesh of (base?.children||[])){
    const hex=mesh.material?.color?.getHex?.();
    const kind={0x6a5a40:'concrete',0xb59d6a:'wall',
      0xa08a5c:'wood',0xcdb98a:'sandbag',0x8a6a3a:'wood',
      0x7a5a2e:'wood',0x1c1812:'wood',0xa89868:'sandbag'}[hex];
    if(kind&&skinBuildingMesh(mesh,kind)){cnt++;}
   }
   if(cnt)report.texturedBases++;
  }
  for(const bunker of bunkers){
   let cnt=0;
   for(const mesh of (bunker?.g?.children||[])){
    const hex=mesh.material?.color?.getHex?.();
    const kind={0xa8925f:'concrete',0x8a8c88:'concrete',
      0x8f7a4e:'wood',0x77797a:'concrete',
      0x14120e:'wood'}[hex];
    if(kind&&skinBuildingMesh(mesh,kind)){cnt++;}
   }
   if(cnt)report.texturedBunkers++;
  }
 }catch(error){
  report.errors.push('site art: '+String(error?.message||error));
 }
};
let closeRuins=[],lastCutaway=0;
const faded=new Map();
const fadeCopies=new WeakMap();
function dimMaterial(original){
 let m=fadeCopies.get(original);
 if(!m){
  m=original.clone();
  m.transparent=true;m.opacity=.24;m.depthWrite=false;
  m.name='visual-only-see-through-building';
  fadeCopies.set(original,m);
 }
 return m;
}
window.__BF_WORLD_ART_TICK__=function(){
 if(!closeRuins.length||typeof P==='undefined'||!P||!cam)return;
 const now=performance.now();
 if(now-lastCutaway<140)return;
 lastCutaway=now;
 const hx=P.x,hz=P.z;
 const cx=cam.position.x-hx,cz=cam.position.z-hz;
 const cd=Math.max(.01,Math.hypot(cx,cz));
 let n=0;
 for(const group of closeRuins){
  const dx=group.position.x-hx,dz=group.position.z-hz;
  const d=Math.hypot(dx,dz);
  // Standard RTS roof cutaway: fade architecture between the hero and
  // tactical camera, restoring it as soon as the squad moves away.
  const facing=(dx*cx+dz*cz)/(Math.max(.01,d)*cd);
  const transparent=d<16.5&&facing>.22;
  for(const mesh of group.children){
   if(!mesh.isMesh)continue;
   const prior=faded.get(mesh);
   if(transparent&&!prior){
    faded.set(mesh,mesh.material);
    mesh.material=dimMaterial(mesh.material);
   }else if(!transparent&&prior){
    mesh.material=prior;
    faded.delete(mesh);
   }
  }
  if(transparent)n++;
 }
 report.occlusionGroups=n;
};
const previousDecorate=window.__BF_VISUAL_DECORATE_RUINS__;
window.__BF_VISUAL_DECORATE_RUINS__=function(){
 try{
  // Apply actual diffuse/bump textures ONLY to original environment meshes,
  // never to characters or GLB-authored uniforms/textures.
  const ruins=scene.children.filter(g=>g.isGroup&&g.children.length>=16&&
   Math.abs(g.position.x)<60&&Math.abs(g.position.z)<70).slice(0,14);
  closeRuins=ruins;
  for(const g of ruins){
   let changed=0;
   for(const mesh of g.children){
    if(!mesh.isMesh)continue;
    const hex=mesh.material?.color?.getHex?.();
    const table={
     0x9e988a:material.wall,
     0x1a1612:material.black,
     0x8a4a32:material.brick,
     0xb09a78:material.rubble,
     0x5a5240:material.concrete
    };
    const m=table[hex];
    if(m){
     mesh.material=m;
     mesh.receiveShadow=true;
     changed++;
    }
   }
   if(changed)report.texturedRuins++;
   report.texturedWalls+=changed;
   // Broken wooden roof trusses and an exposed steel lintel turn flat
   // blocks into recognizable damaged architecture without changing cover.
   const group=new THREE.Group();
   group.name='visual-only-broken-roof';
   for(let j=0;j<3;j++){
    const beam=new THREE.Mesh(new THREE.BoxGeometry(5.5,.28,.28),material.wood);
    beam.position.set(-1+j*.9,3.6+j*.28,-1.6+j*.66);
    beam.rotation.set(rand(-.1,.1),rand(-.7,.7),rand(-.3,.3));
    beam.castShadow=!mobile;
    group.add(beam);
    report.brokenBeams++;
   }
   const lintel=new THREE.Mesh(new THREE.BoxGeometry(4,.19,.33),material.iron);
   lintel.position.set(1.4,2.8,-2.7);lintel.rotation.z=.08;
   group.add(lintel);
   g.add(group);
  }
  // Original vegetation was dead-black cylinders. Natural conifers on the
  // scene perimeter bring back depth while leaving traversable roads clear.
  const qty=mobile?45:72;
  const trunkGeo=new THREE.CylinderGeometry(.13,.26,2.5,5);
  const leafGeo=new THREE.ConeGeometry(1,3,6);
  const trunks=new THREE.InstancedMesh(trunkGeo,material.wood,qty);
  const crowns=new THREE.InstancedMesh(leafGeo,
   new THREE.MeshLambertMaterial({color:0x455640,flatShading:true}),qty*2);
  trunks.name='visual-only-live-pines-trunks';
  crowns.name='visual-only-live-pines-crowns';
  const dummy=new THREE.Object3D();
  for(let i=0;i<qty;i++){
   const side=i%2?-1:1;
   // Restrict live trees to map margins; tactical line of sight remains open.
   const px=side*rand(45,112),pz=rand(-68,68),height=rand(3.8,6.5);
   dummy.position.set(px,height*.23,pz);
   dummy.rotation.set(0,rand(0,6),0);
   dummy.scale.set(rand(.75,1.1),height/6,rand(.75,1.1));
   dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
   for(let tier=0;tier<2;tier++){
    const j=i*2+tier;
    dummy.position.set(px,height*(tier===0?.67:.98),pz);
    dummy.rotation.set(0,rand(0,6),0);
    dummy.scale.set(height*(tier===0?.50:.35)/3,
     height*(tier===0?.68:.52)/3,height*(tier===0?.50:.35)/3);
    dummy.updateMatrix();crowns.setMatrixAt(j,dummy.matrix);
   }
  }
  trunks.instanceMatrix.needsUpdate=true;
  crowns.instanceMatrix.needsUpdate=true;
  trunks.frustumCulled=crowns.frustumCulled=false;
  scene.add(trunks,crowns);
  report.pineTrees=qty;
  if(previousDecorate)previousDecorate();
 }catch(error){
  report.errors.push(String(error?.message||error));
  console.warn('WWII structure materials fallback',error);
  if(previousDecorate)previousDecorate();
 }
};
})();