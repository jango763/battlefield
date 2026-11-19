#!/usr/bin/env node
/*
 * Experimental REAL skinned Jakeli mesh with Quaternius donor skeleton.
 * No hero mesh is included. No gameplay installation or approval flags.
 * Build on GitHub runner to avoid splitting/uploading binary files.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const ROOT=process.cwd(), sourcePath=path.join(ROOT,"assets/allied-soldiers/uk-jakeli-mobile-static.glb"),
 donorPath=path.join(ROOT,"assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb"),
 outPath=path.join(ROOT,"assets/allied-soldiers/uk-jakeli-prototype-65b.glb");
const EXPECTED="e86dc27fdb763092ad80391ea79c3f83f20c7b81195d2132dc1b68cf3634d7a0";
function parse(file){
 const bytes=fs.readFileSync(file);if(bytes.toString("ascii",0,4)!=="glTF")throw Error("Bad glTF: "+file);
 const length=bytes.readUInt32LE(8);if(bytes.length!==length)throw Error("GLB size mismatch");
 let o=12,doc=null,bin=null;
 while(o<length){const l=bytes.readUInt32LE(o),kind=bytes.readUInt32LE(o+4);o+=8;
  if(kind===0x4e4f534a)doc=JSON.parse(bytes.toString("utf8",o,o+l));
  if(kind===0x004e4942)bin=Buffer.from(bytes.subarray(o,o+l));
  o+=l;
 }
 if(!doc||!bin||doc.buffers?.length!==1)throw Error("Expected embedded single-buffer GLB");
 return {doc,bin,bytes};
}
function readAccessor(asset,id){
 const a=asset.doc.accessors[id]; if(!a||a.sparse)throw Error("Unsupported sparse accessor "+id);
 const v=asset.doc.bufferViews[a.bufferView],shape={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
 const types={5120:[1,"getInt8"],5121:[1,"getUint8"],5122:[2,"getInt16"],5123:[2,"getUint16"],5125:[4,"getUint32"],5126:[4,"getFloat32"]};
 if(!shape||!types[a.componentType])throw Error("Accessor incompatible "+id);
 const [size,method]=types[a.componentType], stride=v.byteStride||shape*size;
 const off=(v.byteOffset||0)+(a.byteOffset||0);
 const d=new DataView(asset.bin.buffer,asset.bin.byteOffset,asset.bin.byteLength),list=[];
 for(let i=0;i<a.count;i++){const row=[];
  for(let c=0;c<shape;c++){let val=d[method](off+i*stride+c*size,true);
   if(a.normalized&&a.componentType!==5126)val=Math.max(-1,val/(a.componentType===5121?255:a.componentType===5123?65535:a.componentType===5120?127:32767));
   row.push(val);}
  list.push(row);
 }
 return list;
}
const src=parse(sourcePath),donor=parse(donorPath),s=src.doc,d=donor.doc;
const {MeshoptSimplifier}=await import("/tmp/jakeli-meshopt/node_modules/meshoptimizer/meshopt_simplifier.js");
await MeshoptSimplifier.ready;
if(crypto.createHash("sha256").update(src.bytes).digest("hex")!==EXPECTED||s.meshes.length!==14||s.skins?.length||s.animations?.length)
 throw Error("Incorrect locked Jakeli GLB");
if(d.skins?.length!==1||d.skins[0].joints?.length!==65||d.animations?.length!==4)
 throw Error("Donor must have one 65-bone skin and four authentic clips");
const clipNames=["Idle_Quaternius","Walk_Quaternius","Jog_Quaternius","Sprint_Quaternius"];
if(clipNames.some(n=>!d.animations.find(a=>a.name===n)))throw Error("Real donor clips missing");

const donorNodeBase=s.nodes.length;
const allBuffers=[src.bin],stats={meshes:0,skinnedVertices:0,skippedSourceRifle:0,missingNeighborhood:0,maxWeightError:0,trianglesBefore:0,trianglesAfter:0,maxMeshSimplifyError:0};
let size=src.bin.length;
function append(data){
 const pad=(4-size%4)%4;
 if(pad){allBuffers.push(Buffer.alloc(pad));size+=pad;}
 const offset=size;allBuffers.push(data);size+=data.length;
 return offset;
}
function addAccessor(data,componentType,type,count,min,max,target=34962){
 const off=append(data);
 const view=s.bufferViews.push({buffer:0,byteOffset:off,byteLength:data.length,target})-1;
 const a={bufferView:view,componentType,type,count};
 if(min)a.min=min;if(max)a.max=max;
 return s.accessors.push(a)-1;
}
// Only genuinely referenced inverse-bind and animation data is retained.
// Do not embed donor meshes, textures or unreferenced bytes in the British GLB.
const donorAccessorMap=new Map(),donorViewMap=new Map(),needed=new Set();
if(d.skins[0].inverseBindMatrices!==undefined)needed.add(d.skins[0].inverseBindMatrices);
for(const anim of d.animations)for(const sampler of anim.samplers){
 needed.add(sampler.input);needed.add(sampler.output);
}
for(const oldIndex of [...needed].sort((a,b)=>a-b)){
 const accessor=d.accessors[oldIndex];
 if(!accessor||accessor.sparse||accessor.bufferView===undefined)
  throw Error("Unsupported donor animation / skin accessor "+oldIndex);
 const oldView=accessor.bufferView;
 if(!donorViewMap.has(oldView)){
  const view=d.bufferViews[oldView];
  if(view.buffer!==0)throw Error("Donor used an external animation buffer");
  const bytes=donor.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
  const offset=append(bytes);
  donorViewMap.set(oldView,s.bufferViews.push({...structuredClone(view),buffer:0,byteOffset:offset})-1);
 }
 const newIndex=s.accessors.push({...structuredClone(accessor),bufferView:donorViewMap.get(oldView)})-1;
 donorAccessorMap.set(oldIndex,newIndex);
}
for(const n of d.nodes){
 const nn=structuredClone(n);
 if(nn.children)nn.children=nn.children.map(i=>i+donorNodeBase);
 delete nn.mesh;delete nn.skin;delete nn.camera;delete nn.weights;
 s.nodes.push(nn);
}
// Only source original British mesh materials are retained in final scene.
const donorSkin=structuredClone(d.skins[0]);
donorSkin.joints=donorSkin.joints.map(i=>i+donorNodeBase);
if(donorSkin.skeleton!==undefined)donorSkin.skeleton+=donorNodeBase;
if(donorSkin.inverseBindMatrices!==undefined)donorSkin.inverseBindMatrices=donorAccessorMap.get(donorSkin.inverseBindMatrices);
s.skins=[donorSkin];
s.animations=d.animations.map(a=>{
 const anim=structuredClone(a);
 for(const samp of anim.samplers){samp.input=donorAccessorMap.get(samp.input);samp.output=donorAccessorMap.get(samp.output);}
 for(const channel of anim.channels)channel.target.node+=donorNodeBase;
 return anim;
});
// Spatial proxy from the *donor's original skinned geometry*, not placeholder
// procedural limbs. The target receives actual normalized skin influences.
const pts=[];
for(const node of d.nodes){
 if(node.skin!==0||node.mesh===undefined)continue;
 const mesh=d.meshes[node.mesh];
 for(const primitive of mesh.primitives){
  const at=primitive.attributes;
  if(at.POSITION===undefined||at.JOINTS_0===undefined||at.WEIGHTS_0===undefined)continue;
  const p=readAccessor(donor,at.POSITION),j=readAccessor(donor,at.JOINTS_0),w=readAccessor(donor,at.WEIGHTS_0);
  for(let k=0;k<p.length;k++){
   const ws={}; for(let z=0;z<4;z++)if(w[k][z]>0)ws[j[k][z]]=(ws[j[k][z]]||0)+w[k][z];
   pts.push({p:p[k],ws});
  }
 }
}
if(pts.length<5000)throw Error("Donor has no usable spatial skin proxy: "+pts.length);
const GRID=0.105,grid=new Map();
const voxel=p=>p.map(x=>Math.floor(x/GRID));
const key=(x,y,z)=>x+","+y+","+z;
for(let i=0;i<pts.length;i++){const [x,y,z]=voxel(pts[i].p),k=key(x,y,z);
 if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);}
function nearest(pos){
 const [cx,cy,cz]=voxel(pos),best=[];
 for(let radius=0;radius<=5;radius++){
  for(let x=cx-radius;x<=cx+radius;x++)for(let y=cy-radius;y<=cy+radius;y++)for(let z=cz-radius;z<=cz+radius;z++){
   if(Math.max(Math.abs(x-cx),Math.abs(y-cy),Math.abs(z-cz))!==radius)continue;
   const ids=grid.get(key(x,y,z)); if(!ids)continue;
   for(const id of ids){const q=pts[id].p,dx=pos[0]-q[0],dy=pos[1]-q[1],dz=pos[2]-q[2],dist=dx*dx+dy*dy+dz*dz;
    if(best.length<4||dist<best[best.length-1].dist){best.push({id,dist});best.sort((a,b)=>a.dist-b.dist);if(best.length>4)best.pop();}}
  }
  if(best.length===4&&best[3].dist<(radius*GRID)*(radius*GRID))break;
 }
 if(best.length===0)throw Error("No nearby donor vertices");
 if(best[0].dist>0.4*0.4)stats.missingNeighborhood++;
 const blended=new Map();
 for(const {id,dist} of best){const influence=1/(0.00002+dist*dist);
  for(const [bone,w] of Object.entries(pts[id].ws))blended.set(+bone,(blended.get(+bone)||0)+w*influence);}
 return [...blended.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
}
const headIndex=donorSkin.joints.findIndex(n=>/(:|^)Head$/.test(s.nodes[n].name));
const torsoIndex=donorSkin.joints.findIndex(n=>/(:|^)Spine1$/.test(s.nodes[n].name));
const leftHandIndex=donorSkin.joints.findIndex(n=>/(:|^)LeftHand$/.test(s.nodes[n].name));
const rightHandIndex=donorSkin.joints.findIndex(n=>/(:|^)RightHand$/.test(s.nodes[n].name));
if([headIndex,torsoIndex,leftHandIndex,rightHandIndex].some(n=>n<0))
 throw Error("Missing head/torso/wrist bones");
const digits={};
for(const side of ["Left","Right"]){
 digits[side]={};
 for(const digit of ["Thumb","Index","Middle","Ring","Pinky"]){
  const chain=[1,2,3].map(seg=>donorSkin.joints.findIndex(
   n=>new RegExp("(:|^)"+side+"Hand"+digit+seg+"$").test(s.nodes[n].name)));
  if(chain.some(i=>i<0))throw Error("Missing donor digit chain "+side+digit);
  digits[side][digit]=chain;
 }
}
const clamp01=x=>Math.max(0,Math.min(1,x));
const ease01=x=>{const t=clamp01(x);return t*t*(3-2*t);};
function blendedFinger(hand,chain,amount,progress){
 // Smoothly distribute influence across anatomically correct finger phalanges,
 // but keep the original palm attached to the actual wrist joint.
 const length=clamp01(progress)*2,low=Math.min(2,Math.floor(length));
 const high=Math.min(2,low+1),blend=ease01(length-low);
 const result=new Map([[hand,1-amount]]);
 result.set(chain[low],(result.get(chain[low])||0)+amount*(1-blend));
 result.set(chain[high],(result.get(chain[high])||0)+amount*blend);
 return [...result].filter(([,w])=>w>1e-6);
}
function gloveSkin(position,sourceVertex){
 const side=position[0]>=0?"Left":"Right", hand=side==="Left"?leftHandIndex:rightHandIndex;
 const extent=Math.abs(position[0]),z=-sourceVertex[1]*.01,y=position[1];
 // The locked Jakeli source has distinguishable fingers in a single hand mesh.
 // Only their genuine source vertex neighborhoods may drive donor finger bones.
 const thumbRegion=ease01((z-.079)/.028)*ease01((.60-extent)/.037)*ease01((.212-y)/.065);
 if(thumbRegion>.001){
  const progress=clamp01((.20-y)/.085);
  return blendedFinger(hand,digits[side].Thumb,Math.max(.001,thumbRegion*.92),progress);
 }
 // Source glove topology includes separate fingertips, but its first
 // finger row begins near |X|=.59. The former .563 origin assigned the
 // middle of almost every finger to distal bones (the "claw" distortion).
 // Follow the three actual phalanges: root .595, middle .617, tip .64.
 const base=ease01((extent-.548)/.076),fingerLength=clamp01((extent-.595)/.045);
 const yMask=ease01((.240-y)/.07);
 const amount=base*yMask*.94;
 if(amount<.001)return [[hand,1]];
 const bands=[["Pinky",-.014],["Ring",.013],["Middle",.043],["Index",.070]];
 const finger=bands.reduce((best,k)=>Math.abs(k[1]-z)<Math.abs(best[1]-z)?k:best,bands[0])[0];
 return blendedFinger(hand,digits[side][finger],amount,fingerLength);
}
// Match original Z-up centimeter geometry into the donor's Y-up meter frame.
// Model ankle height ~0cm -> -1m; head 185cm -> +0.85m.
// The donor rest pose uses hips near 0, feet -1m, head near +1m.
function aligned(v,arm=false,glove=false,sleeve=false){
 const p=[v[0]*.01,v[2]*.01-1,-v[1]*.01];
 if(arm){
  // Align Jakeli's source A-pose limbs to the 65-bone rest skeleton.
  const side=Math.sign(p[0]),t=Math.max(0,Math.min(1,(Math.abs(p[0])-.22)/.43));
  p[0]-=side*.025*t;p[1]+=.17*t;
  if(sleeve){
   // The imported upper sleeve ends ~8cm behind the retargeted Jakeli wrist.
   // Blend the source fabric cuff forward over the distal forearm, leaving
   // shoulder and upper arm fully unchanged; avoid a hard wrist seam.
   const cuff=ease01((Math.abs(p[0])-.365)/.16);
   p[2]+=.085*cuff;
  }
  if(glove){
   // The original hand surface lies behind the donor's finger joint rows.
   // Align the source hand depth while preserving the original topology.
   const thumbRegion=ease01((p[2]-.075)/.045)*
     ease01((.61-Math.abs(p[0]))/.055)*ease01((.215-p[1])/.085);
   p[2]+=.083-.043*thumbRegion;
   p[1]+=.013*t;
  }
 }
 return p;
}
function alignedNormal(v){return [v[0],v[2],-v[1]];}
for(let mi=0;mi<s.meshes.length;mi++){
 const mesh=s.meshes[mi];
 if(/springfield|rifle/i.test(mesh.name)){stats.skippedSourceRifle++;continue;}
 const rigidHead=/helmet|skullcap/i.test(mesh.name);
 const rigidTorso=/belt|bag/i.test(mesh.name);
 const sourceSleeves=/1_T_Shirt/i.test(mesh.name);
 const sourceGloves=/^SLD_1_Material #21_0$/i.test(mesh.name);
 const sourceArms=sourceSleeves||sourceGloves;
 for(const primitive of mesh.primitives){
  if(primitive.mode!==undefined&&primitive.mode!==4)throw Error("Nontriangular source");
  const original=primitive.attributes;
  const p=readAccessor(src,original.POSITION);
  const skinRest=p.map(v=>aligned(v,sourceArms,sourceGloves,sourceSleeves));
  // Shrink oversized Jakeli glove fingertips around each anatomical wrist.
  // Keep cuff vertices in place; do not alter which donor finger bones
  // control the glove's original mesh vertices.
  const tr=skinRest.map(v=>{
   if(!sourceGloves)return v;
   const side=Math.sign(v[0])||1;
   const wrist=[side*.536,.231,.072];
   const taper=ease01((Math.abs(v[0])-.535)/.108);
   const shrink=1-.17*taper;
   const q=wrist.map((x,k)=>x+(v[k]-x)*shrink);
   // Source palms are ~12 cm thick in Y at the cuff, larger than the
   // donor 65-bone hand. Sculpt only the bulk of the palm, NOT its
   // longitudinal finger length, wrist seam, or separate digit centers.
   // Anatomical palm center follows the real donor wrist -> knuckle slope.
   const palmTaper=ease01((Math.abs(v[0])-.510)/.060);
   const palmCenter=.207-.61*clamp01((Math.abs(q[0])-.535)/.112)*.112;
   q[1]=palmCenter+(q[1]-palmCenter)*(1-.28*palmTaper);
   return q;
  });
  const pFlat=new Float32Array(tr.flat()),pBuffer=Buffer.from(pFlat.buffer);
  const min=[0,1,2].map(k=>Math.min(...tr.map(x=>x[k]))),
   max=[0,1,2].map(k=>Math.max(...tr.map(x=>x[k])));
  original.POSITION=addAccessor(pBuffer,5126,"VEC3",p.length,min,max);
  if(original.NORMAL!==undefined){
   const norms=readAccessor(src,original.NORMAL).map((n,i)=>{
    const nn=alignedNormal(n);
    if(sourceGloves){
     const palmTaper=ease01((Math.abs(skinRest[i][0])-.510)/.060);
     // Approximate inverse-transpose of the palm-thickness sculpt.
     nn[1]/=1-.28*palmTaper;
     const len=Math.hypot(...nn)||1;
     return nn.map(x=>x/len);
    }
    return nn;
   });
   const floats=new Float32Array(norms.flat());
   original.NORMAL=addAccessor(Buffer.from(floats.buffer),5126,"VEC3",norms.length);
  }
  if(original.TANGENT!==undefined){
   const tangents=readAccessor(src,original.TANGENT).map(q=>[q[0],q[2],-q[1],q[3]]);
   const floats=new Float32Array(tangents.flat());
   original.TANGENT=addAccessor(Buffer.from(floats.buffer),5126,"VEC4",tangents.length);
  }
  const jointBytes=Buffer.alloc(p.length*4),weightBytes=Buffer.alloc(p.length*16);
  for(let vi=0;vi<tr.length;vi++){
   // Transfer genuine original glove vertices to wrist + articulated digits.
   // Avoid ever assigning all palm vertices to the tip of a single finger.
   const candidate=rigidHead?[[headIndex,1]]:rigidTorso?[[torsoIndex,1]]:
    sourceGloves?gloveSkin(skinRest[vi],p[vi]):nearest(tr[vi]);
   const total=candidate.reduce((x,v)=>x+v[1],0);
   if(!(total>0))throw Error("Unweighted British vertex");
   let weighted=0;
   for(let k=0;k<4;k++){
    const joint=candidate[k]?.[0]||0,weight=(candidate[k]?.[1]||0)/total;
    if(joint>=65)throw Error("Joint out of range");
    jointBytes[vi*4+k]=joint;
    weightBytes.writeFloatLE(weight,(vi*4+k)*4);
    weighted+=weight;
   }
   stats.maxWeightError=Math.max(stats.maxWeightError,Math.abs(1-weighted));
   stats.skinnedVertices++;
  }
  original.JOINTS_0=addAccessor(jointBytes,5121,"VEC4",p.length);
  original.WEIGHTS_0=addAccessor(weightBytes,5126,"VEC4",p.length);
  // Meshoptimizer is an actual topology-preserving simplifier, never random
  // triangle deletion. Retain the source UV/material/weight vertex streams.
  const indices=primitive.indices===undefined?
    Uint32Array.from({length:p.length},(_,k)=>k):
    Uint32Array.from(readAccessor(src,primitive.indices),x=>x[0]);
  const tri=indices.length/3;
  if(!Number.isInteger(tri))throw Error("Invalid British triangle count");
  stats.trianglesBefore+=tri;
  const sourceName=mesh.name||"";
  const ratio=/shoe|bag/i.test(sourceName)?.55:
    /helmet|skullcap/i.test(sourceName)?.96:
    /SLD_1/i.test(sourceName)?.89:.78;
  const desired=Math.floor(indices.length*ratio/3)*3;
  const coords=new Float32Array(tr.flat());
  const [quality,relativeError]=MeshoptSimplifier.simplify(indices,coords,3,desired,.025);
  let optimized=quality,error=relativeError;
  // The relaxed solver may improve polygon budgets for high-poly accessories
  // when the strict manifold solver gets stuck on tiny UV seams.
  if(quality.length>desired*1.12&&/shoe|bag/i.test(sourceName)){
   const [relaxed,relaxedErr]=MeshoptSimplifier.simplifySloppy(indices,coords,3,null,desired,.025);
   if(relaxed.length<quality.length){optimized=relaxed;error=relaxedErr;}
  }
  if(!optimized.length||optimized.length%3!==0||error>.027)
    throw Error("Unacceptable source topology simplification "+sourceName+" error="+error);
  const newIndices=Uint16Array.from(optimized);
  const newBytes=Buffer.from(newIndices.buffer);
  const largest=Math.max(...newIndices);
  primitive.indices=addAccessor(newBytes,5123,"SCALAR",newIndices.length,[0],[largest],34963);
  stats.trianglesAfter+=newIndices.length/3;
  stats.maxMeshSimplifyError=Math.max(stats.maxMeshSimplifyError,error);

 }
 stats.meshes++;
}
if(stats.maxWeightError>0.00001||stats.missingNeighborhood>200||stats.trianglesAfter>65000)
 throw Error("Bad automatic skin transfer: "+JSON.stringify(stats));
// Append British skin nodes alongside existing donor nodes in donor's skinned
// mesh parent space. Preserve donor skeleton transforms and inverse binds.
const parentOf=(id)=>d.nodes.findIndex(n=>n.children?.includes(id));
const template=d.nodes.findIndex(n=>n.skin===0&&n.mesh!==undefined);
if(template<0)throw Error("No donor skinned mesh attachment found");
const templateParent=parentOf(template);
if(templateParent<0)throw Error("Donor mesh node has no parent");
for(let i=0;i<s.meshes.length;i++){
 if(/springfield|rifle/i.test(s.meshes[i].name))continue;
 const base=d.nodes[template];
 const node={name:"Jakeli_"+s.meshes[i].name,mesh:i,skin:0};
 for(const k of ["matrix","rotation","translation","scale"])if(base[k])node[k]=structuredClone(base[k]);
 const id=s.nodes.push(node)-1;
 s.nodes[donorNodeBase+templateParent].children??=[];
 s.nodes[donorNodeBase+templateParent].children.push(id);
}
const sceneIndex=s.scene??0;
s.scenes=[{name:"Jakeli_65B_Prototype",nodes:d.scenes[d.scene??0].nodes.map(i=>i+donorNodeBase)}];
s.scene=0;
s.asset.extras??={};
s.asset.extras.jakeliPrototype={donor:"approved-us-hero-65-bone-quaternius",notGameReady:true,
 originalMeshCount:14,removedEmbeddedSpringfield:stats.skippedSourceRifle,
 noHeroMeshes:true,skinTransfer:"nearest-donor-weight-prototype",requiresVisualAcceptance:true};
s.buffers=[{byteLength:size}];
const json=Buffer.from(JSON.stringify(s),"utf8"),jsonPad=(4-json.length%4)%4;
const jsonChunk=Buffer.concat([json,Buffer.alloc(jsonPad,0x20)]);
const bin=Buffer.concat(allBuffers),binPad=(4-bin.length%4)%4;
const binary=Buffer.concat([bin,Buffer.alloc(binPad)]);
const glb=Buffer.alloc(12+8+jsonChunk.length+8+binary.length);
glb.write("glTF",0,"ascii");glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);
glb.writeUInt32LE(jsonChunk.length,12);glb.writeUInt32LE(0x4e4f534a,16);jsonChunk.copy(glb,20);
const at=20+jsonChunk.length;glb.writeUInt32LE(binary.length,at);glb.writeUInt32LE(0x004e4942,at+4);binary.copy(glb,at+8);
fs.writeFileSync(outPath,glb);
console.log("JAKELI_SKIN_TRANSFER_PROTOTYPE_CREATED",JSON.stringify({...stats,bytes:glb.length,
 textures:s.textures?.length,animations:s.animations.map(a=>a.name),bones:s.skins[0].joints.length,
 sha256:crypto.createHash("sha256").update(glb).digest("hex")}));
