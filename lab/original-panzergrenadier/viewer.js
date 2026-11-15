/* Original WW2 Panzergrenadier model preview: no procedural garments, retargeting or recolouring. */
(function(){
 'use strict';
 const status=document.getElementById('info');
 const state={ready:false,error:null,meshes:0,skinnedMeshes:0,bones:0,materials:0,clips:0,source:'Original embedded Panzergrenadier GLB'};
 window.__PANZER_PREVIEW__=state;
 const fail=(e)=>{const message=String(e?.message||e);state.error=message;state.ready=true;status.textContent='Ошибка загрузки: '+message;console.error(e)};
 try{
  if(!window.THREE||!THREE.GLTFLoader||!THREE.OrbitControls)throw Error('Библиотеки просмотра 3D не загрузились');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x202820);
  const camera=new THREE.PerspectiveCamera(38,1,.025,100);
  const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('render'),antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.10;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
  scene.add(new THREE.HemisphereLight(0xe8f1f7,0x69644b,1.05));
  const key=new THREE.DirectionalLight(0xffedd3,2.0);key.position.set(3.5,7,4);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;
  key.shadow.camera.top=5;key.shadow.camera.bottom=-3;key.shadow.normalBias=.025;scene.add(key);
  const fill=new THREE.DirectionalLight(0xc4d5f3,.85);fill.position.set(-3,3,-4);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:0x344436,roughness:1,metalness:0}));
  floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.007;scene.add(floor);
  const controls=new THREE.OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.085;controls.enablePan=false;
  controls.minDistance=.8;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.84;
  let center=new THREE.Vector3(0,1,0),distance=3.2,yaw=35;
  const setView=(deg)=>{yaw=deg;const angle=THREE.MathUtils.degToRad(deg);
    camera.position.set(center.x+distance*Math.sin(angle),center.y+distance*.07,center.z+distance*Math.cos(angle));
    camera.lookAt(center);controls.target.copy(center);controls.update();
  };
  const buttons=[...document.querySelectorAll('[data-view]')];
  const views={front:0,quarter:35,side:90,back:180};
  for(const b of buttons)b.addEventListener('click',()=>{
   for(const x of buttons)x.setAttribute('aria-pressed',String(x===b));
   setView(views[b.dataset.view]??35);
  });
  const resize=()=>{
   const width=window.innerWidth,height=window.innerHeight;camera.aspect=width/height;camera.updateProjectionMatrix();
   renderer.setSize(width,height,false);
  };window.addEventListener('resize',resize);resize();
  function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}
  animate();
  const loader=new THREE.GLTFLoader();
  loader.load('./panzergrenadier-original.glb',gltf=>{
   try{
    const original=gltf.scene;
    const raw=new THREE.Box3().setFromObject(original);
    const span=raw.getSize(new THREE.Vector3());
    if(!(span.y>0&&Number.isFinite(span.y)))throw Error('Некорректные размеры исходного GLB');
    // The source GLB uses a large authoring coordinate system (height ~95).
    // Apply only a top-level DISPLAY scale to 1.8m; no geometry or materials change.
    const viewScale=1.8/span.y;
    original.scale.setScalar(viewScale);
    original.position.y-=raw.min.y*viewScale;
    const normalized=new THREE.Box3().setFromObject(original);
    const size=normalized.getSize(new THREE.Vector3());
    center=normalized.getCenter(new THREE.Vector3());
    const tanHalfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5);
    distance=Math.max(2.8,1.32*size.y/(2*tanHalfFov),1.30*size.x/(2*tanHalfFov*camera.aspect));
    // Leave the original skeleton, poses and source materials untouched.
    const mats=new Set(),bones=new Set();
    original.traverse(node=>{
     if(node.isMesh||node.isSkinnedMesh){
      state.meshes++;if(node.isSkinnedMesh)state.skinnedMeshes++;
      if(node.material){for(const m of Array.isArray(node.material)?node.material:[node.material])mats.add(m)}
      node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;
     }
     if(node.isBone)bones.add(node);
    });
    state.materials=mats.size;state.bones=bones.size;state.clips=gltf.animations.length;
    scene.add(original);
    floor.position.y=normalized.min.y-.018;
    controls.minDistance=Math.max(.5,size.y*.45);
    controls.maxDistance=Math.max(8,size.y*5);
    setView(35);
    status.textContent='Оригинал загружен · '+state.meshes+' частей модели · '+state.bones+' костей · '+state.materials+' материалов. Вращайте пальцем.';
    state.ready=true;
    state.bounds={width:size.x,height:size.y,depth:size.z};
    state.originalMaterials=true;
   }catch(e){fail(e)}
  },(e)=>{if(e.lengthComputable)status.textContent='Загрузка оригинала: '+Math.round(100*e.loaded/e.total)+'%';},fail);
 }catch(e){fail(e)}
})();