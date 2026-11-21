#!/usr/bin/env node
'use strict';
/* Assemble the SAME tested first-game loader into one HTML file.
 * This removes the 17 sequential network fetches from the iPhone startup.
 * Crucially, it does not replace gameplay, controls, army AI or GLB assets.
 */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..');
const wrapper=fs.readFileSync(path.join(repo,'preview/formation-replenishment-v3.html'),'utf8');
const script=wrapper.match(/<script>([\s\S]*?)<\/script>/);
assert(script,'First-game boot script was not found');
const progress={textContent:''},error={textContent:''},retry={hidden:true,onclick:null};
let written=null;
const doc={
 getElementById(id){return {progress,error,retry}[id]||null},
 open(){},
 write(html){written=html},
 close(){}
};
const timeout=Number(process.env.BUILD_TIMEOUT||60000);
let completed=false;
const fakeFetch=async url=>{
 const safe=String(url).replace(/[?#].*$/,'');
 assert(/^(?:parts\/german-\d{3}\.txt|german-v5\.js|visual-boost-v1\.js|ww2-structure-materials-v1\.js)$/.test(safe),
  'Unexpected first-game resource '+safe);
 const content=fs.readFileSync(path.join(repo,'preview',safe),'utf8');
 return {ok:true,status:200,text:async()=>content};
};
const context={
 document:doc,location:{search:'?play=walk&graphics=boost',protocol:'https:',
  hostname:'localhost'},
 navigator:{userAgent:'node-standalone-builder'},
 fetch:fakeFetch,URLSearchParams,AbortController,setTimeout,clearTimeout,
 console
};
try{vm.runInNewContext(script[1],context,{timeout:5000,filename:'first-game-loader.js'});}
catch(e){console.error('Cannot run the unmodified first-game loader',e);process.exit(1)}
(async()=>{
 const start=Date.now();
 while(!written){
  if(error.textContent)throw Error('Original loader refused to build: '+error.textContent);
  if(Date.now()-start>timeout)throw Error('First-game standalone bundling timed out');
  await new Promise(resolve=>setTimeout(resolve,30));
 }
 assert(written.startsWith('<!DOCTYPE html>')||written.startsWith('<!doctype html>'),
  'The bundle is not the original game');
 assert(written.includes('function guardUpdate(){'),'Lost native formation system');
 assert(written.includes('class ArmyAI'),'Lost native autonomous army');
 assert(written.includes('spT[t]=1.4'),'Lost 1.4s infantry waves');
 assert(written.includes('window.__BF_WALKAROUND__'),'Lost close hero camera');
 // The original game references TWO externally hosted Three.js runtime files.
 // This is another iPhone failure point, even after consolidating 17 chunks.
 // Inline their exact pinned r128 MIT-licensed code in the standalone edition.
 const modules=process.env.BF_THREE_R128_NODE_MODULES||
  '/tmp/battlefield-three128/node_modules/three';
 const vendors=[
  ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    path.join(modules,'build/three.min.js')],
  ['https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
    path.join(modules,'examples/js/loaders/GLTFLoader.js')]
 ];
 for(const [url,filename] of vendors){
  const old='<script src="'+url+'"></script>';
  assert(written.includes(old),'Missing required external Three.js script '+url);
  const content=fs.readFileSync(filename,'utf8').replace(/<\\/script/gi,'<\\\\/script');
  assert(content.length>10000,'Missing original Three.js library '+filename);
  written=written.replace(old,
   '<script>/* THREE.JS MIT LICENSE — bundled locally to support offline iPhone launch. */\\n'+
   content+'\\n</script>');
 }
 assert(!written.includes('<script src="https://'), 'External startup library still required');
 assert(written.includes('WWII-textured'),'Actual site materials missing');
 assert(written.includes('БРОДИЛКА · АРМИЯ ПЕРВОЙ ИГРЫ'));
 assert(!written.includes('Загрузка игры: 0%'),'Download splash leaked into bundle');
 assert(written.length>3000000,'Unexpectedly small standalone game; GLB lost');
 new vm.Script(written.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'',
  {filename:'bundled-first-threejs-game.js'});
 const filename=path.join(repo,'preview','walkaround-bundled.html');
 fs.writeFileSync(filename,written,'utf8');
 const stats=fs.statSync(filename);
 console.log('BATTLEFIELD_SINGLE_FILE_BUILD_OK',{
  file:'preview/walkaround-bundled.html',bytes:stats.size,
  sourceParts:17,engine:'first-game Three.js',army:'native AI + reinforcement',
  hero:'close follow',sourceModel:'approved original' });
})().catch(e=>{console.error(e);process.exitCode=1});
