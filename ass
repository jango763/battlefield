# <!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>Серый наёмник: линия фронта (CoH3 Edition)</title>
<style>
:root{--panel:rgba(26,30,22,.9);--fg:#ece8d4;--acc:#e8a33a;box-sizing:border-box}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--panel:rgba(14,17,11,.92)}}
:root[data-theme="dark"]{--panel:rgba(14,17,11,.92)}
html,body{margin:0;height:100%;overflow:hidden;background:#3a3a2a;color:var(--fg);font:13px/1.3 "Trebuchet MS",Arial,sans-serif;user-select:none;-webkit-user-select:none}
canvas{display:block;touch-action:none}
/* УБРАН ТЕМНЫЙ ФИЛЬТР */
#hud{position:fixed;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top,0px) + 6px) 12px 6px;background:var(--panel);pointer-events:none;border-bottom:2px solid #8a8a64}
#row{display:flex;justify-content:space-between;font-weight:700;font-size:14px;letter-spacing:.4px}
#st,#msg{font-size:12px;opacity:.92;min-height:1.3em}
#pad{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.b{width:66px;height:50px;border:2px solid #b5b58a;background:linear-gradient(#3b4230,#1e2318);color:var(--fg);font:700 12px "Trebuchet MS",sans-serif;touch-action:none}
.b.l{width:96px;height:96px;font-size:16px;border-color:var(--acc);border-radius:50%}
#zone{position:fixed;left:0;bottom:0;width:62%;height:78%;touch-action:none}
#stk{position:fixed;display:none;width:110px;height:110px;border-radius:50%;border:3px solid rgba(255,255,255,.45);pointer-events:none}
#knob{position:absolute;left:31px;top:31px;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.45)}
#shop{position:fixed;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);background:var(--panel);border:2px solid #8a8a64;padding:8px 10px;display:none;max-height:62vh;overflow:auto;font-weight:700}
.sb{display:block;width:100%;min-height:44px;margin:5px 0;border:2px solid #b5b58a;background:linear-gradient(#3b4230,#1e2318);color:var(--fg);font:700 14px 'Trebuchet MS',sans-serif;text-align:left;padding:0 12px}
#mm{position:fixed;left:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);width:132px;height:92px;border:3px solid #8a8a64;box-shadow:0 0 0 2px #14170f,0 3px 10px #000b;pointer-events:none;background:#4a4a30}
</style>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}
</script>
</head>
<body>
<div id="hud"><div id="row"><span id="cs"></span><span id="gd"></span></div><div id="st"></div><div id="msg">Левая половина экрана — идти. «ОГОНЬ» — стрелять по ближайшему. Армии сами копят деньги, одеваются и учатся.</div></div>
<canvas id="mm" width="200" height="140"></canvas>
<div id="zone"></div><div id="stk"><i id="knob"></i></div><div id="shop"></div><div id="pad"><button class="b" id="shp">🛒</button><button class="b" id="gr">💣</button><button class="b" id="sd"></button><button class="b l" id="atk">ОГОНЬ</button></div>

<script type="module">
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $=id=>document.getElementById(id),say=t=>$('msg').textContent=t;
const EN={blue:'red',red:'blue'},NM={blue:'Синие',red:'Красные'},HX={blue:0x2f4f7c,red:0x8a5a3a},HXS={blue:'#5b86c4',red:'#c98652'},UN={blue:0xc2b48c,red:0x3a5a3a},UB={blue:0xd8cba4,red:0x4f7a50},HL={blue:0x8a8a58,red:0x3e5a3e};
const rnd=(a,b)=>a+Math.random()*(b-a),dst=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

// ==========================================
// 1. РЕНДЕР, СВЕТ, ОКРУЖЕНИЕ (CoH3 Style)
// ==========================================
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9caab8); // Светлое небо
scene.fog=new THREE.FogExp2(0x9caab8, 0.006); // Легкая дымка

const cam=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.5,300);
const R=new THREE.WebGLRenderer({antialias:true});
R.setPixelRatio(Math.min(devicePixelRatio,2));
R.shadowMap.enabled=true; 
R.shadowMap.type=THREE.PCFSoftShadowMap; // Мягкие тени
R.toneMapping=THREE.ACESFilmicToneMapping;
R.toneMappingExposure=1.3; // Яркость
R.outputColorSpace=THREE.SRGBColorSpace;
R.setSize(innerWidth,innerHeight);
document.body.prepend(R.domElement);

// Пост-обработка (SSAO + Bloom)
const composer = new EffectComposer(R);
composer.addPass(new RenderPass(scene, cam));
const ssaoPass = new SSAOPass(scene, cam, innerWidth, innerHeight);
ssaoPass.kernelRadius = 16; 
ssaoPass.minDistance = 0.002; 
ssaoPass.maxDistance = 0.1;
composer.addPass(ssaoPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.6, 0.85);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// Свет
scene.add(new THREE.HemisphereLight(0xccddee, 0x5a5238, 1.0));
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const sun=new THREE.DirectionalLight(0xfff2d0, 2.5);
sun.position.set(-40,50,30);
sun.castShadow=true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left=-60; sun.shadow.camera.right=60;
sun.shadow.camera.top=60; sun.shadow.camera.bottom=-60;
sun.shadow.camera.near=1; sun.shadow.camera.far=150;
sun.shadow.bias=-0.0005;
scene.add(sun);

addEventListener('resize',()=>{
  cam.aspect=innerWidth/innerHeight;
  cam.updateProjectionMatrix();
  R.setSize(innerWidth,innerHeight);
  composer.setSize(innerWidth,innerHeight);
  ssaoPass.setSize(innerWidth,innerHeight);
  bloomPass.setSize(innerWidth,innerHeight);
});

const BOX=new THREE.BoxGeometry(1,1,1),SPH=new THREE.SphereGeometry(1,12,10),M=(c,e=0)=>new THREE.MeshLambertMaterial({color:c,emissive:e});
const skin=M(0xe0b890),steel=M(0xaab0b8),pant=M(0x7a6e4c),boot=M(0x1c1812),wood=M(0x6a4a22),gold=M(0xe0b84a,0x332200);

// Обновленные функции создания примитивов (с тенями)
function part(m,w,h,d,x,y,z,p){const o=new THREE.Mesh(BOX,m);o.scale.set(w,h,d);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
const ball=(m,sx,sy,sz,x,y,z,p)=>{const o=new THREE.Mesh(SPH,m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o};
const cyl=(m,sx,sy,sz,x,y,z,p,geo=new THREE.CylinderGeometry(1,1,1,10))=>{const o=new THREE.Mesh(geo,m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o};

const FLAGS=[],flag=(p,x,y,z,col)=>{part(steel,.12,3,.12,x,y+1.5,z,p);const f=part(M(col,0x221100),.08,1.5,2.2,x,y+2.3,z+1.2,p);FLAGS.push(f);return f};

// Текстуры с правильным цветом
function tex(a,b,n,rep){
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  x.fillStyle=a;x.fillRect(0,0,256,256);x.globalAlpha=.3;
  for(let i=0;i<n;i++){x.fillStyle=b[i%b.length];x.beginPath();x.arc(rnd(0,256),rnd(0,256),rnd(2,14),0,7);x.fill()}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep[0],rep[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Земля
const groundTex = tex('#5a4a3a',['#4a3a2a','#6a5a4a','#3a2b1c','#7b6b5b','#5f6a70'],1000,[20,14]);
const gr=new THREE.Mesh(new THREE.PlaneGeometry(260,180), new THREE.MeshStandardMaterial({map:groundTex, roughness:0.9, metalness:0.1}));
gr.rotation.x=-Math.PI/2;
gr.receiveShadow=true;
scene.add(gr);

// ── Декор ──
const mx=new THREE.Matrix4(),sm=new THREE.Matrix4(),rx=new THREE.Matrix4().makeRotationX(-Math.PI/2),spot=()=>[rnd(-95,95),rnd(-65,65)];
const cr=new THREE.InstancedMesh(new THREE.CircleGeometry(1,14),new THREE.MeshBasicMaterial({color:0x2e281c,transparent:true,opacity:.7}),50),cy=new THREE.InstancedMesh(new THREE.CylinderGeometry(.15,.45,7,5),M(0x2a2420),60),tp=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.9),M(0x6a6a66),36);
const rm=new THREE.InstancedMesh(new THREE.RingGeometry(.85,1.3,16),new THREE.MeshBasicMaterial({color:0x6e583c,side:2}),50);
for(let i=0;i<50;i++){const[x,z]=spot(),k=rnd(1.5,4);mx.makeTranslation(x,.06,z).multiply(rx).multiply(sm.makeScale(k,k,k));cr.setMatrixAt(i,mx);mx.makeTranslation(x,.07,z).multiply(rx).multiply(sm.makeScale(k,k,k));rm.setMatrixAt(i,mx)}
scene.add(rm);
const br=new THREE.InstancedMesh(new THREE.CylinderGeometry(.05,.14,2.6,4),M(0x2a2420),180),stm=new THREE.InstancedMesh(new THREE.CylinderGeometry(.5,.6,.8,6),M(0x3a2e24),30),tt=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x2a2016,transparent:true,opacity:.4}),24),od=new THREE.Object3D();
for(let i=0;i<60;i++){const[x,z]=spot(),k=rnd(.8,1.5);od.position.set(x,3.5*k,z);od.rotation.set(rnd(-.08,.08),rnd(0,6),rnd(-.08,.08));od.scale.setScalar(k);od.updateMatrix();cy.setMatrixAt(i,od.matrix);
  for(let j=0;j<3;j++){od.position.set(x,(3+j*1.4)*k,z);od.rotation.set(rnd(-1,1),rnd(0,6),rnd(.7,1.2)*(j%2?1:-1));od.scale.setScalar(k*(1-j*.2));od.updateMatrix();br.setMatrixAt(i*3+j,od.matrix)}}
for(let i=0;i<30;i++){const[x,z]=spot();od.position.set(x,.4,z);od.rotation.set(0,rnd(0,6),0);od.scale.setScalar(rnd(.8,1.3));od.updateMatrix();stm.setMatrixAt(i,od.matrix)}
for(let i=0;i<24;i++){const[x,z]=spot();od.position.set(x,.05,z);od.rotation.set(-Math.PI/2,0,rnd(0,3));od.scale.set(.7,rnd(10,24),1);od.updateMatrix();tt.setMatrixAt(i,od.matrix)}
scene.add(br,stm,tt);
for(let i=0;i<36;i++){mx.makeTranslation(rnd(-30,30),.7,rnd(-60,60));tp.setMatrixAt(i,mx)}
scene.add(cr,cy,tp);

const OBS=[];
function ruin(x,z){const g=new THREE.Group(),w=M(0x9e988a),q=Math.random()<.5;g.position.set(x,0,z);g.rotation.y=q?Math.PI/2:0;
  [[8,.6,0,-3,rnd(3,5)],[.6,6,-4,0,rnd(2,4.5)],[5,.6,1.5,3,rnd(1.5,3)]].forEach(([sx,sz,lx,lz,h])=>{part(w,sx,h,sz,lx,h/2,lz,g);const L=Math.max(sx,sz),hz=sx>sz;for(let n=-1;n<=1;n+=2)part(M(0x1a1612),hz?1:sx*1.1,1.2,hz?sz*1.1:1,hz?lx+n*L*.25:lx,h*.55,hz?lz:lz+n*L*.25,g);part(w,hz?1.6:sx,rnd(.5,1.2),hz?sz:1.6,lx+(hz?rnd(-L/3,L/3):0),h+.3,lz+(hz?0:rnd(-L/3,L/3)),g);OBS.push(q?{x:x+lz,z:z-lx,hw:sz/2,hd:sx/2,cov:1}:{x:x+lx,z:z+lz,hw:sx/2,hd:sz/2,cov:1})});
  for(let n=0;n<7;n++)part(M(n%2?0x8a4a32:0xb09a78),rnd(.3,.8),.3,rnd(.3,.6),rnd(-3.5,3.5),.15,rnd(-3.5,3.5),g);part(M(0x5a5240),6,.8,5,0,.4,0,g);scene.add(g)}
for(let i=0;i<14;i++)ruin(rnd(-50,50),rnd(-60,60));

const WR=[[-12,18],[10,-24],[25,30],[-28,-10]],SMK=new Float32Array(180);
for(const[x,z]of WR){part(M(0x2a2a26),5,1.6,3,x,.8,z,scene);part(M(0x34342e),2.4,1,2.4,x,2.1,z,scene);part(M(0xff7a1a,0xff5500),1.2,.8,1.2,x,2.8,z,scene)}
for(let i=0;i<60;i++){const w=WR[i%4];SMK[i*3]=w[0]+rnd(-1,1);SMK[i*3+1]=rnd(2,16);SMK[i*3+2]=w[1]+rnd(-1,1)}
const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(SMK,3));scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0x4a4a48,size:5,transparent:true,opacity:.45,depthWrite:false})));

function mkBar(w){const b=new THREE.Group(),f=new THREE.Mesh(BOX,M(0x66ff66,0x226622));part(M(0),w+.1,.34,.05,0,0,0,b);f.scale.set(w,.22,.07);b.add(f);b.visible=false;scene.add(b);return{b,f,w}}
function setBar(o,y){const f=Math.max(0,o.hp/o.max),k=o.bar;k.b.visible=o.hp<o.max&&o.hp>0;k.b.position.set(o.x,y,o.z);k.b.quaternion.copy(cam.quaternion);k.f.scale.x=k.w*f;k.f.position.x=-k.w*(1-f)/2}

// ── Штабы и опорные точки ──
const STR={blue:0x2f5fb0,red:0xc0392b},SAND=0xc4a870;
const pole=(m,r,h,x,y,z,p)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),m);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o};
function sandRow(g,pts){const im=new THREE.InstancedMesh(BOX,M(SAND),pts.length*2),od=new THREE.Object3D();let i=0;for(const[x,z,r]of pts)for(let l=0;l<2;l++){od.position.set(x,.4+l*.75,z);od.rotation.set(0,r+rnd(-.1,.1),0);od.scale.set(1.9,.75,1.05);od.updateMatrix();im.setMatrixAt(i++,od.matrix)}g.add(im)}

function baseVis(g,t,s){
  const c=STR[t],W=11,D=12,pts=[];
  for(let x=-W;x<=W;x+=1.9)pts.push([x,-D,0],[x,D,0]);
  for(const xs of[-1,1])for(let z=-D+1.9;z<D-.5;z+=1.9){if(xs===-s&&Math.abs(z)<3.2)continue;pts.push([xs*W,z,1.57])}
  sandRow(g,pts);
  OBS.push({x:88*s,z:-D,hw:W,hd:.8},{x:88*s,z:D,hw:W,hd:.8},{x:88*s+s*W,z:0,hw:.8,hd:D});[1,-1].forEach(k=>OBS.push({x:88*s-s*W,z:k*(3.2+D)/2,hw:.8,hd:(D-3.2)/2}));
  part(M(0x6a5a40),W*2-1,.1,D*2-1,0,.05,0,g);
  part(M(0xb59d6a),9,4.2,10,0,2.1,0,g);part(M(c),9.2,.55,10.2,0,3.2,0,g);part(M(c),9.2,.35,10.2,0,1.3,0,g);
  part(M(0xa08a5c),10,.5,11,0,4.5,0,g);part(M(0xb59d6a),4,2,4,0,5.7,-1.5,g);part(M(c),4.1,.4,4.1,0,5.9,-1.5,g);
  part(M(0x1c1812),.3,2.4,2.4,-s*4.6,1.2,0,g);part(M(c),1.4,.3,3.2,-s*5.1,2.7,0,g);
  pole(steel,.12,5,0,8.2,-1.5,g);part(steel,2,.1,.1,0,9.5,-1.5,g);part(steel,1.4,.1,.1,0,8.6,-1.5,g);ball(steel,.8,.22,.8,0,10,-1.5,g);
  const tn=(x,z)=>{part(M(0xcdb98a),2.6,2.6,4.4,x,0,z,g).rotation.z=.785;part(M(c),.55,.55,4.5,x,1.82,z,g)};tn(-7,-8);tn(7,8);
  [[7,-8],[-7,8]].forEach(([x,z])=>{part(M(0x8a6a3a),1.4,1.4,1.4,x,.7,z,g);part(M(0x7a5a2e),1.2,1.2,1.2,x+1.4,.6,z+.6,g);part(M(0xf2c230,0x6a4a00),1,.9,1,x-.3,1.85,z,g)});
  pole(steel,.15,7,-s*8.5,3.5,-9,g);FLAGS.push(part(M(c,0x221100),.1,2,3.2,-s*8.5,6.3,-7.4,g));
}

function mkBunker(tg,t,s,gm){
  const tan=0xa8925f,gry=0x8a8c88;let base=t==='blue'?tan:gry;
  const body=M(base),roofM=M(t==='blue'?0x8f7a4e:0x77797a),strM=M(STR[t]),domeM=M(t==='blue'?0x9a8556:0x85888a),dk=M(0x14120e);
  part(body,5.4,.8,5.4,0,.4,0,tg);part(body,4.6,3.2,4.6,0,2.4,0,tg);part(strM,4.7,.6,4.7,0,2.8,0,tg);part(roofM,5.4,.5,5.4,0,4.25,0,tg);
  part(dk,3,.45,.3,0,3.5,2.32,tg);part(dk,3,.45,.3,0,3.5,-2.32,tg);part(dk,.3,.45,3,2.32,3.5,0,tg);part(dk,.3,.45,3,-2.32,3.5,0,tg);
  const turret=new THREE.Group();turret.position.set(0,4.5,0);tg.add(turret);pole(M(0x6a6c70),1.9,.35,0,.1,0,turret);
  const dm=new THREE.Mesh(new THREE.IcosahedronGeometry(1.4,1),domeM);dm.scale.y=.75;dm.position.y=.55;turret.add(dm);pole(M(0x2e3033),.22,2.6,0,.8,1.9,turret).rotation.x=Math.PI/2;turret.visible=false;
  const fl=flag(tg,-1.8,4.5,-1.8,STR[t]);part(gm,.5,.5,.5,1.9,4.7,1.9,tg);
  const d1=new THREE.Group(),d2=new THREE.Group(),cr_=M(0x241e16);tg.add(d1,d2);
  part(cr_,.15,1.8,.1,1.2,2.4,2.33,d1);part(cr_,.15,1.2,.1,-1,2.2,2.33,d1);part(cr_,.1,1.4,.15,2.33,2.3,-.8,d1);
  part(cr_,2.4,1,2.4,1.4,4.5,1.4,d2);part(cr_,1,.5,1,3.4,.3,2.6,d2);part(cr_,.8,.4,.9,-3.2,.25,2.9,d2);d1.visible=d2.visible=false;
  const nest=new THREE.Group();nest.position.set(-s*5.5,0,3.9);tg.add(nest);nest.visible=false;
  for(let k=0;k<9;k++){const a=k/9*6.28,b=part(M(SAND),1.5,.8,.9,Math.cos(a)*1.9,.4,Math.sin(a)*1.9,nest);b.rotation.y=-a}
  const gm2=M(t==='blue'?0x6a7048:0x4f5a48),hm=M(t==='blue'?0x7a7a50:0x4a5448);
  ball(gm2,.45,.5,.4,0,.95,0,nest);ball(skin,.25,.28,.25,0,1.5,0,nest);ball(hm,.33,.2,.33,0,1.72,0,nest);ball(strM,.34,.07,.34,0,1.68,0,nest);
  const mgR=new THREE.Group();mgR.position.set(0,1.15,0);nest.add(mgR);pole(M(0x2a2c30),.07,1.8,0,0,1,mgR).rotation.x=Math.PI/2;part(M(0x34373b),.25,.25,.7,0,0,.3,mgR);
  return{turret,nest,mgR,fl,
    recolor(tm){const b=tm==='blue';base=b?tan:gry;roofM.color.setHex(b?0x8f7a4e:0x77797a);strM.color.setHex(STR[tm]);domeM.color.setHex(b?0x9a8556:0x85888a);gm2.color.setHex(b?0x6a7048:0x4f5a48);hm.color.setHex(b?0x7a7a50:0x4a5448);fl.material.color.setHex(STR[tm])},
    dmg(st){d1.visible=st>=1;d2.visible=st>=2;body.color.setHex(base).multiplyScalar(1-.14*st)}};
}

const CA={},TW=[],SB=M(0xa89868);
for(const t of['blue','red']){
  const s=t==='blue'?-1:1,g=new THREE.Group();g.position.set(88*s,0,0);scene.add(g);
  baseVis(g,t,s);
  
  CA[t]={kind:'c',t,x:88*s,z:0,r:7,hp:600,max:600,bar:mkBar(8)};OBS.push({x:88*s,z:0,hw:5.5,hd:7.5});
  [-35,0,35].forEach(z=>{
    const tg=new THREE.Group();tg.position.set(35*s,0,z);scene.add(tg);const gm=M(0xffe082,0x886600);
    const bk=mkBunker(tg,t,s,gm);
    
    const fl=bk.fl;
    const gun=bk.turret,mgB=bk.nest,cnB=bk.turret;
    TW.push({kind:'t',t,x:35*s,z,r:2.6,hp:200,max:200,cd:3,fl:0,gm,flm:fl.material,bar:mkBar(4),lv:0,up:null,gun,mgB,cnB,mcd:0,ccd:0,mgR:bk.mgR,recolor:bk.recolor,dmg:bk.dmg});OBS.push({x:35*s,z,hw:2.4,hd:2.4});
  });
}

// ── Солдат ──
const DSK=new THREE.CircleGeometry(.95,18),RNG=new THREE.RingGeometry(.9,1.1,24),shMat=new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.35});
const flat=(geo,m,y,p)=>{const o=new THREE.Mesh(geo,m);o.position.y=y;o.rotation.x=-Math.PI/2;p.add(o)};

const CYL=new THREE.CylinderGeometry(1,1,1,10),TOR=new THREE.CylinderGeometry(.52,.4,1,12);
const LG={},lg=(a,b,l)=>LG[a+'_'+b+'_'+l]||(LG[a+'_'+b+'_'+l]=new THREE.CylinderGeometry(a,b,l,8));
const limb=(m,a,b,l,p)=>{const o=new THREE.Mesh(lg(a,b,l),m);o.position.y=-l/2;o.castShadow=true;p.add(o);return o};
const bpv=(x,y,p)=>{const q=new THREE.Group();q.position.set(x,y,0);p.add(q);return q};
function camoTex(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#7d7048';x.fillRect(0,0,256,256);for(let i=0;i<170;i++){x.fillStyle=['#4a5030','#5a4a2a','#2f3a24','#a89a62','#4a5030'][i%5];x.save();x.translate(rnd(0,256),rnd(0,256));x.rotate(rnd(0,6.28));x.beginPath();x.ellipse(0,0,rnd(6,22),rnd(3,10),0,0,7);x.fill();x.restore()}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace = THREE.SRGBColorSpace;return t}
const F=c=>new THREE.MeshPhongMaterial({color:c,flatShading:true,shininess:15,specular:0x444444}),SPL=new THREE.SphereGeometry(1,7,5),CYP=new THREE.CylinderGeometry(1,1,1,7),LGP={};
const lgp=(a,b,l)=>LGP[a+'_'+b+'_'+l]||(LGP[a+'_'+b+'_'+l]=new THREE.CylinderGeometry(a,b,l,6));
const limbP=(m,a,b,l,p)=>{const o=new THREE.Mesh(lgp(a,b,l),m);o.position.y=-l/2;o.castShadow=true;p.add(o);return o};
const blobP=(m,sx,sy,sz,x,y,z,p)=>{const o=new THREE.Mesh(SPL,m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o};
const cylP=(m,sx,sy,sz,x,y,z,p)=>{const o=new THREE.Mesh(CYP,m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o};

const TXC={};
function ptex(k){
  if(TXC[k])return TXC[k];
  const w=256,c=document.createElement('canvas');c.width=c.height=w;const x=c.getContext('2d'),R_=(a,b)=>a+Math.random()*(b-a);
  const nz=(b,cs,n,r)=>{x.fillStyle=b;x.fillRect(0,0,w,w);x.globalAlpha=.28;for(let i=0;i<n;i++){x.fillStyle=cs[i%cs.length];x.fillRect(R_(0,w),R_(0,w),R_(1,r),R_(1,r))}x.globalAlpha=1};
  const poly=(cs,n)=>{for(let i=0;i<n;i++){x.fillStyle=cs[i%cs.length];x.beginPath();const cx=R_(0,w),cy=R_(0,w),r=R_(12,34),m=4+(i%2);for(let j=0;j<m;j++){const a=j/m*6.28+R_(-.4,.4),rr=r*R_(.5,1.1);x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}x.closePath();x.fill()}};
  if(k==='khaki'){nz('#b7a46c',['#a8955c','#c6b47e','#9a8852'],1100,4);x.strokeStyle='rgba(80,65,35,.16)';for(let i=0;i<w;i+=3){x.beginPath();x.moveTo(i,0);x.lineTo(i,w);x.stroke()}}
  else if(k==='grey')nz('#6e7668',['#5e665a','#7c8474','#545c4e'],1100,4);
  else if(k==='olive')nz('#6b6b45',['#5a5a38','#797852'],900,4);
  else if(k==='leather')nz('#4a3220',['#3a2616','#5c4028'],600,5);
  else if(k==='net'){nz('#58624a',['#4a5440','#68725a'],700,4);x.strokeStyle='rgba(30,36,24,.55)';x.lineWidth=2;for(let i=0;i<w;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i,w);x.moveTo(0,i);x.lineTo(w,i);x.stroke()}}
  else if(k==='camoSS'){x.fillStyle='#76814f';x.fillRect(0,0,w,w);poly(['#8d7b47','#4b5b37','#2e3626','#6c7144'],110)}
  else{x.fillStyle='#8a7c4c';x.fillRect(0,0,w,w);poly(['#4d5532','#5a4a2a','#2f3a24','#a89a62'],110)}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace = THREE.SRGBColorSpace;return TXC[k]=t
}
const PHm=k=>new THREE.MeshPhongMaterial({map:ptex(k),bumpMap:ptex(k),bumpScale:.7,shininess:15,specular:0x444444,side:2}),LM=c=>new THREE.MeshLambertMaterial({color:c});
const LPG=a=>new THREE.LatheGeometry(a.map(p=>new THREE.Vector2(p[0],p[1])),22),GBROD=LPG([[0,.27],[.16,.265],[.3,.22],[.38,.13],[.42,.06],[.55,.01],[.62,-.02]]),GSTAH=LPG([[0,.3],[.15,.29],[.27,.23],[.33,.13],[.35,.02],[.4,-.05],[.43,-.09]]);
const GCY={},CGm=(a,b,h,n=14)=>GCY[a+'|'+b+'|'+h+'|'+n]||(GCY[a+'|'+b+'|'+h+'|'+n]=new THREE.CylinderGeometry(a,b,h,n));
const hang=(m,a,b,h,p,y0)=>{const o=new THREE.Mesh(CGm(a,b,h),m);o.position.y=(y0||0)-h/2;o.castShadow=true;p.add(o);return o},mk3=(geo,m,x,y,z,p)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o};

function humanPro(kind,team,sc){
  const br=team==='blue',hero=kind==='hero',cap=kind==='cap',eng=kind==='eng',inf=kind==='inf',idc=STR[team];
  const g=new THREE.Group(),tun=PHm(hero?'camoPara':br?'khaki':cap?'grey':'camoSS'),pan=PHm(hero?'olive':br?'khaki':'grey'),lea=PHm('leather'),web=PHm(br||hero?'olive':'leather'),pk=PHm(br||hero?'khaki':'olive'),helm=PHm(br?'khaki':hero?'olive':'net');
  const bootM=LM(br||hero?0x4a3220:0x15120e),soleM=LM(0x120e0a),metal=LM(0x2a2c30),woodM=LM(0x6e3f22),brass=LM(0xb8963a),idM=LM(idc),dk=LM(0x14120e),eyeM=LM(0x1a1410);
  const lL=bpv(-.19,.98,g),lR=bpv(.19,.98,g),aL=bpv(-.58,1.74,g),aR=bpv(.58,1.74,g),kL=bpv(0,-.5,lL),kR=bpv(0,-.5,lR),eL=bpv(0,-.36,aL),eR=bpv(0,-.36,aR);
  for(const[l,k]of[[lL,kL],[lR,kR]]){hang(pan,.17,.135,.52,l,0);ball(pan,.15,.15,.15,0,-.5,0,l);hang(pan,.135,.105,.5,k,0);
    hang(bootM,.115,.12,.26,k,-.2);ball(bootM,.12,.08,.15,0,-.44,.34,k);part(bootM,.24,.12,.46,0,-.42,.1,k);part(soleM,.25,.04,.5,0,-.5,.1,k);
    if(br||hero)for(let i=0;i<4;i++)cyl(pk,.125,.045,.125,0,-.05-i*.06,0,k);else ball(pan,.15,.1,.15,0,-.18,0,k)}   
  ball(pan,.36,.24,.26,0,.98,0,g);ball(tun,.34,.3,.22,0,1.22,0,g);ball(tun,.42,.4,.26,0,1.57,0,g);
  mk3(CGm(.36,.47,.4,16),tun,0,.95,0,g).visible=hero||(!br&&inf)||eng&&!br;                           
  if(cap||(br&&(inf||eng)))mk3(CGm(.37,.4,.2,16),tun,0,1.02,0,g);
  mk3(CGm(.09,.1,.14,10),skin,0,1.9,0,g);ball(skin,.23,.27,.245,0,2.1,0,g);mk3(new THREE.ConeGeometry(.035,.1,6),skin,0,2.07,.24,g).rotation.x=Math.PI/2;
  for(const k of[-1,1]){ball(eyeM,.03,.025,.02,k*.08,2.14,.2,g);part(eyeM,.07,.015,.02,k*.08,2.19,.215,g);ball(skin,.04,.06,.03,k*.235,2.1,0,g)}
  part(dk,.08,.012,.02,0,2.0,.225,g);
  if(hero){ball(LM(0x6a1830),.31,.12,.32,.05,2.33,-.01,g);ball(brass,.05,.05,.03,.07,2.34,.31,g)}
  else if(cap){const cm=PHm(br?'khaki':'grey'),bm_=LM(br?0x4a3a22:0x2a2a22);mk3(CGm(.26,.31,.13,18),cm,0,2.31,0,g);mk3(CGm(.31,.31,.02,18),cm,0,2.375,0,g);mk3(CGm(.265,.265,.05,18),bm_,0,2.26,0,g);ball(cm,.27,.025,.21,0,2.23,.25,g);ball(brass,.05,.045,.025,0,2.3,.31,g)}
  else{const hg=new THREE.Group();hg.position.set(0,2.2,0);g.add(hg);mk3(br?GBROD:GSTAH,helm,0,0,0,hg).scale.set(1,1,br?1.05:1.18);mk3(new THREE.TorusGeometry(br?.4:.36,.03,6,26),idM,0,.15,0,hg).rotation.x=Math.PI/2;if(!br)part(helm,.5,.08,.3,0,-.02,-.3,hg)}
  cyl(lea,.45,.07,.33,0,1.04,0,g);part(brass,.1,.07,.03,0,1.04,.33,g);
  for(const k of[-1,1]){part(web,.09,.95,.04,k*.2,1.55,.27,g).rotation.z=-k*.25;part(web,.17,.2,.1,k*.18,1.04,.3,g);part(web,.17,.2,.1,k*.37,1.04,.24,g)}
  mk3(CGm(.07,.07,.2,12),pk,.43,.95,-.12,g);part(metal,.04,.34,.02,-.44,.85,.1,g);
  part(pk,.62,.7,.28,0,1.52,-.34,g);cyl(web,.13,.62,.13,0,1.96,-.36,g).rotation.z=1.57;
  if(cap){part(dk,.22,.1,.1,0,1.5,.34,g);part(lea,.12,.24,.16,.4,.94,.14,g)}
  if(eng){part(pk,.5,.35,.2,0,1.2,-.5,g);part(metal,.06,.5,.03,-.4,.9,.2,g)}
  const sleeveBare=br&&(inf||eng);
  for(const[a,e]of[[aL,eL],[aR,eR]]){ball(tun,.17,.17,.17,0,0,0,a);hang(tun,.125,.105,.36,a,0);hang(sleeveBare?skin:tun,.1,.075,.34,e,0);ball(skin,.075,.095,.065,0,-.38,.02,e)}
  const band=cyl(idM,.135,.13,.135,0,-.18,0,aL);cyl(idM,.135,.13,.135,0,-.18,0,aR);
  const plate=ball(PHm('olive'),.5,.34,.33,0,1.58,.03,g);plate.visible=false;const chev=part(brass,.12,.06,.02,0,-.1,.115,aR);chev.visible=false;
  const rfl=bpv(0,-.3,eR);part(woodM,.08,.8,.1,0,-1.1,.05,rfl);part(woodM,.1,.4,.16,0,-.25,.05,rfl);cyl(metal,.025,1.1,.025,0,-1.75,.07,rfl);part(metal,.07,.2,.1,0,-.62,.08,rfl);
  const mg=bpv(0,-.3,eR);part(metal,.14,.9,.16,0,-.7,0,mg);cyl(metal,.03,.8,.03,0,-1.6,0,mg);part(metal,.08,.12,.4,0,-.55,.28,mg);part(woodM,.12,.5,.15,0,-.1,0,mg);for(const k of[-1,1])part(metal,.04,.04,.7,k*.12,-1.45,-.3,mg).rotation.x=.5;mg.visible=false;
  const ol=LM(0x6e6e48),rl=bpv(0,-.3,eR);cyl(ol,.15,1.9,.15,0,-1,.05,rl);cyl(ol,.2,.22,.2,0,.12,.05,rl);mk3(new THREE.ConeGeometry(.17,.4,8),ol,0,-2.1,.05,rl).rotation.x=Math.PI;rl.visible=false;
  const mf=ball(new THREE.MeshBasicMaterial({color:0xffb020}),.3,.65,.3,0,-2.2,.05,eR);mf.visible=false;
  const gb=bpv(0,0,g);for(let k=-1;k<=1;k++)ball(LM(0x3a4a28),.08,.11,.08,k*.12,1,.3,gb);gb.visible=false;
  flat(DSK,shMat,.03,g);flat(RNG,new THREE.MeshBasicMaterial({color:new THREE.Color(idc).offsetHSL(0,.1,.2),transparent:true,opacity:.85}),.05,g);
  g.rotation.order='YXZ';g.scale.setScalar((cap?Math.min(sc,1.25):sc)*1.1);
  
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  
  return{g,tm:{color:{setHex(){}},emissive:{setHex(h){tun.emissive.setHex(h);pan.emissive.setHex(h);helm.emissive.setHex(h)}}},plate,chev,mf,band,rl,rfl,mg,mgx:new THREE.Object3D(),gb,laser:null,lL,lR,aL,aR,kL,kR,eL,eR};
}
function human(col,sc,uni,helm,coat,eng,fac,cmd){
  const res = humanPro(coat?'hero':cmd?'cap':eng?'eng':'inf',coat?'blue':(fac||'blue'),sc);
  return addSpine(res);
}

function anim(o,moving,dt){
  const m=o.m;integrate(o,dt);if((o.sv||0)>.6)moving=1;if(moving)dust(o,dt);if(m.spr){o.g.position.set(o.x,0,o.z);m.spr.update(o,moving,dt);return}if(m.spine){const sy=o.g.rotation.y;let w=0;if(o.aimT!=null){w=Math.atan2(Math.sin(o.aimT-sy),Math.cos(o.aimT-sy));if((o.sv||0)<.6){const k=Math.min(1,dt*7);o.g.rotation.y+=w*k;w*=1-k}w=Math.max(-1.05,Math.min(1.05,w));if(o.aim<=0)o.aimT=null}m.spine.rotation.y+=(w-m.spine.rotation.y)*(1-Math.exp(-dt*14))}if(moving)o.ph+=dt*9;
  const s=moving?Math.sin(o.ph):0,aim=o.aim>0,k=o.kick>0?.3:0;
  m.lL.rotation.x=s*.8;m.lR.rotation.x=-s*.8;m.kL.rotation.x=moving?Math.max(0,-s)*1.1+.2:.1;m.kR.rotation.x=moving?Math.max(0,s)*1.1+.2:.1;
  const kn=o.type==='mg'&&aim&&!moving;if(kn){m.lL.rotation.x=-1.25;m.kL.rotation.x=1.35;m.lR.rotation.x=-.3;m.kR.rotation.x=2}
  const sh=aim?-1.05:-.8,el=aim?-.52:-.6;
  m.aR.rotation.x=sh+k+(moving&&!aim?-s*.1:0);m.eR.rotation.x=el;m.aL.rotation.x=sh-.2;m.eL.rotation.x=el-.15;m.aL.rotation.z=.18;m.aR.rotation.z=-.08;
  m.mf.visible=o.kick>0;
  o.g.rotation.x=(moving?.2:.06)+(aim?.1:0)-(o.kick>0?.05:0);
  o.g.position.set(o.x,(moving?Math.abs(Math.sin(o.ph))*.1:0)-.04-(kn?.4:0),o.z);
}
const pm=human(0xcccccc,1.2,0x1a1a1c,0x26262a,true);scene.add(pm.g);

// ── Состояние ──
let U=[],FX=[],P,G={blue:560,red:560},spT={blue:1,red:1},cmT={blue:12,red:22},spd=0,over=false,joy=null,att=false;const keys={};
P={kind:'p',t:'grey',side:'blue',x:0,z:12,r:1,hp:150,max:150,aim:0,kick:0,cd:0,fl:0,hits:0,ph:0,gold:150,wpn:0,own:[1,0,0,0,0,0],gn:3,m:pm,g:pm.g};
function mk(t,cmd,eng){
  const s=cmd?1.5:1,m=human(HX[t],s,UN[t],eng?0xe8c030:HL[t],false,eng,t,cmd);scene.add(m.g);
  const u={kind:'u',t,cmd,hp:cmd?400:eng?60:40,max:cmd?400:eng?60:40,cp:!cmd&&!eng&&Math.random()<.3,type:cmd||eng?'rf':(Math.random()<.22?'mg':'rf'),gold:0,helm:false,shop:false,guard:false,slot:null,eng:!!eng,gren:false,gcd:0,hv:false,ammo:0,rt:0,ht:0,bk:0,x:(t==='blue'?-72:72)+rnd(-3,3),z:rnd(-45,45),r:.8*s,s,off:rnd(-6,6),cd:rnd(0,1),aim:0,kick:0,fl:0,hits:0,ph:rnd(0,6),wd:false,turtle:false,armor:false,tr:false,m,g:m.g,bar:mkBar(2)};
  if(eng){u.ic=new THREE.Sprite(new THREE.SpriteMaterial({map:icoTex('🔧'),transparent:true,depthTest:false}));u.ic.scale.set(2.6,2.6,1);scene.add(u.ic)}U.push(u);return u;
}
const BM={},bm=c=>BM[c]||(BM[c]=new THREE.MeshBasicMaterial({color:c}));
function fxBeam(a,b,c,life=.08){const m=new THREE.Mesh(BOX,bm(c)),l=dst(a,b);m.position.set((a.x+b.x)/2,2.2,(a.z+b.z)/2);m.scale.set(.16,.16,l);m.lookAt(b.x,2.2,b.z);scene.add(m);FX.push({m,t:life,T0:life,beam:1})}
function fxRing(x,z,r,c){const m=new THREE.Mesh(new THREE.RingGeometry(.85,1,40),new THREE.MeshBasicMaterial({color:c,transparent:true,side:2}));m.rotation.x=-Math.PI/2;m.position.set(x,.3,z);m.scale.setScalar(r);scene.add(m);FX.push({m,t:.45,ring:1})}
function fxBoom(x,z,r){fxRing(x,z,r,0xffa030);const m=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffa030,transparent:true,opacity:.8}));m.position.set(x,1.5,z);scene.add(m);FX.push({m,t:.4,boom:1})}
const CT={};
function coinTex(n){return CT[n]||(()=>{const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d');x.font='bold 40px Trebuchet MS,Arial';x.textAlign='center';x.lineWidth=6;x.strokeStyle='#2a1a00';x.strokeText('+'+n,64,44);x.fillStyle='#ffd23a';x.fillText('+'+n,64,44);return CT[n]=new THREE.CanvasTexture(c)})()}
function coinFx(x,z,n){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:coinTex(n),transparent:true,depthTest:false}));s.scale.set(4.5,2.2,1);s.position.set(x,3,z);scene.add(s);FX.push({m:s,t:1,coin:1});
  for(let i=0;i<6;i++){const m=new THREE.Mesh(SPH,bm(0xffd23a));m.scale.setScalar(.16);m.position.set(x,1.5,z);scene.add(m);FX.push({m,t:.7,v:[rnd(-3,3),rnd(4,8),rnd(-3,3)]})}}
function capture(o,tm,by){o.t=tm;o.hp=o.max*.6;o.cd=3;G[tm]+=800;coinFx(o.x,o.z,800);if(by===P)P.gold+=800;o.lv=0;o.up=null;o.flm.color.setHex(HX[tm]);o.recolor(tm);say(`🚩 ${NM[tm]} захватили опорную точку! +800 💰`)}
function dmg(o,n,by){if(by&&!by.hv){if(by.type==='mg')n*=.55;else if(by.type==='smg')n*=.5}
  const tm=by?(by===P?P.side:by.t):null;
  if(o.kind==='u'){if(o.armor)n*=.65;if(o.turtle)n*=.7}
  o.hp-=n;o.fl=.12;o.ht=1.5;if(by&&by!==o)hitKick(o,by,n);
  if(o.kind==='u'&&o.hp<=0&&!o.dead){o.dead=1;if(tm){const c=o.armor?30:15;G[tm]+=c;if(by===P){P.gold+=c;P.kills=(P.kills||0)+1;if(P.kills%5===0)Leaderboard.submit('kills',P.kills)}if(by&&by.kind==='u')by.gold=(by.gold||0)+c;coinFx(o.x,o.z,c)}if(o.hv&&by&&by.kind==='u'&&!by.hv&&!by.cmd)drop(o.x,o.z)}
  else if(o.kind==='t'&&o.hp<=0&&tm&&tm!==o.t)capture(o,tm,by);
}
const foesOf=a=>{const t=a===P?P.side:a.t,l=U.filter(o=>o.t!==t&&o.hp>0);if(a!==P&&t===EN[P.side]&&P.hp>0)l.push(P);return l};
function superHit(a,c,r,n){const h=foesOf(a).filter(o=>dst(c,o)<r);if(h.length<3)return false;h.forEach(o=>dmg(o,n,a));fxBoom(c.x,c.z,r);return true}
function pickOld(a,rg){const team=a===P?P.side:a.t;let b=null,bd=rg;const chk=o=>{if(o.hp<=0)return;const d=dst(a,o)-o.r;if(d<bd){bd=d;b=o}};foesOf(a).forEach(chk);TW.forEach(o=>o.t!==team&&chk(o));chk(CA[EN[team]]);return[b,bd]}
function goalOld(u){let b=CA[EN[u.t]],bd=1e9;for(const o of TW)if(o.t!==u.t){const d=dst(u,o);if(d<bd){bd=d;b=o}}return b}
function shootOld(u,t){
  u.cd=(u.cmd?.9:1.1)+rnd(0,.2);u.aim=.6;u.kick=.1;u.g.rotation.y=Math.atan2(t.x-u.x,t.z-u.z);fxBeam(u,t,0xfff0a0);u.hits++;
  if(u.cmd&&u.hits%3===0){if(superHit(u,t,9,35)){say(`💥 Командир ${NM[u.t]} вызвал артудар!`);return}u.hits--}
  dmg(t,(u.tr?9:6)*(u.cmd?2:1),u);
}
const o_=0;function mv(o,tx,tz,sp,dt){if(o.kind==='u')[tx,tz]=steer(o,tx,tz);const dx=tx-o.x,dz=tz-o.z,d=Math.hypot(dx,dz);if(d<.1)return 0;const V=o.vel||(o.vel=new THREE.Vector3()),w=Math.min(sp,d*6);_des.set(dx/d*w,0,dz/d*w);V.lerp(_des,1-Math.exp(-dt*6));o.mvf=true;const ty=Math.atan2(dx,dz);let da=ty-o.g.rotation.y;da=Math.atan2(Math.sin(da),Math.cos(da));o.g.rotation.y+=da*Math.min(1,dt*9);return 1}

// ── ИИ армий: казна, интендант, академия ──
class Treasury{constructor(t){this.t=t;this.last=G[t];this.rate=0;this.tm=0}
  get gold(){return G[this.t]}
  pay(n){if(G[this.t]<n)return false;G[this.t]-=n;return true}
  sample(dt){this.tm+=dt;if(this.tm>=5){this.rate=(G[this.t]-this.last)/this.tm;this.last=G[this.t];this.tm=0}}}
class Quartermaster{constructor(t,tr){this.t=t;this.tr=tr}buy(){spend(this.t)}}
class Academy{constructor(t){this.t=t;this.level=0}update(){const n=U.filter(u=>u.t===this.t&&u.tr&&u.hp>0).length;this.level=n>=12?3:n>=6?2:n>=2?1:0}}
class ArmyAI{constructor(t){this.t=t;this.treasury=new Treasury(t);this.qm=new Quartermaster(t,this.treasury);this.academy=new Academy(t);this.tm=0}
  update(dt){this.treasury.sample(dt);this.tm-=dt;if(this.tm>0)return;this.tm=.5;this.qm.buy();this.academy.update()}}
let ARMY=null;

// ── Ввод ──
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=1;if(e.key===' ')att=true});addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=0;if(e.key===' ')att=false});
const cv=R.domElement;

cv.addEventListener('pointermove',e=>{if(!joy||e.pointerId!==joy.id)return;const dx=e.clientX-joy.ox,dy=e.clientY-joy.oy,l=Math.hypot(dx,dy)||1,m=Math.min(l,55);joy.x=dx/l*m/55;joy.y=dy/l*m/55});
const jup=e=>{if(joy&&e.pointerId===joy.id)joy=null};cv.addEventListener('pointerup',jup);cv.addEventListener('pointercancel',jup);
const A=$('atk');A.addEventListener('pointerdown',e=>{att=true;e.preventDefault()});['pointerup','pointerleave','pointercancel'].forEach(n=>A.addEventListener(n,()=>att=false));
$('sd').onclick=()=>{P.side=EN[P.side];pm.band.material.color.setHex(HX[P.side]);say(`Вы за ${NM[P.side]}. Теперь вас ищет ${NM[EN[P.side]]} армия.`)};
pm.band.material.color.setHex(HX.blue);

function spend(t){
  const L=U.filter(u=>u.t===t&&u.hp>0&&!u.eng),S=L.filter(u=>!u.cmd);
  for(const u of L)if(u.cmd&&!u.armor&&G[t]>=50){G[t]-=50;u.armor=u.tr=true}
  const tr=S.filter(u=>u.tr&&!u.hv&&!u.gren),hv=S.filter(u=>u.hv).length,gn=S.filter(u=>u.gren).length;
  let want=null;
  if(!U.some(u=>u.t===t&&u.eng&&u.hp>0))want={c:500,f:()=>{mk(t,false,true);mk(t,false,true);say(`🔧 ${NM[t]} вызвали двух инженеров`)}};
  else if(hv<3&&tr.length)want={c:100,f:()=>{tr[0].hv=true;tr[0].ammo=3}};
  else if(gn<4&&tr.length)want={c:60,f:()=>{tr[tr.length-1].gren=true}};
  if(want&&want.c===500&&G[t]>=500){G[t]-=500;want.f();return}
  if(want&&S.length>5&&S.filter(u=>u.armor).length>=S.length*.5){if(G[t]>=want.c){G[t]-=want.c;want.f()}return}
  for(const u of S)if(!u.armor&&G[t]>=19){G[t]-=19;u.armor=true}
  for(const u of S)if(u.armor&&!u.tr&&G[t]>=11){G[t]-=11;u.tr=true}
}

// ── Обновление ──
const Q=[],DR=[];
function drop(x,z){const g=new THREE.Group();g.position.set(x,.4,z);cyl(M(0x4a5040),.12,1.8,.12,0,0,0,g).rotation.z=1.57;ball(M(0xffd060,0xffa000),.25,.25,.25,0,.6,0,g);scene.add(g);DR.push({x,z,g});say('🚀 Из гранатомётчика выпал гранатомёт!')}
function pushOut(o){for(const b of OBS){const dx=o.x-b.x,dz=o.z-b.z;if(Math.abs(dx)<b.hw+.6&&Math.abs(dz)<b.hd+.6){const px=b.hw+.6-Math.abs(dx),pz=b.hd+.6-Math.abs(dz);if(px<pz)o.x+=(dx<0?-1:1)*px;else o.z+=(dz<0?-1:1)*pz}}}
function blocked(a,b){for(const o of OBS){if(!o.cov)continue;
  if(Math.hypot(Math.max(Math.abs(a.x-o.x)-o.hw,0),Math.max(Math.abs(a.z-o.z)-o.hd,0))<1.8)continue;
  let t0=0,t1=1;const dx=b.x-a.x,dz=b.z-a.z;
  for(const[p,q,lo,hi]of[[dx,a.x,o.x-o.hw,o.x+o.hw],[dz,a.z,o.z-o.hd,o.z+o.hd]]){
    if(Math.abs(p)<1e-6){if(q<lo||q>hi){t0=2;break}}else{let e=(lo-q)/p,f=(hi-q)/p;if(e>f)[e,f]=[f,e];t0=Math.max(t0,e);t1=Math.min(t1,f);if(t0>t1)break}}
  if(t0<=t1)return{x:a.x+dx*t0,z:a.z+dz*t0}}
  return null}
function segBox(ax,az,bx,bz,x0,x1,z0,z1){let t0=0,t1=1;const dx=bx-ax,dz=bz-az;for(const[p,q,lo,hi]of[[dx,ax,x0,x1],[dz,az,z0,z1]]){if(Math.abs(p)<1e-6){if(q<lo||q>hi)return false}else{let e=(lo-q)/p,f=(hi-q)/p;if(e>f)[e,f]=[f,e];t0=Math.max(t0,e);t1=Math.min(t1,f);if(t0>t1)return false}}return true}

const GX=100,GZ=70,CS=2,BL=new Uint8Array(GX*GZ),DD=new Int16Array(GX*GZ),VV=new Int32Array(GX*GZ),QQ=new Int32Array(GX*GZ),NX=[1,-1,0,0,1,1,-1,-1],NZ=[0,0,1,-1,1,-1,1,-1];let stamp=0,navOK=false;
const ci_=x=>Math.min(GX-1,Math.max(0,Math.floor((x+100)/CS))),cj_=z=>Math.min(GZ-1,Math.max(0,Math.floor((z+70)/CS)));
function navBuild(){for(let i=0;i<GX;i++)for(let j=0;j<GZ;j++){const x=-100+(i+.5)*CS,z=-70+(j+.5)*CS;for(const b of OBS)if(Math.abs(x-b.x)<b.hw+1.1&&Math.abs(z-b.z)<b.hd+1.1){BL[i+j*GX]=1;break}}navOK=true}
function navPath(ox,oz,tx,tz){
  if(!navOK)navBuild();
  const s=ci_(ox)+cj_(oz)*GX;let t=ci_(tx)+cj_(tz)*GX;
  if(BL[t]){let bt=-1,bd=1e9;const ti=ci_(tx),tj=cj_(tz);for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++){const i=ti+a,j=tj+b;if(i<0||j<0||i>=GX||j>=GZ||BL[i+j*GX])continue;if(a*a+b*b<bd){bd=a*a+b*b;bt=i+j*GX}}if(bt<0)return null;t=bt}
  stamp++;let h=0,e=0,found=false;QQ[e++]=t;VV[t]=stamp;DD[t]=0;
  while(h<e){const c=QQ[h++];if(c===s){found=true;break}const ci=c%GX,cj=(c-ci)/GX;
    for(let k=0;k<8;k++){const i=ci+NX[k],j=cj+NZ[k];if(i<0||j<0||i>=GX||j>=GZ)continue;const n=i+j*GX;if(VV[n]===stamp||(BL[n]&&n!==s))continue;
      if(k>3&&(BL[ci+NX[k]+cj*GX]||BL[ci+(cj+NZ[k])*GX]))continue;
      VV[n]=stamp;DD[n]=DD[c]+1;QQ[e++]=n}}
  if(!found)return null;
  let c=s;for(let step=0;step<2;step++){const ci=c%GX,cj=(c-ci)/GX;let bn=-1,bd=DD[c];
    for(let k=0;k<8;k++){const i=ci+NX[k],j=cj+NZ[k];if(i<0||j<0||i>=GX||j>=GZ)continue;const n=i+j*GX;if(VV[n]!==stamp||BL[n])continue;if(DD[n]<bd){bd=DD[n];bn=n}}
    if(bn<0)break;c=bn}
  if(c===s)return null;const ci=c%GX;return[-100+(ci+.5)*CS,-70+(Math.floor(c/GX)+.5)*CS];
}
function clearPath(ax,az,bx,bz){for(const b of OBS){const inT=Math.abs(bx-b.x)<b.hw+1.4&&Math.abs(bz-b.z)<b.hd+1.4,m=inT?.4:1;if(segBox(ax,az,bx,bz,b.x-b.hw-m,b.x+b.hw+m,b.z-b.hd-m,b.z+b.hd+m))return false}return true}
function steer(o,tx,tz){
  const now=performance.now()/1000;
  if(Math.hypot(tx-o.x,tz-o.z)<1.5||clearPath(o.x,o.z,tx,tz)){o.nv=null;return[tx,tz]}
  if(!o.nv||now>o.nv.e||Math.hypot(o.nv.x-o.x,o.nv.z-o.z)<1){const p=navPath(o.x,o.z,tx,tz);o.nv=p?{x:p[0],z:p[1],e:now+.5}:null}
  return o.nv?[o.nv.x,o.nv.z]:[tx,tz];
}

const WP=[{n:'Винтовка',p:0,d:16,cd:.4,r:14},{n:'ППС-43',p:120,d:7,cd:.11,r:12},{n:'Пулёмёт',p:300,d:11,cd:.12,r:18},{n:'Снайперка',p:250,d:70,cd:1.3,r:26},{n:'Базука',p:450,d:700,cd:2.2,r:20,rk:3},{n:'Панцершрек',p:700,d:900,cd:3,r:22,rk:4.5}];
function heroRocket(W,t){fxBeam(P,t,0xff9a30,.25);if(!blocked(P,t)){dmg(t,t.kind==='u'?W.d:120,P);foesOf(P).forEach(o=>o!==t&&dst(o,t)<W.rk&&dmg(o,50,P));fxBoom(t.x,t.z,W.rk)}}
function towerFire(w,dt){
  w.mgB.visible=w.lv>=1;w.cnB.visible=w.lv>=2;w.mcd-=dt;w.ccd-=dt;if(w.lv<1)return;
  let b=null,bd=28;foesOf({t:w.t}).forEach(o=>{const d=dst(w,o);if(d<bd){bd=d;b=o}});if(!b)return;
  w.gun.rotation.y=w.mgR.rotation.y=Math.atan2(b.x-w.x,b.z-w.z);
  if(bd<18&&w.mcd<=0){w.mcd=.22;fxBeam({x:w.x-1.2,z:w.z},b,0xffc040);dmg(b,7,w)}
  if(w.lv>=2&&w.ccd<=0){w.ccd=2.5;fxBeam({x:w.x-1.2,z:w.z},b,0xff8a20,.2);fxBoom(b.x,b.z,4);foesOf({t:w.t}).forEach(o=>dst(o,b)<4&&dmg(o,90,w))}
}
function engineer(u,dt){
  const mine=TW.filter(o=>o.t===u.t),by=(a,b)=>dst(u,a)-dst(u,b),hurt=mine.filter(o=>o.hp<o.max).sort(by)[0],up=mine.filter(o=>o.lv<2).sort(by)[0],w=hurt||up||mine.sort(by)[0]||CA[u.t];
  let m=0;
  if(dst(u,w)>w.r+2)m=mv(u,w.x,w.z,4,dt);
  else if(hurt===w){w.hp=Math.min(w.max,w.hp+25*dt);u.aim=.2}
  else if(w.kind==='t'&&w.lv<2){
    if(!w.up){const c=w.lv?190:90;if(G[u.t]>=c){G[u.t]-=c;w.up={t:w.lv?10:6};say(`🔧 ${NM[u.t]}: инженеры ставят ${w.lv?'пушку (190 💰)':'пулёмёт (90 💰)'}`)}}
    if(w.up){w.up.t-=dt;u.aim=.2;if(w.up.t<=0){w.lv++;w.up=null;say(`🔧 Башня ${NM[u.t]} усилена: ${w.lv===1?'пулёмёт':'пушка'}`)}}
  }
  pushOut(u);anim(u,m,dt);u.m.tm.color.setHex(UN[u.t]);setBar(u,3.6);
}
const SH=$('shop');
function shopB(txt,fn){const b=document.createElement('button');b.className='sb';b.textContent=txt;b.onclick=fn;SH.append(b)}
function shop(){
  SH.innerHTML='';const h=document.createElement('div');h.textContent=`🥷 ${Math.floor(P.gold)} 💰 — Магазин героя`;SH.append(h);
  WP.forEach((w,i)=>shopB(`${w.n}  ·  ${i===P.wpn?'в руках':P.own[i]?'взять':w.p+' 💰'}`,()=>{if(P.own[i])P.wpn=i;else if(P.gold>=w.p){P.gold-=w.p;P.own[i]=1;P.wpn=i}else say('Не хватает золота');shop()}));
  shopB(`💣 Гранаты ×3  ·  60 💰  (есть ${P.gn})`,()=>{if(P.gold>=60){P.gold-=60;P.gn+=3}else say('Не хватает золота');shop()});
  shopB('📺 +50 💰 за рекламу',()=>requestRewardAd(grantAdGold));shopB('Закрыть',()=>SH.style.display='none');
}
$('shp').onclick=()=>{SH.style.display=SH.style.display==='block'?'none':'block';if(SH.style.display==='block')shop()};
$('gr').onclick=()=>{if(P.gn<=0)return say('Гранат нет. Купите в магазине 🛒');const[t]=pick(P,16),tg=t||{x:P.x+Math.sin(P.g.rotation.y)*9,z:P.z+Math.cos(P.g.rotation.y)*9};P.gn--;throwG(P,tg);P.aim=.5;P.gt=.7};
let shake=0;
const IC={};function icoTex(ch){return IC[ch]||(()=>{const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');x.font='72px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(ch,48,52);return IC[ch]=new THREE.CanvasTexture(c)})()}
function sparkFx(x,y,z){const m=new THREE.Mesh(SPH,bm(0xffb030));m.scale.setScalar(.12);m.position.set(x,y,z);scene.add(m);FX.push({m,t:.5,v:[rnd(-2,2),rnd(2,5),rnd(-2,2)]})}
function glowTex(rgb){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,`rgba(${rgb},1)`);g.addColorStop(.35,`rgba(${rgb},.5)`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}
const addM=c=>new THREE.MeshBasicMaterial({color:c,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}),mzV=new THREE.Vector3();
const lzCore=new THREE.Mesh(BOX,addM(0xff2a2a)),lzGlow=new THREE.Mesh(BOX,addM(0xff2a2a)),lzDot=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('255,60,60'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false})),flS=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('255,200,60'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
lzCore.material.opacity=.4;lzGlow.material.opacity=.12;lzDot.scale.set(1.3,1.3,1);flS.scale.set(3.4,3.4,1);lzCore.visible=lzGlow.visible=lzDot.visible=flS.visible=false;scene.add(lzCore,lzGlow,lzDot,flS);
function laserSight(){
  if(P.kick>0){pm.mf.getWorldPosition(mzV);flS.position.copy(mzV);flS.visible=true;flS.material.opacity=Math.min(1,P.kick/.08);flS.material.rotation=rnd(0,6)}else flS.visible=false;
  const t=P.hp>0?pick(P,WP[P.wpn].r)[0]:null;lzCore.visible=lzGlow.visible=lzDot.visible=!!t;if(!t)return;
  pm.mf.getWorldPosition(mzV);let ex=t.x,ez=t.z;const bk=blocked(P,t);if(bk){ex=bk.x;ez=bk.z}
  const ey=1.5,dx=ex-mzV.x,dy=ey-mzV.y,dz=ez-mzV.z,len=Math.hypot(dx,dy,dz);
  for(const[m,w]of[[lzCore,.04],[lzGlow,.16]]){m.position.set(mzV.x+dx/2,mzV.y+dy/2,mzV.z+dz/2);m.scale.set(w,w,len);m.lookAt(ex,ey,ez)}
  lzDot.position.set(ex,ey,ez);
}
const PN=360,pPos=new Float32Array(PN*3),pCol=new Float32Array(PN*3),pSz=new Float32Array(PN),pAl=new Float32Array(PN),pV=new Float32Array(PN*3),pL=new Float32Array(PN),pT=new Float32Array(PN);let pI=0;
const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pPos,3));pg.setAttribute('color',new THREE.BufferAttribute(pCol,3));pg.setAttribute('size',new THREE.BufferAttribute(pSz,1));pg.setAttribute('alpha',new THREE.BufferAttribute(pAl,1));
const pMat=new THREE.ShaderMaterial({uniforms:{k:{value:600}},transparent:true,depthWrite:false,vertexColors:true,
  vertexShader:'attribute float size;attribute float alpha;varying vec3 vC;varying float vA;uniform float k;void main(){vC=color;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*k/-mv.z;gl_Position=projectionMatrix*mv;}',
  fragmentShader:'varying vec3 vC;varying float vA;void main(){gl_FragColor=vec4(vC,vA);}'});
const pts=new THREE.Points(pg,pMat);pts.frustumCulled=false;scene.add(pts);
function dust(o,dt){o.dt2=(o.dt2||0)-dt;if(o.dt2>0)return;o.dt2=.13;const i=pI++%PN;
  pPos[i*3]=o.x+rnd(-.3,.3);pPos[i*3+1]=.15;pPos[i*3+2]=o.z+rnd(-.3,.3);pCol.set(Math.random()<.5?[.42,.34,.24]:[.55,.55,.52],i*3);
  pV[i*3]=rnd(-.6,.6);pV[i*3+1]=rnd(.4,1.1);pV[i*3+2]=rnd(-.6,.6);pL[i]=.5;pT[i]=.5;pSz[i]=rnd(.35,.55)}
function dustUpdate(dt){rainUpdate(dt);shake=Math.max(0,shake-dt);
  for(let i=0;i<PN;i++){if(pT[i]<=0){pAl[i]=0;pSz[i]=0;continue}pT[i]-=dt;const f=Math.max(0,pT[i]/pL[i]);pPos[i*3]+=pV[i*3]*dt;pPos[i*3+1]+=pV[i*3+1]*dt;pPos[i*3+2]+=pV[i*3+2]*dt;pAl[i]=f*.8;pSz[i]*=1-dt*2}
  pg.attributes.position.needsUpdate=pg.attributes.color.needsUpdate=pg.attributes.size.needsUpdate=pg.attributes.alpha.needsUpdate=true;
  pMat.uniforms.k.value=R.domElement.height/(2*Math.tan(cam.fov*Math.PI/360));
}
let PT=null,HT=null;
const ptM=new THREE.Mesh(new THREE.ConeGeometry(.6,1.1,3),new THREE.MeshBasicMaterial({color:0xff2a2a}));ptM.rotation.x=Math.PI;ptM.visible=false;scene.add(ptM);
function pick(a,rg){
  if(a.guard&&att&&HT&&HT.hp>0){const d=dst(a,HT)-HT.r;if(d<rg)return[HT,d]}
  if(PT&&PT.hp>0){const team=a===P?P.side:a.t;if(PT.t!==team&&(a===P||(a.kind==='u'&&a.t===P.side&&dst(a,P)<15))){const d=dst(a,PT)-PT.r;if(d<rg)return[PT,d]}}
  return pickOld(a,rg);
}
const tapS={};
cv.addEventListener('pointerdown',e=>{tapS[e.pointerId]={x:e.clientX,y:e.clientY,t:performance.now()}});
cv.addEventListener('pointerup',e=>{const s=tapS[e.pointerId];delete tapS[e.pointerId];if(!s||performance.now()-s.t>350||Math.hypot(e.clientX-s.x,e.clientY-s.y)>12)return;
  const rc=new THREE.Raycaster(),pt=new THREE.Vector3();rc.setFromCamera({x:e.clientX/innerWidth*2-1,y:-(e.clientY/innerHeight)*2+1},cam);
  if(!rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-1.2),pt))return;
  let b=null,bd=3.2;for(const u of U)if(u.t===EN[P.side]&&u.hp>0&&u.g.visible){const d=Math.hypot(u.x-pt.x,u.z-pt.z)-u.r;if(d<bd){bd=d;b=u}}
  if(b){PT=PT===b?null:b;say(PT?'🎯 Фокус на цели: стреляете все вокруг вас':'Фокус снят')}});
function panic(u,dt){const bs=[...TW.filter(o=>o.t===u.t),...PTS.filter(p=>p.owner===u.t&&p.pk==='b'),CA[u.t]];let b=bs[0],bd=1e9;for(const o of bs){const d=dst(u,o);if(d<bd){bd=d;b=o}}
  if(bd-(b.r||3)>5)return mv(u,b.x,b.z,5.5,dt);
  if(!u.called){u.called=1;spT[u.t]=Math.min(spT[u.t],.2);say(`📣 ${NM[u.t]} зовут подкрепление!`)}return 0}
function goal(u){
  if(u.cp){let b=null,bd=70;for(const p of PTS)if(p.owner!==u.t){const d=dst(u,p);if(d<bd){bd=d;b=p}}if(b)return b}
  return goalOld(u)}
const camP={x:0,z:12},lk={x:0,z:0},lkT={x:0,z:0};
function lookIn(x,z){lkT.x=x;lkT.z=z}
function camUpdate(dt){
  lk.x+=(lkT.x-lk.x)*Math.min(1,dt*2.5);lk.z+=(lkT.z-lk.z)*Math.min(1,dt*2.5);
  const vh=2*Math.tan(cam.fov*Math.PI/360)*43,vw=vh*cam.aspect,tx=P.x+lk.x*.2*vw,tz=P.z+lk.z*.2*vh,dx=tx-camP.x,dz=tz-camP.z,dl=Math.hypot(dx,dz),DZ=1.2;
  if(dl>DZ){const k=Math.min(1,dt*4)*(dl-DZ)/dl;camP.x+=dx*k;camP.z+=dz*k}
  cam.position.set(camP.x+(shake>0?rnd(-.3,.3):0),34,camP.z+26+(shake>0?rnd(-.3,.3):0));cam.lookAt(camP.x,0,camP.z);
}
const PTS=[];
function mkPoint(kind,x,z){
  const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
  const ring=new THREE.Mesh(new THREE.RingGeometry(5.6,6,40),new THREE.MeshBasicMaterial({color:0x999999,transparent:true,opacity:.75,side:2}));ring.rotation.x=-Math.PI/2;ring.position.y=.12;g.add(ring);
  let rc=null,pile=null;if(kind==='m'){
    const wallM=M(0xc79a5a),roofM=M(0x8e8e8a),stM=[];
    part(wallM,5,2.6,4.4,0,1.3,0,g);for(const xx of[-1.7,0,1.7])part(M(0xa8793e),.15,2.5,4.5,xx,1.3,0,g);
    part(roofM,5.6,.45,5,0,2.85,0,g);for(let i=-2;i<=2;i++)stM.push(part(M(0x8e8e8a),.55,.1,5.05,i*1.05,3.12,0,g));
    pile=new THREE.Group();pile.position.set(.8,3.1,0);g.add(pile);for(let i=0;i<4;i++)part(M(0xf2c230,0x6a4a00),.8,.14,.8,0,.1+i*.16,0,pile);part(wood,.9,.6,.9,-1,.3,.2,pile);
    for(const[a,b]of[[-3,-2.4],[3,-2.4],[-3,2.4],[3,2.4]])part(M(0xc9b07a),1.5,.8,1.1,a,.4,b,g);
    rc=o=>{roofM.color.setHex(o?0xb59d6a:0x8e8e8a);stM.forEach(m=>m.material.color.setHex(o?STR[o]:0x8e8e8a))};
  }
  else{part(M(0x8a7a5a),6,3.2,4.5,0,1.6,0,g);const r=new THREE.Mesh(new THREE.ConeGeometry(4.8,2.4,4),M(0x5a4a3a));r.position.y=4.4;r.rotation.y=.785;g.add(r);part(M(0x2a2218),1.4,2,.2,0,1,2.3,g)}
  const fl=flag(g,3.4,0,-2.6,0x888888);OBS.push({x,z,hw:2.8,hd:2.4});
  PTS.push({kind:'pt',pk:kind==='m'?'m':'b',x,z,r:6,owner:null,prog:0,t:3,g,ring,flm:fl.material,bar:mkBar(5),pile,rc});if(rc)rc(null);
}
mkPoint('m',0,-50);mkPoint('m',0,50);mkPoint('m',-4,2);mkPoint('b',-16,24);mkPoint('b',16,-24);
function pointsUpdate(dt){
  for(const p of PTS){battlefield