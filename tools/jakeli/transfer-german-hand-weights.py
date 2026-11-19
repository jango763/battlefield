#!/usr/bin/env python3
"""Experimental skin-only transfer: approved German artist weights -> actual Jakeli gloves.

Both rest skeletons coincide under scale 0.019 + per-side translation;
verified from 16 independent hand / finger landmarks on each side.
This never replaces Jakeli geometry, animations, GLB materials or skeleton.
The original Jakeli prototype remains separately available for rollback.
"""
import json
import re
import struct
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation

ROOT = Path(__file__).resolve().parents[2]
GERMAN = ROOT / "assets/soldiers/german.glb"
BRITISH = ROOT / "assets/allied-soldiers/uk-jakeli-prototype-65b.glb"
OUTPUT = ROOT / "assets/allied-soldiers/uk-jakeli-german-skin-v1.glb"


class GLB:
    def __init__(self, path):
        self.data = bytearray(path.read_bytes())
        assert self.data[:4] == b"glTF"
        assert struct.unpack_from("<I", self.data, 8)[0] == len(self.data)
        length = struct.unpack_from("<I", self.data, 12)[0]
        self.doc = json.loads(self.data[20:20 + length])
        self.buffer = memoryview(self.data)[20 + length + 8:]
        self.nodes = self.doc["nodes"]
        self.names = [n.get("name", "") for n in self.nodes]
        self.parents = {c: i for i, n in enumerate(self.nodes) for c in n.get("children", [])}
        self.matrices = {}

    def world_matrix(self, idx):
        if idx in self.matrices:
            return self.matrices[idx]
        n = self.nodes[idx]
        if "matrix" in n:
            mat = np.asarray(n["matrix"]).reshape(4, 4).T
        else:
            mat = np.eye(4)
            mat[:3, :3] = Rotation.from_quat(n.get("rotation", [0, 0, 0, 1])).as_matrix() * np.asarray(n.get("scale", [1, 1, 1]))[None, :]
            mat[:3, 3] = n.get("translation", [0, 0, 0])
        if idx in self.parents:
            mat = self.world_matrix(self.parents[idx]) @ mat
        self.matrices[idx] = mat
        return mat

    def accessor(self, idx):
        a = self.doc["accessors"][idx]
        view = self.doc["bufferViews"][a["bufferView"]]
        assert not a.get("sparse"), "Sparse geometry unsupported"
        dtype = {5126: np.float32, 5121: np.uint8, 5123: np.uint16, 5125: np.uint32}[a["componentType"]]
        dimension = {"SCALAR": 1, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
        stride = view.get("byteStride", np.dtype(dtype).itemsize * dimension)
        offset = view.get("byteOffset", 0) + a.get("byteOffset", 0)
        return np.ndarray((a["count"], dimension), dtype=dtype, buffer=self.buffer, offset=offset,
                          strides=(stride, np.dtype(dtype).itemsize))

    def skin_names(self):
        return [self.names[n] for n in self.doc["skins"][0]["joints"]]

    def bone_position(self, side, key):
        pattern = re.compile("mixamorig:" + side + key + r"($|_)")
        for node_id in self.doc["skins"][0]["joints"]:
            if pattern.search(self.names[node_id]):
                return self.world_matrix(node_id)[:3, 3]
        raise ValueError("Missing " + side + key)


german = GLB(GERMAN)
jakeli = GLB(BRITISH)
assert len(german.doc["skins"][0]["joints"]) == 65
assert len(jakeli.doc["skins"][0]["joints"]) == 65
assert len(jakeli.doc["animations"]) == 4
names_german, names_jakeli = german.skin_names(), jakeli.skin_names()
lookup = {name: i for i, name in enumerate(names_jakeli)}
assert any(n.endswith("RightHandIndex4_30") for n in names_german), "Expected authentic approved German hand"
assert any(n.endswith("RightHandIndex3") for n in names_jakeli)

def target_joint_name(name):
    canonical = re.sub(r"_\d+$", "", name)
    # German finger end segment #4 is collapsed onto the donor's final #3.
    canonical = re.sub(r"(Hand(?:Thumb|Index|Middle|Ring|Pinky))4$", r"\g<1>3", canonical)
    return lookup.get(canonical)

counts = {}
for side, sign in [("Right", -1), ("Left", 1)]:
    # Test the *entire* hand, not a synthetic coincident socket.
    landmarks = ["Hand", "HandThumb1", "HandThumb2", "HandThumb3",
                 "HandIndex1", "HandIndex2", "HandIndex3",
                 "HandMiddle1", "HandMiddle2", "HandMiddle3",
                 "HandRing1", "HandRing2", "HandRing3",
                 "HandPinky1", "HandPinky2", "HandPinky3"]
    anchors_old = np.stack([german.bone_position(side, k) for k in landmarks])
    anchors_new = np.stack([jakeli.bone_position(side, k) for k in landmarks])
    scale = 0.019
    offset = jakeli.bone_position(side, "Hand") - german.bone_position(side, "Hand") * scale
    alignment_error = float(np.max(np.linalg.norm(anchors_old * scale + offset - anchors_new, axis=1)))
    assert alignment_error < 0.0002, f"{side}: the approved German bones do not align: {alignment_error}"

    points, weights_from_artist = [], []
    for node_id, node in enumerate(german.nodes):
        if node.get("skin") != 0 or "mesh" not in node:
            continue
        world = german.world_matrix(node_id)
        for primitive in german.doc["meshes"][node["mesh"]]["primitives"]:
            a = primitive["attributes"]
            verts = german.accessor(a["POSITION"])
            joints = german.accessor(a["JOINTS_0"])
            weights = german.accessor(a["WEIGHTS_0"])
            for i, vertex in enumerate(verts):
                mapped, own_hand = {}, 0.
                for c in range(4):
                    w = float(weights[i, c])
                    if w < 0.001:
                        continue
                    name = names_german[int(joints[i, c])]
                    target = target_joint_name(name)
                    if target is None:
                        continue
                    if "mixamorig:" + side + "Hand" in name:
                        own_hand += w
                    mapped[target] = mapped.get(target, 0) + w
                if own_hand < 0.65:
                    continue
                world_point = (world @ np.r_[vertex, 1.])[:3] * scale + offset
                points.append(world_point)
                weights_from_artist.append(mapped)

    assert len(points) > 1500, f"{side}: missing original artist-weighted German hand vertices"
    tree = cKDTree(np.asarray(points))
    touched = untouched = 0
    nearest_distances = []

    for node in jakeli.nodes:
        if node.get("skin") != 0 or "mesh" not in node:
            continue
        if jakeli.doc["meshes"][node["mesh"]]["name"] != "SLD_1_Material #21_0":
            continue
        for primitive in jakeli.doc["meshes"][node["mesh"]]["primitives"]:
            a = primitive["attributes"]
            verts = jakeli.accessor(a["POSITION"])
            joints = jakeli.accessor(a["JOINTS_0"])
            weights = jakeli.accessor(a["WEIGHTS_0"])
            for i, vertex in enumerate(verts):
                if vertex[0] * sign < 0:
                    continue
                distances, sample_ids = tree.query(vertex, k=5)
                distance = float(distances[0])
                nearest_distances.append(distance)
                if distance > .03:  # No comparable German surface: keep original weights
                    untouched += 1
                    continue
                proposed = {}
                for d, sample_idx in zip(distances, sample_ids):
                    influence = 1. / (float(d) ** 2 + 0.000003)
                    for joint, w in weights_from_artist[int(sample_idx)].items():
                        proposed[joint] = proposed.get(joint, 0) + w * influence
                # No opposite-side bones on any British glove.
                proposed = {j: w for j, w in proposed.items() if side in names_jakeli[j]}
                if not proposed:
                    untouched += 1
                    continue
                proposed = sorted(proposed.items(), key=lambda t: t[1], reverse=True)[:4]
                total = sum(w for _, w in proposed)
                blend = .85 if distance < .012 else .85 - .55 * min(1., (distance - .012) / .018)
                merged = {}
                for j, w in proposed:
                    merged[j] = merged.get(j, 0) + blend * w / total
                for j, w in zip(joints[i].copy(), weights[i].copy()):
                    merged[int(j)] = merged.get(int(j), 0) + (1 - blend) * float(w)
                merged = sorted(merged.items(), key=lambda t: t[1], reverse=True)[:4]
                total = sum(w for _, w in merged)
                joints[i] = 0
                weights[i] = 0
                for c, (j, w) in enumerate(merged):
                    joints[i, c] = j
                    weights[i, c] = w / total
                touched += 1

    p95 = float(np.percentile(nearest_distances, 95))
    assert touched >= 1750 and untouched < 150 and p95 < .03, f"{side} insufficient transfer: {touched} / {untouched}"
    counts[side] = {"transferredVertices": touched, "unchangedVertices": untouched,
                    "maxBoneErrorMeters": alignment_error,
                    "surfaceMatchP95Meters": p95}

OUTPUT.write_bytes(jakeli.data)
assert OUTPUT.read_bytes()[:4] == b"glTF"
print("JAKELI_GERMAN_WEIGHT_TRANSFER_PASS", json.dumps(counts, sort_keys=True))
print("JAKELI_GERMAN_WEIGHT_EXPERIMENTAL_FILE", OUTPUT, OUTPUT.stat().st_size)


# Separate, artist-modeled hand geometry trial. Unlike changing skin
# weights alone, this uses the REAL approved German finger/knuckle mesh.
# It reuses the existing Jakeli skeleton, outfit and four animation clips.
# Retain both old GLBs for comparison and never mark gameplay-ready.
hand_mesh=german.doc["meshes"][4]["primitives"][0]
hand_a=hand_mesh["attributes"]
g_position=german.accessor(hand_a["POSITION"])
g_normal=german.accessor(hand_a["NORMAL"])
g_joints=german.accessor(hand_a["JOINTS_0"])
g_weights=german.accessor(hand_a["WEIGHTS_0"])
g_faces=german.accessor(hand_mesh["indices"]).reshape(-1,3)
g_meshnode=next(i for i,n in enumerate(german.nodes) if n.get("mesh")==4 and n.get("skin")==0)
g_meshworld=german.world_matrix(g_meshnode)
dest_names={n:i for i,n in enumerate(names_jakeli)}
def map_artist_joint(idx):
    source=re.sub(r"_\d+$","",names_german[int(idx)])
    source=re.sub(r"(Hand(?:Thumb|Index|Middle|Ring|Pinky))4$",r"\g<1>3",source)
    return dest_names.get(source)

hand_positions=[]
hand_normals=[]
hand_joint_rows=[]
hand_weight_rows=[]
hand_face_rows=[]
hand_report={}
for side in ["Left","Right"]:
    scale=0.019
    shift=jakeli.bone_position(side,"Hand")-german.bone_position(side,"Hand")*scale
    control=["Hand","HandThumb1","HandThumb2","HandThumb3",
             "HandIndex1","HandIndex2","HandIndex3",
             "HandMiddle1","HandMiddle2","HandMiddle3",
             "HandRing1","HandRing2","HandRing3",
             "HandPinky1","HandPinky2","HandPinky3"]
    bone_error=max(np.linalg.norm(german.bone_position(side,k)*scale+shift-jakeli.bone_position(side,k)) for k in control)
    assert bone_error<.0002,(side,bone_error)
    mask=np.array([("mixamorig:"+side+"Hand") in name for name in names_german])
    dominant=(g_weights*mask[g_joints]).sum(axis=1)
    faces=g_faces[(dominant[g_faces]>.58).all(axis=1)]
    old_ids,reindex=np.unique(faces.reshape(-1),return_inverse=True)
    assert len(old_ids)>1500,side
    offset=len(hand_positions)
    for old in old_ids:
        position=(g_meshworld@np.r_[g_position[old],1])[:3]*scale+shift
        influences={}
        for joint_id,weight in zip(g_joints[old],g_weights[old]):
            new_id=map_artist_joint(joint_id)
            if new_id is not None and weight>0:
                influences[new_id]=influences.get(new_id,0.)+float(weight)
        assert influences,(side,old)
        strongest=sorted(influences.items(),key=lambda v:v[1],reverse=True)[:4]
        weight_sum=sum(w for _,w in strongest)
        hand_positions.append(position)
        hand_normals.append(g_normal[old])
        hand_joint_rows.append([j for j,_ in strongest]+[0]*(4-len(strongest)))
        hand_weight_rows.append([w/weight_sum for _,w in strongest]+[0.]*(4-len(strongest)))
    hand_face_rows.extend((offset+reindex).reshape(-1,3).tolist())
    hand_report[side]={"artistVertices":int(len(old_ids)),
                       "originalTriangles":int(len(faces)),
                       "restBoneMismatchMeters":float(bone_error)}

new_bin=bytearray(jakeli.buffer.tobytes())
document=jakeli.doc
def add_array(values,component,type_,target=34962):
    data=np.ascontiguousarray(values)
    new_bin.extend(bytes((-len(new_bin))%4))
    start=len(new_bin)
    new_bin.extend(data.tobytes())
    buffer_view=len(document["bufferViews"])
    document["bufferViews"].append({"buffer":0,"byteOffset":start,"byteLength":int(data.nbytes),"target":target})
    a={"bufferView":buffer_view,"componentType":component,"count":int(len(data)),"type":type_}
    if type_=="VEC3":
        a["min"]=data.min(axis=0).tolist()
        a["max"]=data.max(axis=0).tolist()
    document["accessors"].append(a)
    return len(document["accessors"])-1

attributes={
 "POSITION":add_array(np.asarray(hand_positions,dtype=np.float32),5126,"VEC3"),
 "NORMAL":add_array(np.asarray(hand_normals,dtype=np.float32),5126,"VEC3"),
 "JOINTS_0":add_array(np.asarray(hand_joint_rows,dtype=np.uint8),5121,"VEC4"),
 "WEIGHTS_0":add_array(np.asarray(hand_weight_rows,dtype=np.float32),5126,"VEC4")
}
indices=add_array(np.asarray(hand_face_rows,dtype=np.uint32).reshape(-1,1),5125,"SCALAR",34963)
document["materials"].append({
 "name":"Real approved German hand geometry - neutral British glove test",
 "pbrMetallicRoughness":{"baseColorFactor":[.46,.335,.245,1],"metallicFactor":0,"roughnessFactor":.9},
 "doubleSided":True
})
material=len(document["materials"])-1
old_gloves=next(i for i,m in enumerate(document["meshes"]) if m["name"]=="SLD_1_Material #21_0")
document["meshes"][old_gloves]["name"]="Jakeli - real artist skinned hands test"
document["meshes"][old_gloves]["primitives"]=[{
 "attributes":attributes,"indices":indices,"material":material,"mode":4
}]
document["asset"].setdefault("extras",{})["handsTrial"]={
 "source":"approved German model - real hand mesh, not nearest-neighbor deformation",
 "notGameReady":True,"artistSource":hand_report
}
new_bin.extend(bytes((-len(new_bin))%4))
document["buffers"][0]["byteLength"]=len(new_bin)
jbytes=json.dumps(document,ensure_ascii=False,separators=(",",":")).encode()
jbytes+=b" "*((-len(jbytes))%4)
final=bytearray(struct.pack("<4sII",b"glTF",2,12+8+len(jbytes)+8+len(new_bin)))
final+=struct.pack("<I4s",len(jbytes),b"JSON")+jbytes
final+=struct.pack("<I4s",len(new_bin),b"BIN\x00")+new_bin
real_hand_output=ROOT/"assets/allied-soldiers/uk-jakeli-german-real-hands-v1.glb"
real_hand_output.write_bytes(final)
assert final[:4]==b"glTF"
print("JAKELI_REAL_GERMAN_HAND_MESH_CREATED",json.dumps({"hands":hand_report,"bytes":len(final)}))
