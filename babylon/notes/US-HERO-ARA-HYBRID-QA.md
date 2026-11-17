# American hero armed animation hybrid — research and QA (17 Nov 2026)

## Basis and scope
The existing user-supplied American Soldier WW2 GLB, its 65-bone Mixamo-compatible skin and original textures remain unchanged. The German hero and three.js main are not modified. Quaternius clips remain the source of lower-body locomotion.

This is a **QA prototype**, not an artist-approved realistic grip.

## Sources and licenses
- **Ara 3D Gen** (Joshua Olatunde and contributors, 2026), MIT software license, https://github.com/olatunde85/3d-gen. Shooter hand direction / palm reference for rifle ready and aim is adapted from `src/core/anim/clips/shooter.ts`, and the concept of a right-hand `WeaponR` socket from `src/core/rig/socket.ts`. Copyright retained; reference implementation is not imported as-is. MIT license: https://github.com/olatunde85/3d-gen/blob/main/LICENSE
- Quaternius Universal Animation Library: CC0, https://quaternius.itch.io/universal-animation-library.
- Existing British weapon GLBs are from muster-ww2, MIT (see `assets/ww2-weapons/LICENSE.txt`).
- Original American hero is user supplied and marked CC BY 4.0. **Commercial attribution needs owner verification** because source GLB metadata and public Sketchfab listing name different authors. Do not merge to release until cleared.

## Implemented independently for the US hero
1. Preserve one 65-bone skeleton, 36 source meshes, Quaternius 4 clip preview.
2. Remove the 8 arm animation targets from each locomotion clip so IK is the only arm writer.
3. Anchor the rifle stock to the right shoulder, solve the trigger hand first, and then solve the left fore-end target.
4. Calibrate wrist/finger axes from original Index, Middle, Pinky and Thumb joints; use Ara-inspired target palm directions.
5. Articulate all original finger phalanges; do not create additional hand or glove meshes.
6. Preview Lee-Enfield, Sten, Bren original GLBs and the **provisional procedural PIAT** (not a certified game-ready GLB).
7. Fix cached Safari Blob handling (no `file.name` required when loading from IndexedDB). A model may still require **one first-time selection**, because the approved Quaternius GLB binary is not committed to the repository.

## Acceptance gates before gameplay integration
- Film each weapon in Ready, Walk, Jog and Sprint from front, side and rear on iPhone Safari. Verify fingertip orientation, grip contact, shoulder stock, both elbow bends and smooth transitions.
- A numerical wrist-to-target distance alone does **not** demonstrate correct palm orientation. The preview now shows both finger-direction errors in degrees. Rejection is mandatory if palms are anatomically wrong regardless of wrist distance.
- Validate PIAT's historical silhouette and posture; no firing on the move for rifle/PIAT. Retain SMG and Bren run-and-gun rules.
- Once poses are visually approved, bake four weapon-specific **upper-body** clips per weapon into GLB with proper shoulder, finger and wrist orientations. Use layered lower body from Quaternius. This removes per-frame procedural solvers from release.
- Publish nothing to main / release until attribution, performance and Safari visual QA pass.

## Files
- `babylon/american-hero-ara-hybrid.js`: experimental upper-body rig
- `babylon/american-hero-ara-hybrid-iphone.html`: isolated iPhone preview
- `babylon/tests/test-ara-hybrid.cjs`: structural regression tests
