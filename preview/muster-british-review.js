// Original MIT-licensed Muster WWII British rifleman, leader and Bren gunner.
// Each is the ORIGINAL source-generated GLB, not a handmade approximation.
// Deliberately unrigged: a one-at-a-time visual review, not a gameplay swap.
// Source: https://github.com/Kenton-GMI/muster-ww2
// License: assets/muster-british/LICENSE-MUSTER.txt
const musterBritishPreview={ready:false,loaded:0,errors:[],models:[],selected:0,loading:0,scene:null,camera:null};
function musterBritishSelectRole(index){
  musterBritishPreview.selected=index;
  for(const item of musterBritishPreview.models)
    item.object.visible=item.index===index;
  if(musterBritishPreview.label){
    const names=['СТРЕЛОК · LEE-ENFIELD','КОМАНДИР · STEN','ПУЛЕМЁТЧИК · BREN'];
    const model=musterBritishPreview.models.find(o=>o.index===index);
    musterBritishPreview.label.textContent='MUSTER WWII · '+names[index]+
      (model?' · ОРИГИНАЛЬНАЯ МОДЕЛЬ':' · Загрузка…')+' · БЕЗ АНИМАЦИИ';
    for(const button of musterBritishPreview.buttons||[])
      button.style.background=Number(button.dataset.musterRole)===index?'#6a744a':'#283b2d';
  }
}
function musterBritishPreviewTick(){
  if(new URLSearchParams(location.search).get('inspect')!=='muster')return;
  if(!musterBritishPreview.ready){
    musterBritishPreview.ready=true;
    musterBritishPreview.scene=new THREE.Scene();
    musterBritishPreview.scene.background=null;
    musterBritishPreview.scene.add(new THREE.HemisphereLight(0xffffff,0x675e4a,2.4));
    const sun=new THREE.DirectionalLight(0xfff6db,2.0);
    sun.position.set(-2,5,-4);
    musterBritishPreview.scene.add(sun);
    musterBritishPreview.camera=new THREE.PerspectiveCamera(34,1,.1,50);
    const roles=['rifleman','leader','bren'];
    const names=['Стрелок','Командир','Пулемётчик'];
    const panel=document.createElement('div');
    panel.style.cssText='position:fixed;top:calc(env(safe-area-inset-top,0px) + 115px);left:8px;right:8px;z-index:990;max-width:560px;pointer-events:auto';
    const label=document.createElement('div');
    label.id='muster-british-review';
    label.style.cssText='background:#25352de9;color:#fff;padding:6px 9px;border:1px solid #a2a58d;border-radius:6px;font:700 11px Arial';
    panel.appendChild(label);
    const chooser=document.createElement('div');
    chooser.style.cssText='display:flex;gap:5px;margin-top:5px';
    musterBritishPreview.buttons=names.map((name,i)=>{
      const btn=document.createElement('button');
      btn.type='button';btn.textContent=name;
      btn.dataset.musterRole=String(i);
      btn.style.cssText='flex:1;padding:8px 3px;border:1px solid #aeb8a0;border-radius:4px;background:#283b2d;color:#fff;font:700 11px Arial';
      btn.addEventListener('click',()=>musterBritishSelectRole(i));
      chooser.appendChild(btn);return btn;
    });
    panel.appendChild(chooser);document.body.appendChild(panel);
    musterBritishPreview.label=label;
    musterBritishSelectRole(0);
    // The stock player remains in the simulation but is hidden only
    // in the opt-in one-model gallery (it otherwise blocks the soldiers).
    P.g.visible=false;
    const loader=new THREE.GLTFLoader();
    roles.forEach((role,i)=>{
      const url=new URL('../assets/muster-british/'+role+'.glb',location.href).href;
      loader.load(url,gltf=>{
        const model=gltf.scene,box=new THREE.Box3().setFromObject(model);
        const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
        if(!Number.isFinite(size.y)||size.y<.7||size.y>10)throw Error('Invalid source model height: '+size.y);
        const scale=1.8/size.y;
        model.scale.setScalar(scale);
        model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
        const slot=new THREE.Group();
        slot.name='MusterWW2_British_'+role;
        slot.add(model);
        slot.position.set(0,0,0);
        // Muster +Z is its soldier's front. Face the camera at -Z.
        slot.rotation.y=Math.PI;
        slot.visible=i===musterBritishPreview.selected;
        slot.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
        musterBritishPreview.scene.add(slot);
        musterBritishPreview.models.push({
          index:i,role,object:slot,source:'muster-ww2',
          height:size.y,scale
        });
        musterBritishPreview.loaded++;
        window.__musterBritishModels=musterBritishPreview.models;
        musterBritishSelectRole(musterBritishPreview.selected);
      },undefined,err=>{
        const message=role+': '+(err?.message||String(err));
        musterBritishPreview.errors.push(message);
        label.textContent='ОШИБКА ЗАГРУЗКИ · '+message;
      });
    });
  }
  // Gallery rendered by musterBritishPreviewDraw() after the main scene.
  // This keeps the source GLB visible through map walls, even on iPhone.
}
function musterBritishPreviewDraw(){
  if(!musterBritishPreview.ready||!musterBritishPreview.scene||
      new URLSearchParams(location.search).get('inspect')!=='muster')return;
  const camera=musterBritishPreview.camera;
  camera.aspect=R.domElement.clientWidth/Math.max(1,R.domElement.clientHeight);
  camera.updateProjectionMatrix();
  camera.position.set(0,2.0,-4.1);
  camera.lookAt(0,1.0,0);
  const clear=R.autoClear;
  R.autoClear=false;
  R.clearDepth();
  R.render(musterBritishPreview.scene,camera);
  R.autoClear=clear;
}
