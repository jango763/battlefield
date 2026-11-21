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
 const rig=skel.find(x=>x.joints?.length===65);
 assert(rig,'65 source joints missing '+filename);
 const names=(content.animations||[]).map(a=>a.name);
 for(const clip of clips)assert(names.includes(clip),'Absent animation '+clip+' in '+filename);
 const rigs=(content.meshes||[]).flatMap(m=>m.primitives||[])
  .filter(p=>p.attributes?.JOINTS_0!==undefined&&p.attributes?.WEIGHTS_0!==undefined);
 assert(rigs.length>=2,'No real skinned character geometry '+filename);
 const skelNames=rig.joints.map(i=>content.nodes[i]?.name||'');
 const normalized=x=>x.replace(/^mixamorig[:_]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 for(const key of ['hips','head','leftarm','leftforearm','lefthand',
  'rightarm','rightforearm','righthand','leftfoot','rightfoot'])
  assert(skelNames.some(n=>normalized(n)===key),
   filename+' missing actual joint '+key);
 const tris=(content.meshes||[]).flatMap(m=>m.primitives||[])
  .reduce((sum,p)=>sum+Math.ceil(content.accessors[p.indices]?.count/3||0),0);
 results[id]={bytes:bytes.length,meshes:content.meshes?.length,
  skins:skel.length,bones:65,realSkinnedPrimitives:rigs.length,
  triangles:tris,clips:names.length,extensionsRequired:content.extensionsRequired||[],
  visualApproved:id==='german'};
}
console.log('BATTLEFIELD_UNITS_FIRST_GLB_AUDIT_PASS',JSON.stringify(results));
