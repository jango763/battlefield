#!/usr/bin/env python3
"""One-rifle Blender experiment: put authentic Jakeli geometry on approved German armature.

Only experimental files are created. No edits to the approved German GLB,
existing Jakeli model, four-weapon preview, or main branch.
Run: blender -b -t 2 --python tools/jakeli/blender-rebind-german-armature.py
"""
import bpy
import json
import re
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path.cwd()
SRC=ROOT/"assets/allied-soldiers/uk-jakeli-prototype-65b.glb"
GER=ROOT/"assets/soldiers/german.glb"
OUT=ROOT/"assets/allied-soldiers/uk-jakeli-blender-german-rig-v1.glb"
PROJECT=ROOT/"babylon-qa-results/jakeli-blender-lee/jakeli-lee-rig.blend"
REPORT=ROOT/"babylon-qa-results/jakeli-blender-lee/rebind-report.json"
PROJECT.parent.mkdir(parents=True,exist_ok=True)

def canonical(name):
    name=name.replace("mixamorig:","")
    name=re.sub(r"_\d+$","",name)
    return re.sub("[^a-z0-9]","",name.lower())

def import_group(path):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new=[x for x in bpy.data.objects if x not in before]
    arms=[x for x in new if x.type=="ARMATURE"]
    meshes=[x for x in new if x.type=="MESH"]
    assert len(arms)==1,(path,[x.name for x in arms])
    return arms[0],meshes,new

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
j,meshes_j,objs_j=import_group(SRC)
g,meshes_g,objs_g=import_group(GER)
assert len(meshes_j)>=13 and len(meshes_g)>=4
assert len(j.data.bones)==65 and len(g.data.bones)==65
original_materials={m.name:len(m.material_slots) for m in meshes_j}
jmap={canonical(b.name):b for b in j.data.bones}
gmap={canonical(b.name):b for b in g.data.bones}
common=set(jmap)&set(gmap)
assert len(common)>=48,(len(common),sorted(common))

def world_head(arm,bone):
    return arm.matrix_world @ bone.head_local

# Match the overall German skeleton height to Jakeli, preserving its
# original anatomical local bone axes before editing the rest positions.
scale=(world_head(j,jmap["head"])-world_head(j,jmap["hips"])).length / (
       world_head(g,gmap["head"])-world_head(g,gmap["hips"])).length
assert .005<scale<.05,scale
g.matrix_world=Matrix.Translation(world_head(j,jmap["hips"])-
     world_head(g,gmap["hips"])*scale) @ Matrix.Scale(scale,4) @ g.matrix_world
bpy.context.view_layer.update()

# Rest positions are taken from the real British armature, but the German
# rig's original bone roll/axes remain the target. The German armature
# therefore owns the actual IK chains and finger hierarchy.
targets={key:world_head(j,jmap[key]).copy() for key in common}
bpy.context.view_layer.objects.active=g
bpy.ops.object.mode_set(mode="EDIT")
ed={canonical(b.name):b for b in g.data.edit_bones}
inv=g.matrix_world.inverted()
old_directions={k:(b.tail-b.head).copy() for k,b in ed.items()}
for k in common:
    ed[k].head=inv @ targets[k]
for k in common:
    bone=ed[k]
    # Use the next British joint as the tail whenever possible. It is the
    # correct actual arm/forearm/finger segment length, not a proxy weight.
    child=next((x for x in bone.children if canonical(x.name) in common),None)
    if child:
        target=inv @ targets[canonical(child.name)]
        if (target-bone.head).length>.0001:
            bone.tail=target
            continue
    direction=old_directions[k]
    if direction.length<.001: direction=Vector((0,.5,0))
    bone.tail=bone.head+direction.normalized()*max(.008,direction.length*.70)
for bone in g.data.edit_bones:
    bone.use_connect=False
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.update()

# Preserve all ORIGINAL British geometry, materials, UVs and skin weights.
# Only change their bone GROUP NAMES to match the approved German rig.
# No weight interpolation from incompatible mesh shapes is performed.
renamed=0
unmapped={}
for mesh in meshes_j:
    world=mesh.matrix_world.copy()
    for mod in list(mesh.modifiers):
        if mod.type=="ARMATURE":
            mod.object=g
    if not any(mod.type=="ARMATURE" for mod in mesh.modifiers):
        mod=mesh.modifiers.new("German65Armature","ARMATURE")
        mod.object=g
    for group in list(mesh.vertex_groups):
        key=canonical(group.name)
        target=gmap.get(key)
        if target is None:
            # Donor-only finger/twist channels fall back to the closest
            # approved ancestor; do not create fictional German bones.
            for prefix in ("lefthand","righthand","leftforearm","rightforearm",
                           "leftarm","rightarm","spine","hips"):
                if key.startswith(prefix) and prefix in gmap:
                    target=gmap[prefix];break
        if target is None:
            unmapped[group.name]=unmapped.get(group.name,0)+1
            continue
        if group.name!=target.name:
            # If a duplicate target group exists, merge actual weights.
            other=mesh.vertex_groups.get(target.name)
            if other and other!=group:
                for vertex in mesh.data.vertices:
                    try: w=group.weight(vertex.index)
                    except RuntimeError: continue
                    try: w+=other.weight(vertex.index)
                    except RuntimeError: pass
                    other.add([vertex.index],min(1.,w),"REPLACE")
                mesh.vertex_groups.remove(group)
            else:
                group.name=target.name
            renamed+=1
    if mesh.parent==j:
        mesh.parent=g
        mesh.matrix_world=world

# Delete original donor armature and German meshes, not Jakeli meshes.
for obj in meshes_g:
    bpy.data.objects.remove(obj,do_unlink=True)
bpy.data.objects.remove(j,do_unlink=True)
for obj in list(bpy.data.objects):
    if obj.type=="MESH" and obj not in meshes_j:
        bpy.data.objects.remove(obj,do_unlink=True)
assert len([x for x in bpy.data.objects if x.type=="ARMATURE"])==1
assert len([x for x in bpy.data.objects if x.type=="MESH"])==len(meshes_j)
bpy.context.view_layer.update()

report={
    "prototype":str(SRC),"approvedReference":str(GER),
    "skeleton":"approved German 65 bones, British rest joint positions",
    "commonMappedBones":len(common),"germanBoneCount":len(g.data.bones),
    "jakeliMeshCount":len(meshes_j),"scale":scale,
    "renamedVertexGroups":renamed,"unmappedGroups":unmapped,
    "materialsPreserved":original_materials,
    "status":"experimental, one rifle, visual approval REQUIRED"
}
REPORT.write_text(json.dumps(report,indent=2,ensure_ascii=False))
bpy.ops.wm.save_as_mainfile(filepath=str(PROJECT))
bpy.ops.object.select_all(action="DESELECT")
for obj in meshes_j+[g]:obj.select_set(True)
bpy.context.view_layer.objects.active=g
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format="GLB",
    use_selection=True,export_animations=False,export_skins=True,
    export_materials="EXPORT",export_yup=True)
assert OUT.stat().st_size>500000
print("JAKELI_BLENDER_GERMAN_ARMATURE_EXPERIMENT_CREATED",json.dumps(report,ensure_ascii=False))
print("JAKELI_BLENDER_GLB",str(OUT),OUT.stat().st_size)
