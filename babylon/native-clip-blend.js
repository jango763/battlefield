/* Battlefield Babylon.js: cross-fade PRE-AUTHORED AnimationGroups.
 * Never synthesizes a zombie gait, changes bone hierarchy or rewrites
 * artist animation tracks. Frame-rate-independent, one controller per unit.
 * Uses the 16 approved native clips already shipped with Battlefield.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldNativeClipBlend=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const DURATION=Object.freeze({run:0.23,ready:0.24,aim:0.18,fire:0.12});
 const smooth=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x)};
 function safeWeight(group,w){
  if(typeof group?.setWeightForAllAnimatables==='function')
   group.setWeightForAllAnimatables(w);
 }
 function stop(view){
  if(view.motionBlend?.outgoing)view.motionBlend.outgoing.stop();
  if(view.clip)view.clip.stop();
  if(view.clips)for(const clip of view.clips.values())clip.stop();
  view.clip=null;view.motionBlend=null;view.lastPose=null;
 }
 function play(view,target,pose,{loop=true,duration}={}){
  if(!target||!view)throw Error('Expected actor and pre-authored clip');
  if(view.clip===target&&target.isPlaying)return false;
  // At most TWO animation groups run during a transition. In-flight fades
  // are finalized before the next, preventing 3+ conflicting transforms.
  const oldTransition=view.motionBlend;
  if(oldTransition){
   oldTransition.outgoing?.stop();
   safeWeight(oldTransition.incoming,1);
   view.motionBlend=null;
  }
  const from=view.clip;
  const fading=!!from&&from!==target&&from.isPlaying;
  if(from===target)from.stop();
  target.stop(); // A fresh start avoids resuming an old run frame.
  target.start(loop,1,target.from,target.to,false);
  if(fading){
   safeWeight(from,1);
   safeWeight(target,0);
   view.motionBlend={
    outgoing:from,incoming:target,elapsed:0,
    seconds:Math.max(.05,Number(duration)||DURATION[pose]||.18)
   };
  }else{
   if(from&&from!==target)from.stop();
   safeWeight(target,1);
   view.motionBlend=null;
  }
  view.clip=target;view.lastPose=pose;
  view.animationChanges=(view.animationChanges||0)+1;
  return true;
 }
 function update(view,dt){
  const fade=view?.motionBlend;
  if(!fade)return false;
  const seconds=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  fade.elapsed+=seconds;
  const weight=smooth(fade.elapsed/fade.seconds);
  safeWeight(fade.outgoing,1-weight);
  safeWeight(fade.incoming,weight);
  if(weight>=1){
   fade.outgoing?.stop();
   safeWeight(fade.incoming,1);
   view.motionBlend=null;
  }
  return true;
 }
 return Object.freeze({DURATION,smooth,play,update,stop});
});