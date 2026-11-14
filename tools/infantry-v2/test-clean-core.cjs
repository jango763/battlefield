'use strict';
/** Release guard: Muster static rifleman trial must never enter active code. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const critical=[
  'preview/german-v5.js',
  'preview/formation-replenishment-v3.html'
];
for(const filename of critical){
  const code=fs.readFileSync(path.join(root,filename),'utf8');
  assert(!/muster-british|muster-rifleman-rig|musterBritishPreview|musterRifleRig|musterRigBuild|musterBritishPreviewDraw/i.test(code),
    'Abandoned Muster model code is still in game: '+filename);
}
for(const dead of [
  'assets/muster-british',
  'preview/muster-british-review.js',
  'preview/muster-rifleman-rig.js',
  'tools/infantry-v2/export-muster-british.cjs',
  'tools/infantry-v2/muster-export-entry.ts',
  'tools/infantry-v2/test-muster-gallery.cjs',
  'tools/infantry-v2/test-muster-rig.cjs',
  '.github/workflows/build-muster-british.yml',
  '.github/workflows/check-muster-gallery.yml',
  '.github/workflows/check-muster-rig.yml'
])assert(!fs.existsSync(path.join(root,dead)),'Muster model still in working branch: '+dead);
// IMPORTANT: Keep the MIT license notice for the separately accepted
// headwear resource, which is NOT the unrigged British soldier trial.
assert(fs.existsSync(path.join(root,'assets/ww2-headwear/MUSTER-LICENSE.txt')),
  'Do not erase license of retained headwear assets');
console.log('CORE CLEAN PASS: no unrigged Muster British models or imports; retained licensed headwear');
