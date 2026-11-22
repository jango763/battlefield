/* Original procedural field design: metres in the existing 300x300 map. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldDefenseLayout=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
function create(){
 const trenches=[],obstacles=[],covers=[],positions=[];
 for(const [team,z,facing] of [['blue',82,1],['red',218,-1]]){
  for(const [i,[a,b]] of [[40,95],[105,141],[159,195],[205,260]].entries()){
   const id='trench-'+team+'-'+i,x=(a+b)/2;
   trenches.push({id,team,x,z,a,b,depth:.85,width:2.4,facing});
   covers.push({id,x,z,hw:(b-a)/2-2,hd:1.15,protection:.8,type:'trench'});
   for(const side of [-1,1])obstacles.push({id:id+'-bank-'+side,x,z:z+side*1.75,hw:(b-a)/2-3,hd:.45,blocksSight:false,type:'trench-bank'});
   for(let sx=a+5;sx<b-4;sx+=4)positions.push({id:id+'-slot-'+sx,x:sx,z,team,cover:.8});
  }
 }
 return {trenches,obstacles,covers,positions,emplacements:[]};
}
function heightAt(layout,x,z){
 for(const t of layout.trenches){
  if(x<t.a||x>t.b||Math.abs(z-t.z)>1.3)continue;
  const ramp=Math.min(1,(x-t.a)/3,(t.b-x)/3),edge=Math.min(1,(1.3-Math.abs(z-t.z))/.15);
  return -t.depth*Math.max(0,ramp)*Math.max(0,edge)||0;
 }return 0;
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
