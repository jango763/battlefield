"""Data-only weapon mount profiles for an isolated Jakeli anatomical test.
The original Lee-Enfield defaults are preserved; no game-army assets are modified.
Coordinates are Blender Z-up, forward -Y, meters after importing muster GLBs.
"""
import json
import math
from pathlib import Path
from mathutils import Vector
import bpy

PROFILES = {
 "uk-lee-enfield": {"name": "LeeEnfield", "model": "uk-lee-enfield.glb",
   "right": (-.018,.017,-.009), "left": (0,-.200,.020),
   "stock": (0,.2636,-.051387844), "right_axis": (0,-.945,.326),
   "left_axis": (-.32,-.947,0), "left_dorsal": (0,0,-1),
   "right_dorsal": (-1,0,0), "ready_pitch": 24, "aim_pitch": 0},
 "uk-sten": {"name": "Sten", "model": "uk-sten.glb",
   "right": (-.014,.012,-.016), "left": (0,-.255,.031),
   "stock": (0,.18143,-.035), "right_axis": (0,-.966,.259),
   "left_axis": (-.28,-.960,0), "left_dorsal": (0,0,-1),
   "right_dorsal": (-1,0,0), "ready_pitch": 22, "aim_pitch": 0},
 "uk-bren": {"name": "Bren", "model": "uk-bren.glb",
   "right": (-.019,.010,-.040), "left": (.023,-.205,.055),
   "stock": (0,.31421,.04943), "right_axis": (0,-.38,.925),
   "left_axis": (-.25,-.968,0), "left_dorsal": (0,0,-1),
   "right_dorsal": (-1,0,0), "ready_pitch": 20, "aim_pitch": 0},
 "uk-piat": {"name": "Piat", "model": None,
   "right": (0,.155,-.155), "left": (0,-.10,-.115),
   "stock": (0,.40,-.045), "right_axis": (0,-.55,.835),
   "left_axis": (-.25,-.968,0), "left_dorsal": (0,0,-1),
   "right_dorsal": (-1,0,0), "ready_pitch": 17, "aim_pitch": 0},
}
assert len(PROFILES)==4

def make_piat():
    """Blender rendering counterpart of the already-existing original
    Battlefield procedural PIAT. Shapes are functional preview placeholders;
    they do not change the approved in-game JS procedural implementation.
    From Babylon Y-up to Blender Z-up: (x,y,z) -> (x,-z,y).
    """
    created=[]
    def at(v):
        return (v[0], -v[2], v[1])
    def material(label, color):
        m=bpy.data.materials.new(label)
        m.diffuse_color=(*color,1)
        return m
    steel=material('PIAT olive steel',(.19,.24,.17))
    dark=material('PIAT graphite steel',(.10,.13,.10))
    olive=material('PIAT shoulder cushion',(.43,.37,.23))
    def cylinder(name,radius,length,center,mat):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=length, location=at(center))
        obj=bpy.context.object;obj.name=name;obj.rotation_euler[0]=math.pi/2
        obj.data.materials.append(mat);created.append(obj)
        return obj
    def cube(name,size,center,mat):
        bpy.ops.mesh.primitive_cube_add(size=1,location=at(center))
        obj=bpy.context.object;obj.name=name
        obj.dimensions=(size[0],size[2],size[1])
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        obj.data.materials.append(mat);created.append(obj)
        return obj
    cylinder('PIAT spring cylinder',.0695,.66,(0,0,-.09),steel)
    cylinder('PIAT rear sleeve',.073,.14,(0,0,-.35),dark)
    cylinder('PIAT spigot',.0255,.28,(0,-.005,.374),dark)
    cube('PIAT open bomb tray',(.150,.018,.355),(0,-.057,.383),steel)
    cube('PIAT tray left wall',(.019,.072,.355),(-.068,-.016,.383),steel)
    cube('PIAT tray right wall',(.019,.072,.355),(.068,-.016,.383),steel)
    cube('PIAT padded butt',(.178,.181,.030),(0,-.040,-.505),olive)
    cube('PIAT trigger grip',(.055,.145,.061),(0,-.212,-.153),dark)
    cube('PIAT trigger housing',(.100,.080,.148),(0,-.110,-.16),dark)
    cube('PIAT left forearm rest',(.085,.067,.087),(0,-.144,.11),olive)
    cube('PIAT rear sight',(.075,.024,.055),(0,.081,-.245),dark)
    cube('PIAT front sight',(.065,.018,.045),(0,.068,.235),dark)
    assert len(created)>=10
    return created

def load_profile(root, weapon_id, imported_load):
    assert weapon_id in PROFILES, ("Unknown UK weapon",weapon_id)
    p=PROFILES[weapon_id]
    if p['model']:
        source=root/'assets/ww2-weapons'/p['model']
        assert source.is_file(),source
        weapon=imported_load(source)
    else:
        weapon=make_piat()
    assert any(o.type=='MESH' for o in weapon),(weapon_id,"No rendered weapon")
    return p, weapon
