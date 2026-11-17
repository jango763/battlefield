// Stage 3 regression test: exact committed American hero, no iPhone file picker.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const model = fs.readFileSync(path.join(__dirname, "../../assets/allied-soldiers/us-hero-quaternius.glb"));
const view = fs.readFileSync(path.join(__dirname, "../us-hero-stage3-autoload-iphone.html"), "utf8");
assert.equal(model.length, 4474936);
assert.equal(model.toString("ascii",0,4), "glTF");
assert.equal(crypto.createHash("sha256").update(model).digest("hex"),
 "082869ab37145cfc583fb4ad2e95c4ef3564e1a50d39137e085535670ed61f33");
const jsonLength = model.readUInt32LE(12);
const gltf = JSON.parse(model.subarray(20,20+jsonLength).toString("utf8"));
assert.equal(gltf.skins.length,1);
assert.equal(gltf.skins[0].joints.length,65);
assert.equal(gltf.meshes.length,36);
assert.deepEqual(gltf.animations.map(a=>a.name),
 ["Idle_Quaternius","Walk_Quaternius","Jog_Quaternius","Sprint_Quaternius"]);
assert(!/<input[^>]+type\s*=\s*["']file["']/i.test(view),"Manual file picker must not return");
assert(view.includes('"../assets/allied-soldiers/","us-hero-quaternius.glb"'));
assert(view.includes("await autoLoadHero()"));
assert(view.includes("native-clip-blend.js"));
console.log("STAGE3_US_HERO_GITHUB_AUTOLOAD_PASS",model.length,gltf.animations.length);
