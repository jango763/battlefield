#!/usr/bin/env python3
"""Rebuild the existing US hero's unweighted finger chains against its actual hand surfaces.
Original GLB is NEVER overwritten. Geometry/materials/animations and 65-bone topology remain.
Experimental: geometric reconstruction, requires visual QA in a browser before approval.
"""
import json,struct,argparse
from pathlib import Path
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree

TIPS={
 "Thumb":(-.496,.157,.232),"Index":(-.573,.107,.275),
 "Middle":(-.611,.068,.252),"Ring":(-.630,.055,.209),
 "Pinky":(-.618,.065,.166)}
D={5121:('B',1),5123:('H',2),5125:('I',4),5126:('f',4)}
N={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}
def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)
class GLB:
 def __init__(self,filename):
  raw=Path(filename).read_bytes()
  assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,8)[0]==len(raw)
  jl,jtag=struct.unpack_from('<II',raw,12);assert jtag==0x4e4f534a
  self.data=json.loads(raw[20:20+jl]);offset=20+jl
  bl,btag=struct.unpack_from('<II',raw,offset);assert btag==0x004e4942
  self.binary=bytearray(raw[offset+8:offset+8+bl])
 def ref(self,index):
  a=self.data['accessors'][index];v=self.data['bufferViews'][a['bufferView']]
  fmt,nbytes=D[a['componentType']];count=N[a['type']]
  off=v.get('byteOffset',0)+a.get('byteOffset',0)
  stride=v.get('byteStride',nbytes*count)
  return a,off,stride,fmt,count
 def get(self,index):
  a,off,stride,fmt,count=self.ref(index)
  return np.array([struct.unpack_from('<'+fmt*count,self.binary,off+i*stride) for i in range(a['count'])])
 def put(self,index,values):
  a,off,stride,fmt,count=self.ref(index)
  assert values.shape==(a['count'],count)
  if a['componentType']==5121 and a.get('normalized'):
   # Source glTF WEIGHTS_0 is U8 normalized: 255 is 1.0.
   # Quantize each 4-weight row to EXACTLY 255; otherwise skinning
   # collapses toward origin and creates long spikes.
   raw=np.clip(values.astype(float),0,1)*255
   result=np.floor(raw).astype(np.int32)
   remainder=255-result.sum(axis=1)
   decimals=raw-result
   for i in range(len(remainder)):
    for j in np.argsort(-decimals[i],kind='stable')[:int(remainder[i])]:
     result[i,j]+=1
   if not np.all(result.sum(axis=1)==255):
    raise ValueError("Invalid normalized U8 weights")
   values=result
  for i,row in enumerate(values):
   row=[float(x) if fmt=='f' else int(x) for x in row]
   struct.pack_into('<'+fmt*count,self.binary,off+i*stride,*row)
 def save(self,filename):
  self.data['asset'].setdefault('extras',{})['rigRepair']='Experimental rebuilt finger weights from hand mesh; retain original source GLB'
  js=json.dumps(self.data,separators=(',',':'),ensure_ascii=False).encode()
  js+=b' '*((-len(js))%4)
  blob=bytes(self.binary);blob+=b'\0'*((-len(blob))%4)
  output=b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(blob),0x004e4942)+blob
  p=Path(filename);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(output);return len(output)

def local(node):
 if 'matrix' in node:return np.asarray(node['matrix'],float).reshape(4,4).T
 qx,qy,qz,qw=node.get('rotation',[0,0,0,1])
 rot=np.array([[1-2*(qy*qy+qz*qz),2*(qx*qy-qz*qw),2*(qx*qz+qy*qw)],
 [2*(qx*qy+qz*qw),1-2*(qx*qx+qz*qz),2*(qy*qz-qx*qw)],
 [2*(qx*qz-qy*qw),2*(qy*qz+qx*qw),1-2*(qx*qx+qy*qy)]])
 m=np.eye(4);m[:3,:3]=rot@np.diag(node.get('scale',[1,1,1]))
 m[:3,3]=node.get('translation',[0,0,0]);return m

def repair(src,out):
 gl=GLB(src);doc=gl.data;nodes=doc['nodes'];skin=doc['skins'][0]
 joints=skin['joints'];names=[nodes[k]['name'].split(':')[-1] for k in joints]
 if len(joints)!=65 or len(doc['meshes'])!=36:raise ValueError('Not original 65-bone/36-mesh American hero')
 parents={j:i for i,n in enumerate(nodes) for j in n.get('children',[])}
 def world(i):
  m=local(nodes[i])
  return world(parents[i])@m if i in parents else m
 adjustments={};report={}
 for side,mesh_idx in [('Right',21),('Left',22)]:
  prim=doc['meshes'][mesh_idx]['primitives'][0];attr=prim['attributes']
  coords=gl.get(attr['POSITION']).astype(float)
  face=gl.get(prim['indices']).ravel().reshape(-1,3).astype(int)
  base=names.index(side+'Hand')
  prior_j=gl.get(attr['JOINTS_0']);prior_w=gl.get(attr['WEIGHTS_0'])
  if not np.all((prior_j[:,0]==base)&(prior_w[:,0]>.99)):
   raise ValueError('Unexpected source hand weight profile: '+side)
  edges=np.vstack((face[:,[0,1]],face[:,[1,2]],face[:,[2,0]]))
  edges=np.vstack((edges,edges[:,::-1]))
  delta=np.linalg.norm(coords[edges[:,0]]-coords[edges[:,1]],axis=1)
  graph=coo_matrix((delta,(edges[:,0],edges[:,1])),shape=(len(coords),len(coords))).tocsr()
  wrist=world(joints[base])[:3,3]
  seed=np.argmin(np.linalg.norm(coords-wrist,axis=1))
  _,prev=dijkstra(graph,indices=seed,return_predecessors=True)
  near=np.full(len(coords),1e5);belong=np.full(len(coords),-1)
  along=np.zeros(len(coords))
  for j,(name,tip) in enumerate(TIPS.items()):
   tgt=np.array(tip)*([-1,1,1] if side=='Left' else [1,1,1])
   idx=int(np.argmin(np.linalg.norm(coords-tgt,axis=1)))
   path=[idx]
   while path[-1]!=seed:
    p=int(prev[path[-1]])
    if p<0 or len(path)>2000:raise ValueError('Disconnected hand mesh')
    path.append(p)
   curve=coords[path[::-1]]
   cum=np.r_[0,np.cumsum(np.linalg.norm(curve[1:]-curve[:-1],axis=1))]
   u=cum/max(cum[-1],1e-7)
   active=u>=.34
   nearest=cKDTree(curve[active])
   distance,which=nearest.query(coords)
   progress=u[active][which]
   better=distance<near
   near[better]=distance[better];along[better]=progress[better];belong[better]=j
   for k,fraction in enumerate([.59,.77,.92],1):
    p=curve[np.argmin(abs(u-fraction))]
    close=coords[np.linalg.norm(coords-p,axis=1)<.012]
    loc=(p+np.mean(close,axis=0))*.5 if len(close)>=4 else p
    adjustments[side+'Hand'+name+str(k)]=loc
  strength=smooth((along-.35)/.23)*smooth((.023-near)/.014)
  two=smooth((along-.63)/.17);three=smooth((along-.83)/.12)
  new_j=np.full((len(coords),4),base,dtype=np.uint16)
  new_w=np.zeros((len(coords),4),dtype=np.float32)
  new_w[:,0]=1-strength
  counts={}
  for j,name in enumerate(TIPS):
   sel=belong==j
   ids=[names.index(side+'Hand'+name+str(k)) for k in [1,2,3]]
   new_j[sel,1:]=np.array(ids,dtype=np.uint16)
   new_w[sel,1]=strength[sel]*(1-two[sel])
   new_w[sel,2]=strength[sel]*two[sel]*(1-three[sel])
   new_w[sel,3]=strength[sel]*two[sel]*three[sel]
   for bone in ids:
    counts[names[bone]]=int(np.sum(new_w[new_j==bone]>.001))
  if len(counts)!=15 or not all(c>0 for c in counts.values()):
   raise ValueError('Some finger joints remain unweighted: '+str(counts))
  if np.max(abs(new_w.sum(axis=1)-1))>1e-5:raise ValueError('Weights no longer normalised')
  gl.put(attr['JOINTS_0'],new_j);gl.put(attr['WEIGHTS_0'],new_w)
  report[side]={'fingerInfluences':counts,'verticesAffected':int(np.sum(strength>.2))}
 def depth(i):return depth(parents[i])+1 if i in parents else 0
 for name,target in sorted(adjustments.items(),key=lambda item:depth(joints[names.index(item[0])])):
  n=joints[names.index(name)]
  loc=np.linalg.inv(world(parents[n]))@np.r_[target,1.]
  nodes[n]['translation']=loc[:3].tolist()
  # Keep original rotations and the original skeleton hierarchy.
 ib=np.asarray([np.linalg.inv(world(i)).T.reshape(-1) for i in joints],np.float32)
 gl.put(skin['inverseBindMatrices'],ib)
 out_bytes=gl.save(out)
 result={'output':str(out),'bytes':out_bytes,'reconstructedFingerJoints':len(adjustments),
 'originalBones':len(joints),'originalMeshes':len(doc['meshes']),
 'quaterniusClips':[a['name'] for a in doc['animations']], 'hands':report}
 print(json.dumps(result,ensure_ascii=False,indent=2))
 return result

if __name__=='__main__':
 p=argparse.ArgumentParser()
 p.add_argument('--input',default='assets/allied-soldiers/us-hero-quaternius.glb')
 p.add_argument('--output',default='assets/allied-soldiers/us-hero-quaternius-finger-rig-v4.glb')
 a=p.parse_args();repair(a.input,a.output)
