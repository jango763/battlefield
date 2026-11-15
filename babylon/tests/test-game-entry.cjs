'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, '..');
const file = name => fs.readFileSync(path.join(dir, name), 'utf8');
const html=file('index.html'), app=file('game.js'), rig=file('approved-soldier.html');
for(const name of [
 'weapon-rig.js','combat-balance-core.js','combat-presentation-core.js',
 'squad-combat-core.js','field-orders-core.js','world-300.js','game.js'
])assert(html.includes('src="./'+name+'"'), 'Missing main game module: '+name);
assert(html.indexOf('field-orders-core.js')<html.indexOf('game.js'));
assert(html.includes('id="view"')&&html.includes('id="retry"'));
assert(html.includes('id="order-move"')&&html.includes('id="order-attack"'));
assert(html.includes('data-scenario="squads"'));
assert(html.includes('data-weapon="MG42"'));
assert(app.includes('window.__BATTLEFIELD_GAME__'));
assert(app.includes('terrain=world.ground'));
assert(app.includes('fieldOrders.setDestination(x,z)'));
assert(app.includes('const SCENARIOS={duel:[1,1],assault:[1,4],squads:[12,12]}'));
assert(app.includes("setup('squads')"), 'Main game must start with full 12v12 logic');
assert(app.includes("world.loadOriginalBTR()"), 'Load legacy BTR GLB on main map');
assert(app.includes("respawnTimers"), 'Long match requires respawn before center opens');
assert(app.includes('driveAllies:dt=>fieldOrders.update(dt)'));
assert(app.includes("await ensureUnits('duel')"),'Initial mobile boot must not block on 8 GLBs');
assert(/B\.SceneLoader\.LoadAssetContainerAsync\(\s*'\.\/animstudio-preview\/models\/',\s*'all-combat-run\.glb',\s*scene\)/.test(app),
 'SceneLoader loader signature must be (rootUrl, filename, scene)');
assert(!app.includes("LoadAssetContainerAsync('',\n   './animstudio-preview/models/'"),
 'Regression: Invalid four-argument LoadAssetContainerAsync call');
assert(app.includes('void processWeaponQueue()'), 'Weapon IK should not block the playable scene');

assert(app.includes("enterButton.addEventListener('click'"), 'Game must start manually after reading briefing');
assert(app.includes("const r=controller.start();"), 'Start button must activate the battle');
assert(html.includes('src="./gold-economy-core.js"'), 'Gold core must load before game');
assert(html.includes('id="battlefield-brief"')&&!html.includes('id="map-briefing"'), 'Use exactly one startup map briefing');
assert(html.includes('После гибели первого бота с любой стороны'), 'Briefing must mention first bot death rule');
assert(app.includes('economy.reportBotDeath(victim)'), 'First dead bot must trigger countdown');
assert(app.includes('central.remainingSeconds'), 'Countdown must be visible in gameplay HUD');
assert(app.includes("if(!B||!combat||!tactics||!presentation||!orders"));
assert(app.includes("$('failure').style.display='block'"));
assert(!html.includes('combat-range.js'),'Main route accidentally points to old firing range');
assert(rig.includes('src="./main.js"') && rig.includes('renderCanvas'),
 'Original approved soldier viewer was not preserved');
console.log('BATTLEFIELD_BABYLON_MAIN_GAME_ENTRY_TESTS_PASS');
