/* Per-actor shortest-arc turn smoothing. Presentation only: pathfinding,
 * velocity, hitboxes, skinned bone animations, weapons and IK are untouched.
 * Exponential damping is frame-rate independent; avoid teleporting yaw. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldHeadingSmoothing=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 function step(current,target,seconds,turnRate=13){
  if(!Number.isFinite(current)||!Number.isFinite(target))return current;
  if(!Number.isFinite(seconds)||seconds<=0)return current;
  const dt=Math.min(.1,seconds);
  const rate=Number.isFinite(turnRate)?Math.max(0,turnRate):13;
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  const weight=1-Math.exp(-rate*dt);
  return current+delta*weight;
 }
 return Object.freeze({step});
});
