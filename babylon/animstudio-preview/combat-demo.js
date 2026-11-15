/* Battlefield Babylon: playable frame-driven stop/aim/fire preview.
   Enabled only by ?combatDemo=1; does not mutate original GLB or 3.js.
*/
(function(){
'use strict';
if(new URLSearchParams(location.search).get('combatDemo')!=='1')return;
const B=window.BABYLON, viewer=()=>window.__BATTLEFIELD_ANIMATIONS__;
document.body.classList.add('full-body','combat-demo-active');
const css=document.createElement('style');
css.textContent='body.combat-demo-active #viewmode,body.combat-demo-active #handsmode,body.combat-demo-active #credits{display:none} #combat-board{position:fixed;z-index:30;top:calc(env(safe-area-inset-top) + 60px);right:12px;width:min(350px,calc(100vw - 24px));background:#17251eea;color:#eaf2e6;border:1px solid #799276;padding:13px;border-radius:12px;box-shadow:0 9px 28px #0008;font:12px system-ui} #combat-board h2{font-size:17px;margin:0 0 6px} #combat-board p{color:#c4d5bb;margin:0 0 9px;line-height:1.4} #combat-board .actions{display:flex;gap:6px;flex-wrap:wrap} #combat-board button{padding:9px;border-radius:7px;background:#496a49;border:1px solid #91a48d;color:#f3f6f0;font:700 12px system-ui} #combat-board button[aria-pressed=true]{background:#cadcac;color:#19311e} #combat-board button:disabled{opacity:.55} #combat-monitor{white-space:pre-line;background:#2b4130;border-radius:6px;padding:9px;margin-top:9px;line-height:1.5;font-variant-numeric:tabular-nums} #combat-events{margin-top:8px;min-height:24px} #combat-board small{display:block;color:#b6c7b2;margin-top:7px} #combat-progress{height:5px;background:#40593d;border-radius:5px;margin-top:8px;overflow:hidden} #combat-progress span{display:block;height:100%;width:0;background:#ccdea6} @media(max-width:600px){#combat-board{top:auto;bottom:calc(env(safe-area-inset-bottom) + 66px);left:12px;right:12px;width:auto;padding:10px}#combat-board h2{font-size:15px} #combat-board small{display:none} #combat-board button{padding:7px}}';
document.head.appendChild(css);
const box=document.createElement('section');
box.id='combat-board';
box.setAttribute('aria-label','Проверка боевого цикла');
box.innerHTML='<h2>Battlefield · стрелковая стойка</h2>'+
 '<p>Kar98k: остановился → пригнулся → прицелился → выстрел → затвор → бег.</p>'+
 '<div class="actions">'+
 '<button id="combat-kar" aria-pressed="true">Kar98k</button>'+
 '<button id="combat-pz" aria-pressed="false">Panzerschreck*</button>'+
 '<button id="combat-play">▶ Боевой цикл</button>'+
 '<button id="combat-stop">■ Стоп</button>'+
 '<button id="combat-camera">Камера: сверху</button></div>'+
 '<div id="combat-monitor">Загружаю бойца…</div>'+
 '<div id="combat-progress"><span></span></div>'+
 '<div id="combat-events">Стрельба только после остановки.</div>'+
 '<small>* Panzerschreck — временный макет. Сгиб коленей и движение руки у затвора — тестовые процедурные слои, не финальная анимация.</small>';
document.body.appendChild(box);
const el=id=>document.getElementById(id);
let selected='Kar98k',machine=null,scene=null,engine=null,root=null,camera=null;
let active=false,pending=false,ready=false,speed=0,targetSpeed=0,walk=0,overhead=true,flash=null;
const SPEED=.60,ACCEL=3.5,DECEL=5.3;
const demo={ready:false,done:false,posePreserved:false,errors:[],events:[],state:null};
window.__BATTLEFIELD_COMBAT_DEMO__=demo;
function renderTelemetry(st){
 const tr={idle:'Ожидание',run:'Боевой бег',stop:'Торможение',lower:'Пригнулся',
  aim:'Прицеливание',fire:'Выстрел',bolt:'Передёргивает затвор',
  recover:'Возвращается в стойку',resume:'Продолжает бег',complete:'Готово'};
 el('combat-monitor').textContent='Оружие: '+selected+' · '+(tr[st?.phase]||st?.phase||'Ожидание')+
  '\nСкорость: '+speed.toFixed(2)+' м/с · пригнулся: '+Math.round((st?.crouch||0)*100)+
  '% · выстрелов: '+(st?.fired||0)+(selected==='Kar98k'?
  ' · затвор: '+(st?.boltLocked?'закрыт':'открыт'):'');
 el('combat-progress').firstElementChild.style.width=Math.round((st?.progress||0)*100)+'%';
}
function shotFlash(){
 const v=viewer()?.weaponRig?.muzzleWorldPosition;
 if(!Array.isArray(v)||!scene)return;
 const mesh=B.MeshBuilder.CreateSphere('shot muzzle marker',{diameter:.13,segments:8},scene);
 const mat=new B.StandardMaterial('shot flash orange',scene);
 mat.emissiveColor=new B.Color3(1,.60,.08);mat.disableLighting=true;
 mesh.material=mat;mesh.position.set(v[0],v[1],v[2]);
 if(flash){flash.mesh.dispose();flash.mat.dispose()}
 flash={mesh,mat,ttl:.11};
}
function onMarker(marker,st){
 demo.events.push({name:marker.name,frame:marker.frame,phase:marker.phase,
  speed:st.speed,crouch:st.crouch});
 if(marker.name==='shot'){shotFlash();el('combat-events').textContent='ВЫСТРЕЛ · кадр '+marker.frame}
 else if(marker.name==='stop-confirmed')el('combat-events').textContent='Остановка подтверждена · скорость 0';
 else if(marker.name.startsWith('bolt-')){
  const names={'bolt-handle-lift':'Рукоять затвора вверх',
   'bolt-back':'Затвор назад','bolt-forward':'Затвор вперёд',
   'bolt-locked':'Затвор закрыт'};
  el('combat-events').textContent=names[marker.name]||marker.name;
 }
}
function setStage(st){
 if(st.phase==='run'||st.phase==='resume')targetSpeed=SPEED;
 else targetSpeed=0;
 if(viewer()?.loaded&&viewer().weapon===selected){
  const step=machine?.timeline.find(x=>x.id===st.phase);
  viewer().setCombatClip(selected,st.clip,st.phase,step?.frames||30);
 }
 renderTelemetry(st);
}
function setPose(st){
 const v=viewer();if(v?.combatPose){
  v.combatPose.active=true;v.combatPose.crouch=st.crouch;
  v.combatPose.boltProgress=st.phase==='bolt'?st.boltProgress:0;
  v.combatPose.stage=st.phase;
 }
 demo.state=st;renderTelemetry(st);
}
function createMachine(){
 return window.BattlefieldCombatCycle.create({weapon:selected,runSpeed:SPEED,
  speedEpsilon:.055,deceleration:DECEL,measureSpeed:()=>speed,
  requestStop:()=>{targetSpeed=0},
  onStage:setStage,onPose:setPose,onMarker});
}
function placeCamera(){
 if(!camera||!root)return;
 camera.setTarget(new B.Vector3(root.position.x,.97,root.position.z));
 camera.alpha=overhead?.19*Math.PI:Math.PI*.93;
 camera.beta=overhead?.26*Math.PI:Math.PI*.47;
 camera.radius=overhead?4.3:3.4;
}
async function selectWeapon(weapon){
 if(pending)return;
 pending=true;
 for(const id of ['combat-kar','combat-pz','combat-play'])el(id).disabled=true;
 try{
  machine?.stop();active=false;selected=weapon;speed=0;targetSpeed=0;walk=0;
  if(root)root.position.x=0;
  const v=viewer();
  v.combatPose={active:true,crouch:0,boltProgress:0,stage:'idle'};
  await v.show(weapon,'Hold');
  if(weapon==='Kar98k'){
   const response=await fetch('./presets/kar98k-user-v2.json');
   if(!response.ok)throw Error('Не загружен утверждённый хват Kar98k');
   const p=await response.json();
   if(p.weapon!=='Kar98k'||p.model!=='approved-panzergrenadier'||
      Object.keys(p.profile).length!==32)throw Error('Неверный сохранённый профиль');
   const result=v.setMasterPose(p.profile);
   demo.posePreserved=Object.entries(p.profile).every(([k,val])=>result[k]===val);
   if(!demo.posePreserved)throw Error('Исходный хват был изменён');
  }
  machine=createMachine();
  el('combat-kar').setAttribute('aria-pressed',String(weapon==='Kar98k'));
  el('combat-pz').setAttribute('aria-pressed',String(weapon==='Panzerschreck'));
  el('combat-events').textContent='Нажми «Боевой цикл»';
  renderTelemetry(machine.snapshot());placeCamera();
  demo.ready=ready=true;demo.weapon=selected;
 }catch(e){
  demo.errors.push(String(e.stack||e));console.error('combat demo',e);
  el('combat-events').textContent='Ошибка: '+e.message;
 }finally{
  pending=false;
  for(const id of ['combat-kar','combat-pz','combat-play'])el(id).disabled=false;
 }
}
function play(){
 if(!ready||pending)return;
 machine?.stop();machine=createMachine();
 demo.events=[];demo.done=false;
 speed=targetSpeed=SPEED;walk=0;
 if(root)root.position.x=0;
 viewer().combatPose={active:true,crouch:0,boltProgress:0,stage:'run'};
 machine.start();active=true;
}
function stop(){
 machine?.stop();active=false;speed=targetSpeed=0;
 if(viewer()?.combatPose)viewer().combatPose.active=false;
 if(viewer()?.loaded)viewer().setCombatClip(selected,'Hold','idle',30);
 el('combat-events').textContent='Остановлено';
}
el('combat-kar').onclick=()=>selectWeapon('Kar98k');
el('combat-pz').onclick=()=>selectWeapon('Panzerschreck');
el('combat-play').onclick=play;
el('combat-stop').onclick=stop;
el('combat-camera').onclick=()=>{
 overhead=!overhead;placeCamera();
 el('combat-camera').textContent=overhead?'Камера: сверху':'Камера: сбоку';
};
let tries=0;
const timer=setInterval(async()=>{
 const v=viewer();
 if(v?.loaded&&v.weaponRigReady&&window.BattlefieldCombatCycle){
  clearInterval(timer);
  scene=v.scene;engine=scene.getEngine();camera=scene.activeCamera;
  root=scene.getTransformNodeByName('approved-character-display');
  if(!root){demo.errors.push('Soldier root missing');return}
  scene.onBeforeRenderObservable.add(()=>{
   const dt=Math.min(engine.getDeltaTime()/1000,.055);
   if(!Number.isFinite(dt)||dt<=0)return;
   if(active){
    const delta=targetSpeed-speed;
    const rate=delta>0?ACCEL:DECEL;
    speed+=Math.sign(delta)*Math.min(Math.abs(delta),rate*dt);
    if(speed<.055&&targetSpeed===0)speed=0;
    walk+=speed*dt;root.position.x=walk;
    try{
     const st=machine.update(dt);demo.state=st;
     if(st.done){
      active=false;speed=targetSpeed=0;demo.done=true;
      v.combatPose={active:false,crouch:0,boltProgress:0,stage:'complete'};
      el('combat-events').textContent='Цикл завершён: '+st.fired+' выстрел'+
       (selected==='Kar98k'?' · '+st.boltCount+' цикл затвора':'');
     }
    }catch(e){
     demo.errors.push(String(e.stack||e));console.error('combat cycle',e);
     stop();el('combat-events').textContent='Ошибка: '+e.message;
    }
    if(camera)camera.setTarget(new B.Vector3(root.position.x,.97,root.position.z));
   }
   if(flash){
    flash.ttl-=dt;flash.mesh.scaling.setAll(Math.max(.1,flash.ttl/.11));
    if(flash.ttl<=0){flash.mesh.dispose();flash.mat.dispose();flash=null}
   }
  });
  await selectWeapon('Kar98k');
 }else if(++tries>200){clearInterval(timer);demo.errors.push('Combat scene timed out')}
},300);
})();