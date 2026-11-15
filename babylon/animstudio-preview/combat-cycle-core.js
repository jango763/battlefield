/* Battlefield Babylon: deterministic weapon-specific stop-to-fire rules.
   Pure state machine. This file does not modify the approved soldier or grip.
   The interactive browser demo is in combat-demo.js. */
(function(root,factory){
  const value=factory();
  if(typeof module==='object'&&module.exports)module.exports=value;
  if(root)root.BattlefieldCombatCycle=value;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const PROFILES=Object.freeze({
    Kar98k:Object.freeze([
      {id:'run',label:'Боевой бег',pose:'Run',moving:true,ms:1100,crouch:0},
      {id:'stop',label:'Остановка перед стрельбой',pose:'Hold',moving:false,ms:260,crouch:.30},
      {id:'lower',label:'Пригнулся, занял стрелковую стойку',pose:'Aim',moving:false,ms:460,crouch:1},
      {id:'aim',label:'Прицельная подготовка',pose:'Aim',moving:false,ms:820,crouch:1},
      {id:'fire',label:'Прицельный выстрел',pose:'Fire',moving:false,ms:200,crouch:1},
      {id:'bolt',label:'Передёргивание затвора Kar98k',pose:'Aim',moving:false,ms:900,crouch:1},
      {id:'recover',label:'Выход из стрелковой стойки',pose:'Hold',moving:false,ms:490,crouch:.30},
      {id:'resume',label:'Продолжение боевого бега',pose:'Run',moving:true,ms:1150,crouch:0}
    ]),
    Panzerschreck:Object.freeze([
      {id:'run',label:'Переноска в боевом беге',pose:'Run',moving:true,ms:1200,crouch:0},
      {id:'stop',label:'Полная остановка',pose:'Hold',moving:false,ms:300,crouch:.05},
      {id:'aim',label:'Устойчивая стойка с трубой на плече',pose:'Aim',moving:false,ms:1000,crouch:.10},
      {id:'fire',label:'Выстрел только с места',pose:'Fire',moving:false,ms:200,crouch:.10},
      {id:'recover',label:'Опустить оружие',pose:'Hold',moving:false,ms:650,crouch:.05},
      {id:'resume',label:'Вернуться к бегу',pose:'Run',moving:true,ms:1150,crouch:0}
    ])
  });
  const allowed=['Run','Hold','Aim','Fire'];
  function create({weapon='Kar98k',applyPose=()=>{},onStage=()=>{},onShot=()=>{},now=()=>performance.now()}={}){
    if(!PROFILES[weapon])throw Error('Unsupported combat profile '+weapon);
    const steps=PROFILES[weapon];
    const state={weapon,phase:'idle',index:-1,playing:false,moving:false,
      velocity:0,crouch:0,shots:0,bolts:0,triggerWhileMoving:0,
      lastShotHadStop:false,ready:false,history:[]};
    let phaseStarted=0, busy=false, token=0;
    function snapshot(){return {...state,history:state.history.map(x=>({...x}))}}
    async function enter(index,time){
      if(index>=steps.length){state.playing=false;state.phase='completed';
        state.moving=false;state.velocity=0;state.crouch=0;onStage(snapshot());return snapshot()}
      const step=steps[index];
      if(!allowed.includes(step.pose))throw Error('Unknown animation pose '+step.pose);
      // Make phase and velocity transitions synchronous BEFORE any animation await.
      // A shot must never be permitted while the soldier is running or braking.
      const previous=state.phase;
      state.phase=step.id;state.index=index;state.moving=step.moving;
      state.velocity=step.moving?1:0;state.crouch=step.crouch;
      phaseStarted=time;busy=true;
      if(step.id==='fire'){
        if(state.velocity!==0||state.moving)state.triggerWhileMoving++;
        if(state.triggerWhileMoving)throw Error('Shot attempted during movement');
        if(!state.history.some(x=>x.phase==='stop'))throw Error('Shot before stopping');
        if(!state.history.some(x=>x.phase==='aim'))throw Error('Shot before aiming');
        state.shots++;state.lastShotHadStop=true;
      }
      if(step.id==='bolt'){
        if(weapon!=='Kar98k')throw Error('No bolt phase for rocket launcher');
        if(previous!=='fire')throw Error('Bolt requires a preceding shot');
        state.bolts++;
      }
      state.history.push({phase:step.id,pose:step.pose,moving:step.moving,
        timestamp:time,crouch:step.crouch});
      onStage(snapshot());
      const currentToken=token;
      try{
        await applyPose(step.pose,step.id);
        if(currentToken!==token)return snapshot();
        if(step.id==='fire')onShot(snapshot());
      }finally{if(currentToken===token)busy=false}
      return snapshot();
    }
    async function start(time=now()){
      if(state.playing)throw Error('Combat cycle already running');
      token++;state.playing=true;state.index=-1;state.history=[];
      state.phase='idle';state.moving=false;state.velocity=0;state.crouch=0;
      state.shots=0;state.bolts=0;state.triggerWhileMoving=0;
      state.lastShotHadStop=false;state.ready=true;
      return enter(0,time);
    }
    async function tick(time=now()){
      if(!state.playing||busy)return snapshot();
      if(time-phaseStarted>=steps[state.index].ms)
        return enter(state.index+1,time);
      return snapshot();
    }
    function stop(){
      token++;busy=false;state.playing=false;state.phase='idle';
      state.moving=false;state.velocity=0;state.crouch=0;
      onStage(snapshot());return snapshot();
    }
    return {start,tick,stop,snapshot,steps};
  }
  return {create,PROFILES};
});
