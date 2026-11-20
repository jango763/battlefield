# British Commando — source-first production gate

Recorded 2026-11-20 after rejecting the primitive-made mannequin.

## Do not substitute original source geometry

The following three British sources were already selected for Battlefield:
- `britishDanoob`: Danoob, British Soldier WW2, Sketchfab: https://sketchfab.com/3d-models/british-soldier-ww2-9891e15cad0245639cf5f52c5f1f6b7c
- `britishJakeli`: George Jakeli, British Army Soldier WW2, Sketchfab: https://sketchfab.com/3d-models/british-army-soldier-ww2-c3d6038952914362b897138deda762ef
- `britishFab`: Pathum Tharaka, WWII British Soldier, Fab: https://www.fab.com/listings/fcb951be-af2e-402f-96d7-2e190e27121b

File inventory checked: the original `british_army_soldier_ww2.glb` (Jakeli) and its optimized `uk-jakeli-mobile-static.glb` ARE available. The original Danoob/Fab GLB/FBX/Blender files have NOT been found in the currently accessible Library or any checked Battlefield branches. The existing `british-africa_infantry_-_call_of_duty_2_hd*.glb` uploads belong to previously rejected candidates and must not be substituted.

**Commando source selection remains unapproved.** Neither the role model nor its game-ready GLB may be marked as `installed` or `visualApproved`. This file is a verifiable blocker, not a request to model another character from geometric primitives.

## Locked reusable process (the successful Jakeli path)

1. Obtain an actual, permitted source file for the selected Commando character. Record source, authorization, original SHA-256 and triangle count. Do not download via unauthorized mirrors or replace with a newly invented model.
2. Import *that source mesh* into the pinned Blender 4.3 process, retaining original topology, UV maps and texture materials. Optimize only after validating source preservation.
3. Retarget/bind to the established 65-bone anatomical rig with correct rest/bind poses, inverse bind matrices, weights and deformation QA. Do not stretch the existing bones or hide bind errors with IK.
4. Restore authentic pre-Work `Walk_Quaternius`, `Jog_Quaternius`, `Sprint_Quaternius` lower-body animation curves.
5. Bake the four agreed UK weapons separately: Lee-Enfield, Sten, Bren and PIAT, with real hand-to-weapon geometry contact checks and naturally articulated fingers.
6. Preserve role-specific appearance (Commando vs Jakeli), run Android/Chromium + iPhone-sized WebKit tests, then validate visually on real iPhone Safari before considering integration.
7. Keep all work in `feature/british-army-10-stages-20261118`; never alter `main`, the approved German soldier, or baseline game without authorization.

## Rejected implementation

The 2026-11-20 original procedural Commando preview was visibly a blocky mannequin. Its source/scripts/workflow and four generated prototype GLBs were removed from the experiment branch, not adopted into the game. The older commits remain accessible for historical investigation only.
