// Additional M40 wool volume: source-inspired loft over the torso, skinned
// to the ORIGINAL 90-joint Babylon skeleton by nearest rest-surface weights.
// This is not a static cylindrical body: waist shaping + flared hem and
// spinal influences follow the original model's animation.
const B=window.BABYLON;
export function loftTunic(scene,body,color='#41483e'){
 const p=body.getVerticesData(B.VertexBuffer.PositionKind);
 const ids=body.getVerticesData(B.VertexBuffer.MatricesIndicesKind);
 const wt=body.getVerticesData(B.VertexBuffer.MatricesWeightsKind);
 if(!p||!ids||!wt||p.length/3<1000)throw Error('Missing skinned body data for M40 loft');
 const eligible=[];
 for(let i=0;i<p.length/3;i++){
  const x=p[i*3],y=p[i*3+1],z=p[i*3+2];
  if(Math.abs(x)<.208&&y>.74&&y<1.48)eligible.push(i);
 }
 if(eligible.length<100)throw Error('No trunk vertices available for uniform loft');
 const mesh=new B.Mesh('M40-skinned-trunk-loft',scene);
 const rows=[
  {y:.79,ex:.029},{y:.82,ex:.028},{y:.90,ex:.018},
  {y:1.03,ex:.009},{y:1.12,ex:.018},{y:1.22,ex:.015},
  {y:1.33,ex:.013},{y:1.39,ex:.014},{y:1.425,ex:.004}
 ];
 const n=52,positions=[],idData=[],weightData=[],indices=[];
 for(let row=0;row<rows.length;row++){
  const {y,ex}=rows[row];
  for(let i=0;i<n;i++){
   const ang=i/n*Math.PI*2,cx=Math.sin(ang),cz=Math.cos(ang);
   // Measure a cross-section from the actual reference body, excluding arm
   // vertices. The source uniform builder uses a trunk loft for the same reason.
   let best=0;
   for(const v of eligible){
    const vy=p[v*3+1];if(Math.abs(vy-y)>.052)continue;
    const x=p[v*3],z=p[v*3+2];
    const projection=x*cx+z*cz;
    // discard points far around the back of the measured section
    if(projection>best)best=projection;
   }
   const radial=Math.max(best,.097)+(row<3?ex:ex*.75);
   const fold=(row<4?.003:0)*Math.sin(6*ang+row*.35);
   const X=cx*(radial+fold),Z=cz*(radial+fold);
   positions.push(X,y,Z);
   let nearest=-1,dist=Infinity;
   for(const v of eligible){
    const dx=p[v*3]-X,dy=p[v*3+1]-y,dz=p[v*3+2]-Z;
    const ds=dx*dx+dy*dy+dz*dz;
    if(ds<dist){nearest=v;dist=ds;}
   }
   for(let k=0;k<4;k++){idData.push(ids[nearest*4+k]);weightData.push(wt[nearest*4+k]);}
  }
 }
 for(let row=0;row<rows.length-1;row++){
  for(let i=0;i<n;i++){
   const j=(i+1)%n,a=row*n+i,b=row*n+j,c=(row+1)*n+i,d=(row+1)*n+j;
   indices.push(a,c,b,b,c,d);
  }
 }
 const normals=[];B.VertexData.ComputeNormals(positions,indices,normals);
 const vd=new B.VertexData();
 vd.positions=positions;vd.indices=indices;vd.normals=normals;
 vd.matricesIndices=idData;vd.matricesWeights=weightData;
 vd.applyToMesh(mesh);
 mesh.skeleton=body.skeleton;
 mesh.numBoneInfluencers=body.numBoneInfluencers||4;
 mesh.parent=body.parent;
 const mat=new B.PBRMaterial('M40-wool-loft',scene);
 mat.albedoColor=B.Color3.FromHexString(color);mat.roughness=.98;
 mat.metallic=0;mat.backFaceCulling=false;
 mesh.material=mat;mesh.isPickable=false;mesh.receiveShadows=true;
 return {mesh,triangles:indices.length/3,vertices:positions.length/3,joints:mesh.skeleton.bones.length,sourceVertices:eligible.length};
}
