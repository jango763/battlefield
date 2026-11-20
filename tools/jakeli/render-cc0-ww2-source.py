#!/usr/bin/env python3
"""Visual and rig audit of CC0 Nisu low-poly WWII soldier source.
Original FBX and texture are never transformed by this inspection.
"""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
root=Path('babylon-qa-results/commando-ww2-source')
folder=root/'files'/'LowpolySoldier'
fbx=folder/'LowpolySoldier.fbx';tex=folder/'LowpolySoldier_Texture.png'
assert fbx.is_file() and tex.is_file()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(fbx))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
assert len(meshes)>=1 and len(rigs)>=1
for img in bpy.data.images:
 if not img.filepath or not Path(bpy.path.abspath(img.filepath)).is_file():
  if 'texture' in img.name.lower() or 'lowpoly' in img.name.lower():img.filepath=str(tex.resolve());img.reload()
bpy.context.view_layer.update()
de=bpy.context.evaluated_depsgraph_get()
coords=[]
for o in meshes:
 ev=o.evaluated_get(de);data=ev.to_mesh()
 verts=[ev.matrix_world@v.co for v in data.vertices]
 coords.extend(verts);ev.to_mesh_clear()
assert coords
mn=Vector(tuple(min(p[k] for p in coords) for k in range(3)))
mx=Vector(tuple(max(p[k] for p in coords) for k in range(3)))
ctr=(mn+mx)*.5
height=mx.z-mn.z
assert .1<height<400,('unreasonable source bounds',list(mn),list(mx))
size=max(height,(mx-mn).length*.66)
print('WW2_CC0_MODEL_INVENTORY',json.dumps({'meshes':[{'name':x.name,'verts':len(x.data.vertices),'mat':[m.name for m in x.data.materials]} for x in meshes],
 'rigs':[{'name':r.name,'bones':[b.name for b in r.data.bones]} for r in rigs],
 'bounds':[list(mn),list(mx)],'size':size}))
world=bpy.context.scene.world or bpy.data.worlds.new('WW2 preview environment')
bpy.context.scene.world=world;world.use_nodes=True
world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.25,.29,.25,1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.6
bpy.ops.object.camera_add(location=ctr+Vector((size*.6,-size*1.3,size*.2)))
cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=size*1.13
scene=bpy.context.scene;scene.camera=cam
for loc,power in [(ctr+Vector((size,-size,size)),800),(ctr+Vector((-size,size*.5,size*.8)),450)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object
 light.data.energy=power;light.data.size=5
 light.rotation_euler=(ctr-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=15
scene.render.resolution_x=850;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
for angle,label in [(0,'front'),(1.1,'side')]:
 cam.location=ctr+Vector((size*.6*math.cos(angle)+size*.95*math.sin(angle),
 -size*1.3*math.cos(angle)+size*.1*math.sin(angle),size*.2))
 cam.rotation_euler=(ctr-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(root/f'cc0-source-{label}.png')
 bpy.ops.render.render(write_still=True)
