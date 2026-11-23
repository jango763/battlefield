/* Pointer-independent radial response: smooth near centre, no input latency.
 * Screen coordinates are converted by the caller; never reverse axes here.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldJoystickResponse=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const DEADZONE=.085,EXPONENT=1.16;
 function shape(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return {x:0,y:0,strength:0};
  const length=Math.hypot(x,y);
  if(length<=DEADZONE)return {x:0,y:0,strength:0};
  const radial=Math.min(1,Math.max(0,(length-DEADZONE)/(1-DEADZONE)));
  const strength=Math.pow(radial,EXPONENT);
  return {x:x/length*strength,y:y/length*strength,strength};
 }
 return Object.freeze({DEADZONE,EXPONENT,shape});
});
