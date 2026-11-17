/* Battlefield US hero · Stage 2 geometry gate.
 * Research-derived geometry only; NOT an approved in-game weapon pose.
 * Ara 3D Gen donor: MIT (Joshua Olatunde, 2026)
 * https://github.com/olatunde85/3d-gen/blob/main/src/core/anim/clips/shooter.ts
 *
 * Coordinates below are ACTUALLY MEASURED from the user's American hero GLB
 * bind pose, 17 Nov 2026. Units are metres, right is model -X.
 */
(function(root,fn){const api=fn();if(root)root.BattlefieldUSHeroAraAudit=api;
 if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window==="undefined"?null:window,()=>{"use strict";
const V={add:(a,b)=>a.map((x,i)=>x+b[i]),sub:(a,b)=>a.map((x,i)=>x-b[i]),
 norm:a=>Math.hypot(...a)};
const MEASURED=Object.freeze({
 chest:[0,.545,-.084],
 rightShoulder:[-.205,.598,-.08],rightUpper:[-.277,.565,-.065],
 rightElbow:[-.412,.362,-.016],rightWrist:[-.536,.231,.072],
 leftShoulder:[.205,.598,-.08],leftUpper:[.277,.565,-.065],
 leftElbow:[.412,.362,-.016],leftWrist:[.536,.231,.072],
 rightSocket:[-.536,.206,.137],leftSocket:[.536,.206,.137]
});
const ARA={
 ready:{right:{pos:[-.15,-.36,.17],pole:[-1,-.6,-.4],dir:[.1,-.75,.65],palm:[1,0,0]},
        left:{pos:[.03,-.42,.4],pole:[.6,-1,0],dir:[-.35,.05,.93],palm:[0,1,0]}},
 aim:{right:{pos:[-.13,-.19,.22],pole:[-1,-.9,-.2],dir:[.1,-.55,.83],palm:[1,0,0]},
      left:{pos:[-.01,-.13,.5],pole:[.4,-1,0],dir:[-.35,.2,.91],palm:[0,1,0]}}
};
const WEAPON={id:"uk-lee-enfield",trigger:[0,0,0],support:[0,.040457025,.328],
 shoulder:[0,-.051387844,-.2636],muzzle:[0,.050112155,.868]};
const distance=(a,b)=>V.norm(V.sub(a,b));
function reach(side){const left=side==="left";
 const a=MEASURED[left?"leftUpper":"rightUpper"],e=MEASURED[left?"leftElbow":"rightElbow"],
  h=MEASURED[left?"leftWrist":"rightWrist"];
 return distance(a,e)+distance(e,h);}
function donorDistances(pose){
 const t=ARA[pose];if(!t)throw Error("Unknown Ara pose "+pose);
 const r=V.add(MEASURED.chest,t.right.pos),l=V.add(MEASURED.chest,t.left.pos);
 return {right:distance(r,MEASURED.rightUpper),left:distance(l,MEASURED.leftUpper),
  rightReach:reach("right"),leftReach:reach("left")};
}
function rotateGun(p,yaw,pitch){
 const [x,y,z]=p,cp=Math.cos(pitch),sp=Math.sin(pitch);
 const py=y*cp-z*sp,pz=y*sp+z*cp,cy=Math.cos(yaw),sy=Math.sin(yaw);
 return [cy*x+sy*pz,py,-sy*x+cy*pz];
}
function reference(phase="aim"){
 if(!["ready","aim"].includes(phase))throw Error("Unknown phase");
 // Rigid stock touches right shoulder. The grip is projected from the stock
 // using the real Lee-Enfield GLB manifest; not from arbitrary chest offsets.
 const stock=V.add(MEASURED.rightShoulder,phase==="ready"?
    [.055,-.055,.025]:[.055,-.035,.025]);
 const yaw=phase==="ready"?.74:.65, pitch=phase==="ready"?.20:.12;
 const supportZ=phase==="ready"?.165:.18;
 const trigger=V.sub(stock,rotateGun(WEAPON.shoulder,yaw,pitch));
 const support=V.add(trigger,rotateGun([0,WEAPON.support[1],supportZ],yaw,pitch));
 const rightDist=distance(trigger,MEASURED.rightUpper);
 const leftDist=distance(support,MEASURED.leftUpper);
 const maxReach=reach("left");
 return {phase,stock,trigger,support,yaw,pitch,supportZ,rightDist,leftDist,maxReach,
  withinReach:rightDist<reach("right")-.025&&leftDist<maxReach-.025,
  warning:"Candidate kinematic targets, NOT a visually approved hand pose"};
}
function assetReport(animationGroups){
 const expected=["Idle_Quaternius","Walk_Quaternius","Jog_Quaternius","Sprint_Quaternius"];
 const bad=expected.filter(name=>!animationGroups.some(g=>g.name===name&&g.channels===20&&g.armChannels===8));
 return {pass:bad.length===0,bad,expected};
}
return Object.freeze({MEASURED,ARA,WEAPON,reach,donorDistances,reference,assetReport});
});