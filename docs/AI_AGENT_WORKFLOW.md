# Babylon.js — coordinated AI development process

Inspired by the **coordination, ownership, explicit invariants and regression-testing workflow** used by multi-contributor engineering projects such as Leonida; **no GTA game assets, proprietary source code, or console-specific implementation is reused**.

## Workboard

Coordination: https://github.com/jango763/battlefield/issues/41

| ID | Area | Preferred ownership | Required verification |
| --- | --- | --- | --- |
| BF-GFX | Terrain, structures, vegetation, light, material budgets | `babylon/tactical-field.js`, `babylon/modern-art-v1.js`, `babylon/world-300.js`, `babylon/art/` | mobile WebGL screenshot and FPS/draw-call comparison; terrain winding |
| BF-UNIT | Rigs, animations, weapon grip, uniforms | `babylon/unit-motion-unifier.js`, `babylon/weapon-rig.js`, soldier-specific rig modules | real animated stance/run, 2-hand grip, no duplicate meshes, memory |
| BF-AI | Navigation, target acquisition, autonomous squads | `babylon/navigation-core.js`, `babylon/tactical-ai.js`, `babylon/first-game-army-core.js` | collision, obstacle bypass, autonomous objectives, formations |
| BF-GAME | Economy, combat, reinforcements, Zigzag ability invariants | `babylon/gold-economy-core.js`, `babylon/replenishment-core.js`, combat modules | deterministic economy/combat tests; no lost player abilities |
| BF-QA | Regression infrastructure and diagnostics | `babylon/tests/`, Babylon-specific `.github/workflows/` | reproducible CI and browser artifacts |
| BF-INT | Shared gameplay composition and interface | `babylon/game.parts/`, `babylon/index.html` | integration and mobile acceptance; **single integrator** |

Module path ownership is a coordination suggestion, not an invitation to rewrite a file that is already claimed. Some features cross boundaries; in that case, split the change into dependent PRs or appoint one integrator.

## Claim and PR contract

1. Before code: inspect open claims and PRs; post `CLAIM BF-ID — branch — exact files — expected outcome — tests` under issue #41.
2. Work in an independent branch from the approved Babylon head. No changes to `main`, root `index.html`, shared `assets/`, `integration/`, `preview/`, backup or checkpoint branches without separate user authorization.
3. Describe behavior as an invariant before editing it; collect baseline screenshots/metrics for visual changes. Prefer targeted fixes with one focused test to broad rewrites.
4. Keep `babylon/game.js` generated from the ten parts; after editing a part, run `node babylon/tools/assemble-game-parts.cjs`, then the `--check` form. Keep parts balanced as the tool requires.
5. Run relevant tests locally, open a **draft** PR, mention BF-ID and issue #41, declare dependencies (`Depends on: #N`), and wait for CI. Do not merge automatically.
6. For rendering/control/animation changes, record Chromium and WebKit results, screenshot evidence and actual iPhone Safari verification separately. Explicitly state if physical-device acceptance is not done.
7. After review/acceptance, post `RELEASE BF-ID — PR link — observed tests — remaining limitations`; only merge when user authorizes integration.

## Regression matrix

| Failure to prevent | Gate / evidence |
| --- | --- |
| Wrong joystick direction, touch stuck, camera drift | `test-camera-joystick-checkpoint.cjs` + mobile browser and physical iPhone review |
| Soldiers clipping through walls or failing to pathfind | `test-navigation.cjs`, `test-defenses.cjs` |
| Units losing tactics and orders | `test-tactical-ai.cjs`, `test-first-game-behavior.cjs` |
| Broken defense turrets, map or ground geometry | `test-emplacements.cjs`, `test-stage9-10-static.cjs` |
| Economy, reinforcements, weapon damage regressions | `test-gold-economy.cjs`, `test-weapon-balance.cjs` |
| Generated Babylon entry desynchronized | `assemble-game-parts.cjs --check`, `test-ten-part-engineering.cjs` |
| Legacy Three.js code inadvertently modified | `check-ai-change-scope.cjs` on Babylon-target PR |
| Bad Safari visuals, dropped FPS, reversed controls | mobile Chromium/WebKit screenshot artifacts; final physical iPhone Safari check |

Actual **real iPhone Safari** acceptance remains a separate manual gate; an emulated browser result cannot replace it.

The CI workflow is an **automatic check**, not GitHub-enforced branch protection. Repository rulesets/required checks need separate admin configuration, and the human acceptance gate is intentionally outside CI.

## Definition of done

- Clear acceptance criteria and scope; no duplicate in-flight work.
- Minimal patch, traceable to one BF-ID; dependencies called out.
- Existing mechanics not weakened; tests pass and are linked.
- Before/after visual evidence where relevant, FPS/asset-size observations where relevant.
- Real iPhone Safari acceptance explicitly recorded, not inferred from Playwright.
- User-approved merge; ability to revert via PR commit(s).

## Exclusions

Do not copy or import Leonida's GTA VI shader conversion, Xbox-specific shims, proprietary assets, or Xbox extraction pipeline. Battlefield uses Babylon.js and standard mobile-browser WebGL. The transfer is *organizational engineering practice*, not console emulation technology.
