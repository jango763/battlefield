#!/usr/bin/env python3
"""Install local CC0 scanned PBR maps for Battlefield Babylon (no runtime CDN).
Source: https://polyhaven.com ; license: CC0 https://polyhaven.com/license
Files are re-encoded 1K JPG for Safari loading. Never use unknown hosts.
"""
import io
import json
import sys
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "art"
MATERIALS = {
    "mud": "brown_mud_leaves_01",
    "plaster": "plastered_wall_05",
    "brick": "brick_wall_001",
    "stone": "stone_wall",
    "wood": "weathered_planks",
}
UA = "BattlefieldIndie/0.1 (+github.com/jango763/battlefield; CC0 asset attribution audit)"
def fetch(url, limit=12_000_000):
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=45) as res:
        raw = res.read(limit+1)
        if len(raw)>limit: raise RuntimeError("Oversized texture: "+url)
        return raw
def suburl(variant):
    """Pick a 1K JPEG (otherwise PNG) without resorting to high-res payloads."""
    tier = variant.get("1k") or variant.get("1K") or {}
    for fmt in ("jpg","jpeg","png"):
        v=tier.get(fmt)
        if isinstance(v,dict) and v.get("url"):return v["url"]
    return None
def choose(files,map_name):
    by_name = {str(k).lower(): k for k in files}
    if map_name=="diffuse":
        names=["diffuse","diff","albedo","color","basecolor"]
    else:
        names=["nor_gl","normal","normalgl","normal_gl"]
    for name in names:
        for key in by_name:
            if name==key or key.startswith(name+"_"):
                url=suburl(files[by_name[key]])
                if url:return url
    print("available keys:",list(files))
    raise RuntimeError("No 1K "+map_name+" in "+str(list(files)))
def save_jpeg(blob,path):
    pic=Image.open(io.BytesIO(blob)).convert("RGB")
    if max(pic.size)>1024:pic.thumbnail((1024,1024),Image.Resampling.LANCZOS)
    if min(pic.size)<512:raise RuntimeError("Source too small: "+str(pic.size))
    pic.save(path,"JPEG",quality=81,subsampling=0,optimize=True)
    print(path.name, pic.size, path.stat().st_size)
def main():
    ROOT.mkdir(parents=True,exist_ok=True)
    manifest={"source":"Poly Haven","license":"CC0 1.0","source_url":"https://polyhaven.com",
              "materials":{}}
    for name,slug in MATERIALS.items():
        info=json.loads(fetch("https://api.polyhaven.com/files/"+slug,limit=2_000_000))
        maps={}
        for key in ("diffuse","normal"):
            url=choose(info,key)
            if not url.startswith("https://dl.polyhaven.org/"):
                raise RuntimeError("Untrusted CDN URL "+url)
            output=ROOT/(name+"-"+("base" if key=="diffuse" else "normal")+".jpg")
            save_jpeg(fetch(url),output)
            maps[key]={"path":output.name,"source":url,"bytes":output.stat().st_size}
        manifest["materials"][name]={"asset_id":slug,"asset_page":"https://polyhaven.com/a/"+slug,
                                     "maps":maps}
    (ROOT/"SOURCE_LICENSES.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    print("MODERN_CC0_TEXTURES_READY",len(MATERIALS),len(list(ROOT.glob("*.jpg"))))
if __name__=="__main__":
    try: main()
    except Exception as e:
        print("ERROR:",str(e),file=sys.stderr)
        raise
