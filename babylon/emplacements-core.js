/* Crew-served weapons. Existing battle soldiers operate mounts; no extra rigs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldEmplacements=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const CONFIG=Object.freeze({mg:Object.freeze({range:72,minRange:4,arc:Math.PI/3,traverse:1.5,interval:.12,burst:8,pause:1.4,magazine:60,reload:6,damage:18,suppression:2.2}),cannon:Object.freeze({range:105,minRange:18,arc:Math.PI*2/9,traverse:.55,interval:7,burst:1,pause:7,magazine:1,reload:7,damage:90,suppression:3.5,blastRadius:4.5,velocity:65})});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
function create({definitions,allies,enemies,battle,navigation,coverFor=()=>0,onShot=()=>{},random=Math.random}){
 const mounts=definitions.map(d=>({...d,config:CONFIG[d.kind],yaw:d.heading,crew:[null,null],ammo:CONFIG[d.kind].magazine,reload:0,cooldown:0,burst:0,shots:0,target:null}));
 const assigned=new Map(),shells=[];
 const seat=(m,i)=>({x:m.x+(i?1.6:0)*Math.cos(m.heading)-(i?-.4:-1.8)*Math.sin(m.heading),z:m.z-(i?1.6:0)*Math.sin(m.heading)+(i?-.4:-1.8)*Math.cos(m.heading)});
 function assignment(u){const a=assigned.get(u);return a?{mount:a.m,seat:seat(a.m,a.i)}:null;}
 function operating(u){const a=assignment(u);return !!a&&u.alive&&distance(u,a.seat)<.8;}
 function crewUpdate(){
  for(const [u,a] of assigned)if(!u.alive){a.m.crew[a.i]=null;assigned.delete(u);}
  for(const m of mounts)for(let i=0;i<2;i++)if(!m.crew[i]){
   const team=m.team==='blue'?allies:enemies;
   const eligible=team.filter(u=>u.alive&&!u.isHero&&u.id!=='hero'&&!assigned.has(u)).sort((a,b)=>distance(a,m)-distance(b,m));
   if(eligible[0]){m.crew[i]=eligible[0];assigned.set(eligible[0],{m,i});}
  }
 }
 function inSector(m,target){const d=distance(m,target),bearing=Math.atan2(target.x-m.x,target.z-m.z);
  return d>=m.config.minRange&&d<=m.config.range&&Math.abs(angle(bearing-m.heading))<=m.config.arc&&navigation.lineOfSight(m,target);}
 function update(dt){
  for(let i=shells.length-1;i>=0;i--){
   const shell=shells[i];shell.remaining-=dt;if(shell.remaining>0)continue;shells.splice(i,1);
   const {m,gunner,target,impact}=shell,hits=[],other=m.team==='blue'?enemies:allies;
   for(const u of other){
    const r=distance(u,impact);if(!u.alive||r>m.config.blastRadius||!navigation.lineOfSight(impact,u))continue;
    const cover=coverFor(u,impact),amount=m.config.damage*(1-.75*r/m.config.blastRadius)*(1-.6*cover);
    const hit=battle.applyDamage(gunner,u,amount,'field-cannon');if(hit)hits.push(hit);
    u.suppressed=Math.max(u.suppressed,m.config.suppression*(1-.4*cover));
   }
   onShot({unit:gunner,target,mount:m,result:{ok:true,weapon:'Panzerschreck',phase:'impact',hit:hits.length>0,hits,impact,blastRadius:m.config.blastRadius}});
  }
  for(const m of mounts){
   const c=m.config;m.cooldown=Math.max(0,m.cooldown-dt);m.target=null;
   if(!m.crew.every(u=>u?.alive&&operating(u)))continue;
   if(m.reload>0){m.reload=Math.max(0,m.reload-dt);if(m.reload===0)m.ammo=c.magazine;continue;}
   const other=m.team==='blue'?enemies:allies,target=other.filter(u=>u.alive&&inSector(m,u)).sort((a,b)=>distance(a,m)-distance(b,m))[0];
   if(!target)continue;m.target=target.id;
   const bearing=Math.atan2(target.x-m.x,target.z-m.z),turn=angle(bearing-m.yaw);
   m.yaw=angle(m.yaw+Math.max(-c.traverse*dt,Math.min(c.traverse*dt,turn)));
   if(Math.abs(angle(bearing-m.yaw))>.08||m.cooldown>0)continue;
   const gunner=m.crew[0],cover=coverFor(target,m),p=.7*(1-.55*cover)*(gunner.suppressed>0?.55:1);
   if(m.kind==='cannon'){
    const scatter=gunner.suppressed>0?4:1.5,a=random()*Math.PI*2,r=random()*scatter;
    const impact={x:target.x+Math.sin(a)*r,z:target.z+Math.cos(a)*r},duration=distance(m,impact)/c.velocity;
    shells.push({m,gunner,target,impact,remaining:duration});
    onShot({unit:gunner,target,mount:m,result:{ok:true,weapon:'Panzerschreck',phase:'launch',hit:false,hits:[],impact,duration}});
   }else{
    const hit=random()<p;target.suppressed=Math.max(target.suppressed,c.suppression*(1-.4*cover));
    const hits=hit?[battle.applyDamage(gunner,target,c.damage*(1-.3*cover),'stationary-mg')].filter(Boolean):[];
    onShot({unit:gunner,target,mount:m,result:{ok:true,weapon:'MG42',hit,hits,impact:{x:target.x,z:target.z}}});
   }
   gunner.shots++;m.shots++;m.ammo--;m.burst++;
   m.cooldown=m.burst>=c.burst?c.pause:c.interval;if(m.burst>=c.burst)m.burst=0;
   if(!m.ammo)m.reload=c.reload;
  }
 }
 function snapshot(){return mounts.map(m=>({id:m.id,kind:m.kind,team:m.team,x:m.x,z:m.z,yaw:m.yaw,crew:m.crew.map(u=>u?.alive?u.id:null),ready:m.crew.every(u=>u?.alive&&operating(u)),ammo:m.ammo,reload:m.reload,shots:m.shots,target:m.target,range:m.config.range,damage:m.config.damage,reloadSeconds:m.config.reload,arcDegrees:m.config.arc*360/Math.PI}));}
 return {mounts,assignment,operating,crewUpdate,update,snapshot,inSector};
}
return {create,CONFIG};
});
