"use strict";
const fs=require("node:fs"),vm=require("node:vm");
const targets=["babylon/jakeli-65b-iphone.html","babylon/jakeli-weapons-iphone.html","babylon/jakeli-three-squad-iphone.html"];
for(const file of targets){
 const html=fs.readFileSync(file,"utf8");
 const match=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
 let inline=0;
 for(const m of match){
  if(!m[1].trim())continue;
  const at=html.slice(0,m.index).split("\n").length;
  try{new vm.Script(m[1],{filename:file+":inline-from-line-"+at});}
  catch(e){console.error("JAKELI_INLINE_SYNTAX_FAIL",file,e.stack||e);process.exitCode=1;}
  inline++;
 }
 if(!inline){console.error("No inline script in "+file);process.exitCode=1;}
 else console.log("JAKELI_INLINE_SCRIPT_CHECK",file,inline);
}
