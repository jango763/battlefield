## Scope and ownership

- BF-ID / coordination claim: https://github.com/jango763/battlefield/issues/41
- Babylon base branch / checkpoint:
- Files owned and changed:
- Dependencies / overlapping work:

## Behavior change

- Before:
- After:
- Preserved contracts (hero movement/camera, autonomous armies, formations, magnet, Zigzag, economy, rig):

## Validation

- [ ] `node babylon/tools/assemble-game-parts.cjs --check`
- [ ] Relevant `babylon/tests/*.cjs` suites; names/results listed below
- [ ] Babylon AI regression gate passes
- [ ] Mobile Chromium smoke test and screenshot reviewed (if graphics/controls/animation touched)
- [ ] Mobile WebKit smoke test and screenshot reviewed (if graphics/controls/animation touched)
- [ ] Real iPhone Safari checked by user (if visual/mobile behavior touched; otherwise mark not applicable)
- [ ] No Three.js baseline, checkpoints, or shared assets modified
- [ ] AI assistance disclosed; no unlicensed third-party assets used

### Commands and results

### Screenshots / FPS / performance notes

### Known limitations and rollback plan

**Merge policy:** draft until verified; do not merge without explicit user acceptance.
