// Stage 3: German player hero is visually distinct from German regulars.
// All tests are cosmetic; movement, weapon and damage rules remain original.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const code=fs.readFileSync(path.join(root,'preview/german-v5.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
new Function(code);
const inline=loader.match(/<script>([\s\S]*?)<\/script>/);
assert(inline,'missing game bootstrap');
new Function(inline[1]);
for(const tag of [
  'function installNativeGermanHeroIdentity(rig)',
  'function updateNativeGermanHeroIdentity(rig)',
  'GermanHeroDistinctiveFieldKit',
  'HeroPersonalHaversack',
  'HeroMapCaseSling',
  'HeroMapCase',
  'HeroShoulderBoard',
  'rig.armyUnit?0x4a5450:0x485349',
  "identity.root.visible=!rig.armyUnit&&!!P&&P.side==='red'"
])assert(code.includes(tag),'missing hero-only kit token '+tag);
assert(code.includes('installNativeGermanHeroIdentity(v.nativeRig);'),
  'German hero kit must be added to native hero, not every army unit');
assert(code.includes('updateNativeGermanHeroIdentity(rig);'),
  'hero equipment must follow the animated chest pose');
console.log('STAGE 3 STATIC PASS: JavaScript valid and German hero kit is role/side gated');

if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/stage3-qa/node_modules/playwright');
  (async()=>{
    const browser=await chromium.launch({
      headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']
    });
    const failures=[];
    try{
      for(const device of [
        {name:'desktop',viewport:{width:1280,height:800}},
        {name:'mobile-chromium',viewport:{width:390,height:844},
          userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'}
      ]){
        const page=await browser.newPage({viewport:device.viewport,
          ...(device.userAgent?{userAgent:device.userAgent}:{})});
        page.on('pageerror',error=>{
          if(!/No parent to post message/.test(error.message))
            failures.push(device.name+': '+error.message);
        });
        await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html?inspect=german&armyRig=squad',
          {waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>{
          try{return germanPreview.startupHeroReady==='native'&&P.side==='red'&&
              !!P.germanPreview?.nativeRig?.germanHeroIdentity&&
              !!germanPreview.armyNativeTemplate;}
          catch(e){return false}
        },null,{timeout:120000});
        const results=await page.evaluate(()=>{
          const before={x:P.x,z:P.z,hp:P.hp,wpn:P.wpn};
          const hero=P.germanPreview.nativeRig;
          const kit=hero.germanHeroIdentity;
          const names=[];
          kit.root.traverse(node=>{if(node.isMesh)names.push(node.name);});
          const heroGarment=hero.ww2Uniform?.donorMeshes.find(item=>item.type==='garment');
          const army=mk('red',false,false);
          army.x=P.x+1.7;army.z=P.z+1.5;
          army.g.position.set(army.x,0,army.z);
          army.sv=0;army.aim=0;army.kick=0;
          animateGermanSoldier(army,1/60);
          const infantryRig=army.germanPreview?.nativeRig;
          const armyGarment=infantryRig?.ww2Uniform?.donorMeshes.find(item=>item.type==='garment');
          const data={
            heroSide:P.side,
            heroKit:kit.root.name,
            heroVisible:kit.root.visible,
            heroFeatures:names,
            heroGarmentColor:heroGarment?.german?.userData?.uniformTint,
            soldierRole:army.germanPreview?.role,
            soldierHasHeroKit:!!infantryRig?.germanHeroIdentity,
            soldierKitInTree:!!infantryRig?.visual?.getObjectByName('GermanHeroDistinctiveFieldKit'),
            soldierGarmentColor:armyGarment?.german?.userData?.uniformTint,
            soldierNative:!!infantryRig,
            firstHeroState:hero.state
          };
          const startPos=P.x;
          P.sv=3.2;
          for(let i=0;i<12;i++)animateGermanSoldier(P,1/60);
          data.movingState=hero.state;
          data.movementDoesNotChangeGameplay=P.x===startPos&&P.z===before.z;
          kit.root.updateWorldMatrix(true,true);
          const anchor=kit.root.getWorldPosition(new THREE.Vector3());
          const bone=kit.chest.getWorldPosition(new THREE.Vector3());
          data.chestFollowError=anchor.distanceTo(bone);
          const grip=hero.weaponDiagnostics;
          data.gripError=Math.max(grip?.rightError||0,grip?.leftError||0);
          P.sv=0;
          animateGermanSoldier(P,1/60);
          P.side='blue';
          updateNativeHeroFieldUniform(hero);
          data.blueHidesGermanKit=!kit.root.visible;
          P.side='red';
          updateNativeHeroFieldUniform(hero);
          data.redRestoresGermanKit=kit.root.visible;
          data.gameplayUntouched=P.hp===before.hp&&P.wpn===before.wpn&&
            P.x===before.x&&P.z===before.z;
          return data;
        });
        assert.equal(results.heroKit,'GermanHeroDistinctiveFieldKit');
        assert(results.heroVisible,'hero field kit invisible in German faction');
        for(const piece of ['HeroPersonalHaversack','HeroMapCase','HeroShoulderBoard'])
          assert(results.heroFeatures.includes(piece),piece+' missing');
        assert.equal(results.soldierRole,'infantry');
        assert(results.soldierNative,'army rig unexpectedly disabled');
        assert(!results.soldierHasHeroKit&&!results.soldierKitInTree,
          'every soldier incorrectly copied the hero gear');
        assert.notDeepEqual(results.heroGarmentColor,results.soldierGarmentColor,
          'hero uniform tint not distinct from regular German soldier');
        assert.equal(results.firstHeroState,'idle');
        assert.equal(results.movingState,'jog');
        assert(results.movementDoesNotChangeGameplay&&results.gameplayUntouched,
          'cosmetics changed hero movement/damage/weapon');
        assert(results.chestFollowError<.002,
          'hero kit is detached from animated chest '+results.chestFollowError);
        assert(results.gripError<.15,'weapon grip regression '+results.gripError);
        assert(results.blueHidesGermanKit&&results.redRestoresGermanKit,
          'German-only kit persists on the British hero');
        await page.screenshot({path:'/tmp/stage3-hero-'+device.name+'.png'});
        console.log('STAGE 3 BROWSER PASS',device.name,JSON.stringify(results));
        await page.close();
      }
      assert.equal(failures.length,0,failures.join('; '));
    }finally{await browser.close()}
  })().catch(error=>{console.error(error);process.exitCode=1});
}
