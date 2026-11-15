/* Battlefield Babylon: deterministic, renderer-independent weapon rules.
 * Does not alter approved GLB, IK, camera, or legacy Three.js.
 * The initial values for shot rates, suppression and HE radius are tuning parameters.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BattlefieldBalance = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const WEAPONS = Object.freeze({
    Kar98k: Object.freeze({
      range: 100, damage: 75, interval: 2.1, magazineSize: Infinity,
      magazines: Infinity, reloadSeconds: 0, canFireMoving: false,
      lethalChance: .25,
      accuracy: [[20, .85], [40, .70], [60, .50], [80, .30], [100, 1 / 7]]
    }),
    MP40: Object.freeze({
      range: 60, damage: 24, interval: .105, magazineSize: 32,
      magazines: 5, reloadSeconds: 2.5, canFireMoving: true,
      movingAccuracy: .70,
      accuracy: [[20, .75], [40, .55], [60, .25]]
    }),
    MG42: Object.freeze({
      range: 80, damage: 45, interval: .067, magazineSize: 100,
      magazines: 4, reloadSeconds: 7.5, canFireMoving: true,
      movingAccuracy: .42, suppressSeconds: 1.8,
      accuracy: [[20, .65], [40, .60], [60, .55], [80, .35]]
    }),
    Panzerschreck: Object.freeze({
      range: 100, damage: 120, interval: 1, magazineSize: 1,
      magazines: 4, reloadSeconds: 9, canFireMoving: false,
      blastRadius: 5, accuracy: [[20, .88], [40, .78], [60, .65], [80, .5], [100, .35]]
    })
  });
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  function hitChance(weapon, distance, { moving = false, suppressed = false, cover = 0 } = {}) {
    const w = WEAPONS[weapon];
    if (!w || !Number.isFinite(distance) || distance < 0 || distance > w.range) return 0;
    const points = w.accuracy;
    let base = points[0][1];
    for (let i = 1; i < points.length; i++) {
      if (distance >= points[i][0]) { base = points[i][1]; continue; }
      const previous = points[i - 1], next = points[i];
      base = previous[1] + (next[1] - previous[1]) *
        (distance - previous[0]) / (next[0] - previous[0]);
      break;
    }
    if (moving) base *= w.movingAccuracy ?? 1;
    if (suppressed) base *= .55;
    return clamp(base * (1 - .5 * clamp(cover, 0, 1)), 0, 1);
  }
  function createBattle({ funds = 0, prices = {}, random = Math.random } = {}) {
    if (!Number.isFinite(funds) || funds < 0) throw Error('Invalid army funds');
    if (typeof random !== 'function') throw Error('Random function required');
    let treasury = funds, nextId = 1;
    const units = [], events = [];
    function emit(type, data = {}) {
      const entry = { type, ...data };
      events.push(entry);
      if (events.length > 400) events.shift();
      return entry;
    }
    function unitOf(unit) {
      if (!units.includes(unit)) throw Error('Unit does not belong to this battle');
      return unit;
    }
    function addUnit({ id, team = 'ally', x = 0, z = 0, hp = 100 } = {}) {
      if (!Number.isFinite(hp) || hp <= 0) throw Error('Invalid health');
      const unit = {
        id: id || 'soldier-' + nextId++, team, x, z, hp, maxHp: hp,
        alive: true, weapon: 'Kar98k', inventory: {},
        cooldown: 0, reloadRemaining: 0, reloadWeapon: null, suppressed: 0,
        kills: 0, hits: 0, shots: 0
      };
      if (units.some(u => u.id === unit.id)) throw Error('Duplicate unit id');
      units.push(unit);
      return unit;
    }
    function getPrice(weapon, field) {
      const value = prices[weapon] && prices[weapon][field];
      if (!Number.isFinite(value) || value < 0) return null;
      return value;
    }
    function switchWeapon(unit, weapon) {
      unitOf(unit);
      if (!WEAPONS[weapon]) return { ok: false, reason: 'unknown-weapon' };
      if (weapon !== 'Kar98k' && !unit.inventory[weapon])
        return { ok: false, reason: 'not-owned' };
      if (weapon !== 'Kar98k' && totalAmmo(unit, weapon) <= 0)
        return { ok: false, reason: 'out-of-ammo' };
      unit.weapon = weapon;
      unit.reloadRemaining = 0;
      unit.reloadWeapon = null;
      unit.cooldown = 0;
      emit('switch', { id: unit.id, weapon });
      return { ok: true, weapon };
    }
    function totalAmmo(unit, weapon = unit.weapon) {
      if (weapon === 'Kar98k') return Infinity;
      const slot = unit.inventory[weapon];
      return slot ? slot.loaded + slot.reserve : 0;
    }
    function buyWeapon(unit, weapon, { atBase = false } = {}) {
      unitOf(unit);
      if (weapon === 'Kar98k' || !WEAPONS[weapon]) return { ok: false, reason: 'not-purchasable' };
      if (!atBase) return { ok: false, reason: 'return-to-base' };
      if (unit.inventory[weapon]) return switchWeapon(unit, weapon);
      const cost = getPrice(weapon, 'weapon');
      if (cost === null) return { ok: false, reason: 'price-not-configured' };
      if (treasury < cost) return { ok: false, reason: 'insufficient-funds' };
      treasury -= cost;
      const w = WEAPONS[weapon];
      unit.inventory[weapon] = {
        loaded: w.magazineSize,
        reserve: w.magazineSize * (w.magazines - 1),
        full: w.magazineSize * w.magazines
      };
      switchWeapon(unit, weapon);
      emit('purchase', { id: unit.id, weapon, cost, funds: treasury });
      return { ok: true, cost, funds: treasury, ammo: totalAmmo(unit, weapon) };
    }
    function resupply(unit, weapon = unit.weapon, { atBase = false } = {}) {
      unitOf(unit);
      if (!atBase) return { ok: false, reason: 'return-to-base' };
      const slot = unit.inventory[weapon], w = WEAPONS[weapon];
      if (!slot || !w || weapon === 'Kar98k') return { ok: false, reason: 'not-owned' };
      const cost = getPrice(weapon, 'magazine');
      if (cost === null) return { ok: false, reason: 'price-not-configured' };
      const missing = slot.full - totalAmmo(unit, weapon);
      if (missing <= 0) return { ok: true, added: 0, cost: 0, funds: treasury };
      const needed = Math.ceil(missing / w.magazineSize);
      const possible = cost === 0 ? needed : Math.floor(treasury / cost);
      const bought = Math.min(needed, possible);
      if (bought < 1) return { ok: false, reason: 'insufficient-funds' };
      const added = Math.min(missing, bought * w.magazineSize);
      slot.reserve += added;
      treasury -= bought * cost;
      emit('resupply', { id: unit.id, weapon, added, cost: bought * cost, funds: treasury });
      return { ok: true, added, cost: bought * cost, funds: treasury };
    }
    function fallback(unit) {
      if (unit.weapon === 'Kar98k') return;
      const from = unit.weapon;
      unit.weapon = 'Kar98k';
      unit.reloadRemaining = 0; unit.reloadWeapon = null;
      unit.cooldown = 0;
      emit('fallback', { id: unit.id, from, weapon: 'Kar98k' });
    }
    function startReload(unit) {
      unitOf(unit);
      const weapon = unit.weapon, w = WEAPONS[weapon];
      if (!w || weapon === 'Kar98k') return { ok: false, reason: 'rifle-unlimited' };
      const slot = unit.inventory[weapon];
      if (!slot || slot.reserve <= 0) {
        if (!slot || slot.loaded <= 0) fallback(unit);
        return { ok: false, reason: 'no-reserve' };
      }
      if (unit.reloadRemaining > 0) return { ok: false, reason: 'already-reloading' };
      if (slot.loaded >= w.magazineSize) return { ok: false, reason: 'magazine-full' };
      unit.cooldown = 0; // A reload cannot accumulate fire time.
      unit.reloadRemaining = w.reloadSeconds;
      unit.reloadWeapon = weapon;
      emit('reload-start', { id: unit.id, weapon, seconds: w.reloadSeconds });
      return { ok: true, seconds: w.reloadSeconds };
    }
    function tick(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw Error('Invalid delta time');
      for (const unit of units) {
        if (!unit.alive) continue;
        unit.cooldown = Math.max(-.25, unit.cooldown - dt);
        unit.suppressed = Math.max(0, unit.suppressed - dt);
        if (unit.reloadRemaining <= 0) continue;
        unit.reloadRemaining = Math.max(0, unit.reloadRemaining - dt);
        if (unit.reloadRemaining > 0) continue;
        const weapon = unit.reloadWeapon;
        unit.reloadWeapon = null;
        const slot = unit.inventory[weapon];
        if (!slot) continue;
        const need = WEAPONS[weapon].magazineSize - slot.loaded;
        const transfer = Math.min(need, slot.reserve);
        slot.loaded += transfer;
        slot.reserve -= transfer;
        emit('reload-complete', { id: unit.id, weapon, loaded: slot.loaded, reserve: slot.reserve });
        if (!transfer && !slot.loaded) fallback(unit);
      }
    }
    function fire(attacker, target, { distance, moving = false, cover = 0, targets } = {}) {
      unitOf(attacker);
      unitOf(target);
      if (!attacker.alive || !target.alive || attacker.team === target.team)
        return { ok: false, reason: 'invalid-target' };
      const weapon = attacker.weapon, w = WEAPONS[weapon];
      const d = distance === undefined ? Math.hypot(attacker.x - target.x, attacker.z - target.z) : distance;
      if (!Number.isFinite(d) || d < 0 || d > w.range)
        return { ok: false, reason: 'out-of-range', distance: d };
      if (moving && !w.canFireMoving) return { ok: false, reason: 'stop-to-fire' };
      if (attacker.reloadRemaining > 0) return { ok: false, reason: 'reloading' };
      if (attacker.cooldown > 0) return { ok: false, reason: 'cooldown' };
      if (weapon !== 'Kar98k') {
        const slot = attacker.inventory[weapon];
        if (!slot || slot.loaded <= 0) {
          startReload(attacker);
          return { ok: false, reason: 'magazine-empty' };
        }
        slot.loaded--;
      }
      attacker.shots++;
      attacker.cooldown += w.interval; // Preserve fractional frame overshoot across FPS.
      const probability = hitChance(weapon, d, { moving, suppressed: attacker.suppressed > 0, cover });
      const hit = random() < probability;
      const hits = [];
      const damageTarget = (unit, amount) => {
        if (!unit.alive || amount <= 0) return;
        const damage = Math.min(unit.hp, amount);
        unit.hp = Math.max(0, unit.hp - amount);
        hits.push({ id: unit.id, damage, hp: unit.hp });
        attacker.hits++;
        if (unit.hp <= 0) {
          unit.alive = false; attacker.kills++;
          emit('kill', { attacker: attacker.id, victim: unit.id, weapon });
        }
      };
      let lethal = false, impact = null;
      if (weapon === 'MG42') target.suppressed = Math.max(target.suppressed, w.suppressSeconds);
      if (weapon === 'Panzerschreck') {
        const near = Array.isArray(targets) ? targets : units;
        const angle = random() * Math.PI * 2;
        // Miss: explosion lands beyond blast radius (no accidental guaranteed hit).
        const miss = w.blastRadius * 1.5;
        const x = target.x + (hit ? 0 : Math.cos(angle) * miss);
        const z = target.z + (hit ? 0 : Math.sin(angle) * miss);
        impact = { x, z }; // Match visible blast with actual AoE damage origin.
        for (const enemy of near) {
          if (!units.includes(enemy) || enemy.team === attacker.team || !enemy.alive) continue;
          const radius = Math.hypot(enemy.x - x, enemy.z - z);
          if (radius > w.blastRadius) continue;
          const falloff = 1 - .8 * (radius / w.blastRadius);
          damageTarget(enemy, Math.round(w.damage * falloff));
        }
      } else if (hit) {
        lethal = weapon === 'Kar98k' && random() < w.lethalChance;
        damageTarget(target, lethal ? target.hp : w.damage);
      }
      const result = { ok: true, weapon, distance: d, probability, hit, hits, lethal,
        impact, ammo: totalAmmo(attacker, weapon) };
      emit('shot', { attacker: attacker.id, target: target.id, ...result });
      if (weapon !== 'Kar98k') {
        const slot = attacker.inventory[weapon];
        if (slot.loaded === 0) {
          if (slot.reserve > 0) startReload(attacker);
          else fallback(attacker);
        }
      }
      return result;
    }
    // Optional external economy integration. Safe additive API for campaign gold;
    // existing weapon-balance callers are unchanged.
    function grantFunds(amount){
      if(!Number.isFinite(amount)||amount<0)throw Error('Invalid funds grant');
      treasury+=amount;
      emit('funds-grant',{amount,funds:treasury});
      return treasury;
    }
    return {
      units, events, addUnit, buyWeapon, switchWeapon, resupply, totalAmmo,
      fire, tick, startReload, grantFunds, getFunds: () => treasury
    };
  }
  return { WEAPONS, hitChance, createBattle };
});
