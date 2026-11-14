// Side-by-side in-game model review. Original Muster geometry, not a new
// procedural imitation. Source and license: assets/muster-british/LICENSE-MUSTER.txt
// IMPORTANT: Upstream models have fixed poses (no skeleton). This review does
// not replace live infantry, alter the combat simulation or downgrade movement.
const musterBritishPreview={ready:false,loaded:0,errors:[],models:[],positions:[]};
function musterBritishPreviewTick(){
  if(new URLSearchParams(location.search).get('inspect')!=='muster')return;
  if(!musterBritishPreview.ready){
    musterBritishPreview.ready=true;
    const roles=['rifleman','leader','bren'];
    const labels=['СТРЕЛОК · LEE-ENFIELD','КОМАНДИР · STEN','ПУЛЕМЁТЧИК · BREN'];
    const label=document.createElement('div');
    label.id='muster-british-review';
    label.textContent='MUSTER WWII · Загрузка оригинальных британцев…';
    label.style.cssText='position:fixed;top:calc(env(safe-area-inset-top,0px) + 118px);left:8px;z-index:990;background:#25352dee;color:#fff;padding:7px 10px;border:1px solid #a2a58d;border-radius:6px;font:700 12px Arial;pointer-events:none';
    document.body.appendChild(label);
    musterBritishPreview.label=label;
    const loader=new THREE.GLTFLoader();
    roles.forEach((role,i)=>{
      const url=new URL('../assets/muster-british/'+role+'.glb',location.href).href;
      loader.load(url,gltf=>{
        const model=gltf.scene,box=new THREE.Box3().setFromObject(model);
        const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
        if(!Number.isFinite(size.y)||size.y<.7||size.y>10)
          throw new Error('Muster '+role+' invalid height '+size.y);
        // Exporter authored in metres. Keep unit scale and full source gear.
        const scale=1.8/size.y;
        model.scale.setScalar(scale);
        model.position.set(-center.x*scale, -box.min.y*scale, -center.z*scale);
        const slot=new THREE.Group();
        slot.name='MusterWW2_British_'+role;
        slot.add(model);
        slot.position.set(P.x+(i-1)*2.9,0,P.z+4.2);
        slot.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
        scene.add(slot);
        musterBritishPreview.models.push({role,object:slot,source:'muster-ww2',height:size.y,scale,triangles:0});
        musterBritishPreview.loaded++;
        label.textContent='MUSTER WWII · '+musterBritishPreview.loaded+'/3 · '+labels.join(' | ')+' · МОДЕЛИ БЕЗ АНИМАЦИИ';
        window.__musterBritishModels=musterBritishPreview.models;
      },undefined,err=>{
        const message=role+': '+(err?.message||String(err));
        musterBritishPreview.errors.push(message);
        label.textContent='Не загружена модель '+message;
        console.warn('Muster British pilot GLB fallback:',message);
      });
    });
  }
  // Camera is modified ONLY for the dedicated gallery URL.
  cam.position.set(P.x,4.0,P.z-8.2);
  cam.lookAt(P.x,1.35,P.z+4.2);
}
