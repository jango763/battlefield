#!/usr/bin/env python3
"""Temporary original Panzerschreck prop for AnimStudio IK test.
This is NOT a licensed artist-authored historical model. Replace when verified.
Works via pip install trimesh numpy.
"""
from pathlib import Path
import sys
import numpy as np
import trimesh

scene = trimesh.Scene()
OLIVE=np.array([72,83,64,255],dtype=np.uint8)
DARK=np.array([36,40,37,255],dtype=np.uint8)
WOOD=np.array([95,60,35,255],dtype=np.uint8)

def add(name, mesh, xyz, color):
    mesh.apply_translation(xyz)
    mesh.visual.vertex_colors=np.tile(color,(len(mesh.vertices),1))
    scene.add_geometry(mesh, node_name=name, geom_name=name)

def tube(name, radius, length, z, y=0, color=OLIVE):
    mesh=trimesh.creation.cylinder(radius=radius,height=length,sections=24)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2,[1,0,0]))
    add(name,mesh,[0,y,z],color)

def box(name,size,xyz,color=OLIVE):
    add(name,trimesh.creation.box(extents=size),xyz,color)

tube('Raketepanzerbuechse54',.052,1.64,0)
for index,z in enumerate((-.78,-.43,.09,.77)):tube('SteelBand'+str(index),.058,.025,z,color=DARK)
box('AntiBlastShield',[.46,.34,.018],[-.055,.017,.30])
box('SightWindow',[.072,.055,.022],[-.193,.081,.31],DARK)
box('TriggerHousing',[.12,.115,.19],[0,-.109,-.23],DARK)
box('RightPistolGrip',[.068,.17,.063],[0,-.23,-.23],WOOD)
box('LeftForegrip',[.068,.15,.063],[0,-.2,-.10],WOOD)
box('ShoulderPad',[.13,.065,.20],[0,-.10,-.48],WOOD)
box('Support',[.001,.001,.001],[0,-.135,-.10],DARK)
path=Path(sys.argv[1] if len(sys.argv)>1 else 'panzerschreck-preview.glb')
path.parent.mkdir(parents=True,exist_ok=True)
path.write_bytes(scene.export(file_type='glb'))
print('Panzerschreck preview exported:',path,'meshes',len(scene.geometry))
