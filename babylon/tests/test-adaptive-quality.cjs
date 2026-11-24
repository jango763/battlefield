'use strict';
const assert=require('node:assert/strict');
const Q=require('../adaptive-quality-core.js');
assert.equal(Q.CHECK_SECONDS,3.5);
assert.equal(Q.nextScale(20,1.5,1,2.5),1.9,
 'Severe GPU pressure should lower pixel density promptly');
assert.equal(Q.nextScale(30,1.5,1,2.5),1.72,
 'Moderate FPS drop requires a smaller quality concession');
assert.equal(Q.nextScale(45,1.5,1,2.5),1.5,
 'Middle band must not hunt or shimmer');
assert.equal(Q.nextScale(58,1.5,1,2.5),1.46,
 'Recovered FPS restores sharpness gradually');
assert.equal(Q.nextScale(61,1.5,1,2.5),1.42,
 'Very high FPS may recover clarity at controlled rate');
assert.equal(Q.nextScale(19,2.45,1,2.5),2.5,
 'Never exceed safe GPU downscaling limit');
assert.equal(Q.nextScale(61,1,1,2.5),1,
 'Never render beyond maximum physical pixel density');
assert.equal(Q.nextScale(20,1,1,1),1,
 'Non-retina screens do not need scaling oscillation');
assert.equal(Q.nextScale(NaN,1.5,1,2.5),1.5,
 'Invalid FPS cannot change render quality');
assert.equal(Q.nextScale(0,1.5,1,2.5),1.5);
console.log('BATTLEFIELD_ADAPTIVE_QUALITY_PASS');
