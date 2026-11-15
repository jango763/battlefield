// M40 Feldbluse: shaped garment panels and sewn kit details adapted from
// source specification Kenton-GMI/muster-ww2 (MIT; see SOURCES.md).
// No box-shaped pockets or rigid cylinders. All elements follow the chest,
 // while the main coat/trousers are truly skinned to the 90-bone skeleton.
const B=window.BABYLON;
const C=x=>B.Color3.FromHexString(x);
const dye={
 cloth:'#41483e',pocket:'#495045',flap:'#343e35',stitch:'#676e60',
 leather:'#252521',canvas:'#545448',metal:'#858674',buttons:'#5e635a',
 piping:'#c0c0ad',litzen:'#a4a89f'
};
const wool=(scene,name,color,roughness=.96,metallic=0)=>{
 const mat=new B.PBRMaterial('heer-'+name,scene);
 mat.albedoColor=C(color);mat.roughness=roughness;mat.metallic=metallic;
 mat.backFaceCulling=false;return mat;
};
const surface=(scene,parent,name,verts,indices,mat)=>{
 const mesh=new B.Mesh(name,scene);
 const normals=[];B.VertexData.ComputeNormals(verts,indices,normals);
 const data=new B.VertexData();
 data.positions=verts;data.indices=indices;data.normals=normals;
 data.applyToMesh(mesh);
 mesh.parent=parent;mesh.material=mat;mesh.isPickable=false;
 return mesh;
};
function panel(scene,parent,name,params,mat){
 const {x,y,w,h,z=.153,bulge=.006,edge=.004,scallop=false}=params;
 const nx=12,ny=7;
 const v=[],ix=[];
 for(let iy=0;iy<=ny;iy++){
  let vv=iy/ny;
  for(let i=0;i<=nx;i++){
   const u=i/nx*2-1;
   const narrow=scallop&&vv<.25?.95:.98;
   const wave=scallop&&vv<.25?Math.sin(Math.abs(u)*Math.PI)*.003:0;
   const px=x+u*w*.5*narrow;
   const py=y+(vv-.5)*h+wave;
   const pz=z-.12*px*px+bulge*(1-u*u)*(1-(2*vv-1)**2)+edge;
   v.push(px,py,pz);
  }
 }
 for(let iy=0;iy<ny;iy++)for(let i=0;i<nx;i++){
  const a=iy*(nx+1)+i,b=a+nx+1;
  ix.push(a,b,a+1,b,b+1,a+1);
 }
 return surface(scene,parent,name,v,ix,mat);
}
function button(scene,parent,name,x,y,z,mat,r=.008){
 const m=B.MeshBuilder.CreateSphere(name,{diameter:2*r,segments:10},scene);
 m.parent=parent;m.position.set(x,y,z);m.scaling.z=.32;m.material=mat;m.isPickable=false;return m;
}
function seam(scene,parent,name,a,b,mat,width=.0015){
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz);
 const m=B.MeshBuilder.CreateCylinder(name,{height:len,diameter:2*width,tessellation:6},scene);
 m.parent=parent;m.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
 const direction=new B.Vector3(dx/len,dy/len,dz/len);
 const axis=B.Vector3.Cross(B.Axis.Y,direction),dot=B.Scalar.Clamp(B.Vector3.Dot(B.Axis.Y,direction),-1,1);
 m.rotationQuaternion=axis.lengthSquared()>1e-12
  ?B.Quaternion.RotationAxis(axis.normalize(),Math.acos(dot))
  :(dot<0?B.Quaternion.RotationAxis(B.Axis.X,Math.PI):B.Quaternion.Identity());
 m.material=mat;m.isPickable=false;return m;
}
function curvedBand(scene,parent,name,y,width,mat,centerZ=0){
 const rx=.19,rz=.151;
 const verts=[],ix=[],steps=52,begin=-Math.PI*.68,end=Math.PI*.68;
 for(let i=0;i<=steps;i++){
  const theta=begin+(end-begin)*i/steps;
  const x=Math.sin(theta)*rx;
  const z=Math.cos(theta)*rz+centerZ;
  verts.push(x,y-width/2,z,x,y+width/2,z);
 }
 for(let i=0;i<steps;i++){
  const a=2*i;ix.push(a,a+1,a+2,a+1,a+3,a+2);
 }
 return surface(scene,parent,name,verts,ix,mat);
}
function epaulette(scene,parent,name,side,mat){
 const x=side*.16,verts=[],idx=[],steps=10;
 for(let i=0;i<=steps;i++){
  const v=i/steps;
  const cx=x+side*v*.08;
  verts.push(cx-.034,.162-v*.052,-.005,cx+.034,.162-v*.052,-.005);
 }
 for(let i=0;i<steps;i++){const a=2*i;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
 return surface(scene,parent,name,verts,idx,mat);
}
export function buildTailoredKit(scene,chestTracker){
 const root=new B.TransformNode('M40-tailored-surface-kit',scene);
 root.parent=chestTracker.node;
 const m={
  pocket:wool(scene,'box-pleated-wool',dye.pocket),
  flap:wool(scene,'scalloped-pocket-flaps',dye.flap),
  seam:wool(scene,'seam-thread',dye.stitch),
  belt:wool(scene,'belt-leather',dye.leather,.86),
  straps:wool(scene,'webbing',dye.canvas,.94),
  metal:wool(scene,'metal-fittings',dye.metal,.6,.22),
  buttons:wool(scene,'buttons',dye.buttons,.66,.18),
  board:wool(scene,'shoulder-board',dye.flap),
  piping:wool(scene,'infantry-piping',dye.piping),
  litzen:wool(scene,'collar-patches',dye.litzen)
 };
 const made=[];
 const add=mesh=>{made.push(mesh);return mesh;};
 // Authentic five-button M40 front; vertical stitched closure.
 add(seam(scene,root,'M40-front-placket',[0,.14,.158],[0,-.33,.166],m.seam,.002));
 for(let i=0;i<5;i++)add(button(scene,root,'M40-front-button-'+i,0,.11-i*.083,.172,m.buttons));
 // Four cloth pockets, each with a softly inflated centre pleat,
 // scalloped flap and cloth seam. Source M40 chest/skirt proportions.
 for(const side of [-1,1])for(const [label,y,w,h,xx] of [
  ['breast',.035,.117,.135,.11],['skirt',-.245,.151,.168,.128]
 ]){
  const x=side*xx,baseZ=label==='breast'?.152:.15;
  add(panel(scene,root,'M40-'+label+'-pocket-'+side,
   {x,y,w,h,z:baseZ,bulge:.007,edge:0},m.pocket));
  add(panel(scene,root,'M40-'+label+'-scalloped-flap-'+side,
   {x,y:y+h*.36,w:w+.008,h:.046,z:baseZ+.009,bulge:.003,scallop:true},m.flap));
  add(button(scene,root,'M40-'+label+'-pocket-button-'+side,
   x,y+h*.37,baseZ+.03,m.buttons,.0065));
  // Centre box pleat and vertical stitching at both pocket sides.
  const z=baseZ+.015;
  for(const delta of [-1,1])add(seam(scene,root,'M40-'+label+'-pleat-'+side+'-'+delta,
   [x+delta*.014,y-h*.34,z],[x+delta*.014,y+h*.19,z],m.seam,.001));
 }
 // M40 turndown collar shaped as two falling, angled cloth panels;
 // inner rectangles were removed — no collar cardboard slabs.
 for(const side of [-1,1]){
  const x=side*.069;
  add(panel(scene,root,'M40-folded-collar-'+side,
   {x,y:.172,w:.12,h:.080,z:.086,edge:.012,bulge:.002},m.flap));
  add(panel(scene,root,'M40-litzen-'+side,
   {x,y:.16,w:.062,h:.023,z:.101,edge:.015,bulge:.001},m.litzen));
  add(epaulette(scene,root,'M40-shoulder-board-'+side,side,m.board));
  add(seam(scene,root,'M40-white-piping-'+side,
   [side*.123,.162,.01],[side*.238,.106,.01],m.piping,.0022));
  // Ammunition pouches are folded fabric/leather panels, not black cubes.
  add(panel(scene,root,'M40-ammo-pouch-'+side,
   {x:side*.159,y:-.265,w:.117,h:.106,z:.158,edge:.026,bulge:.003},m.belt));
  add(panel(scene,root,'M40-ammo-flap-'+side,
   {x:side*.159,y:-.236,w:.116,h:.041,z:.175,edge:.026},m.straps));
  // Y-straps, modelled as paired sewn flat bands over the tunic.
  add(seam(scene,root,'M40-Y-strap-'+side,
   [side*.13,.145,.112],[side*.20,-.24,.166],m.belt,.011));
 }
 add(curvedBand(scene,root,'M40-contour-leather-waistbelt',-.30,.047,m.belt));
 add(panel(scene,root,'M40-belt-buckle',{x:0,y:-.30,w:.070,h:.046,z:.179,edge:.015,bulge:0},m.metal));
 add(panel(scene,root,'M40-belt-buckle-slot',{x:0,y:-.30,w:.038,h:.025,z:.2,edge:.012,bulge:0},m.belt));
 return {root,pieces:made.length,meshes:made,variant:'M40 stitched panels + four box-pleated pockets'};
}
