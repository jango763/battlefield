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
from quaternius_legs import QuaterniusLowerBody
from weapon_profiles import load_profile
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
skin=material('Commando CC0 human skin',(.48,.285,.185))
jacket=material('Commando British brown-green battledress',(.16,.19,.115))
jacketfold=material('Commando shaded khaki coat',(.12,.155,.095))
trouser=material('Commando British olive-brown trousers',(.205,.205,.14))
boots=material('Commando brown-black ankle boots',(.05,.048,.041))
webbing=material('Commando 1937 pattern khaki webbing',(.35,.30,.19))
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
 p=mesh.matrix_world@(sum(v,Vector())/len(v))
 # The native FBX's vertex positions are in centimetres: classify materials
 # in WORLD metres, never object-local FBX centimetres. Previous all-green
 # mesh came from accidentally assigning torso material to 72% of polygons.
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
# Find the living HEAD region on the actual skinned human mesh, NOT the
# original FBX helmet's raw bound_box (that box is in bind coordinates and
# put the first beret 40cm behind the character's head).
head_group=mesh.vertex_groups.get('Head')
assert head_group,('CC0 native source missing skin Head vertex group')
dg=bpy.context.evaluated_depsgraph_get()
evaluated=mesh.evaluated_get(dg)
evaluated_mesh=evaluated.to_mesh()
head_vertices=[
 evaluated.matrix_world@evaluated_mesh.vertices[i].co
 for i,v in enumerate(mesh.data.vertices)
 if any(g.group==head_group.index and g.weight>.45 for g in v.groups)
]
evaluated.to_mesh_clear()
assert len(head_vertices)>=30,('Insufficient genuine skinned head geometry',len(head_vertices))
hxmin=min(v.x for v in head_vertices);hxmax=max(v.x for v in head_vertices)
hymin=min(v.y for v in head_vertices);hymax=max(v.y for v in head_vertices)
hzmax=max(v.z for v in head_vertices)
beret_center=Vector(((hxmin+hxmax)*.5,(hymin+hymax)*.5,hzmax-.030))
print('COMMANDO_REAL_HEAD_BERET_ANCHOR',len(head_vertices),
  [round(x,4) for x in beret_center])
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
# Animate true CC0 skin via the already verified Quaternius 65-bone library.
# Imported GLB NLA channels are not read back reliably by headless bpy, so
# retarget the original glTF data directly rather than copying a zeroed pose.
rig.animation_data_clear()
rig.animation_data_create()
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
gait=QuaterniusLowerBody(ROOT/'assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb',rig)
def load(path):
 before=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=str(path))
 return [o for o in bpy.data.objects if o not in before]
profile,parts=load_profile(ROOT,'uk-sten',load)
# The genuine CC0 soldier has a slightly shorter left arm than the Jakeli rig.
# Move the support hand along the REAL Sten wooden/metal fore-end, from
# 255mm to 215mm, leaving the original gun geometry and limb length intact.
profile=dict(profile);profile['left']=(0,-.195,.031)
weapon=bpy.data.objects.new('Sten',None)
bpy.context.scene.collection.objects.link(weapon)
for o in parts:
 if o.parent not in parts:
  world=o.matrix_world.copy()
  o.parent=weapon
  o.matrix_world=world
weapon.rotation_mode='QUATERNION'
weapon.animation_data_create()
rest={b.name:b.matrix.copy() for b in rig.pose.bones}
# FBX armature uses centimetre bone coordinates with an object-level 0.01 scale.
# The imported gun lives in world METRES. Convert every contact target and
# pole direction explicitly; never compare armature-local coordinates to
# Blender-world coordinates as if they shared units.
rigworld=rig.matrix_world.copy()
rig_inv=rigworld.inverted()
rig_rot_inv=rigworld.to_quaternion().inverted()
def local_offset(world_delta):return rig_inv.to_3x3()@world_delta
palm={}
for side in ('Left','Right'):
 hand=rig.pose.bones[side+'Hand']
 # Actual human CC0 hand reaches palm centre between wrist and fingers.
 local=hand.bone.matrix_local.inverted()@(hand.bone.head_local+(hand.bone.tail_local-hand.bone.head_local)*.43)
 palm[side]=local
def update():bpy.context.view_layer.update()
def frame(forward,dorsal):
 y=forward.normalized()
 z=(dorsal-y*y.dot(dorsal)).normalized()
 x=y.cross(z).normalized();z=x.cross(y)
 return Matrix((x,y,z)).transposed().to_quaternion()
def set_world(name,quat):
 bone=rig.pose.bones[name]
 M=quat.to_matrix().to_4x4();M.translation=bone.head
 bone.matrix=M
 update()
def aim_bone(name,point):
 bone=rig.pose.bones[name]
 displacement=point-bone.head
 q=(bone.tail-bone.head).rotation_difference(displacement)
 M=q.to_matrix().to_4x4()@bone.matrix
 M.translation=bone.head
 bone.matrix=M
 update()
def solve(side,point,pole,clip,index):
 up,fore,hand=[rig.pose.bones[side+s] for s in ('Arm','ForeArm','Hand')]
 shoulder=up.head.copy()
 l1=(fore.head-shoulder).length;l2=(hand.head-fore.head).length
 delta=point-shoulder
 dist=delta.length
 assert dist < l1+l2-.0005 and dist > abs(l1-l2)+.0005,(
  'Anatomical Commando arm reach',clip,index,side,dist,l1+l2,
  list(shoulder),list(point))
 unit=delta/dist;pv=pole-shoulder
 pv=(pv-unit*pv.dot(unit)).normalized()
 along=(l1*l1-l2*l2+dist*dist)/(2*dist)
 elbow=shoulder+unit*along+pv*math.sqrt(max(0,l1*l1-along*along))
 aim_bone(side+'Arm',elbow)
 aim_bone(side+'ForeArm',point)
 return (rig.pose.bones[side+'Hand'].head-point).length
scene=bpy.context.scene;scene.render.fps=30
clips=['Ready','Aim','Fire','Walk','Jog','Sprint']
movement={};grip_errors={c:{'Left':0,'Right':0} for c in clips}
for clip in clips:
 duration=gait.clips[clip]['duration'] if clip in gait.clips else (1.2 if clip=='Fire' else 2)
 frames=min(18,max(10,round(duration*12)))
 print('COMMANDO_CC0_BEGIN_CLIP',clip,'frames',frames,flush=True)
 rig.animation_data.action=bpy.data.actions.new('Commando_'+clip)
 weapon.animation_data.action=bpy.data.actions.new('Commando_'+clip)
 leg_samples=[]
 for f in range(frames+1):
  scene.frame_set(f+1)
  phase=2*math.pi*f/frames
  for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
  update()
  set_world('Spine2',Quaternion((0,0,1),-.38)@rest['Spine2'].to_quaternion())
  set_world('Head',rest['Head'].to_quaternion())
  if clip in gait.clips:
   gait.apply(clip,f/frames)
   leg_samples.append(rig.pose.bones['LeftUpLeg'].rotation_quaternion.copy())
  update()
  lower=math.radians(22 if clip in ('Ready','Walk','Jog','Sprint') else 0)
  recoil=.013*max(0,math.sin((f/30)*math.pi*8))**8 if clip=='Fire' else 0
  weapon.rotation_quaternion=Quaternion((1,0,0),lower+.007*math.sin(phase))
  shoulder=rigworld@rig.pose.bones['RightArm'].head+Vector((.023,-.035,-.052))
  stock=Vector(profile['stock'])
  weapon.location=shoulder-weapon.rotation_quaternion@stock+Vector((0,recoil+.002*math.sin(phase),0))
  update()
  rq=rig_rot_inv@frame(weapon.rotation_quaternion@Vector(profile['right_axis']),weapon.rotation_quaternion@Vector(profile['right_dorsal']))
  lq=rig_rot_inv@frame(weapon.rotation_quaternion@Vector(profile['left_axis']),weapon.rotation_quaternion@Vector(profile['left_dorsal']))
  contacts={'Right':weapon.matrix_world@Vector(profile['right']),
            'Left':weapon.matrix_world@Vector(profile['left'])}
  for side,q in (('Right',rq),('Left',lq)):
   desired=rig_inv@contacts[side]-q@palm[side]
   pole=rig.pose.bones[side+'Arm'].head+local_offset(Vector((-.23 if side=='Right' else .22,.07,-.36)))
   solve(side,desired,pole,clip,f)
   fore=rig.pose.bones[side+'ForeArm']
   direction=rig.pose.bones[side+'Hand'].head-fore.head
   set_world(side+'ForeArm',frame(direction,q@Vector((0,0,1))))
   set_world(side+'Hand',q)
   for digit in ('Thumb','Index','Middle'):
    for n in range(1,4):
     bone=rig.pose.bones.get(side+'Hand'+digit+str(n))
     if bone:
      angle=(.40 if digit=='Thumb' else .66 if digit=='Index' and side=='Right' else .91)
      bone.rotation_quaternion=Quaternion((1,0,0),-angle)
   update()
   actual=rig.pose.bones[side+'Hand'].matrix@palm[side]
   grip_errors[clip][side]=max(grip_errors[clip][side],((rigworld@actual)-contacts[side]).length)
  for b in rig.pose.bones:
   b.keyframe_insert('rotation_quaternion',frame=f+1)
  weapon.keyframe_insert('location',frame=f+1)
  weapon.keyframe_insert('rotation_quaternion',frame=f+1)
 if leg_samples:
  degrees=math.degrees(leg_samples[0].rotation_difference(leg_samples[len(leg_samples)//3]).angle)
  assert degrees>3,('No true Quaternius lower body motion',clip,degrees)
  movement[clip]=round(degrees,2)
 for obj in (rig,weapon):
  action=obj.animation_data.action
  track=obj.animation_data.nla_tracks.new()
  track.name=clip;track.mute=True
  track.strips.new(clip,1,action)
  obj.animation_data.action=None
 print('COMMANDO_CC0_FINISHED_CLIP',clip,flush=True)
print('COMMANDO_CC0_STEN_ACTUAL_GRIP_ERRORS',json.dumps(grip_errors))
assert max(v for sides in grip_errors.values() for v in sides.values())<.025,grip_errors
for o in (rig,weapon):
 for tr in o.animation_data.nla_tracks:tr.mute=False
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
weapon.location=(0,0,0);weapon.rotation_quaternion=Quaternion()
scene.frame_set(1);update()
bpy.ops.object.select_all(action='DESELECT')
for obj in body+[cap,band,badge,rig,weapon]+parts:obj.select_set(True)
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
if os.environ.get('COMMANDO_RENDER','1')=='1':
 # Standalone evidence of this exact exportable source before it enters the game.
 for obj in (rig,weapon):
  for tr in obj.animation_data.nla_tracks:tr.mute=(tr.name!='Ready')
 scene.frame_set(12);bpy.context.view_layer.update()
 dep=bpy.context.evaluated_depsgraph_get()
 eva=mesh.evaluated_get(dep);dat=eva.to_mesh()
 coords=[eva.matrix_world@v.co for v in dat.vertices];eva.to_mesh_clear()
 mn=Vector(tuple(min(p[i] for p in coords) for i in range(3)))
 mx=Vector(tuple(max(p[i] for p in coords) for i in range(3)))
 mid=(mn+mx)*.5
 H=mx.z-mn.z
 assert 1.2<H<2.3,('Real commando animated world height',H,list(mn),list(mx))
 world=scene.world or bpy.data.worlds.new('Commando evidence world')
 scene.world=world;world.use_nodes=True
 world.node_tree.nodes['Background'].inputs['Color'].default_value=(.15,.19,.16,1)
 world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
 bpy.ops.object.camera_add(location=mid+Vector((H*.5,-H*1.5,H*.20)))
 camera=bpy.context.object
 camera.data.type='ORTHO';camera.data.ortho_scale=H*1.04
 scene.camera=camera
 for loc,power in [(mid+Vector((H*.8,-H,H*.9)),700),(mid+Vector((-H,H*.5,H*.6)),400)]:
  bpy.ops.object.light_add(type='AREA',location=loc)
  light=bpy.context.object;light.data.energy=power;light.data.size=4
  light.rotation_euler=(mid-light.location).to_track_quat('-Z','Y').to_euler()
 scene.render.engine='CYCLES';scene.cycles.samples=8
 scene.render.resolution_x=900;scene.render.resolution_y=1000
 scene.render.resolution_percentage=100
 for side,angle in [('front',0),('side',1.1)]:
  camera.location=mid+Vector((H*.45*math.cos(angle)+H*1.35*math.sin(angle),
     -H*1.45*math.cos(angle)+H*.15*math.sin(angle),H*.16))
  camera.rotation_euler=(mid-camera.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=str(QA/(side+'.png'))
  bpy.ops.render.render(write_still=True)

