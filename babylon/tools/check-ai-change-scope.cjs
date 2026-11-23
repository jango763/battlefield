'use strict';
/* Babylon-target changes must not accidentally alter the Three.js baseline.
 * Run from CI with git diff --name-only --diff-filter=ACMR <base> <head> | node ...
 */
const fs = require('node:fs');
function isAllowed(p) {
  if (!p || p.includes('\\') || p.startsWith('/') || p.includes('../') || p.includes('..\\')) return false;
  return p === 'AGENTS.md' ||
    p === '.github/PULL_REQUEST_TEMPLATE.md' ||
    p.startsWith('.github/workflows/babylon-') ||
    p.startsWith('babylon/') ||
    p.startsWith('docs/');
}
function deniedFiles(files) {
  return files.filter(p => !isAllowed(p));
}
if (require.main === module) {
  const files = fs.readFileSync(0,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const denied = deniedFiles(files);
  if (denied.length) {
    console.error('BATTLEFIELD_BABYLON_SCOPE_FAIL: protected legacy/shared paths modified:',denied.join(', '));
    process.exitCode = 1;
  } else {
    console.log('BATTLEFIELD_BABYLON_SCOPE_PASS', files.length, 'modified paths');
  }
}
module.exports = {isAllowed, deniedFiles};
