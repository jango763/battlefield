# Quaternius Native Hero Integration (isolated test)

This branch is based directly on the approved `main` release and only replaces the hero (unit P) visually using Quaternius' native 65-bone skeleton, original Idle/Jog/Sprint clips, and the tested two-handed assault-rifle IK. It adds a lightweight field-grey uniform overlay. Other soldier visuals, combat, controls, map, formations and collision/gameplay logic are unchanged.

### Test
Open `preview/formation-replenishment-v3.html`. `?rig=original` compares the original hero on the same map. `?rigdebug=1` enables the native-rig diagnostic ring and status label. On asset or GLTF load error the original hero remains as fallback.

### Assets
`night-striker-lite.glb` (~582 kB) and `hero-three-clips-lite.glb` (~907 kB) are redistributed under Quaternius CC0 1.0. Source: https://quaternius.com/packs/universalbasecharacters.html and https://quaternius.com/packs/universalanimationlibrary.html; pinned origin in https://github.com/Seyamalam/blood-league-kickoff/blob/aa02a4e6d8337a0604d2da131bcbbeb1f01badf0/docs/ASSET_CREDITS.md.

### Validation status
Static syntax checks complete. Prior version validated on Chromium mobile simulation and weapon grip in idle/jog/sprint/aim. This particular field-uniform update has not yet been verified on iPhone Safari, and should not be merged into main before visual inspection.

## Actual WW2 donor mesh test

`preview/german-v5.js` can use the **already credited** WW2 Panzergrenadier garment as a secondary skinned outfit on the native Quaternius hero. Bone names sanitized by Three.js are normalized; 52 joint mappings were observed in the first passing browser test. The `P.side` property changes colours: German field-grey `0x4a5450`, British sand/khaki `0xa28d69`. No gameplay changes. Old M42 helmet geometry is hidden, and there is no replacement M43 cap in this branch; the freely licensed WW2 Headwear asset has not been imported without its downloaded source. Toggle `?uniform=prototype` for the prior generated outfit. Manual iPhone Safari visual approval remains pending.
