/* Cover reservations and field orders for autonomous soldiers only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldTacticalAI=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),ranges={Kar98k:42,MP40:23,MG42:39,Panzerschreck:52};
function create({layout,navigation,design}){
 const occupied=new Map(),reservations=new Map(),decisions=new Map();let stance='auto',holdPoint=null;
 function release(u){const p=reservations.get(u);if(p)occupied.delete(p.id);reservations.delete(u);}
 function setStance(value,point){if(!['auto','hold','attack'].includes(value))return false;stance=value;holdPoint=point?{x:point.x,z:point.z}:null;decisions.clear();return true;}
 function chooseCover(u,threat,anchor,radius){
  for(const [other,p] of reservations)if(!other.alive||dist(other,p)>25)release(other);
  const existing=reservations.get(u);
  if(existing&&dist(existing,anchor)<=radius&&(!threat||design.coverAt(layout,existing,threat)>.1)&&navigation.free(existing))return existing;
  release(u);let best=null,score=Infinity;
  for(const p of layout.positions){
   if(occupied.has(p.id)||dist(p,anchor)>radius||!navigation.free(p))continue;
   if(threat&&(!navigation.lineOfSight(p,threat)||design.coverAt(layout,p,threat)<.1))continue;
   const value=dist(u,p)+(1-p.cover)*8;
   if(value<score){best=p;score=value;}
  }
  if(best){reservations.set(u,best);occupied.set(best.id,u);}return best;
 }
 function decide(u,{side,enemy,farm,dt}){
  const prev=decisions.get(u);
  if(prev&&prev.remaining>0&&prev.enemy===enemy?.id&&prev.suppressed===(u.suppressed>0)){
   prev.remaining-=dt;return prev.plan;
  }
  let plan={goal:farm,speed:1,stop:4.1,state:'advance'};
  const defending=side==='blue'&&stance==='hold';
  if(enemy){
   const cover=chooseCover(u,enemy,defending&&holdPoint?holdPoint:u,defending?14:18);
   const effective=ranges[u.weapon]||42;
   if(cover)plan={goal:cover,speed:u.suppressed>0?.5:.9,stop:.3,state:u.suppressed>0?'suppressed':'take-cover'};
   else if(dist(u,enemy)<=effective){release(u);plan={goal:null,speed:0,stop:0,state:u.suppressed>0?'suppressed':'engage'};}
   else plan={goal:defending?holdPoint:enemy,speed:u.suppressed>0?.45:1,stop:defending?2:effective-.5,state:'attack'};
  }else if(defending&&holdPoint){
   const p=chooseCover(u,null,holdPoint,14);plan={goal:p||holdPoint,speed:1,stop:p?.3:2,state:'hold'};
  }else if(farm?.owner===side){
   const p=chooseCover(u,null,farm,14);plan={goal:p||farm,speed:.85,stop:p?.3:7,state:'defend'};
  }else{release(u);if(side==='blue'&&stance==='attack')plan.state='attack';}
  if(u.suppressed>0)plan.speed=Math.min(plan.speed,.5);
  u.tacticalState=plan.state;decisions.set(u,{plan,remaining:.35,enemy:enemy?.id,suppressed:u.suppressed>0});return plan;
 }
 function snapshot(){const states={};for(const [u,d] of decisions)if(u.alive)states[u.id]=d.plan.state;return {stance,holdPoint,occupied:occupied.size,states};}
 return {decide,setStance,snapshot,release};
}
return {create};
});
