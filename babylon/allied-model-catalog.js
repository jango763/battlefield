/* Battlefield / Allied character casting registry, November 2026.
 * Selected characters are source records, NOT bundled assets. Never substitute
 * the experimental procedural British model as if one of these files existed.
 * The renderer may switch only after verified/legal local GLBs are supplied.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldAlliedModels=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const MODELS=Object.freeze({
  americanHero:Object.freeze({
   id:'americanHero',title:'American Soldier WW2',role:'hero',
   nationality:'american',faction:'british',
   author:'Gangsta brotha (@Crazydud)',
   source:'https://sketchfab.com/3d-models/american-soldier-ww2-8bf29411fd3c4fa5a4e540433bf56106',
   sketchfabUid:'8bf29411fd3c4fa5a4e540433bf56106',
   expectedGlb:'../assets/allied-soldiers/us-hero.glb',
   license:'CC BY 4.0 — attribution required',licenseVerified:true,
   triangles:27000,sourceFormat:'download requires Sketchfab account',
   ready:false
  }),
  britishDanoob:Object.freeze({
   id:'britishDanoob',title:'British Soldier WW2',role:'infantry',
   nationality:'british',faction:'british',author:'Danoob',
   source:'https://sketchfab.com/3d-models/british-soldier-ww2-9891e15cad0245639cf5f52c5f1f6b7c',
   sketchfabUid:'9891e15cad0245639cf5f52c5f1f6b7c',
   expectedGlb:'../assets/allied-soldiers/uk-danoob.glb',
   license:'Unverified; check Sketchfab model page before reuse',
   licenseVerified:false,triangles:null,ready:false
  }),
  britishJakeli:Object.freeze({
   id:'britishJakeli',title:'British Army Soldier WW2',role:'infantry',
   nationality:'british',faction:'british',author:'George Jakeli',
   source:'https://sketchfab.com/3d-models/british-army-soldier-ww2-c3d6038952914362b897138deda762ef',
   sketchfabUid:'c3d6038952914362b897138deda762ef',
   expectedGlb:'../assets/allied-soldiers/uk-jakeli.glb',
   license:'Unverified; check Sketchfab model page before reuse',
   licenseVerified:false,triangles:null,ready:false
  }),
  britishFab:Object.freeze({
   id:'britishFab',title:'WWII British Soldier',role:'heavy-infantry',
   nationality:'british',faction:'british',author:'Pathum Tharaka (Fab)',
   source:'https://www.fab.com/listings/fcb951be-af2e-402f-96d7-2e190e27121b',
   expectedGlb:'../assets/allied-soldiers/uk-fab-optimized.glb',
   license:'Fab listing free; verify acquired license before import',
   licenseVerified:false,triangles:118002,sourceFormat:'FBX, Blender',
   ready:false
  })
 });
 const IDS=Object.freeze(Object.keys(MODELS));
 // The British-controlled army has exactly 12 slots: one US hero + 11 UK bots.
 const BLUE_SLOTS=Object.freeze([
  'americanHero',
  'britishDanoob','britishDanoob','britishDanoob','britishDanoob',
  'britishJakeli','britishJakeli','britishJakeli','britishJakeli',
  'britishFab','britishFab','britishFab'
 ]);
 function forBlueSlot(slot){
  if(!Number.isInteger(slot)||slot<0||slot>=BLUE_SLOTS.length)
   throw Error('Invalid British squad slot');
  return MODELS[BLUE_SLOTS[slot]];
 }
 function byId(id){return MODELS[id]||null}
 const roster=()=>BLUE_SLOTS.map((id,slot)=>Object.freeze({
  slot,characterId:id,title:MODELS[id].title,hero:slot===0,
  ready:MODELS[id].ready
 }));
 return Object.freeze({MODELS,IDS,BLUE_SLOTS,byId,forBlueSlot,roster});
});