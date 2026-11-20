/* Battlefield: immutable original-character casting for the common Babylon scene.
 * This module maps slots to ACTUAL assets; it never changes a GLB, skin, bind
 * pose, IK profile or author-approved appearance. Experimental != released.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldCharacterSources=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const CHARACTERS=Object.freeze({
  approvedGerman:Object.freeze({
   id:'approvedGerman',side:'wehrmacht',role:'infantry',
   original:'../assets/soldiers/german.glb',
   animated:'./animstudio-preview/models/all-combat-run.glb',
   sourceFile:null,approvedAppearance:true,releaseApproved:true
  }),
  americanHero:Object.freeze({
   id:'americanHero',side:'british',role:'hero',
   original:'../assets/allied-soldiers/us-hero-quaternius.glb',
   animated:'../assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb',
   sourceFile:'us-hero-quaternius-donor-hands-v7.glb',
   approvedAppearance:true,releaseApproved:false
  }),
  britishJakeli:Object.freeze({
   id:'britishJakeli',side:'british',role:'infantry',
   original:'../assets/allied-soldiers/uk-jakeli-mobile-static.glb',
   animated:'../assets/allied-soldiers/uk-jakeli-battle-lod1.glb',
   sourceFile:'uk-jakeli-battle-lod1.glb',
   approvedAppearance:false,releaseApproved:false,
   blocker:'Skinning / bind-pose geometry and two-hand contact still require acceptance'
  }),
  britishCommandoPending:Object.freeze({
   id:'britishFab',side:'british',role:'commando',
   original:null,animated:null,sourceFile:null,
   approvedAppearance:false,releaseApproved:false,
   blocker:'Approved commando source not installed'
  })
 });
 const forSlot=slot=>{
  if(!Number.isInteger(slot)||slot<0||slot>=24)
   throw Error('Invalid common-scene character slot '+slot);
  return slot>=12?CHARACTERS.approvedGerman:slot===0?CHARACTERS.americanHero:
   slot<=8?CHARACTERS.britishJakeli:CHARACTERS.britishCommandoPending;
 };
 function audit(slot,imported){
  const expected=forSlot(slot);
  if(imported&&expected.id!==imported.modelId)
   throw Error('Incorrect character asset in slot '+slot+': '+imported.modelId);
  if(imported&&expected.sourceFile!==imported.sourceFile)
   throw Error('Unexpected GLB file for '+expected.id+': '+imported.sourceFile);
  if(imported&&(!imported.nativeClips||!imported.previewOnly))
   throw Error('Original allied model must use its own native clips in isolated trial');
  if(slot>=12&&imported)throw Error('Original German cannot be replaced');
  const loaded=slot>=12||!!imported;
  return Object.freeze({
   slot,id:expected.id,side:expected.side,role:expected.role,
   original:expected.original,displayGlb:loaded?(imported?expected.animated:expected.animated):null,
   realModelLoaded:loaded,experimental:!expected.releaseApproved,
   releaseApproved:expected.releaseApproved&&!imported,
   blocker:expected.blocker||null
  });
 }
 function validateTrialFiles(files){
  for(const id of ['americanHero','britishJakeli']){
   if(files?.[id]!==CHARACTERS[id].sourceFile)
    throw Error('Source GLB changed without character review: '+id);
  }
  return true;
 }
 return Object.freeze({CHARACTERS,forSlot,audit,validateTrialFiles});
});
