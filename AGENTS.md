# Battlefield — instructions for AI coding agents

Read this file before modifying the repository. The detailed workflow is in [docs/AI_AGENT_WORKFLOW.md](docs/AI_AGENT_WORKFLOW.md); coordinate claims in [issue #41](https://github.com/jango763/battlefield/issues/41).

## Project and boundaries

- This repository contains two independent game-engine baselines. **Work on Babylon.js under `babylon/` only** for the current project. The legacy Three.js version (`main`, root and other legacy source paths) and all checkpoint/backup branches are immutable unless the user explicitly changes scope.
- The accepted Babylon playable entry point is `babylon/index.html`; its gameplay implementation is `babylon/game.js`. The canonical source of `game.js` is **ten equally sized** `babylon/game.parts/01.part` … `10.part` files. Never manually patch generated `game.js` without synchronizing the ten parts and checking the assembler.
- The current visual direction is stylized Company of Heroes 3 readability, with autonomous battles inspired by the tactical depth of Gates of Hell. These are design references, not licenses to copy proprietary game assets or source code.
- Primary testing targets: iPhone Safari (real-device approval), mobile WebKit/Chromium emulation in CI, and desktop browsers. A browser test is **not** proof of a real iPhone test.

## Non-negotiable gameplay contracts

Do not regress approved controls or change them without an explicit feature request: direct thumbstick/WASD hero movement, elevated tactical camera, sensible joystick directions, touch interaction, and fast playable start. Preserve the army's autonomous behavior, reinforcement and economy, turtle/semicircle formations, hero magnet-follow logic, combat/cover, and already agreed Zigzag abilities. Preserve user-approved soldier meshes, colors, 65-bone rigs, animations, and two-hand weapon alignment unless the task specifically targets them. No duplicate hands/headgear, floating weapons, robotic gait, units walking through buildings, or vertical vehicles.

A static test passing never justifies hiding, bypassing, or weakening a broken gameplay feature. Fix the cause and update the matching test. Do not casually increase mobile memory, textures, draw calls, or startup time. Never commit secrets, private data, unlicensed third-party assets, downloaded game files, or copied commercial-game code.

## Claim first; work in isolated branches

1. Read this guide, related implementation and tests, open PRs, and [the coordination issue](https://github.com/jango763/battlefield/issues/41). Confirm the task has not already been claimed.
2. Comment a claim: `CLAIM BF-ID — branch — exact paths — goal — tests`. Do not overlap live edits to the same paths with another agent. Assign a single integrator for shared `game.parts/` or `index.html` edits.
3. Make a new `feature/` or `experiment/` branch from the current approved **Babylon** integration head, not from `main`. Never force-push, modify checkpoint branches, delete approved models, or merge automatically.
4. Make the smallest cohesive edit. Keep graphics, units, AI, economy, and UI independent when possible. If the change requires another workstream, describe that dependency in the PR.
5. Open a draft PR targeting the approved Babylon branch. Link issue #41 and include `BF-ID`, changed files, tests, screenshot/metrics, limitations, and rollback instructions. Release the claim once the work is reviewed.

## Before a PR

Run from repository root with Node.js 22:

```sh
node babylon/tools/assemble-game-parts.cjs --check
node --check babylon/game.js
node babylon/tests/test-agent-contract.cjs
node babylon/tests/test-stage9-10-static.cjs
node babylon/tests/test-ten-part-engineering.cjs
node babylon/tests/test-navigation.cjs
node babylon/tests/test-defenses.cjs
node babylon/tests/test-emplacements.cjs
node babylon/tests/test-tactical-ai.cjs
node babylon/tests/test-first-game-behavior.cjs
node babylon/tests/test-gold-economy.cjs
node babylon/tests/test-weapon-balance.cjs
```

The `babylon-agent-gate` GitHub Actions workflow runs applicable static regression checks, checks that a Babylon PR did not modify legacy paths, and runs Chromium + WebKit mobile rendering smoke tests for a PR. For graphics, touch/camera, animation, or performance changes, attach before/after screenshots and browser logs; verify actual iPhone Safari manually before declaring an accepted release.

## Reporting status honestly

Use explicit statuses: **studied → planned → implemented → tested in CI → accepted on real device → merged**. Only describe a stage as complete if it really occurred. A draft PR or workflow queued/running does not mean tests passed or gameplay was accepted. Do not claim AI agents run autonomously just because this coordination guide exists.
