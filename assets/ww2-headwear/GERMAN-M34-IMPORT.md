# German field cap — external GLB integration (staging)

The browser RTS now supports a **separate 3D mesh asset** for the German field cap while preserving the tested V19 pilotka as fallback. The importer is intentionally in a feature branch until a verified authentic source file is supplied and mobile screenshots are approved.

## Source to obtain

- Creator: **britdawgmasterfunk**.
- Collection: **WW2 headwear**, including a **German field cap**.
- Original: https://blendswap.com/blend/30667
- Alternative listing: https://sketchfab.com/3d-models/ww2-headwear-cc0-7092309d3b0d4ca6bcd4bfeec9640e29
- BlendSwap shows **CC0**; the Sketchfab listing displays **CC Attribution** although the author describes the file as CC0. Preserve author, source URL and license evidence. Do not assume the pages use identical licenses.

The **original author-supplied 3D file has not yet been downloaded or imported**. BlendSwap requires a signed-in account for its official download; Sketchfab downloads also require authorization. No hidden scraping or replacement-by-generated-proxy.

## Prepare the single headwear model

1. Download the author's original **WW2 headwear** Blender scene through its official Download control.
2. In Blender, select **only the German field cap**; exclude the collection's helmets and other hats.
3. Duplicate it into a clean scene; apply transforms and orient the model **+Y up, +Z toward face**.
4. Remove unrelated insignia and geometry, keeping actual cloth mesh and author material. Optimize for mobile Safari, ideally a few thousand triangles and a compact texture.
5. Export as a self-contained **glTF Binary (.glb)** at:
   `assets/ww2-headwear/german-m34-fieldcap.glb`
6. Test in the feature branch with `?inspect=german&pilotka=external`. It must track head rotation while standing/running/aiming; no skin penetration or floating rear edge.

## Loader behavior

- The separate asset is **not yet present**. Only `?pilotka=external` attempts the importer. Normal play stays on stable V19.
- On successful load, the 3D model replaces the old cap without changing unit gameplay, the character animation clips or weapon mechanics.
- If missing/invalid, the old cap stays visible and an error is logged for diagnosis.
- Height and width are fitted with one uniform scale factor; avoid non-uniform deform/stretch.
- Actual visual fit is **not confirmed until the real source GLB** has been acquired and tested.
