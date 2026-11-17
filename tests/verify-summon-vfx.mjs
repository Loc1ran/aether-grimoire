import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { cli } from './iwsdk.mjs';

if(!cli('xr','status').result.sessionActive)cli('xr','enter',{});
cli('xr','set-input-mode',{mode:'controller'});
cli('xr','set-transform',{device:'controller-right',position:{x:.25,y:1.25,z:-.4}});
const index=cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex;
const state=()=>cli('ecs','query',{entityIndex:index}).result.components.find(c=>c.componentId==='Combat').values;
assert.equal(state().state,'Dormant');
cli('ecs','pause',{});
try {
  cli('xr','set-gamepad-state',{device:'controller-right',buttons:[{index:0,value:1},{index:1,value:1}]});
  cli('ecs','step',{count:48,delta:.016});
  cli('xr','set-gamepad-state',{device:'controller-right',buttons:[{index:0,value:0},{index:1,value:0}]});
  cli('ecs','step',{count:28,delta:.016});
  assert.equal(state().state,'Summoning');
  writeFileSync('artifacts/ink-opening-state.json',JSON.stringify(state(),null,2));
  cli('browser','screenshot',{},['--output-file','artifacts/ink-opening.png']);
  cli('ecs','step',{count:90,delta:.016});
  assert.equal(state().state,'Idle');
  console.log('PASS real summon input, mid-opening animation and completed opening');
} finally {
  cli('xr','set-gamepad-state',{device:'controller-right',buttons:[{index:0,value:0},{index:1,value:0}]});
  cli('ecs','resume',{});
}
