// Stage 4: browser regression for the British player's distinct sand uniform.
// Checks that Stage 2 startup and Stage 3 German hero/army remain unchanged.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const code=fs.readFileSync(path.join(root,'preview/german-v5.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(code);
const inline=loader.match(/<script>([\s\S]*?)<\/script>/);
assert(inline,'game HTML bootstrap missing');
new Function(inline[1]);
for(const needle of [
  'function installNativeBritishHeroIdentity(rig)',
  'function updateNativeBritishHeroIdentity(rig)',
  'BritishHeroDistinctiveWebbing',
  'BritishHeroCanvasPack',
  'BritishHeroRolledGroundsheet',
  'BritishHeroAmmoPouch',
  'BritishHeroWebbingStrap',
  'BritishHeroCanteen',
  'BritishHeroRankTab',
  "rig.armyUnit?0xa28d69:0xb5a17d",
  "identity.root.visible=!rig.armyUnit&&!!P&&P.side==='blue'",
  'installNativeBritishHeroIdentity(v.nativeRig);',
  "'british-hero'"
])assert(code.includes(needle)||loader.includes(needle),'Missing stage-4 requirement '+needle);
assert(loader.includes('german-v5.js?v=20261114-stage5-beret-r4'),
  'Stage 4 game loader has stale asset URL');
console.log('STAGE 4 STATIC PASS: both scripts parse, British hero field kit role and side gated');
if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/stage4-qa/node_modules/playwright');
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
        page.on('pageerror',err=>{
          if(!/No parent to post message/.test(err.message))errors.push(device.name+': '+err.message);
        });
        await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=british-hero&armyRig=off',
          {waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>{
          try{return germanPreview.startupHeroReady==='native'&&P?.side==='blue'&&
              !!P.germanPreview?.nativeRig?.britishHeroIdentity;}
          catch(e){return false;}
        },null,{timeout:120000});
        const stats=await page.evaluate(()=>{
          const hero=P.germanPreview.nativeRig;
          const uk=hero.britishHeroIdentity;
          const de=hero.germanHeroIdentity;
          const pieces=[];
          uk.root.traverse(n=>{if(n.isMesh)pieces.push(n.name)});
          const uniform=hero.ww2Uniform;
          const garment=uniform?.donorMeshes.find(item=>item.type==='garment');
          const helmetCount=uniform?.donorMeshes.filter(item=>item.type==='headgear'&&item.mesh.visible).length||0;
          const soldier=mk('blue',false,false);
          soldier.x=P.x+2;soldier.z=P.z+2;soldier.g.position.set(soldier.x,0,soldier.z);
          animateGermanSoldier(soldier,1/60);
          const backup={x:P.x,z:P.z,hp:P.hp,wpn:P.wpn,side:P.side};
          const initialState=hero.state;
          const first={
            kit:uk.root.name,
            side:P.side,
            britishKitVisible:uk.root.visible,
            germanKitVisible:de.root.visible,
            beretVisible:uniform?.beret?.visible,
            helmetCount,
            soldierIsRegular:soldier.germanPreview?.role==='infantry',
            soldierHasHeroKit:!!soldier.germanPreview?.nativeRig?.britishHeroIdentity ||
              !!soldier.germanPreview?.anchor?.getObjectByName('BritishHeroDistinctiveWebbing'),
            firstHeroState:initialState,
            heroUniformTint:garment?.british?.userData?.uniformTint,
            pieces
          };
          P.sv=3.2;P.aim=0;
          for(let i=0;i<16;i++)animateGermanSoldier(P,1/60);
          uk.root.updateWorldMatrix(true,true);
          first.movementState=hero.state;
          first.chestAnchorError=uk.root.getWorldPosition(new THREE.Vector3())
            .distanceTo(uk.chest.getWorldPosition(new THREE.Vector3()));
          first.weaponGripError=Math.max(hero.weaponDiagnostics?.leftError||0,
            hero.weaponDiagnostics?.rightError||0);
          P.sv=0;animateGermanSoldier(P,1/60);
          P.side='red';updateNativeHeroFieldUniform(hero);
          first.redHidesBritish=!uk.root.visible;
          first.redShowsGerman=de.root.visible;
          first.redHidesBeret=!uniform.beret.visible;
          P.side='blue';updateNativeHeroFieldUniform(hero);
          first.blueRestoresBritish=uk.root.visible&&!de.root.visible&&uniform.beret.visible;
          first.gameplayUnchanged=P.x===backup.x&&P.z===backup.z&&P.hp===backup.hp&&
            P.wpn===backup.wpn&&P.side===backup.side;
          first.startupCoverRemoved=!document.getElementById('hero-startup-gate');
          first.canvasCount=document.querySelectorAll('canvas').length;
          return first;
        });
        for(const name of ['BritishHeroCanvasPack','BritishHeroRolledGroundsheet',
          'BritishHeroAmmoPouch','BritishHeroCanteen','BritishHeroWebbingStrap'])
          assert(stats.pieces.includes(name),'British hero equipment missing: '+name);
        assert.equal(stats.kit,'BritishHeroDistinctiveWebbing');
        assert(stats.side==='blue'&&stats.britishKitVisible&&!stats.germanKitVisible,
          'Wrong active equipment on British hero');
        assert.equal(stats.soldierIsRegular,true);
        assert.equal(stats.soldierHasHeroKit,false,'British ordinary soldier copied the hero');
        assert(stats.beretVisible&&stats.helmetCount===0,
          'Approved British hero beret missing or double helmet');
        const sand=[0xb5/255,0xa1/255,0x7d/255];
        assert(stats.heroUniformTint&&
          stats.heroUniformTint.every((v,i)=>Math.abs(v-sand[i])<.001),
          'British tunic tint not sandy: '+JSON.stringify(stats.heroUniformTint));
        assert.equal(stats.firstHeroState,'idle');
        assert.equal(stats.movementState,'jog');
        assert(stats.chestAnchorError<.002,'British kit does not follow chest');
        assert(stats.weaponGripError<.15,'Two-hand grip changed');
        assert(stats.redHidesBritish&&stats.redShowsGerman&&stats.redHidesBeret,
          'German side incorrectly wears British gear');
        assert(stats.blueRestoresBritish,'British appearance does not recover');
        assert(stats.gameplayUnchanged&&stats.startupCoverRemoved&&stats.canvasCount>=1,
          'Gameplay, startup or rendering regression');
        await page.screenshot({path:'/tmp/stage4-british-'+device.name+'.png'});
        console.log('STAGE 4 BROWSER PASS',device.name,JSON.stringify(stats));
        await page.close();
      }
      assert.equal(errors.length,0,'Browser page errors: '+errors.join('; '));
    }finally{await browser.close();}
  })().catch(err=>{console.error(err);process.exitCode=1;});
}
