// Run from a checkout. Generated fixtures remain local and are ignored by Git.
const fs=require('fs'),path=require('path');
const repo=path.resolve(__dirname,'../..');
const html=Array.from({length:17},(_,i)=>fs.readFileSync(path.join(repo,'preview/parts/german-'+String(i).padStart(3,'0')+'.txt'),'utf8')).join('');
fs.writeFileSync(path.join(__dirname,'preview-original.html'),html);
fs.copyFileSync(path.join(repo,'preview/german-v2.js'),path.join(__dirname,'german-v2.js'));
fs.copyFileSync(path.join(repo,'preview/german-v2.html'),path.join(__dirname,'german-v2.html'));
fs.writeFileSync(path.join(__dirname,'german.glb'),Buffer.from(html.match(/id="preview-german-glb"[^>]*>([\s\S]*?)<\/script>/)[1],'base64'));
fs.mkdirSync(path.join(__dirname,'vendor'),{recursive:true});
const threeRoot=path.dirname(require.resolve('three/package.json'));
fs.copyFileSync(path.join(threeRoot,'build/three.min.js'),path.join(__dirname,'vendor/three.min.js'));
fs.copyFileSync(path.join(threeRoot,'examples/js/loaders/GLTFLoader.js'),path.join(__dirname,'vendor/GLTFLoader.js'));
