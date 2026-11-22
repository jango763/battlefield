/* Visual parity pass for the original Three.js Battlefield.
 * Styling only: no changes to approved GLB meshes, animations or combat rules.
 * Tune for iPhone: subtle fog, restrained ACES grading and capped shadows.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BattlefieldLegacyVisualStyle=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const PROFILE=Object.freeze({
 name:'Legacy CoH3 visual parity / mobile',
 fogDensity:.0033,
 fogColor:'#919385',
 sunlight:1.00,
 ambient:.58,
 exposure:1.00,
 contrast:1.08,
 shadowMapSize:768,
 shadowCasterLimit:40
});
function apply({scene,B,camera,sun,world,ambient}){
 if(!scene||!B||!camera||!sun||!world)throw Error('Visual scene dependencies missing');
 const fog=B.Color3.FromHexString(PROFILE.fogColor);
 scene.clearColor=new B.Color4(fog.r,fog.g,fog.b,1);
 scene.fogMode=B.Scene.FOGMODE_EXP2;
 scene.fogDensity=PROFILE.fogDensity;
 scene.fogColor=fog;
 scene.ambientColor=new B.Color3(.26,.29,.26);
 if(ambient)ambient.intensity=PROFILE.ambient;
 sun.diffuse=B.Color3.FromHexString('#ffefcc');
 sun.specular=B.Color3.FromHexString('#e4d8bc');
 sun.intensity=PROFILE.sunlight;
 sun.position=new B.Vector3(-65,105,-40);
 if(scene.imageProcessingConfiguration && B.ImageProcessingConfiguration){
  const config=scene.imageProcessingConfiguration;
  config.toneMappingEnabled=true;
  config.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  config.exposure=PROFILE.exposure;
  config.contrast=PROFILE.contrast;
 }
 // High-value silhouettes only. Full-scene shadowing would saturate a mobile GPU.
 let shadows='unavailable',casters=0;
 if(B.ShadowGenerator){
  try{
   const mobile=typeof window!=='undefined'&&Math.min(window.innerWidth,window.innerHeight)<700;
   const shadowSize=mobile?512:PROFILE.shadowMapSize;
   const shadow=new B.ShadowGenerator(shadowSize,sun);
   shadow.usePercentageCloserFiltering=true;
   shadow.filteringQuality=B.ShadowGenerator.QUALITY_LOW;
   shadow.bias=.0009;
   shadow.normalBias=.02;
   const mainProps=(world.nodes||[]).filter(node=>
    /^(?:base-hq-|base-hq-roof-|farm-house-|farm-roof-|farm-barn-|pillbox-bunker-|pillbox-roof-)/.test(node.name));
   for(const node of mainProps.slice(0,PROFILE.shadowCasterLimit)){
    if(typeof node.getClassName==='function' &&
       !/Mesh/.test(node.getClassName()))continue;
    shadow.addShadowCaster(node);
    node.receiveShadows=true;
    casters++;
   }
   if(world.ground)world.ground.receiveShadows=true;
   shadows='soft-PCF';
  }catch(error){
   console.warn('Visual pass: soft shadows unavailable',error);
   shadows='fallback';
  }
 }
 if(camera){
  camera.inertia=.68;
  camera.angularSensibilityX=1700;
  camera.angularSensibilityY=1700;
 }
 return Object.freeze({profile:PROFILE.name,ground:'painted/updated',
  fog:true,shadows,casters});
}
return {PROFILE,apply};
});
