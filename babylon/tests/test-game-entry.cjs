'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, '..');
const file = name => fs.readFileSync(path.join(dir, name), 'utf8');
const html=file('index.html'), app=file('game.js'), rig=file('approved-soldier.html');
for(const name of [
 'weapon-rig.js','combat-balance-core.js','combat-presentation-core.js',
 'squad-combat-core.js','field-orders-core.js','game.js'
])assert(html.includes('src="./'+name+'"'), 'Missing main game module: '+name);
assert(html.indexOf('field-orders-core.js')<html.indexOf('game.js'));
assert(html.includes('id="view"')&&html.includes('id="retry"'));
assert(html.includes('id="order-move"')&&html.includes('id="order-attack"'));
assert(html.includes('data-scenario="squads"'));
assert(html.includes('data-weapon="MG42"'));
assert(app.includes('window.__BATTLEFIELD_GAME__'));
assert(app.includes('ground.isPickable=true'));
assert(app.includes('fieldOrders.setDestination(x,z)'));
assert(app.includes('driveAllies:dt=>fieldOrders.update(dt)'));
assert(app.includes("await ensureUnits('duel')"),'Initial mobile boot must not block on 8 GLBs');
assert(app.includes("const firstBattle=controller.start()"));
assert(app.includes("if(!B||!combat||!tactics||!presentation||!orders"));
assert(app.includes("$('failure').style.display='block'"));
assert(!html.includes('combat-range.js'),'Main route accidentally points to old firing range');
assert(rig.includes('src="./main.js"') && rig.includes('renderCanvas'),
 'Original approved soldier viewer was not preserved');
console.log('BATTLEFIELD_BABYLON_MAIN_GAME_ENTRY_TESTS_PASS');
