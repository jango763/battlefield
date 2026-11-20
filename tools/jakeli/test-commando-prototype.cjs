'use strict';
/* Verify distinct authored Commando geometry (not an infantry reskin),
 * untouched 65-bone Quaternius source, and a separate weapon. */
const fs=require('node:fs'),assert=require('node:assert/strict');
function read(file){
 const b=fs.readFileSync(file);assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(8),b.length);
 return JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
}
const id=process.env.COMMANDO_WEAPON||'uk-sten';
const sourcePath='assets/allied-soldiers/uk-jakeli-anatomical-'+(id==='uk-lee-enfield'?'v2':id.replace(/^uk-/,'') )+'.glb';
const source=read(sourcePath);
const outPath='assets/allied-soldiers/uk-commando-'+id.replace(/^uk-/,'')+'-prototype.glb';
const j=read(outPath);
assert.equal(j.skins?.length,1,'One independent skeleton only');
assert.equal(j.skins[0].joints?.length,65,'Exactly 65 bone rig');
const names=(j.meshes||[]).map(x=>x.name||'');
const commandoNames=names.filter(n=>/Commando/i.test(n));
assert(commandoNames.length>40,('Few real custom Commando meshes '+commandoNames.length));
assert(!names.some(n=>/Pants_004|SLD_1_Material|JamesSkullCap|ALL_BAG|Shirt_low|HELMET_HELMET/i.test(n)),
 'Original Jakeli body leaked to Commando prototype');
assert(names.some(x=>/beret/i.test(x)),'Missing Commando beret');
assert(names.some(x=>/crossed P37 strap/i.test(x)),'Missing Commando webbing');
assert(names.some(x=>/battledress body/i.test(x)),'Missing separate Commando uniform');
assert(names.some(x=>/hand glove/i.test(x)),'Missing independent Commando hands');
const meshNames=source.meshes.map(x=>x.name||'');
assert(!commandoNames.some(x=>meshNames.includes(x)),'Mesh copied from infantry');
const anim=(j.animations||[]).map(a=>a.name||'');
for(const n of ['Ready','Aim','Fire','Walk','Jog','Sprint'])assert(anim.includes(n),'Missing '+n);
const jointNames=j.skins[0].joints.map(i=>j.nodes[i].name||'');
for(const name of ['LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot'])
 assert(jointNames.some(x=>x.endsWith(name)),name);
const joints=j.skins[0].joints;
const lower=new Set(joints.filter(i=>/LeftUpLeg|RightUpLeg|LeftLeg|RightLeg|LeftFoot|RightFoot/.test(j.nodes[i].name)));
for(const a of j.animations.filter(x=>['Walk','Jog','Sprint'].includes(x.name)))
 assert(a.channels.some(c=>c.target.path==='rotation'&&lower.has(c.target.node)),
 'Authentic lower-body action missing in '+a.name);
const skinMeshes=j.nodes.filter(n=>n.skin!==undefined&&n.mesh!==undefined);
assert(skinMeshes.length>40,'Only procedural props/no skinning');
assert(!j.asset.extras?.gameApproved,'Prototype must not be released as game-approved');
console.log('COMMANDO_DISTINCT_MODEL_PASS',JSON.stringify({
 id,skinnedMeshes:skinMeshes.length,commandoMeshes:commandoNames.length,
 bones:j.skins[0].joints.length,animations:anim,bytes:fs.statSync(outPath).size,
 status:'experimental pending human iPhone Safari approval'
}));
