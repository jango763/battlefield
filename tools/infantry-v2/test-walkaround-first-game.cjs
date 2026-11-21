'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const wrapper=fs.readFileSync(path.join(root,'preview/formation-replenishment-v3.html'),'utf8');
const alias=fs.readFileSync(path.join(root,'preview/walkaround.html'),'utf8');
const original=fs.readFileSync(path.join(root,'preview/parts/german-009.txt'),'utf8');
const ending=fs.readFileSync(path.join(root,'preview/parts/german-016.txt'),'utf8');
const script=wrapper.match(/<script>([\s\S]*?)<\/script>/);
assert(script,'First-game loader not found');
new Function(script[1]);
assert(alias.includes('walkaround-bundled.html'),'Walkaround alias does not target the one-file first engine');
assert(wrapper.includes("const playMode=new URLSearchParams(location.search).get('play')||'classic'"));
assert(wrapper.includes("playMode==='walk'"),'Close follow must be opt-in, keep first camera available');
assert(wrapper.includes('20.5,camP.z+16.5'),'Hero follow not close enough');
assert(wrapper.includes('window.__BF_WALKAROUND__'),'Diagnostics for real original hero missing');
assert(wrapper.includes('БРОДИЛКА · АРМИЯ ПЕРВОЙ ИГРЫ'),'Distinct version label missing');
assert(original.includes('new THREE.PerspectiveCamera(40'),'First game camera changed');
assert(original.includes("function guardUpdate(){"),'Magnetic guard logic missing');
assert(original.includes("class ArmyAI"),'Autonomous first-game army missing');
assert(ending.includes("spT[t]=1.4;if(U.filter(u=>u.t===t).length<22)mk(t)"),
 'Army must replenish at 1.4s with same 22 per-side population threshold');
assert(ending.includes("cmT[t]=30;mk(t,true)"),'Commanders must still recruit');
assert(original.includes("if(cur<6)"),'Hero escort/magnet must still fill up to 6');
assert(original.includes("function mk(t,cmd,eng)"),'Engineer and officer roles missing');
assert(ending.includes('requestAnimationFrame(loop)'),'First game render loop missing');
assert(!wrapper.includes('replenishment-core.js'),'Reject the Babylon 8v8 replacement logic');
console.log('FIRST_GAME_WALKAROUND_STATIC_PASS',{
 engine:'Three.js',nativeArmySpawnsEverySeconds:1.4,
 maxNormalSoldiersPerSide:22,heroes:1,escortLimit:6,
 separateBabylonPreserved:true
});
