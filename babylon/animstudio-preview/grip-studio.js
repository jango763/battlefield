/* Isolated Kar98k master-grip authoring interface. No gameplay changes. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('gripStudio')!=='1')return;
document.body.classList.add('full-body');
const style=document.createElement('style');
style.textContent='#panel{display:none!important} #master-grip{position:fixed;z-index:30;bottom:calc(env(safe-area-inset-bottom) + 62px);left:12px;width:min(350px,calc(100vw - 24px));max-height:66vh;overflow:auto;background:#17251ef2;color:#f2f4e9;border:1px solid #718875;border-radius:12px;box-shadow:0 9px 30px #0009;font:12px system-ui} #master-grip summary{position:sticky;top:0;padding:12px;background:#304936;font-weight:800;font-size:14px;cursor:pointer} #master-grip .content{padding:11px;display:grid;gap:8px} #master-grip .item{display:grid;grid-template-columns:110px 1fr 52px;gap:7px;align-items:center} #master-grip input[type=range]{width:100%;accent-color:#c5d2a1} #master-grip output{text-align:right;font-variant-numeric:tabular-nums} #master-grip .buttons{display:flex;gap:5px;flex-wrap:wrap} #master-grip button{background:#496645;color:#f5f5ec;border:1px solid #81977f;border-radius:7px;padding:8px;font-size:12px;font-weight:700} #master-grip textarea{width:100%;height:70px;background:#101d14;color:#cde0c8;border:1px solid #5b775d;border-radius:6px;font:10px monospace;padding:5px} #master-grip .note{color:#bbcbbb;line-height:1.4} #master-grip #master-metrics{background:#2b4131;padding:7px;border-radius:6px;line-height:1.5;font-variant-numeric:tabular-nums}@media(max-width:600px){#master-grip{max-height:48vh;bottom:calc(env(safe-area-inset-bottom) + 52px)}}';
document.head.appendChild(style);
const details=document.createElement('details');details.id='master-grip';details.open=true;
const summary=document.createElement('summary');summary.textContent='Kar98k · студия мастер-хвата';
details.appendChild(summary);
const content=document.createElement('div');content.className='content';details.appendChild(content);
document.body.appendChild(details);
const note=document.createElement('div');note.className='note';
note.textContent='Настройка оригинального бойца. Исходный GLB и игровые анимации не изменяются.';
content.appendChild(note);
const actions=document.createElement('div');actions.className='buttons';
actions.innerHTML='<button id="master-aim">Прицел</button><button id="master-run">Бег</button><button id="master-focus">Кисти крупно</button><button id="master-reset">Сброс</button>';
content.appendChild(actions);
const ranges=[
 ['rightPitch','Наклон кисти',-80,80,1,'°'],
 ['rightYaw','Поворот кисти',-80,80,1,'°'],
 ['rightRoll','Прокрутка',-120,120,1,'°'],
 ['rightOffsetX','Кисть вправо',-.07,.07,.005,'м'],
 ['rightOffsetY','Кисть выше',-.07,.07,.005,'м'],
 ['rightOffsetZ','Кисть вперёд',-.07,.07,.005,'м'],
 ['supportOffsetZ','Левое цевьё',-.12,.12,.005,'м'],
 ['fingerCurl','3 пальца',0,2.6,.05,''],
 ['indexCurl','Указательный',0,2.5,.05,''],
 ['thumbCurl','Большой',0,2.5,.05,'']
];
const controls={};
function sceneState(){return window.__BATTLEFIELD_ANIMATIONS__}
for(const [key,label,min,max,step,unit] of ranges){
 const row=document.createElement('label');row.className='item';
 const name=document.createElement('span');name.textContent=label;
 const slider=document.createElement('input');slider.type='range';
 slider.min=min;slider.max=max;slider.step=step;slider.dataset.key=key;
 const output=document.createElement('output');
 row.append(name,slider,output);content.appendChild(row);
 controls[key]={slider,output,step,unit};
 slider.addEventListener('input',()=>{
  const s=sceneState();if(!s?.masterPoseEnabled)return;
  s.setMasterPose({[key]:Number(slider.value)});refresh();
 });
}
const metrics=document.createElement('div');metrics.id='master-metrics';content.appendChild(metrics);
const exportBtns=document.createElement('div');exportBtns.className='buttons';
exportBtns.innerHTML='<button id="master-copy">Копировать JSON</button><button id="master-import">Применить JSON</button>';
content.appendChild(exportBtns);
const editor=document.createElement('textarea');editor.id='master-json';
editor.setAttribute('aria-label','Мастер-поза Kar98k в JSON');content.appendChild(editor);
function refresh(){
 const s=sceneState();if(!s?.masterPoseEnabled)return;
 const v=s.getMasterPose();
 for(const key of Object.keys(controls)){
  const c=controls[key];c.slider.value=String(v[key]);
  c.output.textContent=Number(v[key]).toFixed(c.step<1?3:0)+c.unit;
 }
 const r=s.weaponRig;
 metrics.textContent='Хват R/L: '+Math.round((r.rightGripMeters||0)*1000)+'/'+
  Math.round((r.leftGripMeters||0)*1000)+' мм; правая кисть: '+
  (r.rightFingerDirectionErrorDegrees??'—')+'°; локти: '+
  (r.rightElbowDegrees??'—')+'° / '+(r.leftElbowDegrees??'—')+'°';
}
let polls=0;
const t=setInterval(async()=>{
 const s=sceneState();
 if(s?.loaded && s.masterPoseEnabled){
  clearInterval(t);
  try{
   await s.show('Kar98k','Aim');s.setWeaponPose('aim');
   refresh();
   document.getElementById('master-aim').onclick=()=>s.show('Kar98k','Aim');
   document.getElementById('master-run').onclick=()=>s.show('Kar98k','Run');
   document.getElementById('master-focus').onclick=()=>document.getElementById('handsmode').click();
   document.getElementById('master-reset').onclick=()=>{s.resetMasterPose();refresh()};
   document.getElementById('master-copy').onclick=async()=>{
    editor.value=JSON.stringify({model:'approved-panzergrenadier',weapon:'Kar98k',
      version:1,profile:s.getMasterPose()},null,2);
    try{await navigator.clipboard.writeText(editor.value)}catch(e){editor.select()}
   };
   document.getElementById('master-import').onclick=()=>{
    try{
     const obj=JSON.parse(editor.value);
     if(obj.weapon!=='Kar98k'||obj.version!==1)throw Error('Неверный формат');
     s.setMasterPose(obj.profile);refresh();
    }catch(e){metrics.textContent='Ошибка: '+e.message}
   };
   window.__BATTLEFIELD_GRIP_STUDIO__={ready:true,update:s.setMasterPose,
    read:s.getMasterPose,reset:s.resetMasterPose,refresh};
   setInterval(refresh,800);
  }catch(e){metrics.textContent='Ошибка: '+e.message;console.error(e)}
 }else if(++polls>200){clearInterval(t);metrics.textContent='Не удалось загрузить солдата'}
},350);
})();