import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {cli} from './iwsdk.mjs';
const index=cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex;
const state=()=>cli('ecs','query',{entityIndex:index,components:['Combat']}).result.components[0].values;
const input=steps=>cli('browser','interact',{steps});
const wait=durationMs=>({action:'wait',durationMs}),press=key=>({action:'press',key});
const bounds=cli('browser','snapshot',{}).result.elements.find(e=>e.role==='canvas').bounds;
const x=bounds.width/2,y=bounds.height/2,move=(x,y)=>({action:'pointerMove',point:{x,y}});
if(state().state==='Dormant')input([press('g'),wait(2200)]);
assert.equal(state().state,'Idle');
input([move(x,y+200),{action:'keyDown',key:'e'},wait(650),{action:'keyUp',key:'e'},wait(150)]);
assert.equal(state().weapon,'Ready');
input([{action:'keyDown',key:'e'},wait(120),move(x,y),wait(400),{action:'keyUp',key:'e'},wait(800)]);
assert.equal(state().weapon,'Held');assert.equal(state().casts,0,'drawing must not attack');
cli('browser','screenshot',{},['--output-file','artifacts/combat-ready.png']);
cli('ecs','pause',{});
try {
  input([press('t')]);cli('ecs','step',{count:120,delta:.016});cli('ecs','step',{count:28,delta:.016});
  input([{action:'pointerDown',button:'right',point:{x:x+500,y}}]);
  cli('ecs','step',{count:20,delta:.016});
  let s=state();console.log('COUNTER',JSON.stringify(s));
  assert.ok(s.deflections>0&&s.counterTime>0,'timed guard must counter the incoming boss spell');
  input([{action:'pointerUp',button:'right'}]);
  input([press('v')]);cli('ecs','step',{count:12,delta:.016});
  assert.ok(state().vortexTime>2,'vortex activates through the keyboard');
  const casts=state().casts;
  input([press('f')]);cli('ecs','step',{count:18,delta:.016});
  s=state();assert.ok(s.casts>casts&&s.hits>0,'sword animation must emit a damaging spatial cut');
  cli('browser','screenshot',{},['--output-file','artifacts/dimension-vortex.png']);
  cli('ecs','step',{count:40,delta:.016});
  for(let n=0;n<12&&(state().resolve<100||state().bossHealth>210);n++) {
    input([press('f')]);cli('ecs','step',{count:50,delta:.016});
    assert.ok(state().bossHealth>0,'earn the finisher before defeating the boss');
  }
  s=state();console.log('DIVIDER READY',JSON.stringify(s));assert.equal(s.resolve,100);
  input([press('q')]);cli('ecs','step',{count:18,delta:.016});
  cli('browser','screenshot',{},['--output-file','artifacts/black-divider-charge.png']);
  cli('ecs','step',{count:20,delta:.016});
  s=state();assert.equal(s.bossPhase,'Defeated');assert.equal(s.bossHealth,0);assert.ok(s.resolve<100);
  cli('browser','screenshot',{},['--output-file','artifacts/black-divider-victory.png']);
  writeFileSync('artifacts/signature-combat-state.json',JSON.stringify(s,null,2));
  console.log('PASS real desktop input: counter, vortex, full sword arcs, earned Divider and boss victory');
} finally {cli('ecs','resume',{});input([{action:'pointerUp',button:'left'},{action:'pointerUp',button:'right'}]);}
