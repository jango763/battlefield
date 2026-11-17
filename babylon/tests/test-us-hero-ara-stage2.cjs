/* Stage 2: deterministic audit, no Babylon runtime and no gameplay mutations. */
'use strict';const a=require('../american-hero-ara-calibration.js');
const assert=require('node:assert/strict');
assert(Math.abs(a.reach('left')-.4493677138)<.0001);
assert(Math.abs(a.reach('right')-.4493677138)<.0001);
for(const phase of ['ready','aim']){
 const d=a.donorDistances(phase);
 assert(d.left>d.leftReach,'Direct Ara left target must be rejected');
 const result=a.reference(phase);
 assert(result.withinReach,'Reprojected targets must be reachable');
 assert(result.leftDist<result.maxReach-.025,'Keep 2.5cm arm extension margin');
 assert(result.rightDist<a.reach('right')-.025);
 assert(result.support[2]>result.trigger[2],
   'Fore-end must be forward of trigger in hero forward coordinates');
}
assert(a.assetReport(['Idle','Walk','Jog','Sprint'].map(n=>({
 name:n+'_Quaternius',channels:20,armChannels:8
}))).pass);
assert(!a.assetReport([{name:'Idle_Quaternius',channels:20,armChannels:8}]).pass);
console.log('PASS: 65-bone source geometry, Ara incompatibility, reachable socket reference');
