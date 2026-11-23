'use strict';
/* Offline, dependency-free source assembler. Nothing is fetched from the
 * network: Babyon game.js stays a standard, iPhone-compatible browser script.
 * The 10 source fragments have exact line balance and canonical byte order.
 */
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const names=Array.from({length:10},(_,i)=>
 path.join(root,'game.parts',String(i+1).padStart(2,'0')+'.part'));
const source=names.map(f=>fs.readFileSync(f,'utf8')).join('');
const destination=path.join(root,'game.js');
const parts=names.map(f=>fs.readFileSync(f,'utf8'));
const sizes=parts.map(p=>(p.match(/[^\n]*\n|[^\n]+$/g)||[]).length);
assert(sizes.every(n=>n>0),'Empty game source part');
assert(Math.max(...sizes)-Math.min(...sizes)<=1,
 'Game source must be split into ten equal line-count parts');
if(process.argv.includes('--check')){
 assert.equal(fs.readFileSync(destination,'utf8'),source,
  'Generated game.js is out of sync: run node babylon/tools/assemble-game-parts.cjs');
}else fs.writeFileSync(destination,source,'utf8');
console.log('BATTLEFIELD_TEN_PART_BUILD_PASS',JSON.stringify({
 pieces:parts.length,lines:sizes,bytes:source.length,check:process.argv.includes('--check')
}));
