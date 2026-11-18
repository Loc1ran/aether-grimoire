import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {cli} from './iwsdk.mjs';
const index=cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex;
const state=()=>cli('ecs','query',{entityIndex:index,components:['Combat']}).result.components[0].values;
const input=steps=>cli('browser','interact',{steps});
const key=(action,key)=>input([{action,key}]);
const step=count=>cli('ecs','step',{count,delta:.016});
const shot=name=>cli('browser','screenshot',{},['--output-file','artifacts/dark-'+name+'.png']);
const pad=(side,index,value)=>cli('xr','set-gamepad-state',{device:'controller-'+side,buttons:[{index,value}]});
const bounds=cli('browser','snapshot',{}).result.elements.find(e=>e.role==='canvas').bounds;
input([{action:'pointerMove',point:{x:bounds.width*.53,y:bounds.height*.48}}]);
if(state().state==='Dormant')input([{action:'press',key:'g'},{action:'wait',durationMs:2200}]);
assert.equal(state().state,'Idle');assert.equal(state().weapon,'Stored');
const initialCasts=state().casts;
cli('xr','enter',{});cli('xr','set-input-mode',{mode:'controller'});
for(const side of ['left','right'])cli('xr','set-transform',{device:'controller-'+side,position:{x:side==='left'?-.25:.25,y:1.25,z:-.45}});
cli('xr','look-at',{device:'controller-right',target:{x:-1,y:1.45,z:-3}});
cli('ecs','pause',{});
try {
  step(5);
  shot('book');
  pad('right',0,1);step(20);pad('right',0,0);step(5);
  assert.equal(state().casts,initialCasts+1,'the new bolt must still cast through the normal input');shot('bolt');step(80);
  pad('left',3,1);step(32);assert.equal(state().spellLeft,'shield');shot('shield');pad('left',3,0);step(30);
  pad('right',4,1);step(105);
  const book=cli('ecs','query',{entityIndex:index,components:['Transform']}).result.components[0].values;
  assert.ok(book.position[1]>1.28,'the book must stay raised during the immersive charge');
  pad('right',4,0);step(6);
  assert.equal(state().casts,initialCasts+2,'charged lance must release');shot('lance');step(100);
  pad('right',2,1);step(28);pad('right',2,0);step(5);
  assert.equal(state().casts,initialCasts+3,'the cutting wave must release');shot('crescent');step(100);
  assert.equal(cli('xr','status',{}).result.sessionActive,true);
  cli('ecs','resume',{});cli('xr','exit',{});cli('ecs','pause',{});
  key('press','v');step(60);assert.ok(state().vortexTime>1);shot('vortex');
  writeFileSync('artifacts/dark-magic-state.json',JSON.stringify(state(),null,2));
  console.log('PASS illuminated manuscript, bolt, shield, charged lance, cutting wave and smoke vortex through user input');
} finally {
  if(cli('xr','status',{}).result.sessionActive){for(const index of [0,2,4])pad('right',index,0);pad('left',3,0);}
  cli('ecs','resume',{});
}
