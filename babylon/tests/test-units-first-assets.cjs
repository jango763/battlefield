'use strict';
/* First-pass structural audit of EXACT binary GLBs used in the iPhone hero lab.
 * Passing GLB and animation metadata does not mean artistic approval.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'babylon/units-first.html'),'utf8');
const js=fs.readFileSync(path.join(root,'babylon/units-first.js'),'utf8');
new Function(js);
assert(html.includes('<script defer src="./units-first.js"></script>'));
assert(js.includes('window.__BF_UNIT_REVIEW__'));
assert(js.includes('hasFallback:false'),'Never show arbitrary soldier as approved');
assert(js.includes('source:spec.source'));
assert(js.includes('container.rootNodes'));
assert(js.includes('pivot.scaling.setAll(scale)'),'Use consistent 1.8m character height');
assert(js.includes('65'),'All soldier models require proper full skeletons');
const sources={
 german:['babylon/animstudio-preview/models/all-combat-run.glb',
  ['Kar98k_Hold','Kar98k_Aim','Kar98k_Fire','Kar98k_Run']],
 american:['assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb',
  ['Idle_Quaternius','Walk_Quaternius','Jog_Quaternius']],
 jakeli:['assets/allied-soldiers/uk-jakeli-battle-lod1.glb',
  ['Ready','Aim','Fire','Walk','Jog']]
};
const results={};
for(const [id,[filename,clips]] of Object.entries(sources)){
 const bytes=fs.readFileSync(path.join(root,filename));
 assert.equal(bytes.toString('ascii',0,4),'glTF',filename);
 assert.equal(bytes.readUInt32LE(4),2,filename+' v2');
 assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB size must be exact');
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 const content=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
 const skel=content.skins||[];
 console.log('SOURCE_GLB_RIGS',id,JSON.stringify({
  skins:skel.length,jointCounts:skel.map(x=>x.joints?.length),
  clips:content.animations?.map(x=>x.name),meshes:content.meshes?.length}));
 assert(skel.length>=1,'A real skin must be present '+filename);
 if(id!=='german')assert.equal(skel.length,1,'Independent allied rig '+filename);
 // The approved German GLB has five skinned uniform/weapon meshes and
 // 68 GLTF joints (65 anatomical + 3 attachments), not one 65-joint skin.
 const expectedJoints=id==='german'?68:65;
 if(id==='german')assert.equal(skel.length,5,'Approved soldier mesh skins changed');
 const rig=skel.find(x=>x.joints?.length===expectedJoints);
 assert(rig,expectedJoints+' source joints missing '+filename);
 const names=(content.animations||[]).map(a=>a.name);
 for(const clip of clips)assert(names.includes(clip),'Absent animation '+clip+' in '+filename);
 const rigs=(content.meshes||[]).flatMap(m=>m.primitives||[])
  .filter(p=>p.attributes?.JOINTS_0!==undefined&&p.attributes?.WEIGHTS_0!==undefined);
 assert(rigs.length>=2,'No real skinned character geometry '+filename);
 const skelNames=rig.joints.map(i=>content.nodes[i]?.name||'');
 const normalized=x=>x.replace(/^mixamorig[:_]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 console.log('SOURCE_GLB_BONE_LABELS',id,JSON.stringify(skelNames.slice(0,28)));
 // The original approved Wehrmacht uses its own authoring convention. Do
 // not rename its bones or impose the incompatible Allied Mixamo labels.
 if(id!=='german')for(const key of ['hips','head','leftarm','leftforearm','lefthand',
  'rightarm','rightforearm','righthand','leftfoot','rightfoot'])
  assert(skelNames.some(n=>normalized(n)===key),
   filename+' missing actual joint '+key);
 // Inspect skinned VERTEX influences, not just joint names: a full skeleton
 // with no hand-weighted geometry was previously misreported as a usable unit.
 const glbBinStart=20+bytes.readUInt32LE(12)+8;
 function readComponent(accessorIndex,vertex,slot){
  const a=content.accessors[accessorIndex];
  if(!a||a.bufferView===undefined)return null;
  const bv=content.bufferViews[a.bufferView],size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a.componentType];
  const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]||1;
  const at=glbBinStart+(bv.byteOffset||0)+(a.byteOffset||0)+vertex*(bv.byteStride||n*size)+slot*size;
  if(at<0||at+size>bytes.length)throw Error('Bad accessor '+accessorIndex);
  switch(a.componentType){
   case 5121:return bytes.readUInt8(at);
   case 5123:return bytes.readUInt16LE(at);
   case 5125:return bytes.readUInt32LE(at);
   case 5126:return bytes.readFloatLE(at);
   case 5120:return bytes.readInt8(at);
   case 5122:return bytes.readInt16LE(at);
   default:return null;
  }
 }
 if(id==='american')console.log('BATTLEFIELD_US_MESH_MANIFEST',JSON.stringify(
  (content.meshes||[]).map((m,i)=>({id:i,name:m.name,
   primitives:m.primitives?.length,
   material:m.primitives?.map(p=>content.materials?.[p.material]?.name||''),
   vertices:m.primitives?.map(p=>content.accessors?.[p.attributes?.POSITION]?.count||0)}))));
 const handWeightVertices={lefthand:0,righthand:0,leftforearm:0,rightforearm:0};
 for(const node of content.nodes||[]){
  if(node.mesh===undefined||node.skin===undefined)continue;
  const attached=content.skins[node.skin];
  if(!attached)continue;
  const skinKeys=attached.joints.map(i=>normalized(content.nodes[i]?.name||''));
  for(const prim of content.meshes[node.mesh]?.primitives||[]){
   const joints=prim.attributes?.JOINTS_0,weights=prim.attributes?.WEIGHTS_0;
   if(joints===undefined||weights===undefined)continue;
   const count=content.accessors[joints].count;
   for(let v=0;v<count;v++){
    const influenced=new Set();
    for(let k=0;k<4;k++){
     if(!(readComponent(weights,v,k)>0))continue;
     const jointId=readComponent(joints,v,k),name=skinKeys[jointId]||'';
     for(const part of Object.keys(handWeightVertices))
      if(name===part||name.startsWith(part+'index')||
       name.startsWith(part+'middle')||name.startsWith(part+'pinky')||
       name.startsWith(part+'ring')||name.startsWith(part+'thumb'))
       influenced.add(part);
    }
    for(const part of influenced)handWeightVertices[part]++;
   }
  }
 }
 console.log('BATTLEFIELD_UNIT_ARM_SKIN_GEOMETRY',id,JSON.stringify(handWeightVertices));
 const tris=(content.meshes||[]).flatMap(m=>m.primitives||[])
  .reduce((sum,p)=>sum+Math.ceil(content.accessors[p.indices]?.count/3||0),0);
 results[id]={bytes:bytes.length,meshes:content.meshes?.length,
  skins:skel.length,bones:expectedJoints,realSkinnedPrimitives:rigs.length,
  triangles:tris,armSkin:handWeightVertices,clips:names.length,extensionsRequired:content.extensionsRequired||[],
  visualApproved:id==='german'};
}
console.log('BATTLEFIELD_UNITS_FIRST_GLB_AUDIT_PASS',JSON.stringify(results));
