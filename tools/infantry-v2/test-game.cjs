const fs=require('fs'),vm=require('vm'),assert=require('assert');
const THREE=require('./vendor/three.min.js');global.THREE=THREE;global.self=globalThis;
THREE.TextureLoader.prototype.load=function(url,done){const t=new THREE.Texture();t.image={width:512,height:512};if(done)queueMicrotask(()=>done(t));return t;};
require('./vendor/GLTFLoader.js');
function dom(){const methods={createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:50}),getImageData:()=>({data:new Uint8ClampedArray(4)})};const cx=new Proxy(methods,{get:(t,k)=>k in t?t[k]:()=>{}});return{style:{},textContent:'',innerHTML:'',width:200,height:140,append(){},appendChild(){},prepend(){},addEventListener(){},setPointerCapture(){},getContext:()=>cx};}
const RealRenderer=THREE.WebGLRenderer;THREE.WebGLRenderer=class{constructor(){this.domElement=dom()}setPixelRatio(){}setSize(){}render(){}};
async function run(file){
  const html=fs.readFileSync(__dirname+'/'+file,'utf8');const script=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!m[1].includes('src=')&&!m[1].includes('application/octet-stream')).map(m=>m[2]).join('\n');
  let seed=123456,time=0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const math=Object.create(Math);math.random=random;
  const elements={},timers=[],storage={};const document={createElement:dom,getElementById:id=>elements[id]||(elements[id]=dom()),body:dom(),head:dom(),addEventListener(){}};
  document.getElementById('preview-german-glb').textContent=html.match(/id="preview-german-glb"[^>]*>([\s\S]*?)<\/script>/)[1];
  const ctx={THREE,document,console,Math:math,innerWidth:390,innerHeight:844,devicePixelRatio:2,performance:{now:()=>time},setTimeout:f=>{timers.push(f);return timers.length},clearTimeout(){},addEventListener(){},requestAnimationFrame(){},atob:s=>Buffer.from(s,'base64').toString('binary'),localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},location:{search:'',hostname:'localhost'},URLSearchParams,navigator:{userAgent:'Node test'}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(script,ctx,{timeout:15000});
  for(const f of timers.splice(0))f();
  for(let i=0;i<5;i++)await new Promise(setImmediate);
  vm.runInContext("keys.d=1;att=true;",ctx);
  for(let i=0;i<900;i++){time+=1000/30;if(i===90)vm.runInContext('keys.d=0',ctx);vm.runInContext('update(1/30);scene.updateMatrixWorld(true);',ctx);}
  const snapshot=vm.runInContext('JSON.stringify({gold:G,hp:P.hp,x:P.x,z:P.z,units:U.map(u=>[u.t,u.hp,u.x,u.z,u.gold,u.type]),bases:[CA.blue.hp,CA.red.hp],models:U.filter(u=>u.germanPreview).length})',ctx);
  const stats=JSON.parse(snapshot);assert(stats.models>0,'No German models installed');
  if(file.includes('v2')){assert.equal(stats.models,stats.units.length);vm.runInContext("for(const u of [P,...U]){if(!u.germanPreview)throw Error('Missing new model');if(u.germanPreview.legacy.visible)throw Error('Visible legacy');}",ctx);}
  delete stats.models;
  return stats;
}
(async()=>{const before=await run('preview-original.html'),after=await run('preview-v2-built.html');assert.deepEqual(after,before,'Rendering change altered battle simulation');console.log(JSON.stringify({passed:true,simulatedSeconds:30,units:after.units.length,allInfantryAndHeroUpdated:true,baselineCombatIdentical:true,fullSourceExecuted:true}));})().catch(e=>{console.error(e);process.exitCode=1});
