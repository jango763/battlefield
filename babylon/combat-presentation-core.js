/* Battlefield Babylon: visual states derive exclusively from combat inventory/cooldowns.
 * No weapons are refilled by animation markers. Renderer-independent; no GLB edits.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BattlefieldCombatPresentation = api;
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';
  const SHOT_HOLD = Object.freeze({Kar98k:.24, MP40:.09, MG42:.065, Panzerschreck:.33});
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function describe(unit, {active=false,moving=false,shotAge=Infinity}={}) {
    if (!unit || typeof unit !== 'object') throw Error('Missing soldier state');
    const reloading = unit.reloadRemaining > 0 && !!unit.reloadWeapon;
    const firing = !!unit.alive && !!active && !reloading &&
      shotAge >= 0 && shotAge <= (SHOT_HOLD[unit.weapon] || .10);
    const running = !!unit.alive && !!active && !!moving &&
      (!reloading || unit.weapon === 'MP40'); // MG42/Panzerschreck reload only at rest.
    const reloadSeconds = unit.reloadWeapon === 'MP40' ? 2.5 :
      unit.reloadWeapon === 'MG42' ? 7.5 :
      unit.reloadWeapon === 'Panzerschreck' ? 9 : 0;
    const reloadProgress = reloading && reloadSeconds ?
      clamp(1 - unit.reloadRemaining / reloadSeconds, 0, 1) : 0;
    // In the approved glTF prototype there is no final reload animation.
    // During its gameplay timer the gun is held, not shown as firing.
    const pose = !unit.alive || !active ? 'ready' :
      reloading ? (running && unit.weapon==='MP40' ? 'run' : 'ready') :
      running ? 'run' : firing ? 'fire' : 'aim';
    const stage = reloading ? 'reload' : firing && running ? 'runFire' :
      firing ? 'fire' : running ? 'run' : active ? 'aim' : 'ready';
    return {
      pose, stage, reloading, firing, running,
      reloadProgress, reloadSeconds, timeRemaining: reloading ? unit.reloadRemaining : 0,
      recoilPulse: firing ? clamp(1 - shotAge / (SHOT_HOLD[unit.weapon] || .10),0,1) : 0,
      display: !unit.alive ? 'Боец погиб' :
        !active ? 'На базе' : reloading ?
        'Перезарядка ' + unit.reloadWeapon + ' · ' + unit.reloadRemaining.toFixed(1) + ' с' :
        firing ? 'Выстрел · ' + unit.weapon :
        running ? 'Движение' : 'Прицеливание'
    };
  }
  return {describe, SHOT_HOLD};
});