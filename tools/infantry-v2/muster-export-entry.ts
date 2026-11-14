/**
 * Extract unmodified Muster WWII British soldier geometry for a Battlefield
 * compatibility test. Original author: Kenton Wang, MIT, 2026.
 * Source commit: 7d2fa86ebc3b999eaf085831cdcd5dccefea63d4
 * This intermediate exporter is injected into a temporary Muster checkout.
 * The production game never executes or downloads TypeScript at runtime.
 */
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {buildBritishSoldier} from './assets/uk/infantry/soldier';

export async function exportBritish(role:'rifleman'|'leader'|'bren'){
  const model=buildBritishSoldier(role,{pack:true},{detail:'low'});
  const names:string[]=[];
  let triangles=0;
  const disposable:THREE.Material[]=[];
  model.traverse(o=>{
    const mesh=o as THREE.Mesh;
    if(!mesh.isMesh)return;
    names.push(mesh.name);
    triangles+=mesh.geometry.index?mesh.geometry.index.count/3:mesh.geometry.getAttribute('position').count/3;
    // Muster surface shaders are Three.js 0.186 browser-specific. Export
    // their real mesh geometry and their base colors to portable glTF 2.0.
    const copy=(orig:THREE.Material)=>{
      const m=orig as THREE.MeshStandardMaterial;
      const mat=new THREE.MeshStandardMaterial({
        name:orig.name||'Muster material',
        color:m.color?.clone()??new THREE.Color(0xffffff),
        metalness:Math.min(1,Math.max(0,m.metalness??0)),
        roughness:Math.min(1,Math.max(0,m.roughness??.85)),
        vertexColors:!!m.vertexColors,
        side:m.side,
        transparent:m.transparent,
        opacity:m.opacity,
      });
      disposable.push(mat);
      return mat;
    };
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(copy):copy(mesh.material);
    // Retain one-to-one original part names. Those are needed when rigging.
    mesh.castShadow=true;
  });
  const data=await new GLTFExporter().parseAsync(model,{
    binary:true,onlyVisible:true,truncateDrawRange:true,
    includeCustomExtensions:false,maxTextureSize:256
  });
  const bytes=new Uint8Array(data as ArrayBuffer);
  const parts:string[]=[];
  for(let i=0;i<bytes.length;i+=32768)
    parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  const b64=btoa(parts.join(''));
  return {role,triangles,meshNames:names,bytes:bytes.length,b64};
}
