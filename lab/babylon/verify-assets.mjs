// Zero-dependency offline structural gate for Battlefield Babylon prototype.
// node lab/babylon/verify-assets.mjs
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const readGLB=path=>{
 const b=readFileSync(new URL(path,import.meta.url));
 assert.equal(b.toString('ascii',0,4),'glTF','Invalid GLB header: '+path);
 assert.equal(b.readUInt32LE(4),2,'GLB must be v2: '+path);
 assert.equal(b.readUInt32LE(8),b.length,'Invalid GLB byte length: '+path);
 assert.equal(b.toString('ascii',16,20),'JSON','First GLB chunk must be JSON');
 return JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
};
const model=readGLB('../../assets/native-hero-quaternius/night-striker-lite.glb');
const clips=readGLB('../../assets/native-hero-quaternius/hero-three-clips-lite.glb');
const nodes=model.nodes.map(n=>n.name);
const skin=model.skins?.[0];
assert.ok(skin,'Missing skin');
const joints=skin.joints.map(i=>nodes[i]);
assert.equal(joints.length,65,'Unexpected soldier rig; retargeting must be reviewed');
const chain=(side)=>['spine_03','clavicle_'+side,'upperarm_'+side,'lowerarm_'+side,'hand_'+side];
for(const side of ['l','r']){
 const names=chain(side);
 for(let i=0;i<names.length-1;i++){
  const parent=model.nodes.find(n=>n.name===names[i]);
  const childIndex=model.nodes.findIndex(n=>n.name===names[i+1]);
  assert.ok(parent?.children?.includes(childIndex),names[i]+' must parent '+names[i+1]);
 }
}
assert.deepEqual(clips.animations.map(a=>a.name),['Idle_Loop','Jog_Fwd_Loop','Sprint_Loop']);
for(const a of clips.animations)assert.equal(a.channels.length,195,'Unexpected channel count for '+a.name);
const manifest=JSON.parse(readFileSync(new URL('../../assets/ww2-weapons/manifest.json',import.meta.url),'utf8'));
const mp40=manifest.weapons?.['de-mp40']||Object.entries(manifest.weapons||{}).find(([key,val])=>/mp40/i.test(key+' '+val.file))?.[1];
assert.ok(mp40,'Missing MP40 weapon manifest entry');
for(const field of ['trigger','support','muzzle']){
 assert.ok(Array.isArray(mp40[field])&&mp40[field].length===3&&mp40[field].every(Number.isFinite),'Invalid MP40 '+field);
}
console.log(JSON.stringify({status:'PASS',rigJoints:joints.length,armChains:'left+right',animations:clips.animations.map(a=>a.name),weapon:'MP40',geometry:'metadata only'},null,2));
