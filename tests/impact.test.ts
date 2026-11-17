import assert from 'node:assert/strict';
import { impactDensity, impactLevel, IMPACT_LEVELS, IMPACT_PROFILES, SPELLS } from '../src/combat-data.ts';

assert.equal(impactLevel(Number.NaN), 1);
assert.equal(impactLevel(-10), 1);
assert.equal(impactLevel(1.1), 2);
assert.equal(impactLevel(999), 4);
assert.equal(impactDensity(0, false), 1);
assert.equal(impactDensity(37, false), 0.5);
assert.equal(impactDensity(145, true), 0.15);
assert.equal(impactDensity(Number.NaN, false), 0);
assert.ok(IMPACT_LEVELS[3].radius > IMPACT_LEVELS[0].radius * 4);
assert.ok(IMPACT_PROFILES.metal.sparks > IMPACT_PROFILES.stone.sparks);
assert.ok(IMPACT_PROFILES.barrier.markLife < 1);
assert.ok(SPELLS.blast.cost > SPELLS.bolt.cost && SPELLS.blast.power > SPELLS.bolt.power);
console.log('PASS: impact levels, budgets, surface profiles, and spell scaling');
