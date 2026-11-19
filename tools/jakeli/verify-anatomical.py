#!/usr/bin/env python3
"""Independent glTF checks: bind identity, source surfaces/textures, weights and all clips."""
import json,struct,hashlib,re
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
ROOT=Path(__file__).resolve().parents[2]
class GLB:
 def __init__(self,p):
  b=Path(p).read_bytes();assert b[:4]==b'glTF' and struct.unpack_from('<I',b,8)[0]==len(b)
  k=struct.unpack_from('<I',b,12)[0];self.d=json.loads(b[20:20+k]);self.bin=b[28+k:];self.n=self.d['nodes']
 def accessor(self,i):
  a=self.d['accessors'][i];v=self.d['bufferViews'][a['bufferView']];dt={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  x=np.ndarray((a['count'],dim),dtype=dt,buffer=self.bin,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dt).itemsize*dim),np.dtype(dt).itemsize)).copy()
  if a.get('normalized') and a['componentType']!=5126:x=x.astype(float)/np.iinfo(dt).max
  return x
 def worlds(self,overrides={}):
  parents={c:i for i,n in enumerate(self.n) for c in n.get('children',[])};cache={}
  def w(i):
   if i in cache:return cache[i]
   n={**self.n[i],**overrides.get(i,{})}
   if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4).T
   else:
    x,y,z,q=n.get('rotation',[0,0,0,1]);m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*q),2*(x*z+y*q)],[2*(x*y+z*q),1-2*(x*x+z*z),2*(y*z-x*q)],[2*(x*z-y*q),2*(y*z+x*q),1-2*(x*x+y*y)]])*n.get('scale',[1,1,1]);m[:3,3]=n.get('translation',[0,0,0])
   cache[i]=(w(parents[i])@m) if i in parents else m;return cache[i]
  return np.array([w(i) for i in range(len(self.n))])
 def pose(self,a,t):
  over={}
  for c in a['channels']:
   s=a['samplers'][c['sampler']];times=self.accessor(s['input']).ravel();v=self.accessor(s['output']);k=max(0,min(len(times)-2,np.searchsorted(times,t)-1));u=np.clip((t-times[k])/max(1e-10,times[min(k+1,len(times)-1)]-times[k]),0,1)
   b=v[min(k+1,len(v)-1)].copy();p=v[k].copy()
   if c['target']['path']=='rotation':
    dot=np.dot(p,b)
    if dot<0:b=-b;dot=-dot
    angle=np.arccos(np.clip(dot,-1,1));value=((1-u)*p+u*b) if angle<1e-4 else (np.sin((1-u)*angle)*p+np.sin(u*angle)*b)/np.sin(angle);value/=np.linalg.norm(value)
   else:value=(1-u)*p+u*b
   over.setdefault(c['target']['node'],{})[c['target']['path']]=value
  return self.worlds(over)
 def images(self):
  result=[]
  for i in self.d.get('images',[]):
   v=self.d['bufferViews'][i['bufferView']];b=self.bin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];result.append(hashlib.sha256(b).hexdigest())
  return set(result)
src=GLB(ROOT/'assets/allied-soldiers/uk-jakeli-mobile-static.glb');g=GLB(ROOT/'assets/allied-soldiers/uk-jakeli-anatomical-v2.glb')
assert len(g.d['skins'])==1;sk=g.d['skins'][0];assert len(sk['joints'])==65
ib=g.accessor(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);world=g.worlds();res=float(np.max(abs(world[sk['joints']]@ib-np.eye(4))));assert res<.0001,res
names=[n.get('name','') for n in g.n];assert len([n for n in names if n=='LeftHand'])==1
character=[(i,n) for i,n in enumerate(g.n) if n.get('skin')==0 and 'mesh' in n];assert len(character)==13
# Geometry comparison uses the original authored positions and a single global similarity transform.
original={m['name']:m for m in src.d['meshes'] if 'springfield' not in m['name'].lower()}
preserve_error=0;max_weight_error=0;arrays=[]
unit=1.8/(185.15460205078125+1.5273550748825073)
for i,n in character:
 m=g.d['meshes'][n['mesh']];key=n['name'].removeprefix('Jakeli_');source=original[key]
 p0=src.accessor(source['primitives'][0]['attributes']['POSITION']);p0=np.column_stack((p0[:,0],p0[:,2]+1.5273550748825073,-p0[:,1]))*unit
 pos=[]
 for p in m['primitives']:
  at=p['attributes'];v=g.accessor(at['POSITION']);j=g.accessor(at['JOINTS_0']);w=g.accessor(at['WEIGHTS_0']);assert np.isfinite(v).all() and np.isfinite(w).all() and w.min()>=0 and j.max()<65
  max_weight_error=max(max_weight_error,float(abs(w.sum(1)-1).max()));assert max_weight_error<1e-5
  tri=g.accessor(p['indices']).reshape(-1,3);edges=np.vstack((tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]));length=np.linalg.norm(v[edges[:,0]]-v[edges[:,1]],axis=1);valid=length>.001
  arrays.append((v,j,w,edges[valid],length[valid],key));pos.append(v)
 pos=np.vstack(pos);err=max(cKDTree(p0).query(pos)[0].max(),cKDTree(pos).query(p0)[0].max());preserve_error=max(preserve_error,float(err))
assert preserve_error<.0001,preserve_error
# Source images 20..22 belong exclusively to the removed embedded Springfield.
assert len(src.images()-g.images())==3,'Unexpected source texture loss'
assert len(g.images() & src.images())==24,'Character texture bytes changed'
clips={a['name']:a for a in g.d['animations']};assert set(clips)=={'Ready','Aim','Fire','Walk','Jog','Sprint'}
parents={c:i for i,n in enumerate(g.n) for c in n.get('children',[])}
length_pairs=[(names.index(s+n),names.index(s+c)) for s in ['Left','Right'] for n,c in [('Arm','ForeArm'),('ForeArm','Hand'),('UpLeg','Leg'),('Leg','Foot')]]
rest_lengths=np.array([np.linalg.norm(world[a,:3,3]-world[b,:3,3]) for a,b in length_pairs]);reports={};worst_by_mesh={}
for name,anim in clips.items():
 duration=max(g.accessor(s['input'])[-1,0] for s in anim['samplers']);max_length_error=0;worst_stretch=0;bounds=[]
 for t in np.linspace(0,duration,9):
  posed=g.pose(anim,t);lengths=np.array([np.linalg.norm(posed[a,:3,3]-posed[b,:3,3]) for a,b in length_pairs]);max_length_error=max(max_length_error,float(abs(lengths-rest_lengths).max()))
  mats=posed[sk['joints']]@ib
  allpos=[]
  for v,j,w,e,le,key in arrays:
   p=np.column_stack((v,np.ones(len(v))));out=sum(np.einsum('nij,nj->ni',mats[j[:,k]],p)*w[:,k,None] for k in range(4))[:,:3];assert np.isfinite(out).all();allpos.append(out)
   ratio=np.linalg.norm(out[e[:,0]]-out[e[:,1]],axis=1)/le;stretch=float(np.quantile(ratio,.999));worst_stretch=max(worst_stretch,stretch);worst_by_mesh[key]=max(worst_by_mesh.get(key,0),stretch)
  allpos=np.vstack(allpos);bounds.append((allpos.min(0).tolist(),allpos.max(0).tolist()));assert abs(allpos).max()<2.5
 assert max_length_error<1e-4,(name,max_length_error)
 reports[name]={'seconds':float(duration),'samples':9,'maxLimbLengthErrorMeters':max_length_error,'worstMeshEdgeStretchP999':worst_stretch,'bounds':bounds}
report={'bindMatrixMaxResidual':res,'originalSurfaceMaxErrorMeters':preserve_error,'sourceTexturesByteIdentical':True,'maxWeightSumError':max_weight_error,'skinBones':65,'characterMeshes':13,'clips':reports,'visualApproval':False,'iphoneSafari':False}
q=ROOT/'babylon-qa-results/jakeli-anatomical';q.mkdir(exist_ok=True,parents=True);(q/'gltf-report.json').write_text(json.dumps(report,indent=2));print('JAKELI_GLTF_PASS',json.dumps({k:v for k,v in report.items() if k!='clips'}));print('STRETCH',[(n,r['worstMeshEdgeStretchP999']) for n,r in reports.items()])

print('MESH_STRETCH',json.dumps(worst_by_mesh))
