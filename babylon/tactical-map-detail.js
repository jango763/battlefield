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
   ['#7d8c65','#6e8059',.31], // dry meadow
   ['#a4a07c','#b5af8b',.21], // straw
   ['#4d5c44','#71805b',.27], // undergrowth
   ['#947a63','#9e856c',.19]  // exposed earth
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
  const patchBudget=lowPower?115:205;
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
  mat.diffuseTexture=texture;mat.opacityTexture=texture;
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
  const result={ready:true,style:'tactical-rural-ww2',
   licensedReference:'CC0 Poly Haven ground, original procedurally drawn overlay',
   canvasSize:size,patches,roadVerges,drawCalls:1,collisionChanges:0,
   inputInterception:false};
  scene.metadata=scene.metadata||{};
  scene.metadata.battlefieldOrganicMap=result;
  return result;
 }
 return Object.freeze({apply,seeded});
});
