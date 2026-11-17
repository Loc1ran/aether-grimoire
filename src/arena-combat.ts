import { type Entity, type Object3D, type World, Vector3 } from '@iwsdk/core';
import { CombatVisuals, type Shot } from './combat-visuals.js';
import { ImpactVFX } from './impact-vfx.js';
import { CombatAudio } from './combat-audio.js';
import { TrainingTarget } from './combat-component.js';
import type { HandIntent } from './magic-input.js';
import type { WeaponController } from './weapon-controller.js';
import { canDamageSwing, segmentSphere } from './combat-math.js';
import { GRIMOIRES, type MagicAttribute, type SurfaceKind } from './combat-data.js';

type ArenaEvent = 'hit' | 'block' | 'deflect' | 'counter' | 'hurt' | 'shield-break' | 'victory';
type TargetVisual = { core: Object3D; fragments: Object3D; rest: Float32Array; position: Vector3; recoil: number };

export class ArenaCombat {
  emitterEnabled = false;
  bossActive=false;
  bossHealth=360;
  bossArmor=100;
  bossPhase='Dormant';
  vortexTime=0;
  readonly vortexCenter=new Vector3();
  private vortexCooldown=0;
  private encounterTime=0;
  private exposedTime=0;
  private readonly cutNormal=new Vector3();
  private readonly offset=new Vector3();
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
      object.userData.arenaVisual = { core, fragments, rest, position:object.position.clone(), recoil:0 } satisfies TargetVisual;
    }
  }

  update(delta: number, head: Vector3, hands: readonly HandIntent[], weapon: WeaponController,
    shieldHealth: number[], attribute: MagicAttribute, active: boolean): void {
    this.swordCooldown = Math.max(0, this.swordCooldown - delta);
    this.vortexCooldown=Math.max(0,this.vortexCooldown-delta);
    this.vortexTime=Math.max(0,this.vortexTime-delta);
    this.encounterTime+=delta;this.exposedTime=Math.max(0,this.exposedTime-delta);
    if(this.bossActive)this.bossPhase=this.bossHealth<=0?'Defeated':this.exposedTime>0?'Exposed':this.bossHealth<180?'Enraged':'Guarded';
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
      else this.testTargets(shot.previous, shot.root.position, shot.spell === 'slash' ? .18 : shot.spell === 'blast' ? 0.16 : 0.04);
      if (this.hitKind !== 0) this.resolveShot(shot, weapon, shieldHealth, attribute);
    }
    if (held) {
      this.updateSword(weapon, attribute);
      this.previousHilt.copy(this.sword.position);
    }
    this.wasHeld = held;
  }

  reset(): void {
    this.bossActive=false;this.bossHealth=360;this.bossArmor=100;this.bossPhase='Dormant';this.vortexTime=this.vortexCooldown=this.exposedTime=0;
    this.emitterEnabled = false; this.emitTime = 3; this.swordCooldown = 0; this.wasHeld = false;
    this.emitter.visible=true;this.emitter.getWorldPosition(this.origin);
    this.emitterCage.rotation.y = 0; this.emitterHeart.scale.set(0.09, 0.06, 0.12);
    this.visuals.reset();
    for (const entity of this.targets()) this.restoreTarget(entity);
  }

  startBoss():void {
    this.bossActive=true;this.bossHealth=360;this.bossArmor=100;this.bossPhase='Guarded';this.exposedTime=0;
    this.emitterEnabled=true;this.emitTime=1.6;
    this.emitter.visible=false;
    for(const shot of this.visuals.shots)if(shot.enemy){shot.life=0;shot.root.visible=false;}
    for(const entity of this.targets())this.restoreTarget(entity);
  }

  vortex(origin:Vector3,forward:Vector3):boolean {
    if(this.vortexCooldown>0)return false;
    this.vortexCenter.copy(origin).addScaledVector(forward,2.1);this.vortexCenter.y=0;
    this.vortexTime=3;this.vortexCooldown=5;return true;
  }

  dimensionCut(origin:Vector3,forward:Vector3,sweep:Vector3,ultimate=false,counter=false):number {
    this.cutNormal.crossVectors(forward,sweep).normalize();
    if(this.cutNormal.lengthSq()<.5)return 0;
    let hits=0;
    for(const entity of this.targets()) {
      if((entity.getValue(TrainingTarget,'health')??0)<=0)continue;
      if(entity.getValue(TrainingTarget,'boss')&&!this.bossActive)continue;
      entity.object3D!.getWorldPosition(this.center);this.center.y+=1.2;
      this.offset.subVectors(this.center,origin);
      const distance=this.offset.dot(forward),plane=Math.abs(this.offset.dot(this.cutNormal));
      const across=this.offset.lengthSq()-distance*distance;
      if(distance<0||distance>5.5||across>(ultimate?12:6)||plane>(ultimate?.85:.45)+(entity.getValue(TrainingTarget,'radius')??.33))continue;
      this.point.copy(this.center);this.normal.copy(forward).negate();
      this.damageTarget(entity,ultimate?220:counter?100:55,'shadow',ultimate?4:3,true,ultimate);hits++;
    }
    return hits;
  }

  private updateEmitter(delta: number, head: Vector3, attribute: MagicAttribute): void {
    if(this.bossActive)for(const entity of this.targets())if(entity.getValue(TrainingTarget,'boss')){entity.object3D!.getWorldPosition(this.origin);this.origin.y+=1.15;this.origin.z+=.2;break;}
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
    this.audio.play(this.origin, attribute, 'cast'); this.emitTime = this.bossActive?(this.bossHealth<180?1.65:2.4):3;
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
      if(entity.getValue(TrainingTarget,'boss') && !this.bossActive)continue;
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
          this.bladePoint.x, this.bladePoint.y, this.bladePoint.z, weapon.parryTime>0?.13:.085);
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
      if(weapon.parryTime>0) {
        weapon.parryTime=0;weapon.counterTime=4;this.impact('shadow','barrier',3,true);this.onEvent('counter');
        shot.life=0;shot.root.visible=false;return;
      }
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
    if(weapon.attackActive===false)return;
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
    power: number, slash: boolean, ignoreArmor=false): void {
    const boss=entity.getValue(TrainingTarget,'boss');
    if(boss && !this.bossActive)return;
    if(boss && this.exposedTime<=0 && !ignoreArmor) {
      this.bossArmor=Math.max(0,this.bossArmor-damage*.55);damage*=.35;
      if(this.bossArmor<=0){this.exposedTime=5;this.bossArmor=100;}
    }
    const health = Math.max(0, (entity.getValue(TrainingTarget, 'health') ?? 100) - damage);
    entity.setValue(TrainingTarget, 'health', health);
    const visual = entity.object3D!.userData.arenaVisual as TargetVisual;visual.recoil=1;
    if(boss)this.bossHealth=health;
    const surface = entity.getValue(TrainingTarget, 'surface');
    this.impact(attribute, surface === 'wood' || surface === 'metal' || surface === 'dirt' ||
      surface === 'barrier' ? surface : 'stone', power, slash);
    if (health === 0) {
      visual.core.visible = false; visual.fragments.visible = true;
      entity.setValue(TrainingTarget, 'resetAfter', boss?999:4);
      if(boss){this.bossPhase='Defeated';this.emitterEnabled=false;for(const shot of this.visuals.shots)if(shot.enemy){shot.life=0;shot.root.visible=false;}this.onEvent('victory');}
    }
    this.onEvent('hit');
  }

  private impact(attribute: MagicAttribute, surface: SurfaceKind, power: number, slash = false): void {
    this.impacts.emit(this.point, this.normal, attribute, surface, power, slash);
    this.audio.play(this.point, attribute, 'impact', power, surface);
  }

  private updateTargets(delta: number): void {
    for (const entity of this.targets()) {
      const object=entity.object3D!, visual=object.userData.arenaVisual as TargetVisual;
      visual.recoil=Math.max(0,visual.recoil-delta*4);
      visual.core.rotation.x=-Math.sin(visual.recoil*Math.PI)*.18;
      if(entity.getValue(TrainingTarget,'boss')) {
        const armor=object.getObjectByName('WardenArmor');
        if(armor)for(let i=0;i<armor.children.length;i++) {
          const plate=armor.children[i],side=i<2?-1:1;
          plate.position.x+=(side*(this.exposedTime>0?.16:0)-plate.position.x)*Math.min(1,delta*8);
          plate.position.y+=((this.exposedTime>0?-.06:0)-plate.position.y)*Math.min(1,delta*8);
        }
      }
      if(this.vortexTime>0 && (entity.getValue(TrainingTarget,'health')??0)>0 && (!entity.getValue(TrainingTarget,'boss') || this.bossActive)) {
        this.offset.copy(this.vortexCenter).sub(object.position);this.offset.y=0;
        if(this.offset.lengthSq()<2.2*2.2) {
          object.position.addScaledVector(this.offset,Math.min(1,delta*2.5));
          object.position.y+=(.28+Math.sin(this.encounterTime*6)*.08-object.position.y)*Math.min(1,delta*5);
          visual.core.rotation.z=Math.sin(this.encounterTime*5)*.12;
          if(entity.getValue(TrainingTarget,'boss')){this.bossArmor=Math.max(0,this.bossArmor-delta*18);if(this.bossArmor<=0){this.exposedTime=5;this.bossArmor=100;}}
        }
      } else {object.position.lerp(visual.position,1-Math.exp(-delta*3));visual.core.rotation.z*=Math.exp(-delta*6);}
      const remaining = entity.getValue(TrainingTarget, 'resetAfter') ?? 0;
      if (remaining <= 0) continue;
      const next = Math.max(entity.getValue(TrainingTarget,'boss')?997.8:0, remaining - delta);
      entity.setValue(TrainingTarget, 'resetAfter', next);
      if (next === 0) { this.restoreTarget(entity); continue; }
      const elapsed = (entity.getValue(TrainingTarget,'boss')?999:4) - next, flight = Math.min(elapsed, 1.1);
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
    entity.setValue(TrainingTarget, 'health', entity.getValue(TrainingTarget,'boss')?360:100); entity.setValue(TrainingTarget, 'resetAfter', 0);
    const visual = entity.object3D!.userData.arenaVisual as TargetVisual;
    entity.object3D!.position.copy(visual.position);visual.core.rotation.set(0,0,0);visual.recoil=0;
    visual.core.visible = true; visual.fragments.visible = false;
    for (let i = 0; i < visual.fragments.children.length; i++) {
      const fragment = visual.fragments.children[i];
      fragment.position.fromArray(visual.rest, i * 3); fragment.rotation.set(0, 0, 0);
      fragment.scale.setScalar(0.22 + (i % 3) * 0.04);
    }
  }
}
