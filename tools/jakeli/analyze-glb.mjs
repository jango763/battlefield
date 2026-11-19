#!/usr/bin/env node
// Deterministic read-only audit. No substitutes and no changes to GLB.
import fs from "node:fs";
import crypto from "node:crypto";
const inputs = process.argv.slice(2);
if (inputs.length < 2) throw new Error("Usage: node analyze-glb.mjs <jakeli.glb> <donor.glb>");
function inspect(file) {
 const data=fs.readFileSync(file), hash=crypto.createHash("sha256").update(data).digest("hex");
 if(data.toString("utf8",0,4)!=="glTF")throw Error(file+" missing glTF magic");
 const jsonSize=data.readUInt32LE(12), jsonType=data.readUInt32LE(16);
 if(jsonType!==0x4e4f534a)throw Error("First chunk not JSON");
 const j=JSON.parse(data.toString("utf8",20,20+jsonSize));
 const buffers=(j.bufferViews||[]).length;
 const names=(j.nodes||[]).map((n,i)=>({id:i,name:n.name||"",mesh:n.mesh,children:n.children?.length||0,translation:n.translation,scale:n.scale,matrix:n.matrix}));
 const joints=j.skins?.[0]?.joints||[];
 const clips=(j.animations||[]).map(a=>({name:a.name,channels:(a.channels||[]).length,samplers:(a.samplers||[]).length,
  paths:[...new Set((a.channels||[]).map(c=>c.target?.path))],
  targets:[...new Set((a.channels||[]).map(c=>j.nodes[c.target?.node]?.name).filter(Boolean))].slice(0,14)}));
 const bounds=[];
 for(const [mi,m] of (j.meshes||[]).entries()){
  for(const [pi,p] of (m.primitives||[]).entries()){
   const a=j.accessors[p.attributes?.POSITION];
   bounds.push({mesh:mi,meshName:m.name||"",primitive:pi,positions:a?.count,min:a?.min,max:a?.max,
     modes:p.mode??4,skinAttrs:Object.keys(p.attributes||{}).filter(x=>/JOINTS|WEIGHTS/.test(x))});
  }
 }
 return {file,bytes:data.length,sha256:hash,author:j.asset?.extras?.author,
  rights:j.asset?.extras?.license,source:j.asset?.extras?.source,
  meshes:j.meshes?.length||0,skins:j.skins?.length||0,bones:joints.length,
  skinRoot:j.skins?.[0]?.skeleton,skinJointNames:joints.map(id=>j.nodes[id]?.name),
  animations:clips,buffers,accessors:j.accessors?.length||0,
  materials:j.materials?.length||0,textures:j.textures?.length||0,
  bounds,rootScenes:j.scenes,scene:j.scene,nodes:names};
}
const [jakeli,donor]=inputs.map(inspect);
if(jakeli.sha256!=="e86dc27fdb763092ad80391ea79c3f83f20c7b81195d2132dc1b68cf3634d7a0")
 throw Error("Jakeli hash mismatches locked source");
if(jakeli.skins!==0||jakeli.animations.length!==0||jakeli.meshes!==14)
 throw Error("Jakeli is not the approved static source");
if(donor.skins!==1||donor.bones!==65)
 throw Error("Missing actual 65-bone donor rig");
console.log("JAKELI_AUDIT_01_02_PASS");
console.log(JSON.stringify({jakeli:{...jakeli,nodes:jakeli.nodes.slice(0,60)},donor:{...donor,nodes:donor.nodes.filter(n=>n.translation||n.matrix).slice(0,110)}},null,2));
