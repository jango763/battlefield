# Armed soldier animation: source and integration gate (2026-11-15)

## Verified upstream
- https://github.com/duolahypercho/ar-rifle-demo
- `public/characters/rifle-motion-ue5-v1.json`: 30 fps, skeleton `earthonline-ue5-v1`, body `civilian-m-01-player-ue5.glb`.
- Verified clip names include `rifle-idle`, `rifle-hold-low`, `rifle-hold-high`, 8-way `rifle-walk-*`, 8-way `rifle-jog-*`, `rifle-sprint`, aiming and reload clips.
- `public/characters/SOURCE.md` documents the Blender generator `blender/build_rifle_motion.py`, UE5 rig, hand IK nodes and weapon Gun track relative to chest. Some earlier reference mocap clips are Mixamo and expressly not for standalone redistribution.
- Root LICENSE not found (404). **Do not copy upstream source, animation GLBs or assets into Battlefield until rights are confirmed.**

## Current Battlefield lab
- Branch `lab/babylon-fast-prototype-20261114`.
- `assets/native-hero-quaternius/night-striker-lite.glb` and `hero-three-clips-lite.glb` are present.
- Existing animation names: `Idle_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`. They have been retargeted by normalized node name in `lab/babylon/app.js`.
- Current `combat` button freezes Idle, applies manual shoulder rotations and one-pass left-arm IK. User screenshots show arms behind torso and MP40 by hip. **This is a failed prototype, not an animation.**
- Existing weapon manifest `assets/ww2-weapons/manifest.json` includes MP40 trigger and support positions; weapon forward is +Z per local lab comment, whereas upstream rifle-motion JSON describes barrel along -Z. Direct transfer of gun transforms would reverse orientation.

## Decision
1. Preserve main game and three working locomotion clips.
2. Stop tweaking Euler angles or claiming two-hand grip works.
3. Before integration: inspect GLB node hierarchy, compare local rest axes and proportions with upstream 90-bone UE5 skeleton, confirm licensing.
4. If licensing permits, retarget a **single** rifle-hold-high pose offline, including right palm, left palm and gun pivot; only then export a new GLB and test on Babylon.
5. If rights cannot be established, use upstream as a reference for creating original animations, not copied content.

## Acceptance criteria
- Weapon barrel forward, magazine downward, butt near shoulder.
- Right hand on pistol grip and left hand on foregrip, not magazine.
- No bone inversions, four hands, detached weapons, or loading glitches.
- Switching Idle/Combat/Jog/Sprint works repeatedly on iPhone Safari.
- Do not merge into main game without passing the above.
