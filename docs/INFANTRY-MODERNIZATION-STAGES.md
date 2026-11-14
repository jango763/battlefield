# Infantry modernization — staged acceptance plan

Baseline: `main`, last approved hero/cap close-up V19. **Do not overwrite it until a pilot passes visual and runtime review.**

## Phase A — finish heroes (cosmetic only)
- [x] A1. Freeze the existing native Quaternius skeleton and verified idle/jog/sprint clips as reusable template. Regression: hero remains playable in both factions.
- [ ] A2. Verify realistic holding of all available weapons (Kar98k, MP40, MG42, Lee-Enfield, Sten, Bren) at rest, in running, and firing. Rectify wrist/thumb/finger alignment on native and WW2 donor skeleton.
- [ ] A3. Replace both problematic hero hats with licensed, creator-provided **mesh assets**. Keep V19 fallback until source GLBs are present. Do not ship the experimental procedural V20–V22.
- [ ] A4. Add reusable head-bone delta attachment and side-specific fit profiles. Check front, 3/4, profile, back during idle/jog/sprint.
- [ ] A5. Verify hero's German/UK uniform and mobile Safari; remove extra diagnostic HUD only after acceptance.

## Phase B — **one** German ordinary soldier, same hero animation library
- [x] B1. Create shared `nativeAnimationLibrary`, clone **skeleton+skin** independently per unit, do not clone live hero pose.
- [x] B2. Pilot a single German infantry soldier behind `?armyRig=pilot`. Preserve `main` behavior without the flag; retain rollback to previous visual rig.
- [x] B3. Native idle/jog/sprint under current AI, pathfinding, health, aim, shooting; no animation clip may drive gameplay position.
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
- [ ] D4. Final cross-faction release regression on iPhone Safari and desktop: 3–4 person squads, all four headgear categories, smoke/fire effects, memory and user acceptance, then merge branch to main.

## Release gates

At **every** checkpoint: GitHub feature branch → JS syntax → head-bone / weapon IK / unit logic assertions → mobile browser screenshots → live user inspection → only then merge into `main`. Never claim a visual pass solely from a green CI test. The original unit simulation, economics, movement orders and controls must remain intact. Do not substitute procedural hats when real sourced GLBs are requested.

## Verified checkpoint: first German regular soldier

Feature branch commit `b48cee694c958a0e038f324ad887ae45d31e780f`, GitHub Actions run `43580200836` **passed** with `?armyRig=pilot`.

- Original Quaternius model is independently cloned; no bones shared with the hero. 65 native bones; three reused animation clips.
- Existing Panzergrenadier WW2 donor uniform retargeted with 52 bone bindings. German pilotka visible, British beret hidden.
- Idle, jog, sprint, aim state logic, visible hand attachment targets, and unchanged unit x/z verified in mobile Chromium.
- Exactly one regular German soldier uses the new rig in pilot mode; all other soldiers remain on the prior rig.
- Test snapshot: `army-native-first-soldier.png` in GitHub Actions artifact `army-native-pilot`.
- The standard gameplay URL **does not yet use** army native rigs; this test does not establish Safari/iPhone performance, convincing finger motion, or completed licensed helmets.
- Observed test-environment warnings: non-fatal favicon/resource 404 and parent-iframe postMessage noise; separate from the rig assertions.

**Next gate:** B4 visual approval (front/back/3⁄4 gait and real weapon grips), B5 FPS/memory tests, then C1 squad (3–4 soldiers), not a mass swap.


- A1/B1/B2/B3 passed as single-soldier pilot in `feature/headwear-staged-hero-armies-20261114`.
- Model-source license and binary GLB import are tracked separately in `feature/german-m34-external-glb-loader-20261114`; model not yet acquired.
- The approved `main` hero remains the working version while the army pilot is tested.

## Second checkpoint — German four-soldier squad (staging only)

**Branch:** `feature/army-four-squad-stylized-20261114`  
**Mobile Chromium QA:** run `43584325528`, commit `bde34a267150488d11b5b8373390bc56fa15128c` — passed.

- `?armyRig=squad` migrates **at most four** German regular infantrymen to independent Quaternius skeletons and native idle/jog/sprint clips.
- Three deterministic headwear variants: field-grey pilotka V19, existing MIT-licensed German M43 GLB, and original skinned WW2 helmet. British beret does not appear on German units.
- Four independent skeletons with 65 bones each and 52 WW2 uniform retarget bindings; current game orders, unit x/z and damage rules stay unchanged.
- Mobile Chromium initially exposed **21.6 cm** left hand–weapon reach error. The support contact now adjusts along the gun fore-end: maximum **4.4 cm** in jogging, **1.2 cm** in sprint and approximately zero in idle/aim test samples.
- Shared weapon GLB parsing/material/geometry cut test renderer geometry count from **742 to 677** (roughly **8.8%**). This is a comparable Chromium render-memory indicator, **not an iPhone FPS or RAM measurement**.
- Original `main` unchanged. **Visual acceptance still pending**: M43 fit, close-up finger positions, Safari stability and 4-soldier readability.
- Next gate: real iPhone Safari, screenshot front/3⁄4/back under locomotion, FPS and memory checks, then expansion beyond four only if successful.
