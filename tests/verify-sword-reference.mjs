import assert from 'node:assert/strict';
import { cli } from './iwsdk.mjs';
import { writeFileSync } from 'node:fs';
import { Quaternion,Vector3 } from '@iwsdk/core';
assert.equal(cli('xr','status',{}).result.sessionActive,false);
const index=cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex;
const state=()=>cli('ecs','query',{entityIndex:index,components:['Combat']}).result.components[0].values;
const input=steps=>cli('browser','interact',{steps});
const wait=durationMs=>({action:'wait',durationMs});
const b=cli('browser','snapshot',{}).result.elements.find(e=>e.role==='canvas').bounds;
const x=b.width/2,y=b.height/2;
const move=(px,py)=>({action:'pointerMove',point:{x:px,y:py}});
if(state().state==='Dormant')input([{action:'press',key:'g'},wait(2200)]);
if(state().weapon==='Stored'){
  input([move(x,y+200),{action:'keyDown',key:'e'},wait(650),{action:'keyUp',key:'e'},wait(150)]);
  input([{action:'keyDown',key:'e'},wait(180),move(x,y),wait(400),{action:'keyUp',key:'e'},wait(1200)]);
}
assert.equal(state().weapon,'Held');
cli('ecs','pause',{});
const stages=[];
const capture=name=>{stages.push({name,...state()});cli('browser','screenshot',{},['--output-file',`artifacts/sword-${name}.png`]);};
const step=count=>cli('ecs','step',{count,delta:.016});
try{
  capture('ready');
  const before=state().casts;
  const swingX=b.width*.6,swingY=b.height*.68;
  input([move(swingX,swingY)]);step(3);
  input([{action:'pointerDown',button:'left',point:{x:swingX,y:swingY}},move(swingX+180,swingY+30),{action:'pointerUp',button:'left'}]);
  step(6);capture('windup');step(9);capture('cut');step(8);capture('followthrough');step(12);capture('recovery');step(35);
  assert.equal(state().swordAction,'Ready');assert.ok(state().casts>before,'the new swing must still release its sword skill');
  capture('returned');
  const swordIndex=cli('ecs','find',{namePattern:'^Veilblade$'}).result.entities[0].entityIndex;
  const tipY=()=>{const p=cli('ecs','query',{entityIndex:swordIndex,components:['Transform']}).result.components[0].values;return new Vector3(0,.84,0).applyQuaternion(new Quaternion().fromArray(p.orientation)).add(new Vector3().fromArray(p.position)).y;};
  for(const dy of [-150,150]){
    step(80);assert.equal(state().swordAction,'Ready');
    input([move(swingX,swingY)]);step(3);
    input([{action:'pointerDown',button:'left',point:{x:swingX,y:swingY}},move(swingX,swingY+dy),{action:'pointerUp',button:'left'}]);
    step(3);assert.equal(state().swordAction,'Windup');step(11);const first=tipY();step(6);const last=tipY();assert.ok((last-first)*dy<0,`screen drag ${dy} must control cut direction: ${first} -> ${last}`);
    capture(dy<0?'rising':'overhead');step(45);
  }
  const beforeAim=state().casts,aims=[];
  for(const [mx,my] of [[.25,.5],[.75,.5],[.5,.25],[.5,.75]]){
    input([move(b.width*mx,b.height*my)]);step(40);
    const p=cli('ecs','query',{entityIndex:swordIndex,components:['Transform']}).result.components[0].values;
    aims.push(new Vector3(0,1,0).applyQuaternion(new Quaternion().fromArray(p.orientation)));
  }
  assert.ok(aims.every(direction=>Math.abs(direction.y)<.25 && direction.z<-.75),'mouse movement must keep the resting blade horizontal and pointing forward');
  assert.equal(state().casts,beforeAim,'mouse aiming alone must not attack');
  input([move(x,y)]);step(40);capture('final');
  writeFileSync('artifacts/sword-reference-state.json',JSON.stringify(stages,null,2));
  console.log('PASS horizontal guard across mouse positions, full cuts, moving recovery, rising/overhead directions and sword skill');
}finally{cli('ecs','resume',{});}
