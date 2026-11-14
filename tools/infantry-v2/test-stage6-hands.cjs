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
assert(wrapper.includes("stage6-single-hands-r2"),'stale browser code cache');
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
            !!P?.germanPreview?.nativeRig?.ww2Uniform?.donorHands&&
            P.germanPreview.nativeRig.weapon.ww2Models.has('uk-sten')&&P.side==='blue';}
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
          const supportedWeaponMesh=weapon.ww2Models.has('uk-sten');
          const initialSupportLocal=weapon.support.position.toArray();
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
            faction:P.side,initialWeaponSlot,supportedWeaponMesh,initialSupportLocal,handVisualSource:rig.handVisualSource,
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
        assert(stats.supportedWeaponMesh,'actual STEN GLB model not loaded');
        assert(stats.initialSupportLocal[2]>.30&&stats.initialSupportLocal[2]<.50&&
               stats.initialSupportLocal[1]<.04,
          'British STEN support glove is not below the fore-end: '+
            JSON.stringify(stats.initialSupportLocal));
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
        if(process.argv.includes('--probe')){
          // Visual-only fixture: try alternate fore-end contact points without
          // writing any experimental offsets into production game code.
          await page.evaluate(()=>{
            const original=selectNativeHeroWW2Weapon;
            selectNativeHeroWW2Weapon=function(unit,rig){
              const selected=original(unit,rig);
              const delta=window.__stage6GripProbe;
              if(delta&&unit.kind==='p'&&unit.side==='blue'&&(unit.wpn|0)===1&&
                  rig.weapon.activeModelId==='uk-sten'){
                rig.weapon.support.position.y+=delta.dy;
                rig.weapon.support.position.z+=delta.dz;
              }
              return selected;
            };
          });
          for(const cfg of [
            {label:'A-current',dy:0,dz:0},
            {label:'B-early',dy:.04,dz:.08},
            {label:'C-mid',dy:.055,dz:.12},
            {label:'D-fore',dy:.07,dz:.16},
            {label:'E-outer',dy:.095,dz:.20},
            {label:'F-original',dy:.11,dz:.24}
          ]){
            const grip=await page.evaluate(cfg=>{
              window.__stage6GripProbe=cfg;P.sv=0;P.aim=0;P.wpn=1;
              for(let j=0;j<35;j++)animateGermanSoldier(P,1/60);
              return P.germanPreview.nativeRig.weapon.support.position.toArray();
            },cfg);
            await page.waitForTimeout(250);
            await page.screenshot({path:'/tmp/stage6-grip-'+device.name+'-'+cfg.label+'.png'});
            console.log('STAGE 6 GRIP PROBE',device.name,cfg.label,JSON.stringify(grip));
          }
          // The earlier visual set showed the hand buried in the cuff for
          // near grips. Compare wrist orientations at a middle fore-end point.
          for(const pose of [
            {label:'X0',left:{x:0},right:{x:0}},
            {label:'Xp08',left:{x:.8},right:{x:.8}},
            {label:'Xm08',left:{x:-.8},right:{x:-.8}},
            {label:'Yp08',left:{y:.8},right:{y:.8}},
            {label:'Ym08',left:{y:-.8},right:{y:-.8}},
            {label:'Zp08',left:{z:.8},right:{z:.8}},
            {label:'Zm08',left:{z:-.8},right:{z:-.8}},
            {label:'Xmixed',left:{x:.8},right:{x:-.8}}
          ]){
            await page.evaluate(pose=>{
              window.__stage6GripProbe={dy:.07,dz:.16};
              window.__stage6WristProbe={left:pose.left,right:pose.right};
              P.sv=0;P.aim=0;P.wpn=1;
              for(let j=0;j<35;j++)animateGermanSoldier(P,1/60);
            },pose);
            await page.waitForTimeout(250);
            await page.screenshot({path:'/tmp/stage6-wrist-'+device.name+'-'+pose.label+'.png'});
            console.log('STAGE 6 WRIST PROBE',device.name,pose.label);
          }
        }
        console.log('STAGE 6 BROWSER PASS',device.name,JSON.stringify(stats));
        await page.close();
      }
      assert.equal(issues.length,0,'browser errors: '+issues.join('; '));
    }finally{await browser.close();}
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
