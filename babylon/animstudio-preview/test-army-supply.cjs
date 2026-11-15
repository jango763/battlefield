/* Run: node babylon/animstudio-preview/test-army-supply.cjs */
'use strict';
const assert = require('node:assert/strict');
const { createArmy, SPECS, DEMO_PRICES } = require('../supply-core.js');
const { create, RELOAD } = require('./combat-cycle-core.js');
const guns = ['MP40', 'MG42', 'Panzerschreck'];
const expected = { MP40: 160, MG42: 400, Panzerschreck: 4 };
const expectedReload = { MP40: 2.5, MG42: 7.5, Panzerschreck: 9 };

for (const gun of guns) {
  const returns = [];
  const army = createArmy({ funds: 10000, onReturnToBase: order => returns.push(order) });
  army.addUnit('alpha', { assignedTask: 'attack objective' });
  assert.equal(army.snapshot('alpha').weapon, 'Kar98k');
  const initial = army.getFunds();
  for (let i=0; i<1000; i++) assert.equal(army.fire('alpha').ok, true);
  assert.equal(army.getFunds(), initial, 'Free infinite rifle ammunition');
  assert.equal(army.buyWeapon('alpha', gun).ok, true);
  let a = army.snapshot('alpha');
  assert.equal(a.inventory[gun].totalRounds, expected[gun]);
  assert.equal(a.inventory[gun].spareContainers, SPECS[gun].containers - 1);
  assert.equal(army.getFunds(), initial - DEMO_PRICES.weapons[gun]);
  army.leaveBase('alpha');
  assert.equal(army.resupply('alpha', gun).reason, 'not-at-base');
  for (let n=0; n<expected[gun]; n++) {
    const shot = army.fire('alpha');
    assert.equal(shot.ok, true, gun + ' round ' + n);
    if ((n + 1) % SPECS[gun].capacity === 0 && n+1 < expected[gun]) {
      const load = army.beginReload('alpha');
      assert.equal(load.seconds, expectedReload[gun]);
      assert.equal(army.fire('alpha').reason, 'reloading');
      army.tick(load.seconds - .01);
      assert.equal(army.snapshot('alpha').reloading, true);
      army.tick(.01);
      assert.equal(army.snapshot('alpha').reloading, false);
    }
  }
  a = army.snapshot('alpha');
  assert.equal(a.inventory[gun].totalRounds, 0);
  assert.equal(a.weapon, 'Kar98k', 'Empty special gun falls back to rifle');
  assert.equal(a.preferredWeapon, gun, 'Remember purchased weapon');
  assert.equal(returns.length, 1, 'Exactly one return order');
  assert.equal(returns[0].assignedTask, 'attack objective');
  assert.equal(a.atBase, false, 'Return-to-base order must not teleport unit');
  assert.equal(army.fire('alpha').ok, true, 'Soldier keeps fighting with rifle');
  const beforeResupply = army.getFunds();
  const arrived = army.arriveAtBase('alpha');
  assert.equal(arrived.ok, true);
  assert.equal(arrived.soldier.weapon, gun);
  assert.equal(arrived.soldier.inventory[gun].totalRounds, expected[gun]);
  assert.equal(beforeResupply - army.getFunds(),
    DEMO_PRICES.ammo[gun] * SPECS[gun].containers,
    'All consumed containers are paid for');
  assert.equal(army.resupply('alpha', gun).cost, 0, 'No double charge for full stock');
  console.log(gun + '_LOADOUT_' + expected[gun] + '_RETURN_RESUPPLY_PASS');
}

// One shared treasury, independent stocks, no purchase from battlefield.
{
  const army = createArmy({ funds: DEMO_PRICES.weapons.MP40 });
  army.addUnit('A'); army.addUnit('B');
  assert(army.buyWeapon('A', 'MP40').ok);
  assert.equal(army.buyWeapon('B', 'MG42').reason, 'insufficient-funds');
  army.leaveBase('A');
  assert.equal(army.buyWeapon('A', 'MG42').reason, 'not-at-base');
  assert.equal(army.snapshot('A').inventory.MP40.totalRounds, 160);
  assert.equal(army.snapshot('B').weapon, 'Kar98k');
}

// Without cash a depleted soldier does NOT get free supply, but can return
// once the faction earns money.
{
  const returns=[];
  const army=createArmy({ funds: DEMO_PRICES.weapons.Panzerschreck,
    onReturnToBase: o=>returns.push(o) });
  army.addUnit('rocket');army.buyWeapon('rocket','Panzerschreck');
  army.leaveBase('rocket');
  for(let n=0;n<4;n++){
    assert(army.fire('rocket').ok);
    if(n<3){army.beginReload('rocket');army.tick(9)}
  }
  assert.equal(returns.length,0);
  assert.equal(army.snapshot('rocket').weapon,'Kar98k');
  army.addFunds(DEMO_PRICES.ammo.Panzerschreck);
  assert.equal(returns.length,1);
  const arrived=army.arriveAtBase('rocket');
  assert.equal(arrived.soldier.inventory.Panzerschreck.totalRounds,1);
  assert.equal(army.getFunds(),0);
}

// No ammunition duplication on cancel or weapon switching.
{
  const army=createArmy({funds:2000});
  army.addUnit('A');army.buyWeapon('A','MP40');army.leaveBase('A');
  for(let n=0;n<32;n++)army.fire('A');
  assert.equal(army.beginReload('A').ok,true);
  army.tick(1);army.cancelReload('A');army.tick(3);
  assert.equal(army.snapshot('A').inventory.MP40.totalRounds,128);
  army.switchWeapon('A','Kar98k');
  assert.equal(army.switchWeapon('A','MP40').ok,true);
  assert.equal(army.snapshot('A').inventory.MP40.loaded,0);
  assert.equal(army.beginReload('A').ok,true);
  army.tick(2.5);
  assert.equal(army.snapshot('A').inventory.MP40.totalRounds,128);
}

// Actual animation cycle consumes the linked soldier's rounds, taking the
// same 2.5 / 7.5 / 9 seconds for each reload as the animation markers.
for (const gun of guns) {
  const army=createArmy({funds:5000});
  army.addUnit('unit');army.buyWeapon('unit',gun);army.leaveBase('unit');
  const machine=create({weapon:gun,supply:army,unitId:'unit'});
  let result=machine.start();
  for(let i=0;i<5000&&!result.done;i++)result=machine.update(1/60);
  assert.equal(result.phase,'complete');
  assert.equal(result.fired,SPECS[gun].capacity);
  assert.equal(result.reloadCount,1);
  assert.equal(result.reloadSeconds,expectedReload[gun]);
  assert.equal(RELOAD[gun].capacity,SPECS[gun].capacity);
  assert.equal(army.snapshot('unit').inventory[gun].totalRounds,
    expected[gun] - SPECS[gun].capacity);
}
console.log('BATTLEFIELD_FINITE_AMMO_ECONOMY_TESTS_PASS');
