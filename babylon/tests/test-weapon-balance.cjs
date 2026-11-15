'use strict';
const assert = require('node:assert/strict');
const { WEAPONS, hitChance, createBattle } = require('../combat-balance-core.js');
const nearly = (a, b) => assert(Math.abs(a - b) < 1e-9, a + ' != ' + b);
assert.equal(WEAPONS.Kar98k.range, 100);
assert.equal(WEAPONS.MP40.range, 60);
assert.equal(WEAPONS.MG42.range, 80);
assert.equal(WEAPONS.Panzerschreck.range, 100);
assert.equal(WEAPONS.Kar98k.damage, 75);
assert.equal(WEAPONS.MP40.damage, 24);
assert.equal(WEAPONS.MG42.damage, 45);
assert.equal(WEAPONS.Panzerschreck.damage, 120);
assert.equal(WEAPONS.MP40.magazineSize * WEAPONS.MP40.magazines, 160);
assert.equal(WEAPONS.MG42.magazineSize * WEAPONS.MG42.magazines, 400);
assert.equal(WEAPONS.Panzerschreck.magazineSize * WEAPONS.Panzerschreck.magazines, 4);
assert.equal(WEAPONS.MP40.reloadSeconds, 2.5);
assert.equal(WEAPONS.MG42.reloadSeconds, 7.5);
assert.equal(WEAPONS.Panzerschreck.reloadSeconds, 9);
nearly(hitChance('Kar98k', 100), 1 / 7);
nearly(hitChance('Kar98k', 20), .85);
nearly(hitChance('MP40', 40), .55);
nearly(hitChance('MG42', 60), .55);
assert.equal(hitChance('MP40', 61), 0);
assert.equal(hitChance('MG42', 81), 0);
assert(hitChance('MG42', 40, { moving: true }) < hitChance('MG42', 40));
assert(hitChance('MG42', 40, { suppressed: true }) < hitChance('MG42', 40));
assert(hitChance('Kar98k', 40, { cover: 1 }) < hitChance('Kar98k', 40));

const prices = {
  MP40: { weapon: 100, magazine: 10 },
  MG42: { weapon: 250, magazine: 20 },
  Panzerschreck: { weapon: 350, magazine: 30 }
};
function setup({ funds = 1000, random = () => .999 } = {}) {
  const battle = createBattle({ funds, random, prices });
  return {
    battle,
    ally: battle.addUnit({ id: 'a', team: 'A' }),
    enemy: battle.addUnit({ id: 'e', team: 'B', x: 20, hp: 100000 })
  };
}
{
  const { battle, ally, enemy } = setup();
  assert.equal(ally.weapon, 'Kar98k');
  assert.equal(battle.totalAmmo(ally), Infinity);
  assert.equal(battle.fire(ally, enemy, { moving: true }).reason, 'stop-to-fire');
  assert.equal(battle.buyWeapon(ally, 'MP40').reason, 'return-to-base');
  assert(battle.buyWeapon(ally, 'MP40', { atBase: true }).ok);
  assert.equal(battle.totalAmmo(ally), 160);
  assert.equal(battle.getFunds(), 900);
  for (let i = 0; i < 32; i++) {
    assert(battle.fire(ally, enemy, { moving: true }).ok);
    battle.tick(.105);
  }
  assert(ally.reloadRemaining > 2);
  assert.equal(battle.fire(ally, enemy).reason, 'reloading');
  assert.equal(battle.resupply(ally, 'MP40').reason, 'return-to-base');
  battle.tick(2.5);
  assert.equal(ally.inventory.MP40.loaded, 32);
  assert.equal(ally.inventory.MP40.reserve, 96);
  assert.equal(battle.totalAmmo(ally), 128);
  assert(battle.resupply(ally, 'MP40', { atBase: true }).ok);
  assert.equal(battle.totalAmmo(ally), 160);
}
{
  const { battle, ally, enemy } = setup();
  assert(battle.buyWeapon(ally, 'MG42', { atBase: true }).ok);
  for (let i = 0; i < 400; i++) {
    const shot = battle.fire(ally, enemy, { moving: true });
    assert(shot.ok, 'MG42 shot ' + i + ' failed: ' + JSON.stringify(shot));
    battle.tick(.067);
    if (ally.reloadRemaining > 0) battle.tick(7.5);
  }
  assert.equal(ally.weapon, 'Kar98k');
  assert.equal(battle.totalAmmo(ally, 'MG42'), 0);
  assert(battle.events.some(event => event.type === 'fallback'));
  assert(battle.resupply(ally, 'MG42', { atBase: true }).ok);
  assert(battle.totalAmmo(ally, 'MG42') > 0);
}
{
  const battle = createBattle({ funds: 1000, prices, random: () => 0 });
  const shooter = battle.addUnit({ team: 'A' });
  const victim = battle.addUnit({ team: 'B', x: 99 });
  const shot = battle.fire(shooter, victim);
  assert(shot.ok && shot.hit && shot.lethal);
  assert.equal(victim.hp, 0);
}
{
  const battle = createBattle({ funds: 1000, prices, random: () => 0 });
  const shooter = battle.addUnit({ team: 'A' });
  const victim = battle.addUnit({ team: 'B', x: 20 });
  const near = battle.addUnit({ team: 'B', x: 22 });
  const far = battle.addUnit({ team: 'B', x: 28 });
  const friendly = battle.addUnit({ team: 'A', x: 21 });
  assert(battle.buyWeapon(shooter, 'Panzerschreck', { atBase: true }).ok);
  assert.equal(battle.fire(shooter, victim, { moving: true }).reason, 'stop-to-fire');
  const shot = battle.fire(shooter, victim);
  assert(shot.ok && shot.hits.length === 2);
  assert.equal(victim.hp, 0);
  assert(near.hp < 100 && near.hp > 0);
  assert.equal(far.hp, 100);
  assert.equal(friendly.hp, 100);
  assert.equal(shooter.reloadRemaining, 9);
}
function countShots(weapon, fps) {
  const { battle, ally, enemy } = setup();
  if (weapon !== 'Kar98k') assert(battle.buyWeapon(ally, weapon, { atBase: true }).ok);
  const dt = 1 / fps;
  for (let i = 0; i < fps * 3; i++) {
    battle.tick(dt);
    for (let j = 0; j < 7; j++) {
      if (!battle.fire(ally, enemy).ok) break;
    }
  }
  return ally.shots;
}
for (const weapon of ['Kar98k', 'MP40', 'MG42', 'Panzerschreck']) {
  const counts = [30, 60, 144].map(fps => countShots(weapon, fps));
  assert(Math.max(...counts) - Math.min(...counts) <= 1,
    weapon + ' firing rate depends on FPS: ' + counts);
  console.log('FPS_INDEPENDENCE_' + weapon + ' 30/60/144=' + counts.join('/'));
}
console.log('BATTLEFIELD_BABYLON_WEAPON_BALANCE_TESTS_PASS');
