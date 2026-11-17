#!/usr/bin/env python3
"""Audit real vertex skinning for the 65-bone US hero. No external dependencies."""
from __future__ import annotations
import json, struct, sys
from pathlib import Path

PATH = Path(__file__).resolve().parents[2] / "assets/allied-soldiers/us-hero-quaternius.glb"

def inspect(filename: Path) -> dict:
    raw = filename.read_bytes()
    assert raw[:4] == b"glTF", "not a GLB"
    assert struct.unpack_from("<I", raw, 8)[0] == len(raw), "broken GLB size"
    n, fourcc = struct.unpack_from("<II", raw, 12)
    assert fourcc == 0x4e4f534a, "missing JSON"
    gltf = json.loads(raw[20:20+n])
    end = 20+n
    bn, binary_fourcc = struct.unpack_from("<II", raw, end)
    assert binary_fourcc == 0x004e4942, "missing binary buffer"
    buffer = raw[end+8:end+8+bn]
    views = gltf["bufferViews"]
    accessors = gltf["accessors"]
    joints = gltf["skins"][0]["joints"]
    joint_names = [gltf["nodes"][i].get("name", "").split(":")[-1] for i in joints]
    finger_keys = [n for n in joint_names if
                   n.startswith(("LeftHand", "RightHand")) and
                   any(d in n for d in ("Thumb", "Index", "Middle", "Ring", "Pinky"))]
    usage = dict.fromkeys(finger_keys, 0)
    counts = {"LeftHand": 0, "RightHand": 0}

    def accessor_records(index: int):
        a = accessors[index]
        view = views[a["bufferView"]]
        comp = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}[a["componentType"]]
        width = {"VEC4": 4, "VEC3": 3}[a["type"]]
        stride = view.get("byteStride", width * comp[1])
        start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
        fmt = "<" + comp[0] * width
        return [struct.unpack_from(fmt, buffer, start + i*stride) for i in range(a["count"])]

    for mesh in gltf["meshes"]:
        for primitive in mesh["primitives"]:
            attr = primitive["attributes"]
            if "JOINTS_0" not in attr or "WEIGHTS_0" not in attr:
                continue
            skin_indices = accessor_records(attr["JOINTS_0"])
            skin_weights = accessor_records(attr["WEIGHTS_0"])
            for ji, wi in zip(skin_indices, skin_weights):
                for idx, weight in zip(ji, wi):
                    if not weight: continue
                    name = joint_names[idx]
                    if name in usage: usage[name] += 1
                    if name in counts: counts[name] += 1

    return {
        "file": str(filename), "bones": len(joints), "meshes": len(gltf["meshes"]),
        "animations": [a["name"] for a in gltf.get("animations", [])],
        "fingerBones": len(finger_keys), "fingerSkinWeights": usage,
        "fingerBonesWithAnyVertex": sum(x>0 for x in usage.values()),
        "wristVertexInfluences": counts,
        "hasUsableFingerSkinning": all(x>0 for x in usage.values())
    }

if __name__=="__main__":
    result=inspect(PATH if len(sys.argv)<2 else Path(sys.argv[1]))
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if not result["hasUsableFingerSkinning"]:
        print("STAGE4_BLOCKED: The hand/finger bones have no skinned vertices. "
              "IK cannot close the original hand mesh; re-rig or replace the hand meshes.",
              file=sys.stderr)
        sys.exit(2)
