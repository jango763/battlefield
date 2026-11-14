// Stage 6 emergency fix: eliminate duplicated hero palms without touching combat.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'preview/german-v5.js'),'utf8');
const wrapper=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(source);
const boot=wrapper.match(/<script>([\s\S]*?)<\/script>/);
assert(boot,'missing HTML loader');
new Function(boot[1]);
assert(!source.includes('function createNativeSupportPalm('),
  'standalone extra baked palm must be removed entirely');
assert(!source.includes('NativeQuaterniusSupportPalm'),
  'old duplicated palm geometry must not be constructed');
assert(source.includes("rig.handVisualSource='ww2-donor'"));
assert(source.includes(":(side==='right'?-.12:.18)"),
  'British wrists not separately calibrated');
assert(wrapper.includes("stage6-single-hands-r1"),'stale browser code cache');
assert(wrapper.includes("'hands'"),'no hero hands close-up mode');
console.log('STAGE 6 STATIC PASS: standalone spare hand removed; gloves only from donor rig');

if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/stage6-qa/node_modules/playwright');
  (async()=>{
    const issues=[];
    const browser=await chromium.launch({
      headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']
    });
    try{
      for(const device of [
        {name:'desktop',viewport:{width:1280,height:800}},
        {name:'mobile-chromium',viewport:{width:390,height:844},userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
      ]){
        const page=await browser.newPage({viewport:device.viewport,
          ...(device.userAgent?{userAgent:device.userAgent}:{})});
        page.on('pageerror',err=>{
          if(!/No parent to post message/.test(err.message))issues.push(device.name+': '+err.message);
        });
        await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=hands',
          {waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>{
          try{return germanPreview.startupHeroReady==='native'&&
            !!P?.germanPreview?.nativeRig?.ww2Uniform?.donorHands&&P.side==='blue';}
          catch(e){return false;}
        },null,{timeout:120000});
        const stats=await page.evaluate(()=>{
          const rig=P.germanPreview.nativeRig;
          const uniform=rig.ww2Uniform,weapon=rig.weapon;
          const visibleOriginal=uniform.originalMeshes.filter(m=>m.visible).map(m=>m.name);
          const costumes=uniform.donorMeshes.filter(x=>x.mesh.visible);
          const addedHandObjects=[];
          rig.visual.traverse(o=>{
            if(o.isMesh&&(/SupportPalm|SupportGlove|NativeHand/i).test(o.name))
              addedHandObjects.push({name:o.name,visible:o.visible});
          });
          const initialWeaponSlot=P.wpn;
          const start={x:P.x,z:P.z,hp:P.hp};
          const states={};
          const pose=(label,speed,aim,dt=1/60)=>{
            P.sv=speed;P.aim=aim;
            for(let k=0;k<25;k++)animateGermanSoldier(P,dt);
            const left=uniform.donorHands.left.hand.getWorldPosition(new THREE.Vector3());
            const right=uniform.donorHands.right.hand.getWorldPosition(new THREE.Vector3());
            const leftWeapon=weapon.support.getWorldPosition(new THREE.Vector3());
            const rightWeapon=weapon.trigger.getWorldPosition(new THREE.Vector3());
            states[label]={
              state:rig.state,
              nativeLeftError:rig.weaponDiagnostics.leftError,
              nativeRightError:rig.weaponDiagnostics.rightError,
              visibleLeftError:left.distanceTo(leftWeapon),
              visibleRightError:right.distanceTo(rightWeapon),
              extraPalm:!!weapon.supportPalm?.visible,
              gloveMeshes:costumes.length,
              handBoneCount:Object.keys(uniform.donorHands).length
            };
          };
          pose('idle-smg',0,0);
          pose('aim-smg',0,1);
          pose('jog-smg',3.2,0);
          pose('sprint-smg',5.4,0);
          P.sv=0;P.aim=0;
          P.wpn=0;
          pose('rifle',0,0);
          P.wpn=1;
          pose('return-smg',0,0);
          return{
            faction:P.side,initialWeaponSlot,handVisualSource:rig.handVisualSource,
            originalMeshVisible:visibleOriginal,donorVisibleCount:costumes.length,
            extraHandMeshes:addedHandObjects,
            extraSupportPalm:!!weapon.supportPalm,
            triggerName:weapon.trigger.name,states,
            sidecapVisible:!!uniform.cap?.visible,
            beretVisible:!!uniform.beret?.visible,
            gameUnaffected:P.x===start.x&&P.z===start.z&&P.hp===start.hp
          };
        });
        assert.equal(stats.faction,'blue');
        assert.equal(stats.initialWeaponSlot,1,'hand inspect mode does not select Sten slot');
        assert.equal(stats.handVisualSource,'ww2-donor');
        assert.equal(stats.originalMeshVisible.length,0,'underlying Quaternius hands also visible');
        assert.equal(stats.extraHandMeshes.length,0,'floating hand mesh remains');
        assert.equal(stats.extraSupportPalm,false,'extra sculpted palm still exists');
        assert(stats.donorVisibleCount>0,'donor uniform missing');
        assert(stats.beretVisible&&!stats.sidecapVisible,'headwear mixed during hands fix');
        for(const [label,pose] of Object.entries(stats.states)){
          assert.equal(pose.handBoneCount,2,'two donor hands required '+label);
          assert(!pose.extraPalm,'extra palm drawn in '+label);
          assert(Number.isFinite(pose.visibleLeftError)&&Number.isFinite(pose.visibleRightError),
            'bad donor glove IK '+label);
          assert(pose.visibleLeftError<.22&&pose.visibleRightError<.22,
            'gloves detached from weapon '+label+' '+JSON.stringify(pose));
        }
        assert(stats.gameUnaffected,'cosmetic arm fix changed combat attributes');
        await page.screenshot({path:'/tmp/stage6-hands-'+device.name+'-close.png'});
        console.log('STAGE 6 BROWSER PASS',device.name,JSON.stringify(stats));
        await page.close();
      }
      assert.equal(issues.length,0,'browser errors: '+issues.join('; '));
    }finally{await browser.close();}
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
