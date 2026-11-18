import assert from 'node:assert/strict';
import { Vector3, Quaternion } from '@iwsdk/core';
import { cli } from './iwsdk.mjs';

assert.equal(cli('xr','status',{}).result.sessionActive,false,'use the desktop preview');
const index=cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex;
const state=()=>cli('ecs','query',{entityIndex:index,components:['Combat']}).result.components[0].values;
const input=steps=>cli('browser','interact',{steps});
const bounds=cli('browser','snapshot',{}).result.elements.find(e=>e.role==='canvas').bounds;
const x=bounds.width/2, y=bounds.height/2;
const move=(px,py)=>({action:'pointerMove',point:{x:px,y:py}});
const wait=durationMs=>({action:'wait',durationMs});
const down=key=>({action:'keyDown',key}), up=key=>({action:'keyUp',key});
const advance=count=>{cli('ecs','pause',{});try{cli('ecs','step',{count,delta:.016});}finally{cli('ecs','resume',{});}};
try {
if(state().state==='Dormant')input([{action:'press',key:'g'},wait(2200)]);
if(state().state==='Summoning')advance(100);
assert.equal(state().state,'Idle');
const beforeDraw=state().casts;
if(state().weapon==='Stored'){
cli('browser','screenshot',{},['--output-file','artifacts/aura-book-desktop.png']);
input([move(x,y+200),down('e'),wait(650),up('e'),wait(150)]);
if(state().weapon==='Preparing')advance(40);
assert.equal(state().weapon,'Ready');
input([down('e'),wait(180),move(x,y),wait(400),up('e'),wait(1600)]);
}
assert.equal(state().weapon,'Held','releasing draw must keep sword equipped');
assert.equal(state().casts,beforeDraw,'settling into the desktop guard must not fire an attack');
input([move(x,y)]);advance(40);
const swordIndex=cli('ecs','find',{namePattern:'^Veilblade$'}).result.entities[0].entityIndex;
const pose=cli('ecs','query',{entityIndex:swordIndex,components:['Transform']}).result.components[0].values;
const blade=new Vector3(0,1,0).applyQuaternion(new Quaternion().fromArray(pose.orientation));
assert.ok(blade.y>.92,'desktop guard must point vertically up');
cli('browser','screenshot',{},['--output-file','artifacts/aura-sword-desktop.png']);
const beforeReturn=state().casts;
input([down('r'),wait(350),up('r'),wait(350)]);
assert.equal(state().weapon,'Held','aligning above the pages cannot store the sword');
assert.equal(state().casts,beforeReturn,'cancelling insertion must not launch an attack');
input([move(bounds.width*.35,bounds.height*.7),wait(700)]);
const beforeSwing=state().casts;
input([move(bounds.width*.7,bounds.height*.7),wait(100)]);
assert.equal(state().casts,beforeSwing,'moving the cursor alone must not attack');
input([move(x+200,bounds.height*.7),wait(150),{action:'pointerDown',button:'left',point:{x:x+200,y:bounds.height*.7}},move(x,bounds.height*.7),{action:'pointerUp',button:'left'},wait(1200)]);
advance(60);
assert.ok(state().casts>beforeSwing,'a deliberate click-drag must launch a cutting attack: '+JSON.stringify(state()));
input([move(x,y-150),wait(700)]);
input([down('r'),wait(500),move(x,y-125),wait(300),move(x,y-100),wait(300),move(x,y),wait(300),move(x,y+120),wait(500)]);
assert.equal(state().weapon,'Stored','only a full downward push seats the blade');
input([up('r')]);
console.log('PASS desktop guard, persistent equip, swing aura, cancelled insertion, and full manual insertion');
} finally {input([up('r'),up('e'),{action:'pointerUp',button:'left'}]);}
