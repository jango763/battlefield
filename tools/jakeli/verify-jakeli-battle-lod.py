#!/usr/bin/env python3
"""Preserve actual approved Jakeli anatomical skin while generating mobile LOD.
Fail closed if simplification damages skeleton, native animations or weights.
"""
import json,struct,sys
from pathlib import Path
SOURCE=Path("assets/allied-soldiers/uk-jakeli-anatomical-v2.glb")
TARGET=Path("assets/allied-soldiers/uk-jakeli-battle-lod1.glb")
def read(path):
 b=path.read_bytes()
 assert b[:4]==b"glTF" and struct.unpack_from("<I",b,8)[0]==len(b),path
 o=12;info=None
 while o<len(b):
  size,kind=struct.unpack_from("<II",b,o);o+=8
  if kind==0x4e4f534a:info=json.loads(b[o:o+size])
  o+=size
 assert info
 return info
def details(obj):
 nodes=obj.get("nodes",[])
 skins=obj.get("skins",[])
 tris=0;skinned=0
 for mesh in obj.get("meshes",[]):
  for prim in mesh.get("primitives",[]):
   if prim.get("mode",4)!=4:raise AssertionError("Expected triangles")
   pos=prim["attributes"].get("POSITION")
   assert pos is not None
   cnt=obj["accessors"][prim["indices"]]["count"] if "indices" in prim else obj["accessors"][pos]["count"]
   tris+=cnt//3
   if "JOINTS_0" in prim["attributes"]:
    assert "WEIGHTS_0" in prim["attributes"]
    skinned+=1
 jointnames=[nodes[n].get("name","") for n in skins[0]["joints"]]
 animationnames=[a.get("name","") for a in obj.get("animations",[])]
 return dict(triangles=tris,skinnedPrimitives=skinned,
  skins=len(skins),bones=len(jointnames),jointnames=jointnames,
  animations=animationnames,meshes=len(obj.get("meshes",[])),
  materials=len(obj.get("materials",[])))
src=details(read(SOURCE));dst=details(read(TARGET))
assert src["skins"]==dst["skins"]==1,("Cannot drop/create skins",src,dst)
assert src["bones"]==dst["bones"]==65,(src["bones"],dst["bones"])
assert src["jointnames"]==dst["jointnames"],("Changed original anatomical joint hierarchy")
assert src["skinnedPrimitives"]>=10 and dst["skinnedPrimitives"]>=10,(src,dst)
for clip in ["Ready","Aim","Fire","Walk","Jog","Sprint"]:
 assert clip in src["animations"] and clip in dst["animations"],(clip,src["animations"],dst["animations"])
assert dst["triangles"]<=65000,(dst["triangles"],"Mobile triangle limit")
assert dst["triangles"]<src["triangles"]*.6,(src["triangles"],dst["triangles"])
assert dst["meshes"]>=10 and dst["materials"]>=5,dst
print("JAKELI_ANATOMICAL_BATTLE_LOD_PASS",json.dumps({
 "originalTriangles":src["triangles"],"optimizedTriangles":dst["triangles"],
 "reductionPercent":round(100*(1-dst["triangles"]/src["triangles"]),2),
 "bones":65,"clips":dst["animations"],"skinned":dst["skinnedPrimitives"],
 "bytes":TARGET.stat().st_size
}))
