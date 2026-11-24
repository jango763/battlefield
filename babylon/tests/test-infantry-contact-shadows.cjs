'use strict';
const assert=require('node:assert/strict');
const S=require('../infantry-contact-shadows.js');
const height=(x,z)=>x*.1-z*.04;
const pool=S.createPool({heightAt:height});
const view={unit:{alive:true},anchor:{position:{x:4,z:-13},isEnabled:()=>true}};
const views=[view];
assert.equal(pool.active,0);
assert.equal(pool.update(views),true);
assert.equal(pool.active,1);
const vertices=pool.positions;
for(let v=0;v<S.VERTICES;v++){
 const [x,y,z]=vertices.subarray(v*3,v*3+3);
 assert(Math.abs(y-height(x,z)-S.LIFT)<1e-6,'Shadow must follow local terrain');
 assert(Math.abs(x-4)<=.621&&Math.abs(z+13)<=.441,'Contact area stays beneath feet');
}
assert.equal(pool.update(views),false,'Standing units need no new vertex upload');
assert(pool.colors[3]>.2&&pool.colors[3]<.4,'Soft center must not become an opaque disc');
for(let v=S.VERTICES-16;v<S.VERTICES;v++)assert.equal(pool.colors[v*4+3],0);
view.unit.alive=false;assert(pool.update(views));assert.equal(pool.active,0);
assert(vertices.every(n=>n===0),'Death collapses pooled triangles without ghosts');
view.anchor.position={x:-14,z:8};view.unit.alive=true;
assert(pool.update(views));assert.equal(pool.active,1);
assert.equal(vertices[0],-14);assert.equal(vertices[2],8);
views[3]={unit:{alive:true},anchor:{position:{x:12,z:2},isEnabled:()=>true}};
assert(pool.update(views));assert.equal(pool.active,2,'Reinforcement gets independent shadow');
view.anchor.isEnabled=()=>false;pool.update(views);assert.equal(pool.active,1);
for(let frame=0;frame<1000;frame++){
 views[3].anchor.position.x+=.1;pool.update(views);
 assert.equal(pool.positions,vertices,'Movement must reuse vertex buffer');
}
assert.equal(vertices.length,S.CAPACITY*S.VERTICES*3);
assert(pool.indices.every(i=>i>=0&&i<S.CAPACITY*S.VERTICES));
assert(pool.indices.length/3<=2000,'One pooled mesh stays within mobile geometry budget');
const surface=(name,x,z,w,d,y)=>({name,isVisible:true,isEnabled:()=>true,
 computeWorldMatrix(){},getBoundingInfo:()=>({boundingBox:{
  minimumWorld:{x:x-w/2,z:z-d/2},maximumWorld:{x:x+w/2,z:z+d/2,y}}})});
const sample=S.createSurfaceSampler({scene:{meshes:[
 surface('north-south-road',0,0,4.2,265,.045),
 surface('base-square-blue',0,-125,26,19,.17),
 surface('base-hq-blue',0,-125,13,9,5.2)]},
 world:{heightAt:()=>-.85,defenses:{trenches:[{a:160,b:180,z:170}]}}});
assert.equal(sample(0,0),.045,'Road top is a receiving surface');
assert.equal(sample(0,-125),.17,'Base paving receives shadows, never the HQ roof');
assert.equal(sample(20,20),-.76,'Trench duckboards must not hide contact shadows');
assert.equal(sample(35,35),-.85,'Away from walkable meshes use actual terrain');
console.log('BATTLEFIELD_CONTACT_SHADOWS_PASS');
