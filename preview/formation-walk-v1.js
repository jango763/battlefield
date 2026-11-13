// Formation v1 — movement-only replacement for the existing guardUpdate.
// Existing magnet eligibility, capacity, detection and release distances remain unchanged.
const MAGNET_GUARD_CAP=6;
function guardUpdate(){
  for(const u of U){
    if(u.guard&&(u.hp<=0||u.t!==P.side||dst(u,P)>32||u.shop)){
      u.guard=false;u.guardPos=-1;u.slot=null;
    }
  }
  const occupied=new Set(),active=U.filter(u=>u.guard);
  // Stable slots: survivors keep their row/column after casualties.
  for(const u of active){
    if(Number.isInteger(u.guardPos)&&u.guardPos>=0&&u.guardPos<MAGNET_GUARD_CAP&&!occupied.has(u.guardPos)){
      occupied.add(u.guardPos);
    }else u.guardPos=-1;
  }
  for(const u of active){
    if(u.guardPos>=0)continue;
    for(let k=0;k<MAGNET_GUARD_CAP;k++)if(!occupied.has(k)){u.guardPos=k;occupied.add(k);break;}
  }
  if(active.length<MAGNET_GUARD_CAP){
    const free=U.filter(u=>!u.guard&&!u.shop&&u.t===P.side&&!u.cmd&&!u.eng&&u.hp>0&&dst(u,P)<14)
      .sort((a,b)=>dst(a,P)-dst(b,P));
    for(const u of free.slice(0,MAGNET_GUARD_CAP-active.length)){
      const k=Array.from({length:MAGNET_GUARD_CAP},(_,i)=>i).find(i=>!occupied.has(i));
      if(k==null)break;
      u.guard=true;u.guardPos=k;occupied.add(k);
      if(!guardUpdate.said){guardUpdate.said=1;say('🤝 Наёмники вступили в вашу гвардию по контракту');}
    }
  }
  // Facing follows the player's facing rather than the global map axes.
  const angle=Number.isFinite(P.g.rotation.y)?P.g.rotation.y:0;
  const fx=Math.sin(angle),fz=Math.cos(angle),rx=fz,rz=-fx;
  for(const u of U){
    if(!u.guard||u.guardPos<0)continue;
    const column=u.guardPos%3-1,row=Math.floor(u.guardPos/3);
    const ahead=3.7+row*2.5,lateral=column*2.0;
    if(!u.slot)u.slot={x:0,z:0};
    u.slot.x=P.x+fx*ahead+rx*lateral;
    u.slot.z=P.z+fz*ahead+rz*lateral;
  }
}
