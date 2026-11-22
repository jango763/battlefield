'use strict';
const assert=require('node:assert/strict');
const camera=require('../tactical-camera.js');
const stick=require('../mobile-thumbstick.js');
const map=require('../tactical-map-detail.js');
assert.equal(camera.choose(null),'tactical');
assert.equal(camera.choose('classic'),'classic');
assert.equal(camera.choose('any-other'),'tactical');
const c={};
const profile=camera.configure(c);
assert.equal(profile.id,'tactical');
assert(c.beta<1&&c.radius>20,'Default camera must show larger tactical battlefield');
assert.equal(c.lowerRadiusLimit,c.upperRadiusLimit);
const fakeB={Vector3:class Vec{
 constructor(x,y,z){Object.assign(this,{x,y,z})}
 static Lerp(a,b,t){return new this(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t)}
}};
c.target=new fakeB.Vector3(0,1,-107);
assert(camera.follow(c,{x:160,z:51},{B:fakeB,dt:.5}));
assert(c.target.x>0&&c.target.z>-107,'Follow moves toward live hero');
assert.equal(camera.configure(c,{profile:'classic'}).beta,1.18);
const f=stick.vector(0,-62,60,.10);
assert(f.z>.95&&Math.abs(f.x)<.01,'Drag upwards moves hero north');
assert(stick.vector(60,0,60,.1).x>.99,'Drag right moves east');
assert.equal(stick.vector(3,-2,60,.1).magnitude,0,'Natural center dead zone');
const events={};
const pad={style:{},getBoundingClientRect:()=>({width:144}),setPointerCapture:()=>{},
 addEventListener:(type,fn)=>{events['pad-'+type]=fn}};
const knob={style:{}};
const win={addEventListener:(type,fn)=>{events['win-'+type]=fn},
 document:{hidden:false,addEventListener:(type,fn)=>{events['doc-'+type]=fn}}};
const vectors=[];
const driver=stick.create({pad,knob,win,onMove:(x,z,active)=>vectors.push({x,z,active})});
const pointer=(x,y)=>({pointerId:7,pointerType:'touch',button:0,
 clientX:x,clientY:y,preventDefault(){}});
events['pad-pointerdown'](pointer(75,700));
assert.equal(driver.state.active,true);
events['pad-pointermove'](pointer(76,640));
assert(driver.state.z>.95);
events['pad-pointerup'](pointer(76,640));
assert.equal(driver.state.active,false);
assert.equal(driver.state.z,0);
assert.equal(vectors.at(-1).active,false,'Releasing finger must stop hero');
events['pad-pointerdown'](pointer(75,700));
events['win-blur']();
assert.equal(driver.state.active,false,'Incoming call or tab blur must stop movement');
const a=map.seeded(42),b=map.seeded(42);
for(let i=0;i<30;i++)assert.equal(a(),b(),'Map art must be reproducible');
const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../game.js'),'utf8');
assert(src.includes('mobileThumbstick.create({pad,knob,win:window'));
assert(src.includes('tacticalCamera.follow(camera,allies[0]'));
assert(src.includes('mapDetail.apply({scene,B,map:goldRules.MAP'));
console.log('BATTLEFIELD_TACTICAL_CAMERA_THUMBSTICK_UNIT_PASS');
