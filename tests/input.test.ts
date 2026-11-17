import { createHandIntent, IntentFilter, poseFromFingers } from '../src/magic-input.js';

export function runInputTests(): string {
  let assertions = 0;
  const check = (condition: boolean, label: string) => {
    if (!condition) throw new Error(`Input check failed: ${label}`);
    assertions++;
  };
  const hand = createHandIntent('right');
  const filter = new IntentFilter();
  check(poseFromFingers(true, false, false, false, true) === 'point', 'pointing shape');
  check(poseFromFingers(true, true, false, false, true) === 'two', 'two-finger shape');
  check(poseFromFingers(true, true, true, true, true) === 'open', 'open palm');
  check(poseFromFingers(true, true, true, true, false) === 'four', 'thumb changes open/four');
  check(poseFromFingers(false, false, false, false, false) === 'fist', 'closed grip');
  check(poseFromFingers(false, true, false, true, false) === 'unknown', 'ambiguous pose rejected');
  filter.update(hand, 'point', true, false, false, 0.016);
  check(!hand.pinch && hand.pose === 'unknown', 'one noisy frame does not activate');
  filter.update(hand, 'point', false, false, false, 0.016);
  check(!hand.pinchDown, 'pinch chatter rejected');
  for (let i = 0; i < 10; i++) filter.update(hand, 'point', true, false, false, 0.016);
  check(hand.pinch && hand.pose === 'point', 'stable gesture activates');
  filter.update(hand, 'point', true, false, false, 0.016);
  check(!hand.pinchDown, 'held pinch does not repeat edge');
  for (let i = 0; i < 2; i++) filter.update(hand, 'point', false, false, false, 0.016);
  check(!hand.pinchUp, 'release also debounced');
  filter.update(hand, 'point', false, false, false, 0.016);
  check(hand.pinchUp && !hand.pinch, 'deliberate release edge');
  let summons = 0;
  for (let i = 0; i < 100; i++) {
    filter.update(hand, 'fist', true, true, true, 0.016);
    if (hand.summon) summons++;
  }
  check(summons === 1, 'summon emits once per held combination');
  filter.reset(hand);
  check(!hand.pinchUp && !hand.grabUp && !hand.pinch && !hand.grab,
    'tracking-loss cancellation cannot synthesize a release attack');
  check(hand.pose === 'unknown' && hand.stableTime === 0, 'loss clears pose history');
  return `PASS ${assertions} input assertions`;
}
