#!/usr/bin/env python3
"""Recover the existing WW2 Panzergrenadier GLB from the original HTML.
Keep bytes identical; don't alter the model, materials or UVs.
"""
from pathlib import Path
import base64, json, re, struct, hashlib

source=Path('preview/animation-v1.html').read_text('utf-8')
print('SOURCE_HTML_CHARS',len(source))
# The original project stores the GLB directly in a script tag.
tags=list(re.finditer(r'<script\b([^>]*)>([\s\S]*?)</script\s*>',source,re.IGNORECASE))
print('SCRIPT_TAG_COUNT',len(tags))
print('SCRIPT_IDS',[(re.search(r'\bid=["\']([^"\']+)',m.group(1),re.I) or ['-'])[-1] for m in tags if 'german' in m.group(1).lower() or 'glb' in m.group(1).lower()])
candidates=[]
for m in tags:
  tag=m.group(1);body=m.group(2).strip()
  if 'preview-german-glb' in tag or ('octet-stream' in tag and len(body)>50000):
    candidates.append(body)
if not candidates:
  # The original test HTML also keeps the binary as a long JS base64 string.
  # Pick only candidates that decode to the GLB magic and declared length.
  raw_matches=list(re.finditer(r'[A-Za-z0-9+/]{50000,}={0,2}',source))
  print('LONG_BASE64_CANDIDATES',[(len(m.group(0)),m.start()) for m in raw_matches[:20]])
  candidates.extend(m.group(0) for m in raw_matches)
if not candidates:
  print('GLB_KEY_CONTEXT',source[max(0,source.find('preview-german-glb')-250):source.find('preview-german-glb')+600] if 'preview-german-glb' in source else 'not found')
  print('LONG_SCRIPTS',[(m.group(1)[:110],len(m.group(2))) for m in tags if len(m.group(2))>100000])
  raise SystemExit('No embedded WW2 GLB script tag found')
for k,body in enumerate(candidates):
  try: data=base64.b64decode(re.sub(r'\s+','',body),validate=True)
  except Exception as e:
    print('BASE64_DECODE_ERROR',k,str(e));continue
  print('CANDIDATE',k,'bytes',len(data),'magic',data[:4])
  if data[:4]==b'glTF':
    declared=struct.unpack_from('<I',data,8)[0]
    assert declared==len(data),(declared,len(data))
    json_length,json_kind=struct.unpack_from('<I4s',data,12)
    assert json_kind==b'JSON'
    gltf=json.loads(data[20:20+json_length])
    mesh_count=len(gltf.get('meshes',[]));bones=len(gltf.get('skins',[{}])[0].get('joints',[]))
    print('GLB_META',json.dumps({'meshes':mesh_count,'skins':len(gltf.get('skins',[])),'skinJoints':bones,
       'animations':len(gltf.get('animations',[])),'materials':len(gltf.get('materials',[])),
       'images':len(gltf.get('images',[])),'license':gltf.get('asset',{}).get('extras',{}).get('license'),
       'sha256':hashlib.sha256(data).hexdigest()}))
    dest=Path('lab/original-panzergrenadier/panzergrenadier-original.glb')
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(data)
    print('EXTRACT_OK',dest,len(data))
    break
else:raise SystemExit('Found candidate scripts but none is a GLB')
