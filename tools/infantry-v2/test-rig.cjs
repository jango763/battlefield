const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.THREE=require('./vendor/three.min.js');global.self=globalThis;
THREE.TextureLoader.prototype.load=function(url,done){const t=new THREE.Texture();t.image={width:512,height:512};queueMicrotask(()=>done(t));return t;};
require('./vendor/GLTFLoader.js');
const raw=fs.readFileSync(__dirname+'/german.glb');
new THREE.GLTFLoader().parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length),'',gltf=>{
  const controls={};const scene=new THREE.Scene(),U=[];
  const ctx={THREE,U,console,setTimeout(){},document:{createElement(){return {style:{}}},body:{appendChild(){}},getElementById(id){return controls[id]||(controls[id]={textContent:'',addEventListener(){}});}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/german-v2.js','utf8')+'\nthis.API={germanPreview,attachGermanSoldier,animateGermanSoldier,germanSkeletonClone,prepareSoldierGeometry,soldierMaterial};',ctx);
  const api=ctx.API;gltf.scene.updateMatrixWorld(true);api.prepareSoldierGeometry(gltf.scene);api.germanPreview.template=gltf.scene;api.germanPreview.bounds=new THREE.Box3().setFromObject(gltf.scene);
  function unit(x,z,angle,extra={}){const root=new THREE.Group(),spine=new THREE.Group(),plate=new THREE.Mesh(new THREE.SphereGeometry(.5),new THREE.MeshBasicMaterial()),marker=new THREE.Mesh(new THREE.RingGeometry(.9,1),new THREE.MeshBasicMaterial());spine.add(plate);root.add(spine,marker);root.scale.setScalar(extra.cmd?1.375:extra.kind==='p'?1.32:1.1);root.position.set(x,0,z);root.rotation.y=angle;scene.add(root);const u={x,z,t:'red',hp:40,sv:0,aim:0,kick:0,m:{g:root,plate},g:root,...extra};U.push(u);api.attachGermanSoldier(u);return u;}
  const one=unit(0,0,0),two=unit(12,-9,1.2);assert(one.germanPreview&&two.germanPreview);
  const s1=[],s2=[];one.germanPreview.figure.traverse(n=>{if(n.isBone)s1.push(n)});two.germanPreview.figure.traverse(n=>{if(n.isBone)s2.push(n)});assert(s1.every((b,i)=>b!==s2[i]),'Clones must have independent bones');
  const errors=[],poses=[],renderStates=[];
  for(const [state,speed,aim,yaw] of [['idle',0,0,0],['walk',4,0,0],['fire',0,1,.5],['move-fire',4,1,-.65]]){
    one.sv=speed;one.aim=aim;one.aimT=yaw;
    for(let i=0;i<120;i++){
      one.m.plate.visible=true;one.kick=aim&&i%20<4?.08:0;api.animateGermanSoldier(one,1/60);
      assert.equal(one.germanPreview.legacy.visible,false,'Old armor must stay hidden');
      const v=one.germanPreview;
      for(const [bone,target] of [[v.bones.rHand,v.weapon.rear],[v.bones.lHand,v.weapon.front]])errors.push(bone.localToWorld(new THREE.Vector3(0,.11/v.figure.scale.x,0)).distanceTo(target.getWorldPosition(new THREE.Vector3())));
      v.figure.traverse(n=>{assert(n.position.toArray().concat(n.quaternion.toArray()).every(Number.isFinite),'Non-finite rig transform');});
    }
    const v=one.germanPreview;const nodes=[];v.figure.traverse(n=>nodes.push({name:n.name,position:n.position.toArray(),quaternion:n.quaternion.toArray(),scale:n.scale.toArray()}));
    poses.push({state,nodes,weapon:v.weapon.root.toJSON(),anchor:v.anchor.position.toArray()});
    scene.updateMatrixWorld(true);const meshes=[];
    v.anchor.traverse(n=>{if(!n.isMesh)return;for(let p=n;p;p=p.parent)if(!p.visible)return;if(n.skeleton)n.skeleton.update();
      const g=n.geometry,pos=g.attributes.position,uv=g.attributes.uv,points=[],vtx=new THREE.Vector3();
      for(let i=0;i<pos.count;i++){vtx.fromBufferAttribute(pos,i);if(n.isSkinnedMesh)n.boneTransform(i,vtx);vtx.applyMatrix4(n.matrixWorld);points.push(vtx.toArray());}
      meshes.push({name:n.name,vertices:points,indices:g.index?Array.from(g.index.array):Array.from({length:pos.count},(_,i)=>i),uv:uv?Array.from(uv.array):null,material:n.material.name,color:n.material.color.toArray(),uniformTint:n.material.userData.uniformTint||null,uniformMask:g.attributes.uniformMask?Array.from(g.attributes.uniformMask.array):null});
    });renderStates.push({state,meshes});
  }
  const maxError=Math.max(...errors);assert(maxError<.035,'Hands detached from rifle: '+maxError);
  one.type='mg';api.animateGermanSoldier(one,.016);assert(one.germanPreview.weapon.machineGun.visible);
  one.hv=true;one.ammo=2;api.animateGermanSoldier(one,.016);assert(one.germanPreview.weapon.launcher.visible);assert(!one.germanPreview.weapon.rifle.visible);
  one.ammo=0;api.animateGermanSoldier(one,.016);assert(!one.germanPreview.weapon.launcher.visible);assert(one.germanPreview.weapon.machineGun.visible);
  one.type='rf';one.hv=false;api.animateGermanSoldier(one,.016);assert(one.germanPreview.weapon.rifle.visible);assert(!one.germanPreview.weapon.machineGun.visible);
  const roles=[unit(0,0,0,{kind:'p',t:'grey',side:'blue',wpn:0}),unit(0,0,0,{cmd:true}),unit(0,0,0,{eng:true}),unit(0,0,0,{t:'blue'})];
  assert.deepEqual(roles.map(u=>u.germanPreview.role),['hero','captain','engineer','infantry']);
  for(const u of roles){
    assert(Math.abs(u.germanPreview.anchor.getWorldScale(new THREE.Vector3()).y-1.1)<1e-6,'Inconsistent body scale');
    assert(!u.germanPreview.legacy.visible);
    assert(u.germanPreview.identity.root.children.length>0);
  }
  const hero=roles[0];
  for(let wpn=0;wpn<6;wpn++){hero.wpn=wpn;api.animateGermanSoldier(hero,.016);const w=hero.germanPreview.weapon;assert.equal(w.launcher.visible,wpn>=4);assert.equal(w.scope.visible,wpn===3);assert.equal(w.magazine.visible,wpn===1);assert.equal(w.machineGun.visible,wpn===2);}
  hero.side='red';api.animateGermanSoldier(hero,.016);assert.equal(hero.germanPreview.identity.band.material.color.getHex(),0x9e4a44);
  for(let i=0;i<10;i++)unit(30+i,0,0);assert.equal(U.filter(u=>u.germanPreview).length,U.length,'Every soldier uses the same visual family');
  let masks=0;one.germanPreview.figure.traverse(n=>{if(!n.isMesh||!n.geometry.attributes.uniformMask)return;const a=n.geometry.attributes.uniformMask.array;assert(a.some(v=>v===0)&&a.some(v=>v===1),'Mask must preserve skin and boots');masks++;const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};n.material.onBeforeCompile(shader);assert(shader.vertexShader.includes('vUniformMask=uniformMask'));assert(shader.fragmentShader.includes('vec3 fabric='));assert(shader.uniforms.uniformTint);});assert.equal(masks,1);
  // Additional front-facing role lineup, using the exact deformed game geometry.
  const roleStates=[];
  for(const u of [one,...roles]){
    u.g.position.set(0,0,0);u.g.rotation.set(0,0,0);u.x=u.z=0;u.sv=u.aim=0;u.wpn=0;u.germanPreview.walk=u.germanPreview.aim=u.germanPreview.yaw=0;api.animateGermanSoldier(u,.016);scene.updateMatrixWorld(true);
    const meshes=[];u.germanPreview.anchor.traverse(n=>{if(!n.isMesh)return;for(let p=n;p;p=p.parent)if(!p.visible)return;if(n.skeleton)n.skeleton.update();const g=n.geometry,points=[],vtx=new THREE.Vector3();for(let i=0;i<g.attributes.position.count;i++){vtx.fromBufferAttribute(g.attributes.position,i);if(n.isSkinnedMesh)n.boneTransform(i,vtx);vtx.applyMatrix4(n.matrixWorld);points.push(vtx.toArray());}meshes.push({name:n.name,vertices:points,indices:g.index?Array.from(g.index.array):Array.from({length:g.attributes.position.count},(_,i)=>i),uv:g.attributes.uv?Array.from(g.attributes.uv.array):null,material:n.material.name,color:n.material.color.toArray(),uniformTint:n.material.userData.uniformTint||null,uniformMask:g.attributes.uniformMask?Array.from(g.attributes.uniformMask.array):null});});roleStates.push({state:u.germanPreview.palette+'-'+u.germanPreview.role,meshes});
  }
  fs.writeFileSync(__dirname+'/role-states.json',JSON.stringify(roleStates));
  fs.writeFileSync(__dirname+'/poses.json',JSON.stringify(poses));fs.writeFileSync(__dirname+'/render-states.json',JSON.stringify(renderStates));
  console.log(JSON.stringify({passed:true,states:poses.map(p=>p.state),maxHandError:maxError,independentSkeletons:s1.length,simultaneousModels:U.length,roleIdentities:'passed',uniformMask:'passed',heroWeaponVariants:6,legacyArmorHidden:'passed'}));
},e=>{throw e});
