#!/usr/bin/env python3
"""Extract EXACT credited Panzergrenadier GLB from seven existing JS chunks.
No reskinning, remodeling, mesh edits or texture conversion.
"""
from pathlib import Path
import base64,hashlib,json,re,struct
segments=[]
for i in range(1,8):
 path=Path('preview/german-data-%02d.js'%i)
 source=path.read_text('utf-8')
 m=re.search(r'\.push\("([A-Za-z0-9+/=]+)"\)',source)
 if not m:raise SystemExit('Missing original German GLB segment '+str(path))
 segments.append(m.group(1))
b64=''.join(segments)
data=base64.b64decode(b64,validate=True)
assert data[:4]==b'glTF','Original German GLB magic invalid'
assert struct.unpack_from('<I',data,8)[0]==len(data),'Incomplete source GLB'
n,kind=struct.unpack_from('<I4s',data,12)
assert kind==b'JSON'
gltf=json.loads(data[20:20+n])
skins=gltf.get('skins',[])
counts=[len(s.get('joints',[])) for s in skins]
mcount=len(gltf.get('meshes',[]))
print('ORIGINAL_WW2_MODEL',json.dumps({'meshCount':mcount,'skins':counts,
'textures':len(gltf.get('textures',[])),'images':len(gltf.get('images',[])),
'materials':len(gltf.get('materials',[])),'animations':len(gltf.get('animations',[])),
'license':gltf.get('asset',{}).get('extras',{}).get('license'),
'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}))
assert skins and max(counts)>=60 and mcount>=4, 'GLB is not the original skinned Panzergrenadier'
out=Path('lab/original-panzergrenadier/panzergrenadier-original.glb')
out.parent.mkdir(parents=True,exist_ok=True)
out.write_bytes(data)
print('EXTRACT_OK',out,len(data))
