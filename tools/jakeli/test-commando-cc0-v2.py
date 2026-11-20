#!/usr/bin/env python3
"""Gate actual CC0 mesh Commando against a dummy/proxy or invalid 65-bone export."""
import json,struct,os
from pathlib import Path
p=Path('assets/allied-soldiers/uk-commando-cc0-sten-v2.glb')
assert p.exists()
b=p.read_bytes()
assert b[:4]==b'glTF' and struct.unpack_from('<I',b,8)[0]==len(b)
a=12;doc=None
while a<len(b):
 n,t=struct.unpack_from('<II',b,a);a+=8
 if t==0x4e4f534a:doc=json.loads(b[a:a+n])
 a+=n
assert doc
nodes=doc['nodes'];meshes=doc['meshes'];skins=doc.get('skins',[])
assert len(skins)==1,(len(skins),'extra skeleton')
assert len(skins[0]['joints'])==65,('bad rig',len(skins[0]['joints']))
names={x.get('name','') for x in nodes}
assert any('Soldier' in n for n in names),('missing original body',list(names)[:35])
assert 'BritishCommandoGreenBeret' in names
assert 'CommandoBeretWoolBand' in names
assert 'CommandoBeretInsignia' in names
assert not any('Jakeli_' in n or 'Pants_004' in n for n in names)
skinmeshes=[n for n in nodes if n.get('skin') is not None and n.get('mesh') is not None]
assert len(skinmeshes)>=3,('Beret or source FBX skin not exported',len(skinmeshes))
verts=sum(doc['accessors'][k['attributes']['POSITION']]['count']
 for m in meshes for k in m['primitives'] if 'POSITION' in k['attributes'])
assert verts>4000,('no full mesh or tiny dummy',verts)
assert len(doc.get('materials',[]))>=6
clips={a['name'] for a in doc.get('animations',[])}
assert {'Ready','Aim','Fire','Walk','Jog','Sprint'} <= clips,clips
for clip in ['Walk','Jog','Sprint']:
 a=next(x for x in doc['animations'] if x['name']==clip)
 targets=[nodes[x['target']['node']].get('name','') for x in a['channels'] if x['target']['path']=='rotation']
 assert any('LeftUpLeg' in n for n in targets),('motion absent',clip)
 assert any('RightUpLeg' in n for n in targets),('motion absent',clip)
print('COMMANDO_CC0_REAL_GLTF_PASS',json.dumps({'bytes':len(b),'meshes':len(meshes),
 'skinnedNodes':len(skinmeshes),'vertices':verts,'bones':len(skins[0]['joints']),
 'clips':sorted(clips),'materials':len(doc.get('materials',[])),'visualApproval':False}))
