# One-rig WW2 infantry animation study — 2026-11-14

**Status: browser-test pass; visual/real iPhone Safari acceptance still pending.**
This experiment is intentionally isolated from `main` and the gameplay simulation.

## Architecture decision

- Retain the **original Panzergrenadier/Mixamo skeleton and skin weights** (65 unique bone nodes in the dressed model, shared by its two visible skinned meshes).
- Use Quaternius only as a temporary **animation source at initialization**.
- Map 52 matching bones by name/rest pose; sample the original `Idle_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop` clips at 30 FPS; generate local-quaternion keyframes using rest-source/rest-target corrections.
- Do not bake incoming root translations or authored bone scales.
- Remove the temporary Quaternius source scene. The dressed character **renders on one original WW2 bone hierarchy**; it has no second active animation skeleton.
- Keep existing weapon GLBs, IK grip targets and faction colours. The original two-skeleton panel remains on the right only as a control.

## Findings and mistakes ruled out

1. Blindly swapping donor skin indices to Quaternius bones produced visible glove-to-grip distances of **1.45–1.57** scene units.
2. Direct donor-to-Quaternius rest **matrix** multiplication exploded incompatible authored scales (60+ scene-unit hand offsets).
3. Discarding matrix scale prevented the explosion but still left one hand about **0.45** scene units from the grip.
4. Stock `SkeletonUtils.retargetClip` moved/deformed the dressed rig with incompatible source/root transforms, producing large distances.
5. The corrected **rotation-only animation bake** passed the quantified grip tests for both factions.

Measured at the nearest visible skinned hand vertex to the weapon grip, not just wrist joint:

| Scenario | One-rig left | One-rig right |
|---|---:|---:|
| British Lee-Enfield idle + project IK (desktop) | 0.0165 | 0.0343 |
| German MP40 idle (desktop) | 0.0165 | 0.0343 |
| German MG42 sprint + project IK (desktop) | 0.0130 | 0.0328 |
| German MG42 sprint + project IK (mobile Chromium) | 0.0069 | 0.0306 |

Measurements are in scene units. Small grip distances do **not** prove correct finger orientation or believable animation. The initial screenshot shows one pair of arms, but close-up visual review is still required.

## Reproduction

- Side-by-side comparison: `lab/one-rig/index.html`
- Source: `lab/one-rig/app.js`
- Browser QA: `lab/one-rig/test-browser.cjs`
- CI: `.github/workflows/check-one-rig-animation-lab.yml`
- Passing Actions run: https://github.com/jango763/battlefield/actions/runs/43637100052

CI covers desktop Chromium and iPhone-sized Chromium, both factions, rifles, SMGs, MGs, movement/idle poses, source-bone uniqueness and mesh-surface grip metrics. It uploads screenshots for inspection.

## Boundaries and next steps

- **Do not merge to `main` yet.** The latest live game has not been migrated to Three.js r187.
- Verify three-quarter, side and close-up views of wrists and fingers; check idle-to-run transitions and weapon pose drift.
- Test directly in iPhone Safari: context recovery, startup, memory pressure, FPS and actual touch controls.
- Export/offline-bake the approved single-rig WW2 GLB/animation set if the runtime test passes visual review; preserve asset attribution/licenses and keep a rollback to approved game.
- Only then test integration behind an isolated preview switch, retaining existing mechanics, weapon roster and control layout.

References: Blender Data Transfer modifier (vertex-group weights), Three.js SkeletonUtils, SkinnedMesh and GLTFLoader documentation.
