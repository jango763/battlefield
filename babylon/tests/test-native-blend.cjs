'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const blend=require('../native-clip-blend.js');
const makeClip=name=>({
 name,from:0,to:32,isPlaying:false,weight:null,starts:0,stops:0,
 start(loop){this.isPlaying=true;this.loop=loop;this.starts++;return this},
 stop(){this.isPlaying=false;this.stops++;},
 setWeightForAllAnimatables(value){this.weight=value}
});
const measure=(frameSeconds)=>{
 const idle=makeClip('Kar98k_Hold'),run=makeClip('Kar98k_Run');
 const view={clips:new Map([['Kar98k_Hold',idle],['Kar98k_Run',run]]),
  animationChanges:0};
 assert(blend.play(view,idle,'ready'));
 assert.equal(idle.weight,1);
 assert(!blend.play(view,idle,'ready'));
 assert(blend.play(view,run,'run'));
 assert.equal(run.weight,0);
 assert.equal(idle.weight,1);
 assert(idle.isPlaying&&run.isPlaying);
 const length=blend.DURATION.run;
 let elapsed=0;
 while(elapsed+frameSeconds<length){
  elapsed+=frameSeconds;
  blend.update(view,frameSeconds);
 }
 blend.update(view,length-elapsed);
 assert.equal(run.weight,1);
 assert.equal(idle.isPlaying,false);
 assert.equal(view.motionBlend,null);
 assert.equal(view.animationChanges,2);
 blend.stop(view);
 assert.equal(run.isPlaying,false);
 return run.weight;
};
for(const fps of [30,60,90,120,144])assert.equal(measure(1/fps),1);
{
 const a=makeClip('a'),b=makeClip('b'),c=makeClip('c');
 const view={clips:new Map([['a',a],['b',b],['c',c]])};
 blend.play(view,a,'ready');
 blend.play(view,b,'run');
 blend.update(view,.07);
 assert(b.weight>0&&b.weight<1);
 blend.play(view,c,'fire',{loop:false});
 assert(!a.isPlaying,'Older outgoing clip must stop');
 assert(b.isPlaying&&c.isPlaying,'Only two clips should overlap');
 assert.equal(view.motionBlend.outgoing,b);
 blend.update(view,.10);
 blend.update(view,.10);
 assert(!b.isPlaying);
 assert.equal(c.weight,1);
 assert.equal(c.loop,false);
}
assert.equal(blend.smooth(0),0);
assert.equal(blend.smooth(1),1);
assert.equal(blend.smooth(.5),.5);
const game=fs.readFileSync(path.resolve(__dirname,'../game.js'),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
assert(game.includes('nativeBlend.play(view,target,pose'));
assert(game.includes('nativeBlend.update(view,dt)'));
assert(html.includes('src="./native-clip-blend.js"'));
assert(html.indexOf('src="./native-clip-blend.js"')<html.indexOf('src="./game.js"'));
assert(game.includes("const CLIP_IDS=Object.keys(META).flatMap"),
 'Keep all 16 already approved authored combat clips');
assert(!game.includes("target.start(pose!=='fire',1,target.from,target.to,false)"),
 'Do not revert to abrupt clip switches');
console.log('NATIVE_COMBAT_ANIMATION_BLEND_TESTS_PASS');
