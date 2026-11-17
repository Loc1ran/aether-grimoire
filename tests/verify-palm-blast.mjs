import assert from 'node:assert/strict';
import { cli } from './iwsdk.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const index=cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex;
const state=()=>cli('ecs','query',{entityIndex:index}).result.components.find(c=>c.componentId==='Combat').values;
if(!cli('xr','status').result.sessionActive)cli('xr','enter',{});
cli('xr','set-input-mode',{mode:'hand'});
cli('xr','set-transform',{device:'hand-left',anchor:'wrist',position:{x:-.35,y:1,z:-.2},orientation:{fingers:'forward',palm:'down'}});
cli('xr','set-hand-pose',{device:'hand-left',poseId:'fist'});
cli('xr','set-transform',{device:'hand-right',anchor:'wrist',position:{x:.2,y:1.15,z:-.3},orientation:{fingers:'up',palm:'forward'}});
cli('xr','set-hand-pose',{device:'hand-right',poseId:'open'});
if(state().state==='Dormant'){
  cli('xr','set-select-value',{device:'hand-right',value:0});
  cli('xr','set-select-value',{device:'hand-right',value:1});await sleep(350);
  cli('xr','animate-to',{device:'hand-right',anchor:'wrist',position:{x:.2,y:1.35,z:-.3},duration:.6});
  cli('xr','set-select-value',{device:'hand-right',value:0});await sleep(1400);
}
cli('xr','set-hand-pose',{device:'hand-right',poseId:'fist'});await sleep(4500);
cli('xr','set-transform',{device:'hand-right',anchor:'wrist',position:{x:.1,y:1.28,z:-.2},orientation:{fingers:'up',palm:'forward'}});
cli('xr','set-hand-pose',{device:'hand-right',poseId:'open'});await sleep(1700);
console.log('CHARGED',JSON.stringify(state()));assert.equal(state().spellRight,'blast');
const casts=state().casts;
cli('xr','animate-to',{device:'hand-right',anchor:'wrist',position:{x:.1,y:1.28,z:-.62},duration:.25});
console.log('PUSH',JSON.stringify(state()));assert.ok(state().casts>casts);
cli('xr','set-hand-pose',{device:'hand-right',poseId:'fist'});
console.log('PASS charged hand-palm blast');
