import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cli } from './iwsdk.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

mkdirSync('artifacts/spell-vfx', { recursive: true });
const index = cli('ecs', 'find', { withComponents: ['Combat'] }).result.entities[0].entityIndex;
const state = () => cli('ecs', 'query', { entityIndex: index, components: ['Combat'] }).result.components[0].values;
const input = steps => cli('browser', 'interact', { steps });
const step = (count, delta = .05) => cli('ecs', 'step', { count, delta });
const capture = name => cli('browser', 'screenshot', {}, ['--output-file', `artifacts/spell-vfx/${name}.png`]);
const evidence = [];
const selected = process.env.SPELL_VFX_ONLY?.split(',') ?? [];
assert.equal(cli('xr', 'status').result.sessionActive, false, 'desktop checks require leaving XR first');
const canvas = cli('browser', 'snapshot', {}).result.elements.find(element => element.role === 'canvas').bounds;
cli('ecs', 'pause', {});
try {
  input([{ action: 'pointerMove', point: { x: canvas.width / 2, y: canvas.height / 2 } }]);
  if (state().state === 'Dormant') { input([{ action: 'press', key: 'g' }]); step(60); }
  assert.equal(state().state, 'Idle');
  for (const [key, spell] of [['1','bolt'],['2','shield'],['3','blast'],['4','slash'],['5','blades'],['6','thunder']]) {
    if (selected.length && !selected.includes(spell)) continue;
    const before = state().casts;
    // The browser bridge releases held keys at batch end, so inspect during the batch.
    const holding = run(process.execPath, ['tests/iwsdk.mjs', 'browser', 'interact', JSON.stringify({ steps: [
      { action: 'keyDown', key }, { action: 'wait', durationMs: 6000 }, { action: 'wait', durationMs: 6000 }, { action: 'keyUp', key },
    ] })]);
    await sleep(1000); step(40);
    const held = state();
    assert.equal(held.spellRight, spell, `${spell} stays selected while held`);
    assert.equal(held.casts, before, `${spell} must not fire just because it reached full charge`);
    capture(`${spell}-held`);
    if (spell === 'blast') { step(10); capture('blast-held-later'); }
    await holding; step(1);
    const released = state();
    assert.equal(released.spellRight, '', `${spell} clears on release`);
    assert.equal(released.casts, before + (spell === 'shield' ? 0 : 1), `${spell} casts once on release`);
    if (spell === 'blades' || spell === 'thunder' || spell === 'blast' || spell === 'slash') {
      step(2); capture(`${spell}-cast`);
    }
    evidence.push({ spell, held, released });
    step(120);
    console.log(`PASS ${spell}: hold, release, cast count, runtime capture`);
  }
  writeFileSync(`artifacts/spell-vfx/${selected.length ? 'polished' : 'desktop'}-state.json`, JSON.stringify(evidence, null, 2));
} finally {
  input(['1','2','3','4','5','6'].map(key => ({ action: 'keyUp', key })));
  cli('ecs', 'resume', {});
}
