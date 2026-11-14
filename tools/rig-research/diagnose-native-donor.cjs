/**
 * NON-INVASIVE RIG RESEARCH.
 * Instruments existing preview in browser memory. Does not save changed
 * gameplay JS, rebind skeletons, or apply speculative production wrist edits.
 * Goal: measure visible skinned glove vertices, not just hand-bone IK error.
 */
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('/tmp/rig-anatomy-qa/node_modules/playwright');

const STATUS=async (page,scenario)=>{
  const {side,weapon,speed,aim}=scenario;
  await page.evaluate(({side,weapon,speed,aim})=>{
    P.side=side;P.wpn=weapon;P.sv=speed;P.aim=aim;
    const rig=P.germanPreview.nativeRig;
    for(let n=0;n<18;n++)animateGermanSoldier(P,1/60);
  },scenario);
  await page.waitForFunction(({side})=>{
    const r=P?.germanPreview?.nativeRig,w=r?.weapon;
    return side==='blue'?w?.ww2Models?.has('uk-sten'):w?.ww2Models?.has('de-mp40');
  },{side},{timeout:45000});
  return await page.evaluate(({side,weapon,speed,aim})=>{
    P.side=side;P.wpn=weapon;P.sv=speed;P.aim=aim;
    const rig=P.germanPreview.nativeRig;
    for(let n=0;n<30;n++)animateGermanSoldier(P,1/60);
    const u=rig.ww2Uniform;
    const w=rig.weapon;
    const nativeMeshes=u.originalMeshes;
    const donorMeshes=u.donorMeshes.filter(x=>x.mesh.visible).map(x=>x.mesh);
    const activeID=w.activeModelId;
    const vec=(o)=>o.getWorldPosition(new THREE.Vector3());
    const hands=['right','left'];
    const infos={};
    let seenVertices=0,failures=[];
    const norm=n=>n.replace(/_\d+$/,'').replace(/^mixamorig[:_]?/i,'');
    for(const sideName of hands){
      const token=sideName==='left'?'Left':'Right';
      const handBone=u.donorHands[sideName].hand,sourceBone=rig.hands[sideName].hand;
      const grip=vec(sideName==='left'?w.support:w.trigger);
      const native=vec(sourceBone),donor=vec(handBone);
      const p=new THREE.Vector3(),sum=new THREE.Vector3();
      const bb=new THREE.Box3();
      let minDist=Infinity,maxDist=0,count=0,weightSum=0;
      const materialNames=[];
      for(const mesh of donorMeshes){
        mesh.updateWorldMatrix(true,false);
        mesh.skeleton?.update();
        const geom=mesh.geometry,skin=geom.getAttribute('skinIndex'),
          weights=geom.getAttribute('skinWeight'),position=geom.getAttribute('position');
        if(!skin||!weights||!position)continue;
        const mat=mesh.material;
        materialNames.push(Array.isArray(mat)?mat.map(x=>x.name).join(','):mat?.name||mesh.name);
        const step=Math.max(1,Math.ceil(position.count/12000));
        for(let i=0;i<position.count;i+=step){
          const boneIdx=[skin.getX(i),skin.getY(i),skin.getZ(i),skin.getW(i)];
          const vWeights=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
          let selectedWeight=0;
          for(let j=0;j<4;j++){
            const name=norm(mesh.skeleton.bones[boneIdx[j]]?.name||'');
            if(name.startsWith(token+'Hand'))selectedWeight+=vWeights[j];
          }
          if(selectedWeight<.56)continue;
          p.fromBufferAttribute(position,i);
          try{mesh.boneTransform(i,p);}catch(e){failures.push('boneTransform '+e.message);break;}
          p.applyMatrix4(mesh.matrixWorld);
          sum.add(p);bb.expandByPoint(p);
          count++;seenVertices++;
          minDist=Math.min(minDist,p.distanceTo(grip));
          maxDist=Math.max(maxDist,p.distanceTo(grip));
          weightSum+=selectedWeight;
        }
      }
      const center=count?sum.divideScalar(count):null;
      infos[sideName]={
        visibleWeightedHandVertices:count,
        sourceJointToGrip:+native.distanceTo(grip).toFixed(5),
        donorJointToGrip:+donor.distanceTo(grip).toFixed(5),
        bindRotationDifferenceDeg:+THREE.MathUtils.radToDeg(
          sourceBone.getWorldQuaternion(new THREE.Quaternion())
            .angleTo(handBone.getWorldQuaternion(new THREE.Quaternion()))).toFixed(1),
        donorHandSurfaceCentroidToGrip:center?+center.distanceTo(grip).toFixed(4):null,
        closestVisibleHandVertexToGrip:Number.isFinite(minDist)?+minDist.toFixed(4):null,
        farthestVisibleHandVertexToGrip:count?+maxDist.toFixed(4):null,
        handVertexBoundsWorld:count?bb.getSize(new THREE.Vector3()).toArray().map(n=>+n.toFixed(4)):null,
        handCentroidWorld:center?center.toArray().map(n=>+n.toFixed(4)):null,
        gripWorld:grip.toArray().map(n=>+n.toFixed(4)),
        donorJointWorld:donor.toArray().map(n=>+n.toFixed(4)),
        nativeJointWorld:native.toArray().map(n=>+n.toFixed(4)),
        sampleWeight:count?+(weightSum/count).toFixed(3):null
      };
      // Non-persistent debug markers: bright joint vs cyan visual glove mass.
      if(center){
        for(const [label,point,color] of [
          [sideName+'-grip',grip,0xe3ae38],
          [sideName+'-glove-surface',center,0x22d8e8],
          [sideName+'-donor-joint',donor,0xe8374e]
        ]){
          const key='RigLab-'+label;
          let marker=rig.visual.getObjectByName(key);
          if(!marker){
            marker=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),
              new THREE.MeshBasicMaterial({color,depthTest:false}));
            marker.name=key;marker.renderOrder=999;rig.visual.add(marker);
          }
          marker.position.copy(rig.visual.worldToLocal(point.clone()));
          marker.visible=true;
        }
      }
    }
    const map=(mesh)=>mesh?.skeleton?.bones.map(x=>norm(x.name))||[];
    const orig=map(nativeMeshes[0]),donor=map(donorMeshes[0]);
    const shared=orig.filter(x=>donor.includes(x));
    const info={
      side,weapon,speed,aim,activeID,sourceBoneCount:orig.length,
      donorBoneCount:donor.length,boneNameOverlap:shared.length,
      skinnedSourceMeshCount:nativeMeshes.length,
      visibleSourceMeshCount:nativeMeshes.filter(m=>m.visible).length,
      visibleDonorMeshes:donorMeshes.map(mesh=>({name:mesh.name,
        tris:mesh.geometry.index?.count/3||mesh.geometry.attributes.position.count/3})),
      wardrobeMatchedBones:u.matchedBones,extraPalm:!!rig.weapon.supportPalm,
      debug:isFinite(infos.left?.donorHandSurfaceCentroidToGrip),
      handInfo:infos,failures
    };
    return info;
  },scenario);
};
(async()=>{
 const browser=await chromium.launch({headless:true,
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
 try{
  for(const device of [
    {name:'desktop',viewport:{width:1280,height:800}},
    {name:'mobile',viewport:{width:390,height:844}}
  ]){
   const page=await browser.newPage({viewport:device.viewport});
   page.on('pageerror',e=>{
      if(!/No parent to post message/.test(e.message))
        console.log('PAGEERROR',device.name,e.message);
   });
   await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=hands&armyRig=off',
     {waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>{
     try{return germanPreview.startupHeroReady==='native'&&
       P?.germanPreview?.nativeRig?.ww2Uniform?.donorHands}
     catch(e){return false;}
   },null,{timeout:120000});
   let n=0;
   for(const side of ['blue','red']){
     for(const pose of [{name:'idle',speed:0,aim:0},{name:'aim',speed:0,aim:1},
                        {name:'jog',speed:3.2,aim:0}]){
       const obj={side,weapon:1,speed:pose.speed,aim:pose.aim};
       const result=await STATUS(page,obj);
       assert(result.visibleDonorMeshes.length>0,'donor not present');
       assert(!result.visibleSourceMeshCount,'double visible original body');
       // A green test outcome here is only about data capture, NOT appearance!
       assert(result.handInfo.left&&result.handInfo.right,'missing hand data');
       console.log('RIG_RESEARCH',device.name,pose.name,JSON.stringify(result));
       if(++n<=6){
         await page.waitForTimeout(150);
         await page.screenshot({path:'/tmp/rig-research-'+device.name+'-'+side+'-'+pose.name+'.png'});
       }
     }
   }
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
