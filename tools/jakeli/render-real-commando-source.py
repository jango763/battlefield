#!/usr/bin/env python3
"""Render genuine CC BY 4.0 full-body source from pinned inspected GLB.
Artifacts are evidence to compare against rejected block mannequin.
"""
import bpy, math, os
from mathutils import Vector
from pathlib import Path
root=Path('babylon-qa-results/commando-real-source')
path=root/'soldier_tac.glb'
assert path.is_file() and path.stat().st_size==4532132
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(path))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(meshes)>=14
bpy.context.view_layer.update()
# Source meshes are in a large rig-bind coordinate system. Unskinned
# helper geometry and unevaluated bound_box values are NOT character bounds.
depsgraph=bpy.context.evaluated_depsgraph_get()
corners=[]
for o in meshes:
 if not any(m.type=='ARMATURE' for m in o.modifiers):continue
 ev=o.evaluated_get(depsgraph)
 data=ev.to_mesh()
 coords=[ev.matrix_world@v.co for v in data.vertices]
 print('COMMANDO_EVALUATED_OBJECT',o.name,len(coords),
  [round(min(p[k] for p in coords),3) for k in range(3)],
  [round(max(p[k] for p in coords),3) for k in range(3)])
 corners.extend(coords)
 ev.to_mesh_clear()
assert corners
minp=Vector(tuple(min(v[i] for v in corners) for i in range(3)))
maxp=Vector(tuple(max(v[i] for v in corners) for i in range(3)))
mid=(minp+maxp)*.5;height=max((maxp-minp).length,1)
print('COMMANDO_REAL_SOURCE_WORLD_BOUNDS',list(minp),list(maxp),'size',height)
world=bpy.context.scene.world or bpy.data.worlds.new('World')
bpy.context.scene.world=world;world.use_nodes=True
world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.19,.25,.21,1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.6
bpy.ops.object.camera_add(location=mid+Vector((height*.6,-height*1.35,height*.28)))
cam=bpy.context.object;cam.rotation_euler=(mid-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=height*.95
bpy.context.scene.camera=cam
for location,power,size in [(mid+Vector((height*.8,-height,height*.9)),800,5),(mid+Vector((-height,height*.5,height*.75)),550,4)]:
 bpy.ops.object.light_add(type='AREA',location=location)
 o=bpy.context.object;o.rotation_euler=(mid-o.location).to_track_quat('-Z','Y').to_euler()
 o.data.energy=power;o.data.shape='DISK';o.data.size=size
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=14
scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
for name,angle in [('front',0),('side',1.1)]:
 cam.location=mid+Vector((height*.6*math.cos(angle)+height*.7*math.sin(angle),
  -height*1.35*math.cos(angle)+height*.2*math.sin(angle),height*.28))
 cam.rotation_euler=(mid-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(root/('genuine-source-'+name+'.png'))
 bpy.ops.render.render(write_still=True)
