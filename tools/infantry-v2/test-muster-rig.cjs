'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const skin=fs.readFileSync(path.join(root,'preview/muster-rifleman-rig.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(skin);
const js=loader.match(/<script>([\s\S]*?)<\/script>/);
assert(js,'No game loader script found');new Function(js[1]);
for(const tok of ['THREE.SkinnedMesh','skinWeight','skinIndex','new THREE.Skeleton','mixer.update','musterRiflemanRigDraw']){
  assert(skin.includes(tok),'Missing skeletal-binding step: '+tok);
}
assert(loader.includes('musterRiflemanRigDraw()')&&loader.includes('musterRiflemanRigTick()'),
  'Preview is not wired into game');
console.log('MUSTER_RIG_STATIC_PASS');

if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/muster-rig-qa/node_modules/playwright');
  (async()=>{
    const browser=await chromium.launch({headless:true,
      args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']
    });
    try{
      for(const device of [
        {name:'desktop',viewport:{width:1280,height:840}},
        {name:'mobile-chromium',viewport:{width:390,height:844},
         userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
      ]){
        const context=await browser.newContext({
          viewport:device.viewport,deviceScaleFactor:1,
          ...(device.userAgent?{userAgent:device.userAgent,isMobile:true,hasTouch:true}:{})
        });
        const page=await context.newPage();const exceptions=[],warnings=[];
        page.on('pageerror',e=>{
          if(!/No parent to post message/.test(e.message))exceptions.push(e.message)
        });
        page.on('console',m=>{
          if(m.type()==='error'&&!/No parent to post message/.test(m.text()))
            warnings.push(m.text().slice(0,500));
        });
        await page.goto(
          'http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=muster-rig&armyRig=pilot',
          {waitUntil:'domcontentloaded',timeout:60000}
        );
        await page.waitForFunction(()=>{
          try{return musterRifleRig.ready||!!musterRifleRig.error;}catch(e){return false;}
        },null,{timeout:180000});
        const initial=await page.evaluate(()=>{
          const s=musterRifleRig,r=s.rig;
          if(!r)return{error:s.error};
          const influences={};
          for(const skin of s.skinnedMeshes){
            const geo=skin.geometry,attr=geo.getAttribute('skinWeight');
            const joints=geo.getAttribute('skinIndex');
            for(let i=0;i<Math.min(attr.count,200);i++){
              const sum=attr.getX(i)+attr.getY(i)+attr.getZ(i)+attr.getW(i);
              if(Math.abs(sum-1)>0.003)throw Error('Invalid normalized skin weights');
              for(const k of [joints.getX(i),joints.getY(i),joints.getZ(i),joints.getW(i)]){
                if(k>=r.names.length)throw Error('Bone index out of range: '+k)
              }
            }
            const type=skin.name.replace('MusterSkinned_','');
            influences[type]=attr.count;
          }
          // Source WWII gaiter straps must belong to calves, never torso kit.
          for(const side of ['l','r']){
            const gaiter=s.skinnedMeshes.find(m=>
              m.name==='MusterSkinned_legwear-strap-'+side);
            if(!gaiter)throw Error('Muster gaiter part missing: '+side);
            const indices=gaiter.geometry.getAttribute('skinIndex');
            const weights=gaiter.geometry.getAttribute('skinWeight');
            const intended=r.names.indexOf('calf_'+side);
            if(indices.getX(0)!==intended||weights.getX(0)<.99)
              throw Error('Gaiter not bound to calf_'+side);
          }
          return{
            ready:s.ready,error:s.error,parts:r.parts,vertices:r.vertices,
            triangles:r.triangles,boneNames:r.names,skinMeshes:s.skinnedMeshes.length,
            actionNames:Object.keys(r.actions),current:r.state,influences,
            dimensions:()=>{
              const box=new THREE.Box3().setFromObject(r.group);
              return box.getSize(new THREE.Vector3()).toArray();
            }
          };
        });
        assert(!initial.error,'Skinning or asset load failed: '+JSON.stringify(initial));
        assert(initial.parts>90&&initial.vertices>30000,
          'Source body is incomplete: '+JSON.stringify(initial));
        assert(initial.boneNames.length>=18,'Need articulated fingers/legs core bones');
        assert(initial.actionNames.includes('idle')&&initial.actionNames.includes('jog')
          &&initial.actionNames.includes('sprint'));
        const joints=[];
        for(const [mode,label] of [['idle','Стоит'],['jog','Идёт'],['sprint','Бежит']]){
          await page.locator('button[data-motion="'+mode+'"]').click();
          await page.waitForTimeout(1050);
          const state=await page.evaluate(()=>{
            const r=musterRifleRig.rig;
            r.group.updateMatrixWorld(true);
            const hand=r.nativeBones.get('hand_l').getWorldPosition(new THREE.Vector3());
            const foot=r.nativeBones.get('foot_l').getWorldPosition(new THREE.Vector3());
            const garment=musterRifleRig.skinnedMeshes.find(m=>m.name==='MusterSkinned_tunic');
            let vertex=null;
            if(garment&&garment.geometry.getAttribute('position').count){
              const i=Math.min(110,garment.geometry.getAttribute('position').count-1);
              const pos=new THREE.Vector3().fromBufferAttribute(garment.geometry.getAttribute('position'),i);
              if(garment.boneTransform)garment.boneTransform(i,pos);
              vertex=pos.toArray();
            }
            return{state:r.state,hand:hand.toArray(),foot:foot.toArray(),vertex};
          });
          assert.equal(state.state,mode);
          joints.push({mode,...state});
          await page.screenshot({path:'/tmp/muster-rig-'+device.name+'-'+mode+'.png'});
          // Source-derived visual check, not a synthetic character rendering.
          const jpg=await page.screenshot({type:'jpeg',quality:57});
          console.log('MUSTER_RIG_FRAME_'+device.name.toUpperCase().replace('-','_')+
            '_'+mode.toUpperCase()+' '+jpg.toString('base64'));
        }
        const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
        const footTravel=Math.max(distance(joints[0].foot,joints[1].foot),
          distance(joints[1].foot,joints[2].foot));
        const handTravel=Math.max(distance(joints[0].hand,joints[1].hand),
          distance(joints[1].hand,joints[2].hand));
        assert(footTravel>.005&&handTravel>.005,
          'Rig joints do not respond to idle/jog/sprint: '+JSON.stringify(joints));
        assert(!exceptions.length,'Browser fatal errors: '+JSON.stringify(exceptions));
        console.log('MUSTER_SKINNED_BROWSER_PASS',device.name,
          JSON.stringify({parts:initial.parts,vertices:initial.vertices,triangles:initial.triangles,
            footTravel,handTravel,joints,warnings:warnings.slice(0,4)}));
        await context.close();
      }
    }finally{await browser.close()}
  })().catch(e=>{console.error('MUSTER_SKINNED_BROWSER_FAIL',e.stack||e);process.exitCode=1;});
}
