/* Run AnimStudio's actual browser+MCP bridge against the APPROVED 65-joint soldier.
   This does not edit Battlefield main, Three.js, GLBs or the artist's materials.
   Invoke from repo root: node babylon/tools/run-animstudio-4.cjs /tmp/AnimStudio
*/
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const {chromium} = require('/tmp/animstudio-qa/node_modules/playwright');

(async () => {
  const root=path.resolve(process.argv[2] || '/tmp/AnimStudio');
  const base='http://127.0.0.1:5173';
  const output=path.resolve('babylon/animstudio-output');
  fs.mkdirSync(output,{recursive:true});
  let browser, server;
  const summary={source:'Sheggyb/AnimStudio',rig:'approved german.glb',
    temporaryPanzerschreck:true,tools:'actual AnimStudio browser MCP bridge',weapons:[]};
  const gunSpecs=[
    {id:'Kar98k',asset:'de-kar98k.glb',support:[0,.04,.27]},
    {id:'MP40',asset:'de-mp40.glb',support:[0,.027,.19]},
    {id:'MG42',asset:'de-mg42.glb',support:[0,.074,.28]},
    {id:'Panzerschreck',asset:'de-panzerschreck-preview.glb',support:[0,-.135,-.10],prototype:true}
  ];
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function call(command,args={}){
    const resp=await fetch(base+'/api/bridge/call',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({cmd:command,args,timeout:180000}),
      signal:AbortSignal.timeout(200000)
    });
    const v=await resp.json();
    if(!resp.ok||v.ok!==true)throw Error(command+': '+(v.error||JSON.stringify(v).slice(0,900)));
    console.log('ANIMSTUDIO',command,JSON.stringify(v.result).slice(0,900));
    return v.result;
  }
  try{
    assert(fs.existsSync(path.join(root,'server.cjs')),'AnimStudio clone missing');
    for(const file of ['german.glb',...gunSpecs.map(w=>w.asset)]){
      const dst=file==='german.glb'?'models':'props';
      const source=file==='german.glb'
        ? 'assets/soldiers/german.glb'
        : file==='de-panzerschreck-preview.glb'
          ? 'babylon/animstudio-output/de-panzerschreck-preview.glb'
          : 'assets/ww2-weapons/'+file;
      fs.mkdirSync(path.join(root,dst),{recursive:true});
      fs.copyFileSync(source,path.join(root,dst,file));
    }
    server=spawn(process.execPath,['server.cjs'],{
      cwd:root,env:{...process.env,PORT:'5173',BROWSER:'none'},stdio:['ignore','pipe','pipe']
    });
    server.stdout.on('data',b=>process.stdout.write('[STUDIO] '+b));
    server.stderr.on('data',b=>process.stderr.write('[STUDIO] '+b));
    for(let k=0;k<60;k++){
      try{const r=await fetch(base+'/api/info');if(r.ok)break}catch{}
      await delay(400);
    }
    browser=await chromium.launch({headless:true,args:[
      '--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl'
    ]});
    const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
    page.on('pageerror',e=>console.error('STUDIO_PAGE_ERROR',e));
    page.on('console',msg=>{if(msg.type()==='error')console.error('STUDIO_CONSOLE',msg.text().slice(0,450))});
    await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(async()=>{try{return (await(await fetch('/api/bridge/status')).json()).connected>0}catch{return false}},null,{timeout:90000});
    await call('load_model',{name:'german.glb'});
    const rig=await call('get_rig');
    if(!rig.humanoid)throw Error('Approved 65-joint soldier not recognised as humanoid; no new rig permitted');
    summary.height_m=rig.height_m;
    const sockets=await call('add_sockets');
    if(!sockets.sockets?.includes('Weapon_R'))throw Error('Weapon_R socket was not created');
    const info=await call('list_props');
    for(const spec of gunSpecs)if(!info.files.includes(spec.asset))throw Error('Missing prop '+spec.asset);
    for(const spec of gunSpecs){
      console.log('ANIMSTUDIO_WEAPON_BEGIN',spec.id);
      await call('attach_prop',{prop:spec.asset,name:spec.id,socket:'Weapon_R',
        pos:[0,0,0],rot:[0,0,0],scale:1});
      await call('update_prop',{name:spec.id,support:spec.support});
      const result={id:spec.id,prototype:!!spec.prototype,locomotion:'run',clips:[],misses:[]};
      if(!spec.prototype){
        for(const action of ['hold','aim','fire']){
          const c=await call('weapon_animation',{action,prop:spec.id});
          result.clips.push(c.clip);
          if(c.out_of_reach?.length)result.misses.push({clip:c.clip,frames:c.out_of_reach});
        }
        // Combat doctrine: every soldier MOVES AT A RUN, no walking gait.
        // Real combat gait. IMPORTANT: AnimStudio uses DEGREES for stride/kneeLift/lean,
        // and a fraction of leg length for crouch/bounce. 0.35 deg kneeLift caused
        // straight-legged goose-stepping in the user's review; tune 86/24/13 deg.
        const run=spec.id+'_Run';
        await call('generate_motion',{type:'run',name:run,cycles:1,
          params:{cycle:0.70,stride:24,kneeLift:86,kneeContact:24,footRoll:15,
            armSwing:4,elbow:65,lean:13,crouch:0.09,bounce:0.028,
            sway:0.007,hipTwist:5,chestCounter:4,headBob:1.5,plant:true}});
        const held=await call('weapon_animation',{action:'hold_in_clip',clip:run,prop:spec.id});
        result.clips.push(run);
        if(held.out_of_reach?.length)result.misses.push({clip:run,frames:held.out_of_reach});
      }else{
        // Anti-tank launcher deliberately keys a shoulder-mounted pose instead
        // of treating the Panzerschreck as a shoulder-stock rifle.
        const poses={
          Hold:[{frame:0,main:[-.14,-.07,.12],support:[-.08,-.12,.30]},
            {frame:30,main:[-.14,-.07,.12],support:[-.08,-.12,.30]}],
          Aim:[{frame:0,main:[-.13,.055,.14],support:[-.12,.06,.36]},
            {frame:30,main:[-.13,.055,.14],support:[-.12,.06,.36]}],
          Fire:[{frame:0,main:[-.13,.055,.14],support:[-.12,.06,.36]},
            {frame:2,main:[-.13,.065,.095],support:[-.12,.09,.31]},
            {frame:8,main:[-.13,.055,.14],support:[-.12,.06,.36]}]
        };
        for(const [mode,p] of Object.entries(poses)){
          const clip=spec.id+'_'+mode;
          await call('create_clip',{name:clip,frames:mode==='Fire'?8:30,loop:true});
          const ik=await call('key_weapon_pose',{clip,prop:spec.id,poses:p,support:true});
          result.clips.push(clip);
          if(ik.out_of_reach?.length)result.misses.push({clip,frames:ik.out_of_reach});
        }
        const run=spec.id+'_Run';
        await call('generate_motion',{type:'run',name:run,cycles:1,
          params:{cycle:0.70,stride:24,kneeLift:86,kneeContact:24,footRoll:15,
            armSwing:4,elbow:65,lean:13,crouch:0.09,bounce:0.028,
            sway:0.007,hipTwist:5,chestCounter:4,headBob:1.5,plant:true}});
        // Keep the shoulder-borne launcher in both hands throughout the run.
        const ik=await call('key_weapon_pose',{clip:run,prop:spec.id,support:true,
          poses:[{frame:0,main:[-.14,-.07,.12],support:[-.08,-.12,.30]},
            {frame:30,main:[-.14,-.07,.12],support:[-.08,-.12,.30]}]});
        result.clips.push(run);
        if(ik.out_of_reach?.length)result.misses.push({clip:run,frames:ik.out_of_reach});
      }
      const glb=await call('export_glb',{name:'Battlefield_'+spec.id,
        which:'mine',content:'model',engine:'any',root_motion:'inplace',fps:30,reduce:0,sidecar:true});
      result.export=glb;summary.weapons.push(result);
      await page.screenshot({path:path.join(output,spec.id+'.png')});
      console.log('ANIMSTUDIO_WEAPON_DONE',spec.id,JSON.stringify(result));
    }
    await call('save_project',{name:'Battlefield - four weapons'});
    const exports=path.join(root,'exports');
    for(const f of fs.readdirSync(exports)){
      if(/^Battlefield_(Kar98k|MP40|MG42|Panzerschreck)/.test(f))
        fs.copyFileSync(path.join(exports,f),path.join(output,f));
    }
    const projs=path.join(root,'projects');
    for(const f of fs.readdirSync(projs)){
      if(f.endsWith('.animproj.json'))
        fs.copyFileSync(path.join(projs,f),path.join(output,f));
    }
    fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
    const failures=summary.weapons.flatMap(x=>x.misses.map(y=>({gun:x.id,...y})));
    console.log('ANIMSTUDIO_FINAL',JSON.stringify({guns:summary.weapons.length,clips:summary.weapons.reduce((n,x)=>n+x.clips.length,0),ikFlags:failures.length,failures}));
    if(summary.weapons.length!==4||summary.weapons.some(x=>x.clips.length!==4||!x.clips.includes(x.id+'_Run')||x.clips.some(c=>c.endsWith('_Walk'))))
      throw Error('Missing weapon animations or combat run');
    for(const w of summary.weapons){
      if(!fs.existsSync(path.join(output,'Battlefield_'+w.id+'.glb')))throw Error('No export for '+w.id);
    }
  }finally{
    await browser?.close();
    if(server){server.kill('SIGTERM');await delay(300);}
  }
})().catch(e=>{console.error('ANIMSTUDIO_PIPELINE_FAILED',e);process.exitCode=1});
