/* Deterministic 2D navigation in map metres. No renderer or character-rig state.
 * Broad phase buckets + swept circle/AABB tests, sliding, cached 8-way A*.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldNavigation=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function segmentBox(a,b,o,pad=0){
 let lo=0,hi=1;
 for(const k of ['x','z']){
  const h=(k==='x'?o.hw:o.hd)+pad,d=b[k]-a[k],min=o[k]-h,max=o[k]+h;
  if(Math.abs(d)<1e-10){if(a[k]<min||a[k]>max)return false;continue;}
  let t1=(min-a[k])/d,t2=(max-a[k])/d;if(t1>t2)[t1,t2]=[t2,t1];
  lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return false;
 }
 return true;
}
class Heap{
 constructor(){this.a=[];}
 push(v){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p].f<=v.f)break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}
 pop(){const out=this.a[0],v=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].f<this.a[c].f)c++;if(this.a[c].f>=v.f)break;this.a[i]=this.a[c];i=c;}this.a[i]=v;}return out;}
}
function create({obstacles=[],size=300,radius=.42,cell=1}={}){
 const buckets=new Map(),bucketSize=10,N=Math.ceil(size/cell)+1;
 let version=0,knownCount=-1;const cache=new WeakMap();
 const stats={paths:0,expanded:0,blockedMoves:0,unreachable:0};
 function key(x,z){return x+','+z;}
 function invalidate(){
  buckets.clear();for(const o of obstacles){
   if(o.solid===false)continue;
   for(let x=Math.floor((o.x-o.hw)/bucketSize);x<=Math.floor((o.x+o.hw)/bucketSize);x++)
    for(let z=Math.floor((o.z-o.hd)/bucketSize);z<=Math.floor((o.z+o.hd)/bucketSize);z++){
     const k=key(x,z);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(o);
    }
  }knownCount=obstacles.length;version++;
 }
 function nearby(a,b,pad){
  if(knownCount!==obstacles.length)invalidate();const out=new Set();
  for(let x=Math.floor((Math.min(a.x,b.x)-pad)/bucketSize);x<=Math.floor((Math.max(a.x,b.x)+pad)/bucketSize);x++)
   for(let z=Math.floor((Math.min(a.z,b.z)-pad)/bucketSize);z<=Math.floor((Math.max(a.z,b.z)+pad)/bucketSize);z++)
    for(const o of buckets.get(key(x,z))||[])out.add(o);
  return out;
 }
 function inside(p,r=radius){return p.x>=r&&p.z>=r&&p.x<=size-r&&p.z<=size-r;}
 function clear(a,b,r=radius,sight=false){
  if(!inside(b,sight?0:r))return false;
  for(const o of nearby(a,b,r)){
   if(sight&&o.blocksSight===false)continue;
   if(segmentBox(a,b,o,r))return false;
  }return true;
 }
 function free(p,r=radius){return inside(p,r)&&clear(p,p,r);}
 function nearestFree(p){
  const q={x:clamp(p.x,radius,size-radius),z:clamp(p.z,radius,size-radius)};
  if(free(q))return q;
  for(let r=cell;r<=30;r+=cell)for(let i=0;i<32;i++){
   const a=i*Math.PI/16,v={x:q.x+Math.cos(a)*r,z:q.z+Math.sin(a)*r};if(free(v))return v;
  }return null;
 }
 function slide(u,dx,dz){
  if(!Number.isFinite(dx+dz))return false;
  const before={x:u.x,z:u.z};const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.22));
  // Exact segment tests prevent tunnelling even at the 120 ms frame cap.
  for(let i=0;i<steps;i++){
   const p={x:clamp(u.x+dx/steps,radius,size-radius),z:clamp(u.z+dz/steps,radius,size-radius)};
   if(clear(u,p)){u.x=p.x;u.z=p.z;continue;}
   stats.blockedMoves++;
   const px={x:p.x,z:u.z},pz={x:u.x,z:p.z};
   if(Math.abs(dx)>Math.abs(dz)){
    if(clear(u,px))u.x=px.x;if(clear(u,{x:u.x,z:p.z}))u.z=p.z;
   }else{if(clear(u,pz))u.z=pz.z;if(clear(u,{x:p.x,z:u.z}))u.x=p.x;}
  }
  return Math.hypot(u.x-before.x,u.z-before.z)>.0001;
 }
 function route(start,target){
  stats.paths++;const goal=nearestFree(target);if(!goal||!free(start))return [];
  if(clear(start,goal))return [goal];
  const idx=(x,z)=>z*N+x,point=id=>({x:(id%N)*cell,z:Math.floor(id/N)*cell});
  function gridPoint(p){
   const x=Math.round(p.x/cell),z=Math.round(p.z/cell);
   for(let r=0;r<5;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    const v={x:(x+dx)*cell,z:(z+dz)*cell};
    if(free(v)&&clear(p,v))return idx(x+dx,z+dz);
   }return null;
  }
  const s=gridPoint(start),g=gridPoint(goal);if(s===null||g===null)return [];
  const open=new Heap(),cost=new Map([[s,0]]),parent=new Map(),closed=new Set();
  open.push({id:s,f:0});let found=false,expanded=0;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  while(open.a.length&&expanded<20000){
   const {id}=open.pop();if(closed.has(id))continue;if(id===g){found=true;break;}
   closed.add(id);expanded++;const a=point(id);
   for(const [dx,dz] of dirs){
    const b={x:a.x+dx*cell,z:a.z+dz*cell};
    if(!clear(a,b))continue;const n=idx(Math.round(b.x/cell),Math.round(b.z/cell));
    if(closed.has(n))continue;const c=cost.get(id)+Math.hypot(dx,dz)*cell;
    if(c>=(cost.get(n)??Infinity))continue;cost.set(n,c);parent.set(n,id);
    open.push({id:n,f:c+Math.hypot(b.x-goal.x,b.z-goal.z)});
   }
  }
  stats.expanded+=expanded;if(!found){stats.unreachable++;return [];}
  const raw=[goal];for(let at=g;at!==s;at=parent.get(at))raw.push(point(at));raw.push(point(s));raw.reverse();
  const smooth=[];let from=start,i=0;
  while(i<raw.length){let j=i;while(j+1<raw.length&&clear(from,raw[j+1]))j++;smooth.push(raw[j]);from=raw[j];i=j+1;}
  return smooth;
 }
 function follow(u,goal,speed,dt,stop=.3){
  if(Math.hypot(goal.x-u.x,goal.z-u.z)<=stop)return false;
  if(knownCount!==obstacles.length)invalidate();
  let c=cache.get(u);const changed=!c||c.version!==version||Math.hypot(c.goal.x-goal.x,c.goal.z-goal.z)>2;
  if(changed){c={goal:{...goal},path:route(u,goal),version};cache.set(u,c);}
  if(!c.path.length)return false;
  while(c.path.length>1&&Math.hypot(c.path[0].x-u.x,c.path[0].z-u.z)<.2)c.path.shift();
  if(c.path.length>1&&clear(u,c.path[1]))c.path.shift();
  let p=c.path[0];
  if(c.path.length===1&&free(goal)&&clear(u,goal))p=goal;
  if(!clear(u,p)){cache.delete(u);return false;}
  const d=Math.hypot(p.x-u.x,p.z-u.z),remaining=Math.max(0,d-(c.path.length===1?stop:0));
  if(remaining<.001)return false;const amount=Math.min(speed*dt,remaining);
  return slide(u,(p.x-u.x)/d*amount,(p.z-u.z)/d*amount);
 }
 invalidate();return {obstacles,stats,invalidate,free,clear,nearestFree,slide,route,follow,
  lineOfSight:(a,b)=>clear(a,b,0,true)};
}
return {create,segmentBox};
});
