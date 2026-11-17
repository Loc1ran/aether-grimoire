import { type Entity, type Object3D, type World, Vector3 } from '@iwsdk/core';
import { CombatVisuals, type Shot } from './combat-visuals.js';
import { ImpactVFX } from './impact-vfx.js';
import { CombatAudio } from './combat-audio.js';
import { TrainingTarget } from './combat-component.js';
import type { HandIntent } from './magic-input.js';
import type { WeaponController } from './weapon-controller.js';
import { canDamageSwing, segmentSphere } from './combat-math.js';
import { GRIMOIRES, type MagicAttribute, type SurfaceKind } from './combat-data.js';

type ArenaEvent = 'hit' | 'block' | 'deflect' | 'hurt' | 'shield-break';
type TargetVisual = { core: Object3D; fragments: Object3D; rest: Float32Array };

export class ArenaCombat {
  emitterEnabled = false;
  private readonly center = new Vector3();
  private readonly normal = new Vector3();
  private readonly point = new Vector3();
  private readonly direction = new Vector3();
  private readonly origin = new Vector3(0, 1.7, -3.3);
  private readonly bladePoint = new Vector3();
  private readonly bladePrevious = new Vector3();
  private readonly previousHilt = new Vector3();
  private readonly emitter: Object3D;
  private readonly emitterHeart: Object3D;
  private readonly emitterCage: Object3D;
  private readonly sword: Object3D;
  private emitTime = 3;
  private swordCooldown = 0;
  private wasHeld = false;
  private hitTarget: Entity | undefined;
  private hitKind = 0;
  private hitTime = Infinity;
  private shieldIndex = -1;

  constructor(private readonly world: World, private readonly visuals: CombatVisuals,
    private readonly impacts: ImpactVFX, private readonly audio: CombatAudio,
    private readonly targets: () => Iterable<Entity>,
    private readonly onEvent: (event: ArenaEvent) => void) {
    this.emitter = world.requireSceneObject('emitter');
    this.emitterHeart = this.emitter.getObjectByName('EmitterHeart')!;
    this.emitterCage = this.emitter.getObjectByName('EmitterCage') ?? this.emitter;
    this.sword = world.requireSceneObject('sword');
    this.emitter.getWorldPosition(this.origin);
    for (const entity of this.targets()) {
      const object = entity.object3D!;
      const core = object.getObjectByName('TargetCore')!;
      const fragments = object.getObjectByName('Fragments')!;
      const rest = new Float32Array(fragments.children.length * 3);
      for (let i = 0; i < fragments.children.length; i++) fragments.children[i].position.toArray(rest, i * 3);
      object.userData.arenaVisual = { core, fragments, rest } satisfies TargetVisual;
    }
  }

  update(delta: number, head: Vector3, hands: readonly HandIntent[], weapon: WeaponController,
    shieldHealth: number[], attribute: MagicAttribute, active: boolean): void {
    this.swordCooldown = Math.max(0, this.swordCooldown - delta);
    this.updateTargets(delta);
    if (!active) { this.emitTime = 3; this.wasHeld = false; return; }
    this.updateEmitter(delta, head, attribute);
    const held = weapon.state === 'Held';
    if (held && !this.wasHeld) this.previousHilt.copy(this.sword.position);
    for (const shot of this.visuals.shots) {
      if (shot.life <= 0) continue;
      this.hitKind = 0; this.hitTime = Infinity; this.hitTarget = undefined; this.shieldIndex = -1;
      this.testEnvironment(shot);
      if (shot.enemy) this.testDefense(shot, head, hands, weapon, shieldHealth);
      else this.testTargets(shot.previous, shot.root.position, shot.spell === 'blast' ? 0.16 : 0.04);
      if (this.hitKind !== 0) this.resolveShot(shot, weapon, shieldHealth, attribute);
    }
    if (held) {
      this.updateSword(weapon, attribute);
      this.previousHilt.copy(this.sword.position);
    }
    this.wasHeld = held;
  }

  reset(): void {
    this.emitterEnabled = false; this.emitTime = 3; this.swordCooldown = 0; this.wasHeld = false;
    this.emitterCage.rotation.y = 0; this.emitterHeart.scale.set(0.09, 0.06, 0.12);
    this.visuals.reset();
    for (const entity of this.targets()) this.restoreTarget(entity);
  }

  private updateEmitter(delta: number, head: Vector3, attribute: MagicAttribute): void {
    if (!this.emitterEnabled) { this.emitTime = 3; this.emitterHeart.scale.set(0.09, 0.06, 0.12); return; }
    const previous = this.emitTime;
    this.emitTime -= delta;
    const warning = Math.max(0, 1 - this.emitTime / 0.9);
    this.emitterCage.rotation.y += delta * (0.7 + warning * 2.4);
    const pulse = 1 + warning * (0.45 + 0.25 * Math.sin(this.emitTime * 35));
    this.emitterHeart.scale.set(0.09 * pulse, 0.06 * pulse, 0.12 * pulse);
    this.emitterCage.scale.setScalar(1 + warning * 0.18);
    if (previous > 0.9 && this.emitTime <= 0.9) this.audio.play(this.origin, attribute, 'charge');
    if (this.emitTime > 0) return;
    this.direction.copy(head); this.direction.y -= 0.25; this.direction.sub(this.origin).normalize();
    this.visuals.launch(this.origin, this.direction, 1.6, attribute, 'bolt', 1, 1, true);
    this.audio.play(this.origin, attribute, 'cast'); this.emitTime = 3;
  }

  private testEnvironment(shot: Shot): void {
    const a = shot.previous, b = shot.root.position;
    if (a.y > 0 && b.y <= 0) {
      const t = a.y / (a.y - b.y);
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      if (Math.abs(x) <= 4 && z >= -4 && z <= 4) { this.hitTime = t; this.hitKind = 1; }
    }
    if (a.z > -3.8 && b.z <= -3.8) {
      const t = (-3.8 - a.z) / (b.z - a.z);
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (t < this.hitTime && Math.abs(x) <= 3.2 && y >= 0 && y <= 2.86) {
        this.hitTime = t; this.hitKind = 2;
      }
    }
  }

  private testTargets(a: Vector3, b: Vector3, radius: number): void {
    for (const entity of this.targets()) {
      if ((entity.getValue(TrainingTarget, 'health') ?? 0) <= 0) continue;
      entity.object3D!.getWorldPosition(this.center); this.center.y += 1.2;
      const t = segmentSphere(a.x, a.y, a.z, b.x, b.y, b.z, this.center.x, this.center.y,
        this.center.z, (entity.getValue(TrainingTarget, 'radius') ?? 0.36) + radius);
      if (t < this.hitTime) { this.hitTime = t; this.hitKind = 3; this.hitTarget = entity; }
    }
  }

  private testDefense(shot: Shot, head: Vector3, hands: readonly HandIntent[],
    weapon: WeaponController, shieldHealth: number[]): void {
    const a = shot.previous, b = shot.root.position;
    for (let i = 0; i < hands.length; i++) {
      const hand = hands[i], shield = this.visuals.shields[i];
      if (!hand.tracked || !shield.visible || shieldHealth[i] <= 0) continue;
      const facing = hand.mode === 'hand' ? hand.palmNormal : hand.direction;
      if (shot.velocity.dot(facing) >= -0.05) continue;
      const c = shield.position;
      const t = segmentSphere(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, 0.36);
      if (t < this.hitTime) { this.hitTime = t; this.hitKind = 4; this.shieldIndex = i; }
    }
    if (weapon.state === 'Held') {
      for (let i = 0; i <= 8; i++) {
        this.bladePoint.lerpVectors(this.sword.position, weapon.tip, i / 8);
        const t = segmentSphere(a.x, a.y, a.z, b.x, b.y, b.z,
          this.bladePoint.x, this.bladePoint.y, this.bladePoint.z, 0.085);
        if (t < this.hitTime) { this.hitTime = t; this.hitKind = 5; }
      }
    }
    const t = segmentSphere(a.x, a.y, a.z, b.x, b.y, b.z, head.x, head.y - 0.25, head.z, 0.28);
    if (t < this.hitTime) { this.hitTime = t; this.hitKind = 6; }
  }

  private resolveShot(shot: Shot, weapon: WeaponController, shieldHealth: number[],
    attribute: MagicAttribute): void {
    this.point.lerpVectors(shot.previous, shot.root.position, this.hitTime);
    this.normal.copy(shot.velocity).normalize().negate();
    if (this.hitKind === 1) this.normal.set(0, 1, 0);
    if (this.hitKind === 2) this.normal.set(0, 0, 1);
    if (this.hitKind === 3 && this.hitTarget) {
      this.hitTarget.object3D!.getWorldPosition(this.center); this.center.y += 1.2;
      this.normal.subVectors(this.point, this.center).normalize();
      this.damageTarget(this.hitTarget, shot.damage, shot.attribute, shot.power, shot.spell === 'slash');
    } else if (this.hitKind === 4) {
      const index = this.shieldIndex;
      shieldHealth[index] = Math.max(0, shieldHealth[index] - 1);
      const broken = shieldHealth[index] === 0;
      this.impact(attribute, 'barrier', broken ? 3 : 1);
      if (broken) {
        this.visuals.shields[index].visible = false; this.onEvent('shield-break');
      } else this.onEvent('block');
    } else if (this.hitKind === 5) {
      const deflect = canDamageSwing(weapon.swingSpeed, weapon.swingDistance, 0);
      this.impact(attribute, 'metal', deflect ? 2 : 1);
      this.onEvent(deflect ? 'deflect' : 'block');
      if (deflect) {
        shot.enemy = false; shot.velocity.multiplyScalar(-1.6); shot.life = 3;
        shot.damage = 30; shot.power = 2; shot.attribute = attribute;
        shot.material.color.setHex(GRIMOIRES[attribute].color);
        shot.root.position.copy(this.point).addScaledVector(shot.velocity, 0.02);
        shot.previous.copy(shot.root.position);
        this.direction.copy(shot.velocity).normalize();
        shot.root.quaternion.setFromUnitVectors(this.normal.set(0, 0, 1), this.direction);
        return;
      }
    } else if (this.hitKind === 6) {
      this.impact(attribute, 'barrier', 1); this.onEvent('hurt');
    } else this.impact(shot.attribute, 'stone', shot.power, shot.spell === 'slash');
    shot.life = 0; shot.root.visible = false;
  }

  private updateSword(weapon: WeaponController, attribute: MagicAttribute): void {
    if (!canDamageSwing(weapon.swingSpeed, weapon.swingDistance, this.swordCooldown)) return;
    this.hitTime = Infinity; this.hitKind = 0; this.hitTarget = undefined;
    for (let i = 1; i <= 8; i++) {
      this.bladePrevious.lerpVectors(this.previousHilt, weapon.previousTip, i / 8);
      this.bladePoint.lerpVectors(this.sword.position, weapon.tip, i / 8);
      const before = this.hitTime;
      this.testTargets(this.bladePrevious, this.bladePoint, 0.04);
      if (this.hitTime < before) this.point.lerpVectors(this.bladePrevious, this.bladePoint, this.hitTime);
    }
    const target = this.hitTarget as Entity | undefined;
    if (target) {
      target.object3D!.getWorldPosition(this.center); this.center.y += 1.2;
      this.normal.subVectors(this.point, this.center).normalize();
      const power = weapon.swingSpeed > 3 ? 3 : 2;
      this.damageTarget(target, power === 3 ? 45 : 28, attribute, power, true);
      this.swordCooldown = 0.25; return;
    }
    const a = weapon.previousTip, b = weapon.tip;
    if (a.y > 0 && b.y <= 0) {
      const t = a.y / (a.y - b.y);
      this.point.lerpVectors(a, b, t);
      if (Math.abs(this.point.x) <= 4 && Math.abs(this.point.z) <= 4) {
        this.normal.set(0, 1, 0); this.impact(attribute, 'stone', 2, true); this.swordCooldown = 0.25;
      }
    } else if (a.z > -3.8 && b.z <= -3.8) {
      const t = (-3.8 - a.z) / (b.z - a.z);
      this.point.lerpVectors(a, b, t);
      if (Math.abs(this.point.x) <= 3.2 && this.point.y >= 0 && this.point.y <= 2.86) {
        this.normal.set(0, 0, 1); this.impact(attribute, 'stone', 2, true); this.swordCooldown = 0.25;
      }
    }
  }

  private damageTarget(entity: Entity, damage: number, attribute: MagicAttribute,
    power: number, slash: boolean): void {
    const health = Math.max(0, (entity.getValue(TrainingTarget, 'health') ?? 100) - damage);
    entity.setValue(TrainingTarget, 'health', health);
    const surface = entity.getValue(TrainingTarget, 'surface');
    this.impact(attribute, surface === 'wood' || surface === 'metal' || surface === 'dirt' ||
      surface === 'barrier' ? surface : 'stone', power, slash);
    if (health === 0) {
      const visual = entity.object3D!.userData.arenaVisual as TargetVisual;
      visual.core.visible = false; visual.fragments.visible = true;
      entity.setValue(TrainingTarget, 'resetAfter', 4);
    }
    this.onEvent('hit');
  }

  private impact(attribute: MagicAttribute, surface: SurfaceKind, power: number, slash = false): void {
    this.impacts.emit(this.point, this.normal, attribute, surface, power, slash);
    this.audio.play(this.point, attribute, 'impact', power, surface);
  }

  private updateTargets(delta: number): void {
    for (const entity of this.targets()) {
      const remaining = entity.getValue(TrainingTarget, 'resetAfter') ?? 0;
      if (remaining <= 0) continue;
      const next = Math.max(0, remaining - delta);
      entity.setValue(TrainingTarget, 'resetAfter', next);
      if (next === 0) { this.restoreTarget(entity); continue; }
      const visual = entity.object3D!.userData.arenaVisual as TargetVisual;
      const elapsed = 4 - next, flight = Math.min(elapsed, 1.1);
      const fade = Math.min(1, next / 0.7);
      for (let i = 0; i < visual.fragments.children.length; i++) {
        const fragment = visual.fragments.children[i], offset = i * 3;
        const angle = i * 2.39996;
        fragment.position.set(visual.rest[offset] + Math.cos(angle) * flight * 0.65,
          Math.max(0.14, visual.rest[offset + 1] + flight * 1.3 - 3.4 * flight * flight),
          visual.rest[offset + 2] + Math.sin(angle) * flight * 0.65);
        fragment.rotation.set(flight * (i % 2 ? 2 : -2), flight * 1.7, flight * 0.8);
        fragment.scale.setScalar((0.22 + (i % 3) * 0.04) * fade);
      }
    }
  }

  private restoreTarget(entity: Entity): void {
    entity.setValue(TrainingTarget, 'health', 100); entity.setValue(TrainingTarget, 'resetAfter', 0);
    const visual = entity.object3D!.userData.arenaVisual as TargetVisual;
    visual.core.visible = true; visual.fragments.visible = false;
    for (let i = 0; i < visual.fragments.children.length; i++) {
      const fragment = visual.fragments.children[i];
      fragment.position.fromArray(visual.rest, i * 3); fragment.rotation.set(0, 0, 0);
      fragment.scale.setScalar(0.22 + (i % 3) * 0.04);
    }
  }
}
