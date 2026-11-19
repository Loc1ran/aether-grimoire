import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Mesh, Quaternion, Texture, Vector3 } from '@iwsdk/core';
import { SmokeVolume } from '../src/smoke-volume.js';
import { setSmokeTexture } from '../src/spell-material.js';
import { leafTurnProgress } from '../src/living-book.js';
import { CombatVisuals } from '../src/combat-visuals.js';
import { flowRibbon, crescentSurface } from '../src/scene-assets/lib/magic-surfaces.js';
import { createSword } from '../src/scene-assets/combat.scene-asset.js';

const glb=readFileSync('public/models/aether-codex.glb');
assert.equal(glb.toString('utf8',0,4),'glTF');
const doc=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
const names=new Set(doc.nodes.map((node:{name:string})=>node.name));
for(const name of ['CoverLeft','CoverRight','PageHinge','PageLeft','PageRight','TurningLeaf0','TurningSheet2','Aura','Spine'])assert.ok(names.has(name),`export missing ${name}`);
assert.ok(!names.has('Cube')&&!doc.cameras?.length,'asset must exclude the Blender starter scene');
assert.ok(doc.images?.some((image:{bufferView?:number})=>image.bufferView!==undefined),'cover artwork must travel with the model');
assert.ok(doc.materials.some((m:any)=>m.normalTexture),'the book must retain its leather relief map');
assert.ok(doc.materials.some((m:any)=>m.name==='Engraved vellum -1'),'illustrated pages must be present in the editor asset');
const smokeTexture=new Texture();setSmokeTexture(smokeTexture);
const smoke=new SmokeVolume(2),camera=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.6),matrix=new Matrix4();
smoke.setView(camera);smoke.particle(0,1,2,3,.5,0,.25);smoke.particle(1,0,0,0,0,0,0);smoke.commit();
smoke.mesh.getMatrixAt(0,matrix);assert.ok([...matrix.elements].every(Number.isFinite));
const smokeRotation=new Quaternion();matrix.decompose(new Vector3(),smokeRotation,new Vector3());
assert.ok(smokeRotation.angleTo(camera)<.001,'billows must face the viewer when the camera turns');
assert.equal(smoke.mesh.geometry.attributes.smokeOpacity.getX(0),.25);
assert.equal(smoke.mesh.geometry.attributes.smokeOpacity.getX(1),0);
assert.equal(smoke.mesh.material.map,smokeTexture);smoke.dispose();
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
const aim=new Vector3(0,0,-1), heldNames=new Set<string>();
for(const spell of ['bolt','slash','blast','blades','thunder'] as const) {
  effects.hand(1,tip,aim,grip,'shadow',1,false,1,spell);
  const active=effects.charges[1].children.filter(child=>child.visible);
  assert.equal(active.length,1,'switching skill must leave only its own held effect visible');
  heldNames.add(active[0].name);
  const first=active[0].children[0] as Mesh;
  const rotation=first.rotation.clone(), position=first.position.clone(), formRotation=active[0].rotation.clone();
  effects.hand(1,tip,aim,grip,'shadow',1,false,1.25,spell);
  assert.ok(!first.rotation.equals(rotation)||!first.position.equals(position)||!active[0].rotation.equals(formRotation),'held effects keep moving at full charge');
  assert.equal((first.material as any).userData.clock.value,1.25,'held shader time advances');
  const count=active[0].children.length;
  for(let n=0;n<60;n++)effects.hand(1,tip,aim,grip,'wind',1,false,2+n/60,spell);
  assert.equal(active[0].children.length,count,'holding does not create particles or meshes');
}
assert.equal(heldNames.size,5,'skills need distinct held silhouettes');
effects.hand(0,tip,aim,grip,'fire',1,false,2,'bolt');
effects.hand(1,tip,aim,grip,'wind',0,true,2,'shield');
assert.ok(effects.charges[0].visible&&!effects.charges[1].visible&&effects.shields[1].visible,'shield and other hand stay independent');
effects.hand(0,tip,aim,grip,'fire',0,false,3,null);
assert.equal(effects.charges[0].visible,false,'release or tracking loss clears the held effect');
effects.launch(tip,aim,5,'fire','blast',60,4);
assert.ok(effects.shots[0].nova.visible&&!effects.shots[0].core.visible,'blast has a vortex core, not the bolt lance');
effects.reset();
effects.launch(tip,aim,8,'shadow','bolt',18,1);
assert.ok(!effects.shots[0].nova.visible&&effects.shots[0].core.visible,'reusing a projectile clears the previous spell form');
effects.reset();
effects.shots[0].core.geometry.computeBoundingBox();
const lanceSize=effects.shots[0].core.geometry.boundingBox!.getSize(new Vector3());
assert.ok(lanceSize.z>lanceSize.x*2,'the casting core must read as an elongated lance');
const sword=createSword();
const blade=sword.getObjectByName('BladeSteel') as import('@iwsdk/core').Mesh;
assert.ok(blade.geometry.attributes.position.count>1000);
assert.ok([...blade.geometry.attributes.position.array].every(Number.isFinite));
assert.equal(sword.getObjectByName('BladeSegment0'),undefined,'blade must be continuous, not stacked sections');
assert.ok(effects.glyph.children.every(child=>!child.name.includes('Circle')));
for(const attribute of ['shadow','wind','fire'] as const) {
  assert.ok(effects.launch(tip,new Vector3(0,0,-1),8,attribute,'bolt',18,1));
  const shot=effects.shots.find(s=>s.attribute===attribute&&s.life>0)!;
  assert.equal(shot.wisps[1].material.userData.style.value,attribute==='fire'?2:attribute==='wind'?1:0);
}
effects.swordTrail(tip,'shadow',grip);tip.x=.2;effects.swordTrail(tip,'shadow',grip);
tip.x=3;effects.swordTrail(tip,'shadow',grip);
const wake=effects.trail[0].geometry.attributes.position;
for(let i=0;i<wake.count;i+=2)assert.equal(wake.getX(i),3,'a tracking jump must not bridge the old and new blade poses');
for(let step=0;step<20;step++){tip.x+=.1;effects.swordTrail(tip,'shadow',grip);}
for(let i=0;i<wake.count;i+=2)assert.ok(Math.abs(wake.getX(i)-tip.x)<.301,'wake history must stay close to the current blade');
sword.position.set(.3,1.2,-.5);sword.rotation.set(.3,.5,.2);sword.visible=true;
effects.bladeAura(sword,'shadow',true,0);
assert.ok(effects.bladeGlow.visible,'a resting equipped sword keeps its aura');
assert.ok(effects.bladeGlow.position.equals(sword.position)&&effects.bladeGlow.quaternion.equals(sword.quaternion),'aura follows the physical blade pose');
effects.bladeAura(sword,'shadow',false,0);assert.equal(effects.bladeGlow.visible,false,'inserting or storing the blade hides its uncut aura');
assert.ok(effects.swordAura(tip,new Vector3(0,0,-1),new Vector3(.001,0,0),'shadow'),'high frame rates must not suppress a valid aura');
assert.ok(effects.swordAura(tip,new Vector3(0,0,-1),new Vector3(.1,0,0),'shadow'));
assert.equal(effects.swordAura(tip,new Vector3(0,0,-1),new Vector3(0,0,-.1),'shadow'),false,'a straight thrust is not a cutting swing');
assert.ok([...effects.trail[0].geometry.attributes.position.array].every(Number.isFinite));
effects.reset();effects.update(.016);assert.equal(effects.trail[0].visible,false);assert.equal(effects.bladeGlow.visible,false);effects.dispose();
console.log('PASS embedded codex asset, continuous leaf turns, effect surfaces, distinct spell profiles and sword wake');
