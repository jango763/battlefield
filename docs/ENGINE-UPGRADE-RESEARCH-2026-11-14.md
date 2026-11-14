# Research decision: Three.js modernization versus hero hand failure

Date: 2026-11-14

## Status
Research only. Do **not** deploy or modify `main`. The existing game is a browser RTS and must stay playable on iPhone Safari, preserve combat, controls, saved mechanics and rollback.

## Version audit
- Current game loads `three.js/r128/three.min.js` and legacy `examples/js/loaders/GLTFLoader.js` via ordinary script tags, visible in `preview/parts/german-000.txt`.
- Latest npm version as of November 14, 2026 is `three@0.187.0`, released October 30, 2026.
- Official migration guide recommends upgrades in increments of about 10 releases to manage deprecations: https://github.com/mrdoob/three.js/wiki/Migration-Guide
- r148 removes `examples/js` addons, requiring ES-module `examples/jsm` imports; r161 removes `build/three.min.js` legacy global distribution.
- r163 removes WebGL 1 from `WebGLRenderer`: verify WebGL 2 and current Safari before committing to a full upgrade.
- Expect color-space, lighting, postprocessing and GLTFLoader changes. Version pin is mandatory; never unpinned CDN "latest".

## Relevant diagnostic from actual player models
Automated browser measurements in [research run 43632813875](https://github.com/jango763/battlefield/actions/runs/43632813875) compared the *skinned surface* (not only wrist bones) in British `uk-sten` and German `de-mp40`:
- Native and donor skeletons each contain 65 bones; 52 names mapped explicitly, but only one name overlaps literally, showing structurally different skeleton conventions.
- In idle and aim, bone-to-weapon grip errors often are zero or near-zero. Nevertheless visible glove vertex centroids are ~0.10–0.12 world units from the IK grip.
- British left hand source-to-donor wrist rotation difference ~75.9°; German left ~29.4°; right hands ~34–36°.
- British left donor wrist-to-grip error after jogging ~0.081 world units, though native wrist remains locked. German counterpart ~0.011.
- The extra rigid palm was removed in the testing branch and hidden Quaternius body skinned meshes remain hidden. The underlying visible hand-pose mismatch persists.
- Conclusion: simply updating the renderer cannot correct mismatched bind/rest poses, skinning orientation and cosmetic glove surface. Separate rig alignment solution is essential.

## Recommended decision and acceptance gates
1. **Keep r128 production frozen.** No breaking changes to `main` while validating.
2. **Create standalone r187 ES-module laboratory** with pinned `three@0.187.0` and official `GLTFLoader`/SkeletonUtils. Load exactly our existing Quaternius and WW2 outfit GLBs, same idle/jog/aim clips, real STEN and MP40 files. No game rewrite.
3. Compare current two-rig and proposed *one animation source / matched clothing skin* in that lab. Prefer one skeleton for visible body/clothing if skin data can be safely rebound. Otherwise preserve two rigs but perform bind/rest-space retargeting with verifiable local offsets.
4. Measure *skinned vertices and weapon contact*, not only bone-to-grip distance. Visual approval from head-on, side and 3/4 screenshots, motion clips, both factions and all weapon slots. Check no visible extra hands, missing fingers, weapon clipping or black screen.
5. Test r187 initialization, GLB loads, shadows/color difference and WebGL2/FPS/memory on desktop and **real Safari iPhone**. A mobile-sized Chromium viewport is not native Safari QA.
6. Once the lab passes, stage a separate engine migration branch. Follow the official compatibility guide in ~10-release checkpoints; adapt deprecated APIs and loading before introducing other gameplay changes.
7. Use side-by-side regression and rollback. `main` only after user visibly approves both visual quality and playable gameplay.

## Decision
**Explore upgrading to r187, but not as a hand-fix shortcut.** First deliver the isolated r187 rig proof-of-concept and review its measured results. Full production migration remains contingent on preserving browser/iPhone game compatibility.

## References
- https://www.npmjs.com/package/three?activeTab=versions
- https://github.com/mrdoob/three.js/wiki/Migration-Guide
- https://threejs.org/docs/pages/module-SkeletonUtils
- https://threejs.org/docs/pages/CCDIKSolver.html
