import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from '@iwsdk/core';
import { leafTurnProgress } from '../src/living-book.js';
import { CombatVisuals } from '../src/combat-visuals.js';
import { flowRibbon, crescentSurface } from '../src/scene-assets/lib/magic-surfaces.js';

const glb=readFileSync('public/models/aether-codex.glb');
assert.equal(glb.toString('utf8',0,4),'glTF');
const doc=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
const names=new Set(doc.nodes.map((node:{name:string})=>node.name));
for(const name of ['CoverLeft','CoverRight','PageHinge','PageLeft','PageRight','TurningLeaf0','TurningSheet2','Aura','Spine'])assert.ok(names.has(name),`export missing ${name}`);
assert.ok(!names.has('Cube')&&!doc.cameras?.length,'asset must exclude the Blender starter scene');
assert.ok(doc.images?.some((image:{bufferView?:number})=>image.bufferView!==undefined),'cover artwork must travel with the model');
for(let leaf=0;leaf<3;leaf++) {
  let previous=0;
  for(let step=0;step<=150;step++) {const p=leafTurnProgress(step/100,leaf);assert.ok(p>=previous&&p<=1,'leaf must turn once without wrapping backwards');previous=p;}
  assert.equal(previous,1);
}
for(const geometry of [flowRibbon(),crescentSurface()]) {
  assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
  assert.equal(geometry.attributes.uv.count,geometry.attributes.position.count);
  geometry.dispose();
}
const effects=new CombatVisuals(), tip=new Vector3(0,1,0), grip=new Vector3();
for(const attribute of ['shadow','wind','fire'] as const) {
  assert.ok(effects.launch(tip,new Vector3(0,0,-1),8,attribute,'bolt',18,1));
  const shot=effects.shots.find(s=>s.attribute===attribute&&s.life>0)!;
  assert.equal(shot.wisps[1].material.userData.style.value,attribute==='fire'?2:attribute==='wind'?1:0);
}
effects.swordTrail(tip,'shadow',grip);tip.x=.2;effects.swordTrail(tip,'shadow',grip);
assert.ok([...effects.trail[0].geometry.attributes.position.array].every(Number.isFinite));
effects.reset();assert.equal(effects.trail[0].visible,false);effects.dispose();
console.log('PASS embedded codex asset, continuous leaf turns, effect surfaces, distinct spell profiles and sword wake');
