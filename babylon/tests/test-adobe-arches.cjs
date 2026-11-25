'use strict';
const assert=require('node:assert/strict');
const {archGeometry}=require('../modern-village-models');
for(const [w,h] of [[1.84,2.78],[.67,.89]]){
 const {positions,uvs,indices}=archGeometry(w,h);
 const n=positions.length/3;
 assert(n===15 && uvs.length===n*2);
 assert(indices.length===78 && indices.every(i=>Number.isInteger(i)&&i>=0&&i<n));
 const xs=positions.filter((_,i)=>i%3===0),ys=positions.filter((_,i)=>i%3===1);
 assert(Math.abs(Math.min(...xs)+w/2)<1e-9);
 assert(Math.abs(Math.max(...xs)-w/2)<1e-9);
 assert(Math.abs(Math.max(...ys)-h)<1e-9);
 assert.equal(Math.min(...ys),0);
 for(let i=0;i<indices.length;i+=3){
  const [a,b,c]=indices.slice(i,i+3).map(j=>positions.slice(j*3,j*3+3));
  const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  assert(Math.abs(area)>1e-8,'Degenerate arch triangle');
 }
}
console.log('BATTLEFIELD_ADOBE_ARCHES_PASS');
