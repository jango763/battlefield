/* Original procedural field design: metres in the existing 300x300 map. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldDefenseLayout=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
function create(){
 const trenches=[],obstacles=[],covers=[],positions=[],fortifications=[];
 for(const [team,z,facing] of [['blue',82,1],['red',218,-1]]){
  for(const [i,[a,b]] of [[40,95],[105,141],[159,195],[205,260]].entries()){
   const id='trench-'+team+'-'+i,x=(a+b)/2;
   trenches.push({id,team,x,z,a,b,depth:.85,width:2.4,facing});
   covers.push({id,x,z,hw:(b-a)/2-2,hd:1.15,protection:.8,type:'trench'});
   for(const side of [-1,1])obstacles.push({id:id+'-bank-'+side,x,z:z+side*1.75,hw:(b-a)/2-3,hd:.45,blocksSight:false,type:'trench-bank'});
   for(let sx=a+5;sx<b-4;sx+=4)positions.push({id:id+'-slot-'+sx,x:sx,z,team,cover:.8});
  }
 }
 for(const [team,facing,z] of [['blue',1,108],['red',-1,192]]){
  for(const x of [70,230]){
   const id='sandbags-'+team+'-'+x;
   fortifications.push({id,type:'sandbags',x,z,team,facing});
   obstacles.push({id,x,z,hw:5.4,hd:.55,blocksSight:false,type:'sandbags'});
   covers.push({id,x,z:z-facing*1.5,hw:5.3,hd:1.0,protection:.6,facing,type:'sandbags'});
   for(const dx of [-3,0,3])positions.push({id:id+'-'+dx,x:x+dx,z:z-facing*1.5,team,cover:.6});
  }
  for(const x of [80,220]){
   const bz=team==='blue'?124:176,id='bunker-'+team+'-'+x;
   fortifications.push({id,type:'bunker',x,z:bz,team,facing});
   for(const side of [-1,1]){
    obstacles.push({id:id+'-side-'+side,x:x+side*3,z:bz,hw:.4,hd:3,type:'bunker-wall'});
    for(const f of [-1,1])obstacles.push({id:id+'-wall-'+side+'-'+f,x:x+side*2,z:bz+f*2.7,hw:1,hd:.35,type:'bunker-wall'});
   }
   covers.push({id,x,z:bz,hw:2.5,hd:2.3,protection:.9,type:'bunker'});
   positions.push({id:id+'-gunner',x,z:bz+facing*.6,team,cover:.9});
  }
 }
 for(const [i,[x,z]] of [[96,137],[204,137],[96,163],[204,163],[136,101],[164,199]].entries()){
  fortifications.push({id:'hedgehog-'+i,type:'hedgehog',x,z});
  obstacles.push({id:'hedgehog-'+i,type:'hedgehog',x,z,hw:1.25,hd:1.25,blocksSight:false});
 }
 for(const [i,[x,z]] of [[48,118],[252,118],[48,182],[252,182]].entries()){
  fortifications.push({id:'wire-'+i,type:'wire',x,z});
  obstacles.push({id:'wire-'+i,type:'wire',x,z,hw:6,hd:.8,blocksSight:false});
 }
 // Existing sandbags and wreck silhouettes also provide usable cover.
 for(const [i,[x,z]] of [[86,123],[210,120],[120,175],[190,181],[150,83],[152,220]].entries())
  for(const facing of [-1,1])covers.push({id:'legacy-sandbag-'+i+'-'+facing,x,z:z-facing*1.25,hw:4.7,hd:.7,protection:.55,facing,type:'sandbags'});
 const emplacements=[{id:'mg-blue',kind:'mg',team:'blue',x:132,z:104,heading:0},
  {id:'mg-red',kind:'mg',team:'red',x:168,z:196,heading:Math.PI},
  {id:'gun-blue',kind:'cannon',team:'blue',x:177,z:114,heading:0},
  {id:'gun-red',kind:'cannon',team:'red',x:123,z:186,heading:Math.PI}];
 for(const m of emplacements){
  obstacles.push({id:m.id,type:'emplacement',x:m.x,z:m.z,hw:m.kind==='cannon'?1.15:.6,hd:.55,blocksSight:false});
  const facing=m.team==='blue'?1:-1;
  fortifications.push({id:m.id+'-bags',type:'sandbags',x:m.x,z:m.z+facing*1.8});
  obstacles.push({id:m.id+'-bags',type:'sandbags',x:m.x,z:m.z+facing*1.8,hw:5.4,hd:.55,blocksSight:false});
  covers.push({id:m.id+'-cover',x:m.x,z:m.z-facing*.5,hw:3,hd:1.5,protection:.65,facing,type:'sandbags'});
 }
 return {trenches,obstacles,covers,positions,fortifications,emplacements};
}
function heightAt(layout,x,z){
 for(const t of layout.trenches){
  if(x<t.a||x>t.b||Math.abs(z-t.z)>1.3)continue;
  const ramp=Math.min(1,(x-t.a)/3,(t.b-x)/3),edge=Math.min(1,(1.3-Math.abs(z-t.z))/.15);
  return -t.depth*Math.max(0,ramp)*Math.max(0,edge)||0;
 }
 // Border dunes taper to zero before the road network and settlement.
 // Linear slopes interpolate exactly on the existing ten-metre terrain grid.
 const edgeX=Math.min(x,300-x),edgeZ=Math.min(z,300-z);
 return .17*Math.max(0,10-edgeX)+.12*Math.max(0,10-edgeZ);
}
function coverAt(layout,unit,attacker){
 let best=0;
 for(const c of layout.covers){
  if(Math.abs(unit.x-c.x)>c.hw||Math.abs(unit.z-c.z)>c.hd)continue;
  if(c.facing&&attacker&&(attacker.z-unit.z)*c.facing<0)continue;
  if(c.type==='trench'&&attacker&&Math.hypot(unit.x-attacker.x,unit.z-attacker.z)<3)continue;
  best=Math.max(best,c.protection);
 }return best;
}
return {create,heightAt,coverAt};
});
