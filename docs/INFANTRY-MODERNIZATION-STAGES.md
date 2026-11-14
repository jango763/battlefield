# Infantry modernization — staged acceptance plan

Baseline: `main`, last approved hero/cap close-up V19. **Do not overwrite it until a pilot passes visual and runtime review.**

## Phase A — finish heroes (cosmetic only)
- [ ] A1. Freeze the existing native Quaternius skeleton and verified idle/jog/sprint clips as reusable template. Regression: hero remains playable in both factions.
- [ ] A2. Verify realistic holding of all available weapons (Kar98k, MP40, MG42, Lee-Enfield, Sten, Bren) at rest, in running, and firing. Rectify wrist/thumb/finger alignment on native and WW2 donor skeleton.
- [ ] A3. Replace both problematic hero hats with licensed, creator-provided **mesh assets**. Keep V19 fallback until source GLBs are present. Do not ship the experimental procedural V20–V22.
- [ ] A4. Add reusable head-bone delta attachment and side-specific fit profiles. Check front, 3/4, profile, back during idle/jog/sprint.
- [ ] A5. Verify hero's German/UK uniform and mobile Safari; remove extra diagnostic HUD only after acceptance.

## Phase B — **one** German ordinary soldier, same hero animation library
- [ ] B1. Create shared `nativeAnimationLibrary`, clone **skeleton+skin** independently per unit, do not clone live hero pose.
- [ ] B2. Pilot a single German infantry soldier behind `?armyRig=pilot`. Preserve `main` behavior without the flag; retain rollback to previous visual rig.
- [ ] B3. Native idle/jog/sprint under current AI, pathfinding, health, aim, shooting; no animation clip may drive gameplay position.
- [ ] B4. Retarget existing WW2 uniform and verify weapon-hand IK, animate proper fingers.
- [ ] B5. Inspect FPS and memory on iPhone Safari, target 30+ FPS for representative battle; implement shared geometry/texture caching and distance LOD before expanding count.

## Phase C — German army
- [ ] C1. Validate three visible roles: rifleman, SMG, machine gunner, with different weapons and stance.
- [ ] C2. Use historical, licensed cloth caps and Stahlhelm variants, helmets with/without net, differentiated by role; deterministic assignment, no new RNG use.
- [ ] C3. Test squad of 3–4 while walking, aiming, shooting, dying, using cover. Confirm unique visual identities and readable silhouette.
- [ ] C4. Expand via guarded per-unit rollout and monitor FPS/frame time and errors; protect original RTS mechanics.

## Phase D — British army
- [ ] D1. Reuse approved native animation library / soldier rig with side-correct clothing, skin and weapon manifest.
- [ ] D2. British Brodie helmets with/without camouflage for ordinary troops; maroon berets only for airborne/appropriate elite roles, other caps for support troops.
- [ ] D3. Verify UI faction switch, all roles, running, firing, projectiles, no clipping or weapon-hand mismatch; 30+ FPS on representative iPhone.

## Release gates

At **every** checkpoint: GitHub feature branch → JS syntax → head-bone / weapon IK / unit logic assertions → mobile browser screenshots → live user inspection → only then merge into `main`. Never claim a visual pass solely from a green CI test. The original unit simulation, economics, movement orders and controls must remain intact. Do not substitute procedural hats when real sourced GLBs are requested.

## Current implementation

- A1/B1 staging under way in `feature/headwear-staged-hero-armies-20261114`.
- Model-source license and binary GLB import are tracked separately in `feature/german-m34-external-glb-loader-20261114`; model not yet acquired.
- The approved `main` hero remains the working version while the army pilot is tested.
