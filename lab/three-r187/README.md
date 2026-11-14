# Three.js r187 — isolated real-asset rig laboratory

## Purpose
Validate the upgrade from Three.js r128 to r187 (ES modules + WebGL 2), without modifying or publishing the `main` RTS.

Standalone page: `lab/three-r187/index.html`

- Left: original Quaternius character animated using **one** native skeleton. No WW2 outfit, used only as the control.
- Right: the same Quaternius animation with the existing Panzergrenadier donor **second** skeleton and original WW2 costume, mapped via rest-space rotations and two-bone IK.
- Both sides use the actual, unmodified licensed game assets: `assets/native-hero-quaternius/*.glb`, `assets/ww2-weapons/*.glb` and the embedded Panzergrenadier GLB extracted from `preview/parts/german-000..009.txt`.
- Supports factions, rifle / SMG / machine gun, idle / jog / sprint, rotation-only versus project-style IK, visible skin-surface contact markers, and mobile-friendly close-ups.
- Uses pinned `three@0.187.0` through a native importmap, not the old r128 script globals.
- If WebGL2 unavailable, the lab shows an error instead of a blank canvas.

## Findings — why this is not a hand fix yet
From the independent r128 research run [43632813875](https://github.com/jango763/battlefield/actions/runs/43632813875):
- Both skeletons contain 65 bones, but use incompatible bone names / bind orientations.
- 52 donor bones are mapped to native bones.
- When IK puts both hand-joint positions exactly at the weapon grips, the *visible skinned glove mesh* can still be roughly 0.10–0.12 game units away.
- British left wrist bind-rotation difference is approximately 75.9 degrees.
- This is a **pose + retargeting + skinning** problem; swapping the renderer cannot fix the visible glove.

The r187 laboratory browser test confirms the assets and shaders load using the current engine. But *visual correctness of hands is not accepted*: the side-by-side screenshots still show incorrect wrist/finger positioning. The rotation-only option deliberately illustrates why blindly transferring animations is inadequate. The single-skeleton control does **not** yet have a retargeted WW2 outfit.

## Reproduce
On a server, open `/lab/three-r187/index.html`. GitHub Pages can serve it once the branch is published for that address; or use a commit-pinned rawcdn.githack.com URL.

GitHub Actions workflow: `.github/workflows/check-three-r187-lab.yml`. Tests:
- static module syntax;
- `THREE.REVISION===187`;
- original costume GLB extracted successfully;
- both original and donor skinned skeletons loaded;
- all tracked arm meshes and two hands can be measured;
- combinations of factions, weapon types and animations;
- desktop Chromium + iPhone-size Chromium screenshots.

## Next architecture experiment (not yet performed)
Create **one visible skeleton for the dressed soldier**, by rebinding / reskinning the donor outfit to native Quaternius bone weights in an offline tool (e.g. Blender) and export a verified GLB. Then:
1. Compare wrist/finger mesh contact against same weapon attachments, in both factions.
2. Examine 3/4 front and side screenshots in idle, aim, jog and firing.
3. Test iPhone Safari locally and measure actual FPS / WebGL 2 support before contemplating any engine upgrade.
4. Preserve gameplay input / combat / all weapon slots. Merge to production only with user approval.

Official documentation:
- https://threejs.org/docs/pages/GLTFLoader.html
- https://threejs.org/docs/pages/module-SkeletonUtils
- https://threejs.org/docs/pages/SkinnedMesh.html
- https://github.com/mrdoob/three.js/wiki/Migration-Guide
