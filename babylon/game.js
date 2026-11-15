/* Battlefield Babylon: primary playable hero and squad scene using the approved animated Panzergrenadier.
 * AssetContainer instantiates independent 65-bone skeletons + 16 clips per unit.
 * Preserves the original GLB/weapon rig and legacy Three.js in its separate main branch.
 */
(async function(){
'use strict';
const $=id=>document.getElementById(id);
const B=window.BABYLON;
const combat=window.BattlefieldBalance;
const tactics=window.BattlefieldSquadController;
const presentation=window.BattlefieldCombatPresentation;
const orders=window.BattlefieldFieldOrders;
const goldRules=window.BattlefieldGoldEconomy;
const worldBuilder=window.BattlefieldWorld300;
const briefing=$('battlefield-brief'),enterButton=$('enter-game'),briefingProgress=$('brief-progress');
const canvas=$('view');
// Retry and menu work even if CDN scripts or the 3D model failed to load.
$('retry').addEventListener('click',()=>location.reload());
$('hud-toggle').addEventListener('click',()=>{
 const panel=$('panel'),closed=panel.classList.toggle('closed');
 $('hud-toggle').setAttribute('aria-pressed',String(!closed));
 $('hud-toggle').textContent=closed?'Меню':'Скрыть';
});
if(!B||!combat||!tactics||!presentation||!orders||!goldRules||!worldBuilder||!window.BattlefieldWeaponRig){
 const message='Не загружены Babylon.js или боевые модули. Проверьте подключение к сети.';
 $('loading').textContent=message;
 $('failure-text').textContent=message;
 $('failure').style.display='block';
 briefingProgress.textContent=message;
 enterButton.textContent='Не удалось загрузить игру';
 return;
}
const META={Kar98k:'de-kar98k',MP40:'de-mp40',MG42:'de-mg42',
 Panzerschreck:'de-panzerschreck'};
const PRICES={MP40:{weapon:100,magazine:15},MG42:{weapon:240,magazine:40},
 Panzerschreck:{weapon:350,magazine:70}};
const UNIT_SCALE=1,BASE_X=-150,BASE_Z=-150;
const SCENARIOS={duel:[1,1],assault:[1,4],squads:[12,12]};
const CLIP_POSES={ready:'Hold',aim:'Aim',fire:'Fire',run:'Run'};
const CLIP_IDS=Object.keys(META).flatMap(w=>Object.values(CLIP_POSES).map(p=>w+'_'+p));
const state={ready:false, loading:true, error:null, models:0, clips:0,
 scenario:'squads',atBase:true,selected:'Kar98k',focus:null, fps:0};
window.__BATTLEFIELD_GAME__=state;
let engine,scene,camera,asset,views=[],battle,controller,allies=[],enemies=[];
let actors=new Map(),fx=[],scenario='squads',atBase=true,world=null;
let statusAt=0,starting=false,fieldOrders=null,terrain=null,destinationMark=null,inputMode='move';
let weaponQueue=[],weaponWorker=false;
let economy=null,gameStarted=false,gamePausedForBriefing=true,lastEconomyBlue=0;
function alertStatus(message){$('event').textContent=message}
enterButton.addEventListener('click',()=>{
 if(!state.ready||gameStarted)return;
 const r=controller.start();
 if(!r.ok){alertStatus('Бой не удалось начать: '+r.reason);return;}
 gameStarted=true;gamePausedForBriefing=false;
 briefing.hidden=true;briefing.setAttribute('aria-hidden','true');
 atBase=false;state.atBase=false;
 alertStatus('Бой начался: британцы 🔵 против Вермахта 🔴. Касайтесь земли, чтобы управлять героем.');
 drawHud();
});
function position(unit,y=0){
 return new B.Vector3(BASE_X+unit.x*UNIT_SCALE,y,BASE_Z+unit.z*UNIT_SCALE);
}
function color(hex){return B.Color3.FromHexString(hex)}
function createWorld(){
 engine=new B.Engine(canvas,true,{powerPreference:'high-performance'});
 engine.setHardwareScalingLevel(Math.max(1,(window.devicePixelRatio||1)/1.7));
 scene=new B.Scene(engine);
 scene.useRightHandedSystem=true;
 scene.skipPointerMovePicking=true;
 scene.clearColor=new B.Color4(.11,.16,.13,1);
 scene.ambientColor=new B.Color3(.25,.29,.23);
 const hemi=new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene);
 hemi.intensity=1.35;
 const sun=new B.DirectionalLight('sun',new B.Vector3(-.5,-1,.3),scene);
 sun.intensity=1.55;sun.diffuse=new B.Color3(1,.94,.83);
 world=worldBuilder.create(scene,B,goldRules.MAP);
 terrain=world.ground;
 destinationMark=B.MeshBuilder.CreateTorus('destination-marker',{diameter:.75,thickness:.055,tessellation:16},scene);
 destinationMark.rotation.x=Math.PI/2;destinationMark.position.y=.055;
 destinationMark.isVisible=false;destinationMark.isPickable=false;
 const markMaterial=new B.StandardMaterial('destination-mat',scene);
 markMaterial.emissiveColor=color('#eed58b');destinationMark.material=markMaterial;

 camera=new B.ArcRotateCamera('camera',Math.PI*.52,1.05,33,
  new B.Vector3(0,.7,-108),scene);
 camera.lowerRadiusLimit=15;camera.upperRadiusLimit=145;
 camera.lowerBetaLimit=.2;camera.upperBetaLimit=1.5;
 camera.wheelDeltaPercentage=.018;camera.pinchDeltaPercentage=.018;
 camera.attachControl(canvas,true);
 scene.onPointerObservable.add(info=>{
  if(info.type!==B.PointerEventTypes.POINTERPICK||!info.pickInfo?.hit)return;
  let mesh=info.pickInfo.pickedMesh;
  while(mesh&&!mesh.metadata?.squadSlot)mesh=mesh.parent;
  if(mesh?.metadata?.squadSlot !== undefined) {
   const slot=Number(mesh.metadata.squadSlot);
   const unit=views[slot]?.unit;
   if(unit?.alive && unit.team==='враг' && controller){
    controller.setFocus(unit);
    alertStatus('Приказ атаковать: '+unit.id);
    drawHud();
   }
   return;
  }
  if(info.pickInfo.pickedMesh===terrain && fieldOrders && state.ready){
   const point=info.pickInfo.pickedPoint;
   if(!point)return;
   if(inputMode==='attack'){
    alertStatus('Выберите врага. Для движения нажмите «Движение».');
    return;
   }
   const x=(point.x-BASE_X)/UNIT_SCALE,z=(point.z-BASE_Z)/UNIT_SCALE;
   const move=fieldOrders.setDestination(x,z);
   if(move.ok){
    destinationMark.position.set(BASE_X+move.destination.x*UNIT_SCALE,.06,
     BASE_Z+move.destination.z*UNIT_SCALE);
    destinationMark.isVisible=true;
    if(gameStarted&&!controller.snapshot().active&&!controller.snapshot().done){
     controller.start();atBase=false;state.atBase=false;
    }
    alertStatus('Приказ: двигаться. Отряд следует за героем.');
   }
  }
 });
 engine.runRenderLoop(frame);
 window.addEventListener('resize',()=>engine.resize());
}
function unitVisual(index,entries){
 const anchor=new B.TransformNode('soldier-anchor-'+index,scene);
 const root=new B.TransformNode('approved-animated-rig-'+index,scene);
 root.parent=anchor;
 const descendants=[...entries.rootNodes];
 for(const n of entries.rootNodes)descendants.push(...n.getDescendants(false));
 const unique=[...new Set(descendants)];
 const meshes=unique.filter(n=>n instanceof B.AbstractMesh);
 const transforms=unique.filter(n=>n instanceof B.TransformNode);
 const drawable=meshes.filter(m=>m.getTotalVertices?.()>0);
 if(drawable.length<4||!entries.skeletons.some(s=>s.bones.length>=60))
  throw Error('У отряда '+(index+1)+' не обнаружена утверждённая 65-костная модель');
 for(const node of entries.rootNodes)if(!node.parent)node.parent=root;
 const min=new B.Vector3(Infinity,Infinity,Infinity);
 const max=new B.Vector3(-Infinity,-Infinity,-Infinity);
 for(const mesh of drawable){
  mesh.computeWorldMatrix(true);
  const box=mesh.getBoundingInfo().boundingBox;
  min.minimizeInPlace(box.minimumWorld);
  max.maximizeInPlace(box.maximumWorld);
 }
 const height=max.y-min.y;
 if(!Number.isFinite(height)||height<=0)throw Error('Некорректная высота копии солдата');
 const factor=1.8/height;
 root.scaling.setAll(factor);
 root.position.set(-.5*(min.x+max.x)*factor,-min.y*factor,
  -.5*(min.z+max.z)*factor);
 const clips=new Map();
 for(const id of CLIP_IDS){
  const matches=entries.animationGroups.filter(group=>group.name.endsWith(id));
  if(matches.length!==1)throw Error('Отряд '+(index+1)+': отсутствует анимация '+id);
  clips.set(id,matches[0]);
 }
 const marker=B.MeshBuilder.CreateDisc('squad-ring-'+index,{radius:.47,tessellation:24},scene);
 marker.parent=anchor;marker.rotation.x=Math.PI/2;marker.position.y=.025;
 const ringMat=new B.StandardMaterial('squad-ring-mat-'+index,scene);
 ringMat.emissiveColor=color(index<12?'#77bcea':'#e98668');ringMat.alpha=.75;
 marker.material=ringMat;marker.isPickable=false;
 const hpBack=B.MeshBuilder.CreatePlane('health-bg-'+index,{width:.8,height:.085},scene);
 hpBack.parent=anchor;hpBack.billboardMode=B.Mesh.BILLBOARDMODE_ALL;
 hpBack.position.y=2.08;
 const hpBgMat=new B.StandardMaterial('health-bg-mat-'+index,scene);
 hpBgMat.emissiveColor=color('#27332a');hpBgMat.disableLighting=true;
 hpBack.material=hpBgMat;hpBack.isPickable=false;
 const hpFill=B.MeshBuilder.CreatePlane('health-fill-'+index,{width:.76,height:.061},scene);
 hpFill.parent=anchor;hpFill.billboardMode=B.Mesh.BILLBOARDMODE_ALL;
 hpFill.position.y=2.081;hpFill.position.z=-.01;
 const hpMat=new B.StandardMaterial('hp-mat-'+index,scene);
 hpMat.emissiveColor=color(index<12?'#8bdaa0':'#e78f6b');
 hpMat.disableLighting=true;hpFill.material=hpMat;hpFill.isPickable=false;
 for(const mesh of drawable)mesh.metadata={...(mesh.metadata||{}),squadSlot:index};
 return {index,anchor,root,entries,clips,imported:{
  meshes,transformNodes:transforms,skeletons:entries.skeletons
 },unit:null,rig:null,clip:null,weapon:'Kar98k',lastPose:null,
  inactive:true,marker,hpBack,hpFill,healthMaterial:hpMat,
  hitEffect:0,animationChanges:0,weaponError:null};
}
const SCENE_SLOTS={
 duel:[0,12],assault:[0,12,13,14,15],
 squads:Array.from({length:24},(_,i)=>i)
};
async function ensureUnits(scenarioName){
 const slots=SCENE_SLOTS[scenarioName];
 if(!slots)throw Error('Неизвестный режим отряда: '+scenarioName);
 if(!asset){
  $('loading').textContent='Загружаю анимированного немецкого стрелка…';
  asset=await B.SceneLoader.LoadAssetContainerAsync(
   './animstudio-preview/models/','all-combat-run.glb',scene);
  if(asset.animationGroups.length<16)
   throw Error('В GLB отсутствуют 16 согласованных боевых анимаций');
 }
 for(const i of slots){
  if(views[i])continue;
  $('loading').textContent='Загружаю бойцов: '+state.models+'/'+slots.length+
   ' · создание №'+(i+1);
  // Preserve exact Mixamo joint names in clone-local hierarchies for IK.
  const entries=asset.instantiateModelsToScene(
    name=>name,false,{doNotInstantiate:true});
  const view=unitVisual(i,entries);
  // A shared skeleton or shared track would animate two actors at once.
  for(const prev of views.filter(Boolean)){
   if(prev.imported.skeletons[0]===view.imported.skeletons[0])
    throw Error('У бойцов общий скелет: клонирование отклонено');
   const clipA=prev.clips.get('Kar98k_Run');
   const clipB=view.clips.get('Kar98k_Run');
   if(clipA===clipB ||
      clipA.targetedAnimations[0]?.target===clipB.targetedAnimations[0]?.target)
    throw Error('У бойцов общая анимация бега');
  }
  // A soldier's existing GLB + 16 clips render without weapon IK.
  // Do not block the *entire game* on several 1.7 MB rifle loads or IK errors.
  view.rig={combatPose:{active:false,stage:'ready',crouch:0,recoilPulse:0}};
  view.anchor.setEnabled(false);
  views[i]=view;state.models++;state.clips+=16;
  weaponQueue.push(view);
  const unit=i<12?allies[i]:enemies[i-12];
  if(state.ready&&unit){assignView(view,unit);actors.set(unit,view);}
  // Allow browser to paint loading progress on mobile between clones.
  await new Promise(resolve=>requestAnimationFrame(resolve));
 }
 $('loading').textContent='Готово: '+state.models+
  ' анимированных бойцов · выберите режим и нажмите «Начать бой»';
}
async function processWeaponQueue(){
 if(weaponWorker||!state.ready)return;
 weaponWorker=true;
 try{
  while(weaponQueue.length){
   const view=weaponQueue.shift();
   if(!view||!view.rig||view.rig.weaponRigReady)continue;
   try{
    const rig=view.rig;
    await window.BattlefieldWeaponRig.create({
     scene,imported:view.imported,root:view.root,state:rig,
     animationDriven:true,bindUI:false,acceptExportSockets:true,
     weaponRoot:'../assets/ww2-weapons/'
    });
    if(!rig.weaponRigReady)throw Error('Двухручный IK не подготовлен');
    const wanted=view.unit?.weapon||view.weapon;
    if(wanted!=='Kar98k'&&rig.equipWeapon)
     await rig.equipWeapon(META[wanted]);
    view.weaponError=null;
   }catch(error){
    // The animated approved soldier stays visible and game logic works.
    view.weaponError=String(error?.message||error);
    console.error('Weapon model for soldier '+(view.index+1),error);
    if(view.index===0)
     alertStatus('Боец загружен, но оружейный IK недоступен: '+view.weaponError);
   }
   // Keep the UI responsive between expensive weapon imports on mobile.
   await new Promise(resolve=>requestAnimationFrame(resolve));
  }
 }finally{weaponWorker=false;}
}
async function chooseScenario(name){
 if(starting||!state.ready)return;
 starting=true;
 for(const button of document.querySelectorAll('button'))button.disabled=true;
 try{
  await ensureUnits(name);
  setup(name);
  void processWeaponQueue();
  const launch=gameStarted?controller.start():{ok:false};
  if(launch.ok){atBase=false;state.atBase=false;}
  alertStatus('Подкрепление прибыло. Нажмите на землю, чтобы управлять отрядом.');
 }catch(error){
  state.error=String(error?.stack||error);
  $('loading').textContent='Не удалось добавить отряд: '+(error?.message||error);
  alertStatus('Подкрепление не загрузилось. Герой остаётся доступен для управления.');
  console.error('Squad load',error);
 }finally{
  starting=false;
  for(const button of document.querySelectorAll('button'))button.disabled=false;
  drawHud();
 }
}
function stopAnimations(view){
 if(view.clip){view.clip.stop();view.clip=null;}
 for(const group of view.clips.values())if(group.isPlaying)group.stop();
 view.lastPose=null;
}
function setClip(view,pose){
 const id=view.weapon+'_'+CLIP_POSES[pose];
 const target=view.clips.get(id);
 if(!target){
  view.weaponError='Нет анимации '+id;
  throw Error(view.weaponError);
 }
 if(view.clip===target)return;
 if(view.clip)view.clip.stop();
 target.start(pose!=='fire',1,target.from,target.to,false);
 view.clip=target;view.animationChanges++;
 view.lastPose=pose;
 view.rig?.setWeaponPose?.(pose);
}
function assignView(view,unit){
 view.unit=unit;view.inactive=!unit;
 if(!unit){
  stopAnimations(view);
  view.anchor.setEnabled(false);
  return;
 }
 view.weapon='Kar98k';
 view.anchor.setEnabled(true);
 view.anchor.position.copyFrom(position(unit));
 view.anchor.rotation.y=unit.team==='враг'?-Math.PI/2:Math.PI/2;
 view.hpFill.scaling.x=1;view.hpFill.position.x=0;
 view.marker.setEnabled(true);
 stopAnimations(view);
 setClip(view,'ready');
 view.rig.combatPose={active:false,stage:'ready',crouch:0,recoilPulse:0};
 // Approved rig starts with Kar98k loaded; avoid duplicate requests.
}
function setup(scenarioName){
 if(!state.ready)return;
 if(!SCENARIOS[scenarioName])throw Error('Unknown scenario');
 controller?.stop();
 scenario=scenarioName;atBase=true;
 if(destinationMark)destinationMark.isVisible=false;
 state.scenario=scenario;state.atBase=true;state.focus=null;
 const [ours,theirs]=SCENARIOS[scenario];
 economy=goldRules.create({onEvent:event=>{
  if(event.type==='central-countdown-start')
   alertStatus('Первый бот погиб! До открытия центральной фермы — 05:00.');
  if(event.type==='central-open')
   alertStatus('ЦЕНТРАЛЬНАЯ ФЕРМА ОТКРЫТА! Захватите её ради большого золота.');
 }});
 lastEconomyBlue=economy.treasury.blue;
 battle=combat.createBattle({funds:goldRules.START_TREASURY,prices:PRICES});
 allies=[];enemies=[];
 const alliesXY=tactics.formation({side:'ally',count:ours});
 const enemiesXY=tactics.formation({side:'enemy',count:theirs,distance:60});
 for(let i=0;i<ours;i++)allies.push(battle.addUnit({
  id:'свой-'+(i+1),team:'свои',...alliesXY[i]}));
 for(let i=0;i<theirs;i++)enemies.push(battle.addUnit({
  id:'враг-'+(i+1),team:'враг',...enemiesXY[i]}));
 for(const u of allies){u.economyTeam='blue';u.isHero=u===allies[0];}
 for(const u of enemies)u.economyTeam='red';
 fieldOrders=orders.create({hero:allies[0],allies,enemies,onArrive:()=>{
  if(destinationMark)destinationMark.isVisible=false;
 }});
 controller=tactics.create({battle,allies,enemies,driveAllies:dt=>fieldOrders.update(dt),
  onShot:drawShot,
  onFinish:result=>alertStatus(result.winner==='allies'?
   'Победа! Отряд удержал позицию. Нажмите «Новый бой» для продолжения.':
   'Отряд разгромлен. Нажмите «Новый бой», чтобы повторить атаку.')
 });
 actors=new Map();
 for(let i=0;i<4;i++){
  if(views[i])assignView(views[i],allies[i]||null);
  if(allies[i])actors.set(allies[i],views[i]);
 }
 for(let i=0;i<4;i++){
  if(views[i+4])assignView(views[i+4],enemies[i]||null);
  if(enemies[i])actors.set(enemies[i],views[i+4]);
 }
 for(const button of document.querySelectorAll('[data-scenario]'))
  button.setAttribute('aria-pressed',String(button.dataset.scenario===scenario));
 state.selected='Kar98k';
 alertStatus('Готов к приказам. Нажмите на землю, чтобы бежать; на врага — атаковать.');
 drawHud();
}
function findActor(){return allies[0]||null}
function addEffect(mesh,ttl,material=null){
 fx.push({mesh,ttl,material});
}
function drawShot({unit,target,result}){
 // Bounties are credited to the killer's army; the hero also earns
 // personal gold, exactly as in the original Three.js economy.
 if(economy && result.hits?.length){
  for(const hit of result.hits){
   if(hit.hp>0)continue;
   const victim=[...allies,...enemies].find(u=>u.id===hit.id);
   if(victim&&!victim.alive){
    // A hero dying must not start the countdown. Either army's first
    // dead BOT starts exactly one five-minute game-time timer.
    economy.reportBotDeath(victim);
    economy.kill(unit.economyTeam,{team:victim.economyTeam},
     {heroKill:unit.isHero,armoured:false});
   }
  }
 }
 const source=actors.get(unit),targetView=actors.get(target);
 if(!source||!targetView)return;
 const muzzle=source.rig?.weaponRig?.muzzleWorldPosition;
 const start=Array.isArray(muzzle)&&muzzle.length===3 ?
  new B.Vector3(...muzzle):source.anchor.position.add(new B.Vector3(0,1.5,0));
 const impact=result.impact?position(result.impact,.7):
  targetView.anchor.position.add(new B.Vector3(0,1.15,0));
 if(!result.hit&&!result.impact)impact.z+=(Math.random()-.5)*1.4;
 const line=B.MeshBuilder.CreateLines('tracer',{
  points:[start,impact]},scene);
 line.color=result.weapon==='Panzerschreck'?color('#ff9945'):
  color(unit.team==='свои'?'#ffe5a0':'#ff866f');
 addEffect(line,result.weapon==='Panzerschreck'?.24:.095);
 if(result.weapon==='Panzerschreck'){
  const diameter=combat.WEAPONS.Panzerschreck.blastRadius*UNIT_SCALE*2;
  const sphere=B.MeshBuilder.CreateSphere('blast',{diameter,segments:10},scene);
  sphere.position.copyFrom(impact);
  const mat=new B.StandardMaterial('blast glow',scene);
  mat.emissiveColor=color('#fd7a2d');mat.alpha=.45;
  sphere.material=mat;sphere.isPickable=false;
  addEffect(sphere,.30,mat);
 }
 if(unit===findActor()){
  const hit=result.hits.length?result.hits.map(h=>h.id+' −'+h.damage+' HP').join(', '):
   'промах';
  alertStatus(result.weapon+': '+hit+(result.lethal?' · СМЕРТЕЛЬНЫЙ ВЫСТРЕЛ':''));
 }
}
function syncVisual(view){
 const unit=view.unit;
 if(!unit)return;
 if(!unit.alive){
  view.marker.setEnabled(false);
  view.hpBack.setEnabled(false);
  view.hpFill.setEnabled(false);
  view.anchor.setEnabled(false);
  stopAnimations(view);
  return;
 }
 view.hpBack.setEnabled(true);view.hpFill.setEnabled(true);
 const nextHP=Math.max(0,unit.hp/unit.maxHp);
 view.hpFill.scaling.x=Math.max(.001,nextHP);
 view.hpFill.position.x=-.38*(1-nextHP);
 view.anchor.position.copyFrom(position(unit));
 const target=controller?.getTarget(unit);
 if(target){
  const deltaX=target.x-unit.x,deltaZ=target.z-unit.z;
  view.anchor.rotation.y=Math.atan2(deltaX,deltaZ);
  if(unit===findActor()&&controller?.isMoving(unit)&&fieldOrders){
   const heading=fieldOrders.snapshot().heading;
   view.anchor.rotation.y=Math.atan2(heading.x,heading.z);
  }
 }
 if(unit.weapon!==view.weapon){
  view.weapon=unit.weapon;
  view.lastPose=null; // Force matching animation after fallback.
  if(view.rig?.equipWeapon){
   view.rig.equipWeapon(META[unit.weapon]).catch(error=>{
    view.weaponError=String(error);
    alertStatus('Оружие не загрузилось: '+error);
   });
  }
 }
 const visual=presentation.describe(unit,{active:!!controller?.snapshot().active,
  moving:controller?.isMoving(unit),shotAge:controller?.shotAge(unit)});
 if(view.lastPose!==visual.pose)setClip(view,visual.pose);
 view.rig.combatPose={active:visual.running||visual.firing,stage:visual.stage,
  crouch:0,recoilPulse:visual.recoilPulse};
 if(visual.stage==='reload'&&view.lastPose==='fire')
  throw Error('Reload incorrectly displaying Fire animation');
}
function drawHud(){
 if(!state.ready||!battle||!controller)return;
 const hero=findActor();
 const snap=controller.snapshot();
 const inventory=hero.weapon==='Kar98k'?null:hero.inventory[hero.weapon];
 const funds=battle.getFunds();
 const econ=economy?.summary();
 const central=econ?.central;
 const left=central?.started?Math.ceil(central.remainingSeconds):0;
 const timerLabel=central?.open?'ОТКРЫТА':
  central?.started?'Откроется через '+String(Math.floor(left/60)).padStart(2,'0')+
   ':'+String(left%60).padStart(2,'0'):
   'ЗАКРЫТА — ждём гибель первого бота';
 $('fight').textContent=atBase?'▶ Продолжить бой':'Ⅱ Пауза / снаряжение';
 $('supply').disabled=!atBase||!hero.alive;
 $('reload-manual').disabled=!hero.alive||hero.weapon==='Kar98k'||
  hero.reloadRemaining>0||!hero.inventory[hero.weapon]?.reserve||
  hero.inventory[hero.weapon]?.loaded>=combat.WEAPONS[hero.weapon].magazineSize;
 for(const button of document.querySelectorAll('[data-weapon]'))
  button.setAttribute('aria-pressed',String(hero.weapon===button.dataset.weapon));
 const paid=Object.keys(hero.inventory).map(w=>w+':'+battle.totalAmmo(hero,w)).join(' · ');
 $('readout').textContent=
  'Бой: '+(snap.active?'ИДЁТ':snap.done?'ЗАВЕРШЁН':'ОЖИДАНИЕ')+
  ' · свои '+snap.alliesAlive+'/'+allies.length+' · враги '+snap.enemiesAlive+'/'+enemies.length+
  '\nГерой: '+Math.round(hero.hp)+'/100 HP · оружие: '+hero.weapon+
  (inventory?' · '+inventory.loaded+'+'+inventory.reserve+' патр.':' · ∞ патронов')+
  (hero.reloadRemaining>0?'\nПерезарядка: '+hero.reloadRemaining.toFixed(1)+' c':'')+
  '\nБританцы 🔵: '+funds+' · Вермахт 🔴: '+(econ?.treasury.red??'—')+
  '\nФермы: '+(econ?.owners.blue.length||0)+' синих · '+(econ?.owners.red.length||0)+' красных'+
  '\nЦентр: '+timerLabel+
  (paid?'\nЗапас: '+paid:'')+
  '\nСтрой: '+(fieldOrders?.snapshot().mode==='semicircle'?'боевой полукруг':'черепаха')+
  '\nВыстрелы героя: '+hero.shots+' · поражено: '+hero.kills+
  '\nFPS: '+Math.round(engine.getFps())+
  (snap.focus?'\nПриоритетная цель: '+snap.focus:'');
 const duration=combat.WEAPONS[hero.reloadWeapon]?.reloadSeconds||0;
 const progress=duration?100*(1-hero.reloadRemaining/duration):0;
 $('reload-fill').style.width=Math.max(0,Math.min(100,progress))+'%';
 state.fps=Math.round(engine.getFps());
}
async function chooseGun(weapon){
 const hero=findActor();
 if(!state.ready||!hero||!combat.WEAPONS[weapon]||!hero.alive)return;
 let result;
 if(weapon==='Kar98k'||hero.inventory[weapon])result=battle.switchWeapon(hero,weapon);
 else result=battle.buyWeapon(hero,weapon,{atBase});
 if(!result.ok){
  alertStatus(result.reason==='return-to-base'?'Оружие покупается на базе.':
   result.reason==='insufficient-funds'?'Недостаточно денег.':
   'Не удалось выбрать оружие: '+result.reason);
  return;
 }
 if(economy&&result.cost>0){
  if(!economy.pay('blue',result.cost))
   throw Error('Несоответствие игровой казны стоимости оружия');
  lastEconomyBlue=economy.treasury.blue;
 }
 state.selected=weapon;
 const visual=actors.get(hero);
 if(visual){
  visual.weapon=weapon;
  if(visual.rig?.equipWeapon){
   await visual.rig.equipWeapon(META[weapon]).catch(e=>{
    visual.weaponError=String(e);alertStatus('Ошибка модели оружия: '+e);
   });
  }
  const snapshot=presentation.describe(hero);
  setClip(visual,snapshot.pose);
 }
 alertStatus('Боец вооружён: '+weapon+' · БК '+(battle.totalAmmo(hero,weapon)||'∞'));
 drawHud();
}
function resupplyHero(){
 const hero=findActor();
 const last=state.selected!=='Kar98k'?state.selected:
  Object.keys(hero.inventory)[0];
 if(!last){alertStatus('Бесплатной Kar98k боеприпасы не требуются.');return;}
 const result=battle.resupply(hero,last,{atBase});
 if(!result.ok){alertStatus('БК не пополнен: '+result.reason);return;}
 if(economy&&result.cost>0){
  if(!economy.pay('blue',result.cost))
   throw Error('Несоответствие игровой казны расходам на БК');
  lastEconomyBlue=economy.treasury.blue;
 }
 alertStatus('Пополнение '+last+': +'+result.added+' за '+result.cost+' монет.');
 drawHud();
}
function registerUI(){
 document.querySelectorAll('[data-scenario]').forEach(button=>
  button.addEventListener('click',()=>chooseScenario(button.dataset.scenario)));
 document.querySelectorAll('[data-weapon]').forEach(button=>
  button.addEventListener('click',()=>chooseGun(button.dataset.weapon)));
 $('fight').addEventListener('click',()=>{
  const hero=findActor();
  if(!hero?.alive){alertStatus('Герой погиб. Нажмите «Сброс».');return;}
  if(atBase){
   const result=controller.start();
   if(!result.ok){alertStatus('Бой не начат: '+result.reason);return;}
   atBase=false;state.atBase=false;alertStatus('Продолжаем бой. Коснитесь земли для движения героя.');
  }else{
   controller.stop();atBase=true;state.atBase=true;
   alertStatus('Пауза: доступна смена оружия и пополнение БК.');
  }
  drawHud();
 });
 $('reset').addEventListener('click',()=>{
  setup(scenario);
  const start=controller.start();
  if(start.ok){atBase=false;state.atBase=false;}
  alertStatus('Новый бой. Выбирайте направление движения касанием земли.');
  drawHud();
 });
 $('supply').addEventListener('click',resupplyHero);
 $('order-move').addEventListener('click',()=>{
  inputMode='move';
  $('order-move').setAttribute('aria-pressed','true');
  $('order-attack').setAttribute('aria-pressed','false');
  alertStatus('Движение: коснитесь земли для приказа.');
 });
 $('order-attack').addEventListener('click',()=>{
  inputMode='attack';
  $('order-move').setAttribute('aria-pressed','false');
  $('order-attack').setAttribute('aria-pressed','true');
  alertStatus('Атака: коснитесь противника для выбора цели.');
 });
 $('reload-manual').addEventListener('click',()=>{
  const r=battle.startReload(findActor());
  alertStatus(r.ok?'Перезарядка началась: '+r.seconds+' с.':
   'Перезарядка невозможна: '+r.reason);
  drawHud();
 });
}
function frame(){
 const dt=Math.max(0,Math.min(.05,engine.getDeltaTime()/1000));
 if(state.ready&&controller){
  if(!gamePausedForBriefing){
   controller.update(dt);
   // Stop economic and unlock clocks while the actual battle is paused
   // (not merely when the map briefing is dismissed).
   if(economy&&controller.snapshot().active){
    economy.update(dt,[...allies,...enemies]);
    // Only newly earned income enters the combat treasury. Purchases
    // deduct from BOTH treasuries, preventing an accidental money refund.
    const credited=economy.treasury.blue-lastEconomyBlue;
    if(credited>0)battle.grantFunds(credited);
    lastEconomyBlue=economy.treasury.blue;
   }
  }
  for(const view of views)if(view?.unit)syncVisual(view);
  const now=performance.now();
  if(now-statusAt>220){statusAt=now;drawHud();}
 }
 for(let i=fx.length-1;i>=0;i--){
  const f=fx[i];f.ttl-=dt;
  if(f.ttl<=0){f.mesh.dispose();f.material?.dispose();fx.splice(i,1);}
 }
 scene.render();
}
try{
 createWorld();
 await ensureUnits('duel'); // Two actors first, not eight blocking the entire UI.
 state.loading=false;state.ready=true;
 for(const el of document.querySelectorAll('button'))el.disabled=false;
 registerUI();
 setup('duel');
 briefingProgress.textContent='Бойцы загружены. Читайте карту и нажмите «В бой».';
 enterButton.disabled=false;
 enterButton.textContent='В бой · начать игру';
 // The first playable frame is available before armature IK/weapon loading.
 void processWeaponQueue();
// Do not start combat under the briefing: player chooses the start time.
 $('loading').textContent='Готово. На заставке нажмите «В бой», когда прочитаете правила.';
 drawHud();
}catch(error){
 state.loading=false;state.error=String(error?.stack||error);
 $('loading').textContent='Ошибка: '+(error?.message||error);
 $('readout').textContent='Не удалось запустить игру. Проверьте загрузку модели.';
 $('failure-text').textContent=(error?.message||String(error));
 $('failure').style.display='block';
 briefingProgress.textContent='Ошибка загрузки: '+(error?.message||error);
 enterButton.textContent='Ошибка загрузки. Перезапустите игру';
 console.error('Battlefield main game',error);
}
})();