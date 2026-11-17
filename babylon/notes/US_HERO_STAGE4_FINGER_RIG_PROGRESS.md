# Battlefield · Stage 4/10 · American hero hand skinning

Date: 2026-11-17. STATUS: **WORKING EXPERIMENT, NOT VISUALLY APPROVED**.

## What was actually diagnosed
- The source 4,474,936-byte GLB has 65 joints, 36 meshes and Quaternius Idle/Walk/Jog/Sprint.
- All 30 finger joints originally had zero vertex weights. Both complete hand meshes were skinned rigidly only to the corresponding Hand joint.
- The original finger joint locations also did not follow the actual hand geometry. Blindly copying another project's weapon joint coordinates is therefore incorrect.
- The original WEIGHTS_0 accessor is **normalized uint8**. Values must total **255**, not 1. Early reconstructed v3 failed to quantize weights, causing huge spikes and near-zero skinning. That binary was removed from the feature branch.

## Reconstructed original hero, separate copy
- Script: `babylon/tools/repair-us-hero-finger-skinning.py`.
- Derived GLB: `assets/allied-soldiers/us-hero-quaternius-finger-rig-v4.glb`.
- Script traces each original fingertip through the original contiguous hand mesh, repositions 30 existing joints along those paths, assigns gradual vertex weights, and recomputes skin inverse-bind matrices.
- All **30/30 phalanges** influence real original vertices; **1762 right-hand and 1761 left-hand vertices** each have normalized skin weights totaling exactly 255.
- Retains one 65-bone skeleton, same 36 meshes and all 4 Quaternius clips; no third hands or new meshes.
- Original original hero `us-hero-quaternius.glb` and German base unchanged.

## Separate Lee-Enfield QA
- Page: `babylon/us-hero-lee-enfield-repaired-fingers-iphone.html` (autoload from GitHub).
- IK source: `babylon/us-hero-ara-lee-enfield-stage4.js`, Ara-style elbow pole and finger directions with weapon-specific triggerPalm and supportPalm from original WW2 GLB manifest.
- Browser CI: https://github.com/jango763/battlefield/actions/runs/44093229295 (Ubuntu Chromium viewport 390x844, screenshot artifacts).
- Both poses load automatically and IK produces contact. In latest results: ready right/left palm orientation errors ~14.85° / ~0°, aim ~19.52° / ~0°, and all wrist/socket deviations less than 0.01 cm.
- **CRITICAL: Browser visual inspection reveals that the fingers are not naturally closed around the stock and the right grip remains anatomically unsuitable.** Numeric IK diagnostics MUST NOT be interpreted as artistic quality approval.
- Next necessary subtask: **fit actual distal finger flexion and right-hand stock/trigger grasp**, review from both sides at high zoom, then confirm on iPhone Safari.
- Stage 5 is intentionally not started. Main/default branch is intact.

## Licenses
- Ara 3D Gen MIT principles; original hero existing CC BY-4.0 attribution; Lee-Enfield originally from Muster WW2 (MIT). The repaired model uses original hero meshes only, not third-party donor geometry.
