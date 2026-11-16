import json,struct,bisect,math,base64,zlib,hashlib,pathlib
from functools import lru_cache
SRC=pathlib.Path('babylon/assets/quaternius/universal-animation-library.glb')
OUT=pathlib.Path('babylon/assets/quaternius/hero-motion-pack.json')
TARGET=['pelvis','spine_01','spine_02','spine_03','neck_01','Head','clavicle_l','upperarm_l','lowerarm_l','hand_l','clavicle_r','upperarm_r','lowerarm_r','hand_r','thigh_l','calf_l','foot_l','ball_l','thigh_r','calf_r','foot_r','ball_r']
CLIPS=['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop']
FPS=18
b=SRC.read_bytes();assert b[:4]==b'glTF'
jlen,jtype=struct.unpack_from('<II',b,12);assert jtype==0x4e4f534a
doc=json.loads(b[20:20+jlen]);off=(20+jlen+3)&~3
blen,btype=struct.unpack_from('<II',b,off);assert btype==0x004e4942
buf=memoryview(b)[off+8:off+8+blen]
nodes=doc['nodes'];inds={n.get('name'):i for i,n in enumerate(nodes)}
assert all(n in inds for n in TARGET)
parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
def mul(a,b):
 x,y,z,w=a;X,Y,Z,W=b
 return (w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z)
def inv(q):return (-q[0],-q[1],-q[2],q[3])
def unit(q):
 d=math.sqrt(sum(x*x for x in q))
 return tuple(x/d for x in q)
def slerp(a,b,t):
 dot=sum(x*y for x,y in zip(a,b))
 if dot<0:b=tuple(-x for x in b);dot=-dot
 if dot>.9995:return unit(tuple(x+(y-x)*t for x,y in zip(a,b)))
 theta=math.acos(max(-1,min(1,dot)));p=math.sin((1-t)*theta)/math.sin(theta);q=math.sin(t*theta)/math.sin(theta)
 return tuple(p*x+q*y for x,y in zip(a,b))
@lru_cache(None)
def acc(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
 fmt={5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']];size=struct.calcsize('<'+fmt)
 n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
 start=v.get('byteOffset',0)+a.get('byteOffset',0);step=v.get('byteStride',n*size)
 return [struct.unpack_from('<'+fmt*n,buf,start+k*step) for k in range(a['count'])]
rest=[unit(tuple(n.get('rotation',[0,0,0,1]))) for n in nodes]
@lru_cache(None)
def world(i):return mul(world(parents[i]),rest[i]) if i in parents else rest[i]
out={'version':1,'fps':FPS,'joints':TARGET,'clips':{},'sourceSha256':hashlib.sha256(b).hexdigest(),'format':'zlib-int16-world-quaternion-delta'}
for name in CLIPS:
 anim=next(a for a in doc['animations'] if a.get('name')==name)
 tracks={};end=0
 for ch in anim['channels']:
  if ch['target']['path']!='rotation':continue
  i=ch['target']['node'];s=anim['samplers'][ch['sampler']]
  times=[x[0] for x in acc(s['input'])];values=acc(s['output']);interp=s.get('interpolation','LINEAR')
  if interp=='CUBICSPLINE':values=values[1::3]
  if len(times)!=len(values):continue
  tracks[i]=(times,values,interp);end=max(end,times[-1])
 assert end>0
 count=max(2,round(end*FPS)+1);frames=[end*k/(count-1) for k in range(count)]
 packed=bytearray();prev=[None]*len(TARGET)
 for t in frames:
  local=list(rest)
  for i,(times,values,interp) in tracks.items():
   k=bisect.bisect_right(times,t)
   if k==0:q=values[0]
   elif k>=len(times):q=values[-1]
   else:
    u=(t-times[k-1])/max(1e-9,times[k]-times[k-1])
    q=values[k-1] if interp=='STEP' else slerp(values[k-1],values[k],u)
   local[i]=unit(q)
  current={}
  def currentWorld(i):
   if i not in current:current[i]=mul(currentWorld(parents[i]),local[i]) if i in parents else local[i]
   return current[i]
  for j,n in enumerate(TARGET):
   i=inds[n];q=unit(mul(currentWorld(i),inv(world(i))))
   if prev[j] is None:
    if q[3]<0:q=tuple(-x for x in q)
   elif sum(x*y for x,y in zip(q,prev[j]))<0:q=tuple(-x for x in q)
   prev[j]=q
   packed.extend(struct.pack('<4h',*(round(max(-1,min(1,v))*32767) for v in q)))
 comp=zlib.compress(packed,9)
 out['clips'][name]={'frames':count,'duration':round(end,6),'bytes':len(packed),'compressed':len(comp),'packed':base64.b64encode(comp).decode('ascii')}
 print(name,end,count,len(comp))
OUT.write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf-8')
print('SUCCESS',OUT.stat().st_size,out['sourceSha256'])
