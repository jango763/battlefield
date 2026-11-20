# British Commando — approved-source search (2026-11-20)

**LOCKED:** Do not silently substitute the Nisu mannequin, soldier_tac modern
asset, Jakeli infantry, or our rejected procedural commando. The previously
selected British candidate pool is Danoob, George Jakeli, and Pathum Tharaka
(Fab). Commando is its own role (3 slots), British Battledress + beret.

## First source to inspect: Pathum Tharaka (Fab)
Original selected model: https://www.fab.com/listings/fcb951be-af2e-402f-96d7-2e190e27121b

Published listing labels it **Free** and **Rigged** and supplies **FBX**
and separated objects/materials: top, pants, shoes, rifle, helmet, eyes, head,
etc. Detailed Blender listing: 59,484 vertices / 118,002 triangles. This
**exceeds our 65,000 triangles-per-soldier budget by ~82%**.
A real downloadable rig and proper license still require inspection of the
actual acquired file. A rigged flag alone never verifies body weights, bone
hierarchy or usable animations. Green beret would need a separate legally
obtained mesh, fitted to its actual Head bone, after correcting bind pose.

Other original option: Danoob, British Soldier WW2:
https://sketchfab.com/3d-models/british-soldier-ww2-9891e15cad0245639cf5f52c5f1f6b7c
Exact download status/rights/rig remain unverified; no source GLB present.

Jakeli (already acquired) is **infantry, not Commando**:
https://sketchfab.com/3d-models/british-army-soldier-ww2-c3d6038952914362b897138deda762ef

## Historical beret source possibility (NOT APPROVED)
https://sketchfab.com/3d-models/ww2-headwear-cc0-7092309d3b0d4ca6bcd4bfeec9640e29
The original page advertises multiple WWII headwear pieces including
"British commando hat", and describes their reuse as CC0. The overall scene
has ~625k triangles; isolate the hat and decimate before use. Actual source
license and file availability must be verified before incorporation.

## Adoption gate
1. Acquire **the actual Fab or Danoob model** through permitted official
   download. Preserve source, license, hash, UV, texture and topology.
2. Rig audit: rest pose, bind matrices, weights, proportion and arm reach,
   rather than approximate the silhouette with boxes.
3. Optimize to <=65k triangles; fit proper existing British beret to Head.
4. Retarget Quaternius Idle/Walk/Jog/Sprint. Only then adapt existing
   Lee-Enfield, Sten, Bren, PIAT hand contacts and reload animations.
5. Mobile WebKit + physical iPhone Safari visual approval. Only after this
   permit the 3 Commando slots to load this asset.

**Current status:** Candidate only, NO Commando source installed, NO
visualApproved flag, NO changes in production manifest. This preserves
the user's original casting and stops another accidental substitution.
