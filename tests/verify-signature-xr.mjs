import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { Quaternion } from '@iwsdk/core';
import { cli } from './iwsdk.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const index=cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex;
const state=()=>cli('ecs','query',{entityIndex:index,components:['Combat']}).result.components[0].values;
const button=(device,index,value)=>cli('xr','set-gamepad-state',{device,buttons:[{index,value}]});
assert.equal(state().weapon,'Held','run after the desktop encounter with the blade still equipped');
const castsBefore=state().casts;
if(!cli('xr','status',{}).result.sessionActive)cli('xr','enter',{});
cli('xr','set-input-mode',{mode:'controller'});
assert.equal(cli('xr','status',{}).result.sessionActive,true);
await sleep(300);
assert.equal(state().casts,castsBefore,'entering an immersive session must not launch an attack');
try {
  cli('ecs','pause',{});
  button('controller-right',3,1);cli('ecs','step',{count:2,delta:.016});
  assert.equal(state().swordAction,'Counter','A opens the timed counter window');
  button('controller-right',3,0);
  button('controller-left',2,1);cli('ecs','step',{count:2,delta:.016});
  assert.ok(state().vortexTime>2.8,'the free thumbstick activates the vortex');
  button('controller-left',2,0);
  cli('ecs','resume',{});
  cli('xr','animate-to',{device:'controller-right',position:{x:.45,y:1.25,z:-.45},orientation:{pitch:0,yaw:35,roll:-45},duration:1.2});
  await sleep(750);
  const swordIndex=cli('ecs','find',{namePattern:'^Veilblade$'}).result.entities[0].entityIndex;
  const rotation=()=>new Quaternion().fromArray(cli('ecs','query',{entityIndex:swordIndex,components:['Transform']}).result.components[0].values.orientation);
  const startRotation=rotation(),before=state().casts;
  cli('xr','animate-to',{device:'controller-right',position:{x:-.35,y:1.25,z:-.5},orientation:{pitch:0,yaw:-45,roll:50},duration:.32});
  assert.ok(startRotation.angleTo(rotation())>.5,'blade orientation must follow the tracked hand through a slash');
  assert.ok(state().casts>before,'a physical slash must release the dimension cut');
  await import('./verify-sheathing.mjs');
  writeFileSync('artifacts/signature-xr-state.json',JSON.stringify({session:cli('xr','status',{}).result,combat:state()},null,2));
  console.log('PASS immersive transition, controller counter/vortex, tracked blade rotation, dimension cut and manual insertion');
} finally {
  button('controller-right',3,0);button('controller-left',2,0);
  cli('ecs','resume',{});
}
