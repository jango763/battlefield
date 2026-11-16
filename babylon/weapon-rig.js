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
  // The two armies share the same Mixamo rig and sixteen animation clips.
  // British weapon meshes are the licensed muster-ww2 GLBs already in /assets.
  const PIAT = {
    trigger:[0,-.155,-.15],support:[0,-.115,.11],
    muzzle:[0,.055,.49],shoulder:[0,-.045,-.40],
    triggerAxis:[0,.97,.24],supportAxis:[0,.92,.40],
    triggerPalm:[-.8,0,-.6],supportPalm:[.8,0,-.6]
  };
  const WEAPONS = [
    ['de-kar98k', 'Kar98k'], ['de-mp40', 'MP40'],
    ['de-mg42', 'MG42'], ['de-panzerschreck', 'Panzerschreck'],
    ['uk-lee-enfield', 'Lee-Enfield'], ['uk-sten', 'Sten'],
    ['uk-bren', 'Bren'], ['uk-piat', 'PIAT']
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
  // Analytic two-bone IK: positions elbow in a pole-controlled plane using
  // the law of cosines. Unlike CCD, it does not jerk the clavicle or gradually
  // push the elbow through the torso. Works with glTF-linked TransformNodes.
  // The optional pole is a world-space point to the SIDE of the body.
  function solveTwoBone(arm, target, pole) {
    refresh(arm.hand);
    const shoulder=arm.upper.getAbsolutePosition();
    const elbow=arm.fore.getAbsolutePosition();
    const wrist=arm.hand.getAbsolutePosition();
    const upperLen=B.Vector3.Distance(shoulder,elbow);
    const foreLen=B.Vector3.Distance(elbow,wrist);
    const span=upperLen+foreLen;
    const toTarget=target.subtract(shoulder);
    const actual=toTarget.length();
    if(upperLen<.025||foreLen<.025||actual<.00001||!Number.isFinite(actual))
      return solveArm(arm,target);
    const reach=B.Scalar.Clamp(actual,Math.abs(upperLen-foreLen)+.0005,span-.001);
    const d=toTarget.scale(1/actual);
    const along=(reach*reach+upperLen*upperLen-foreLen*foreLen)/(2*reach);
    const crossLen=Math.sqrt(Math.max(0,upperLen*upperLen-along*along));
    let poleSide=pole.subtract(shoulder);
    poleSide.subtractInPlace(d.scale(B.Vector3.Dot(poleSide,d)));
    if(poleSide.lengthSquared()<.00001){
      poleSide=elbow.subtract(shoulder);
      poleSide.subtractInPlace(d.scale(B.Vector3.Dot(poleSide,d)));
    }
    if(poleSide.lengthSquared()<.00001)
      poleSide=B.Vector3.Cross(d,Math.abs(d.y)<.9?B.Axis.Y:B.Axis.X);
    poleSide.normalize();
    const wantedElbow=shoulder.add(d.scale(along)).add(poleSide.scale(crossLen));
    alignJoint(arm.upper,arm.fore,wantedElbow,Math.PI);
    refresh(arm.hand);
    alignJoint(arm.fore,arm.hand,target,Math.PI);
    refresh(arm.hand);
    return B.Vector3.Distance(arm.hand.getAbsolutePosition(),target);
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
  // Rotate the FOREARM around its own axis before asking the wrist to orient.
  // This is the standard twist distribution used by two-hand prop rigs.
  // Without it the wrist alone must absorb 120+ degrees and the skin looks
  // like a detached glove. Twisting around forearm-to-hand keeps palm anchored.
  function twistForearmToPalm(arm, desiredHandWorldQ) {
    refresh(arm.hand);
    const axis=arm.hand.getAbsolutePosition().subtract(arm.fore.getAbsolutePosition());
    if(axis.lengthSquared()<1e-7)return 0;
    axis.normalize();
    const present=worldRotation(arm.hand);
    let delta=desiredHandWorldQ.multiply(present.conjugate()).normalize();
    // q and -q represent the same orientation: choose shorter rotation.
    if(delta.w<0)delta=new B.Quaternion(-delta.x,-delta.y,-delta.z,-delta.w);
    const signed=2*Math.atan2(delta.x*axis.x+delta.y*axis.y+delta.z*axis.z,delta.w);
    const theta=B.Scalar.Clamp(signed,-.95,.95);
    const parentQ=arm.fore.parent?worldRotation(arm.fore.parent):B.Quaternion.Identity();
    const rotation=B.Quaternion.RotationAxis(axis,theta);
    const local=parentQ.conjugate().multiply(rotation).multiply(parentQ);
    arm.fore.rotationQuaternion=local.multiply(arm.fore.rotationQuaternion).normalize();
    refresh(arm.hand);
    return +(theta*180/Math.PI).toFixed(1);
  }
  function setHandRotation(hand, worldQ, bindLocal) {
    refresh(hand.parent);
    const qParent = hand.parent ? worldRotation(hand.parent) : B.Quaternion.Identity();
    const desired = qParent.conjugate().multiply(worldQ).normalize();
    // A global palm frame could demand 140-180deg of wrist twist. Forcing this
    // into the original Mixamo wrist showed an empty-looking sleeve cuff.
    // Preserve the artist's rest wrist and limit correction to ~55 degrees.
    const dot = Math.abs(bindLocal.x*desired.x+bindLocal.y*desired.y+
      bindLocal.z*desired.z+bindLocal.w*desired.w);
    const theta = 2*Math.acos(B.Scalar.Clamp(dot,0,1));
    const maxWrist = 55*Math.PI/180;
    const blend = theta>maxWrist ? maxWrist/theta : 1;
    hand.rotationQuaternion = B.Quaternion.Slerp(bindLocal,desired,blend).normalize();
    refresh(hand);
    return Math.round(Math.min(theta,maxWrist)*180/Math.PI*10)/10;
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
  // PIAT is a spigot projector with an open front tray, NOT a rocket tube.
  // First-party provisional mesh. Replace with a licensed optimized GLB later.
  function proceduralPiat(scene,parent){
    const meshes=[],mats=[];
    const makeMat=(name,hex,metallic)=>{
      const m=new B.PBRMaterial(name,scene);
      m.albedoColor=B.Color3.FromHexString(hex);m.metallic=metallic;m.roughness=.73;
      mats.push(m);return m;
    };
    const steel=makeMat('uk-piat-steel','#515b48',.55);
    const dark=makeMat('uk-piat-dark','#252b25',.28);
    const canvas=makeMat('uk-piat-pad','#615f4d',.03);
    function put(mesh,xyz,material,rotation){
      mesh.parent=parent;mesh.position.copyFrom(v(xyz));
      if(rotation)mesh.rotation.copyFrom(v(rotation));
      mesh.material=material;meshes.push(mesh);
    }
    const box=(n,size,at,mat,rot)=>put(B.MeshBuilder.CreateBox(n,{
      width:size[0],height:size[1],depth:size[2]},scene),at,mat,rot);
    const tube=(n,diam,len,at,mat)=>put(B.MeshBuilder.CreateCylinder(n,{
      diameter:diam,height:len,tessellation:12},scene),at,mat,[Math.PI/2,0,0]);
    tube('PIAT spring body',.125,.67,[0,0,-.075],steel);
    tube('PIAT forward mortar spigot',.065,.29,[0,0,.40],dark);
    box('PIAT open bomb tray',[.145,.034,.31],[0,-.055,.365],steel);
    box('PIAT tray left wall',[.025,.075,.31],[-.067,-.011,.365],steel);
    box('PIAT tray right wall',[.025,.075,.31],[.067,-.011,.365],steel);
    box('PIAT shoulder stock',[.165,.125,.23],[0,-.040,-.40],steel);
    box('PIAT rubber butt',[.17,.17,.040],[0,-.045,-.525],canvas);
    box('PIAT trigger assembly',[.085,.095,.14],[0,-.122,-.16],dark);
    box('PIAT grip',[.060,.155,.055],[0,-.204,-.16],canvas);
    box('PIAT forward support',[.075,.095,.07],[0,-.145,.11],canvas);
    box('PIAT folding monopod',[.022,.28,.022],[0,-.175,.38],steel);
    box('PIAT rear sight',[.025,.070,.020],[0,.10,-.28],dark);
    return ()=>{for(const mesh of meshes)mesh.dispose();
      for(const mat of mats)mat.dispose();};
  }
  async function create({ scene, imported, root, state, animationDriven = false, bindUI = true,
    weaponRoot = '../assets/ww2-weapons/', acceptExportSockets = false,
    initialWeaponId = 'de-kar98k' }) {
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
    const hips=joint('Hips');
    const neck=joint('Neck');
    // The combat demo uses an independent lower-body stance overlay. The
    // approved hand-pose JSON is never modified by this procedural layer.
    const poseLegs={
      leftThigh:joint('LeftUpLeg'),rightThigh:joint('RightUpLeg'),
      leftKnee:joint('LeftLeg'),rightKnee:joint('RightLeg'),
      leftFoot:joint('LeftFoot'),rightFoot:joint('RightFoot'),
      spine:joint('Spine')
    };
    const originalRootY=root.position.y;
    let plantedFeet=null;
    const applyCombatStance=()=>{
      const data=state.combatPose;
      const w=B.Scalar.Clamp(Number(data?.crouch)||0,0,1);
      if(!data?.active||w<.001){
        root.position.y=originalRootY;
        plantedFeet=null;
        return;
      }
      if(!plantedFeet){
        // At the first STOP frame, remember the REAL ankle positions and
        // orientations before lowering the pelvis. These are world anchors.
        // Keeps boots on the ground instead of rotating both legs in the air.
        plantedFeet={};
        for(const side of ['left','right']){
          const n=poseLegs[side+'Foot'];
          if(!n)continue;
          refresh(n);
          plantedFeet[side]={target:n.getAbsolutePosition().clone(),
            rotation:worldRotation(n).clone()};
        }
      }
      // Crouch the pelvis in world space and solve BOTH 2-bone leg chains.
      // The knees bend naturally because hip-to-foot reach becomes shorter.
      root.position.y=originalRootY-.235*w;
      const spine=poseLegs.spine;
      if(spine?.rotationQuaternion){
        spine.rotationQuaternion=spine.rotationQuaternion.multiply(
          B.Quaternion.FromEulerAngles(.16*w,0,0)).normalize();
        refresh(spine);
      }
      for(const side of ['left','right']){
        const planted=plantedFeet?.[side];
        const upper=poseLegs[side+'Thigh'];
        const fore=poseLegs[side+'Knee'];
        const hand=poseLegs[side+'Foot'];
        if(!planted||!upper||!fore||!hand)continue;
        refresh(upper);refresh(hand);
        const hip=upper.getAbsolutePosition();
        // Knees lean slightly forward, outward from the other knee.
        const pole=hip.add(new B.Vector3(side==='left'?.11:-.11,-.06,.55));
        const drift=hip.subtract(planted.target);
        // Never stretch the skeleton when entering/exiting the crouch.
        const target=planted.target.clone();
        if(drift.lengthSquared()<1e-8)continue;
        solveTwoBone({upper,fore,hand},target,pole);
        refresh(hand);
        if(hand.parent?.rotationQuaternion){
          const parentQ=worldRotation(hand.parent);
          hand.rotationQuaternion=parentQ.conjugate()
            .multiply(planted.rotation).normalize();
          refresh(hand);
        }
      }
    };
    if (!hips || !neck || !chest || Object.values(right).some(x => !x) || Object.values(left).some(x => !x))
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
    const gripDebug = typeof window!=='undefined'
      ? new URLSearchParams(window.location.search).get('gripDebug') : null;
    // Kar98k master-pose authoring studio. Isolated from gameplay and all
    // default previews: applies ONLY with ?gripStudio=1. Corrected hand and
    // finger poses can be saved as JSON for Blender-based animation authoring.
    const params=new URLSearchParams(window.location.search);
    const gripStudio=params.get('gripStudio')==='1'||params.get('combatDemo')==='1';
    // Two fully independent hands. Right grips Kar98k wrist/trigger, left
    // supports forestock. The butt remains fixed to the RIGHT shoulder.
    // Existing v1 flat keys are migrated through legacyAliases in the API.
    const fingerDigits=['Thumb','Index','Middle','Ring','Pinky'];
    const fingerDefaults={Thumb:1.05,Index:.75,Middle:1.55,Ring:1.55,Pinky:1.55};
    const masterDefaults=Object.freeze({
      rightPitch:0,rightYaw:0,rightRoll:0,
      rightOffsetX:0,rightOffsetY:0,rightOffsetZ:0,
      leftPitch:0,leftYaw:0,leftRoll:0,
      leftOffsetX:0,leftOffsetY:0,leftOffsetZ:.08,
      ...Object.fromEntries(['right','left'].flatMap(side=>
        fingerDigits.flatMap(digit=>[
          [side+digit+'Curl',side==='left'&&digit==='Index'?1.55:fingerDefaults[digit]],
          [side+digit+'Spread',0]
        ])))
    });
    const master={...masterDefaults};
    const masterKeys=Object.keys(masterDefaults);
    const masterRanges={
      ...Object.fromEntries(['right','left'].flatMap(side=>[
        [side+'Pitch',[-80,80]],[side+'Yaw',[-80,80]],[side+'Roll',[-120,120]],
        [side+'OffsetX',[-.12,.12]],[side+'OffsetY',[-.12,.12]],
        [side+'OffsetZ',side==='left'?[-.15,.38]:[-.12,.12]]
      ])),
      ...Object.fromEntries(['right','left'].flatMap(side=>
        fingerDigits.flatMap(digit=>[
          [side+digit+'Curl',[0,2.6]],
          [side+digit+'Spread',[-45,45]]
        ])))
    };
    // Import pre-v2 studio JSON without changing the left-hand controls.
    const legacyAliases={
      fingerCurl:['rightMiddleCurl','rightRingCurl','rightPinkyCurl'],
      rightFingerCurl:['rightMiddleCurl','rightRingCurl','rightPinkyCurl'],
      leftFingerCurl:['leftMiddleCurl','leftRingCurl','leftPinkyCurl'],
      indexCurl:['rightIndexCurl'],thumbCurl:['rightThumbCurl'],
      supportOffsetZ:['leftOffsetZ']
    };

    // Experimental anatomical wrist-basis calibration: glTF/Mixamo wrist
    // local +Y is not guaranteed to point down the fingers. Infer axes from
    // actual approved skinned joint positions IN BIND POSE instead.
    // This is opt-in for A/B review only until visual acceptance.
    const anatomicalDebug=new URLSearchParams(window.location.search)
      .get('handBasis')==='anatomy';
    function measureHandBasis(side,arm) {
      const knuckleI=fingerRoots[side].Index[0],knuckleP=fingerRoots[side].Pinky[0];
      const finger2=fingerRoots[side].Index[1];
      if(!knuckleI||!knuckleP||!finger2)return null;
      refresh(knuckleI);refresh(knuckleP);refresh(finger2);refresh(arm.hand);
      const wrist=arm.hand.getAbsolutePosition();
      let y=finger2.getAbsolutePosition().subtract(wrist).normalize();
      let z=knuckleP.getAbsolutePosition().subtract(knuckleI.getAbsolutePosition());
      z.subtractInPlace(y.scale(B.Vector3.Dot(z,y)));
      if(z.lengthSquared()<1e-7||y.lengthSquared()<1e-7)return null;
      z.normalize();
      const x=B.Vector3.Cross(y,z).normalize();
      z=B.Vector3.Cross(x,y).normalize();
      const qHand=worldRotation(arm.hand);
      const localInv=qHand.conjugate();
      const ml=B.Matrix.Identity();
      B.Matrix.FromXYZAxesToRef(rotated(x,localInv),rotated(y,localInv),
        rotated(z,localInv),ml);
      return {quat:B.Quaternion.FromRotationMatrix(ml).normalize(),
        localForward:rotated(y,localInv).normalize(),
        localNormal:rotated(x,localInv).normalize()};
    }
    const anatomicalBases={
      Right:measureHandBasis('Right',right),
      Left:measureHandBasis('Left',left)
    };
    function desiredHandFrame(side,axis,palm,gunQ) {
      const target=makeHandOrientation(axis,palm,gunQ);
      const basis=anatomicalDebug?anatomicalBases[side]:null;
      return basis?target.multiply(basis.quat.conjugate()).normalize():target;
    }
    const localHandForward=side=>anatomicalDebug&&anatomicalBases[side]
      ?anatomicalBases[side].localForward:B.Axis.Y;

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
          // Temporary URL-only research control; no extra visible gameplay UI.
          // Compare source rest, stronger flexion, reverse and alternate axis
          // without changing the approved soldier's skinned geometry.
          // Each finger has its OWN curl and sideways rotation. The latter
          // affects only the proximal phalanx (segment 1), not its neighbours.
          const sideKey=rightHand?'right':'left';
          const multiplier=gripStudio
            ?master[sideKey+digit+'Curl']
            :gripDebug==='neutral'?0:gripDebug==='classic'?1:1.55;
          const spread=gripStudio?master[sideKey+digit+'Spread']*Math.PI/180:0;
          const sign=gripDebug==='reverse'?-1:1;
          const curlAxis=gripDebug==='axisX'?B.Axis.X:B.Axis.Z;
          const bend=B.Quaternion.RotationAxis(curlAxis,amount[i]*multiplier*sign);
          const fan=i===0 ?B.Quaternion.RotationAxis(B.Axis.X,spread) :B.Quaternion.Identity();
          const tuck=digit==='Thumb'&&gripDebug!=='neutral'
            ?B.Quaternion.RotationAxis(B.Axis.X,(rightHand?-.30:.30)*(i===0?1:.50))
            :B.Quaternion.Identity();
          node.rotationQuaternion=rest.get(node).multiply(tuck).multiply(fan).multiply(bend).normalize();
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
      preliminaryGeometryOnly: true, experimentalFourthAsset: true,
      fingerJoints: fingers.length, anatomicalElbowPoles: true
    };
    const report = state.weaponRig;

    // Model-authored anatomical forward, not the Spin2 bone's LOCAL Z.
    // This Mixamo rig faces +Z in its bind pose. Shoulder left-minus-right
    // is +X and neck-minus-hips is +Y. Construct a right-handed body basis
    // every frame so gun barrel +Z really points FORWARD while running.
    // The old chest rotation inherits arbitrary joint axes and made MP40
    // point diagonally down/sideways, despite numerically correct grip IK.
    function bodyFacingFrame() {
      refresh(neck);refresh(hips);refresh(left.upper);refresh(right.upper);
      let x=left.upper.getAbsolutePosition().subtract(right.upper.getAbsolutePosition());
      if(x.lengthSquared()<1e-6)return {q:worldRotation(chest),forward:rotated(B.Axis.Z,worldRotation(chest))};
      x.normalize();
      let y=neck.getAbsolutePosition().subtract(hips.getAbsolutePosition());
      y.subtractInPlace(x.scale(B.Vector3.Dot(y,x)));
      if(y.lengthSquared()<1e-6)y=B.Axis.Y.clone();
      y.normalize();
      const z=B.Vector3.Cross(x,y).normalize();
      y=B.Vector3.Cross(z,x).normalize();
      const m=B.Matrix.Identity();
      B.Matrix.FromXYZAxesToRef(x,y,z,m);
      return {q:B.Quaternion.FromRotationMatrix(m).normalize(),forward:z};
    }
    function update() {
      if (!meta) return;
      const now = performance.now();
      if (!animationDriven && !needsPose && (pose === 'ready' || pose === 'aim')) return;
      if (!animationDriven && !needsPose && now - lastSolveTime < 65) return;
      needsPose = false; lastSolveTime = now;
      for (const [node, q] of rest) node.rotationQuaternion = q.clone();
      applyCombatStance();
      refresh(chest); refresh(right.shoulder); refresh(left.shoulder);
      const t = performance.now() * .001;
      const running = pose === 'run', firing = pose === 'fire';
      const breathing = running || firing ? .004 * Math.sin(t * 1.45) : 0;
      const bob = running ? .014 * Math.sin(t * 13) : 0;
      const recoil = firing ? .025 * Math.max(0, Math.sin(t * 18)) : 0;
      const bodyFrame=bodyFacingFrame();
      const chestQ=bodyFrame.q;
      const launcher=weaponId==='de-panzerschreck'||weaponId==='uk-piat';
      const rifle=weaponId==='de-kar98k'||weaponId==='uk-lee-enfield';
      const smg=weaponId==='de-mp40'||weaponId==='uk-sten';
      const lmg=weaponId==='de-mg42'||weaponId==='uk-bren';
      const angles = (launcher ? {
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
      // During mobile shooting, legs KEEP the Run clip. Only the upper-body
      // aim and recoil are adjusted; no gait or approved rifle grip changes.
      const runAndGun=state.combatPose?.active&&
        (smg||lmg)&&
        state.combatPose.stage==='runFire';
      const pulse=runAndGun
        ?B.Scalar.Clamp(Number(state.combatPose.recoilPulse)||0,0,1):0;
      const localQ=B.Quaternion.FromEulerAngles(
        runAndGun?.12+.035*pulse:angles[0],
        runAndGun?-.025:angles[1],runAndGun?-.015:angles[2]);
      const gunQ = chestQ.multiply(localQ).normalize();
      report.forwardDot=+B.Vector3.Dot(
        rotated(B.Axis.Z,gunQ).normalize(),bodyFrame.forward).toFixed(3);
      // When running, rifle/SMG/LMG is carried LOWER and CLOSER to the torso;
      // it is NOT held at shoulder-height as if firing while sprinting.
      // Right shoulder stays fixed relative to chest; the weapon is not attached
      // to a swinging wrist, avoiding a feedback loop for the left support hand.
      const stockOffset = launcher
        ? (running ? new B.Vector3(.10,-.13,.10)
          : pose === 'ready' ? new B.Vector3(.075,-.095,.055)
          : new B.Vector3(.050,-.090,.035))
        : (running ? new B.Vector3(.045, -.18, -.025)
          : new B.Vector3(.038, -.07, .115));
      // Kar98k: the buttplate MUST touch the RIGHT shoulder pocket.
      // Use the world-space upper-arm shoulder joint as the anatomical anchor,
      // not the clavicle root: the old stockOffset put the butt in front of
      // the torso. Keep the butt fixed there through Hold/Aim/Fire/Run.
      const kar98k=rifle;
      const rifleShoulderSocket=right.upper.getAbsolutePosition().add(rotated(
        new B.Vector3(.055,-.075,-.030),chestQ));
      const stock=kar98k?rifleShoulderSocket.clone():
        right.shoulder.getAbsolutePosition()
          .add(rotated(stockOffset,chestQ))
          .add(rotated(new B.Vector3(0,breathing+bob,-recoil),chestQ));
      pivot.rotationQuaternion.copyFrom(gunQ);
      pivot.position.copyFrom(stock.subtract(rotated(v(meta.shoulder), gunQ)));
      refresh(pivot);

      const rightBaseQ=desiredHandFrame('Right',meta.triggerAxis,meta.triggerPalm,gunQ);
      const leftBaseQ=desiredHandFrame('Left',meta.supportAxis,meta.supportPalm,gunQ);
      const studioPose=gripStudio&&weaponId==='de-kar98k';
      const handEdit=(side)=>studioPose
        ?B.Quaternion.FromEulerAngles(master[side+'Pitch']*Math.PI/180,
          master[side+'Yaw']*Math.PI/180,master[side+'Roll']*Math.PI/180)
        :B.Quaternion.Identity();
      const rightQ=rightBaseQ.multiply(handEdit('right')).normalize();
      const leftQ=leftBaseQ.multiply(handEdit('left')).normalize();
      const rightFinger=rotated(localHandForward('Right'),rightQ).normalize();
      const leftFinger=rotated(localHandForward('Left'),leftQ).normalize();
      const trigger=pivot.position.add(rotated(v(meta.trigger),gunQ));
      // Frame-keyed right-hand bolt operation is a temporary grip offset,
      // not an edit to the approved Kar98k master profile. The rifle stays
      // anchored to the right shoulder through all phases.
      const bolt=rifle&&state.combatPose?.active
        ?B.Scalar.Clamp(Number(state.combatPose.boltProgress)||0,0,1):0;
      if(bolt>0){
        const keyed=[[0,0,0,0],[.12,.038,.045,-.012],
          [.30,.038,.055,-.12],[.70,.038,.055,-.12],
          [.92,.038,.045,-.012],[1,0,0,0]];
        let offset=keyed.at(-1).slice(1);
        for(let i=1;i<keyed.length;i++)if(bolt<=keyed[i][0]){
          const a=keyed[i-1],b=keyed[i],t=(bolt-a[0])/(b[0]-a[0]);
          offset=a.slice(1).map((v,j)=>v+(b[j+1]-v)*t);break;
        }
        trigger.addInPlace(rotated(new B.Vector3(...offset),gunQ));
        report.boltHandOffsetMeters=+Math.hypot(...offset).toFixed(4);
      }else report.boltHandOffsetMeters=0;
      if(gripStudio&&weaponId==='de-kar98k')
        trigger.addInPlace(rotated(new B.Vector3(master.rightOffsetX,
          master.rightOffsetY,master.rightOffsetZ),gunQ));
      // Aiming moves the left hand toward the receiver/launcher control,
      // preventing a fully locked support elbow while keeping the muzzle stable.
      const supportPoint=rifle
        ? (running?[0,.04,.015]
          : pose==='aim'||pose==='fire'?[0,.04,.055]:meta.support)
        : (pose==='aim'||pose==='fire')
          ? (launcher?[0,-.135,-.09]:meta.support)
          : meta.support;
      const support=pivot.position.add(rotated(v(supportPoint),gunQ));
      // Preview-only reload gesture. MP40: magazine; MG42: feed area;
      // Panzerschreck: support hand moves briefly towards rear loading end.
      // This is a stand-in, NOT a fully rigged rocket/belt/magazine animation.
      const reloadActive=state.combatPose?.active&&
        state.combatPose.stage==='reload'&&
        (smg||lmg||launcher);
      const reloadT=reloadActive
        ?B.Scalar.Clamp(Number(state.combatPose.reloadProgress)||0,0,1):0;
      let handShift=new B.Vector3(0,0,0);
      if(reloadActive){
        const marks=smg
          ?[[0,0,0,0],[.16,-.015,-.045,-.10],
            [.40,-.02,-.095,-.115],[.65,-.01,-.075,-.08],
            [.88,0,-.035,-.03],[1,0,0,0]]
          :lmg
          ?[[0,0,0,0],[.12,-.015,.06,-.075],
            [.35,-.02,.10,-.07],[.67,-.035,.07,-.055],
            [.89,-.015,.045,-.025],[1,0,0,0]]
          :[[0,0,0,0],[.14,.015,-.035,-.045],
            [.38,.025,-.055,-.14],[.70,.025,-.055,-.14],
            [.90,.010,-.02,-.025],[1,0,0,0]];
        for(let i=1;i<marks.length;i++)if(reloadT<=marks[i][0]){
          const prev=marks[i-1],next=marks[i];
          const u=(reloadT-prev[0])/(next[0]-prev[0]);
          const v=u*u*(3-2*u);
          handShift=new B.Vector3(
            ...[1,2,3].map(k=>prev[k]+(next[k]-prev[k])*v));
          break;
        }
        support.addInPlace(rotated(handShift,gunQ));
      }
      report.reloadHandOffsetMeters=+handShift.length().toFixed(4);
      report.reloadGestureActive=!!reloadActive;
      if(studioPose)
        support.addInPlace(rotated(new B.Vector3(master.leftOffsetX,
          master.leftOffsetY,master.leftOffsetZ),gunQ));
      // Reach-aware correction for the TEMPORARY shoulder-launched weapon ONLY.
      // IK cannot create a natural elbow if the support grip lies beyond the
      // model's upper-arm + forearm length. Instead of stretching the soldier
      // or faking his grip, reposition the entire launcher a little towards
      // his left shoulder while preserving BOTH actual grip points on the prop.
      report.rocketRepositionMeters=0;
      report.weaponReachCorrectionMeters=0;
      {
        refresh(left.hand);
        const shoulderPos = left.upper.getAbsolutePosition();
        const armLength = B.Vector3.Distance(shoulderPos, left.fore.getAbsolutePosition())
          + B.Vector3.Distance(left.fore.getAbsolutePosition(), left.hand.getAbsolutePosition());
        const palmAim = support.subtract(leftFinger.scale(.045));
        const span = B.Vector3.Distance(shoulderPos, palmAim);
        const preferred = armLength *
          (launcher ? .86 : .89); // flexed elbows without overreach
        if (!kar98k && span > preferred && span > 1e-6) {
          // Never translate the Kar98k after the butt is seated: sliding
          // the entire rifle toward the left arm would detach its stock.
          const correction = shoulderPos.subtract(palmAim).scale((span - preferred) / span);
          const maxOffset = launcher ? .20 : .18;
          // Moving a prop closer beats stretching or faking limb lengths.
          // Keep muzzle, trigger, and support targets rigidly tied to the prop.
          if (correction.lengthSquared() > maxOffset * maxOffset)
            correction.normalize().scaleInPlace(maxOffset);
          pivot.position.addInPlace(correction);
          refresh(pivot);
          trigger.addInPlace(correction);
          support.addInPlace(correction);
          report.weaponReachCorrectionMeters=+correction.length().toFixed(4);
          if(launcher)
            report.rocketRepositionMeters=report.weaponReachCorrectionMeters;
        }
        report.weaponOriginalReachRatio=+(span / Math.max(armLength,.0001)).toFixed(3);
        if(launcher)
          report.rocketOriginalReachRatio=report.weaponOriginalReachRatio;
      }
      // The former 6.5 cm wrist offset lifted the pistol hand ABOVE its grip,
      // exposing a hollow sleeve cuff and hanging the fingers in midair.
      // Grip geometry: the right wrist sits just behind the trigger housing;
      // support hand is cupped beneath the handguard/receiver.
      // Measure stock contact AFTER optional whole-weapon correction.
      // Contact is the actual GLB stock marker in world coordinates;
      // measuring the intended anchor alone would give a false "PASS".
      const stockWorld=pivot.position.add(rotated(v(meta.shoulder),gunQ));
      report.stockRightShoulderMeters=+B.Vector3.Distance(
        stockWorld,right.upper.getAbsolutePosition()).toFixed(4);
      report.muzzleWorldPosition=Array.isArray(meta.muzzle)
        ?pivot.position.add(rotated(v(meta.muzzle),gunQ)).asArray():null;
      report.stockWorldPosition=kar98k?stockWorld.asArray():null;
      report.stockSocketWorldPosition=kar98k?rifleShoulderSocket.asArray():null;
      report.stockToSocketMeters=kar98k
        ?+B.Vector3.Distance(stockWorld,rifleShoulderSocket).toFixed(5):null;
      report.stockOnRightShoulder=kar98k?
        report.stockToSocketMeters<.008 && report.stockRightShoulderMeters<.12:null;
      report.kar98kButtFixed=kar98k;
      const rightPalmReach = .028, leftPalmReach = .045;
      const rightGoal = trigger.subtract(rightFinger.scale(rightPalmReach));
      const leftGoal = support.subtract(leftFinger.scale(leftPalmReach));
      report.leftReachMeters = +(
        B.Vector3.Distance(left.upper.getAbsolutePosition(), left.fore.getAbsolutePosition()) +
        B.Vector3.Distance(left.fore.getAbsolutePosition(), left.hand.getAbsolutePosition())
      ).toFixed(4);
      report.leftGoalFromShoulderMeters =
        +B.Vector3.Distance(left.upper.getAbsolutePosition(), leftGoal).toFixed(4);
      // Both elbows use an explicit pole target in the torso's frame.
      // Forwards/backwards motion of the gun no longer twists the clavicles.
      const rightPole=right.upper.getAbsolutePosition().add(rotated(
        new B.Vector3(-.33,-.28,.22),chestQ));
      const leftPole=left.upper.getAbsolutePosition().add(rotated(
        new B.Vector3(.33,-.28,.22),chestQ));
      report.rightIKMeters=+solveTwoBone(right,rightGoal,rightPole).toFixed(4);
      report.leftIKMeters=+solveTwoBone(left,leftGoal,leftPole).toFixed(4);
      report.solver='analytical-two-bone-with-pole';
      report.rightElbowDegrees = elbowBend(right);
      report.leftElbowDegrees = elbowBend(left);
      report.rightForearmTwistDegrees=twistForearmToPalm(right,rightQ);
      report.leftForearmTwistDegrees=twistForearmToPalm(left,leftQ);
      report.rightWristDegrees=setHandRotation(right.hand,rightQ,rest.get(right.hand));
      report.leftWristDegrees=setHandRotation(left.hand,leftQ,rest.get(left.hand));
      flexFingers('Right'); flexFingers('Left');
      // Report REAL post-constraint palm directions, not an unattained ideal
      // target; this prevents a false geometric "IK OK" for twisted hands.
      const rPalm=rotated(localHandForward('Right'),worldRotation(right.hand)).normalize();
      const lPalm=rotated(localHandForward('Left'),worldRotation(left.hand)).normalize();
      const aimError=(a,b)=>+(Math.acos(B.Scalar.Clamp(B.Vector3.Dot(a,b),-1,1))*
        180/Math.PI).toFixed(1);
      report.rightFingerDirectionErrorDegrees=aimError(rPalm,rightFinger);
      report.leftFingerDirectionErrorDegrees=aimError(lPalm,leftFinger);
      report.rightGripMeters = +B.Vector3.Distance(right.hand.getAbsolutePosition()
        .add(rPalm.scale(rightPalmReach)), trigger).toFixed(4);
      report.leftGripMeters = +B.Vector3.Distance(left.hand.getAbsolutePosition()
        .add(lPalm.scale(leftPalmReach)), support).toFixed(4);
      report.movingFireOverlay=!!runAndGun;
      report.combatCrouchStrength=state.combatPose?.active
        ?+(Number(state.combatPose.crouch)||0).toFixed(3):0;
      report.masterPoseEditor=gripStudio;
      report.masterPose=gripStudio?{...master}:null;
      report.anatomicalHandCalibration=anatomicalDebug &&
        !!anatomicalBases.Right && !!anatomicalBases.Left;
      report.rightHandFocus=right.hand.getAbsolutePosition().asArray();
      report.leftHandFocus=left.hand.getAbsolutePosition().asArray();
      report.handFocus = B.Vector3.Lerp(
        right.hand.getAbsolutePosition(),left.hand.getAbsolutePosition(),.5).asArray();
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
      const isLauncher=id==='de-panzerschreck'||id==='uk-piat';
      const baseMeta = id==='de-panzerschreck' ? ROCKET :
        id==='uk-piat' ? PIAT : manifest.weapons[id];
      // MG42's original +0.505m grip exceeds this character's left-arm reach.
      // Weapon manifest grip axes describe the ARTIST'S barrel/grip features,
      // not the Mixamo palm/finger axes. Using MP40's [0,+.97,+.24] as the
      // finger direction pointed the soldier's index finger STRAIGHT UP.
      // Human two-hand carry: right fingers wrap DOWN around the pistol-grip
      // (or rifle wrist), left fingers wrap ACROSS the handguard from below.
      const nextMeta = baseMeta && { ...baseMeta,
        support: id === 'de-kar98k' ? [0,.04,.14] :
          id === 'uk-lee-enfield' ? [0,.04,.14] :
          id === 'de-mp40' ? [0,.027,.085] :
          id === 'uk-sten' ? [0,.031,.11] :
          id === 'de-mg42' ? [0,.074,.115] :
          id === 'uk-bren' ? [0,.054,.14] :
          id==='uk-piat' ? PIAT.support : [0,-.135,-.02],
        triggerAxis: ['de-kar98k','uk-lee-enfield'].includes(id) ?
          [0,-.88,.48] : [0,-.96,.28],
        triggerPalm: [.90,.23,-.35],
        supportAxis: [-.85,.32,.42],
        supportPalm: [-.25,.75,.60]
      };
      if (!nextMeta) throw Error('Weapon manifest missing ' + id);
      let incoming = null;
      if (!isLauncher) {
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
        rocketDispose = id==='uk-piat' ? proceduralPiat(scene,pivot) :
          proceduralRocket(scene, pivot);
      }
      meta = nextMeta; weaponId = id; report.weapon = id;
      needsPose = true; report.error = null;
      report.asset = incoming ? 'MIT original GLB' :
        id==='uk-piat' ? 'procedural PIAT prototype (no licensed GLB yet)' :
        'procedural preview, not approved GLB';
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
    await equip(initialWeaponId);
    state.masterPoseEnabled=gripStudio;
    state.setMasterPose=(patch)=>{
      if(!gripStudio)throw Error('Master-pose editor is not enabled');
      if(!patch||typeof patch!=='object'||Array.isArray(patch))
        throw Error('Invalid master-pose patch');
      const next={...master};
      for(const [rawKey,rawValue] of Object.entries(patch)){
        const keys=legacyAliases[rawKey]||[rawKey];
        const val=Number(rawValue);
        if(!Number.isFinite(val))throw Error('Invalid finite value for '+rawKey);
        for(const key of keys){
          if(!Object.prototype.hasOwnProperty.call(masterRanges,key))
            throw Error('Unknown master-pose key '+rawKey);
          const [lo,hi]=masterRanges[key];
          next[key]=B.Scalar.Clamp(val,lo,hi);
        }
      }
      Object.assign(master,next);
      needsPose=true;update();
      return {...master};
    };
    state.getMasterPose=()=>({...master});
    state.resetMasterPose=()=>state.setMasterPose(masterDefaults);
    state.resetMasterHandPose=(side)=>{
      if(side!=='right'&&side!=='left')throw Error('Hand must be right or left');
      return state.setMasterPose(Object.fromEntries(masterKeys
        .filter(key=>key.startsWith(side))
        .map(key=>[key,masterDefaults[key]])));
    };
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