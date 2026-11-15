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


## Binary GLB inspection (verified, not inferred)
Read both GLBs directly from the Battlefield branch as base64 and decoded their embedded glTF JSON.
- `night-striker-lite.glb`: **65 skin joints** (single skin), including `spine_01/02/03`, `clavicle_l/r`, `upperarm_l/r`, `lowerarm_l/r`, `hand_l/r`, finger joints.
- Arm hierarchy is `spine_03 -> clavicle_r -> upperarm_r -> lowerarm_r -> hand_r` and the equivalent left chain.
- `hero-three-clips-lite.glb`: exactly **3 animations**, `Idle_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, **195 glTF channels each**. There is no combat clip in this file.
- The external rifle package uses a **90-bone UE5 rig** and `Gun` attached to `spine_05`; our rig has **65 joints** and ends its spine at `spine_03`. Thus name-based retargeting of its combat clip will not work unchanged.
- The current Babylon implementation applies shoulder rotations around local X without validating rest-axis orientation. User screenshot shows arms swept backward; do not repeat this strategy.

### Safe next implementation
A proper `Combat_Hold_MP40` animation must be authored or licensed and retargeted for the 65-joint rig, with a verified grip and support-hand pose. Do not publish another unvalidated shoulder-axis tweak as a fix.
