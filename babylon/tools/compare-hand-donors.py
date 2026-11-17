#!/usr/bin/env python3
"""Compare existing Battlefield GLB assets for usable fully skinned hands (no edits)."""
import json,struct,sys
from collections import Counter
from pathlib import Path

def inspect(path):
 raw=Path(path).read_bytes()
 json_len=struct.unpack_from('<I',raw,12)[0]
 root=json.loads(raw[20:20+json_len])
 data=raw[28+json_len:]
 nodes=root.get('nodes',[])
 skins=root.get('skins',[])
 meshes=root.get('meshes',[])
 out={'path':path,'bytes':len(raw),'meshes':len(meshes),'skins':len(skins),
      'animations':[x.get('name') for x in root.get('animations',[])]}
 all_counts=Counter()
 finger_keys=[]
 for skin_index,sk in enumerate(skins):
  bones=[nodes[i].get('name','') for i in sk['joints']]
  for name in bones:
   n=name.lower()
   if any(t in n for t in ['index','middle','ring','pinky','thumb','finger']):
    finger_keys.append(name)
  for node in nodes:
   if node.get('skin')!=skin_index:continue
   if 'mesh' not in node:continue
   mesh=meshes[node['mesh']]
   for prim in mesh['primitives']:
    attr=prim['attributes']
    if 'JOINTS_0' not in attr or 'WEIGHTS_0' not in attr:continue
    for key in ('JOINTS_0','WEIGHTS_0'):
     a=root['accessors'][attr[key]]
     v=root['bufferViews'][a['bufferView']]
     fmt={5121:'B',5123:'H',5125:'I',5126:'f'}.get(a['componentType'])
     n=a['count']
     width=4
     begin=v.get('byteOffset',0)+a.get('byteOffset',0)
     stride=v.get('byteStride',struct.calcsize('<'+fmt*4))
     if key=='JOINTS_0':indices=[struct.unpack_from('<'+fmt*4,data,begin+i*stride) for i in range(n)]
     else: weights=[struct.unpack_from('<'+fmt*4,data,begin+i*stride) for i in range(n)]
    for js,ws in zip(indices,weights):
     for ji,w in zip(js,ws):
      if w>0 and ji<len(bones):all_counts[bones[ji]]+=1
  out['skin'+str(skin_index)]={'boneCount':len(bones),'sampleBones':bones[:15],
      'fingerBones':len([b for b in bones if b in finger_keys])}
 out['fingerSamples']={k:v for k,v in all_counts.items() if k in finger_keys}
 out['fingerJointsWithVertices']=len(out['fingerSamples'])
 return out
for arg in sys.argv[1:]:
 try:print(json.dumps(inspect(arg),ensure_ascii=False))
 except Exception as e:print(json.dumps({'path':arg,'error':str(e)}))
