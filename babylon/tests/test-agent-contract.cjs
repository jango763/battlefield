'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const guide = read('AGENTS.md');
const workflow = read('docs/AI_AGENT_WORKFLOW.md');
const template = read('.github/PULL_REQUEST_TEMPLATE.md');
const gate = read('.github/workflows/babylon-agent-gate.yml');
const scope = require('../tools/check-ai-change-scope.cjs');
for (const s of ['Three.js','Babylon.js','game.parts/','iPhone Safari','CLAIM BF-ID','Zigzag','turtle/semicircle','draft PR']) {
  assert(guide.includes(s), 'Missing AGENTS contract: ' + s);
}
for (const s of ['BF-GFX','BF-UNIT','BF-AI','BF-GAME','BF-QA','BF-INT','real iPhone Safari']) {
  assert(workflow.includes(s), 'Missing workstream: ' + s);
}
assert(template.includes('Merge policy'));
assert(gate.includes('test-stage9-10-mobile.cjs'));
assert(gate.includes('test-navigation.cjs'));
assert(gate.includes('check-ai-change-scope.cjs'));
for (const p of ['AGENTS.md','babylon/game.parts/01.part','babylon/index.html','docs/AI_AGENT_WORKFLOW.md','.github/workflows/babylon-agent-gate.yml']) {
  assert(scope.isAllowed(p), 'Babylon change incorrectly blocked: ' + p);
}
for (const p of ['index.html','assets/soldiers/german.glb','integration/bridge.js','preview/three.html','.github/workflows/three-characters-integration-qa.yml']) {
  assert(!scope.isAllowed(p), 'Legacy path unexpectedly allowed: ' + p);
}
assert.deepEqual(scope.deniedFiles(['babylon/main.js','index.html','README.md']),['index.html','README.md']);
console.log('BATTLEFIELD_AGENT_CONTRACT_PASS');
