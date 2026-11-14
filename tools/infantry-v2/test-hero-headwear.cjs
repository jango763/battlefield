// Regression gate for exactly one active hero headwear across faction changes.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../../preview/german-v5.js'),'utf8');
new Function(code);
for(const guard of [
  "discardNativeHeroHeadwear(rig,'cap')",
  "discardNativeHeroHeadwear(rig,'knitCap')",
  "uniform.heroHeadwearInitialized",
  "u.heroHeadwearFaction!=='red'"
])assert(code.includes(guard),'Missing headwear lifecycle guard: '+guard);
console.log('HERO HEADWEAR STATIC PASS');

if(process.argv.includes('--browser')){
  const {chromium}=require('/tmp/british-pilot/node_modules/playwright');
  (async()=>{
    const browser=await chromium.launch({headless:true,args:[
      '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox'
    ]});
    try{
      for(const type of ['default','classic-async']){
        const page=await browser.newPage({viewport:{width:844,height:540},deviceScaleFactor:1});
        const errors=[];
        page.on('pageerror',e=>{if(!/No parent to post message/.test(e.message))errors.push(e.message);});
        const params=type==='default'?'?armyRig=british&inspect=british':
          '?armyRig=british&inspect=british&pilotka=classic';
        await page.goto('http://127.0.0.1:8777/preview/formation-replenishment-v3.html'+params,
          {waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>{
          try{return typeof P!=='undefined'&&!!P?.germanPreview?.nativeRig?.ww2Uniform}
          catch(e){return false}
        },
          null,{timeout:120000});
        const data=await page.evaluate(async type=>{
          const rig=P.germanPreview.nativeRig,uniform=rig.ww2Uniform;
          const crowns=()=>rig.visual.children.filter(n=>n.name==='WW2_British_DarkOlive_KnitCap')
            .flatMap(n=>n.children.filter(ch=>ch.name==='BritishKnitCap_ClosedCrown'));
          const countCrown=()=>crowns().length;
          const capParts=()=>rig.visual.children
            .filter(n=>n.name==='WW2_British_DarkOlive_KnitCap')
            .flatMap(n=>n.children);
          const hasFoldedCuff=()=>capParts().some(n=>n.name==='BritishKnitCap_FoldedCuff');
          const hasKnitRibs=()=>capParts().some(n=>n.name==='BritishKnitCap_CuffRibs');
          const darkOlive=()=>crowns().length?
            crowns()[0].material.color.getHex()===0x39432d:false;
          const crownWidth=()=>{
            if(!crowns().length)return 0;
            const mesh=crowns()[0];mesh.geometry.computeBoundingBox();
            return mesh.geometry.boundingBox.getSize(new THREE.Vector3()).x*mesh.scale.x;
          };
          const crownHeight=()=>{
            if(!crowns().length)return 0;
            const mesh=crowns()[0];mesh.geometry.computeBoundingBox();
            return mesh.geometry.boundingBox.getSize(new THREE.Vector3()).y*mesh.scale.y;
          };
          const crownClosed=()=>{
            if(!crowns().length)return false;
            const mesh=crowns()[0],g=mesh.geometry;
            const pos=g.getAttribute('position'),indices=g.getIndex();
            const apex=pos.count-1;
            return !!indices&&Array.from(indices.array).filter(n=>n===apex).length>=24;
          };
          const diagnostic=[];
          for(const side of ['red','blue','red','blue','red','blue']){
            P.side=side;
            updateNativeHeroFieldUniform(rig);
            const hats=rig.visual.children.filter(n=>
              /GermanPilotka_|WW2_British_DarkOlive_KnitCap|WW2_Feldgrau_SideCap_NoVisor/.test(n.name));
            const hatsVisible=hats.filter(n=>n.visible);
            diagnostic.push({
              side,cap:!!uniform.cap,knitCap:!!uniform.knitCap,
              hats:hats.map(n=>n.name),
              visibleHats:hatsVisible.map(n=>n.name),
              donorHelmetVisible:uniform.donorMeshes.filter(n=>n.type==='headgear'&&n.mesh.visible).length,
              fallbackHelmetVisible:!!rig.fieldUniform?.helmet?.visible,
              faction:uniform.heroHeadwearFaction,crownCount:countCrown(),crownWidth:crownWidth(),crownHeight:crownHeight(),crownClosed:crownClosed(),hasFoldedCuff:hasFoldedCuff(),hasKnitRibs:hasKnitRibs(),darkOlive:darkOlive()
            });
          }
          // A previously pending classic GLB request must not reappear over a
          // knitCap after the faction changes.
          if(type==='classic-async'){
            P.side='red';updateNativeHeroFieldUniform(rig);
            P.side='blue';updateNativeHeroFieldUniform(rig);
            await new Promise(resolve=>setTimeout(resolve,2000));
            const hats=rig.visual.children.filter(n=>
              /GermanPilotka_|WW2_British_DarkOlive_KnitCap|WW2_Feldgrau_SideCap_NoVisor/.test(n.name));
            diagnostic.push({side:'blue-after-delay',hats:hats.map(n=>n.name),
              visibleHats:hats.filter(n=>n.visible).map(n=>n.name),
              donorHelmetVisible:uniform.donorMeshes.filter(n=>n.type==='headgear'&&n.mesh.visible).length,
              cap:!!uniform.cap,knitCap:!!uniform.knitCap,faction:uniform.heroHeadwearFaction,crownCount:countCrown(),crownWidth:crownWidth(),crownHeight:crownHeight(),crownClosed:crownClosed(),hasFoldedCuff:hasFoldedCuff(),hasKnitRibs:hasKnitRibs(),darkOlive:darkOlive()});
          }
          return diagnostic;
        },type);
        for(const p of data){
          const british=p.side.startsWith('blue');
          assert.equal(p.faction,british?'blue':'red','Wrong hero headwear side: '+JSON.stringify(p));
          assert.equal(p.donorHelmetVisible,0,'Second WW2 helmet visible: '+JSON.stringify(p));
          assert.equal(p.fallbackHelmetVisible||false,false,'Primitive helmet visible');
          if(british){
            assert.equal(p.cap,false,'British hero has German cap: '+JSON.stringify(p));
            assert.equal(p.knitCap,true,'British hero lacks knitCap: '+JSON.stringify(p));
            assert.equal(p.hats.length,1,'British hero contains extra hats: '+JSON.stringify(p));
            assert.equal(p.crownCount,1,'British knitCap has more than one felt crown: '+JSON.stringify(p));
            assert(p.crownWidth>0.27&&p.crownWidth<0.34,'KnitCap width outside human head fit: '+JSON.stringify(p));
            assert(p.crownHeight>=.135,'KnitCap is still a thin halo with scalp exposed: '+JSON.stringify(p));
            assert.equal(p.crownClosed,true,'KnitCap crown is not fully closed: '+JSON.stringify(p));
            assert(p.hasFoldedCuff&&p.hasKnitRibs,'Knitted cuff or ribs missing: '+JSON.stringify(p));
            assert(p.darkOlive,'Wrong olive wool color: '+JSON.stringify(p));
            assert.equal(p.visibleHats.length,1,'British hero has multiple visible hats');
          }else{
            assert.equal(p.knitCap,false,'German hero contains British knitCap: '+JSON.stringify(p));
            assert(p.hats.length<=1,'German hero contains multiple hats: '+JSON.stringify(p));
          }
        }
        assert(!errors.length,'JS exceptions: '+JSON.stringify(errors));
        console.log('HERO HEADWEAR BROWSER PASS',type,JSON.stringify(data));
        await page.close();
      }
    }finally{await browser.close()}
  })().catch(e=>{console.error(e);process.exitCode=1});
}
