import { Material, Mesh, Object3D, Quaternion, Vector3 } from '@iwsdk/core';
import type { CombatVisuals } from './combat-visuals.js';
import type { HandIntent } from './magic-input.js';

export type WeaponState = 'Stored' | 'Preparing' | 'Ready' | 'Extracting' | 'Held' | 'Returning';
type WeaponEvent = 'prepare' | 'grab' | 'extract' | 'return' | 'cancel' | 'swing';

/** Deliberate two-grab extraction; no spell or weapon is activated by proximity alone. */
export class WeaponController {
  state: WeaponState = 'Stored';
  holderIndex = -1;
  progress = 0;
  readonly tip = new Vector3();
  readonly previousTip = new Vector3();
  readonly portalPosition = new Vector3();
  readonly portalNormal = new Vector3(0, 0, 1);
  readonly handlePosition = new Vector3();
  swingSpeed = 0;
  swingDistance = 0;
  private readonly segments: Object3D[] = [];
  private readonly materials: Material[] = [];
  private readonly pullStart = new Vector3();
  private readonly deltaPosition = new Vector3();
  private readonly returnFrom = new Vector3();
  private readonly returnRotation = new Quaternion();
  private readonly bookRotation = new Quaternion();
  private readonly extractRotation = new Quaternion();
  private readonly bladeAxis = new Vector3(0, 1, 0);
  private readonly portalAxis = new Vector3(0, 0, 1);
  private elapsed = 0;
  private lost = 0;
  private slowTime = 0;
  private swingCooldown = 0;
  private rearmed = false;
  private tipValid = false;

  constructor(
    private readonly sword: Object3D,
    private readonly book: Object3D,
    private readonly visuals: CombatVisuals,
    private readonly onEvent: (event: WeaponEvent, position: Vector3) => void,
  ) {
    const blade = sword.getObjectByName('Blade');
    if (!blade || blade.children.length !== 12) throw new Error('Weapon extraction requires twelve rigid blade segments.');
    for (let i = 0; i < 12; i++) {
      const segment = blade.getObjectByName(`BladeSegment${i}`);
      if (!segment) throw new Error(`Missing BladeSegment${i}`);
      this.segments.push(segment);
    }
    const clones = new Map<Material, Material>();
    sword.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const clone = (material: Material): Material => {
        let own = clones.get(material);
        if (!own) { own = material.clone(); clones.set(material, own); this.materials.push(own); }
        return own;
      };
      object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material);
    });
    this.reset();
  }

  update(delta: number, hands: readonly HandIntent[], active: boolean): void {
    const dt = Math.max(0, Math.min(0.05, delta));
    this.swingCooldown = Math.max(0, this.swingCooldown - dt);
    this.previousTip.copy(this.tip);
    this.swingSpeed = 0;
    this.updateAperture();
    if (!active && this.state !== 'Stored' && this.state !== 'Returning') this.returnWeapon();
    if (this.state === 'Stored') {
      if (!active) return;
      for (let i = 0; i < hands.length; i++) {
        const hand = hands[i];
        if (hand.tracked && hand.validConfidence >= 0.85 && hand.grabDown &&
          hand.position.distanceToSquared(this.portalPosition) < 0.23 * 0.23) {
          this.state = 'Preparing'; this.holderIndex = i; this.elapsed = 0; this.rearmed = false;
          this.sword.visible = true; this.setOpacity(0);
          this.onEvent('prepare', this.portalPosition);
          break;
        }
      }
    }
    if (this.state === 'Preparing' || this.state === 'Ready') {
      this.placeInAperture(0);
      this.visuals.portal.visible = true;
      const owner = hands[this.holderIndex];
      if (!owner?.tracked || owner.validConfidence < 0.85) {
        this.lost += dt;
        if (this.lost >= 0.14) {
          this.onEvent('cancel', this.sword.position);
          this.returnWeapon();
        }
        return;
      }
      this.lost = 0;
      if (owner?.tracked && !owner.grab) this.rearmed = true;
      if (this.state === 'Preparing') {
        this.elapsed += dt;
        this.setOpacity(Math.min(1, this.elapsed / 0.38));
        if (this.elapsed >= 0.38) this.state = 'Ready';
      } else if (this.rearmed) {
        for (let i = 0; i < hands.length; i++) {
          const hand = hands[i];
          if (hand.tracked && hand.validConfidence >= 0.85 && hand.grabDown &&
            hand.position.distanceToSquared(this.handlePosition) < 0.14 * 0.14) {
            this.state = 'Extracting'; this.holderIndex = i; this.pullStart.copy(hand.position);
            this.lost = 0; this.onEvent('grab', this.handlePosition); break;
          }
        }
      }
    }
    if (this.state === 'Extracting' || this.state === 'Held') {
      const hand = hands[this.holderIndex];
      if (!hand?.tracked || hand.validConfidence < 0.85) {
        this.lost += dt;
        this.tipValid = false;
        if (this.lost >= 0.14) {
          this.onEvent('cancel', this.sword.position);
          this.returnWeapon();
        }
        return;
      }
      this.lost = 0;
      if (!hand.grab) {
        if (this.state === 'Extracting') this.onEvent('cancel', this.sword.position);
        this.returnWeapon();
      } else if (this.state === 'Extracting') {
        const pull = this.deltaPosition.subVectors(hand.position, this.pullStart).dot(this.portalNormal);
        this.progress = Math.max(0, Math.min(1, pull / 0.55));
        this.placeInAperture(this.progress * 0.55);
        if (this.progress >= 1) {
          this.state = 'Held'; this.visuals.portal.visible = false; this.tipValid = false;
          for (const segment of this.segments) segment.visible = true;
          this.onEvent('extract', this.sword.position);
        }
      }
      if (this.state === 'Held') {
        this.sword.position.copy(hand.position);
        this.sword.quaternion.copy(hand.quaternion);
        this.tip.set(0, 0.84, 0).applyQuaternion(this.sword.quaternion).add(this.sword.position);
        if (!this.tipValid) { this.previousTip.copy(this.tip); this.tipValid = true; }
        const distance = this.tip.distanceTo(this.previousTip);
        this.swingSpeed = dt > 0 ? Math.min(15, distance / dt) : 0;
        if (this.swingSpeed > 0.8) {
          this.slowTime = 0; this.swingDistance = Math.min(2, this.swingDistance + distance);
          if (this.swingSpeed > 1.2 && this.swingDistance > 0.07 && this.swingCooldown === 0) {
            this.swingCooldown = 0.35; this.onEvent('swing', this.tip);
          }
        } else {
          this.slowTime += dt;
          if (this.slowTime >= 0.1) this.swingDistance = 0;
        }
      }
    }
    if (this.state === 'Returning') {
      this.elapsed = Math.min(1, this.elapsed + dt / 0.48);
      const t = this.elapsed * this.elapsed * (3 - 2 * this.elapsed);
      this.sword.position.lerpVectors(this.returnFrom, this.handlePosition, t);
      this.sword.quaternion.slerpQuaternions(this.returnRotation, this.extractRotation, t);
      this.setOpacity(1 - t);
      if (this.elapsed === 1) this.reset();
    }
  }

  returnWeapon(): void {
    if (this.state === 'Stored' || this.state === 'Returning') return;
    this.state = 'Returning'; this.elapsed = 0; this.holderIndex = -1;
    this.tipValid = false; this.swingSpeed = this.swingDistance = 0;
    this.returnFrom.copy(this.sword.position); this.returnRotation.copy(this.sword.quaternion);
    this.visuals.portal.visible = true;
    this.onEvent('return', this.sword.position);
  }

  reset(): void {
    this.state = 'Stored'; this.holderIndex = -1; this.progress = 0;
    this.elapsed = this.lost = this.slowTime = this.swingCooldown = 0;
    this.swingSpeed = this.swingDistance = 0; this.rearmed = this.tipValid = false;
    this.sword.visible = false; this.visuals.portal.visible = false;
    this.sword.scale.setScalar(1); this.setOpacity(1);
    for (const segment of this.segments) segment.visible = false;
    this.tip.set(0, 0, 0); this.previousTip.set(0, 0, 0);
  }

  dispose(): void {
    this.reset();
    for (const material of this.materials) material.dispose();
  }

  private updateAperture(): void {
    this.book.getWorldPosition(this.portalPosition);
    this.book.getWorldQuaternion(this.bookRotation);
    this.portalNormal.set(0, 0, 1).applyQuaternion(this.bookRotation).normalize();
    this.portalPosition.addScaledVector(this.portalNormal, 0.045);
    this.handlePosition.copy(this.portalPosition).addScaledVector(this.portalNormal, 0.29);
    this.extractRotation.setFromUnitVectors(this.bladeAxis, this.deltaPosition.copy(this.portalNormal).negate());
    this.visuals.portal.position.copy(this.portalPosition);
    this.visuals.portal.quaternion.setFromUnitVectors(this.portalAxis, this.portalNormal);
  }

  private placeInAperture(pull: number): void {
    this.sword.position.copy(this.handlePosition).addScaledVector(this.portalNormal, pull);
    this.sword.quaternion.copy(this.extractRotation);
    for (let i = 0; i < this.segments.length; i++) this.segments[i].visible = 0.12 + (i + 1) * 0.06 <= 0.2901 + pull;
    this.tip.copy(this.sword.position).addScaledVector(this.portalNormal, -Math.min(0.84, 0.29 + pull));
    this.previousTip.copy(this.tip);
  }

  private setOpacity(opacity: number): void {
    for (const material of this.materials) {
      const transparent = opacity < 1;
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      material.opacity = opacity;
      material.depthWrite = !transparent;
    }
  }
}
