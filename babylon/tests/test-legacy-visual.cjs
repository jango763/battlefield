'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(base,f),'utf8');
const html=read('index.html'),game=read('game.js'),world=read('world-300.js');
const visual=require('../legacy-visual-style.js');
assert(visual.PROFILE.fogDensity>0 && visual.PROFILE.fogDensity<.009);
assert(visual.PROFILE.shadowCasterLimit<=45);
assert(visual.PROFILE.exposure>=1 && visual.PROFILE.exposure<1.3);
assert(html.includes('src="./legacy-visual-style.js"'),'Style module must load');
assert(html.indexOf('src="./legacy-visual-style.js"')<html.indexOf('src="./game.js"'));
for(const id of ['touch-stick','touch-stick-knob','quick-fire','quick-gear',
 'quick-reload','quick-pause','quick-status','battle-minimap']){
 assert(html.includes('id="'+id+'"'),'Missing mobile gameplay control '+id);
}
assert(game.includes("registerTouchControls();"));
assert(game.includes("drawMiniMap(econ)"));
assert(game.includes("state.visualProfile=legacyVisual?.apply("));
assert(game.includes("document.body.classList.add('battle-active')"));
assert(game.includes("camera=new B.ArcRotateCamera('camera',Math.PI*1.23,.83,33"));
assert(game.includes("fieldOrders.setDestination("),'Joystick must preserve movement orders');
assert(game.includes("controller.setFocus(target)"),'Fire button uses existing targeting');
assert(world.includes("tx.update(false)"),'Painted terrain must be GPU-uploaded');
assert(world.includes("groundMaterial.diffuseTexture=tx"),'No white fallback terrain');
assert(world.includes("groundTextureReady"),'Graceful fallback for broken mobile WebGL');
for(const a of ['farm-house-','farm-roof-','shell-impact-','legacy-ruin-']){
 assert(world.includes(a),'Missing first-game battlefield silhouettes '+a);
}
assert(game.includes('const FEATURE_REAL_ALLIES=true'));
assert(game.includes("characters.validateTrialFiles(alliedLoader.FEATURE_TRIAL_FILES)"));
console.log('BATTLEFIELD_LEGACY_VISUAL_STATIC_PASS');
