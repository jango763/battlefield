"""Generate original, texture-free North African depot architecture in metres."""
import json, math, struct
from pathlib import Path
pos, normals, colors = [], [], []
def tri(a,b,c,tint):
    u=[b[i]-a[i] for i in range(3)]
    v=[c[i]-a[i] for i in range(3)]
    n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    length=math.hypot(*n)
    if length<1e-8:return
    for p in (a,b,c):
        pos.extend(p);normals.extend(k/length for k in n)
        shade=.75+.25*min(1,max(0,p[1]/3))
        colors.extend([round(255*k*shade) for k in tint]+[255])
def face(a,b,c,d,color):
    tri(a,b,c,color);tri(a,c,d,color)
sand=(.78,.61,.40); stone=(.64,.46,.29);shade=(.35,.25,.16)
# Three arches on each long elevation, thickness in the reveals.
for side in (-1,1):
    z=side*2.7;inside=z-side*.42
    for center in (-3,0,3):
        for i in range(12):
            a,b=[math.pi*j/12 for j in (i,i+1)]
            def point(t,r,depth):return (center+r*math.cos(t),1.45+r*math.sin(t),depth)
            p,q=point(a,1.12,z),point(b,1.12,z)
            h,k=point(a,1.39,z),point(b,1.39,z)
            face(p,q,k,h,tuple(x*(.94+.06*(i%3)/2) for x in stone))
            face(p,point(a,1.12,inside),point(b,1.12,inside),q,shade)
            face(h,k,(k[0],3.15,z),(h[0],3.15,z),sand)
        for sign in (-1,1):
            x=center+sign*1.12;y=center+sign*1.5
            face((x,0,z),(y,0,z),(y,3.15,z),(x,3.15,z),sand)
            face((x,0,z),(x,1.45,z),(x,1.45,inside),(x,0,inside),shade)
        # Dark back wall in arcade, recess can be seen from oblique views.
        zz=side*1.4
        face((center-1.5,0,zz),(center+1.5,0,zz),(center+1.5,3.15,zz),(center-1.5,3.15,zz),shade)
# Shallow barrel-vaulted roof with modeled end faces.
for i in range(20):
    a,b=[math.pi*j/20 for j in (i,i+1)]
    def roof(t,x):return (x,3.15+.95*math.sin(t),2.7*math.cos(t))
    face(roof(a,-4.5),roof(b,-4.5),roof(b,4.5),roof(a,4.5),(.75,.57,.34))
    for x in (-4.5,4.5):tri((x,3.15,0),roof(a,x),roof(b,x),sand)
for x in (-4.5,4.5):face((x,0,-2.7),(x,0,2.7),(x,3.15,2.7),(x,3.15,-2.7),sand)
count=len(pos)//3; arrays=[struct.pack('<%sf'%len(pos),*pos),struct.pack('<%sf'%len(normals),*normals),bytes(colors)]
views=[];access=[];binary=b''
for i,data in enumerate(arrays):
    views.append(dict(buffer=0,byteOffset=len(binary),byteLength=len(data),target=34962));binary+=data
    access.append(dict(bufferView=i,componentType=5121 if i==2 else 5126,count=count,type='VEC4' if i==2 else 'VEC3'))
access[0].update(min=[min(pos[j::3]) for j in range(3)],max=[max(pos[j::3]) for j in range(3)])
access[2]['normalized']=True
doc=dict(asset=dict(version='2.0',generator='Battlefield original arcade'),scene=0,scenes=[dict(nodes=[0])],nodes=[dict(mesh=0)],meshes=[dict(primitives=[dict(attributes=dict(POSITION=0,NORMAL=1,COLOR_0=2),material=0)])],materials=[dict(doubleSided=True,pbrMetallicRoughness=dict(metallicFactor=0,roughnessFactor=.94))],buffers=[dict(byteLength=len(binary))],bufferViews=views,accessors=access)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
out=struct.pack('<4sIIII',b'glTF',2,28+len(j)+len(binary),len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
(Path(__file__).resolve().parents[1]/'art/models/libya-arcade.glb').write_bytes(out)
