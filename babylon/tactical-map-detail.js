/* Battlefield original 300m terrain — organic rural Normandy-style reading.
 * CoH3 is an ART-DIRECTION REFERENCE only. No copied Relic art or assets.
 * Existing Poly Haven CC0 PBR ground stays, geometry is non-pickable and
 * collision-free, economy/objectives/soldier GLBs remain untouched. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldTacticalMapDetail=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const SIZE=300;
 function seeded(seed=20261122){
  let x=seed>>>0;
  return ()=>((x=(Math.imul(1664525,x)+1013904223)>>>0)/4294967296);
 }
 function apply({scene,B,map,lowPower=false}={}){
  if(!scene||!B||map?.size!==SIZE)throw Error('Tactical map needs original 300m battlefield');
  if(typeof document==='undefined')return {ready:false,reason:'No document'};
  const random=seeded(),size=lowPower?768:1024;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const g=canvas.getContext('2d');
  if(!g)throw Error('No canvas context for organic soil and vegetation');
  g.clearRect(0,0,size,size);
  const palettes=[
   ['#829773','#829671',.48], // dry meadow
   ['#b3ad87','#b9ae87',.31], // straw
   ['#59694c','#798a64',.43], // undergrowth
   ['#9e8a71','#a99675',.24]  // exposed earth
  ];
  let patches=0,roadVerges=0;
  function smear(x,z,rx,rz,primary,secondary,alpha){
   const scale=size/SIZE,cx=x*scale,cy=z*scale,r=Math.max(rx,rz)*scale;
   g.save();g.translate(cx,cy);g.scale(rx/Math.max(rx,rz),rz/Math.max(rx,rz));
   const grad=g.createRadialGradient(0,0,0,0,0,r);
   grad.addColorStop(0,primary);
   grad.addColorStop(.50,secondary);
   grad.addColorStop(1,'rgba(0,0,0,0)');
   g.globalAlpha=alpha;g.fillStyle=grad;
   g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.restore();
  }
  // Broad, soft fields create map-scale contrast beyond repetitive mud.
  // Main road geometry is higher than this map pigment and stays readable.
  smear(101,64,43,58,'#728d63','#96a481',.47);
  smear(207,91,43,54,'#708962','#8d9776',.50);
  smear(108,197,52,51,'#829570','#b1ad84',.38);
  smear(214,222,55,52,'#6e805e','#929b79',.47);
  const patchBudget=lowPower?150:235;
  for(let i=0;i<patchBudget;i++){
   const x=8+random()*284,z=8+random()*284;
   if(map.bases.some(b=>Math.hypot(x-b.x,z-b.z)<17))continue;
   if(map.farms.some(f=>Math.hypot(x-f.x,z-f.z)<10))continue;
   const palette=palettes[Math.floor(random()*palettes.length)];
   const radius=2.5+random()*10;
   smear(x,z,radius*(.8+random()),radius*(.5+random()),
    palette[0],palette[1],palette[2]+random()*.12);
   patches++;
  }
  // A measured succession of green/dry road shoulders makes the existing
  // east-west and north-south roads visible from the higher tactical camera.
  // Actual gameplay roads remain above this pigment in world-300.js.
  for(let i=0;i<30;i++){
   const along=17+i*9.0;
   for(const side of [-1,1]){
    const shift=10.5+random()*5;
    smear(150+side*shift,along,2+random()*2.5,
     4.5+random()*5.5,'#657454','#87916c',.23);
    smear(along,150+side*shift,4.5+random()*5,
     2+random()*2.5,'#77805d','#a19b78',.21);
    roadVerges+=2;
   }
  }
  const texture=new B.DynamicTexture('battlefield-organic-ground-layer',
   {width:size,height:size},scene,false);
  texture.getContext().drawImage(canvas,0,0);
  texture.hasAlpha=true;texture.update(false);
  const mat=new B.StandardMaterial('battlefield-organic-ground',scene);
  // Do not double-multiply transparency (alpha from diffuse is sufficient).
  mat.diffuseTexture=texture;
  mat.useAlphaFromDiffuseTexture=true;
  mat.backFaceCulling=false;mat.disableLighting=true;
  mat.specularColor=B.Color3.Black();
  mat.transparencyMode=B.Material.MATERIAL_ALPHABLEND;
  const surface=B.MeshBuilder.CreateGround('battlefield-organic-ground-overlay',
   {width:SIZE,height:SIZE,subdivisions:1},scene);
  surface.position.y=.012;
  surface.material=mat;surface.isPickable=false;
  surface.receiveShadows=false;surface.freezeWorldMatrix();
  surface.metadata={visualOnly:true,noCollision:true,reference:'CoH3-style rural terrain'};
  // Roadside vegetation/stone piles: low-poly instanced scenery, placed
  // outside the road. They give the player actual depth and landmarks in the
  // previously empty 100m corridor. No collision, no shooting interception.
  let hedges=0,stones=0;
  const hedgeMat=new B.StandardMaterial('tactical-hedge-leaf',scene);
  hedgeMat.diffuseColor=B.Color3.FromHexString('#64794d');
  hedgeMat.specularColor=B.Color3.FromHexString('#101510');
  const hedge=B.MeshBuilder.CreateSphere('tactical-hedge-master',
   {diameter:2,segments:7},scene);
  hedge.position.y=-1000;hedge.material=hedgeMat;
  hedge.isPickable=false;hedge.checkCollisions=false;
  const stoneMat=scene.getMaterialByName('hd2026-pitted-stone')||
   new B.StandardMaterial('tactical-stone-fallback',scene);
  if(stoneMat.diffuseColor&&!stoneMat.albedoColor)
   stoneMat.diffuseColor=B.Color3.FromHexString('#8d897a');
  const rubble=B.MeshBuilder.CreateBox('tactical-road-stone-master',
   {width:1.1,height:.55,depth:.8},scene);
  rubble.position.y=-1000;rubble.material=stoneMat;
  rubble.isPickable=false;rubble.checkCollisions=false;
  for(const direction of [-1,1]){
   for(let i=0;i<28;i++){
    const z=42+i*3.35+(random()-.5)*2;
    const x=150+direction*(6.4+random()*6.5);
    if(map.bases.some(b=>Math.hypot(x-b.x,z-b.z)<18))continue;
    const shrub=hedge.createInstance('tactical-road-hedge-'+direction+'-'+i);
    shrub.position.set(x-150,.58+random()*.28,z-150);
    shrub.scaling.set(.7+random()*.85,.34+random()*.33,.65+random()*.7);
    shrub.isPickable=false;shrub.checkCollisions=false;
    hedges++;
    if(i%2===0){
     const rock=rubble.createInstance('tactical-road-rubble-'+direction+'-'+i);
     rock.position.set(x-150+direction*.8,.2,z-150+2.5);
     rock.rotation.y=random()*Math.PI;
     rock.scaling.set(.5+random()*.85,.65+random()*.5,.55+random()*.7);
     rock.isPickable=false;rock.checkCollisions=false;stones++;
    }
   }
  }
  // Narrow, worn two-track military lane. Pixel details are painted ONCE
  // into one WebGL texture; no 1000 separate stones or runtime particle loop.
  // The original passable road and tap-to-walk ground remain intact.
  const roadCanvas=document.createElement('canvas');
  roadCanvas.width=512;roadCanvas.height=1024;
  const c=roadCanvas.getContext('2d');
  if(c){
   c.clearRect(0,0,512,1024);
   c.fillStyle='#b5a584';c.fillRect(0,0,512,1024);
   for(const centre of [155,357]){
    c.beginPath();c.moveTo(centre,0);
    for(let y=0;y<=1024;y+=32)c.lineTo(centre+Math.sin(y*.019+centre)*11,y);
    c.strokeStyle='rgba(66,61,51,.19)';c.lineWidth=34;c.stroke();
    c.beginPath();c.moveTo(centre-25,0);
    for(let y=0;y<=1024;y+=36)c.lineTo(centre-25+Math.sin(y*.021+centre)*10,y);
    c.strokeStyle='rgba(226,210,172,.30)';c.lineWidth=18;c.stroke();
   }
   c.beginPath();c.moveTo(252,0);
   for(let y=0;y<=1024;y+=18)c.lineTo(252+Math.sin(y*.027)*17,y);
   c.strokeStyle='rgba(103,135,76,.58)';c.lineWidth=38;c.stroke();
   for(let i=0;i<1900;i++){
    const x=random()*512,y=random()*1024;
    const centre=Math.abs(x-256);
    if(i%3===0&&centre<50){
     c.fillStyle='rgba(100,136,72,.60)';
     c.fillRect(x,y,1+random()*4,2+random()*12);
    }else{
     c.fillStyle=i%2?'rgba(227,209,174,.38)':'rgba(104,96,79,.20)';
     c.fillRect(x,y,1+random()*5,1+random()*4);
    }
   }
  }
  const roadTexture=new B.DynamicTexture('tactical-two-track-rural-dirt',
   {width:512,height:1024},scene,false);
  roadTexture.getContext().drawImage(roadCanvas,0,0);
  roadTexture.hasAlpha=true;roadTexture.update(false);
  // The old dark scanned soil made the entire camera frame read as mud.
  // A physically lit ALBEDO atlas is deliberately opaque, while we reuse
  // the licensed CC0 mud normal map for close surface relief and roughness.
  const roadMat=new B.PBRMaterial('tactical-road-wear-pbr',scene);
  roadMat.albedoTexture=roadTexture;
  roadMat.albedoColor=B.Color3.White();
  roadMat.metallic=0;roadMat.roughness=.96;
  const sourceRoad=scene.getMaterialByName('hd2026-tracked-earth');
  if(sourceRoad?.bumpTexture)roadMat.bumpTexture=sourceRoad.bumpTexture;
  roadMat.backFaceCulling=false;
  const roadDetail=B.MeshBuilder.CreateGround('tactical-two-track-surface',
   {width:6.7,height:265,subdivisions:1},scene);
  roadDetail.position.y=.054;roadDetail.material=roadMat;
  roadDetail.isPickable=false;roadDetail.checkCollisions=false;
  roadDetail.metadata={visualOnly:true,noCollision:true};
  roadDetail.freezeWorldMatrix();
  // Vegetated road shoulders, with deliberately transparent centre:
  // the two dirt wheel paths and fully working ground picks stay visible.
  // One locally drawn atlas, one extra draw call, zero collision changes.
  const vergeCanvas=document.createElement('canvas');
  vergeCanvas.width=512;vergeCanvas.height=1024;
  const vc=vergeCanvas.getContext('2d');
  if(vc){
   const fade=vc.createLinearGradient(0,0,512,0);
   for(const [p,tint] of [
    [0,'rgba(97,126,71,.73)'],[.14,'rgba(112,139,76,.62)'],
    [.28,'rgba(116,144,89,.39)'],[.36,'rgba(112,133,79,0)'],
    [.64,'rgba(112,133,79,0)'],[.72,'rgba(116,144,89,.39)'],
    [.86,'rgba(112,139,76,.62)'],[1,'rgba(97,126,71,.73)']
   ])fade.addColorStop(p,tint);
   vc.fillStyle=fade;vc.fillRect(0,0,512,1024);
   for(let i=0;i<2400;i++){
    const x=random()*512;
    if(x>185&&x<327)continue;
    const y=random()*1024;
    vc.fillStyle=i%3===0?'rgba(176,169,109,.32)':
     i%3===1?'rgba(64,103,59,.44)':'rgba(137,164,91,.34)';
    vc.fillRect(x,y,1+random()*5,2+random()*16);
   }
  }
  const vergeTex=new B.DynamicTexture('tactical-grassy-road-verges',
   {width:512,height:1024},scene,false);
  vergeTex.getContext().drawImage(vergeCanvas,0,0);
  vergeTex.hasAlpha=true;vergeTex.update(false);
  const vergeMat=new B.StandardMaterial('tactical-verges-lit',scene);
  vergeMat.diffuseTexture=vergeTex;
  vergeMat.useAlphaFromDiffuseTexture=true;
  vergeMat.backFaceCulling=false;vergeMat.disableLighting=true;
  vergeMat.transparencyMode=B.Material.MATERIAL_ALPHABLEND;
  const vergeMesh=B.MeshBuilder.CreateGround('tactical-verges-ground',
   {width:19,height:265,subdivisions:1},scene);
  vergeMesh.position.y=.061;
  vergeMesh.material=vergeMat;vergeMesh.isPickable=false;
  vergeMesh.checkCollisions=false;
  vergeMesh.freezeWorldMatrix();
  vergeMesh.metadata={visualOnly:true,noCollision:true};
  const result={ready:true,style:'tactical-rural-ww2',
   licensedReference:'CC0 Poly Haven ground, original procedurally drawn overlay',
   canvasSize:size,patches,roadVerges,hedges,stones,roadMaterial:'PBR-opaque-dry-earth',
   drawCalls:5,roadSurface:'two-track-gravel-and-grass',roadVergesVisible:true,collisionChanges:0,
   inputInterception:false};
  scene.metadata=scene.metadata||{};
  scene.metadata.battlefieldOrganicMap=result;
  return result;
 }
 return Object.freeze({apply,seeded});
});
