'use strict';
const assert=require('node:assert/strict');
const J=require('../joystick-response-core.js');
assert.equal(J.shape(0,0).strength,0);
assert.equal(J.shape(.06,0).strength,0,'Idle finger twitch must be ignored');
assert(J.shape(.2,0).strength>0,'Slow walking is allowed just outside dead zone');
assert(J.shape(.65,0).strength>J.shape(.2,0).strength,
 'Radial speed must rise smoothly and monotonically');
assert.equal(J.shape(1,0).x,1);
assert.equal(J.shape(-1,0).x,-1,'Horizontal direction must never mirror');
assert.equal(J.shape(0,1).y,1,'Forward touch must remain north');
const d=J.shape(1,1);
assert(d.strength<=1&&Math.hypot(d.x,d.y)<=1.000001,
 'Diagonal movement must never exceed straight speed');
assert(Math.abs(d.x-d.y)<1e-10);
assert.equal(J.shape(NaN,1).strength,0);
assert.equal(J.shape(Infinity,1).strength,0);
const ease=.31,near=J.shape(ease,0);
assert(near.x>0&&near.x<ease,'Response should soften near-center motion');
console.log('BATTLEFIELD_JOYSTICK_RESPONSE_PASS');
