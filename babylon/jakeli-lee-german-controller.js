/* Battlefield Babylon foundation: approved Panzergrenadier + separate non-destructive weapon IK layer. */
(async function () {
  'use strict';

  const status = document.getElementById('status');
  const error = document.getElementById('error');
  const state = {
    engine: 'Babylon.js', loaded: false, ready: false, error: null,
    meshCount: 0, skinnedMeshes: 0, skeletonBones: 0,
    animationCount: 0, materialCount: 0,
    model: 'Jakeli British Lee-Enfield (German approved controller)', originalMaterials: true
  };
  window.__BABYLON_SOLDIER__ = state;

  function fail(e) {
    state.error = String(e && (e.message || e.stack) || e);
    state.ready = true;
    error.style.display = 'block';
    error.textContent = 'Ошибка загрузки: ' + state.error;
    status.textContent = 'Не удалось загрузить персонажа';
    console.error('Babylon soldier:', e);
  }

  try {
    if (!window.BABYLON || !BABYLON.SceneLoader) throw new Error('Babylon.js не загружен');
    const canvas = document.getElementById('renderCanvas');
    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      powerPreference: 'high-performance'
    });
    engine.setHardwareScalingLevel(Math.max(1, (window.devicePixelRatio || 1) / 1.8));
    state.version = BABYLON.Engine.Version;

    const scene = new BABYLON.Scene(engine);
    // glTF files use RH coordinates. Match them directly rather than adding mirrored meshes.
    scene.useRightHandedSystem = true;
    scene.clearColor = new BABYLON.Color4(0.125, 0.155, 0.135, 1);
    scene.ambientColor = new BABYLON.Color3(0.35, 0.37, 0.35);

    const camera = new BABYLON.ArcRotateCamera(
      'camera', Math.PI * 0.20, Math.PI * 0.47, 3.4,
      new BABYLON.Vector3(0, 0.96, 0), scene);
    camera.lowerRadiusLimit = 1.25;
    camera.upperRadiusLimit = 6;
    camera.lowerBetaLimit = 0.20;
    camera.upperBetaLimit = Math.PI * 0.82;
    camera.wheelDeltaPercentage = 0.015;
    camera.pinchDeltaPercentage = 0.015;
    camera.inertia = 0.70;
    camera.attachControl(canvas, true);
    camera.inputs.attached.pointers.buttons = [0,1,2];

    const ambient = new BABYLON.HemisphericLight('soft ambient', new BABYLON.Vector3(0, 1, 0), scene);
    ambient.intensity = 1.15;
    ambient.diffuse = new BABYLON.Color3(0.91, 0.95, 1);
    ambient.groundColor = new BABYLON.Color3(0.50, 0.51, 0.41);
    const key = new BABYLON.DirectionalLight('front softbox', new BABYLON.Vector3(-0.55,-1,-0.65),scene);
    key.intensity = 1.65; key.diffuse = new BABYLON.Color3(1,0.91,0.79);
    const rim = new BABYLON.DirectionalLight('back softbox',new BABYLON.Vector3(0.35,-0.3,0.85),scene);
    rim.intensity = 0.75; rim.diffuse = new BABYLON.Color3(0.81,0.87,1);

    engine.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => engine.resize());

    // Read the real British Jakeli mesh; leave the approved German source untouched.
    const imported = await BABYLON.SceneLoader.ImportMeshAsync(
      '', '../assets/allied-soldiers/', 'uk-jakeli-prototype-65b.glb', scene);

    const drawable = imported.meshes.filter(m=>m.getTotalVertices && m.getTotalVertices()>0);
    if (drawable.length < 4) throw new Error('Не все элементы оригинальной модели загружены');

    const worldMin = new BABYLON.Vector3(Infinity,Infinity,Infinity);
    const worldMax = new BABYLON.Vector3(-Infinity,-Infinity,-Infinity);
    const distinctMaterials = new Set();

    for (const mesh of drawable) {
      mesh.computeWorldMatrix(true);
      const bounding = mesh.getBoundingInfo().boundingBox;
      worldMin.minimizeInPlace(bounding.minimumWorld);
      worldMax.maximizeInPlace(bounding.maximumWorld);
      if (mesh.material) distinctMaterials.add(mesh.material);
    }

    const rawHeight = worldMax.y-worldMin.y;
    if (!(rawHeight>0 && Number.isFinite(rawHeight))) throw new Error('Некорректные размеры исходной модели');

    // Use the same 1.8 m visual scale as the approved German preview.
    const root = new BABYLON.TransformNode('JakeliLeeGermanController',scene);
    for (const mesh of imported.meshes) if (!mesh.parent) mesh.parent = root;
    for (const transform of (imported.transformNodes || [])) if (!transform.parent) transform.parent = root;
    const factor = 1.8/rawHeight;
    root.scaling.setAll(factor);
    root.position = new BABYLON.Vector3(
      -(worldMin.x+worldMax.x)*.5*factor,
      -worldMin.y*factor,
      -(worldMin.z+worldMax.z)*.5*factor
    );
    root.computeWorldMatrix(true);

    state.meshCount = drawable.length;
    state.skinnedMeshes = drawable.filter(m=>Boolean(m.skeleton)).length;
    state.skeletonBones = Math.max(0,...(imported.skeletons||[]).map(s=>s.bones.length));
    state.materialCount = distinctMaterials.size;
    state.animationCount = (imported.animationGroups||[]).length;
    state.heightMeters = 1.8;
    if (state.skeletonBones < 60 || state.skinnedMeshes < 4)
      throw new Error('Вместо утверждённого 65-костного бойца загружен другой ресурс');
    if (!window.BattlefieldWeaponRig) throw new Error('Модуль оружия не загружен');
    await window.BattlefieldWeaponRig.create({scene, imported, root, state,
      initialWeaponId:'uk-lee-enfield',allowRetargetedSkeleton:true});
    state.loaded = true;
    state.ready = true;
    status.dataset.ready = 'true';
    status.textContent = 'Готово · 4 варианта · выбирайте оружие и позу';
    state.camera = {radius:camera.radius, target:camera.target.asArray()};
    state.referenceRig='approved-german-weapon-rig.js';
    state.modelSource='uk-jakeli-prototype-65b.glb';
    // Compact on-screen acceptance diagnostic for mobile users.
    let lastHud = 0;
    scene.onAfterRenderObservable.add(() => {
      if (!state.weaponRigReady || performance.now() - lastHud < 750) return;
      lastHud = performance.now();
      const d = state.weaponRig;
      const r = Number.isFinite(d.rightGripMeters) ? Math.round(d.rightGripMeters * 100) : '?';
      const l = Number.isFinite(d.leftGripMeters) ? Math.round(d.leftGripMeters * 100) : '?';
      status.textContent = d.error ? ('IK ошибка: ' + d.error)
        : ('Хват R ' + r + ' см · L ' + l + ' см · ' +
          (d.geometricPass ? 'геометрия OK' : 'требуется подгонка'));
    });

  } catch(e) {
    fail(e);
  }
})();
