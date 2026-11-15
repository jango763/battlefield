/* Battlefield Babylon - isolated live combat range.
 * Live weapon math is BattlefieldBalance; target boards are NOT replacement soldier art.
 * Approved German GLB and weapon IK are imported without modifications.
 */
(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const log = message => { $('events').textContent = message; };
  const B = window.BABYLON, rules = window.BattlefieldBalance;
  const presentation = window.BattlefieldCombatPresentation;
  const canvas = $('view');
  if (!B || !rules || !presentation) {
    $('telemetry').textContent = 'Ошибка: Babylon.js или модуль баланса не загружены';
    return;
  }
  const scale = .11, startX = -5.8;
  const prices = {
    MP40: { weapon: 100, magazine: 15 },
    MG42: { weapon: 240, magazine: 40 },
    Panzerschreck: { weapon: 350, magazine: 70 }
  }; // Training currency ONLY, not approved game economy.
  let engine, scene, heroMesh, rigState, battle, actor, foes = [];
  let scenario = 'duel', distance = 40, moving = false, atBase = true;
  let targets = [], effects = [], selected = 'Kar98k', camera = null;
  let lastPaint = 0, lastVisualPaint = 0, ready = false, active = false;
  let shotAge = Infinity, lastVisualPose = null;
  const gear = { Kar98k: 'de-kar98k', MP40: 'de-mp40',
    MG42: 'de-mg42', Panzerschreck: 'de-panzerschreck' };
  const coords = (unit, y = 0) =>
    new B.Vector3(startX + unit.x * scale, y, unit.z * scale);
  function buildWorld() {
    engine = new B.Engine(canvas, true, { powerPreference: 'high-performance' });
    engine.setHardwareScalingLevel(Math.max(1, (window.devicePixelRatio || 1) / 1.6));
    scene = new B.Scene(engine);
    scene.useRightHandedSystem = true;
    scene.clearColor = new B.Color4(.11, .16, .13, 1);
    const hemi = new B.HemisphericLight('sky', new B.Vector3(0, 1, 0), scene);
    hemi.intensity = 1.35;
    const sun = new B.DirectionalLight('sun', new B.Vector3(-.4, -1, .25), scene);
    sun.intensity = 1.25;
    const ground = B.MeshBuilder.CreateGround('training ground', { width: 42, height: 22 }, scene);
    const floor = new B.StandardMaterial('grass', scene);
    floor.diffuseColor = new B.Color3(.26, .32, .23);
    ground.material = floor;
    // Range rulers in game units, projected into the display scene.
    for (let meter = 0; meter <= 100; meter += 20) {
      const line = B.MeshBuilder.CreateBox('range-' + meter, { width: .04, height: .012, depth: 1.8 }, scene);
      line.position = new B.Vector3(startX + meter * scale, .012, 0);
      const material = new B.StandardMaterial('ruler-' + meter, scene);
      material.emissiveColor = new B.Color3(.67, .72, .52);
      line.material = material;
    }
    camera = new B.ArcRotateCamera('camera', Math.PI * .46, 1.08, 21,
      new B.Vector3(-.5, 0, 0), scene);
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 29;
    camera.wheelDeltaPercentage = .02;
    camera.pinchDeltaPercentage = .02;
    camera.attachControl(canvas, true);
    engine.runRenderLoop(drawFrame);
    window.addEventListener('resize', () => engine.resize());
  }
  function makeTarget(unit) {
    const root = new B.TransformNode('target-' + unit.id, scene);
    root.position.copyFrom(coords(unit));
    const plate = B.MeshBuilder.CreateBox('target plate', {
      width: .58, height: 1.22, depth: .13
    }, scene);
    plate.parent = root; plate.position.y = .85;
    const head = B.MeshBuilder.CreateSphere('target head', { diameter: .36, segments: 10 }, scene);
    head.parent = root; head.position.y = 1.65;
    const stand = B.MeshBuilder.CreateBox('stand', { width: .09, height: .22, depth: .11 }, scene);
    stand.parent = root; stand.position.y = .15;
    const material = new B.StandardMaterial('target material ' + unit.id, scene);
    material.diffuseColor = new B.Color3(.68, .38, .30);
    plate.material = material; head.material = material; stand.material = material;
    return { unit, root, material, plate, head, stand };
  }
  function setScenario(next) {
    scenario = next;
    active = false; atBase = true; shotAge = Infinity; lastVisualPose = null;
    const settings = { duel: 40, squad: 60, blast: 30 };
    distance = settings[scenario];
    $('distance').value = distance;
    for (const item of targets) {
      item.root.dispose(false, false);
      item.material.dispose();
    }
    targets = [];
    const count = scenario === 'duel' ? 1 : 4;
    battle = rules.createBattle({ funds: 1500, prices });
    actor = battle.addUnit({ id: 'герой', team: 'свои', x: 0, z: 0 });
    foes = [];
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - 1.5) * 2;
      const enemy = battle.addUnit({ id: 'мишень-' + (i + 1),
        team: 'враг', x: distance, z: offset });
      foes.push(enemy);
      targets.push(makeTarget(enemy));
    }
    selected = 'Kar98k'; moving = false;
    $('motion').setAttribute('aria-pressed', 'false');
    $('motion').textContent = 'Стрелять на бегу: нет';
    refresh();
    setPose('ready');
    changeVisualWeapon();
    log('Полигон сброшен. Выберите оружие на базе, затем нажмите «В бой».');
  }
  function setPose(pose) {
    if (rigState && typeof rigState.setWeaponPose === 'function')
      rigState.setWeaponPose(pose);
  }
  async function changeVisualWeapon() {
    if (!rigState || !rigState.equipWeapon) return;
    try { await rigState.equipWeapon(gear[selected]); }
    catch (error) { log('Не удалось загрузить модель оружия: ' + String(error)); }
  }
  async function selectWeapon(weapon) {
    if (!rules.WEAPONS[weapon]) return;
    let result;
    if (weapon === 'Kar98k') result = battle.switchWeapon(actor, weapon);
    else if (actor.inventory[weapon]) result = battle.switchWeapon(actor, weapon);
    else result = battle.buyWeapon(actor, weapon, { atBase });
    if (!result.ok) {
      log(result.reason === 'return-to-base' ?
        'За новым оружием необходимо вернуться на основную базу.' :
        result.reason === 'insufficient-funds' ?
          'Недостаточно армейских денег для покупки.' :
          'Операция недоступна: ' + result.reason);
      return;
    }
    selected = weapon;
    shotAge = Infinity; lastVisualPose = null;
    await changeVisualWeapon();
    syncPresentation();
    refresh();
    log(weapon === 'Kar98k' ? 'Штатная винтовка, патроны бесконечны.' :
      'Снаряжение: ' + weapon + ', боекомплект ' + battle.totalAmmo(actor, weapon) + ' патронов/снарядов.');
  }
  function restoreSupply() {
    const weapon = selected !== 'Kar98k' ? selected :
      ['MG42', 'MP40', 'Panzerschreck'].find(id => actor.inventory[id]);
    if (!weapon) { log('У бойца только штатная винтовка: пополнять нечего.'); return; }
    const r = battle.resupply(actor, weapon, { atBase });
    if (!r.ok) {
      log(r.reason === 'return-to-base' ? 'БК покупается только на базе.' :
        r.reason === 'insufficient-funds' ? 'Недостаточно денег на магазин или ленту.' :
          'Пополнение невозможно: ' + r.reason);
      return;
    }
    log(r.added ? 'Куплено: +' + r.added + ' для ' + weapon + ' за ' + r.cost + ' монет.' :
      'Боекомплект ' + weapon + ' уже полный.');
    refresh();
  }
  function tracer(from, to, weapon, isHit, impact = null) {
    const p1 = coords(from, 1.45), p2 = impact ? coords(impact, 1.1) : coords(to, 1.1);
    if (!isHit && !impact) p2.z += (Math.random() - .5) * 2;
    const l = B.MeshBuilder.CreateLines('shot', { points: [p1, p2] }, scene);
    l.color = weapon === 'Panzerschreck' ? new B.Color3(1, .46, .1) :
      from === actor ? new B.Color3(1, .86, .44) : new B.Color3(1, .35, .22);
    effects.push({ mesh: l, ttl: weapon === 'Panzerschreck' ? .32 : .12 });
    if (weapon === 'Panzerschreck') {
      const sphere = B.MeshBuilder.CreateSphere('HE blast', { diameter: 1.1, segments: 12 }, scene);
      sphere.position.copyFrom(coords(impact || to, .7));
      const mat = new B.StandardMaterial('HE glow', scene);
      mat.emissiveColor = new B.Color3(1, .38, .06);
      mat.alpha = .5; sphere.material = mat;
      effects.push({ mesh: sphere, material: mat, ttl: .3 });
    }
  }
  function actShot(unit, target, dt) {
    if (!unit.alive || !target || !target.alive) return;
    let loops = 0;
    // Catch up shots after different frame durations. Cap to prevent runaway after tab resumes.
    while (loops++ < 6) {
      const result = battle.fire(unit, target, { moving: unit === actor && moving });
      if (!result.ok) break;
      tracer(unit, target, result.weapon, result.hit, result.impact);
      if (unit === actor) {
        shotAge = 0; // A real successful fire() event drives the 3D recoil pose.
        // The visible GLB must follow the automatic fallback, not just the damage rules.
        if (actor.weapon === 'Kar98k' && result.weapon !== 'Kar98k') {
          selected = 'Kar98k';
          changeVisualWeapon();
        }
        const hitText = result.hits.length ?
          result.hits.map(h => h.id + ': −' + h.damage + ' HP').join(', ') :
          'промах';
        log(result.weapon + ': ' + hitText +
          (result.lethal ? ' · СМЕРТЕЛЬНЫЙ ВЫСТРЕЛ' : '') +
          (actor.weapon === 'Kar98k' && result.weapon !== 'Kar98k' ?
            ' · БК исчерпан, переход на Kar98k' : ''));
      }
      if (!unit.alive || !target.alive) break;
    }
  }
  function drawFrame() {
    const dt = Math.min(engine.getDeltaTime() / 1000, .075);
    if (ready && Number.isFinite(shotAge)) shotAge += dt;
    if (ready) battle.tick(dt); // Timers also advance safely on the base.
    if (ready && active) {
      const target = foes.find(x => x.alive);
      if (actor.alive && target) actShot(actor, target, dt);
      for (const enemy of foes) {
        if (enemy.alive && actor.alive) actShot(enemy, actor, dt);
      }
      if (!actor.alive || !foes.some(x => x.alive)) {
        active = false;
        setPose('ready');
        log(actor.alive ? 'ПОБЕДА! Все цели уничтожены. Можно вернуться на базу.' :
          'ПОРАЖЕНИЕ! Герой погиб. Начните новый бой кнопкой «Сброс».');
      }
      if (active && performance.now() - lastPaint > 180) {
        lastPaint = performance.now(); refresh();
      }
    }
    if (ready) syncPresentation();
    for (const target of targets) {
      const alive = target.unit.alive;
      target.root.setEnabled(alive);
      if (alive) {
        const p = target.unit.hp / target.unit.maxHp;
        target.material.diffuseColor.set(.68 + .2 * (1 - p), .22 + .20 * p, .19 + .11 * p);
      }
    }
    for (const effect of [...effects]) {
      effect.ttl -= dt;
      if (effect.ttl <= 0) {
        effect.mesh.dispose(); effect.material?.dispose();
        effects.splice(effects.indexOf(effect), 1);
      }
    }
    scene.render();
  }
  function syncPresentation() {
    if (!actor) return;
    const visual = presentation.describe(actor, { active, moving, shotAge });
    if (visual.pose !== lastVisualPose) {
      setPose(visual.pose);
      lastVisualPose = visual.pose;
    }
    if (rigState) {
      // The approved weapon rig owns all IK and geometry. This layer only
      // signals moving-fire recoil; never invents an animation or refill event.
      rigState.combatPose = {
        active: active && actor.alive,
        stage: visual.stage,
        recoilPulse: visual.recoilPulse,
        crouch: 0
      };
    }
    const now = performance.now();
    if (now - lastVisualPaint < 90) return;
    lastVisualPaint = now;
    $('combat-state').textContent = visual.display;
    $('reload-fill').style.width = Math.round(visual.reloadProgress * 100) + '%';
    $('reload-bar').setAttribute('aria-valuenow',
      String(Math.round(visual.reloadProgress * 100)));
    // The DOM represents game-state reload time, NOT the preview's artificial
    // fixed 30 fps sequence, which historically refilled infinite ammo.
  }
  function refresh() {
    if (!battle || !actor) return;
    for (const button of document.querySelectorAll('[data-gun]'))
      button.setAttribute('aria-pressed', String(button.dataset.gun === selected));
    for (const button of document.querySelectorAll('[data-case]'))
      button.setAttribute('aria-pressed', String(button.dataset.case === scenario));
    $('distanceValue').textContent = String(distance);
    $('go').textContent = atBase ? 'В бой' : 'Вернуться на базу';
    $('supply').disabled = !atBase;
    $('manual-reload').disabled = !actor.alive || actor.weapon === 'Kar98k' ||
      actor.reloadRemaining > 0 || actor.inventory[actor.weapon]?.reserve <= 0 ||
      actor.inventory[actor.weapon]?.loaded === rules.WEAPONS[actor.weapon].magazineSize;
    const weapon = actor.weapon;
    const inventory = weapon !== 'Kar98k' ? actor.inventory[weapon] : null;
    const paid = ['MP40', 'MG42', 'Panzerschreck']
      .filter(w => actor.inventory[w])
      .map(w => w + ':' + battle.totalAmmo(actor, w)).join(' · ');
    $('telemetry').textContent =
      'База: ' + (atBase ? 'ДА' : 'НЕТ') + '  |  Казна: ' + battle.getFunds() +
      '\nГерой: ' + Math.ceil(actor.hp) + '/' + actor.maxHp +
      ' HP  |  Противников: ' + foes.filter(e => e.alive).length +
      '\nОружие: ' + weapon + (weapon === 'Kar98k' ? ' · БК ∞' :
        ' · ' + inventory.loaded + ' в оружии, ' + inventory.reserve + ' в запасе') +
      (actor.reloadRemaining > 0 ? '\nПерезарядка: ' + actor.reloadRemaining.toFixed(1) + ' с' : '') +
      (paid ? '\nАрсенал: ' + paid : '') +
      '\nТочность сейчас: ' + Math.round(rules.hitChance(actor.weapon, distance,
        { moving, suppressed: actor.suppressed > 0 }) * 100) + '% на '+ distance + ' ед.' +
      '\nВыстрелы: ' + actor.shots + ' · попадания: ' + actor.hits +
      ' · уничтожено: ' + actor.kills;
  }
  function moveTargets() {
    for (let i = 0; i < foes.length; i++) {
      foes[i].x = distance;
      targets[i].root.position.copyFrom(coords(foes[i]));
    }
    refresh();
  }
  function wireControls() {
    for (const button of document.querySelectorAll('[data-gun]'))
      button.addEventListener('click', () => selectWeapon(button.dataset.gun));
    for (const button of document.querySelectorAll('[data-case]'))
      button.addEventListener('click', () => setScenario(button.dataset.case));
    $('distance').addEventListener('input', e => {
      distance = Number(e.target.value); moveTargets();
    });
    $('motion').addEventListener('click', () => {
      moving = !moving;
      $('motion').textContent = 'Стрелять на бегу: ' + (moving ? 'да' : 'нет');
      $('motion').setAttribute('aria-pressed', String(moving));
      if (moving && (actor.weapon === 'Kar98k' || actor.weapon === 'Panzerschreck'))
        log('Это оружие стреляет только с полной остановки. Снимите режим бега.');
      refresh();
    });
    $('restart').addEventListener('click', () => setScenario(scenario));
    $('supply').addEventListener('click', restoreSupply);
    $('manual-reload').addEventListener('click', () => {
      const reload = battle.startReload(actor);
      log(reload.ok ? 'Начата перезарядка ' + actor.reloadWeapon + ' · ' +
        reload.seconds + ' с. Во время неё стрельба заблокирована.' :
        'Нельзя перезарядить: ' + (reload.reason || 'неизвестная причина'));
      syncPresentation(); refresh();
    });
    $('go').addEventListener('click', () => {
      if (!actor.alive) { log('Боец погиб. Нажмите «Сброс».'); return; }
      atBase = !atBase;
      active = !atBase && foes.some(e => e.alive);
      shotAge = Infinity;
      syncPresentation();
      log(active ? 'Начался бой. Выстрелы и HP рассчитываются автоматически.' :
        'На основной базе. Можно купить оружие и пополнить БК.');
      refresh();
    });
  }
  async function loadSoldier() {
    const imported = await B.SceneLoader.ImportMeshAsync(
      '', '../assets/soldiers/', 'german.glb', scene);
    const drawable = imported.meshes.filter(m => m.getTotalVertices?.() > 0);
    if (drawable.length < 4 || !imported.skeletons.some(s => s.bones.length >= 60))
      throw Error('Не удалось проверить утверждённый скелет солдата');
    const min = new B.Vector3(Infinity, Infinity, Infinity),
      max = new B.Vector3(-Infinity, -Infinity, -Infinity);
    for (const mesh of drawable) {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      min.minimizeInPlace(bounds.minimumWorld);
      max.maximizeInPlace(bounds.maximumWorld);
    }
    const rawHeight = max.y - min.y;
    if (!(rawHeight > 0)) throw Error('Некорректная высота солдата');
    const root = new B.TransformNode('approved-soldier-display', scene);
    for (const mesh of imported.meshes) if (!mesh.parent) mesh.parent = root;
    for (const node of imported.transformNodes) if (!node.parent) node.parent = root;
    const factor = 1.8 / rawHeight;
    root.scaling.setAll(factor);
    root.position.set(startX - (min.x + max.x) * .5 * factor,
      -min.y * factor, -(min.z + max.z) * .5 * factor);
    root.rotation.y = Math.PI / 2;
    heroMesh = root;
    rigState = {};
    await window.BattlefieldWeaponRig.create({
      scene, imported, root, state: rigState, bindUI: false,
      weaponRoot: '../assets/ww2-weapons/'
    });
    return drawable.length;
  }
  try {
    buildWorld();
    wireControls();
    setScenario('duel');
    const count = await loadSoldier();
    ready = true;
    log('Загружен утверждённый немецкий стрелок (' + count + ' элементов). Выберите оружие и начните бой.');
    refresh();
    window.__BATTLEFIELD_BALANCE_RANGE__ = { get battle() { return battle; },
      get actor() { return actor; }, get ready() { return ready; },
      get scene() { return scene; }, get rig() { return rigState; } };
  } catch (error) {
    ready = false; active = false;
    $('telemetry').textContent = 'Ошибка загрузки полигона: ' + (error?.message || error);
    log('3D-модель/IK не загрузились. Проверьте сеть и адрес страницы.');
    console.error('Battlefield range', error);
  }
})();