import assert from 'node:assert/strict';
import { Group, Vector3 } from '@iwsdk/core';
import { createEmitter, createSword, createTrainingTarget } from '../src/scene-assets/combat.scene-asset.js';
import { ArenaCombat } from '../src/arena-combat.js';
import { CombatVisuals } from '../src/combat-visuals.js';
import { ImpactVFX } from '../src/impact-vfx.js';
import { createHandIntent } from '../src/magic-input.js';

const target = createTrainingTarget(); target.position.z = -2.5;
const values = { health: 100, radius: .33, surface: 'stone', resetAfter: 0 };
const entity = { object3D: target, getValue: (_c, field) => values[field], setValue: (_c, field, value) => { values[field] = value; } };
const sword = createSword(), emitter = createEmitter(); emitter.position.set(0, 1.7, -3.3);
const world = { requireSceneObject: id => id === 'emitter' ? emitter : sword };
const visuals = new CombatVisuals(), impacts = new ImpactVFX(new Group()), events = [];
const arena = new ArenaCombat(world, visuals, impacts, { play() {} }, () => [entity], event => events.push(event));
const hands = [createHandIntent('left'), createHandIntent('right')];
for (const hand of hands) { hand.tracked = true; hand.direction.set(0, 0, -1); }
const health = [3, 3], head = new Vector3(0, 1.6, 0);
const weapon = { state: 'Stored', holderIndex: -1, tip: new Vector3(), previousTip: new Vector3(), swingSpeed: 0, swingDistance: 0 };
const step = dt => { visuals.update(dt); arena.update(dt, head, hands, weapon, health, 'shadow', true); };
visuals.launch(new Vector3(0, 1.2, -1), new Vector3(0, 0, -1), 10, 'shadow', 'bolt', 18, 1);
step(.4);
assert.equal(values.health, 82, 'swept target hit must win over the wall behind it');
assert.ok(events.includes('hit')); assert.ok(impacts.activeCount > 0);
visuals.shields[0].visible = true; visuals.shields[0].position.set(0, 1.4, -.6);
for (let i = 0; i < 3; i++) {
  visuals.launch(new Vector3(0, 1.4, -1.3), new Vector3(0, 0, 1), 2, 'fire', 'bolt', 1, 1, true);
  step(.5);
}
assert.equal(health[0], 0); assert.equal(visuals.shields[0].visible, false);
assert.equal(events.filter(e => e === 'shield-break').length, 1);
weapon.state = 'Held'; weapon.holderIndex = 1; sword.position.set(-.3, 1.4, -.6);
weapon.tip.set(.54, 1.4, -.6); weapon.previousTip.copy(weapon.tip); weapon.swingSpeed = 2; weapon.swingDistance = .2;
visuals.launch(new Vector3(0, 1.4, -1.3), new Vector3(0, 0, 1), 2, 'fire', 'bolt', 1, 1, true);
step(.5);
assert.ok(events.includes('deflect'), 'moving blade deflects an incoming projectile');
const reflected = visuals.shots.find(shot => shot.life > 0);
assert.equal(reflected.enemy, false); assert.ok(reflected.velocity.z < 0);
arena.reset(); impacts.reset();
assert.equal(values.health, 100); assert.equal(impacts.activeCount, 0);
assert.ok(visuals.shots.every(shot => shot.life === 0));
visuals.dispose(); impacts.dispose();
console.log('PASS arena swept hit priority, live projectile shield break, blade deflection, reset');
