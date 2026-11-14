'use strict';
// Stage 2 release gate. One helmet OR one pilotka per German character,
// proper fitted officer visor, head tracking and British regression safety.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const german=fs.readFileSync(path.join(root,'preview/german-v5.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(german);
assert(german.includes("rig.armyHeadwearChoice==='helmet'"));
assert(german.includes("u.headwear='German M42 steel helmet'"));
assert(german.includes("OfficerCapShortCurvedVisor"));
assert(german.includes("GermanOfficerFieldSidecap_HeadTracked"));
assert(loader.includes("german-visual-classes.js"),'role selection should be available');
console.log('WEHRMACHT_HEADWEAR_STAGE2_STATIC_PASS');
if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/wehrmacht-headwear-qa/node_modules/playwright');
  (async()=>{
    const browser=await chromium.launch({headless:true,args:[
      '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox'
    ]});
    try{
      for(const device of [
        {name:'desktop',viewport:{width:1280,height:800}},
        {name:'mobile-chromium',viewport:{width:390,height:844},
         userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
      ]){
        const context=await browser.newContext({
          viewport:device.viewport,deviceScaleFactor:1,
          ...(device.userAgent?{userAgent:device.userAgent,isMobile:true,hasTouch:true}:{})
        });
        const page=await context.newPage();const errors=[];
        page.on('pageerror',e=>{
          if(!/No parent to post message/.test(e.message))errors.push(e.message);
        });
        await page.goto(
          'http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=classes',
          {waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForFunction(()=>window.__germanRoleGallery?.ready
          && window.__germanRoleGallery.cast.length===6,
          null,{timeout:130000});
        const profiles=[
          ['hero','cloth'],['rifleman','helmet'],['submachinegunner','cloth'],
          ['machinegunner','helmet'],['engineer','helmet'],['captain','cloth']
        ];
        const records=[];
        for(let idx=0;idx<profiles.length;idx++){
          const [expectedRole,kind]=profiles[idx];
          await page.locator('button[data-class-index="'+idx+'"]').click();
          await page.waitForTimeout(170);
          const state=await page.evaluate(()=>{
            const g=window.__germanRoleGallery;
            const rig=g.cast[g.selected].germanPreview.nativeRig;
            const u=rig.ww2Uniform;
            const helmets=u.donorMeshes.filter(o=>o.type==='headgear'&&o.mesh.visible);
            const cap=u.cap;
            const visor=(cap?.children||[]).filter(x=>x.name==='OfficerCapShortCurvedVisor');
            const insignia=(cap?.children||[]).filter(x=>x.name?.startsWith('OfficerCap')&&
              x.name!=='OfficerCapShortCurvedVisor'&&x.name!=='OfficerCapVisorSeam');
            const head=rig.ww2Uniform.headBone.getWorldPosition(new THREE.Vector3());
            const localHead=rig.visual.worldToLocal(head);
            const distance=cap?.position?.distanceTo(localHead)??null;
            return{
              selected:g.selected,role:rig.ww2VisualClass,style:rig.armyHeadwearChoice||'hero',
              cap:!!cap,capVisible:!!cap?.visible,
              headwear:u.headwear,visibleSteel:helmets.length,
              visibleKnitted:!!u.knitCap?.visible,
              visor:visor.length,insignia:insignia.length,
              capHeadPivotDistance:distance,visibleCoverCount:helmets.length+
                 (cap?.visible?1:0)+(u.knitCap?.visible?1:0),
              hasGameSkeleton:!!rig.model&&!!rig.actions?.jog&&!!rig.actions?.sprint
            };
          });
          assert.equal(state.role,expectedRole,JSON.stringify(state));
          assert(state.hasGameSkeleton,'Animation library missing: '+expectedRole);
          assert.equal(state.visibleCoverCount,1,'Overlapping/missing hats '+JSON.stringify(state));
          assert(!state.visibleKnitted,'German accidentally dressed in UK hat');
          if(kind==='helmet'){
            assert.equal(state.cap,false,'A hidden second pilotka was allocated behind helmet');
            assert.equal(state.visibleSteel,1,'German steel helmet missing/duplicated');
            assert.equal(state.visor,0);
          }else{
            assert(state.cap&&state.capVisible,'German sidecap is invisible');
            assert.equal(state.visibleSteel,0,'Overlapping German helmet on cap');
            assert(state.capHeadPivotDistance<.09,'Hat not following donor head: '+JSON.stringify(state));
          }
          if(expectedRole==='captain'){
            assert.equal(state.style,'officer-cap');
            assert.equal(state.visor,1,'No curved visor on officer headwear');
            assert.equal(state.insignia,2,'Officer badge/insignia missing');
          }
          records.push(state);
          if(['hero','rifleman','captain'].includes(expectedRole)){
            const snap=await page.screenshot({type:'jpeg',quality:70,
              path:'/tmp/wehrmacht-headwear-'+device.name+'-'+expectedRole+'.jpg'});
            console.log('WEHRMACHT_HEADWEAR_FRAME_'+device.name.toUpperCase().replace('-','_')+
              '_'+expectedRole.toUpperCase()+' '+snap.toString('base64'));
          }
        }
        assert(!errors.length,'Browser JS exceptions: '+errors.join(';'));
        console.log('WEHRMACHT_HEADWEAR_STAGE2_BROWSER_PASS',device.name,JSON.stringify(records));
        await context.close();
      }
      // Switching from red to British must remove German headwear and leave
      // exactly one UK cap without leaking German cap mesh after async loads.
      const page=await browser.newPage({viewport:{width:845,height:550}});
      await page.goto(
        'http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=german',
        {waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>typeof P!=='undefined'&&!!P?.germanPreview?.nativeRig?.ww2Uniform?.cap,
        null,{timeout:130000});
      const changed=await page.evaluate(()=>{
        P.side='blue';
        const rig=P.germanPreview.nativeRig;
        loadNativeHeroSideCap(rig);
        updateNativeHeroFieldUniform(rig);
        return{
          germanVisible:rig.ww2Uniform.cap?.visible||false,
          ukVisible:!!rig.ww2Uniform.knitCap?.visible,
          name:rig.ww2Uniform.headwear,
          duplicate:rig.visual.children.filter(n=>n.name?.startsWith('GermanPilotka_')).length
        };
      });
      assert(!changed.germanVisible&&changed.ukVisible&&!changed.duplicate,
        'Headwear leaked during Germany to Britain switch: '+JSON.stringify(changed));
      console.log('WEHRMACHT_HEADWEAR_FACTION_SWITCH_PASS',JSON.stringify(changed));
      await page.close();
    }finally{await browser.close()}
  })().catch(e=>{console.error('WEHRMACHT_HEADWEAR_STAGE2_BROWSER_FAIL',e.stack||e);process.exitCode=1});
}
