#!/usr/bin/env python3
"""Transfer the real PRE-WORK Quaternius lower-body rotations to Jakeli's
new anatomical 65-bone rest rig, without replacing the mesh, weights, or rifle.
Source of truth: assets/allied-soldiers/us-hero-quaternius-donor-hands-v7.glb.
Only Blender bone-space poses are produced; no donor geometry is ever exported.
"""
import bisect
import json
import math
import re
import struct
from pathlib import Path
from mathutils import Quaternion

MOTION = {"Walk": "Walk_Quaternius", "Jog": "Jog_Quaternius", "Sprint": "Sprint_Quaternius"}
LOWER = tuple(side + limb for side in ("Left", "Right")
              for limb in ("UpLeg", "Leg", "Foot", "ToeBase", "Toe_End"))
REQUIRED = tuple(side + limb for side in ("Left", "Right")
                 for limb in ("UpLeg", "Leg", "Foot"))


def canonical(name):
    return re.sub(r"_\\d+$", "", name.replace("mixamorig:", ""))


def q_from_gltf(v):
    return Quaternion((v[3], v[0], v[1], v[2])).normalized()


class QuaterniusLowerBody:
    def __init__(self, donor_path, target_rig):
        path = Path(donor_path)
        raw = path.read_bytes()
        assert raw[:4] == b"glTF" and struct.unpack_from("<I", raw, 8)[0] == len(raw)
        pos, document, binary = 12, None, None
        while pos < len(raw):
            count, kind = struct.unpack_from("<II", raw, pos)
            pos += 8
            chunk = raw[pos:pos + count]
            if kind == 0x4e4f534a:
                document = json.loads(chunk)
            if kind == 0x004e4942:
                binary = chunk
            pos += count
        assert document is not None and binary is not None
        assert len(document.get("skins", [])) == 1
        assert len(document["skins"][0]["joints"]) == 65
        self.path = str(path.relative_to(path.parents[2]))
        self.data, self.bin = document, binary
        self.nodes = document["nodes"]
        self.node_by_name = {canonical(n.get("name", "")): i
                             for i, n in enumerate(self.nodes) if n.get("name")}
        assert len(set(REQUIRED) - set(self.node_by_name)) == 0, "Missing donor legs"
        self.parents = {child: i for i, n in enumerate(self.nodes)
                        for child in n.get("children", [])}
        local = {}
        for i, n in enumerate(self.nodes):
            if "matrix" in n:
                from mathutils import Matrix
                flat = n["matrix"]
                mat = Matrix([[flat[col * 4 + row] for col in range(4)]
                              for row in range(4)])
                local[i] = mat.to_quaternion().normalized()
            else:
                local[i] = q_from_gltf(n.get("rotation", [0, 0, 0, 1]))
        self.rest_local = local
        world_cache = {}
        def world(i):
            if i not in world_cache:
                p = self.parents.get(i)
                world_cache[i] = (world(p) @ local[i] if p is not None
                                  else local[i]).normalized()
            return world_cache[i]
        # glTF uses Y-up and Blender uses Z-up; convert the *parent's*
        # physical rest-space axes before transferring any joint deltas.
        gltf_to_blender = Quaternion((1, 0, 0), math.pi / 2)
        self.parent_world = {}
        for name in LOWER:
            if name not in self.node_by_name:
                continue
            i = self.node_by_name[name]
            p = self.parents.get(i)
            self.parent_world[name] = (gltf_to_blender @
                                       (world(p) if p is not None
                                        else Quaternion((1, 0, 0, 0)))).normalized()
        self.target_rest = {}
        for name in LOWER:
            if name in self.node_by_name:
                assert name in target_rig.pose.bones, name
                self.target_rest[name] = target_rig.data.bones[name].matrix_local.to_quaternion()
        self.target_rig = target_rig
        self.clips = {}
        for short, original in MOTION.items():
            a = next((a for a in document["animations"] if a["name"] == original), None)
            assert a is not None, "Missing authentic pre-Work clip: " + original
            channels = {}
            duration = 0
            for ch in a["channels"]:
                if ch["target"]["path"] != "rotation":
                    continue
                node_id = ch["target"]["node"]
                name = canonical(self.nodes[node_id].get("name", ""))
                if name not in LOWER:
                    continue
                sampler = a["samplers"][ch["sampler"]]
                interpolation = sampler.get("interpolation", "LINEAR")
                assert interpolation in ("LINEAR", "STEP"), (original, name, interpolation)
                times = [v[0] for v in self.read_accessor(sampler["input"])]
                values = [q_from_gltf(v) for v in self.read_accessor(sampler["output"])]
                assert len(times) >= 2 and len(times) == len(values)
                assert times == sorted(times), (original, name, "out-of-order keys")
                duration = max(duration, times[-1])
                channels[name] = (times, values, interpolation)
            assert all(n in channels for n in REQUIRED), (
                "Pre-Work Quaternius clip has incomplete legs", original,
                sorted(set(REQUIRED) - set(channels)))
            assert .35 < duration < 5, (original, duration)
            self.clips[short] = {"name": original, "duration": duration, "bones": channels}
        self.last_quat = {}
        self.audit = {}
        for short in MOTION:
            sample = self.clips[short]["bones"]
            excursion = max(math.degrees(self.sample_curve(sample[n], 0).rotation_difference(
                    self.sample_curve(sample[n], self.clips[short]["duration"] * .31)).angle)
                    for n in REQUIRED)
            assert excursion > 4.0, (short, "static/dummy lower-body motion", excursion)
            self.audit[short] = {
                "source": MOTION[short], "durationSeconds": self.clips[short]["duration"],
                "legChannels": len(sample), "maxLegExcursion31PctDeg": round(excursion, 2),
            }

    def read_accessor(self, index):
        a = self.data["accessors"][index]
        assert a["componentType"] == 5126 and not a.get("sparse"), index
        dim = {"SCALAR": 1, "VEC4": 4}[a["type"]]
        view = self.data["bufferViews"][a["bufferView"]]
        start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = view.get("byteStride", 4 * dim)
        assert start + (a["count"] - 1) * stride + 4 * dim <= len(self.bin), index
        return [struct.unpack_from("<" + "f" * dim, self.bin, start + k * stride)
                for k in range(a["count"])]

    @staticmethod
    def sample_curve(curve, t):
        times, values, interpolation = curve
        index = max(0, min(len(times) - 2, bisect.bisect_right(times, t) - 1))
        if t <= times[0]:
            return values[0].copy()
        if t >= times[-1]:
            return values[-1].copy()
        u = (t - times[index]) / max(1e-9, times[index + 1] - times[index])
        if interpolation == "STEP":
            return values[index].copy()
        return values[index].slerp(values[index + 1], u).normalized()

    def apply(self, short_name, progress):
        """Write only lower-body Blender pose-basis rotations at normalized time."""
        clip = self.clips[short_name]
        t = max(0.0, min(1.0, progress)) * clip["duration"]
        for name, curve in clip["bones"].items():
            src = self.sample_curve(curve, t)
            donor_rest = self.rest_local[self.node_by_name[name]]
            src_parent = self.parent_world[name]
            target_rest = self.target_rest[name]
            # The donor's animated local orientation minus its REST orientation.
            # Express that anatomical swing in target bone-rest coordinates;
            # direct Euler/absolute quaternion copying twists the new legs.
            delta_parent = src @ donor_rest.inverted()
            delta_world = src_parent @ delta_parent @ src_parent.inverted()
            target_local = (target_rest.inverted() @ delta_world @ target_rest).normalized()
            old = self.last_quat.get(name)
            if old is not None and old.dot(target_local) < 0:
                target_local.negate()
            self.last_quat[name] = target_local.copy()
            self.target_rig.pose.bones[name].rotation_quaternion = target_local
