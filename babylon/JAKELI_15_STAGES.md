# Battlefield — George Jakeli: 15-stage production plan

Target: `feature/british-army-10-stages-20261118` only (Babylon.js).
**Do not edit `main`, original Three.js game, approved Wehrmacht, approved American hero or combat balance.**

The 5.2 MB optimized Jakeli source is **static** (14 meshes, 0 skins, 0 animations). The 65-bone American hero donor may be used as a *rig / animation donor only*, not a substituted British skin.
No stage is complete merely because a controller or test scaffold exists. Progression is automatic **only when the previous stage's measurable acceptance gate passes**. A failed gate stops deployment and records the blocker; it must never falsely mark the soldier ready.

| # | Stage | Acceptance gate |
|---|---|---|
| 1 | Audit Jakeli binary | Exact SHA-256, author and model identity, 14 meshes, 0 existing skin / clips confirmed |
| 2 | Audit donor / coordinates | Real 65 joint identities, rest pose, scale/axes and animation names recorded |
| 3 | Align bind-space | Original geometry retained; calibrated rotation, scale, origin; feet and shoulders coherent |
| 4 | Transfer skin | Every deforming vertex receives valid normalized JOINTS_0/WEIGHTS_0 with correct indices |
| 5 | Full one-skeleton GLB | Real Jakeli meshes use one 65-bone glTF skin; reject fake/empty rig |
| 6 | Validate deformation | Check arms, elbows, fingers, legs and head against motion frames with screenshots |
| 7 | Idle / Walk | Two genuine Quaternius clips bound to Jakeli joints without gait offset |
| 8 | Jog / Sprint | Another two genuine clips, verified foot contacts and no twisted wrists |
| 9 | Transitions | Crossfade Idle / Walk / Jog / Sprint including start frame, respawn and reset |
| 10 | Combat-ready stance | Natural shoulder stock position, elbows, wrist orientation and aim |
| 11 | Two-hand weapon sockets | Right hand + Weapon_R, left hand to foregrip via IK; no floating mesh |
| 12 | Lee-Enfield / Sten | Test fire, aim, recoil, reload, moving-fire policy and grip tolerances |
| 13 | Bren / PIAT | Test heavy weapon aiming, grip, appropriate reload and muzzle direction |
| 14 | British squad | Independent British infantry entities, faction identity, units and formations; no replacement of hero |
| 15 | iPhone Safari acceptance | Visual screenshots + actual Safari touch/performance verification; release gate passed |

**Release interlock:** Never set `installed:true` / merge to `main` until the *actual* Jakeli skinned GLB, four motion clips, two-hand grip checks, iPhone Safari manual acceptance and required license attribution have all passed.

## Current notes
- The source is already committed as `assets/allied-soldiers/uk-jakeli-mobile-static.glb`.
- The remaining Danoob and Fab source assets are separate candidates; never claim that the full British army has shipped based on Jakeli alone.
- CI and audit outputs are evidence, not a replacement for visual approval.