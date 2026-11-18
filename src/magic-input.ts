import { Quaternion, Vector3, type World } from '@iwsdk/core';

export type HandPose = 'open' | 'fist' | 'point' | 'two' | 'three' | 'four' | 'unknown';
export type HandIntent = {
  side: 'left' | 'right'; tracked: boolean; mode: 'hand' | 'controller' | 'desktop';
  position: Vector3; aimPosition: Vector3; quaternion: Quaternion; direction: Vector3; palmNormal: Vector3;
  velocity: Vector3; pinch: boolean; pinchDown: boolean; pinchUp: boolean;
  grab: boolean; grabDown: boolean; grabUp: boolean; pose: HandPose; stableTime: number;
  summon: boolean; shield: boolean; blast: boolean; slash: boolean; blades?: boolean; thunder?: boolean; validConfidence: number;
};

export const GESTURE_THRESHOLDS = {
  poseSeconds: 0.12, buttonSeconds: 0.035, lostSeconds: 0.14,
  pinchClose: 0.32, pinchOpen: 0.46, extensionOn: 0.78, extensionOff: 0.62,
  summonSeconds: 0.6, maximumVelocity: 8,
} as const;

export const CONTROLLER_BINDINGS = {
  trigger: 'xr-standard-trigger', grip: 'xr-standard-squeeze', slash: 'xr-standard-thumbstick',
  left: { shield: 'x-button', blast: 'y-button' }, right: { shield: 'a-button', blast: 'b-button' },
} as const;

const JOINTS: readonly XRHandJoint[] = [
  'wrist', 'thumb-tip', 'thumb-metacarpal',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-tip',
];

export function poseFromFingers(index: boolean, middle: boolean, ring: boolean,
  little: boolean, thumb: boolean): HandPose {
  if (index && middle && ring && little) return thumb ? 'open' : 'four';
  if (index && middle && ring && !little) return 'three';
  if (index && middle && !ring && !little) return 'two';
  if (index && !middle && !ring && !little) return 'point';
  if (!index && !middle && !ring && !little) return 'fist';
  return 'unknown';
}

export class IntentFilter {
  private candidate: HandPose = 'unknown';
  private candidateTime = 0;
  private pinchCandidate = false;
  private pinchTime = 0;
  private grabCandidate = false;
  private grabTime = 0;
  private summonTime = 0;
  private summonLatched = false;

  update(out: HandIntent, pose: HandPose, pinch: boolean, grab: boolean,
    summonCombo: boolean, delta: number): void {
    out.pinchDown = out.pinchUp = out.grabDown = out.grabUp = out.summon = false;
    if (pose !== this.candidate) { this.candidate = pose; this.candidateTime = 0; }
    this.candidateTime += delta;
    if (this.candidateTime >= GESTURE_THRESHOLDS.poseSeconds && out.pose !== pose) {
      out.pose = pose; out.stableTime = 0;
    }
    if (out.pose === pose) out.stableTime += delta;
    else out.stableTime = 0;
    if (pinch !== this.pinchCandidate) { this.pinchCandidate = pinch; this.pinchTime = 0; }
    if (grab !== this.grabCandidate) { this.grabCandidate = grab; this.grabTime = 0; }
    this.pinchTime += delta; this.grabTime += delta;
    if (this.pinchTime >= GESTURE_THRESHOLDS.buttonSeconds && out.pinch !== pinch) {
      out.pinchDown = pinch; out.pinchUp = !pinch; out.pinch = pinch;
    }
    if (this.grabTime >= GESTURE_THRESHOLDS.buttonSeconds && out.grab !== grab) {
      out.grabDown = grab; out.grabUp = !grab; out.grab = grab;
    }
    this.summonTime = summonCombo ? this.summonTime + delta : 0;
    if (!summonCombo) this.summonLatched = false;
    if (!this.summonLatched && this.summonTime >= GESTURE_THRESHOLDS.summonSeconds) {
      out.summon = true; this.summonLatched = true;
    }
  }

  reset(out: HandIntent): void {
    this.candidate = out.pose = 'unknown';
    this.candidateTime = this.pinchTime = this.grabTime = this.summonTime = 0;
    this.pinchCandidate = this.grabCandidate = this.summonLatched = false;
    out.pinch = out.grab = out.pinchDown = out.pinchUp = out.grabDown = out.grabUp = false;
    out.shield = out.blast = out.slash = out.summon = false; out.stableTime = 0;
  }
}

export function createHandIntent(side: 'left' | 'right'): HandIntent {
  return {
    side, tracked: false, mode: 'desktop', position: new Vector3(), aimPosition: new Vector3(), quaternion: new Quaternion(),
    direction: new Vector3(0, 0, -1), palmNormal: new Vector3(0, 0, -1), velocity: new Vector3(),
    pinch: false, pinchDown: false, pinchUp: false, grab: false, grabDown: false, grabUp: false,
    pose: 'unknown', stableTime: 0, summon: false, shield: false, blast: false, slash: false,
    validConfidence: 0,
  };
}

class HandSample {
  readonly joints = JOINTS.map(() => new Vector3());
  readonly extended = [false, false, false, false];
  readonly filter = new IntentFilter();
  readonly previous = new Vector3();
  lostTime = 0;
  hadPose = false;
  source: XRInputSource | undefined;
}

/** Samples native tracked joints; all gameplay contexts remain owned by the combat system. */
export class MagicInput {
  readonly hands: readonly [HandIntent, HandIntent] = [createHandIntent('left'), createHandIntent('right')];
  private readonly samples = [new HandSample(), new HandSample()];
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly head = new Vector3();
  private readonly aimQuaternion = new Quaternion();
  private readonly rootQuaternion = new Quaternion();
  private readonly world: World;

  constructor(world: World) { this.world = world; }

  update(delta: number): void {
    const dt = Math.max(0.001, Math.min(0.05, delta));
    const xr = this.world.renderer.xr;
    const frame = xr.getFrame();
    const reference = xr.getReferenceSpace();
    const session = xr.getSession();
    this.world.player.head.getWorldPosition(this.head);
    this.world.player.getWorldQuaternion(this.rootQuaternion);
    for (let i = 0; i < this.hands.length; i++) {
      const out = this.hands[i];
      const sample = this.samples[i];
      out.pinchDown = out.pinchUp = out.grabDown = out.grabUp = out.summon = false;
      const source = this.world.input.xr.getPrimaryInputSource(out.side);
      if (!session || session.visibilityState !== 'visible' || !frame || !reference || !source) {
        this.lost(out, sample, dt); continue;
      }
      if (source !== sample.source) {
        sample.filter.reset(out); sample.hadPose = false; sample.source = source;
      }
      out.mode = source.hand ? 'hand' : 'controller';
      const pose = frame.getPose(source.gripSpace ?? source.targetRaySpace, reference);
      const ray = frame.getPose(source.targetRaySpace, reference);
      if (!pose || !ray) { this.lost(out, sample, dt); continue; }
      this.world.player.gripSpaces[out.side].getWorldPosition(out.position);
      this.world.player.raySpaces[out.side].getWorldPosition(out.aimPosition);
      this.world.player.gripSpaces[out.side].getWorldQuaternion(out.quaternion);
      this.world.player.raySpaces[out.side].getWorldQuaternion(this.aimQuaternion);
      out.direction.set(0, 0, -1).applyQuaternion(this.aimQuaternion).normalize();
      out.palmNormal.set(0, 0, -1).applyQuaternion(out.quaternion).normalize();
      const valid = source.hand
        ? this.readHand(out, sample, source.hand, frame, reference, dt)
        : this.readController(out, sample, dt);
      if (!valid) { this.lost(out, sample, dt); continue; }
      out.tracked = true; sample.lostTime = 0;
      if (sample.hadPose) {
        this.a.subVectors(out.position, sample.previous).multiplyScalar(1 / dt);
        this.a.clampLength(0, GESTURE_THRESHOLDS.maximumVelocity);
        out.velocity.lerp(this.a, 1 - Math.exp(-dt * 22));
      } else out.velocity.set(0, 0, 0);
      sample.previous.copy(out.position); sample.hadPose = true;
    }
  }

  dispose(): void {
    for (let i = 0; i < this.hands.length; i++) {
      this.samples[i].filter.reset(this.hands[i]); this.hands[i].tracked = false;
    }
  }

  private readController(out: HandIntent, sample: HandSample, delta: number): boolean {
    const pad = this.world.input.xr.gamepads[out.side];
    if (!pad) return false;
    const pinch = (pad.getButtonValue(CONTROLLER_BINDINGS.trigger) ?? 0) > (out.pinch ? 0.35 : 0.65);
    const grab = (pad.getButtonValue(CONTROLLER_BINDINGS.grip) ?? 0) > (out.grab ? 0.35 : 0.65);
    out.shield = (pad.getButtonValue(CONTROLLER_BINDINGS[out.side].shield) ?? 0) > 0.5;
    out.blast = (pad.getButtonValue(CONTROLLER_BINDINGS[out.side].blast) ?? 0) > 0.5;
    out.slash = (pad.getButtonValue(CONTROLLER_BINDINGS.slash) ?? 0) > 0.5;
    const nearTorso = out.position.distanceToSquared(this.head) < 0.75 * 0.75 &&
      out.position.y < this.head.y - 0.15;
    sample.filter.update(out, grab ? 'fist' : out.shield || out.blast ? 'open' :
      out.slash ? 'two' : 'point', pinch, grab, pinch && grab && nearTorso, delta);
    out.validConfidence = 1;
    return true;
  }

  private readHand(out: HandIntent, sample: HandSample, hand: XRHand,
    frame: XRFrame, reference: XRReferenceSpace, delta: number): boolean {
    let found = 0;
    for (let i = 0; i < JOINTS.length; i++) {
      const space = hand.get(JOINTS[i]);
      const joint = space && frame.getJointPose?.(space, reference);
      if (joint && Number.isFinite(joint.transform.position.x)) {
        sample.joints[i].copy(joint.transform.position);
        this.world.player.localToWorld(sample.joints[i]); found++;
      }
    }
    out.validConfidence = found / JOINTS.length;
    if (found !== JOINTS.length) return false;
    const joints = sample.joints;
    const span = joints[4].distanceTo(joints[13]);
    if (span < 0.025 || span > 0.14) return false;
    out.position.copy(joints[0]).lerp(joints[7], 0.7);
    out.aimPosition.copy(joints[5]);
    this.a.subVectors(joints[4], joints[13]);
    this.b.subVectors(joints[7], joints[0]);
    out.palmNormal.crossVectors(this.a, this.b).normalize();
    if (out.side === 'left') out.palmNormal.negate();
    for (let finger = 0; finger < 4; finger++) {
      const base = 3 + finger * 3;
      this.a.subVectors(joints[base + 1], joints[base]).normalize();
      this.b.subVectors(joints[base + 2], joints[base + 1]).normalize();
      const straight = this.a.dot(this.b);
      const reach = joints[base + 2].distanceTo(joints[0]) / joints[base + 1].distanceTo(joints[0]);
      sample.extended[finger] = straight > (sample.extended[finger]
        ? GESTURE_THRESHOLDS.extensionOff : GESTURE_THRESHOLDS.extensionOn) && reach > 1.28;
    }
    const thumb = joints[1].distanceTo(joints[7]) > span * 1.15;
    const pose = poseFromFingers(sample.extended[0], sample.extended[1],
      sample.extended[2], sample.extended[3], thumb);
    const pinch = joints[1].distanceTo(joints[5]) < span *
      (out.pinch ? GESTURE_THRESHOLDS.pinchOpen : GESTURE_THRESHOLDS.pinchClose);
    // A pointing pinch curls all fingers too; it must not become a weapon grip.
    const grab = pose === 'fist' && !pinch && joints[1].distanceTo(joints[7]) < span * 1.5;
    // Native target rays remain the aim source; the palm normal independently gates defense.
    sample.filter.update(out, pose, pinch, grab, false, delta);
    out.shield = (out.pose === 'open' || out.pose === 'four') && out.stableTime >= 0.2;
    out.blast = out.shield;
    out.slash = out.pose === 'two' && out.stableTime >= 0.2;
    return true;
  }

  private lost(out: HandIntent, sample: HandSample, delta: number): void {
    out.tracked = false; out.validConfidence = 0; out.velocity.set(0, 0, 0);
    out.shield = out.blast = out.slash = out.summon = false;
    sample.lostTime += delta; sample.hadPose = false;
    if (sample.lostTime >= GESTURE_THRESHOLDS.lostSeconds) sample.filter.reset(out);
  }
}
