#!/usr/bin/env python3
"""Inspect the real, licensed 3D soldier source before any commando retarget.
Source: cktang88/3d-fps (CC BY 4.0 DanlyVostok model).
This tool READS the incoming asset. No procedural dummy geometry.
"""
import json,struct,sys,hashlib
from pathlib import Path
p=Path(sys.argv[1])
b=p.read_bytes()
assert b[:4]==b'glTF' and struct.unpack_from('<I',b,8)[0]==len(b)
o=12
parts={}
while o<len(b):
 size,kind=struct.unpack_from('<II',b,o);o+=8
 parts[kind]=b[o:o+size];o+=size
j=json.loads(parts[0x4e4f534a])
nodes=j.get('nodes',[]);meshes=j.get('meshes',[])
skins=j.get('skins',[]);animations=j.get('animations',[])
out={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),
 'mesh_count':len(meshes),'node_count':len(nodes),'skin_count':len(skins),
 'skins':[[nodes[n].get('name','') for n in s.get('joints',[])] for s in skins],
 'materials':[m.get('name','') for m in j.get('materials',[])],
 'textures':len(j.get('textures',[])),'images':len(j.get('images',[])),
 'animations':[x.get('name') for x in animations],
 'nodes':[{'name':n.get('name'),'mesh':n.get('mesh'),'skin':n.get('skin'),
  'translation':n.get('translation'),'scale':n.get('scale')}
  for n in nodes if 'mesh' in n or 'skin' in n],
 'meshes':[
 {'name':m.get('name'),'primitives':len(m['primitives']),
  'vertex_counts':[j['accessors'][k['attributes']['POSITION']]['count'] for k in m['primitives']],
  'uv_counts':[j['accessors'][k['attributes']['TEXCOORD_0']]['count'] if 'TEXCOORD_0' in k['attributes'] else 0 for k in m['primitives']],
  'rigged':[('JOINTS_0' in k['attributes'] and 'WEIGHTS_0' in k['attributes']) for k in m['primitives']]}
  for m in meshes]
 }
outp=Path('babylon-qa-results/commando-real-source');outp.mkdir(parents=True,exist_ok=True)
(outp/'inventory.json').write_text(json.dumps(out,indent=2))
print('COMMANDO_REAL_SOURCE_INVENTORY',json.dumps(out)[:14000])
assert len(meshes)>=1 and sum(sum(m['vertex_counts']) for m in out['meshes'])>2000
assert len(j.get('materials',[]))>0 and len(j.get('images',[]))>0
