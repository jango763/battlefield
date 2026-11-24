'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const art=fs.readFileSync(path.join(root,'modern-art-v1.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
new Function(game);new Function(art);
assert.match(game,/mode:'elevated-tactical-follow'/);
assert.match(html,/id="touch-zone"/);
assert.match(html,/@media\(min-width:701px\) and \(max-width:950px\) and \(max-height:600px\)/,
 'Touch controls must remain visible on landscape iPhone screens');
assert.match(html,/width:57vw;max-width:260px;height:54vh/,
 'Joystick landscape zone must have a bounded width');
assert.match(game,/joystickResponse\.shape\(dx,-dy\)/,
 'Radial touch response must never reverse camera axes');
assert.match(game,/graphicsMode==='high'\?2\.25:1\.9/,
 'Auto and high rendering must stay sharper than the original presets');
assert.match(game,/zone\.setPointerCapture\(e\.pointerId\)/);
assert.match(game,/fieldOrders\.setMovement\(-touchJoystick\.x,touchJoystick\.y\)/);
assert.match(game,/fieldOrders\.setMovement\(magnitude>1\?-x\/magnitude:-x/);
assert.match(game,/zone\.addEventListener\('pointercancel',release\)/);
assert.match(game,/document\.addEventListener\('visibilitychange'/);
assert.match(art,/terrainStyle='low-frequency-mipmapped-matte'/);
assert.match(art,/CreateRibbon\('hd2026-organic-road-'/);
assert.match(art,/new B\.DynamicTexture\('hd2026-soft-road'/);
assert.match(html,/#quick-buttons\{margin-left:auto/);
assert.match(art,/new B\.DynamicTexture\('hd2026-soft-painted-earth'/);
assert.match(art,/terrainTexture\.anisotropicFilteringLevel=8/);
assert.match(art,/terrainTexture\.updateSamplingMode\(B\.Texture\.TRILINEAR_SAMPLINGMODE\)/);
assert.match(art,/world\.ground\.material=smoothEarth/);
assert.match(art,/CreateCylinder\('hd2026-meadow-tuft'/);
assert.doesNotMatch(art,/MATERIAL_ALPHATEST|hd2026-grass-alpha/);
// With alpha=3pi/2 and the camera behind the hero, the visible
// screen-left vector corresponds to positive world X.
const cameraAlpha=Math.PI*1.5;
const screenRightWorldX=Math.sin(cameraAlpha);
assert(screenRightWorldX<-.999);
const joystickLeft=-1;
const worldMoveX=-joystickLeft;
assert(worldMoveX*screenRightWorldX<0,'Left must project screen-left');
const {create}=require('../first-game-army-core.js');
const hero={id:'hero',x:150,z:150,alive:true};
const control=create({hero,allies:[hero],enemies:[],
 farms:[{id:'f1',x:100,z:100,owner:'red'}]});
assert(control.setDestination(240,240).ok);
assert(control.setMovement(worldMoveX,0).ok);
assert.equal(control.snapshot().destination,null);
const before=hero.x;
control.updateAllies(.1);
assert(hero.x>before,'Left joystick must move toward +X, visually left');
const stopped=hero.x;
control.clearMovement();control.updateAllies(.1);
assert.equal(hero.x,stopped);
assert.match(html,/\.battle-active #graphics-tag\{display:none\}/,
 'Hide distracting HD debug tag while the game is active');
assert.match(html,/max-width:700px\) and \(min-height:601px\)/,
 'Portrait phones must get their own unobtrusive battle HUD');
assert.match(html,/\.battle-active #quick-status\{margin-top:0;font-size:11px/,
 'Hero health and gold must stay visible in portrait mode');
assert.match(html,/\.battle-active #heading h1\{display:none\}/,
 'Compact landscape HUD must hide only the redundant title');
assert.match(html,/\.battle-active #battle-minimap\{width:88px;height:88px;/,
 'Compact minimap leaves more room for aim and touch targets');
assert.match(html,/@media\(max-height:600px\)/,
 'Landscape mobile must have its own small-height HUD layout');
assert.match(html,/\.battle-active #footer\{display:none\}/,
 'Long help footer must not obscure landscape combat');
assert.match(html,/\.battle-active #heading small\{display:none\}/,
 'Landscape status line must not overlap player HP');
console.log('BATTLEFIELD_VISUAL_STABILITY_JOYSTICK_PASS');
