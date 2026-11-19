#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const file="assets/allied-soldiers/uk-jakeli-prototype-65b.glb",bytes=fs.readFileSync(file);
assert.equal(bytes.toString("ascii",0,4),"glTF");
assert.equal(bytes.readUInt32LE(8),bytes.length);
const j=JSON.parse(bytes.toString("utf8",20,20+bytes.readUInt32LE(12)));
assert.equal(j.skins.length,1);
assert.equal(j.skins[0].joints.length,65);
assert.equal(j.animations.length,4);
assert.deepEqual(j.animations.map(x=>x.name),["Idle_Quaternius","Walk_Quaternius","Jog_Quaternius","Sprint_Quaternius"]);
assert.equal(j.meshes.length,14,"The 14 source British mesh definitions must stay preserved");
assert.equal(j.materials.length,14,"The original British material identity must be retained");
assert.equal(j.textures.length,27,"The original textured outfit is required");
assert(j.asset.extras?.jakeliPrototype?.noHeroMeshes);
assert(j.asset.extras?.jakeliPrototype?.notGameReady);
const rigMeshNodes=j.nodes.filter(n=>n.skin===0&&n.mesh!==undefined);
assert.equal(rigMeshNodes.length,13,"Exactly 13 original meshes must be displayed (embedded Springfield excluded)");
const handJointIndices=new Set(j.skins[0].joints.flatMap((nodeId,jointIndex)=>
 /mixamorig:(LeftHand|RightHand)$/.test(j.nodes[nodeId]?.name||"")?[jointIndex]:[]));
assert.equal(handJointIndices.size,2,"Both genuine wrist joints must exist");
const jointNames=j.skins[0].joints.map(n=>j.nodes[n]?.name||"");
const gloveStats={Left:{all:0,articulated:0,thumb:0,digits:new Set(),rootN:0,rootProx:0,rootDistal:0,tipN:0,tipDistal:0},Right:{all:0,articulated:0,thumb:0,digits:new Set(),rootN:0,rootProx:0,rootDistal:0,tipN:0,tipDistal:0}};
const cuffSeam={Left:{glove:[],sleeve:[]},Right:{glove:[],sleeve:[]}};
const palmLayerY={Left:[],Right:[]};
let gloveVertexCount=0;
let skinned=0,vertices=0,triangles=0;
for(const node of rigMeshNodes){
 assert(!/springfield|rifle/i.test(j.meshes[node.mesh].name),"Original embedded rifle must not conflict with weapons");
 for(const p of j.meshes[node.mesh].primitives){
  const at=p.attributes;
  for(const k of ["POSITION","NORMAL","JOINTS_0","WEIGHTS_0"])assert(Number.isInteger(at[k]),"Missing "+k);
  const a=j.accessors[at.POSITION],weights=j.accessors[at.WEIGHTS_0],joints=j.accessors[at.JOINTS_0];
  assert.equal(a.count,weights.count);assert.equal(a.count,joints.count);
  assert.equal(weights.componentType,5126);assert.equal(joints.componentType,5121);
  const wview=j.bufferViews[weights.bufferView],jview=j.bufferViews[joints.bufferView],
   bin=20+bytes.readUInt32LE(12)+8,wm=(wview.byteOffset||0)+(weights.byteOffset||0),
   jm=(jview.byteOffset||0)+(joints.byteOffset||0);
  const srcName=j.meshes[node.mesh].name;
  const isGlove=/^SLD_1_Material #21_0$/.test(srcName);
  const isSleeve=/1_T_Shirt/.test(srcName);
  const pv=j.bufferViews[a.bufferView],posBase=bin+(pv.byteOffset||0)+(a.byteOffset||0);
  for(let i=0;i<a.count;i++){
   const pOff=posBase+i*12;
   const px=bytes.readFloatLE(pOff);
   const xAbs=Math.abs(px);
   const seamSide=px>=0?"Left":"Right";
   if(isGlove&&xAbs>=.555&&xAbs<=.585)
    palmLayerY[seamSide].push(bytes.readFloatLE(pOff+4));
   if(isGlove&&xAbs>=.49&&xAbs<=.525||isSleeve&&xAbs>=.42&&xAbs<=.58){
    const pos=[px,bytes.readFloatLE(pOff+4),bytes.readFloatLE(pOff+8)];
    cuffSeam[seamSide][isGlove?"glove":"sleeve"].push(pos);
   }
   let sum=0;
   for(let c=0;c<4;c++){
    const w=bytes.readFloatLE(bin+wm+i*16+c*4),bone=bytes.readUInt8(bin+jm+i*4+c);
    assert(Number.isFinite(w)&&w>=0&&w<=1,"Malformed weight");
    assert(bone<65,"Invalid bone index");sum+=w;
   }
   assert(Math.abs(sum-1)<0.0001,"Unnormalized British vertex weight");
   if(/^SLD_1_Material #21_0$/.test(j.meshes[node.mesh].name)){
    const pv=j.bufferViews[a.bufferView],po=bin+(pv.byteOffset||0)+(a.byteOffset||0)+i*12;
    const x=bytes.readFloatLE(po);
    const side=x>=0?"Left":"Right",stats=gloveStats[side];
    stats.all++;gloveVertexCount++;
    let articulated=0,thumb=0,fourFingerWeight=0,proximal=0,distal=0;
    for(let k=0;k<4;k++){
     const weight=bytes.readFloatLE(bin+wm+i*16+k*4);
     if(weight<=1e-6)continue;
     const joint=bytes.readUInt8(bin+jm+i*4+k);
     const name=jointNames[joint];
     if(/Hand(Index|Middle|Ring|Pinky)[123]$/.test(name)){
      fourFingerWeight+=weight;
      if(/1$/.test(name))proximal+=weight;
      if(/3$/.test(name))distal+=weight;
     }
     assert(name.startsWith("mixamorig:"+side+"Hand"),
       "British glove vertex is bound to the opposite hand or unrelated joint: "+name);
     if(/Hand(Thumb|Index|Middle|Ring|Pinky)[123]$/.test(name)){
      articulated+=weight;stats.digits.add(name.match(/Hand(Thumb|Index|Middle|Ring|Pinky)/)[1]);
      if(/HandThumb/.test(name))thumb+=weight;
     }
    }
    if(articulated>.12)stats.articulated++;
    // The finger roots must attach to their FIRST phalanx, not collapse
    // toward the third. Use the visible glTF hand mesh, not a fake joint count.
    if(fourFingerWeight>.15){
     const ex=Math.abs(x);
     if(ex>=.587&&ex<=.605){
      stats.rootN++;stats.rootProx+=proximal/fourFingerWeight;
      stats.rootDistal+=distal/fourFingerWeight;
     }
     if(ex>=.63&&ex<=.66){
      stats.tipN++;stats.tipDistal+=distal/fourFingerWeight;
     }
    }
    if(thumb>.12)stats.thumb++;
   }
  }
  vertices+=a.count;skinned++;
  triangles+=(p.indices!==undefined?j.accessors[p.indices].count:a.count)/3;
 }
}
// Verify a REAL mesh-to-mesh wrist seam, not two coincident IK sockets.
const cuffGapReport={};
for(const [side,pair] of Object.entries(cuffSeam)){
 assert(pair.glove.length>60&&pair.sleeve.length>100,"Missing wrist cuff vertices "+side);
 const distances=pair.glove.map(g=>{
  let best=Infinity;
  for(const p of pair.sleeve){
   const d=(g[0]-p[0])**2+(g[1]-p[1])**2+(g[2]-p[2])**2;
   if(d<best)best=d;
  }
  return Math.sqrt(best);
 }).sort((a,b)=>a-b);
 const median=distances[Math.floor(distances.length*.5)];
 const p90=distances[Math.floor(distances.length*.9)];
 // The imported artist mesh had its wrist cuff 0.15-0.17 m below its
 // skeleton joint. Socket-error-only tests never detected this.
 // The real 65-bone donor wrist rests at Y=.231m on either side.
 const cuffY=pair.glove.map(p=>p[1]).sort((a,b)=>a-b);
 const gloveMedianY=cuffY[Math.floor(cuffY.length/2)];
 assert(Math.abs(gloveMedianY-.231)<.060,
   "Jakeli "+side+" glove bind pose disconnected from real wrist Y=.231: "+gloveMedianY);
 assert(median<.026&&p90<.034,
  "Jakeli "+side+" cuff disconnected from glove: median="+median+" p90="+p90);
 cuffGapReport[side]={gloveSamples:pair.glove.length,sleeveSamples:pair.sleeve.length,
  medianGapMeters:median,p90GapMeters:p90,gloveBindMedianYMeters:gloveMedianY};
}
// Catch oversized source mittens: measure the actual sculpted geometry
// in the palm section, away from the sleeve cuff and individual fingertips.
const palmThicknessReport={};
for(const [side,values] of Object.entries(palmLayerY)){
 assert(values.length>=300,"Missing full palm section on "+side);
 values.sort((a,b)=>a-b);
 const p10=values[Math.floor(values.length*.1)];
 const p90=values[Math.floor(values.length*.9)];
 const spread=p90-p10;
 assert(spread>.033&&spread<.053,
  "Jakeli "+side+" glove palm too thick or collapsed: p10-p90="+spread);
 palmThicknessReport[side]={samples:values.length,verticalP10P90Meters:spread};
}
assert(vertices>40000,"A placeholder or partial model is not acceptable");
assert(gloveVertexCount>=3500,"Missing genuine original Jakeli glove geometry");
for(const [side,stat] of Object.entries(gloveStats)){
 assert(stat.all>=1800,"Missing complete source "+side+" glove");
 assert(stat.articulated>=900,"Source "+side+" glove not bound to real finger bones");
 assert(stat.thumb>=80,"Source "+side+" thumb not articulated");
 assert(stat.digits.size===5,"Source "+side+" glove missing articulated digits: "+[...stat.digits]);
 assert(stat.rootN>=140,"Not enough finger-base samples for "+side);
 assert(stat.rootProx/stat.rootN>.25,"Finger roots are incorrectly skinned to distal phalanges "+side);
 assert(stat.rootDistal/stat.rootN<.32,"Excessive distal finger weight at knuckles "+side);
 assert(stat.tipN>=60&&stat.tipDistal/stat.tipN>.32,"Fingertips lost third-phalanx movement "+side);
}
assert(triangles<=65000,"Jakeli must fit the real 65k triangle iPhone limit: "+triangles);
const nodesWithAnimation=new Set();
for(const a of j.animations)for(const ch of a.channels){
 assert(j.skins[0].joints.includes(ch.target.node),"Animation does not target the 65-bone British rig");
 nodesWithAnimation.add(ch.target.node);
}
assert(nodesWithAnimation.size>=20);
console.log("JAKELI_REAL_MESH_RIG_STRUCTURAL_PASS",JSON.stringify({skinnedParts:skinned,
 skinnedVertices:vertices,gloveVertexCount,cuffGapReport,palmThicknessReport,gloveStats:Object.fromEntries(Object.entries(gloveStats).map(([s,v])=>
 [s,{vertices:v.all,articulated:v.articulated,thumb:v.thumb,digits:[...v.digits],
 rootCount:v.rootN,rootProxAvg:v.rootProx/v.rootN,rootDistalAvg:v.rootDistal/v.rootN,
 tipCount:v.tipN,tipDistalAvg:v.tipDistal/v.tipN}])),
 triangles:Math.round(triangles),bones:65,animations:j.animations.map(x=>x.name),
 textures:j.textures.length,bytes:bytes.length,
 sha256:crypto.createHash("sha256").update(bytes).digest("hex"),
 releaseCertified:false,safariCertified:false}));
