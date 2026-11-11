// Soldier model integration module — staged, not activated in index.html.
// Three.js r160; expects legally sourced local GLB files.
// Usage: import { createFactionSoldier } from './soldier-models.js';
// const { group, mixer } = await createFactionSoldier(THREE, GLTFLoader, 'german');
// Add group to scene, then mixer?.update(delta) in animation loop.
export const SOLDIER_ASSETS = Object.freeze({
  german: { url: './assets/soldiers/german.glb', attribution: 'WW2 Panzergrenadier 2k — verify exact CC BY attribution' },
  allied: { url: './assets/soldiers/allied.glb', attribution: 'WW2 Allied Soldier Low Poly Character Army — Zack, CC BY' }
});
export async function createFactionSoldier(THREE, GLTFLoader, faction) {
  const asset = SOLDIER_ASSETS[faction];
  if (!asset) throw new Error('Unknown faction: ' + faction);
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(asset.url);
  const group = gltf.scene;
  group.name = 'Soldier_' + faction;
  group.traverse(node => {
    if (node.isMesh || node.isSkinnedMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false; // safer for skinned meshes until bounds are checked
    }
  });
  const mixer = gltf.animations?.length ? new THREE.AnimationMixer(group) : null;
  return { group, mixer, clips: gltf.animations || [], asset };
}
