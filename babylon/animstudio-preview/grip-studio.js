/* Kar98k grip studio v2: each hand and finger independently editable.
   Opt-in only (?gripStudio=1). Original GLB and gameplay unchanged. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('gripStudio')!=='1')return;
document.body.classList.add('full-body');
const css=document.createElement('style');
css.textContent='#panel{display:none!important} #master-grip{position:fixed;z-index:30;bottom:calc(env(safe-area-inset-bottom) + 62px);left:12px;width:min(370px,calc(100vw - 24px));max-height:71vh;overflow:auto;background:#17251ef2;color:#f2f4e9;border:1px solid #718875;border-radius:12px;box-shadow:0 9px 30px #0009;font:12px system-ui;-webkit-overflow-scrolling:touch} #master-grip>summary{position:sticky;top:0;z-index:2;padding:12px;background:#304936;font-weight:800;font-size:14px;cursor:pointer} #master-grip .content{padding:11px;display:grid;gap:9px} #master-grip .hand{border:1px solid #6c8468;border-radius:9px;background:#23372b} #master-grip .hand>summary{cursor:pointer;font-weight:800;background:#3d5842;border-radius:8px;padding:11px;font-size:13px} #master-grip .hand-rows{padding:10px;display:grid;gap:8px} #master-grip .subhead{color:#bed0b7;font-weight:700;font-size:11px;margin-top:4px} #master-grip .item{display:grid;grid-template-columns:122px minmax(45px,1fr) 49px;gap:7px;align-items:center;font-size:12px} #master-grip input[type=range]{width:100%;accent-color:#c5d2a1} #master-grip output{text-align:right;font-variant-numeric:tabular-nums;font-size:11px} #master-grip .buttons{display:flex;gap:5px;flex-wrap:wrap} #master-grip button{background:#496645;color:#f5f5ec;border:1px solid #81977f;border-radius:7px;padding:8px;font-size:12px;font-weight:700;touch-action:manipulation} #master-grip button:active{background:#6d8b61} #master-grip textarea{width:100%;height:72px;background:#101d14;color:#cde0c8;border:1px solid #5b775d;border-radius:6px;font:10px monospace;padding:5px} #master-grip .note{color:#bbcbbb;line-height:1.45} #master-grip #master-metrics{background:#2b4131;padding:7px;border-radius:6px;line-height:1.5;font-variant-numeric:tabular-nums} @media(max-width:600px){#master-grip{max-height:54vh;bottom:calc(env(safe-area-inset-bottom) + 52px)} #master-grip .item{grid-template-columns:114px minmax(40px,1fr) 47px}}';
document.head.appendChild(css);
const root=document.createElement('details');root.id='master-grip';root.open=true;
const title=document.createElement('summary');title.textContent='Kar98k · настройка рук';root.appendChild(title);
const content=document.createElement('div');content.className='content';root.appendChild(content);
document.body.appendChild(root);
function make(tag,value,cls){
 const el=document.createElement(tag);
 if(value!==undefined)el.textContent=value;
 if(cls)el.className=cls;
 return el;
}
content.appendChild(make('div','Приклад остаётся у правого плеча. Левую кисть можно передвигать вдоль цевья. Каждый палец сгибается и поворачивается отдельно.','note'));
const actions=make('div',undefined,'buttons');
actions.innerHTML='<button type="button" id="master-aim">Прицел</button><button type="button" id="master-run">Бег</button><button type="button" id="master-full">Весь боец</button><button type="button" id="master-reset">Сброс всего</button>';
content.appendChild(actions);
const controls={};
const digits=[['Thumb','Большой'],['Index','Указательный'],
 ['Middle','Средний'],['Ring','Безымянный'],['Pinky','Мизинец']];
const sides=[['left','ЛЕВАЯ РУКА · цевьё'],['right','ПРАВАЯ РУКА · спуск']];
function sceneState(){return window.__BATTLEFIELD_ANIMATIONS__}
function format(val,unit,step){
 return unit==='см'?(val*100).toFixed(1)+' см':
  Number(val).toFixed(step<1?2:0)+(unit?' '+unit:'');
}
function sliderLine(container,key,label,min,max,step,unit){
 const row=make('label',undefined,'item');
 const name=make('span',label);
 const slider=document.createElement('input'),out=make('output');
 slider.type='range';slider.min=String(min);slider.max=String(max);
 slider.step=String(step);slider.dataset.key=key;
 row.append(name,slider,out);container.appendChild(row);
 controls[key]={slider,out,step,unit};
 slider.addEventListener('input',()=>{
  const s=sceneState();if(!s?.masterPoseEnabled)return;
  s.setMasterPose({[key]:Number(slider.value)});refresh();
 });
}
function addButton(where,id,label,onClick){
 const b=make('button',label);b.type='button';b.id=id;
 b.addEventListener('click',onClick);where.appendChild(b);return b;
}
for(const [side,label] of sides){
 const section=document.createElement('details');
 section.className='hand';section.id='master-'+side;section.open=side==='left';
 section.appendChild(make('summary',label));
 const rows=make('div',undefined,'hand-rows');section.appendChild(rows);
 content.appendChild(section);
 rows.appendChild(make('div','Положение кисти','subhead'));
 for(const [axis,name] of [['Pitch','Наклон'],['Yaw','Поворот'],['Roll','Вращение']]){
  sliderLine(rows,side+axis,name,axis==='Roll'?-120:-80,
    axis==='Roll'?120:80,1,'°');
 }
 for(const [axis,name] of [['X','По горизонтали'],['Y','По высоте'],['Z',
   side==='left'?'Дальше по цевью':'Вперёд/назад']]){
  const limit=side==='left'&&axis==='Z'?[-.15,.38]:[-.12,.12];
  sliderLine(rows,side+'Offset'+axis,name,limit[0],limit[1],.005,'см');
 }
 if(side==='left'){
  const quick=make('div',undefined,'buttons');rows.appendChild(quick);
  addButton(quick,'master-left-forward','Дальше +5 см',()=>{
   const s=sceneState();if(!s?.masterPoseEnabled)return;
   s.setMasterPose({leftOffsetZ:Math.min(.38,s.getMasterPose().leftOffsetZ+.05)});
   refresh();
  });
  addButton(quick,'master-left-back','Назад −5 см',()=>{
   const s=sceneState();if(!s?.masterPoseEnabled)return;
   s.setMasterPose({leftOffsetZ:Math.max(-.15,s.getMasterPose().leftOffsetZ-.05)});
   refresh();
  });
 }
 rows.appendChild(make('div','Каждый палец — отдельный сгиб и разворот','subhead'));
 for(const [digit,name] of digits){
  sliderLine(rows,side+digit+'Curl',name+' · сгиб',0,2.6,.05,'');
  sliderLine(rows,side+digit+'Spread',name+' · разворот',-45,45,1,'°');
 }
 const handButtons=make('div',undefined,'buttons');rows.appendChild(handButtons);
 addButton(handButtons,'master-focus-'+side,'Показать кисть',()=>focusHand(side));
 addButton(handButtons,'master-reset-'+side,'Сбросить эту руку',()=>{
  const s=sceneState();if(!s?.masterPoseEnabled)return;
  s.resetMasterHandPose(side);refresh();
 });
}
const metrics=make('div','Загружаю риг…');metrics.id='master-metrics';content.appendChild(metrics);
const exportRow=make('div',undefined,'buttons');content.appendChild(exportRow);
addButton(exportRow,'master-copy','Скопировать JSON',async()=>{
 const s=sceneState();if(!s?.masterPoseEnabled)return;
 editor.value=JSON.stringify({model:'approved-panzergrenadier',weapon:'Kar98k',
  version:2,profile:s.getMasterPose()},null,2);
 try{await navigator.clipboard.writeText(editor.value)}catch(e){editor.select()}
});
addButton(exportRow,'master-import','Применить JSON',()=>{
 const s=sceneState();if(!s?.masterPoseEnabled)return;
 try{
  const obj=JSON.parse(editor.value);
  if(obj.weapon!=='Kar98k'||![1,2].includes(obj.version)||
    !obj.profile||typeof obj.profile!=='object')
   throw Error('Неверный формат мастер-позы');
  s.setMasterPose(obj.profile);refresh();
 }catch(e){metrics.textContent='Ошибка импорта: '+e.message}
});
const editor=document.createElement('textarea');editor.id='master-json';
editor.setAttribute('aria-label','Настройки обеих кистей и отдельных пальцев в JSON');
content.appendChild(editor);
function focusHand(side){
 const s=sceneState();if(!s?.masterPoseEnabled)return;
 const position=s.weaponRig[side+'HandFocus'];
 if(!Array.isArray(position)||position.length!==3)return;
 const camera=s.scene?.activeCamera;
 if(!camera)return;
 camera.setTarget(new BABYLON.Vector3(...position));camera.radius=1.25;
 camera.alpha=side==='left'?Math.PI*.65:Math.PI*.95;
 document.body.classList.add('full-body');
}
function refresh(){
 const s=sceneState();if(!s?.masterPoseEnabled)return;
 const v=s.getMasterPose();
 for(const [key,c] of Object.entries(controls)){
  if(!Number.isFinite(v[key]))continue;
  c.slider.value=String(v[key]);c.out.textContent=format(v[key],c.unit,c.step);
 }
 const r=s.weaponRig;
 metrics.textContent='Хват: правая '+Math.round((r.rightGripMeters||0)*1000)+
  ' мм · левая '+Math.round((r.leftGripMeters||0)*1000)+
  ' мм; левый локоть '+(r.leftElbowDegrees??'—')+
  '°; приклад у правого плеча: '+(r.stockOnRightShoulder?'да':'проверить');
}
let attempts=0;
const timer=setInterval(async()=>{
 const s=sceneState();
 if(s?.loaded&&s.masterPoseEnabled){
  clearInterval(timer);
  try{
   await s.show('Kar98k','Aim');s.setWeaponPose('aim');refresh();
   document.getElementById('master-aim').onclick=()=>s.show('Kar98k','Aim');
   document.getElementById('master-run').onclick=()=>s.show('Kar98k','Run');
   document.getElementById('master-full').onclick=()=>{
    const cam=s.scene?.activeCamera;
    if(cam){cam.setTarget(new BABYLON.Vector3(0,.94,0));cam.radius=3.1}
   };
   document.getElementById('master-reset').onclick=()=>{s.resetMasterPose();refresh()};
   window.__BATTLEFIELD_GRIP_STUDIO__={
    ready:true,update:s.setMasterPose,read:s.getMasterPose,
    reset:s.resetMasterPose,resetHand:s.resetMasterHandPose,refresh,focusHand
   };
   setInterval(refresh,950);
  }catch(e){metrics.textContent='Ошибка студии: '+e.message;console.error(e)}
 }else if(++attempts>200){clearInterval(timer);metrics.textContent='Не удалось загрузить бойца'}
},350);
})();