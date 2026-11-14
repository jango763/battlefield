/**
 * Converts three actual Muster WWII British infantry assets to standalone GLBs.
 * Run in GitHub Actions against a pinned upstream commit.
 */
'use strict';
const {chromium}=require('/tmp/muster/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({
    headless:true,
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']
  });
  try{
    const page=await browser.newPage({viewport:{width:900,height:700}});
    page.setDefaultTimeout(360000);
    page.on('console',m=>{
      if(['error','warning'].includes(m.type()))console.log('UPSTREAM CONSOLE',m.text().slice(0,500));
    });
    page.on('pageerror',e=>console.error('UPSTREAM PAGE ERROR',e.message));
    await page.goto('http://127.0.0.1:5199/',{waitUntil:'domcontentloaded',timeout:90000});
    const dir=path.resolve('assets/muster-british');
    fs.mkdirSync(dir,{recursive:true});
    const roles=['rifleman','leader','bren'];
    const manifests=[];
    for(const role of roles){
      console.log('BUILD_MUSTER_ROLE',role);
      const val=await page.evaluate(async role=>{
        const exp=await import('/src/battlefield-export-entry.ts');
        return await exp.exportBritish(role);
      },role);
      const data=Buffer.from(val.b64,'base64');
      if(data.readUInt32LE(0)!==0x46546c67)throw Error('Exporter did not produce GLB magic');
      const out=path.join(dir,role+'.glb');fs.writeFileSync(out,data);
      if(data.length>30000000)throw Error(role+' GLB is not practical for browsers: '+data.length);
      manifests.push({id:role,file:role+'.glb',bytes:data.length,triangles:val.triangles,meshParts:val.meshNames.length,names:val.meshNames});
      console.log('EXPORTED_MUSTER_ROLE',JSON.stringify({role,bytes:data.length,triangles:val.triangles,meshParts:val.meshNames.length,names:val.meshNames.slice(0,100)}));
    }
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({
      source:'Kenton-GMI/muster-ww2',
      sourceRevision:'7d2fa86ebc3b999eaf085831cdcd5dccefea63d4',
      license:'MIT',
      author:'Kenton Wang (2026)',
      animated:false,
      description:'Muster WW2 unrigged static British soldier models; use only for preview until rig transfer is approved',
      models:manifests
    },null,2));
  }finally{await browser.close()}
})().catch(e=>{console.error('MUSTER_EXPORT_FAIL',e.stack||e);process.exitCode=1});
