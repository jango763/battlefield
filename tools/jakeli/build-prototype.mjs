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
if(crypto.createHash("sha256").update(src.bytes).digest("hex")!==EXPECTED||s.meshes.length!==14||s.skins?.length||s.animations?.length)
 throw Error("Incorrect locked Jakeli GLB");
if(d.skins?.length!==1||d.skins[0].joints?.length!==65||d.animations?.length!==4)
 throw Error("Donor must have one 65-bone skin and four authentic clips");
const clipNames=["Idle_Quaternius","Walk_Quaternius","Jog_Quaternius","Sprint_Quaternius"];
if(clipNames.some(n=>!d.animations.find(a=>a.name===n)))throw Error("Real donor clips missing");

const donorNodeBase=s.nodes.length;
const allBuffers=[src.bin],stats={meshes:0,skinnedVertices:0,skippedSourceRifle:0,missingNeighborhood:0,maxWeightError:0};
let size=src.bin.length;
function append(data){
 const pad=(4-size%4)%4;
 if(pad){allBuffers.push(Buffer.alloc(pad));size+=pad;}
 const offset=size;allBuffers.push(data);size+=data.length;
 return offset;
}
function addAccessor(data,componentType,type,count,min,max){
 const off=append(data);
 const view=s.bufferViews.push({buffer:0,byteOffset:off,byteLength:data.length,target:34962})-1;
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
if(headIndex<0||torsoIndex<0)throw Error("Missing head/torso bones");
// Match original Z-up centimeter geometry into the donor's Y-up meter frame.
// Model ankle height ~0cm -> -1m; head 185cm -> +0.85m.
// The donor rest pose uses hips near 0, feet -1m, head near +1m.
function aligned(v){return [v[0]*.01,v[2]*.01-1,-v[1]*.01];}
function alignedNormal(v){return [v[0],v[2],-v[1]];}
for(let mi=0;mi<s.meshes.length;mi++){
 const mesh=s.meshes[mi];
 if(/springfield|rifle/i.test(mesh.name)){stats.skippedSourceRifle++;continue;}
 const rigidHead=/helmet|skullcap/i.test(mesh.name);
 const rigidTorso=/belt|bag/i.test(mesh.name);
 for(const primitive of mesh.primitives){
  if(primitive.mode!==undefined&&primitive.mode!==4)throw Error("Nontriangular source");
  const original=primitive.attributes;
  const p=readAccessor(src,original.POSITION),tr=p.map(aligned);
  const pFlat=new Float32Array(tr.flat()),pBuffer=Buffer.from(pFlat.buffer);
  const min=[0,1,2].map(k=>Math.min(...tr.map(x=>x[k]))),
   max=[0,1,2].map(k=>Math.max(...tr.map(x=>x[k])));
  original.POSITION=addAccessor(pBuffer,5126,"VEC3",p.length,min,max);
  if(original.NORMAL!==undefined){
   const norms=readAccessor(src,original.NORMAL).map(alignedNormal);
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
   const candidate=rigidHead?[[headIndex,1]]:rigidTorso?[[torsoIndex,1]]:nearest(tr[vi]);
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
 }
 stats.meshes++;
}
if(stats.maxWeightError>0.00001||stats.missingNeighborhood>200)
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
