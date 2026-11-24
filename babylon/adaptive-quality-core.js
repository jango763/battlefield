/* Battlefield mobile adaptive render-quality policy. Pure and testable.
 * Babylon hardwareScalingLevel is inverse pixel density: increase to recover
 * FPS; decrease gradually to sharpen. Does not modify gameplay timing.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldAdaptiveQuality=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const CHECK_SECONDS=3.5;
 function nextScale(fps,current,min,max){
  if(![fps,current,min,max].every(Number.isFinite)||fps<=0)return current;
  const lower=Math.max(1,Math.min(min,max)),upper=Math.max(lower,max);
  const step=fps<24?.40:fps<34?.22:
   fps>=60?-.08:fps>55?-.04:0;
  const scale=Math.min(upper,Math.max(lower,current+step));
  return Math.round(scale*1000)/1000;
 }
 return Object.freeze({CHECK_SECONDS,nextScale});
});
