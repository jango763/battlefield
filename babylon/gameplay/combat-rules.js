/* Battlefield Babylon: approved damage/range balance and finite special-weapon ammunition.
 * Headless gameplay rules; does not touch approved GLB, IK, combat animation or Three.js.
 * Prices and HE blast radius are supplied by the game economy/level, not hard-coded.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BattlefieldCombatRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SPECS=Object.freeze({
 Kar98k:Object.freeze({range:100,damage:75,criticalChance:.25,unlimited:true,
  accuracy:[[0,.90],[20,.85],[40,.70],[60,.50],[80,.30],[100,1/7]],canFireMoving:false}),
 MP40:Object.freeze({range:60,damage:24,magazine:32,packs:5,reloadMs:2500,reloadMoving:true,
  accuracy:[[0,.75],[20,.75],[40,.55],[60,.25]],canFireMoving:true,movingFactor:.65}),
 MG42:Object.freeze({range:80,damage:45,magazine:100,packs:4,reloadMs:7500,reloadMoving:false,
  accuracy:[[0,.65],[20,.65],[40,.60],[60,.55],[80,.35]],canFireMoving:true,movingFactor:.55,
  causesSuppression:true}),
 Panzerschreck:Object.freeze({range:100,explosionDamage:120,magazine:1,packs:4,
  reloadMs:9000,reloadMoving:false,canFireMoving:false,explosive:true})
});
function validName(name){if(!Object.prototype.hasOwnProperty.call(SPECS,name))throw Error('Unknown weapon '+name)}
function finiteNumber(value){return typeof value==='number'&&Number.isFinite(value)}
function createUnit(id){
 return {id:id??null,hp:100,active:'Kar98k',special:null,reloading:null};
}
function reportAmmo(unit){
 const w=unit.special;if(!w)return {weapon:'Kar98k',infinite:true,loaded:null,reserve:null,total:null};
 return {weapon:w.weapon,infinite:false,loaded:w.loaded,reserve:w.reserve,
  total:w.loaded+w.reserve,max:SPECS[w.weapon].magazine*SPECS[w.weapon].packs,
  active:unit.active===w.weapon};
}
function priceOf(prices,kind,weapon){
 const v=prices?.[kind]?.[weapon];
 return finiteNumber(v)&&v>=0&&Number.isInteger(v)?v:null;
}
function buyWeapon(unit,weapon,wallet,prices){
 validName(weapon);
 if(weapon==='Kar98k')return {ok:false,reason:'rifle-is-free'};
 const price=priceOf(prices,'weapon',weapon);
 if(price===null)return {ok:false,reason:'price-not-configured'};
 if(!finiteNumber(wallet?.balance)||wallet.balance<price)
   return {ok:false,reason:'insufficient-funds'};
 wallet.balance-=price;
 const spec=SPECS[weapon];
 unit.special={weapon,loaded:spec.magazine,reserve:spec.magazine*(spec.packs-1)};
 unit.reloading=null;unit.active=weapon;
 return {ok:true,spent:price,ammo:reportAmmo(unit)};
}
function useRifle(unit){unit.active='Kar98k';return unit.active}
function useSpecial(unit){
 if(!unit.special)return {ok:false,reason:'not-equipped'};
 if(unit.reloading)return {ok:false,reason:'reloading'};
 if(unit.special.loaded===0)
   return {ok:false,reason:unit.special.reserve>0?'reload-required':'out-of-ammo'};
 unit.active=unit.special.weapon;return {ok:true,weapon:unit.active};
}
function hitChance(weapon,distance,{moving=false,coverFactor=1}={}){
 validName(weapon);const s=SPECS[weapon];
 if(s.explosive)throw Error('Rocket uses projectile explosion, not bullet accuracy');
 if(!finiteNumber(distance)||distance<0)throw Error('Invalid distance');
 if(distance>s.range)return 0;
 const anchors=s.accuracy;
 let value=anchors[anchors.length-1][1];
 for(let i=1;i<anchors.length;i++){
   if(distance<=anchors[i][0]){
     const [x0,y0]=anchors[i-1], [x1,y1]=anchors[i];
     value=y0+(y1-y0)*(distance-x0)/(x1-x0);break;
   }
 }
 if(!finiteNumber(coverFactor)||coverFactor<0||coverFactor>1)throw Error('Invalid cover factor');
 return Math.max(0,Math.min(1,value*coverFactor*(moving?(s.movingFactor??1):1)));
}
function fireAt(unit,{distance,moving=false,coverFactor=1,rollHit=Math.random,
  rollCritical=Math.random}={}){
 const name=unit.active;validName(name);
 const s=SPECS[name];
 if(!finiteNumber(distance)||distance<0)throw Error('Invalid distance');
 if(distance>s.range)return {ok:false,reason:'out-of-range',weapon:name};
 if(moving&&!s.canFireMoving)return {ok:false,reason:'must-stop',weapon:name};
 if(unit.reloading&&unit.reloading.weapon===name)
   return {ok:false,reason:'reloading',weapon:name};
 if(name!=='Kar98k'){
   const stock=unit.special;
   if(!stock||stock.weapon!==name)throw Error('Invalid equipped weapon state');
   if(stock.loaded===0){
     if(stock.reserve===0){unit.active='Kar98k';return {ok:false,reason:'out-of-ammo',fallback:'Kar98k'};}
     return {ok:false,reason:'reload-required',weapon:name};
   }
   stock.loaded--;
 }
 // The last paid round immediately switches to the permanent free rifle.
 const fallback=name!=='Kar98k'&&unit.special.loaded===0&&unit.special.reserve===0;
 if(fallback)unit.active='Kar98k';
 if(s.explosive)
   return {ok:true,weapon:name,projectile:true,explosionDamage:s.explosionDamage,
     fallback:fallback?'Kar98k':null,ammo:reportAmmo(unit)};
 const chance=hitChance(name,distance,{moving,coverFactor});
 const hit=rollHit()<chance;
 const critical=hit&&name==='Kar98k'&&rollCritical()<s.criticalChance;
 return {ok:true,weapon:name,hit,critical,damage:hit?(critical?100:s.damage):0,
   accuracy:chance,suppression:!!s.causesSuppression,
   fallback:fallback?'Kar98k':null,ammo:reportAmmo(unit)};
}
function beginReload(unit,now,{moving=false}={}){
 const stock=unit.special;if(!stock)return {ok:false,reason:'not-equipped'};
 const s=SPECS[stock.weapon];
 if(unit.reloading)return {ok:false,reason:'already-reloading'};
 if(moving&&!s.reloadMoving)return {ok:false,reason:'must-stop'};
 if(stock.loaded>=s.magazine)return {ok:false,reason:'magazine-full'};
 if(stock.reserve===0)return {ok:false,reason:'no-reserve-ammo'};
 if(!finiteNumber(now))throw Error('Invalid time');
 unit.reloading={weapon:stock.weapon,endsAt:now+s.reloadMs};
 return {ok:true,endsAt:unit.reloading.endsAt,durationMs:s.reloadMs};
}
function completeReload(unit,now){
 const r=unit.reloading;if(!r)return {ok:false,reason:'not-reloading'};
 if(!finiteNumber(now))throw Error('Invalid time');
 if(now<r.endsAt)return {ok:false,reason:'not-finished',remainingMs:r.endsAt-now};
 const s=SPECS[r.weapon],stock=unit.special;
 if(!stock||stock.weapon!==r.weapon){unit.reloading=null;return {ok:false,reason:'weapon-changed'};}
 const n=Math.min(s.magazine-stock.loaded,stock.reserve);
 stock.loaded+=n;stock.reserve-=n;unit.reloading=null;unit.active=r.weapon;
 return {ok:true,roundsLoaded:n,ammo:reportAmmo(unit)};
}
function cancelReload(unit){unit.reloading=null}
function restockAtBase(unit,wallet,prices,{atBase=false}={}){
 if(!atBase)return {ok:false,reason:'not-at-base'};
 const stock=unit.special;if(!stock)return {ok:false,reason:'no-special-weapon'};
 const s=SPECS[stock.weapon],price=priceOf(prices,'ammoPack',stock.weapon);
 if(price===null)return {ok:false,reason:'price-not-configured'};
 const missing=s.magazine*s.packs-stock.loaded-stock.reserve;
 if(missing<=0)return {ok:true,spent:0,packsBought:0,ammo:reportAmmo(unit)};
 if(!finiteNumber(wallet?.balance)||wallet.balance<0)
   return {ok:false,reason:'invalid-balance'};
 const need=Math.ceil(missing/s.magazine);
 const canBuy=price===0?need:Math.floor(wallet.balance/price);
 const count=Math.min(need,canBuy);
 if(count<=0)return {ok:false,reason:'insufficient-funds'};
 const spent=count*price;wallet.balance-=spent;
 stock.reserve+=Math.min(missing,count*s.magazine);
 // Resupply restores reserve only. The 2.5/7.5/9 s reload still has to finish.
 return {ok:true,spent,packsBought:count,ammo:reportAmmo(unit)};
}
function explosionDamage(distanceFromCenter,radius){
 if(!finiteNumber(radius)||radius<=0)throw Error('Blast radius must be configured');
 if(!finiteNumber(distanceFromCenter)||distanceFromCenter<0)throw Error('Invalid blast distance');
 return Math.round(SPECS.Panzerschreck.explosionDamage*
   Math.max(0,1-distanceFromCenter/radius));
}
function applyDamage(target,amount){
 if(!finiteNumber(target?.hp)||!finiteNumber(amount)||amount<0)throw Error('Invalid damage');
 target.hp=Math.max(0,target.hp-amount);
 return {hp:target.hp,dead:target.hp===0};
}
return {SPECS,createUnit,reportAmmo,buyWeapon,useRifle,useSpecial,hitChance,fireAt,
 beginReload,completeReload,cancelReload,restockAtBase,explosionDamage,applyDamage};
});