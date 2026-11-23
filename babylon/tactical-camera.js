/* Battlefield tactical camera: readable WWII RTS perspective, camera never
 * consumes joystick touch input. No engine swap or paid camera controller. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldTacticalCamera=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const PROFILES=Object.freeze({
  tactical:Object.freeze({alpha:Math.PI*1.5,beta:.83,radius:23.5,
   targetY:1.35,leadZ:6.5,followRate:5.6}),
  classic:Object.freeze({alpha:Math.PI*1.5,beta:1.18,radius:14,
   targetY:1.55,leadZ:3,followRate:2.8})
 });
 function choose(value){return value==='classic'?'classic':'tactical'}
 function configure(camera,{profile='tactical'}={}){
  if(!camera)throw Error('Battlefield camera missing');
  const id=choose(profile),p=PROFILES[id];
  camera.alpha=p.alpha;camera.beta=p.beta;camera.radius=p.radius;
  camera.lowerRadiusLimit=camera.upperRadiusLimit=p.radius;
  camera.lowerBetaLimit=camera.upperBetaLimit=p.beta;
  camera.lowerAlphaLimit=camera.upperAlphaLimit=p.alpha;
  camera.panningSensibility=0;
  return {id,...p};
 }
 function follow(camera,hero,{B,profile='tactical',dt=1/60}={}){
  if(!camera||!hero||!B?.Vector3)return false;
  const p=PROFILES[choose(profile)];
  const x=hero.x-150,z=hero.z-150;
  const dest=new B.Vector3(x,p.targetY,z+p.leadZ);
  const t=1-Math.exp(-p.followRate*Math.max(0,Math.min(dt,.15)));
  camera.target=B.Vector3.Lerp(camera.target,dest,t);
  return true;
 }
 return Object.freeze({PROFILES,choose,configure,follow});
});
