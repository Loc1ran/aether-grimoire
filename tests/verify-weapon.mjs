import assert from 'node:assert/strict';
import { Vector3, Quaternion } from '@iwsdk/core';
import { cli } from './iwsdk.mjs';
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const index=cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex;
const query=()=>cli('ecs','query',{entityIndex:index}).result;
const state=()=>query().components.find(c=>c.componentId==='Combat').values;
const transform=query().components.find(c=>c.componentId==='Transform').values;
const normal=new Vector3(0,1,0);
const portal=new Vector3().fromArray(transform.position).addScaledVector(normal,.045);
const handle=portal.clone().addScaledVector(normal,.29);
const position=v=>({x:v.x,y:v.y,z:v.z});
cli('xr','set-transform',{device:'controller-right',position:position(portal)});
await sleep(250); assert.equal(state().weapon,'Stored','approach alone does not equip');
cli('xr','set-gamepad-state',{device:'controller-right',buttons:[{index:1,value:1}]});
await sleep(550);assert.equal(state().weapon,'Ready','confirmed grip prepares');
cli('xr','set-gamepad-state',{device:'controller-right',buttons:[{index:1,value:0}]});
cli('xr','set-transform',{device:'controller-right',position:position(handle)});
cli('xr','set-gamepad-state',{device:'controller-right',buttons:[{index:1,value:1}]});
assert.equal(state().weapon,'Extracting');
cli('xr','animate-to',{device:'controller-right',position:position(handle.clone().addScaledVector(normal,.28)),duration:.7});
let current=state();console.log('PARTIAL',JSON.stringify(current));assert.ok(current.extraction>.3 && current.extraction<.8);
cli('xr','animate-to',{device:'controller-right',position:position(handle.clone().addScaledVector(normal,.62)),duration:.8});
current=state();console.log('HELD',JSON.stringify(current));assert.equal(current.weapon,'Held');
const before=current.casts;
cli('xr','set-select-value',{device:'controller-right',value:1});await sleep(350);
cli('xr','set-select-value',{device:'controller-right',value:0});
assert.equal(state().casts,before,'weapon hand cannot cast');
cli('xr','set-transform',{device:'controller-left',position:{x:-.2,y:1.25,z:-.45}});
cli('xr','look-at',{device:'controller-left',target:{x:0,y:1.2,z:-2.5}});
cli('xr','set-select-value',{device:'controller-left',value:1});await sleep(400);
cli('xr','set-select-value',{device:'controller-left',value:0});
current=state();assert.equal(current.weapon,'Held');assert.ok(current.casts>before,'free hand casts while sword held');
console.log('PASS no proximity equip, regrab, partial/full pull, ownership, simultaneous free-hand casting');
cli('xr','set-transform',{device:'controller-right',position:{x:-1,y:1,z:-.35},orientation:{pitch:0,yaw:0,roll:0}});
await sleep(700);
cli('ecs','pause',{});
try {
  cli('ecs','step',{count:10,delta:.016});
  const baseline=state().casts;
  for(let step=1;step<=20;step++) {
    cli('xr','set-transform',{device:'controller-right',position:{x:-1+step*.02,y:1,z:-.35}});
    cli('ecs','step',{count:1,delta:.016});
  }
  assert.equal(state().casts,baseline,'a slow full movement must not emit an aura');
  for(let step=1;step<=5;step++) {
    cli('xr','set-transform',{device:'controller-right',position:{x:-.6+step*.08,y:1,z:-.35}});
    cli('ecs','step',{count:1,delta:.016});
  }
  assert.equal(state().casts,baseline+1,'a fast swing emits one aura');
  cli('ecs','step',{count:4,delta:.016});
  cli('browser','screenshot',{},['--output-file','artifacts/katana-aura.png']);
  console.log('PASS slow movement rejected and fast swing aura captured');
} finally { cli('ecs','resume',{}); }
cli('xr','set-transform',{device:'controller-right',position:{x:.2,y:1,z:-.3},orientation:{pitch:0,yaw:0,roll:0}});
const swordIndex=cli('ecs','find',{namePattern:'^Veilblade$'}).result.entities[0].entityIndex;
const swordTransform=cli('ecs','query',{entityIndex:swordIndex}).result.components.find(c=>c.componentId==='Transform').values;
const bladeDirection=new Vector3(0,1,0).applyQuaternion(new Quaternion().fromArray(swordTransform.orientation));
const swingStart=new Vector3(.65,1.2,-1.05).addScaledVector(bladeDirection,-.5);swingStart.x-=.6;
cli('xr','set-transform',{device:'controller-right',position:position(swingStart)});
await sleep(350);const hitsBefore=state().hits, castsBefore=state().casts;
const swingEnd=swingStart.clone();swingEnd.x+=1.2;
cli('xr','animate-to',{device:'controller-right',position:position(swingEnd),duration:.3});
assert.ok(state().hits>hitsBefore,'real blade sweep damages close target');
assert.ok(state().casts>castsBefore,'full swing emits a traveling sword aura');
console.log('PASS live sword sweep hits target');
cli('browser','screenshot',{},['--output-file','artifacts/held-runtime.png']);
await import('./verify-sheathing.mjs');
