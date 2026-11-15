/* Battlefield Babylon weapon rig v1. Approved Panzergrenadier meshes/textures remain unchanged.
   glTF joint TransformNodes are driven (not their linked bones). See Babylon glTF skinning docs.
   Three licensed GLBs + an explicitly procedural Panzerschreck study, no Panzerfaust. */
(function () {
  'use strict';
  const B = window.BABYLON;
  const ROCKET = {
    trigger: [0, -0.17, -0.23],
    support: [0, -0.135, 0.08],
    muzzle: [0, 0, 0.82],
    shoulder: [0, -0.07, -0.48],
    triggerAxis: [0, 0.97, 0.24],
    supportAxis: [0, 0.92, 0.40],
    triggerPalm: [-0.8, 0, -0.6],
    supportPalm: [0.8, 0, -0.6]
  };
  const WEAPONS = [
    ['de-kar98k', 'Kar98k'],
    ['de-mp40', 'MP40'],
    ['de-mg42', 'MG42'],
    ['de-panzerschreck', 'Panzerschreck']
  ];
  const v = a => new B.Vector3(a[0], a[1], a[2]);
  const canonical = n => String(n || '').replace(/^mixamorig[:_]?/i, '')
    .replace(/_\d+$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const matrixFromQuat = q => { const m = B.Matrix.Identity(); B.Matrix.FromQuaternionToRef(q, m); return m; };
  const rotated = (vec, q) => B.Vector3.TransformNormal(vec, matrixFromQuat(q));
  function worldRotation(node) {
    node.computeWorldMatrix(true);
    const q = B.Quaternion.Identity();
    node.getWorldMatrix().decompose(undefined, q, undefined);
    return q.normalize();
  }
  function refresh(node) {
    if (!node) return;
    const chain = [];
    for (let p = node; p; p = p.parent) chain.unshift(p);
    for (const p of chain) p.computeWorldMatrix(true);
  }
  function makeHandOrientation(axis, palm, weaponQ) {
    const y = rotated(v(axis), weaponQ).normalize();
    const p = rotated(v(palm), weaponQ);
    // Mixamo wrist basis: +Y points toward fingers, +X is the palm normal,
    // +Z runs across the knuckles. Prior +Z=palm mapping exposed open hands.
    let x = p.subtract(y.scale(B.Vector3.Dot(y, p)));
    if (x.lengthSquared() < 1e-8) x = B.Vector3.Cross(y, B.Axis.Z);
    x.normalize();
    const z = B.Vector3.Cross(x, y).normalize();
    x = B.Vector3.Cross(y, z).normalize();
    const mat = B.Matrix.Identity();
    B.Matrix.FromXYZAxesToRef(x, y, z, mat);
    return B.Quaternion.FromRotationMatrix(mat).normalize();
  }
  function alignJoint(joint, end, goal, maxStep) {
    refresh(end);
    const origin = joint.getAbsolutePosition();
    const from = end.getAbsolutePosition().subtract(origin);
    const toward = goal.subtract(origin);
    if (from.lengthSquared() < 1e-8 || toward.lengthSquared() < 1e-8) return;
    from.normalize(); toward.normalize();
    let axis = B.Vector3.Cross(from, toward);
    const sine = axis.length();
    const cosine = B.Scalar.Clamp(B.Vector3.Dot(from, toward), -1, 1);
    if (sine < 1e-7) {
      if (cosine > 0) return;
      axis = B.Vector3.Cross(from, Math.abs(from.y) < .9 ? B.Axis.Y : B.Axis.X);
    }
    axis.normalize();
    const angle = Math.min(maxStep, Math.atan2(sine, cosine));
    const qWorld = B.Quaternion.RotationAxis(axis, angle);
    const qParent = joint.parent ? worldRotation(joint.parent) : B.Quaternion.Identity();
    const qLocal = qParent.conjugate().multiply(qWorld).multiply(qParent);
    const current = joint.rotationQuaternion || B.Quaternion.FromEulerAngles(
      joint.rotation.x, joint.rotation.y, joint.rotation.z);
    joint.rotationQuaternion = qLocal.multiply(current).normalize();
  }
  function solveArm(arm, target) {
    // Rebuild after each joint rotation: stale matrices caused the old four-hands prototype.
    for (let iteration = 0; iteration < 22; iteration++) {
      // The clavicle is not a free third elbow: preserve natural shoulder line.
      // Only move the clavicle for genuinely hard-to-reach grip positions.
      for (const j of [arm.fore, arm.upper])
        alignJoint(j, arm.hand, target, .30);
      if (B.Vector3.DistanceSquared(arm.hand.getAbsolutePosition(), target) > .0036)
        alignJoint(arm.shoulder, arm.hand, target, .11);
      refresh(arm.hand);
      if (B.Vector3.DistanceSquared(arm.hand.getAbsolutePosition(), target) < .000625)
        break;
    }
    return B.Vector3.Distance(arm.hand.getAbsolutePosition(), target);
  }
  // Elbow pole stabilisation after CCD. Rotation about the shoulder-to-wrist
  // axis leaves the wrist at its IK target but keeps elbows out of the torso.
  // This works on linked TransformNodes, not the non-authoritative glTF bones.
  function stabiliseElbow(arm, pole) {
    refresh(arm.hand);
    const shoulder = arm.upper.getAbsolutePosition();
    const elbow = arm.fore.getAbsolutePosition();
    const wrist = arm.hand.getAbsolutePosition();
    const axis = wrist.subtract(shoulder);
    if (axis.lengthSquared() < 1e-8) return;
    axis.normalize();
    const project = v => v.subtract(axis.scale(B.Vector3.Dot(v, axis)));
    const e = project(elbow.subtract(shoulder));
    const p = project(pole.subtract(shoulder));
    if (e.lengthSquared() < 1e-8 || p.lengthSquared() < 1e-8) return;
    e.normalize(); p.normalize();
    const angle = Math.atan2(B.Vector3.Dot(axis, B.Vector3.Cross(e,p)),
      B.Scalar.Clamp(B.Vector3.Dot(e,p),-1,1));
    // Two small steps avoid sudden elbow flips when switching weapons.
    const parentQ = arm.upper.parent ? worldRotation(arm.upper.parent) : B.Quaternion.Identity();
    const qw = B.Quaternion.RotationAxis(axis, B.Scalar.Clamp(angle,-.55,.55));
    const qLocal = parentQ.conjugate().multiply(qw).multiply(parentQ);
    arm.upper.rotationQuaternion = qLocal.multiply(arm.upper.rotationQuaternion).normalize();
    refresh(arm.hand);
  }
  function elbowBend(arm) {
    refresh(arm.hand);
    const a=arm.upper.getAbsolutePosition().subtract(arm.fore.getAbsolutePosition()).normalize();
    const b=arm.hand.getAbsolutePosition().subtract(arm.fore.getAbsolutePosition()).normalize();
    return Math.round((180 - Math.acos(B.Scalar.Clamp(B.Vector3.Dot(a,b),-1,1))*180/Math.PI)*10)/10;
  }
  function setHandRotation(hand, worldQ) {
    refresh(hand.parent);
    const qParent = hand.parent ? worldRotation(hand.parent) : B.Quaternion.Identity();
    hand.rotationQuaternion = qParent.conjugate().multiply(worldQ).normalize();
    refresh(hand);
  }
  function proceduralRocket(scene, parent) {
    const meshes = [], mats = [];
    const steel = new B.PBRMaterial('rPzB steel', scene);
    steel.albedoColor = new B.Color3(.28, .31, .25);
    steel.metallic = .73; steel.roughness = .57;
    const dark = new B.PBRMaterial('rPzB recess', scene);
    dark.albedoColor = new B.Color3(.045, .048, .043);
    dark.metallic = .45; dark.roughness = .75;
    const wood = new B.PBRMaterial('rPzB grip', scene);
    wood.albedoColor = new B.Color3(.23, .16, .095);
    wood.metallic = 0; wood.roughness = .88;
    mats.push(steel, dark, wood);
    function part(mesh, material, xyz, rotation) {
      mesh.parent = parent; mesh.material = material;
      mesh.position.copyFrom(v(xyz));
      if (rotation) mesh.rotation.copyFrom(v(rotation));
      meshes.push(mesh); return mesh;
    }
    function cylinder(name, diameter, length, xyz, material = steel) {
      return part(B.MeshBuilder.CreateCylinder(name, {
        diameter, height: length, tessellation: 24
      }, scene), material, xyz, [Math.PI / 2, 0, 0]);
    }
    function box(name, sizes, xyz, material = steel) {
      return part(B.MeshBuilder.CreateBox(name, {
        width: sizes[0], height: sizes[1], depth: sizes[2]
      }, scene), material, xyz);
    }
    cylinder('Panzerschreck 88mm barrel', .104, 1.64, [0, 0, 0]);
    cylinder('front black bore', .088, .003, [0, 0, .822], dark);
    cylinder('rear black bore', .088, .003, [0, 0, -.822], dark);
    for (const z of [-.78, -.43, .09, .77])
      cylinder('tube strengthening band', .117, .028, [0, 0, z]);
    // Historical RPzB 54 shield roughly 47 x 36 cm. Model a visibly lighter,
    // non-final shield in this preview and offset it from the sight-line.
    box('blast shield RpzB54', [.42, .30, .012], [-.075, -.045, .30]);
    box('sight window', [.059, .043, .017], [-.178, .026, .312], dark);
    box('shield window rim upper', [.075, .008, .018], [-.178, .053, .327]);
    box('underslung trigger housing', [.12, .115, .19], [0, -.109, -.22]);
    box('rear pistol grip', [.067, .17, .062], [0, -.23, -.23], wood);
    box('front support handle', [.067, .15, .067], [0, -.20, .08], wood);
    box('rear shoulder pad', [.13, .06, .20], [0, -.098, -.48], wood);
    cylinder('front sight', .017, .035, [0, .083, .66], dark);
    return () => { for (const mesh of meshes) mesh.dispose(); for (const mat of mats) mat.dispose(); };
  }
  async function create({ scene, imported, root, state, animationDriven = false, bindUI = true,
    weaponRoot = '../assets/ww2-weapons/', acceptExportSockets = false }) {
    const skeleton = imported.skeletons[0];
    const linked = (skeleton?.bones || []).map(b => b.getTransformNode?.()).filter(Boolean);
    const nodes = [...imported.transformNodes, ...imported.meshes, ...linked];
    const joint = name => nodes.find(n => canonical(n.name) === canonical(name) &&
      n.rotationQuaternion !== undefined && n.getAbsolutePosition);
    const right = {
      shoulder: joint('RightShoulder'), upper: joint('RightArm'),
      fore: joint('RightForeArm'), hand: joint('RightHand')
    };
    const left = {
      shoulder: joint('LeftShoulder'), upper: joint('LeftArm'),
      fore: joint('LeftForeArm'), hand: joint('LeftHand')
    };
    const chest = joint('Spine2');
    if (!chest || Object.values(right).some(x => !x) || Object.values(left).some(x => !x))
      throw Error('Panzergrenadier: linked arm joints not found; model remains unmodified.');
    if (!skeleton || (skeleton.bones.length !== 65 &&
      !(acceptExportSockets && skeleton.bones.length >= 65 && skeleton.bones.length <= 72)))
      throw Error('Unexpected soldier skeleton; refusing to retarget');

    // Pose reset is imperative until approved locomotion clips exist for this GLB.
    const fingerRoots = {};
    const fingers = [];
    for (const side of ['Right', 'Left']) {
      fingerRoots[side] = {};
      for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
        fingerRoots[side][digit] = [];
        for (const segment of [1, 2, 3]) {
          const node = joint(side + 'Hand' + digit + segment);
          if (node) { fingerRoots[side][digit].push(node); fingers.push(node); }
        }
      }
    }
    const controlled = [...Object.values(right), ...Object.values(left), ...fingers];
    const rest = new Map(controlled.map(n => [n, n.rotationQuaternion?.clone() ||
      B.Quaternion.FromEulerAngles(n.rotation.x, n.rotation.y, n.rotation.z)]));
    function flexFingers(side) {
      // The approved Mixamo model's finger phalanges run along local +Y.
      // Curl around joint-local Z and tuck the THUMB around a separate X axis.
      // No hand meshes or skeletal joints are duplicated.
      const rightHand = side === 'Right';
      for (const digit of ['Thumb','Index','Middle','Ring','Pinky']) {
        const segments = fingerRoots[side][digit];
        const amount = digit === 'Thumb' ? [-.36,-.38,-.20]
          : digit === 'Index' && rightHand ? [-.33,-.48,-.28]
          : digit === 'Index' ? [-.53,-.75,-.45]
          : [-.67,-.90,-.52];
        segments.forEach((node,i)=>{
          const bend = B.Quaternion.RotationAxis(B.Axis.Z,amount[i]);
          const tuck = digit === 'Thumb'
            ? B.Quaternion.RotationAxis(B.Axis.X,(rightHand?-.30:.30)*(i===0?1:.50))
            : B.Quaternion.Identity();
          node.rotationQuaternion=rest.get(node).multiply(tuck).multiply(bend).normalize();
        });
      }
    }
    const response = await fetch(weaponRoot + 'manifest.json');
    if (!response.ok) throw Error('Weapon manifest HTTP ' + response.status);
    const manifest = await response.json();
    const pivot = new B.TransformNode('weapon-chest-stabilized-world', scene);
    pivot.rotationQuaternion = B.Quaternion.Identity();

    let pose = 'ready', weaponId = null, meta = null, container = null;
    let needsPose = true, lastSolveTime = 0;
    let rocketDispose = null, generation = 0;
    state.weaponRig = {
      rig: 'Mixamo linked glTF nodes + 2-hand IK + elbow poles + grip fingers', pose, weapon: null,
      animationDriven,
      rightGripMeters: null, leftGripMeters: null,
      preliminaryGeometryOnly: true, experimentalFourthAsset: true
    };
    const report = state.weaponRig;

    function update() {
      if (!meta) return;
      const now = performance.now();
      if (!animationDriven && !needsPose && (pose === 'ready' || pose === 'aim')) return;
      if (!animationDriven && !needsPose && now - lastSolveTime < 65) return;
      needsPose = false; lastSolveTime = now;
      for (const [node, q] of rest) node.rotationQuaternion = q.clone();
      refresh(chest); refresh(right.shoulder); refresh(left.shoulder);
      const t = performance.now() * .001;
      const running = pose === 'run', firing = pose === 'fire';
      const breathing = running || firing ? .004 * Math.sin(t * 1.45) : 0;
      const bob = running ? .014 * Math.sin(t * 13) : 0;
      const recoil = firing ? .025 * Math.max(0, Math.sin(t * 18)) : 0;
      const chestQ = worldRotation(chest);
      const angles = (weaponId === 'de-panzerschreck' ? {
        // The rocket tube is shoulder-borne when aiming, lower while moving.
        ready: [-.16, -.04, -.01],
        aim: [.015, -.035, 0],
        run: [-.28, -.055, -.025],
        fire: [.015, -.035, 0]
      } : {
        ready: [-.095, -.02, -.020],
        aim: [.012, 0, 0],
        run: [.33, -.05, -.025],
        fire: [.012, 0, 0]
      })[pose];
      const localQ = B.Quaternion.FromEulerAngles(angles[0], angles[1], angles[2]);
      const gunQ = chestQ.multiply(localQ).normalize();
      // When running, rifle/SMG/LMG is carried LOWER and CLOSER to the torso;
      // it is NOT held at shoulder-height as if firing while sprinting.
      // Right shoulder stays fixed relative to chest; the weapon is not attached
      // to a swinging wrist, avoiding a feedback loop for the left support hand.
      const stockOffset = weaponId === 'de-panzerschreck'
        ? (running ? new B.Vector3(.10, -.13, .10)
          : pose === 'ready' ? new B.Vector3(.15, -.015, .06)
          : new B.Vector3(.16, .025, .05))
        : (running ? new B.Vector3(.045, -.18, -.025)
          : new B.Vector3(.038, -.07, .115));
      const stock = right.shoulder.getAbsolutePosition()
        .add(rotated(stockOffset, chestQ))
        .add(rotated(new B.Vector3(0, breathing + bob, -recoil), chestQ));
      pivot.rotationQuaternion.copyFrom(gunQ);
      pivot.position.copyFrom(stock.subtract(rotated(v(meta.shoulder), gunQ)));
      refresh(pivot);

      const rightQ = makeHandOrientation(meta.triggerAxis, meta.triggerPalm, gunQ);
      const leftQ = makeHandOrientation(meta.supportAxis, meta.supportPalm, gunQ);
      const rightFinger = rotated(B.Axis.Y, rightQ).normalize();
      const leftFinger = rotated(B.Axis.Y, leftQ).normalize();
      const trigger = pivot.position.add(rotated(v(meta.trigger), gunQ));
      const support = pivot.position.add(rotated(v(meta.support), gunQ));
      const rightGoal = trigger.subtract(rightFinger.scale(.065));
      const leftGoal = support.subtract(leftFinger.scale(.065));
      report.leftReachMeters = +(
        B.Vector3.Distance(left.upper.getAbsolutePosition(), left.fore.getAbsolutePosition()) +
        B.Vector3.Distance(left.fore.getAbsolutePosition(), left.hand.getAbsolutePosition())
      ).toFixed(4);
      report.leftGoalFromShoulderMeters =
        +B.Vector3.Distance(left.upper.getAbsolutePosition(), leftGoal).toFixed(4);
      report.rightIKMeters = +solveArm(right, rightGoal).toFixed(4);
      report.leftIKMeters = +solveArm(left, leftGoal).toFixed(4);
      // Right/left bend outward and slightly forward, not through the abdomen.
      // Pole targets follow the chest while the real run animation moves the torso.
      const rightPole = right.upper.getAbsolutePosition().add(rotated(
        new B.Vector3(-.30,-.24,.14), chestQ));
      const leftPole = left.upper.getAbsolutePosition().add(rotated(
        new B.Vector3(.30,-.24,.20), chestQ));
      stabiliseElbow(right,rightPole);
      stabiliseElbow(left,leftPole);
      report.rightElbowDegrees = elbowBend(right);
      report.leftElbowDegrees = elbowBend(left);
      setHandRotation(right.hand, rightQ);
      setHandRotation(left.hand, leftQ);
      flexFingers('Right'); flexFingers('Left');
      report.rightGripMeters = +B.Vector3.Distance(right.hand.getAbsolutePosition()
        .add(rightFinger.scale(.065)), trigger).toFixed(4);
      report.leftGripMeters = +B.Vector3.Distance(left.hand.getAbsolutePosition()
        .add(leftFinger.scale(.065)), support).toFixed(4);
      report.geometricPass = report.rightGripMeters < .075 && report.leftGripMeters < .075;
      report.pose = pose;
    }
    const observer = scene.onBeforeRenderObservable.add(() => { try { update(); }
      catch (e) { report.error = String(e); console.error('weapon IK', e); } });

    function buttonState() {
      for (const el of document.querySelectorAll('[data-weapon]'))
        el.setAttribute('aria-pressed', String(el.dataset.weapon === weaponId));
      for (const el of document.querySelectorAll('[data-pose]'))
        el.setAttribute('aria-pressed', String(el.dataset.pose === pose));
    }
    function setPose(value) {
      if (!['ready', 'aim', 'run', 'fire'].includes(value)) return;
      pose = value; needsPose = true; buttonState();
    }
    async function equip(id) {
      const entry = WEAPONS.find(x => x[0] === id);
      if (!entry) throw Error('Unknown weapon: ' + id);
      const token = ++generation;
      const baseMeta = id === 'de-panzerschreck' ? ROCKET : manifest.weapons[id];
      // MG42's original +0.505m grip exceeds this character's left-arm reach.
      const nextMeta = baseMeta && { ...baseMeta, support:
        id === 'de-kar98k' ? [0, .04, .27] :
        id === 'de-mp40' ? [0, .027, .19] :
        // The MG42 front grip near the receiver prevents a straight locked elbow.
        id === 'de-mg42' ? [0, .074, .19] : baseMeta.support };
      if (!nextMeta) throw Error('Weapon manifest missing ' + id);
      let incoming = null;
      if (id !== 'de-panzerschreck') {
        incoming = await B.SceneLoader.LoadAssetContainerAsync(
          '', weaponRoot + nextMeta.file, scene);
      }
      if (token !== generation) { incoming?.dispose(); return; }
      if (container) container.dispose(); container = null;
      if (rocketDispose) rocketDispose(); rocketDispose = null;
      for (const child of pivot.getChildren()) {
        // GLB nodes belonged to the disposed asset container.
        if (!child.isDisposed?.()) child.dispose(false, false);
      }
      if (incoming) {
        incoming.addAllToScene();
        for (const n of [...incoming.meshes, ...incoming.transformNodes])
          if (!n.parent) n.parent = pivot;
        container = incoming;
      } else {
        rocketDispose = proceduralRocket(scene, pivot);
      }
      meta = nextMeta; weaponId = id; report.weapon = id;
      needsPose = true; report.error = null;
      report.asset = incoming ? 'MIT original GLB' : 'procedural preview, not approved GLB';
      buttonState(); update();
      return report;
    }
    if (bindUI) {
      for (const el of document.querySelectorAll('[data-weapon]'))
        el.addEventListener('click', () => equip(el.dataset.weapon).catch(e => {
          report.error = String(e); console.error(e);
        }));
      for (const el of document.querySelectorAll('[data-pose]'))
        el.addEventListener('click', () => setPose(el.dataset.pose));
    }
    await equip('de-kar98k');
    state.weaponVariants = WEAPONS.map(x => x[0]);
    state.weaponRigReady = true;
    state.equipWeapon = equip;
    state.setWeaponPose = setPose;
    state.disposeWeaponRig = () => { scene.onBeforeRenderObservable.remove(observer);
      container?.dispose(); rocketDispose?.(); pivot.dispose(); };
    return report;
  }
  window.BattlefieldWeaponRig = { create, WEAPONS };
})();