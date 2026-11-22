/* Battlefield floating-origin analog thumbstick.
 * Works with Pointer Events on iPhone Safari + mouse without dragging camera,
 * changing unit input physics or using external libraries/subscriptions. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldMobileThumbstick=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function vector(dx,dy,radius=58,deadZone=.10){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||radius<=0)
   return {x:0,z:0,magnitude:0};
  const nx=dx/radius,nz=-dy/radius,d=Math.hypot(nx,nz);
  if(d<=deadZone)return {x:0,z:0,magnitude:0};
  const speed=clamp((d-deadZone)/(1-deadZone),0,1);
  return {x:nx/d*speed,z:nz/d*speed,magnitude:speed};
 }
 function create({pad,knob,win,onMove=()=>{},canStart=()=>true,deadZone=.10}={}){
  if(!pad||!knob||!win)throw Error('Thumbstick requires a pad, knob and window');
  const state={active:false,pointer:null,x:0,z:0,magnitude:0,
   inputEvents:0,resetCount:0};
  let origin=null;
  function setValue(x,z,magnitude){
   state.x=x;state.z=z;state.magnitude=magnitude;
   const radius=Math.max(32,pad.getBoundingClientRect().width*.41);
   knob.style.transform='translate('+Math.round(x*radius*.78)+'px,'+
    Math.round(-z*radius*.78)+'px)';
   state.inputEvents++;
   onMove(x,z,state.active);
  }
  function move(e){
   if(!state.active||state.pointer!==e.pointerId||!origin)return;
   e.preventDefault?.();
   const radius=Math.max(32,pad.getBoundingClientRect().width*.41);
   const next=vector(e.clientX-origin.x,e.clientY-origin.y,radius,deadZone);
   setValue(next.x,next.z,next.magnitude);
  }
  function release(e){
   if(e&&state.pointer!==e.pointerId)return;
   if(!state.active)return;
   state.active=false;state.pointer=null;origin=null;
   state.resetCount++;
   setValue(0,0,0);
  }
  pad.addEventListener('pointerdown',e=>{
   if(state.active||!canStart())return;
   if(e.pointerType==='mouse'&&e.button!==0)return;
   e.preventDefault?.();
   state.active=true;state.pointer=e.pointerId;
   origin={x:e.clientX,y:e.clientY};
   pad.setPointerCapture?.(e.pointerId);
   setValue(0,0,0);
  });
  pad.addEventListener('pointermove',move);
  pad.addEventListener('pointerup',release);
  pad.addEventListener('pointercancel',release);
  pad.addEventListener('lostpointercapture',release);
  win.addEventListener('blur',()=>release());
  win.document?.addEventListener('visibilitychange',()=>{
   if(win.document.hidden)release();
  });
  return Object.freeze({state,release,getVector:()=>({
   x:state.x,z:state.z,active:state.active})});
 }
 return Object.freeze({create,vector});
});
