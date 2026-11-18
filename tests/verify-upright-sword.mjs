import assert from 'node:assert/strict';
import { Vector3,Quaternion } from '@iwsdk/core';
import { cli } from './iwsdk.mjs';
const index=cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex;
const state=()=>cli('ecs','query',{entityIndex:index,components:['Combat']}).result.components[0].values;
const input=steps=>cli('browser','interact',{steps}),step=count=>cli('ecs','step',{count,delta:.016});
const wait=durationMs=>({action:'wait',durationMs}),key=(action,key)=>({action,key}),move=(x,y)=>({action:'pointerMove',point:{x,y}});
const b=cli('browser','snapshot',{}).result.elements.find(e=>e.role==='canvas').bounds,x=b.width/2,y=b.height/2;
if(state().state==='Dormant')input([key('press','g'),wait(2200)]);
if(state().state==='Summoning'){cli('ecs','pause',{});step(100);cli('ecs','resume',{});}
if(state().weapon==='Stored'){
 input([move(x,y+200),key('keyDown','e'),wait(650),key('keyUp','e'),wait(150)]);
 if(state().weapon==='Preparing'){cli('ecs','pause',{});step(40);cli('ecs','resume',{});}
 input([key('keyDown','e'),wait(250),move(x,y),wait(500),key('keyUp','e'),wait(900)]);
}
assert.equal(state().weapon,'Held');
const sword=cli('ecs','find',{namePattern:'^Veilblade$'}).result.entities[0].entityIndex;
const pose=()=>{const p=cli('ecs','query',{entityIndex:sword,components:['Transform']}).result.components[0].values;const axis=new Vector3(0,1,0).applyQuaternion(new Quaternion().fromArray(p.orientation));return {axis,tipY:p.position[1]+axis.y*.84};};
cli('ecs','pause',{});
try{
 input([move(x,y)]);step(80);assert.ok(Math.abs(pose().axis.y)<.2 && pose().axis.z<-.85,'resting blade must point forward and stay horizontal');
 cli('browser','screenshot',{},['--output-file','artifacts/sword-upright.png']);
 for(const kind of ['f','click']){
  input([move(b.width*.7,b.height*.65)]);step(3);const before=state().casts;
  input(kind==='f'?[key('press','f')]:[{action:'pointerDown',button:'left',point:{x:b.width*.7,y:b.height*.65}},{action:'pointerUp',button:'left'}]);
  step(14);const first=pose().tipY;step(6);assert.ok(first-pose().tipY>.5,kind+' must chop downward');
  assert.ok(state().casts>before,kind+' must release a sword attack');
  if(kind==='f')cli('browser','screenshot',{},['--output-file','artifacts/sword-vertical-attack.png']);
  step(65);
 }
 input([move(x,y)]);step(40);assert.ok(Math.abs(pose().axis.y)<.2 && pose().axis.z<-.85);assert.equal(state().weapon,'Held');
 console.log('PASS horizontal resting blade, F overhead chop, click overhead chop, sword attacks and horizontal recovery');
}finally{cli('ecs','resume',{});input([key('keyUp','e'),key('keyUp','r'),{action:'pointerUp',button:'left'}]);}
