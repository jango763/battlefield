#!/usr/bin/env python3
"""Rebuild the isolated Jakeli from the locked STATIC source, not a sculpted prototype.
Run with Blender 4.3: blender -b -t 4 --python tools/jakeli/blender-rebind-german-armature.py
Or the official bpy==4.3.0 Python 3.11 wheel. No German/game input is written.
"""
import bpy, json, math, re, hashlib, os
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from quaternius_legs import QuaterniusLowerBody
from weapon_profiles import load_profile
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'assets/allied-soldiers/uk-jakeli-mobile-static.glb'
WEAPON_ID=os.environ.get('JAKELI_WEAPON','uk-lee-enfield')
MODEL_SUFFIX='' if WEAPON_ID=='uk-lee-enfield' else '-'+WEAPON_ID.removeprefix('uk-')
OUT=ROOT/'assets/allied-soldiers'/('uk-jakeli-anatomical-v2.glb' if not MODEL_SUFFIX else 'uk-jakeli-anatomical'+MODEL_SUFFIX+'.glb')
QA=ROOT/'babylon-qa-results'/('jakeli-anatomical' if not MODEL_SUFFIX else 'jakeli-anatomical'+MODEL_SUFFIX)
QA.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(SRC.read_bytes()).hexdigest()=='e86dc27fdb763092ad80391ea79c3f83f20c7b81195d2132dc1b68cf3634d7a0'
def canon(n):return re.sub(r'_\d+$','',n.replace('mixamorig:',''))
def load(path):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));return [o for o in bpy.data.objects if o not in before]
def smooth(a,b,x):
 t=max(0.,min(1.,(x-a)/(b-a)));return t*t*(3-2*t)
def update():bpy.context.view_layer.update()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
source=load(SRC);meshes=[o for o in source if o.type=='MESH' and 'springfield' not in o.name.lower()]
assert len(meshes)==13
# Apply exactly ONE shared similarity transform. No sculpt, sleeve shift, palm shrink or decimation.
for o in meshes:
 w=o.matrix_world.copy();o.parent=None;o.matrix_world=w
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
lo=min(v.co.z for o in meshes for v in o.data.vertices);hi=max(v.co.z for o in meshes for v in o.data.vertices);scale=1.8/(hi-lo)
for o in meshes:
 for v in o.data.vertices:v.co=Vector((v.co.x*scale,v.co.y*scale,(v.co.z-lo)*scale))
 o.name='Jakeli_'+o.name
for o in source:
 if o not in meshes:bpy.data.objects.remove(o,do_unlink=True)
original={o.name:{'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'positions':[v.co.copy() for v in o.data.vertices]} for o in meshes}
# Coordinates below are anatomical landmarks in the ORIGINAL author's centimetre frame.
# Front is -Y, up Z in Blender. 1.206 imported global scale cancels during normalization.
unit=1.8/(185.15460205078125+1.5273550748825073)
def pt(x,y,z):return Vector((x*unit,y*unit,(z+1.5273550748825073)*unit))
ref=load(ROOT/'assets/soldiers/german.glb');rig=next(o for o in ref if o.type=='ARMATURE')
rig.animation_data_clear();rig.parent=None;rig.matrix_world=Matrix.Identity(4)
for o in ref:
 if o!=rig:bpy.data.objects.remove(o,do_unlink=True)
rig.name='Jakeli_Anatomical65'
for b in rig.data.bones:b.name=canon(b.name)
bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
eb=rig.data.edit_bones
for b in eb:b.use_connect=False
if eb.get('neutral_bone'):eb.remove(eb['neutral_bone'])
land={
 'GLTF_created_0_rootJoint':(0,0,-1.5273550748825073),
 'Hips':(0,0,96),'Spine':(0,0,110),'Spine1':(0,0,126),'Spine2':(0,0,144),
 'Neck':(0,0,155),'Head':(0,0,165)}
for side,sign in [('Left',1),('Right',-1)]:
 for name,p in {'Shoulder':(8,0,149),'Arm':(20,0,148),'ForeArm':(38,-1,127),
 'Hand':(53,-2,109),'UpLeg':(11,0,95),'Leg':(18,-1,55),'Foot':(23,0,14),
 'ToeBase':(23,-10,5),'Toe_End':(23,-16,5)}.items():land[side+name]=(p[0]*sign,p[1],p[2])
 for digit,y,x0,z0,length in [('Index',-6.4,60,102,7),('Middle',-3.8,61,101,6.8),('Ring',-1.3,61,101,6),('Pinky',1.0,60.5,101,5.2)]:
  for k,t in enumerate([0,.43,.76,1]):land[f'{side}Hand{digit}{k+1}']=(sign*(x0+length*t),y,z0-8*t)
 for k,p in enumerate([(54,-5.8,106),(56,-8.7,102),(57.4,-10,99.7),(58,-10.3,98)]):land[f'{side}HandThumb{k+1}']=(sign*p[0],p[1],p[2])
assert set(land)==set(b.name for b in eb),(set(b.name for b in eb)-set(land))
for n,p in land.items():eb[n].head=pt(*p)
for b in eb:
 children=list(b.children)
 main={'Hips':'Spine','Spine2':'Neck','LeftHand':'LeftHandMiddle1','RightHand':'RightHandMiddle1'}.get(b.name)
 if main:b.tail=eb[main].head
 elif children:b.tail=children[0].head
 else:b.tail=b.head+Vector((0,0,.015))
 if (b.tail-b.head).length<.001:b.tail=b.head+Vector((0,0,.015))
 if 'Hand' in b.name:
  sign=1 if b.name.startswith('Left') else -1
  b.align_roll(Vector((sign*.73,0,.68)))
 else:b.align_roll(Vector((0,1,0)))
bpy.ops.object.mode_set(mode='OBJECT');update()
# Region-aware skin weights. Accessories are rigid; sleeves cannot acquire finger weights;
# face/teeth/eyes cannot acquire spine weights. Adjacent bones blend across each real joint.
def weights(name,p):
 x,y,z=p.x/unit,p.y/unit,p.z/unit-1.5273550748825073
 side='Left' if x>=0 else 'Right';x=abs(x)
 if any(k in name for k in ['HELMET','SkullCap','Material #3_','Material #6_','Material #38_','Material #55_']):return {'Head':1}
 if 'Material #21_' in name:
  # Each finger band follows original hand geometry, not a different donor's hand.
  if y < -7.9 and x<60:
   t=smooth(53.5,58,x);f=side+'HandThumb';u=max(0,min(2,(x-54)/1.65))
  else:
   digit=min([('Index',-6.4),('Middle',-3.8),('Ring',-1.3),('Pinky',1)],key=lambda a:abs(y-a[1]))[0]
   f=side+'Hand'+digit;t=smooth(58.5,61.3,x);u=max(0,min(2,(x-60.8)/2.5))
  k=min(2,int(u));v=u-k
  return {side+'Hand':1-t,f+str(k+1):t*(1-v),f+str(k+2):t*v}
 if 'SHOE' in name:
  t=smooth(13,22,z);return {side+'Foot':1-t,side+'Leg':t}
 if 'Pants' in name:
  # The two leg meshes share crotch edges near the centreline. Without a
  # pelvis bridge, neighbouring vertices bind to opposite thighs and split
  # apart when the legs alternate in Sprint (measured 7.78x edge stretch).
  # Transition smoothly from Hips at the inseam into each thigh in X and Z.
  # Smooth pelvis-to-thigh blend verified against actual Quaternius Walk/Jog/Sprint.
  # Old narrow blend stretched crotch mesh 3.384x in Jog; a 38cm-long
  # anatomical hip transition keeps the original source gait unmodified.
  hip=max(smooth(82,101,z),(1-smooth(0,25,x))*smooth(48,86,z));k=smooth(49,61,z)
  return {'Hips':hip,side+'UpLeg':(1-hip)*k,side+'Leg':(1-hip)*(1-k)}
 if 'BELT' in name:return {'Spine':1}
 if 'ALL_BAG' in name:
  # One continuous bag mesh crossed the old z=108 rigid-bone boundary;
  # adjacent vertices separated by ~1mm were pulled ~60mm apart in Aim.
  # Keep the connected kit rigid to the upper torso instead.
  return {'Spine2':1}
 # Shirt/torso: continuous shoulders, elbow and collar, no nearest-neighbour leakage.
 arm=smooth(17,26,x)*smooth(112,124,z)
 if 'T_Shirt' in name:
  # Sleeves continue BELOW 112cm at cuff: x separates them from torso.
  arm=smooth(17,26,x)
 elbow=smooth(33,42,x)
 torso={}
 if z<110:torso={'Hips':1-smooth(96,110,z),'Spine':smooth(96,110,z)}
 elif z<126:torso={'Spine':1-smooth(110,126,z),'Spine1':smooth(110,126,z)}
 else:torso={'Spine1':1-smooth(126,143,z),'Spine2':smooth(126,143,z)}
 out={n:w*(1-arm) for n,w in torso.items()};out[side+'Arm']=arm*(1-elbow);cuff=.35*smooth(49,56,x) if 'T_Shirt' in name else 0
 out[side+'ForeArm']=arm*elbow*(1-cuff);out[side+'Hand']=arm*elbow*cuff
 return out
for o in meshes:
 for vg in list(o.vertex_groups):o.vertex_groups.remove(vg)
 groups={n:o.vertex_groups.new(name=n) for n in land}
 for v in o.data.vertices:
  ws={n:w for n,w in weights(o.name,v.co).items() if w>1e-7};total=sum(ws.values());assert total>0
  for n,w in ws.items():groups[n].add([v.index],w/total,'REPLACE')
 o.parent=rig;o.matrix_parent_inverse=Matrix.Identity(4)
 mod=o.modifiers.new('Anatomical bind','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=False
# Heat diffusion on the actual welded hand surface avoids hard finger-band seams.
# Use a temporary welded copy only for weights; preserve every original render vertex.
import bmesh
from mathutils.kdtree import KDTree
glove=next(o for o in meshes if 'Material #21_' in o.name)
temp=glove.copy();temp.data=glove.data.copy();bpy.context.collection.objects.link(temp)
for mod in list(temp.modifiers):temp.modifiers.remove(mod)
for vg in list(temp.vertex_groups):temp.vertex_groups.remove(vg)
bm=bmesh.new();bm.from_mesh(temp.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.00001);bm.to_mesh(temp.data);bm.free()
for b in rig.data.bones:b.use_deform=('Hand' in b.name and not b.name.endswith('4')) or 'ForeArm' in b.name
bpy.ops.object.select_all(action='DESELECT');temp.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
kdt=KDTree(len(temp.data.vertices))
for v in temp.data.vertices:kdt.insert(v.co,v.index)
kdt.balance()
for v in glove.data.vertices:
 _,idx,dist=kdt.find(v.co);assert dist<0.00002
 ws=[(temp.vertex_groups[g.group].name,g.weight) for g in temp.data.vertices[idx].groups if g.weight>1e-6]
 assert ws,('Heat weighting failed',idx)
 ws=sorted(ws,key=lambda a:a[1],reverse=True)[:4];total=sum(w for _,w in ws)
 for vg in glove.vertex_groups:vg.remove([v.index])
 for n,w in ws:glove.vertex_groups[n].add([v.index],w/total,'REPLACE')
bpy.data.objects.remove(temp,do_unlink=True)
for b in rig.data.bones:b.use_deform=True
update()
# Assert the evaluated bind geometry equals original, independent of joint socket metrics.
dg=bpy.context.evaluated_depsgraph_get();bind_error=0
for o in meshes:
 ev=o.evaluated_get(dg).to_mesh();assert len(ev.vertices)==len(o.data.vertices)
 bind_error=max(bind_error,max((v.co-original[o.name]['positions'][i]).length for i,v in enumerate(ev.vertices)))
 o.evaluated_get(dg).to_mesh_clear()
assert bind_error<1e-4,bind_error
# Each variant uses the identical re-bound Jakeli mesh and Quaternius legs.
# Only weapon appearance, rigid mount, and baked arm contact targets differ.
profile,weapon=load_profile(ROOT,WEAPON_ID,load)
gun=bpy.data.objects.new(profile['name'],None);bpy.context.scene.collection.objects.link(gun)
for o in weapon:
 if o.parent not in weapon:
  w=o.matrix_world.copy();o.parent=gun;o.matrix_world=w
update()
bones=rig.pose.bones
for b in bones:b.rotation_mode='QUATERNION'
gun.rotation_mode='QUATERNION'
rest={b.name:b.matrix.copy() for b in bones}
# Genuine pre-Work Quaternius legs on the NEW anatomical skin. Arms and rifle stay baked.
gait=QuaterniusLowerBody(ROOT/'assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb',rig)
# Frame rotations derive from fitted bone directions. No assumed donor wrist axis.
def frame(forward,dorsal):
 y=forward.normalized();z=(dorsal-y*y.dot(dorsal)).normalized();x=y.cross(z).normalized();z=x.cross(y)
 return Matrix((x,y,z)).transposed().to_quaternion()
def set_world(n,q):
 b=bones[n];m=q.to_matrix().to_4x4();m.translation=b.head;b.matrix=m;update()
def aim_bone(n,target):
 b=bones[n];q=(b.tail-b.head).rotation_difference(target-b.head);m=q.to_matrix().to_4x4()@b.matrix;m.translation=b.head;b.matrix=m;update()
def solve(side,goal,pole):
 u,f,h=[bones[side+n] for n in ['Arm','ForeArm','Hand']];a=u.head.copy();l1=(f.head-a).length;l2=(h.head-f.head).length
 delta=goal-a;d=delta.length;assert abs(l1-l2)+1e-4<d<l1+l2-1e-4,(clip,f,side,'unreachable',d,l1+l2,list(a),list(goal))
 direction=delta/d;pv=pole-a;pv=(pv-direction*pv.dot(direction)).normalized();along=(l1*l1-l2*l2+d*d)/(2*d)
 elbow=a+direction*along+pv*math.sqrt(max(0,l1*l1-along*along));aim_bone(side+'Arm',elbow);aim_bone(side+'ForeArm',goal)
 return (bones[side+'Hand'].head-goal).length
# Original source hand palm centers measured relative to fitted wrist, in bone local space.
palm_local={s:rest[s+'Hand'].inverted()@pt(sign*58,-2.5,105) for s,sign in [('Left',1),('Right',-1)]}
clips={};grip_max=0;elbows=[]
scene=bpy.context.scene;scene.render.fps=30
for clip,duration in [('Ready',2),('Aim',2),('Fire',1.2)]+[(c,gait.clips[c]['duration']) for c in ('Walk','Jog','Sprint')]:
 rig.animation_data_create();rig.animation_data.action=bpy.data.actions.new(clip)
 gun.animation_data_create();gun.animation_data.action=bpy.data.actions.new(clip)
 frames=round(duration*30)
 for f in range(frames+1):
  scene.frame_set(f+1);t=f/30;phase=2*math.pi*f/frames;moving=clip in ['Walk','Jog','Sprint'];fast=clip in ['Jog','Sprint']
  for b in bones:b.matrix_basis=Matrix.Identity(4)
  update()
  set_world('Spine2',Quaternion((0,0,1),-.42) @ rest['Spine2'].to_quaternion())
  set_world('Head',rest['Head'].to_quaternion())
  # True earlier Quaternius bone trajectories (no synthetic sine-leg animation).
  if moving:
   gait.apply(clip, f/frames)
  update()
  # Gun stock sits in right shoulder pocket; support is on the actual fore-end.
  lower=math.radians(profile['ready_pitch'] if clip in ['Ready','Walk','Jog','Sprint'] else profile['aim_pitch'])
  recoil=.012*max(0,math.sin(t*math.pi*8))**8 if clip=='Fire' else 0
  # The glTF NLA exporter drops animation channels that are constant within
  # a clip, even if their values differ across clips. This left Aim using
  # Ready's 24-degree rifle pitch and ~11cm wrong stock height in the GLB.
  # A subtle, baked breathing arc preserves both animated gun channels.
  gun.rotation_quaternion=Quaternion((1,0,0),lower+.008*math.sin(phase))
  shoulder=bones['RightArm'].head+Vector((.025,-.035,-.055))
  stock=Vector(profile['stock']);gun.location=shoulder-gun.rotation_quaternion@stock+Vector((0,recoil+.003*math.sin(phase),0));update()
  rightQ=frame(gun.rotation_quaternion@Vector(profile['right_axis']),gun.rotation_quaternion@Vector(profile['right_dorsal']))
  leftQ=frame(gun.rotation_quaternion@Vector(profile['left_axis']),gun.rotation_quaternion@Vector(profile['left_dorsal']))
  # Contact markers are at the physical stock wrist and underside of the forestock.
  contacts={'Right':gun.matrix_world@Vector(profile['right']),'Left':gun.matrix_world@Vector(profile['left'])}
  for s,q in [('Right',rightQ),('Left',leftQ)]:
   goal=contacts[s]-q@palm_local[s]
   pole=bones[s+'Arm'].head+Vector((-.25 if s=='Right' else .20,.08,-.45))
   solve(s,goal,pole)
   fore=bones[s+'ForeArm'];direction=bones[s+'Hand'].head-fore.head
   set_world(s+'ForeArm',frame(direction,q@Vector((0,0,1))))
   set_world(s+'Hand',q)
   for digit in ['Index','Middle','Ring','Pinky','Thumb']:
    for k in [1,2,3]:
     n=s+'Hand'+digit+str(k);angle=([.65,.8,.65] if digit=='Index' and s=='Right' else [.95,1.20,.80])[k-1]
     if digit=='Thumb':angle=[.35,.40,.25][k-1]
     bones[n].rotation_quaternion=Quaternion((1,0,0),-angle)
   update();actual=bones[s+'Hand'].matrix@palm_local[s];grip_max=max(grip_max,(actual-contacts[s]).length)
   u,e,w=[bones[s+n].head for n in ['Arm','ForeArm','Hand']];elbows.append(math.degrees((e-u).angle(w-e)))
  for b in bones:
   b.keyframe_insert('rotation_quaternion',frame=f+1);b.keyframe_insert('location',frame=f+1);b.keyframe_insert('scale',frame=f+1)
  gun.keyframe_insert('location',frame=f+1);gun.keyframe_insert('rotation_quaternion',frame=f+1)
 for obj in [rig,gun]:
  action=obj.animation_data.action;track=obj.animation_data.nla_tracks.new();track.name=clip;track.mute=True;strip=track.strips.new(clip,1,action);obj.animation_data.action=None
 clips[clip]=frames+1
# Export NLA tracks with matching names merged into six complete clips.
for obj in [rig,gun]:
 for tr in obj.animation_data.nla_tracks:tr.mute=True
for b in bones:b.matrix_basis=Matrix.Identity(4)
gun.location=(0,0,0);gun.rotation_quaternion=Quaternion();update()
bpy.ops.object.select_all(action='DESELECT')
for o in meshes+[rig,gun]+weapon:o.select_set(True)
bpy.context.view_layer.objects.active=rig
# Unmute one at a time during exporter NLA sampling (exporter ignores mute if configured).
for obj in [rig,gun]:
 for tr in obj.animation_data.nla_tracks:tr.mute=False
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(QA/'jakeli-anatomical.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=True,
 export_animation_mode='NLA_TRACKS',export_skins=True,export_materials='EXPORT',export_yup=True,
 export_force_sampling=True,export_anim_slide_to_zero=True,export_rest_position_armature=True)
report={'sourceSHA256':hashlib.sha256(SRC.read_bytes()).hexdigest(),'blender':bpy.app.version_string,'weaponId':WEAPON_ID,'weaponNode':profile['name'],'outputModel':OUT.name,
 'bindMaxVertexErrorMeters':bind_error,'maxBakedPalmContactErrorMeters':grip_max,'elbowBendRangeDegrees':[min(elbows),max(elbows)],
 'sourceVertices':sum(v['vertices'] for v in original.values()),'meshes':len(meshes),'bonesBeforeGltfRoot':len(bones),
 'preserved':'All original source positions (one uniform transform), topology, UVs and materials; embedded Springfield excluded',
 'clips':clips,'locomotion':'authentic pre-Work Quaternius Walk/Jog/Sprint legs on anatomical Jakeli; combat upper-body still custom baked',
 'legMotionSource':gait.path,'legMotionClips':gait.audit,
 'visualApproval':False,'iphoneSafari':False}
(QA/'build-report.json').write_text(json.dumps(report,indent=2));print('JAKELI_BUILD',json.dumps(report))
# CPU reference renders of the same baked pose, with actual surface geometry visible.
if os.environ.get('JAKELI_RENDER','1')=='1':
 for obj in [rig,gun]:
  for tr in obj.animation_data.nla_tracks:tr.mute=tr.name!='Aim'
 scene.frame_set(1);update();scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=False;scene.world.color=(.3,.3,.3)
 bpy.ops.object.camera_add(location=(2.8,-5,2.5));cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2.1
 for loc,power in [((2,-4,5),650),((-3,-2,3),400),((0,3,4),600)]:
  bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=4;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
 scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
 for label,loc,target,size in [('aim-front',(2.8,-5,2.5),(0,0,.95),2.1),('aim-hands',(1.2,-2,1.9),(-.08,-.25,1.34),.8),('aim-right',(-2,-1,1.8),(-.08,-.25,1.34),.8)]:
  cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=size;scene.render.filepath=str(QA/(label+'.png'));bpy.ops.render.render(write_still=True)
