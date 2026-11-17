#!/usr/bin/env python3
"""Experimental donor hands from the EXISTING approved German game asset.
Original US hero and original German GLB remain unchanged.
Keeps 65 US bones, 36 meshes and all four Quaternius animations.
Usage: python3 babylon/tools/build-us-hero-donor-hands.py
Requires numpy/scipy. Visual QA is mandatory. License audit before release.
"""
from __future__ import annotations
import json, struct, re
from pathlib import Path
from collections import defaultdict
from functools import lru_cache
import numpy as np
from scipy.spatial.transform import Rotation

TYPE={5121:'u1',5123:'u2',5125:'u4',5126:'f4'}
DIM={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

class GLB:
 def __init__(self,p):
  buf=Path(p).read_bytes()
  assert buf[:4]==b'glTF' and struct.unpack_from('<I',buf,8)[0]==len(buf),p
  jl,tag=struct.unpack_from('<II',buf,12);assert tag==0x4e4f534a
  self.j=json.loads(buf[20:20+jl]);start=20+jl
  bl,tag=struct.unpack_from('<II',buf,start);assert tag==0x004e4942
  self.b=bytearray(buf[start+8:start+8+bl])
  self.parent={child:i for i,node in enumerate(self.j['nodes']) for child in node.get('children',[])}
 @lru_cache(None)
 def world(self,i):
  n=self.j['nodes'][i];m=np.eye(4)
  if 'matrix' in n:m=np.array(n['matrix']).reshape((4,4),order='F')
  else:
   m[:3,:3]=Rotation.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()@np.diag(n.get('scale',[1,1,1]))
   m[:3,3]=n.get('translation',[0,0,0])
  return self.world(self.parent[i])@m if i in self.parent else m
 def invalidate(self):self.world.cache_clear()
 def accessor(self,i):
  a=self.j['accessors'][i];v=self.j['bufferViews'][a['bufferView']]
  dtype=np.dtype(TYPE[a['componentType']]).newbyteorder('<');width=DIM[a['type']]
  off=v.get('byteOffset',0)+a.get('byteOffset',0)
  stride=v.get('byteStride',dtype.itemsize*width)
  return np.ndarray((a['count'],width),dtype=dtype,buffer=self.b,offset=off,strides=(stride,dtype.itemsize)).copy()
 def replace_accessor(self,i,values):
  a=self.j['accessors'][i];v=self.j['bufferViews'][a['bufferView']]
  dtype=np.dtype(TYPE[a['componentType']]).newbyteorder('<');width=DIM[a['type']]
  assert values.shape==(a['count'],width)
  off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',dtype.itemsize*width)
  view=np.ndarray((a['count'],width),dtype=dtype,buffer=self.b,offset=off,strides=(stride,dtype.itemsize))
  view[:]=values
 def add_accessor(self,values,ctype,shape,normalized=False,with_minmax=False):
  vals=np.asarray(values,dtype=np.dtype(TYPE[ctype]).newbyteorder('<'))
  if vals.ndim==1:vals=vals.reshape(-1,1)
  assert vals.shape[1]==DIM[shape]
  self.b.extend(b'\0'*((-len(self.b))%4));off=len(self.b)
  raw=vals.tobytes(order='C');self.b.extend(raw)
  vindex=len(self.j['bufferViews'])
  self.j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(raw)})
  a={'bufferView':vindex,'componentType':ctype,'count':len(vals),'type':shape}
  if normalized:a['normalized']=True
  if with_minmax:a.update(min=vals.min(axis=0).astype(float).tolist(),
                          max=vals.max(axis=0).astype(float).tolist())
  idx=len(self.j['accessors']);self.j['accessors'].append(a)
  return idx
 def save(self,out):
  self.j['buffers'][0]['byteLength']=len(self.b)
  js=json.dumps(self.j,separators=(',',':'),ensure_ascii=False).encode('utf8')
  js+=b' '*((-len(js))%4)
  raw=bytes(self.b);raw+=b'\0'*((-len(raw))%4)
  total=12+8+len(js)+8+len(raw)
  file=b'glTF'+struct.pack('<II',2,total)+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(raw),0x004e4942)+raw
  Path(out).parent.mkdir(parents=True,exist_ok=True);Path(out).write_bytes(file)
  return len(file)

def key(n):return re.sub(r'_\d+$','',n.replace('mixamorig:','').replace('mixamorig',''))

def build(hero,donor,out,scale=.019):
 a,d=GLB(hero),GLB(donor)
 aj=a.j['skins'][0]['joints'];dj=d.j['skins'][0]['joints']
 an=[key(a.j['nodes'][idx]['name']) for idx in aj]
 dn=[key(d.j['nodes'][idx]['name']) for idx in dj]
 ids={s:i for i,s in enumerate(an)}
 donor_ids={s:i for i,s in enumerate(dn)}
 assert len(aj)==len(dj)==65 and len(a.j['meshes'])==36
 prim=d.j['meshes'][4]['primitives'][0];attr=prim['attributes']
 dp=d.accessor(attr['POSITION']).astype(float)
 normal=d.accessor(attr['NORMAL']).astype(float)
 uv=d.accessor(attr['TEXCOORD_0']).astype(float)
 djs=d.accessor(attr['JOINTS_0']).astype(int)
 dws=d.accessor(attr['WEIGHTS_0']).astype(float)
 faces=d.accessor(prim['indices']).ravel().reshape(-1,3)
 material={'name':'Battlefield_US_Donor_Hands_Skin','doubleSided':True,
  'pbrMetallicRoughness':{'baseColorFactor':[0.78,0.625,0.55,1],
  'metallicFactor':0,'roughnessFactor':0.95}}
 material_idx=len(a.j['materials']);a.j['materials'].append(material)
 all_stats={}
 for side,mesh_index in [('Right',21),('Left',22)]:
  w_a=a.world(aj[ids[side+'Hand']])[:3,3]
  w_d=d.world(dj[donor_ids[side+'Hand']])[:3,3]
  # Both source bind poses use forward +Z, up +Y; do not copy disparate
  # wrist-local bind rotations or the fingers will point toward the sky.
  orient=np.eye(3)
  influenced=np.array([[dn[int(i)].startswith(side+'Hand') for i in row] for row in djs])
  grip_weight=(influenced*dws).sum(axis=1)
  keep_vertex=(grip_weight>.53)&(np.linalg.norm(dp-w_d,axis=1)<14.5)
  triangles=faces[np.all(keep_vertex[faces],axis=1)]
  assert len(triangles)>300, f'{side}: no proper donor palm triangles'
  unique,remapped=np.unique(triangles.ravel(),return_inverse=True)
  pos=w_a+scale*((dp[unique]-w_d)@orient.T)
  nor=normal[unique]@orient.T
  nor/=np.maximum(1e-12,np.linalg.norm(nor,axis=1,keepdims=True))
  tex=uv[unique]
  joints=np.zeros((len(unique),4),np.uint8)
  weights=np.zeros((len(unique),4),np.float32)
  for u,old in enumerate(unique):
   by_joint=defaultdict(float)
   for j,w in zip(djs[old],dws[old]):
    if w<1e-5:continue
    source_name=dn[int(j)]
    name=re.sub(r'Hand(Thumb|Index|Middle|Ring|Pinky)4$',r'Hand\g<1>3',source_name)
    if name not in ids:name=side+'Hand'
    by_joint[ids[name]]+=float(w)
   top=sorted(by_joint.items(),key=lambda x:-x[1])[:4]
   total=sum(w for _,w in top)
   assert total>.99, f'Non-normalized donor weights {side} {u}'
   for k,(j,w) in enumerate(top):joints[u,k]=j;weights[u,k]=w/total
  raw=weights*255
  q=np.floor(raw).astype(np.int32)
  for k,row in enumerate(q):
   extra=255-row.sum()
   for idx in np.argsort(-(raw[k]-row))[:extra]:q[k,idx]+=1
  assert np.all(q.sum(axis=1)==255)
  attributes={
   'POSITION':a.add_accessor(pos.astype(np.float32),5126,'VEC3',with_minmax=True),
   'NORMAL':a.add_accessor(nor.astype(np.float32),5126,'VEC3'),
   'TEXCOORD_0':a.add_accessor(tex.astype(np.float32),5126,'VEC2'),
   'JOINTS_0':a.add_accessor(joints,5121,'VEC4'),
   'WEIGHTS_0':a.add_accessor(q.astype(np.uint8),5121,'VEC4',normalized=True)
  }
  inds=a.add_accessor(remapped.astype(np.uint32),5125,'SCALAR')
  a.j['meshes'][mesh_index]['primitives']=[{
   'attributes':attributes,'indices':inds,'material':material_idx,'mode':4}]
  # Real donor joint positions: retarget only 30 original US phalanges;
  # no new skeleton or extra hand meshes.
  for finger in ('Thumb','Index','Middle','Ring','Pinky'):
   for segment in (1,2,3):
    name=side+'Hand'+finger+str(segment)
    source=d.world(dj[donor_ids[name]])[:3,3]
    target=w_a+scale*(orient@(source-w_d))
    target_node=aj[ids[name]]
    parent=a.parent[target_node]
    local=np.linalg.inv(a.world(parent))@np.r_[target,1.]
    a.j['nodes'][target_node]['translation']=local[:3].tolist()
    a.invalidate()
  all_stats[side]={'donorTriangles':len(triangles),'donorVertices':len(unique),
   'newHandBounds':[pos.min(axis=0).round(3).tolist(),pos.max(axis=0).round(3).tolist()]}
 inverse_binds=np.array([np.linalg.inv(a.world(node)).T.reshape(-1) for node in aj],dtype=np.float32)
 a.replace_accessor(a.j['skins'][0]['inverseBindMatrices'],inverse_binds)
 a.j['asset'].setdefault('extras',{})['experimentalHandSwap']='Existing approved German donor hands on American original; artistic QA and license audit required'
 count=a.save(out)
 result={'bytes':count,'meshes':len(a.j['meshes']),'joints':len(aj),
 'animations':[x['name'] for x in a.j['animations']], 'hands':all_stats}
 print(json.dumps(result,ensure_ascii=False,indent=2))
 return result

if __name__=='__main__':
 build('assets/allied-soldiers/us-hero-quaternius.glb',
       'assets/soldiers/german.glb',
       'assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb')
