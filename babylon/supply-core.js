/* Battlefield / Babylon.js - army logistics and finite ammunition.
 * Pure JS: no Babylon, DOM or routefinding dependency.
 * This module models the economy and issues return-to-base orders; the game's
 * navigation AI must actually move the unit and call arriveAtBase().
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BattlefieldSupply = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const RIFLE = 'Kar98k';
  const SPECS = Object.freeze({
    Kar98k: Object.freeze({ capacity: Infinity, containers: Infinity, reloadSeconds: 0, infinite: true }),
    MP40: Object.freeze({ capacity: 32, containers: 5, reloadSeconds: 2.5, infinite: false }),
    MG42: Object.freeze({ capacity: 100, containers: 4, reloadSeconds: 7.5, infinite: false }),
    Panzerschreck: Object.freeze({ capacity: 1, containers: 4, reloadSeconds: 9, infinite: false })
  });

  // Temporary ECONOMY BALANCE VALUES for prototype; not approved game prices.
  // Every cost can be overridden through createArmy({ prices }).
  const DEMO_PRICES = Object.freeze({
    weapons: Object.freeze({ MP40: 240, MG42: 520, Panzerschreck: 680 }),
    ammo: Object.freeze({ MP40: 32, MG42: 100, Panzerschreck: 140 })
  });

  const SPECIAL = Object.freeze(['MP40', 'MG42', 'Panzerschreck']);
  function checkMoney(n, label) {
    if (!Number.isSafeInteger(n) || n < 0) throw Error(label + ' must be a nonnegative integer');
  }
  function checkUnitId(id) {
    if ((typeof id !== 'string' && typeof id !== 'number') || String(id).length === 0)
      throw Error('Valid unit id required');
  }
  function createArmy({ funds = 0, prices = DEMO_PRICES, onReturnToBase = () => {},
    onEvent = () => {} } = {}) {
    checkMoney(funds, 'funds');
    for (const gun of SPECIAL) {
      checkMoney(prices.weapons?.[gun], 'price for ' + gun);
      checkMoney(prices.ammo?.[gun], 'ammo price for ' + gun);
      if (prices.ammo[gun] === 0) throw Error('Ammunition must have a positive price');
    }
    const units = new Map();
    let treasury = funds;
    function unitFor(id) {
      if (!units.has(id)) throw Error('Unknown soldier: ' + id);
      return units.get(id);
    }
    function emit(type, u, fields = {}) {
      onEvent({ type, unitId: u?.id ?? null, funds: treasury, ...fields });
    }
    function stock(u, gun) {
      if (!SPECIAL.includes(gun)) throw Error('Unknown special weapon: ' + gun);
      const bag = u.stock[gun];
      if (!bag) throw Error('Weapon not purchased: ' + gun);
      return bag;
    }
    function rounds(u, gun) {
      const bag = u.stock[gun];
      return bag ? bag.loaded + bag.spares * SPECS[gun].capacity : 0;
    }
    function stateOf(u) {
      const gun = u.weapon;
      const chosen = gun === RIFLE ? null : u.stock[gun];
      const inventory = {};
      for (const type of SPECIAL) {
        const bag = u.stock[type];
        inventory[type] = bag ? {
          loaded: bag.loaded, spareContainers: bag.spares,
          reserveRounds: bag.spares * SPECS[type].capacity,
          totalRounds: rounds(u, type),
          maxRounds: SPECS[type].capacity * SPECS[type].containers
        } : null;
      }
      return {
        id: u.id, weapon: gun, preferredWeapon: u.preferred, atBase: u.atBase,
        returningToBase: u.returning, assignedTask: u.assignedTask,
        reloading: !!u.reload, reloadRemainingSeconds: u.reload
          ? Math.max(0, +(u.reload.duration - u.reload.elapsed).toFixed(3)) : 0,
        shotsFired: u.shotsFired,
        roundsLoaded: chosen ? chosen.loaded : null,
        spareContainers: chosen ? chosen.spares : null,
        totalRounds: chosen ? rounds(u, gun) : Infinity,
        weaponsOwned: [RIFLE, ...SPECIAL.filter(w => !!u.stock[w])],
        inventory
      };
    }
    function snapshot(id) {
      if (id !== undefined) return structuredSnapshot(stateOf(unitFor(id)));
      return {
        funds: treasury,
        prices: { weapons: { ...prices.weapons }, ammo: { ...prices.ammo } },
        units: Array.from(units.values(), u => structuredSnapshot(stateOf(u)))
      };
    }
    function structuredSnapshot(obj) {
      // Build fresh nested values; no mutable references escape to callers.
      return { ...obj, weaponsOwned: [...obj.weaponsOwned],
        inventory: Object.fromEntries(SPECIAL.map(w =>
          [w, obj.inventory[w] ? { ...obj.inventory[w] } : null])) };
    }
    function addUnit(id, { atBase = true, assignedTask = null } = {}) {
      checkUnitId(id);
      if (units.has(id)) throw Error('Soldier already exists: ' + id);
      const u = { id, atBase: !!atBase, assignedTask, weapon: RIFLE,
        preferred: RIFLE, stock: Object.create(null),
        shotsFired: 0, reload: null, returning: false };
      units.set(id, u);
      emit('unit-created', u, { weapon: RIFLE });
      return snapshot(id);
    }
    function setTask(id, task) { const u = unitFor(id); u.assignedTask = task; return snapshot(id); }
    function switchWeapon(id, weapon) {
      const u = unitFor(id);
      if (weapon !== RIFLE && !u.stock[weapon]) return { ok: false, reason: 'not-owned' };
      if (weapon !== RIFLE && rounds(u, weapon) === 0)
        return { ok: false, reason: 'out-of-ammo' };
      u.reload = null;
      u.weapon = weapon;
      u.preferred = weapon;
      u.returning = false;
      emit('weapon-selected', u, { weapon });
      return { ok: true, soldier: snapshot(id) };
    }
    function buyWeapon(id, weapon) {
      const u = unitFor(id);
      if (!SPECIAL.includes(weapon)) return { ok: false, reason: 'unsupported-weapon' };
      if (!u.atBase) return { ok: false, reason: 'not-at-base' };
      if (u.stock[weapon]) return switchWeapon(id, weapon);
      const cost = prices.weapons[weapon];
      if (treasury < cost) return { ok: false, reason: 'insufficient-funds', cost, funds: treasury };
      treasury -= cost;
      u.stock[weapon] = { loaded: SPECS[weapon].capacity, spares: SPECS[weapon].containers - 1 };
      u.weapon = weapon;
      u.preferred = weapon;
      u.reload = null;
      u.returning = false;
      emit('weapon-purchased', u, { weapon, cost, loaded: u.stock[weapon].loaded,
        spareContainers: u.stock[weapon].spares });
      return { ok: true, cost, funds: treasury, soldier: snapshot(id) };
    }
    function neededAtBase(u, gun) {
      const bag = stock(u, gun), spec = SPECS[gun];
      // Loaded partial magazine can be topped up without discarding rounds.
      return bag.loaded < spec.capacity || bag.spares < spec.containers - 1;
    }
    function minimumSupplyPrice(gun) {
      return prices.ammo[gun];
    }
    function scheduleReturn(u) {
      const preferred = u.preferred;
      if (preferred === RIFLE || rounds(u, preferred) > 0) return false;
      if (u.atBase) return false;
      if (treasury < minimumSupplyPrice(preferred) || u.returning) return false;
      u.returning = true;
      emit('return-to-base-ordered', u, { weapon: preferred });
      onReturnToBase({ unitId: u.id, weapon: preferred, assignedTask: u.assignedTask });
      return true;
    }
    function fallback(u, gun) {
      if (u.weapon === gun) {
        u.weapon = RIFLE;
        u.reload = null;
        emit('fallback-rifle', u, { emptyWeapon: gun });
      }
      scheduleReturn(u);
    }
    function fire(id) {
      const u = unitFor(id), weapon = u.weapon;
      if (weapon === RIFLE) {
        u.shotsFired++;
        return { ok: true, weapon, infinite: true, soldier: snapshot(id) };
      }
      if (u.reload) return { ok: false, reason: 'reloading' };
      const bag = stock(u, weapon);
      if (bag.loaded === 0) {
        if (bag.spares > 0) return { ok: false, reason: 'reload-required' };
        fallback(u, weapon);
        return { ok: false, reason: 'out-of-ammo', fallback: RIFLE };
      }
      bag.loaded--;
      u.shotsFired++;
      const depleted = bag.loaded === 0 && bag.spares === 0;
      if (depleted) fallback(u, weapon);
      emit('shot', u, { weapon, loaded: bag.loaded, total: rounds(u, weapon) });
      return { ok: true, weapon, loaded: bag.loaded, total: rounds(u, weapon),
        depleted, soldier: snapshot(id) };
    }
    function beginReload(id) {
      const u = unitFor(id), weapon = u.weapon;
      if (weapon === RIFLE) return { ok: false, reason: 'rifle-infinite' };
      const bag = stock(u, weapon), spec = SPECS[weapon];
      if (u.reload) return { ok: false, reason: 'already-reloading' };
      if (bag.loaded !== 0) return { ok: false, reason: 'magazine-not-empty' };
      if (bag.spares === 0) {
        fallback(u, weapon);
        return { ok: false, reason: 'out-of-ammo', fallback: RIFLE };
      }
      u.reload = { weapon, elapsed: 0, duration: spec.reloadSeconds };
      emit('reload-start', u, { weapon, seconds: spec.reloadSeconds });
      return { ok: true, seconds: spec.reloadSeconds };
    }
    function tick(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw Error('Invalid delta time');
      const done = [];
      for (const u of units.values()) {
        const loading = u.reload;
        if (!loading) continue;
        loading.elapsed += dt;
        if (loading.elapsed + 1e-9 < loading.duration) continue;
        const bag = stock(u, loading.weapon);
        if (bag.loaded !== 0 || bag.spares < 1)
          throw Error('Invalid reload inventory state');
        bag.spares--;
        bag.loaded = SPECS[loading.weapon].capacity;
        u.reload = null;
        emit('reload-complete', u, { weapon: loading.weapon, loaded: bag.loaded,
          spareContainers: bag.spares });
        done.push({ unitId: u.id, weapon: loading.weapon });
      }
      return done;
    }
    function cancelReload(id) {
      const u = unitFor(id);
      u.reload = null; // No ammunition granted on cancellation.
      return snapshot(id);
    }
    function resupply(id, weapon) {
      const u = unitFor(id);
      if (!u.atBase) return { ok: false, reason: 'not-at-base' };
      const w = weapon || u.preferred;
      if (!SPECIAL.includes(w) || !u.stock[w]) return { ok: false, reason: 'not-owned' };
      u.reload = null;
      const bag = stock(u, w), spec = SPECS[w];
      let spent = 0, packages = 0, toppedUpRounds = 0;
      // Top up the partial/empty loaded container. Pro-rata price ensures
      // remaining rounds are never discarded and paid for twice.
      const missing = spec.capacity - bag.loaded;
      if (missing) {
        const cost = Math.ceil(missing * prices.ammo[w] / spec.capacity);
        if (cost <= treasury) {
          bag.loaded = spec.capacity;
          treasury -= cost; spent += cost; toppedUpRounds += missing;
        }
      }
      while (bag.spares < spec.containers - 1 && treasury >= prices.ammo[w]) {
        treasury -= prices.ammo[w]; spent += prices.ammo[w];
        bag.spares++; packages++;
      }
      if (!spent) return { ok: !neededAtBase(u, w), cost: 0, reason:
        neededAtBase(u, w) ? 'insufficient-funds' : 'already-full', soldier: snapshot(id) };
      emit('ammo-purchased', u, { weapon: w, cost: spent, newSpareContainers: packages,
        toppedUpRounds });
      if (u.preferred === w && rounds(u, w) > 0) {
        u.weapon = w;
        u.returning = false;
      }
      return { ok: true, cost: spent, newSpareContainers: packages, toppedUpRounds,
        complete: !neededAtBase(u, w), funds: treasury, soldier: snapshot(id) };
    }
    function leaveBase(id) {
      const u = unitFor(id);
      u.atBase = false; u.returning = false;
      return snapshot(id);
    }
    function arriveAtBase(id) {
      const u = unitFor(id);
      u.atBase = true; u.returning = false;
      emit('base-arrival', u);
      const result = u.preferred === RIFLE ? { ok: true } : resupply(id, u.preferred);
      if (u.preferred !== RIFLE && rounds(u, u.preferred) > 0) u.weapon = u.preferred;
      emit('base-supply-processed', u, { weapon: u.weapon, success: result.ok });
      return { ...result, soldier: snapshot(id) };
    }
    function addFunds(amount) {
      checkMoney(amount, 'income');
      if (!Number.isSafeInteger(treasury + amount)) throw Error('Treasury overflow');
      treasury += amount;
      emit('income', null, { amount });
      for (const u of units.values()) scheduleReturn(u);
      return treasury;
    }
    return { addUnit, setTask, snapshot, buyWeapon, switchWeapon, fire, beginReload,
      tick, cancelReload, resupply, leaveBase, arriveAtBase, addFunds,
      getFunds: () => treasury, SPECS, prices };
  }
  return { createArmy, SPECS, DEMO_PRICES, RIFLE, SPECIAL };
});
