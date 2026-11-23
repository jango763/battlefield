'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const H=require('../heading-smoothing-core.js');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const part=fs.readFileSync(path.join(root,'game.parts/07.part'),'utf8');
assert(html.includes('<script src="./heading-smoothing-core.js"></script>'));
assert(html.indexOf('heading-smoothing-core.js')<html.indexOf('src="./game.js"'),
 'Visual yaw helper must load before the gameplay entry');
assert(game.includes('BattlefieldHeadingSmoothing.step')&&part.includes('BattlefieldHeadingSmoothing.step'));
assert(!game.includes('view.anchor.rotation.y=Math.atan2(dx,dz);'),
 'Instant animated character snapping must not return');
const rad=x=>x*Math.PI/180;
const actual=H.step(rad(179),rad(-179),1/60);
assert(actual>rad(179)&&actual<rad(180),'Turn must take the short +2 degree arc');
assert.equal(H.step(1,2,0),1,'Paused scene must not turn actors');
assert.equal(H.step(1,Infinity,.02),1,'Invalid target must be safe');
assert.equal(H.step(1,2,NaN),1,'Invalid timestep must not alter pose');
const heading=rad(150);
let fast=0,slow=0;
for(let i=0;i<60;i++)fast=H.step(fast,heading,1/60);
for(let i=0;i<30;i++)slow=H.step(slow,heading,1/30);
assert(Math.abs(fast-slow)<1e-10,
 'Turn smoothing must not depend on mobile frame rate');
assert(Math.abs(fast-heading)<.00002,
 'The actor must reach its visible movement bearing quickly');
console.log('BATTLEFIELD_NATURAL_HEADING_INTERPOLATION_PASS');
