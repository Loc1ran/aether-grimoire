import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { cli } from './iwsdk.mjs';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const entity = cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex;
const state = () => cli('ecs','query',{entityIndex:entity,components:['Combat']}).result.components[0].values;
const buttons = (device, values) => cli('xr','set-gamepad-state',{device,buttons:values.map(([index,value])=>({index,value}))});
if(!cli('xr','status').result.sessionActive)cli('xr','enter',{});
cli('xr','set-input-mode',{mode:'controller'});
try {
  for(const device of ['controller-left','controller-right'])cli('xr','set-connected',{device,connected:true});
  cli('xr','set-transform',{device:'controller-right',position:{x:.25,y:1.3,z:-.4}});
  cli('xr','look-at',{device:'controller-right',target:{x:.65,y:1,z:-1.05}});
  if(state().state==='Dormant') {
    buttons('controller-right',[[0,1],[1,1]]);await sleep(700);
    buttons('controller-right',[[0,0],[1,0]]);await sleep(1500);
  }
  const before=state();
  buttons('controller-right',[[0,1]]);await sleep(400);
  assert.equal(state().spellRight,'bolt');
  buttons('controller-right',[[0,0]]);await sleep(700);
  const bolt=state();
  assert.equal(bolt.casts,before.casts+1,'controller release casts one bolt');
  assert.ok(bolt.hits>before.hits,'the changed projectile still hits the target');
  cli('xr','set-transform',{device:'controller-left',position:{x:-.3,y:1.25,z:-.45}});
  cli('xr','look-at',{device:'controller-left',target:{x:-.3,y:1.25,z:-3}});
  cli('xr','look-at',{device:'controller-right',target:{x:.3,y:1.3,z:-3}});
  buttons('controller-left',[[3,1]]);buttons('controller-right',[[4,1]]);await sleep(1100);
  const held=state();assert.equal(held.spellLeft,'shield');assert.equal(held.spellRight,'blast');
  assert.ok(cli('xr','status').result.sessionActive);
  cli('browser','screenshot',{},['--output-file','artifacts/spell-vfx/xr-held.png']);
  buttons('controller-left',[[3,0]]);buttons('controller-right',[[4,0]]);await sleep(300);
  const released=state();assert.equal(released.spellLeft,'');assert.equal(released.spellRight,'');
  assert.equal(released.casts,bolt.casts+1);
  writeFileSync('artifacts/spell-vfx/xr-state.json',JSON.stringify({before,bolt,held,released},null,2));
  console.log('PASS active XR: controller bolt hit, independent two-hand shield/blast, release and screenshot');
} finally {
  for(const device of ['controller-left','controller-right'])buttons(device,[[0,0],[1,0],[2,0],[3,0],[4,0]]);
}
