import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { cli } from './iwsdk.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const index = cli('ecs', 'find', { withComponents: ['Combat'] }).result.entities[0].entityIndex;
const state = () => cli('ecs', 'query', { entityIndex: index }).result.components.find(c => c.componentId === 'Combat').values;
const button = cli('xr', 'list-targets', {}).result.targets.find(target => target.name === 'attribute-button');
const evidence = [];
assert.ok(cli('xr', 'status').result.sessionActive, 'visual review requires an immersive session');
assert.equal(state().attribute, 'shadow');
assert.equal(state().weapon, 'Stored');
try {
  for (const attribute of ['wind', 'fire', 'shadow']) {
    cli('xr', 'look-at', { device: 'controller-right', target: button.position });
    const before = state().casts;
    cli('xr', 'select', { device: 'controller-right', duration: .2 });
    assert.equal(state().attribute, attribute, 'the magic selector must change the active school');
    assert.equal(state().casts, before, 'selecting magic must not fire a spell');
    cli('xr', 'set-transform', { device: 'controller-left', position: { x: -.32, y: 1.35, z: -.65 } });
    cli('xr', 'look-at', { device: 'controller-left', target: { x: -.32, y: 1.35, z: -3 } });
    cli('xr', 'set-transform', { device: 'controller-right', position: { x: .25, y: 1.25, z: -.4 } });
    cli('xr', 'look-at', { device: 'controller-right', target: { x: 0, y: 1.2, z: -2.5 } });
    cli('xr', 'set-gamepad-state', { device: 'controller-left', buttons: [{ index: 3, value: 1 }] });
    cli('xr', 'set-gamepad-state', { device: 'controller-right', buttons: [{ index: 4, value: 1 }] });
    await sleep(800);
    const current = state();
    assert.equal(current.spellLeft, 'shield');
    assert.equal(current.spellRight, 'blast');
    evidence.push(current);
    cli('browser', 'screenshot', {}, ['--output-file', `artifacts/dark-${attribute}-effects.png`]);
    cli('xr', 'set-gamepad-state', { device: 'controller-left', buttons: [{ index: 3, value: 0 }] });
    cli('xr', 'set-gamepad-state', { device: 'controller-right', buttons: [{ index: 4, value: 0 }] });
    await sleep(800);
    assert.ok(state().casts > before, 'releasing the charge must cast');
    console.log(`PASS ${attribute} page art, active shield, charged spell and release`);
  }
  writeFileSync('artifacts/dark-appearance-state.json', JSON.stringify(evidence, null, 2));
} finally {
  for (const device of ['controller-left', 'controller-right']) {
    cli('xr', 'set-gamepad-state', { device, buttons: [0, 1, 2, 3, 4].map(index => ({ index, value: 0 })) });
  }
}
