// Stage 5: low fitted maroon beret, no oversized spheres or head-bone twisting.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'preview/german-v5.js'),'utf8');
const wrapper=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(source);
const script=wrapper.match(/<script>([\s\S]*?)<\/script>/);
assert(script,'missing game loader');
new Function(script[1]);
for(const required of [
  'BritishBeretOnePieceFeltCrown',
  'BritishBeretCloseFitBand',
  'BritishBeretSubtleFeltFold',
  'BritishBeretSmallInsignia',
  "beret.userData.profile='airborne-soft-fitted-v4'",
  'beret.userData.bindHeadLocalQ=headLocal.clone()',
  "beret.position.y+=.184",
  'beret.quaternion.copy(headLocal)',
  "beret.visible=ownerSide==='blue'"
])assert(source.includes(required),'beret redesign missing '+required);
assert(!source.includes("add(new THREE.SphereGeometry(1,20,12),felt"),
  'old giant cartoon crown still present');
assert(wrapper.includes('stage5-beret-r4'),'game cache still selects outdated beret');
console.log('STAGE 5 STATIC PASS: low crown, head-bone delta and no old double-sphere');

if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/stage5-qa/node_modules/playwright');
  (async()=>{
    const browser=await chromium.launch({headless:true,
      args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
    const errors=[];
    try{
      for(const device of [
        {name:'desktop',viewport:{width:1280,height:800}},
        {name:'mobile-chromium',viewport:{width:390,height:844},
          userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
      ]){
        const page=await browser.newPage({viewport:device.viewport,
          ...(device.userAgent?{userAgent:device.userAgent}:{})});
        page.on('pageerror',e=>{
          if(!/No parent to post message/.test(e.message))
            errors.push(device.name+': '+e.message);
        });
        await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=british-hero&armyRig=off',
          {waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>{
          try{return germanPreview.startupHeroReady==='native'&&P.side==='blue'&&
            !!P.germanPreview?.nativeRig?.ww2Uniform?.beret?.userData?.bindHeadLocalQ;}
          catch(e){return false;}
        },null,{timeout:120000});
        const data=await page.evaluate(()=>{
          const rig=P.germanPreview.nativeRig,uniform=rig.ww2Uniform,hat=uniform.beret;
          const values={headwearVisible:hat.visible,headwearName:hat.name,
            profile:hat.userData.profile,oldMeshes:0,parts:[],
            geometryBounds:null,boneDeltaApplied:false,
            updatedAfterRun:false,beretFaceDoesNotTwist:false,
            noHelmetOverlap:true,movingState:null,gripError:null};
          hat.traverse(n=>{
            if(n.isMesh){
              values.parts.push(n.name);
              if(n.geometry?.type==='SphereGeometry')values.oldMeshes++;
            }
          });
          const crown=hat.getObjectByName('BritishBeretOnePieceFeltCrown');
          crown.geometry.computeBoundingBox();
          const box=crown.geometry.boundingBox;
          values.geometryBounds=box.getSize(new THREE.Vector3()).toArray();
          const anchor=hat.getWorldPosition(new THREE.Vector3());
          const x=P.x,z=P.z;
          const originalQ=hat.quaternion.clone();
          P.sv=3.3;
          for(let i=0;i<45;i++)animateGermanSoldier(P,1/60);
          values.movingState=rig.state;
          const nextQ=hat.quaternion.clone();
          values.updatedAfterRun=Number.isFinite(nextQ.w);
          values.headRotationDelta=originalQ.angleTo(nextQ);
          values.boneDeltaApplied=!!hat.userData.bindHeadLocalQ;
          const visual=rig.visual,head=uniform.headBone;
          visual.updateWorldMatrix(true,true);
          const headLocal=visual.getWorldQuaternion(new THREE.Quaternion()).invert()
            .multiply(head.getWorldQuaternion(new THREE.Quaternion())).normalize();
          const expected=headLocal.multiply(hat.userData.bindHeadLocalQ.clone().invert());
          values.headOrientationError=expected.angleTo(hat.quaternion);
          values.beretFaceDoesNotTwist=values.headOrientationError<1e-4;
          values.gripError=Math.max(rig.weaponDiagnostics?.leftError||0,
            rig.weaponDiagnostics?.rightError||0);
          P.sv=0;animateGermanSoldier(P,1/60);
          const de=mk('red',false,false);
          values.redInfantryHasNoBeret=de.germanPreview?.nativeRig?.ww2Uniform?.beret?.visible!==true;
          P.side='red';updateNativeHeroFieldUniform(rig);
          values.germanHeroHidesBeret=!hat.visible;
          P.side='blue';updateNativeHeroFieldUniform(rig);
          values.britishHeroRestoresBeret=hat.visible;
          values.noGameplayMove=P.x===x&&P.z===z;
          values.noHelmetOverlap=uniform.donorMeshes.every(m=>m.type!=='headgear'||!m.mesh.visible);
          return values;
        });
        console.log('STAGE 5 GEOMETRY + MOTION DIAGNOSTICS',device.name,JSON.stringify(data));
        assert.equal(data.headwearName,'WW2_British_Maroon_Beret');
        assert.equal(data.profile,'airborne-soft-fitted-v4');
        assert(data.headwearVisible&&data.britishHeroRestoresBeret&&data.germanHeroHidesBeret);
        for(const piece of ['BritishBeretOnePieceFeltCrown','BritishBeretCloseFitBand',
          'BritishBeretSmallInsignia','BritishBeretSubtleFeltFold'])
          assert(data.parts.includes(piece),'beret piece missing: '+piece);
        assert.equal(data.oldMeshes,0,'cartoon-sphere geometry persisted');
        assert(data.geometryBounds[0]<.45&&data.geometryBounds[0]>.25,
          'beret crown too wide '+data.geometryBounds[0]);
        assert(data.geometryBounds[1]<.12&&data.geometryBounds[1]>.04,
          'beret crown too high '+data.geometryBounds[1]);
        assert(data.boneDeltaApplied&&data.beretFaceDoesNotTwist&&data.updatedAfterRun,
          'head-bone orientation is wrong '+JSON.stringify(data));
        assert(data.noHelmetOverlap&&data.redInfantryHasNoBeret,
          'mixed headwear on German soldier / double helmet');
        assert(data.movingState==='jog'&&data.noGameplayMove&&data.gripError<.20,
          'movement or grip exceeds existing walking-pose tolerance');
        if(data.gripError>.12)console.log('KNOWN GRIP LIMITATION: '+device.name+
          ' existing support-hand reach '+data.gripError.toFixed(3)+' m; follow-up stage 8');
        await page.screenshot({path:'/tmp/stage5-beret-'+device.name+'-front.png'});
        await page.evaluate(()=>{
          const previous=cam.updateMatrixWorld.bind(cam);
          cam.updateMatrixWorld=function(force){
            const angle=P.g.rotation.y+Math.PI*.24;
            this.position.set(P.x+Math.sin(angle)*3.65,
              2.98,P.z+Math.cos(angle)*3.65);
            this.lookAt(P.x,2.02,P.z);
            return previous(force);
          };
        });
        await page.waitForTimeout(240);
        await page.screenshot({path:'/tmp/stage5-beret-'+device.name+'-threequarter.png'});
        console.log('STAGE 5 BROWSER PASS',device.name,JSON.stringify(data));
        await page.close();
      }
      assert.equal(errors.length,0,'browser page errors '+errors.join('; '));
    }finally{await browser.close();}
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
