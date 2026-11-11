(function(){
// === Preview integration: German WW2 Panzergrenadier (red faction) ===

// Isolated from the RTS gameplay logic. Failures leave original soldiers intact.
const germanPreview={template:null,pending:[],bounds:null,installed:0,limit:8,error:null};
function germanPreviewLabel(message){
  const e=document.getElementById('german-preview-status');if(e)e.textContent=message;
}
function germanSkeletonClone(source){
  // SkeletonUtils.clone equivalent for Three.js r128: remap every skinned mesh
  // onto the corresponding cloned bones rather than sharing source bones.
  const a=[],b=[];source.traverse(x=>a.push(x));
  const dst=source.clone(true);dst.traverse(x=>b.push(x));
  const lookup=new Map();for(let i=0;i<a.length;i++)lookup.set(a[i],b[i]);
  for(let i=0;i<a.length;i++)if(a[i].isSkinnedMesh){
    const original=a[i],cloned=b[i];
    const mapped=original.skeleton.bones.map(bone=>lookup.get(bone));
    if(mapped.some(x=>!x))throw new Error('Скелет: не найдены кости в копии');
    cloned.bind(new THREE.Skeleton(mapped,original.skeleton.boneInverses.map(m=>m.clone())),original.bindMatrix.clone());
    cloned.frustumCulled=false; // avoid skinning-bound culling glitches on mobile
  }
  return dst;
}
function attachGermanSoldier(unit){
  if(unit.t!=='red'||unit.cmd||unit.eng||unit.germanPreview)return;
  if(!germanPreview.template){germanPreview.pending.push(unit);return;}
  if(U.filter(v=>v.germanPreview&&v.hp>0).length>=germanPreview.limit)return;
  let figure;
  try{figure=germanSkeletonClone(germanPreview.template)}
  catch(err){console.warn('Германский солдат не установлен',err);return;}
  const modelHeight=germanPreview.bounds.max.y-germanPreview.bounds.min.y;
  const factor=2.3/Math.max(1,modelHeight);
  figure.scale.setScalar(factor);
  figure.position.y=-germanPreview.bounds.min.y*factor;
  // Rig uses +Z facing forward, matching original RTS unit orientation.
  const bones={};figure.traverse(n=>{if(n.isBone){const k=n.name.toLowerCase();
    for(const [label,needle] of Object.entries({lUp:'leftupleg',rUp:'rightupleg',lKnee:'leftleg_',rKnee:'rightleg_',lArm:'leftarm_',rArm:'rightarm_',lFore:'leftforearm_',rFore:'rightforearm_'}))
      if(k.includes(needle))bones[label]=n;
  }});
  for(const k of Object.keys(bones))bones[k]={bone:bones[k],base:bones[k].rotation.x};
  // Keep selection/shadow ground markers; replace body and weapons visually.
  unit.m.g.traverse(n=>{
    if(n===unit.m.g||!n.isMesh)return;
    if(n.geometry&&('RingGeometry'===n.geometry.type||'PlaneGeometry'===n.geometry.type))return;
    n.visible=false;
  });
  unit.m.g.add(figure);
  unit.germanPreview={figure,bones};
  germanPreview.installed++;
  germanPreviewLabel('🇩🇪 Немецкая 3D-модель: '+germanPreview.installed+' бойцов');
}
function animateGermanSoldier(unit){
  const vis=unit.germanPreview;if(!vis)return;
  const p=(unit.cyc||0)*Math.PI/3,walk=Math.min(1,(unit.sv||0)/5),fire=unit.aim>0;
  const swing=Math.sin(p)*walk;
  for(const [name,shift] of Object.entries({lUp:swing*.48-.13*walk,rUp:-swing*.48-.13*walk,lKnee:Math.max(0,-swing)*.68*walk,rKnee:Math.max(0,swing)*.68*walk,lArm:-.24+(fire?-.3:0)-swing*.15,rArm:-.28+(fire?-.45:0)+swing*.15,lFore:-.18,rFore:-.2})){
    const data=vis.bones[name];if(data)data.bone.rotation.x=data.base+shift;
  }
}
function loadGermanSoldierPreview(){
  if(typeof THREE.GLTFLoader!=='function'){
    germanPreviewLabel('⚠️ GLTFLoader не загружен — старая модель');return;
  }
  try{
    const base64=document.getElementById('preview-german-glb').textContent.trim();
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    new THREE.GLTFLoader().parse(bytes.buffer,'',gltf=>{
      try{
        const figure=gltf.scene;
        figure.updateMatrixWorld(true);
        const bbox=new THREE.Box3().setFromObject(figure);
        if(!Number.isFinite(bbox.min.y)||bbox.max.y<=bbox.min.y)throw new Error('Недопустимые размеры модели');
        germanPreview.template=figure;germanPreview.bounds=bbox;
        const queue=[...germanPreview.pending];germanPreview.pending.length=0;
        for(const unit of queue)if(unit.hp>0)attachGermanSoldier(unit);
        germanPreviewLabel('🇩🇪 Немецкая 3D-модель загружена ('+germanPreview.installed+' бойцов)');
      }catch(error){console.error(error);germanPreviewLabel('⚠️ Немецкая модель: ошибка установки');}
    },error=>{console.error('German GLB',error);germanPreviewLabel('⚠️ Немецкая модель: ошибка загрузки');});
  }catch(error){console.error(error);germanPreviewLabel('⚠️ Немецкая модель: ошибка чтения');}
}
// Start after initial game setup/render so a failed GLB never prevents gameplay.


(function(){
  const status=document.createElement('div');status.id='german-preview-status';status.setAttribute('role','status');
  status.style.cssText='position:fixed;z-index:9;top:90px;right:8px;background:rgba(18,24,17,.78);padding:5px 8px;border:1px solid #b4a57e;border-radius:5px;color:#f0e7c9;font:600 11px Arial,sans-serif;pointer-events:none;max-width:52vw';
  status.textContent='🇩🇪 Немец: загрузка 3D-модели…';document.body.appendChild(status);
  const data=document.createElement('script');data.id='preview-german-glb';data.type='application/octet-stream';
  data.textContent=(window.GERMAN_GLB_PARTS||[]).join('');document.body.appendChild(data);
  delete window.GERMAN_GLB_PARTS;
  const oldMk=mk;
  mk=function(t,cmd,eng){const unit=oldMk(t,cmd,eng);if(t==='red'&&!cmd&&!eng)attachGermanSoldier(unit);return unit};
  const oldAnimate=animSoldier;
  animSoldier=function(o,moving,dt){oldAnimate(o,moving,dt);if(o.t==='red'&&o.germanPreview)animateGermanSoldier(o)};
  for(const unit of U)if(unit.t==='red'&&!unit.cmd&&!unit.eng)attachGermanSoldier(unit);
  setTimeout(loadGermanSoldierPreview,150);
})();

})();
