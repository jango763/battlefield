#!/usr/bin/env python3
"""Fetch historically plausible European CC0 GLB village props from tevy.dev.
No runtime CDN. Only named, pinned versions; inspect glTF extensions.
CC0 license: https://tevy.dev/models (as published by model author).
"""
import json,struct,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'art'/'models'
FILES={
 'normandy-timber-house':('timber-frame-house','v1'),
 'normandy-hay-barn':('hay-barn','v2'),
 'village-church':('village-church','v2'),
}
def main():
 ROOT.mkdir(parents=True,exist_ok=True)
 manifest={'origin':'https://tevy.dev/models','license':'CC0 1.0','models':{}}
 for key,(slug,version) in FILES.items():
  uri=f'https://tevy.dev/models/{slug}/{version}/lod0.glb'
  req=urllib.request.Request(uri,headers={'User-Agent':'Battlefield-WWII-CC0-Assets/1.0'})
  with urllib.request.urlopen(req,timeout=70) as result:
   data=result.read(12_000_001)
  if len(data)>12_000_000 or len(data)<1024 or data[:4]!=b'glTF':
   raise RuntimeError('GLB validation failed '+uri)
  magic,ver,length=struct.unpack('<4sII',data[:12])
  if ver!=2 or length!=len(data): raise RuntimeError('Invalid GLB v2 header '+uri)
  chunk_len,chunk_type=struct.unpack('<I4s',data[12:20])
  if chunk_type!=b'JSON':raise RuntimeError('No GLB JSON chunk '+uri)
  info=json.loads(data[20:20+chunk_len])
  output=ROOT/(key+'.glb')
  output.write_bytes(data)
  manifest['models'][key]={
   'source':uri,'assetPage':f'https://tevy.dev/models/{slug}',
   'file':output.name,'bytes':len(data),
   'extensionsUsed':info.get('extensionsUsed',[]),
   'meshes':len(info.get('meshes',[])),
   'materials':len(info.get('materials',[]))
  }
  print('VILLAGE_CC0_MODEL',key,len(data),manifest['models'][key]['extensionsUsed'])
 (ROOT/'SOURCE_LICENSES.json').write_text(json.dumps(manifest,indent=2)+'\n')
if __name__=='__main__':main()
