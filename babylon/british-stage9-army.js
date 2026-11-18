/* Battlefield · British stage 9/10 · independent army casting and squad.
 * Prepares 1 Allied hero + 11 British soldiers for the same approved battle
 * rules and IK/Quaternius path. Does NOT create counterfeit British skins.
 * All 3D soldier spawns are gated behind exact-source, license, rig and
 * headwear validation, including an explicit independent-skinned-rig check.
 */
(function(root,factory){
 const api=factory();
 if(root)root.BattlefieldBritishStage9Army=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const HERO_SLOT=0,ARMY_SLOTS=12,INFANTRY_SLOTS=8,COMMANDO_SLOTS=3;
 const ROLES=Object.freeze(["hero","infantry","commando"]);
 const SOURCE_WEAPONS=Object.freeze({
  "uk-lee-enfield":"Kar98k","uk-sten":"MP40",
  "uk-bren":"MG42","uk-piat":"Panzerschreck"
 });
 const HEADWEAR=Object.freeze({
  infantry:"steel-mk2-helmet",commando:"beret"
 });
 function roleForSlot(slot){
  if(!Number.isInteger(slot)||slot<0||slot>=ARMY_SLOTS)
   throw Error("Unknown British army slot "+slot);
  if(slot===HERO_SLOT)return "hero";
  return slot<=INFANTRY_SLOTS?"infantry":"commando";
 }
 function plan({catalog,pipeline,manifest,presentFiles=[],
  bindings={},approvedHeadwear={}}={}){
  if(!catalog?.BLUE_SLOTS||catalog.BLUE_SLOTS.length!==ARMY_SLOTS||
    catalog.BLUE_SLOTS[0]!=="americanHero"||!pipeline?.auditModels)
   throw Error("Require the established twelve-slot Allied casting catalog");
  const rows=pipeline.auditModels({catalog,manifest,presentFiles});
  const choices=pipeline.validateBindings(bindings,rows);
  const byId=new Map(rows.map(r=>[r.id,r]));
  const slots=Object.freeze(catalog.BLUE_SLOTS.map((candidate,slot)=>{
   const role=roleForSlot(slot);
   const chosen=role==="hero"?"americanHero":choices[role].modelId;
   const asset=byId.get(chosen);
   const ready=role==="hero"?
    false:!!(asset?.ready&&approvedHeadwear[role]===true);
   const why=role==="hero"?
    ["Герой сохранён отдельно; эта проверка не переустанавливает героя"]:
    (!chosen?["Выбранный скин роли ещё не назначен"]:[]).concat(
      asset?.reasons||[],approvedHeadwear[role]===true?[]:
      ["Головной убор роли не принят визуально"]
    );
   return Object.freeze({
    slot,role,candidateModelId:candidate,modelId:chosen,
    visualReady:ready,requiresOriginalModel:role!=="hero",
    headwear:HEADWEAR[role]||null,reason:Object.freeze(why)
   });
  }));
  // Catalog slot identity never changes even if both British roles later
  // choose the same licensed mesh: each spawned soldier must have own rig.
  const infantry=slots.filter(x=>x.role==="infantry").length;
  const commando=slots.filter(x=>x.role==="commando").length;
  if(infantry!==INFANTRY_SLOTS||commando!==COMMANDO_SLOTS)
   throw Error("Army casting: expected 8 infantry and 3 commando slots");
  return Object.freeze({slots,sourceModels:rows,
   total:slots.length,hero:1,infantry,commando,
   britishVisualsReady:slots.slice(1).every(x=>x.visualReady),
   readyForGame:false,codeReady:true});
 }
 // Formation-only positions in squad-relative meters. Existing battlefield
 // magnet, combat logic, targeting and user controls stay untouched.
 // The hero stays behind the first three riflemen in turtle formation.
 function positions(mode="turtle",count=ARMY_SLOTS){
  if(mode!=="turtle"&&mode!=="semicircle")throw Error("Unknown formation");
  if(count!==ARMY_SLOTS)throw Error("Squad must retain twelve stable slots");
  const out=[{slot:0,x:0,z:4.5,role:"hero"}];
  if(mode==="turtle"){
   for(let i=1;i<count;i++){
    const k=i-1;
    if(k<3)out.push({slot:i,x:(k-1)*2.1,z:0,role:roleForSlot(i)});
    else {
     const row=Math.floor((k-3)/4),column=(k-3)%4;
     out.push({slot:i,x:(column-1.5)*2.25,z:2.4+row*2.4,role:roleForSlot(i)});
    }
   }
  }else{
   for(let i=1;i<count;i++){
    const angle=(i-1)/Math.max(1,count-2)*Math.PI;
    out.push({slot:i,
     x:Math.round(Math.cos(angle)*7*1000)/1000,
     z:Math.round(Math.sin(angle)*3.3*1000)/1000,
     role:roleForSlot(i)});
   }
  }
  return Object.freeze(out.map(p=>Object.freeze(p)));
 }
 function frontline(active,formation="turtle"){
  if(!Array.isArray(active)||active.length!==ARMY_SLOTS||
   active.some(v=>typeof v!=="boolean"))
   throw Error("Expected twelve explicit living states");
  const pos=positions(formation),front=[1,2,3],roster=[];
  const used=new Set([HERO_SLOT]);
  for(const slot of front){
   if(active[slot]){roster.push({slot,replaces:slot});used.add(slot);continue;}
   const point=pos[slot];
   const replacement=pos.slice(1).filter(x=>active[x.slot]&&!used.has(x.slot))
    .sort((a,b)=>
      Math.hypot(a.x-point.x,a.z-point.z)-
      Math.hypot(b.x-point.x,b.z-point.z)||a.slot-b.slot)[0];
   if(replacement){used.add(replacement.slot);
    roster.push({slot:replacement.slot,replaces:slot});}
  }
  return Object.freeze(roster.map(x=>Object.freeze(x)));
 }
 // We reuse one battle instance and each unit's own inventory and status.
 // No independent, fabricated damage model and no fake soldier meshes.
 function simulation({battleCore,squadCore,random=()=>.5}={}){
  if(!battleCore?.createBattle||!squadCore?.create)
   throw Error("Only original Battlefield battle and squad controllers allowed");
  if(typeof random!=="function")throw Error("Invalid random");
  // Training sandbox only: buying weapons is permitted at base with prices 0.
  // Do NOT export these prices into the actual campaign.
  const prices={MP40:{weapon:0,magazine:0},
   MG42:{weapon:0,magazine:0},Panzerschreck:{weapon:0,magazine:0}};
  const battle=battleCore.createBattle({funds:0,prices,random});
  const initial=positions("turtle");
  const allies=initial.map(p=>battle.addUnit({
   id:"allied-"+p.slot,team:"ally",x:p.x,z:p.z,hp:100
  }));
  const enemies=[0,1,2,3].map(i=>battle.addUnit({
   id:"axis-"+i,team:"axis",x:54,z:(i-1.5)*9,hp:100
  }));
  let disposed=false,formation="turtle";
  const shots=[];
  const squad=squadCore.create({battle,allies,enemies,
   onShot:s=>{shots.push({
    id:s.unit.id,targetId:s.target.id,weapon:s.unit.weapon,
    shotMoving:s.moving,hit:s.result.hit
   });if(shots.length>100)shots.shift();},
   endWhenEliminated:true});
  function guard(){if(disposed)throw Error("Stage9 simulation disposed");}
  function equip(slot,weaponId,{atBase=true}={}){
   guard();
   if(!Number.isInteger(slot)||slot<1||slot>11)
    throw Error("Only British bots have test loadout controls");
   const weapon=SOURCE_WEAPONS[weaponId];
   if(!weapon)throw Error("Only four approved British weapons");
   if(weapon==="Kar98k")return battle.switchWeapon(allies[slot],weapon);
   return battle.buyWeapon(allies[slot],weapon,{atBase});
  }
  function selectEnemy(index){
   guard();const enemy=enemies[index];
   if(!enemy)return {ok:false,reason:"unknown-target"};
   return squad.setFocus(enemy);
  }
  function arrange(mode){
   guard();const pos=positions(mode);
   formation=mode;
   if(squad.snapshot().active)return {ok:false,reason:"stop-before-reforming"};
   for(let i=0;i<allies.length;i++){allies[i].x=pos[i].x;allies[i].z=pos[i].z;}
   return {ok:true,formation};
  }
  function snapshot(){
   guard();
   const base=squad.snapshot();
   return Object.freeze({
    formation,...base,
    alive:allies.map(a=>a.alive),
    fronts:frontline(allies.map(a=>a.alive),formation),
    totalShots:shots.length,events:shots.slice(-6),
    soldiers:base.soldiers.map((s,i)=>Object.freeze({
     ...s,slot:i<ARMY_SLOTS?i:null,
     role:i<ARMY_SLOTS?roleForSlot(i):"axis"
    }))
   });
  }
  function tick(dt){guard();squad.update(dt);return snapshot();}
  return Object.freeze({
   battle,allies,enemies,equip,selectEnemy,arrange,
   start:()=>{guard();return squad.start()},
   stop:()=>{guard();squad.stop();return snapshot()},
   tick,snapshot,dispose(){disposed=true;},
   getTrainingPrices:()=>prices
  });
 }
 function verifyUniqueVisualActors(actors,{headwearApproved={}}={}){
  if(!Array.isArray(actors)||actors.length!==ARMY_SLOTS)
   throw Error("Twelve actors including hero must be visually verified");
  const skeletons=new Set(),clips=new Set(),mounts=new Set();
  for(let i=0;i<actors.length;i++){
   const a=actors[i],role=roleForSlot(i);
   if(a?.slot!==i||a?.role!==role||!a?.skeleton||
     a.skeleton.bones?.length!==65)
    throw Error("Wrong actor slot/role or missing unique 65-bone rig "+i);
   if(skeletons.has(a.skeleton))throw Error("Shared skeleton in squad slot "+i);
   skeletons.add(a.skeleton);
   if(!Array.isArray(a.clips)||a.clips.length!==4||
      a.clips.some(g=>!g||clips.has(g)))
    throw Error("Animation groups shared or missing in squad slot "+i);
   for(const clip of a.clips)clips.add(clip);
   if(!a.weaponMount||mounts.has(a.weaponMount)||
      !a.grip?.ok||a.mountParent!=="mixamorig:Weapon_R")
    throw Error("Shared/invalid two-hand weapon mount "+i);
   mounts.add(a.weaponMount);
   if(i>0&&(!a.originalAssetVerified||!a.licenseVerified||
     !a.skinningVerified||headwearApproved[role]!==true))
    throw Error("Unverified source, rights, skinning or headgear "+i);
  }
  return Object.freeze({ok:true,count:actors.length,
   uniqueSkeletons:skeletons.size,uniqueClips:clips.size,
   uniqueWeaponMounts:mounts.size});
 }
 return Object.freeze({HERO_SLOT,ARMY_SLOTS,INFANTRY_SLOTS,COMMANDO_SLOTS,
  ROLES,SOURCE_WEAPONS,HEADWEAR,roleForSlot,plan,positions,frontline,
  simulation,verifyUniqueVisualActors});
});
