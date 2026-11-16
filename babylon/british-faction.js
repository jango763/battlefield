/* British combat identity. Renderer-independent: identical battle IDs = exact balance parity.
 * A new British GLB may replace the skin without modifying combat or animation rules.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldBritishFaction=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const BRITISH=Object.freeze({
  Kar98k:Object.freeze({asset:'uk-lee-enfield',name:'Lee-Enfield'}),
  MP40:Object.freeze({asset:'uk-sten',name:'Sten'}),
  MG42:Object.freeze({asset:'uk-bren',name:'Bren'}),
  Panzerschreck:Object.freeze({asset:'uk-piat',name:'PIAT'})
 });
 const GERMAN=Object.freeze({
  Kar98k:'de-kar98k',MP40:'de-mp40',MG42:'de-mg42',Panzerschreck:'de-panzerschreck'
 });
 function sideForSlot(index){
  if(!Number.isInteger(index)||index<0||index>=24)throw Error('Invalid army slot');
  return index<12?'british':'wehrmacht';
 }
 function asset(side,combatWeapon){
  if(!Object.hasOwn(GERMAN,combatWeapon))throw Error('Unknown combat class '+combatWeapon);
  if(side==='british')return BRITISH[combatWeapon].asset;
  if(side==='wehrmacht')return GERMAN[combatWeapon];
  throw Error('Unknown faction '+side);
 }
 function label(side,combatWeapon){
  if(side==='british')return BRITISH[combatWeapon]?.name||combatWeapon;
  return combatWeapon;
 }
 return Object.freeze({BRITISH,GERMAN,sideForSlot,asset,label});
});