#!/usr/bin/env python3
"""Distinct, independently authored British Commando proof-of-concept.

NO Jakeli body surfaces are exported: Jakeli anatomical weapon rig is only
the technical skeleton / Quaternius / grip donor. This is an original stylized
1944 Commando with a dark-green beret, battledress, webbing and gaiters.
Not an artist-approved replacement for the previously shortlisted Fab model.
"""
import bpy, json, math, os
from pathlib import Path
from mathutils import Vector, Quaternion
ROOT=Path(__file__).resolve().parents[2]
WEAPON=os.environ.get("COMMANDO_WEAPON","uk-sten")
FILES={"uk-lee-enfield":"uk-jakeli-anatomical-v2.glb",
       "uk-sten":"uk-jakeli-anatomical-sten.glb",
       "uk-bren":"uk-jakeli-anatomical-bren.glb",
       "uk-piat":"uk-jakeli-anatomical-piat.glb"}
assert WEAPON in FILES,WEAPON
OUT=ROOT/"assets/allied-soldiers"/("uk-commando-"+WEAPON.removeprefix("uk-")+"-prototype.glb")
SRC=ROOT/"assets/allied-soldiers"/FILES[WEAPON]
assert SRC.is_file(),("Missing approved anatomical motion donor",SRC)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SRC))
rigs=[o for o in bpy.data.objects if o.type=="ARMATURE"]
assert len(rigs)==1,("Commando source must have one skeleton",len(rigs))
rig=rigs[0];assert len(rig.data.bones)==65
names={b.name for b in rig.data.bones}
def find(n):
    matches=[b for b in rig.data.bones if b.name.endswith(n)]
    assert len(matches)==1,("Bone lookup",n,[b.name for b in matches])
    return matches[0]
old=[o for o in bpy.data.objects if o.type=="MESH" and any(m.type=="ARMATURE" for m in o.modifiers)]
assert len(old)>=13,len(old)
for o in old:bpy.data.objects.remove(o,do_unlink=True)
new=[]
def mat(label,rgb,metal=0,rough=.94):
    m=bpy.data.materials.new(label);m.diffuse_color=(*rgb,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get("Principled BSDF")
    if bs:
        bs.inputs["Base Color"].default_value=(*rgb,1)
        bs.inputs["Roughness"].default_value=rough
        bs.inputs["Metallic"].default_value=metal
    return m
cloth=mat("Commando olive drab battledress",(.24,.26,.16))
cloth2=mat("Commando jacket fold shadows",(.16,.19,.115))
trousers=mat("Commando brown trousers",(.27,.25,.185))
web=mat("P37 light khaki webbing",(.55,.48,.31))
webdark=mat("P37 buckle leather",(.26,.18,.115))
skin=mat("Commando individual face",(.54,.34,.23))
shadow=mat("Hair and brow",(.095,.065,.049))
beret=mat("Commando dark green beret",(.055,.20,.12))
beretband=mat("Commando beret edge",(.034,.11,.075))
black=mat("Commandos dark boots",(.065,.070,.058))
metal=mat("Commando dull steel details",(.27,.31,.26),.32,.55)
red=mat("Commando embroidered badge",(.37,.095,.095))
eye=mat("Commando eye",(.025,.027,.023))
def pos(name):
    return rig.matrix_world@find(name).head_local
def add_mesh(label,material,bone,obj):
    obj.name="Commando_"+label
    obj.data.materials.append(material)
    obj.rotation_mode="QUATERNION"
    group=obj.vertex_groups.new(name=find(bone).name)
    group.add(list(range(len(obj.data.vertices))),1.0,"REPLACE")
    mod=obj.modifiers.new("Commando65",type="ARMATURE");mod.object=rig
    new.append(obj)
    return obj
def ell(label,bone,center,size,material,segments=12,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=center)
    o=bpy.context.object;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return add_mesh(label,material,bone,o)
def box(label,bone,center,size,material,bev=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bev>0:
        b=o.modifiers.new("Soft edges",type="BEVEL");b.width=bev;b.segments=2
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
    return add_mesh(label,material,bone,o)
def along(label,bone,a,b,diamA,diamB,material,vertices=12):
    a,b=Vector(a),Vector(b);diff=b-a
    assert diff.length>1e-4,(label,a,b)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=diamA,radius2=diamB,depth=diff.length,location=(a+b)*.5)
    o=bpy.context.object;o.rotation_mode="QUATERNION"
    o.rotation_quaternion=Vector((0,0,1)).rotation_difference(diff.normalized())
    return add_mesh(label,material,bone,o)
def bone_link(label,boneA,boneB,thicknessA,thicknessB,material):
    a,b=pos(boneA),pos(boneB)
    return along(label,boneA,a,b,thicknessA,thicknessB,material)
hips=pos("Hips");s1=pos("Spine1");s2=pos("Spine2")
# Original Commando cut: boxy cropped jacket over raised, loose P37 trousers,
# dark contrast epaulettes, covered leggings and distinctive load bearing gear.
ell("battledress body","Spine1",(hips+s2)*.5+Vector((0,0,.025)),(.244,.147,.305),cloth,16,12)
ell("jacket waist","Spine1",(hips+s1)*.5,(.225,.145,.103),cloth2,16,8)
ell("front yoke","Spine2",s2+Vector((0,-.109,-.015)),(.227,.053,.127),cloth,16,8)
ell("waist belt","Hips",hips+Vector((0,0,.105)),(.220,.158,.045),webdark,16,8)
box("belt square buckle","Hips",hips+Vector((0,-.155,.11)),(.051,.018,.040),metal)
for side in ("Left","Right"):
    sign=1 if side=="Left" else -1
    def p(n):return pos(side+n)
    # Solid garment with two deforming segments, plus generous overlapping cuffs.
    bone_link(side+" upper sleeve",side+"Arm",side+"ForeArm",.092,.075,cloth)
    bone_link(side+" rolled cuff",side+"ForeArm",side+"Hand",.072,.055,cloth2)
    ell(side+" shoulder seam",side+"Arm",p("Arm"),(.107,.098,.085),cloth,12,8)
    ell(side+" hand glove",side+"Hand",p("Hand"),(.064,.038,.039),webdark,12,8)
    for digit in ("Thumb","Index","Middle","Ring","Pinky"):
        for seg in range(1,4):
            name=side+"Hand"+digit+str(seg)
            nextBone=find(name)
            a=rig.matrix_world@nextBone.head_local;b=rig.matrix_world@nextBone.tail_local
            if (b-a).length>.002:
                along(side+" "+digit+str(seg),name,a,b,.012,.008,webdark,8)
    bone_link(side+" baggy upper trouser",side+"UpLeg",side+"Leg",.133,.112,trousers)
    bone_link(side+" knee breeches",side+"Leg",side+"Foot",.108,.074,trousers)
    ell(side+" knee gathered fold",side+"Leg",p("Leg"),(.119,.111,.080),cloth2,12,8)
    foot=p("Foot")
    ell(side+" gaiter",""+side+"Foot",foot+Vector((0,0,.069)),(.091,.085,.119),web,12,8)
    ell(side+" heavy boot",side+"Foot",foot+Vector((0,-.055,-.021)),(.100,.163,.064),black,12,8)
    ell(side+" boot toe",side+"Foot",foot+Vector((0,-.13,-.036)),(.096,.095,.043),black,12,8)
    # Distinct padded P37 ammunition pouch.
    box(side+" ammo pouch","Hips",hips+Vector((sign*.205,-.12,.05)),(.087,.091,.110),web)
    box(side+" pouch flap","Hips",hips+Vector((sign*.206,-.177,.096)),(.094,.020,.044),webdark)
    # Commando shoulder insignia, original geometry, not Jakeli's skin.
    arm=p("Arm");ell(side+" epaulette",side+"Arm",arm+Vector((0,0,.042)),(.095,.077,.025),webdark)
    ell(side+" unit flash",side+"Arm",arm+Vector((0,-.09,-.012)),(.065,.013,.034),red,10,6)
head=pos("Head");neck=pos("Neck")
ell("neck scarf","Neck",neck+Vector((0,0,.01)),(.092,.079,.059),cloth2)
ell("distinct face","Head",head+Vector((0,-.012,.085)),(.111,.095,.145),skin,16,12)
ell("short dark hair","Head",head+Vector((0,.019,.172)),(.106,.093,.077),shadow,16,8)
for sign,side in ((1,"L"),(-1,"R")):
    ell(side+" ear","Head",head+Vector((sign*.111,.012,.09)),(.023,.028,.043),skin,10,6)
    ell(side+" brow","Head",head+Vector((sign*.048,-.095,.131)),(.044,.014,.011),shadow,10,6)
    ell(side+" eye","Head",head+Vector((sign*.045,-.104,.111)),(.012,.008,.008),eye,8,6)
ell("nose","Head",head+Vector((0,-.105,.081)),(.024,.029,.039),skin,10,6)
ell("chin","Head",head+Vector((0,-.056,-.027)),(.060,.049,.036),skin,10,6)
# The commandos' dark green slouch beret: a broad irregular crown to the left,
# not the round Brodie/MkII helmet from an ordinary infantryman.
ell("beret leather band","Head",head+Vector((0,0,.194)),(.117,.108,.033),beretband,16,8)
ell("beret flattened crown","Head",head+Vector((-.034,.008,.244)),(.149,.114,.047),beret,20,10)
ell("beret tilted flap","Head",head+Vector((-.063,.017,.222)),(.134,.101,.023),beret,16,8)
box("beret commando badge","Head",head+Vector((.088,-.084,.212)),(.018,.014,.029),metal,.002)
# Crossed khaki load-bearing straps and a pack make this silhouette distinct
# from Jakeli's standard infantry kit.
for sign in (1,-1):
    a=s2+Vector((sign*.161,-.139,.073));b=hips+Vector((-sign*.10,-.15,.11))
    along("crossed P37 strap"+str(sign),"Spine2",a,b,.021,.020,web,8)
box("back assault pack","Spine1",(s1+s2)*.5+Vector((0,.184,.018)),(.295,.105,.280),web)
box("pack upper roll","Spine2",s2+Vector((0,.207,.118)),(.305,.099,.066),cloth2)
box("canteen","Hips",hips+Vector((-.14,.137,.06)),(.095,.094,.130),webdark)
box("commando assault knife sheath","Hips",hips+Vector((.135,.12,-.012)),(.030,.043,.174),webdark)
box("collar left","Spine2",s2+Vector((-.085,-.139,.085)),(.110,.041,.061),cloth2)
box("collar right","Spine2",s2+Vector((.085,-.139,.085)),(.110,.041,.061),cloth2)
assert len(new)>40,len(new)
# Join by appearance/material for mobile draw calls, preserving each bone's
# separate vertex group, without altering source animation or weapon links.
bpy.ops.object.select_all(action="DESELECT")
# Do not join unlike materials: blender importer retains many submeshes.
# Keep separate skinned pieces first; QA verifies skinning and movement.
for mesh in new:
    assert mesh.type=="MESH" and any(m.type=="ARMATURE" for m in mesh.modifiers)
for obj in bpy.data.objects:
    if obj.type=="MESH" and obj not in new and any(m.type=="ARMATURE" for m in obj.modifiers):
        raise AssertionError("Original Jakeli mesh leaked into commando export")
for obj in bpy.data.objects:
    if obj.animation_data:
        for tr in obj.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action="DESELECT")
for obj in list(new)+[rig]+[o for o in bpy.data.objects if o.type=="MESH" and o not in new]+[o for o in bpy.data.objects if o.type=="EMPTY"]:
    obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format="GLB",use_selection=True,
  export_animations=True,export_animation_mode="NLA_TRACKS",export_skins=True,
  export_yup=True,export_force_sampling=True,export_anim_slide_to_zero=True)
assert OUT.is_file() and OUT.stat().st_size>100000
report={"source":"original procedural British Commando 1944 concept, NOT Jakeli mesh",
        "notApproved":True,"weapon":WEAPON,"rigSource":SRC.name,
        "commandoMeshes":len(new),"rigBones":len(rig.data.bones),"sourceMeshesCopied":0,
        "outputBytes":OUT.stat().st_size}
print("COMMANDO_ORIGINAL_PROTOTYPE",json.dumps(report))
