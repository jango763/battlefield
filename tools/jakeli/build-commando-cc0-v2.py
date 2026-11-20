#!/usr/bin/env python3
"""Rebuild authentic CC0 WW2 soldier surfaces as British Commando.
No mannequin meshes, no Jakeli body surface: full FBX cloth/head/hands retained.
Base model by nisu, OpenGameArt, CC0:
https://opengameart.org/content/rigged-lowpoly-ww2-soldier
Animation / four-weapon technical donor is our verified Jakeli rig;
this prototype begins with one Sten weapon and all six original clips.
"""
import bpy, math, os, json
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'babylon-qa-results/commando-ww2-source/files/LowpolySoldier/LowpolySoldier.fbx'
IMAGE=SRC.with_name('LowpolySoldier_Texture.png')
DONOR=ROOT/'assets/allied-soldiers/uk-jakeli-anatomical-sten.glb'
OUT=ROOT/'assets/allied-soldiers/uk-commando-cc0-sten-v2.glb'
QA=ROOT/'babylon-qa-results/commando-cc0-v2';QA.mkdir(parents=True,exist_ok=True)
assert SRC.exists() and IMAGE.exists() and DONOR.exists()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(SRC))
source=[o for o in bpy.data.objects if o.type=='ARMATURE']
assert len(source)==1,('Source native FBX armature',len(source))
rig=source[0]
body=[o for o in bpy.data.objects if o.type=='MESH']
assert any('Soldier' in o.name for o in body)
# Keep the actual full body UV cloth/hands/face geometry and native skin weights.
helmets=[o for o in body if 'Helmet' in o.name]
assert len(helmets)==1
helm=helmets[0]
headdata=[rig.matrix_world@Vector(p) for p in helm.bound_box]
center=sum(headdata,Vector())/len(headdata)
helm_size=Vector(tuple(max(p[i] for p in headdata)-min(p[i] for p in headdata) for i in range(3)))
bpy.data.objects.remove(helm,do_unlink=True)
body=[o for o in body if o!=helm]
assert len(body)==1
mesh=body[0]
assert len(mesh.data.vertices)>=2600
# New clothing materials. The FBX UV atlas is predominantly unlit black and has
# warm skin islands: keep the actual skin texels, classify jacket/boots/trousers
# by face position so commandos do not render as a flat white untextured shell.
def material(name,rgb,metal=0,rough=.92):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1)
 m.use_nodes=True;node=m.node_tree.nodes.get('Principled BSDF')
 node.inputs['Base Color'].default_value=(*rgb,1)
 node.inputs['Metallic'].default_value=metal
 node.inputs['Roughness'].default_value=rough
 return m
skin=material('Commando CC0 human skin',(.72,.45,.29))
jacket=material('Commando British brown-green battledress',(.29,.31,.20))
jacketfold=material('Commando shaded khaki coat',(.23,.27,.17))
trouser=material('Commando British olive-brown trousers',(.35,.32,.21))
boots=material('Commando brown-black ankle boots',(.095,.088,.074))
webbing=material('Commando 1937 pattern khaki webbing',(.54,.49,.32))
clothdark=material('Commando dark green beret felt',(.046,.16,.10))
clothrim=material('Commando dark rolled beret edge',(.035,.095,.070))
dullsteel=material('Commando subdued metal badge',(.55,.56,.49),.32,.65)
black=material('Commando dark beard and brows',(.09,.075,.058))
# Blending skin based on UV + position keeps the full original face/hands,
# while changing the uniform color, not re-creating it with spheres or cubes.
atlas=bpy.data.images.load(str(IMAGE),check_existing=True)
pix=atlas.pixels;W,H=atlas.size
uv=mesh.data.uv_layers.active
assert uv and len(uv.data)==len(mesh.data.loops),('FBX UV atlas missing')
mesh.data.materials.clear()
materials=[skin,jacket,jacketfold,trouser,boots,webbing,black]
for m in materials:mesh.data.materials.append(m)
region_counts={m.name:0 for m in materials}
for poly in mesh.data.polygons:
 v=[mesh.data.vertices[i].co for i in poly.vertices]
 p=sum(v,Vector())/len(v)
 # FBX vertex body positions are in metres and neutral pose at origin.
 i=poly.loop_start
 u,vv=uv.data[i].uv
 ix=min(W-1,max(0,int((u%1)*W)));iy=min(H-1,max(0,int((vv%1)*H)))
 idx=4*(iy*W+ix)
 red,green,blue=pix[idx],pix[idx+1],pix[idx+2]
 warm=(red>.52 and green>.2 and red>green*1.19 and green>blue*.92)
 if warm or (p.z>1.45 and abs(p.x)<.15 and p.y<.03):
  choice=skin
 elif p.z<.24:choice=boots
 elif p.z<.85:choice=trouser
 elif p.z>1.30 and abs(p.x)>.38:choice=jacketfold
 elif p.z>=1.05 and p.y<-.07 and abs(p.x)<.23:choice=webbing
 elif p.z>1.10:choice=jacket
 else:choice=jacketfold
 poly.material_index=materials.index(choice)
 region_counts[choice.name]+=1
assert sum(region_counts.values())==len(mesh.data.polygons)
# Sculpted sewable British green beret (CC0 origin), with continuous fitted
# radius rings and soft droop, 5 profile rings, not a stack of spheres.
def beret(name,origin,radius=.12,material=clothdark):
 verts=[];faces=[]
 rings=9;segments=40
 for ring in range(rings):
  t=ring/(rings-1)
  r=radius*(.90 + .45*math.sin(math.pi*t))*(1-.30*t**5)
  z=origin.z + .010 + .038*t+ .020*math.sin(math.pi*t)
  sx=origin.x-.024*t
  sy=origin.y+.010*t
  for k in range(segments):
   angle=2*math.pi*k/segments
   droop=.015*math.sin(angle+.5)*t
   verts.append((sx+r*math.cos(angle),sy+r*.80*math.sin(angle),z+droop))
 for ring in range(rings-1):
  for k in range(segments):
   n=ring*segments+k; nxt=ring*segments+(k+1)%segments
   faces.append((n,nxt,nxt+segments,n+segments))
 faces.append(tuple(range((rings-1)*segments,rings*segments))[::-1])
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
 data.materials.append(material)
 for face in data.polygons:face.use_smooth=True
 return obj
beret_center=center+Vector((0,-.01,.025))
cap=beret('BritishCommandoGreenBeret',beret_center,radius=max(.096,min(.137,helm_size.x*.54)))
# Fitted rolled band as a toroidal seam with raised fabric, not an angular ring.
segments=40;v=[];f=[]
for zoff,r in [(0,.103),(.017,.105),(.025,.095)]:
 for i in range(segments):
  a=2*math.pi*i/segments
  v.append((beret_center.x+r*math.cos(a),beret_center.y+.8*r*math.sin(a),beret_center.z+zoff))
for j in range(2):
 for k in range(segments):
  a=j*segments+k;b=j*segments+(k+1)%segments
  f.append((a,b,b+segments,a+segments))
dt=bpy.data.meshes.new('Commando beret seam');dt.from_pydata(v,[],f);dt.update()
band=bpy.data.objects.new('CommandoBeretWoolBand',dt);bpy.context.collection.objects.link(band);dt.materials.append(clothrim)
# Historic subdued unit insignia on one side of beret.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.015,location=beret_center+Vector((.102,-.037,.028)))
badge=bpy.context.object;badge.name='CommandoBeretInsignia';badge.scale=(.45,.4,1.5);badge.data.materials.append(dullsteel)
# Rigidly attach new handmade headwear to REAL native head, not another rig.
headbone=rig.pose.bones.get('Head')
assert headbone,'Real original rig lacks Head bone'
def attach_to_head(obj):
 group=obj.vertex_groups.new(name='Head');group.add(list(range(len(obj.data.vertices))),1.0,'REPLACE')
 arm=obj.modifiers.new('Historical commando bone skin',type='ARMATURE');arm.object=rig
for o in (cap,band,badge):attach_to_head(o)
# Prepare to hold its native original skin (49 meaningful deform bones) while
# exposing the 16 extra digit channels expected by our 65-bone animation set.
original_bones=len(rig.data.bones);assert original_bones==49,original_bones
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for side in ('Left','Right'):
 hand=rig.data.edit_bones[side+'Hand']
 for finger in ('Ring','Pinky'):
  for i in range(1,5):
   name=side+'Hand'+finger+str(i)
   if name in rig.data.edit_bones:continue
   b=rig.data.edit_bones.new(name)
   b.parent=rig.data.edit_bones[side+'Hand'+finger+str(i-1)] if i>1 else hand
   shift=(1 if side=='Left' else -1)*(.025 if finger=='Ring' else .042)
   b.head=hand.tail+Vector((shift,-.011*(i-1),0))
   b.tail=b.head+Vector((0,-.012,0))
   b.use_deform=True
bpy.ops.object.mode_set(mode='OBJECT')
assert len(rig.data.bones)==65,len(rig.data.bones)
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
# Donor is an animation and weapon SOCKET source only; donor full body is
# deliberately removed before export. This retains real CC0 soldier body.
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(DONOR))
newobjs=set(bpy.data.objects)-before
donors=[o for o in newobjs if o.type=='ARMATURE']
assert len(donors)==1,len(donors)
donor=donors[0]
assert len(donor.data.bones)==65
# Bone orientation-aware retarget. Do not transplant source mesh weights.
def rot_difference(a,b):
 return (a @ b.inverted()).normalized()
rest_src={b.name:b.matrix_local.to_quaternion() for b in rig.data.bones}
rest_donor={b.name:b.matrix_local.to_quaternion() for b in donor.data.bones}
def canonical(n):
 return n.replace('mixamorig:','').split('.')[0]
donor_map={canonical(b.name):b.name for b in donor.data.bones}
assert all(n in donor_map for n in ['LeftArm','LeftHand','RightHand','LeftUpLeg','RightLeg','Head'])
# Keep a clean imported rigid Sten root + its authored animation strips.
weaponroot=[o for o in newobjs if o.type=='EMPTY' and o.name=='Sten']
assert len(weaponroot)==1,[o.name for o in newobjs if o.type=='EMPTY'][:15]
weapon=weaponroot[0]
for obj in list(newobjs):
 if obj.type=='MESH' and any(m.type=='ARMATURE' for m in obj.modifiers):
  bpy.data.objects.remove(obj,do_unlink=True)
# Source original rest mesh MUST remain, never export donor infantry geometry.
assert mesh.name in bpy.data.objects
# Add 6 original walking / combat poses onto actual CC0 soldier's rig.
clips=['Ready','Aim','Fire','Walk','Jog','Sprint']
rig.animation_data_create()
donor.animation_data_create()
assert {tr.name for tr in donor.animation_data.nla_tracks}>=set(clips)
scene=bpy.context.scene;scene.render.fps=30
movement={}
for clip in clips:
 for tr in donor.animation_data.nla_tracks:tr.mute=(tr.name!=clip)
 for tr in weapon.animation_data.nla_tracks:tr.mute=(tr.name!=clip)
 strip=next(tr.strips[0] for tr in donor.animation_data.nla_tracks if tr.name==clip)
 frames=max(6,round((strip.action_frame_end-strip.action_frame_start)))
 for b in rig.pose.bones:b.rotation_quaternion=Quaternion((1,0,0,0))
 action=bpy.data.actions.new('Commando_'+clip)
 rig.animation_data.action=action
 sample=[]
 for f in range(frames+1):
  scene.frame_set(f+1)
  for sb in rig.pose.bones:
   other=donor_map.get(sb.name)
   if not other:continue
   db=donor.pose.bones[other]
   qdb=db.rotation_quaternion if db.rotation_mode=='QUATERNION' else db.matrix_basis.to_quaternion()
   world_delta=rest_donor[other]@qdb@rest_donor[other].inverted()
   q=(rest_src[sb.name].inverted()@world_delta@rest_src[sb.name]).normalized()
   sb.rotation_quaternion=q
   sb.keyframe_insert('rotation_quaternion',frame=f+1)
  if clip in ['Walk','Jog','Sprint']:
   sample.append(rig.pose.bones['LeftUpLeg'].rotation_quaternion.copy())
  bpy.context.view_layer.update()
 if sample:
  degrees=math.degrees(sample[0].rotation_difference(sample[len(sample)//3]).angle)
  assert degrees>2,(clip,'No genuine old motion',degrees)
  movement[clip]=round(degrees,2)
 # Export as matching NLA strips with same clip names as original.
 tr=rig.animation_data.nla_tracks.new();tr.name=clip;tr.mute=True
 tr.strips.new(clip,1,action);rig.animation_data.action=None
# Imported weapon glTF NLA clips must be kept unmuted for six exported variants.
for obj in (rig,weapon):
 for tr in obj.animation_data.nla_tracks:tr.mute=False
for sb in rig.pose.bones:sb.rotation_quaternion=Quaternion((1,0,0,0))
scene.frame_set(1);bpy.context.view_layer.update()
# Importer created donor armature/empty parent chains; after removing donor
# meshes keep only weapon and its parent chain (no remaining donor rig).
bpy.data.objects.remove(donor,do_unlink=True)
# Preserve original CC0 skinned soldier, new green beret, and rigid Sten mesh.
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
 if o.type in {'MESH','ARMATURE','EMPTY'}:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,
 export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,
 export_yup=True,export_force_sampling=True,export_anim_slide_to_zero=True,
 export_materials='EXPORT')
assert OUT.exists() and OUT.stat().st_size>100000
report={'model':'authentic CC0 WWII British Commando based on nisu skinned FBX',
 'sourceTriangles':sum(len(o.data.polygons) for o in body),
 'sourceVertices':len(mesh.data.vertices),'sourceBodyMeshes':len(body),
 'skeletonBones':len(rig.data.bones),'originalFunctionalBones':original_bones,
 'originalSourceNotJakeli':True,'newBeretMeshes':3,'skinAndUniformMaterials':region_counts,
 'clips':clips,'legExcursionDeg':movement,'weapon':'Sten',
 'visualApproval':False,'iphoneSafari':False,'bytes':OUT.stat().st_size}
(QA/'build-report.json').write_text(json.dumps(report,indent=2))
print('COMMANDO_REAL_CC0_BUILD',json.dumps(report))
