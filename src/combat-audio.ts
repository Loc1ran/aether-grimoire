import { Vector3 } from '@iwsdk/core';
import { GRIMOIRES, IMPACT_PROFILES, type MagicAttribute, type SurfaceKind } from './combat-data.js';

/** Short original synthesized cues; no remote audio or per-frame nodes. */
export class CombatAudio {
  private context?: AudioContext;
  private active = 0;
  unlock(): void {
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => {});
  }
  listener(position: Vector3, forward: Vector3): void {
    const listener = this.context?.listener;
    if (!listener) return;
    listener.positionX.value = position.x;
    listener.positionY.value = position.y;
    listener.positionZ.value = position.z;
    listener.forwardX.value = forward.x;
    listener.forwardY.value = forward.y;
    listener.forwardZ.value = forward.z;
    listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
  }
  play(position: Vector3, attribute: MagicAttribute, kind: 'summon' | 'page' | 'charge' | 'cast' | 'impact' | 'grab', power = 1, surface: SurfaceKind = 'barrier'): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.active >= 8) return;
    this.active++;
    const osc = ctx.createOscillator(), gain = ctx.createGain(), pan = ctx.createPanner();
    const base = kind === 'impact' ? IMPACT_PROFILES[surface].sound : kind === 'page' ? 680 : kind === 'grab' ? 150 : 260;
    const now = ctx.currentTime, duration = kind === 'summon' ? 0.8 : kind === 'page' ? 0.13 : 0.28 + power * 0.04;
    osc.type = attribute === 'fire' ? 'sawtooth' : attribute === 'wind' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(base * GRIMOIRES[attribute].pitch / 220, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, base * (kind === 'charge' || kind === 'summon' ? 1.8 : 0.2)), now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.075, 0.025 * power), now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1; pan.maxDistance = 20;
    pan.positionX.value = position.x; pan.positionY.value = position.y; pan.positionZ.value = position.z;
    osc.connect(gain); gain.connect(pan); pan.connect(ctx.destination);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); pan.disconnect(); this.active--; };
    osc.start(now); osc.stop(now + duration + 0.03);
  }
  dispose(): void { void this.context?.close(); }
}
