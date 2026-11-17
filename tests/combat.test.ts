import assert from 'node:assert/strict';
import { segmentSphere, extractionProgress, canDamageSwing, smooth } from '../src/combat-math.ts';

assert.equal(segmentSphere(0, 0, 0, 0, 0, -10, 0, 0, -5, 1), 0.4);
assert.equal(segmentSphere(0, 0, 0, 0, 0, -10, 2, 0, -5, 1), Infinity);
assert.equal(segmentSphere(0, 0, 0, 0, 0, 0, 0, 0, 0, 1), 0);
assert.equal(segmentSphere(0, 0, 0, 0, 0, 0, 2, 0, 0, 1), Infinity);
assert.equal(segmentSphere(0, 0, 0, 0, 0, 1, 0, 0, -5, 1), Infinity);
assert.equal(extractionProgress(-0.2), 0);
assert.equal(extractionProgress(0.275), 0.5);
assert.equal(extractionProgress(1), 1);
assert.equal(canDamageSwing(10, 0.01, 0), false, 'tracking jitter cannot damage');
assert.equal(canDamageSwing(2, 0.1, 0.1), false, 'one swing cannot repeatedly hit');
assert.equal(canDamageSwing(2, 0.1, 0), true);
assert.equal(smooth(-1), 0);
assert.equal(smooth(2), 1);
console.log('PASS: swept collisions, extraction limits, swing jitter/cooldown guards');
