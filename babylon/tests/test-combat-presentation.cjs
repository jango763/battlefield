'use strict';
const assert = require('node:assert/strict');
const rules = require('../combat-balance-core.js');
const { describe } = require('../combat-presentation-core.js');
const prices = {
  MP40: { weapon: 20, magazine: 5 },
  MG42: { weapon: 30, magazine: 6 },
  Panzerschreck: { weapon: 50, magazine: 10 }
};
function sample(weapon, random = () => .9) {
  const battle = rules.createBattle({ funds: 1000, prices, random });
  const ally = battle.addUnit({ team: 'ours', hp: 100 });
  const enemy = battle.addUnit({ team: 'enemy', x: 20, hp: 1000000 });
  if (weapon !== 'Kar98k') assert(battle.buyWeapon(ally, weapon, { atBase: true }).ok);
  return { battle, ally, enemy };
}
{
  const { battle, ally, enemy } = sample('Kar98k', () => 0);
  assert.equal(describe(ally).pose, 'ready');
  assert.equal(describe(ally, { active: true }).pose, 'aim');
  assert.equal(describe(ally, { active: true, moving: true }).pose, 'run');
  const shot = battle.fire(ally, enemy);
  assert(shot.ok);
  assert.equal(describe(ally, { active: true, shotAge: 0 }).pose, 'fire');
  assert.equal(describe(ally, { active: true, shotAge: .5 }).pose, 'aim');
  assert.equal(describe(ally, { active: false, shotAge: 0 }).pose, 'ready');
}
{
  const { battle, ally, enemy } = sample('MP40', () => .99);
  const shot = battle.fire(ally, enemy, { moving: true });
  assert(shot.ok);
  const movingFire = describe(ally, { active: true, moving: true, shotAge: .02 });
  assert.equal(movingFire.pose, 'run');
  assert.equal(movingFire.stage, 'runFire');
  assert(movingFire.recoilPulse > 0);
  assert.equal(describe(ally, { active: true, moving: true, shotAge: .8 }).stage, 'run');
  // A partially used MP40 can start a timed tactical reload at base/in combat.
  battle.tick(.11);
  assert(battle.startReload(ally).ok);
  const visual = describe(ally, { active: true, moving: true, shotAge: 0 });
  assert.equal(visual.stage, 'reload');
  assert.equal(visual.pose, 'run');
  assert.equal(visual.firing, false);
  assert.equal(battle.fire(ally, enemy).reason, 'reloading');
  battle.tick(1.25);
  const halfway = describe(ally, { active: true, moving: true, shotAge: 10 });
  assert(halfway.reloadProgress > .49 && halfway.reloadProgress < .51);
  battle.tick(1.25); // Works on the base as well as in active combat.
  assert.equal(ally.reloadRemaining, 0);
  assert.equal(ally.inventory.MP40.loaded, 32);
  assert.equal(ally.inventory.MP40.reserve, 127);
}
{
  const { battle, ally, enemy } = sample('MG42', () => .99);
  assert(battle.fire(ally, enemy, { moving: true }).ok);
  battle.tick(.067);
  assert(battle.startReload(ally).ok);
  assert.equal(describe(ally, { active: true, moving: true }).pose, 'ready');
  assert.equal(describe(ally, { active: true, moving: true }).reloadSeconds, 7.5);
  battle.tick(7.5);
  assert.equal(ally.inventory.MG42.loaded, 100);
  assert.equal(ally.inventory.MG42.reserve, 299);
  assert.equal(describe(ally, { active: true }).reloading, false);
}
{
  const { battle, ally, enemy } = sample('Panzerschreck', () => .0);
  const near = battle.addUnit({ team: 'enemy', x: 22 });
  const result = battle.fire(ally, enemy);
  assert(result.ok && result.impact);
  assert.equal(result.impact.x, enemy.x);
  assert.equal(result.impact.z, enemy.z);
  assert(near.hp < 100);
  assert.equal(ally.reloadRemaining, 9);
  assert.equal(describe(ally, { active: true, shotAge: 0 }).stage, 'reload');
  assert.equal(describe(ally, { active: true, shotAge: 0 }).pose, 'ready');
}
{
  const { battle, ally, enemy } = sample('Panzerschreck', () => .99);
  const result = battle.fire(ally, enemy);
  assert(result.ok && !result.hit && result.impact);
  assert(Math.hypot(result.impact.x-enemy.x, result.impact.z-enemy.z) > 5);
}
console.log('BATTLEFIELD_PRESENTATION_RELOAD_SYNC_TESTS_PASS');