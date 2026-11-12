const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/preview-original.html','utf8');
const loader=fs.readFileSync(__dirname+'/german-v2.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const script=fs.readFileSync(__dirname+'/german-v2.js','utf8');
async function run(fail){
  let written=null;const els={};const doc={getElementById:id=>els[id]||(els[id]={style:{},hidden:true}),open(){},close(){},write:s=>written=s};
  const fetch=async url=>{if(url.startsWith('german-v2.js'))return{ok:true,text:async()=>script};const i=Number(url.match(/german-(\d+)\.txt/)[1]);return{ok:!(fail&&i===4),status:503,text:async()=>source.slice(i===0?0:100000+(i-1)*500000,i===0?100000:100000+i*500000)};};
  await vm.runInNewContext(loader,{fetch,document:doc,location:{reload(){}},AbortController,setTimeout,clearTimeout});
  return{written,els};
}
(async()=>{const good=await run(false);assert.equal(good.written,fs.readFileSync(__dirname+'/preview-v2-built.html','utf8'));for(const m of good.written.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!m[1].includes('src=')&&!m[1].includes('application/octet-stream'))new vm.Script(m[2]);assert(!good.written.includes('id="german-compare"'),'Compare button must be removed');assert(!good.written.includes('toggleGermanSoldierPreview'));const bad=await run(true);assert.equal(bad.written,null);assert.equal(bad.els.retry.hidden,false);assert(bad.els.error.textContent.includes('503'));console.log(JSON.stringify({loader:'passed',assembledSourceMatchesBuild:true,scriptSyntax:'passed',failedChunkShowsRetry:true}));})().catch(e=>{console.error(e);process.exitCode=1});
