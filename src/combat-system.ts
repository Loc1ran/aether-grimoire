import { AssetManager, createSystem, Entity, Group, Hovered, Object3D, Quaternion, RayInteractable, SRGBColorSpace, UIKitMLAsset, Vector3, VisibilityState } from '@iwsdk/core';
import { Combat, TrainingTarget } from './combat-component.js';
import { Grimoire } from './grimoire-component.js';
import { GRIMOIRES, SPELLS, type MagicAttribute, type SpellId } from './combat-data.js';
import { MagicInput, createHandIntent, type HandIntent } from './magic-input.js';
import { LivingBook } from './living-book.js';
import { CombatVisuals } from './combat-visuals.js';
import { ImpactVFX } from './impact-vfx.js';
import { CombatAudio } from './combat-audio.js';
import { WeaponController } from './weapon-controller.js';
import { ArenaCombat } from './arena-combat.js';
import { smooth } from './combat-math.js';
import { DesktopSword } from './desktop-sword.js';
import { SignatureVFX } from './signature-vfx.js';
import { setSmokeTexture } from './spell-material.js';

type HandCast = {
  spell: SpellId | null; elapsed: number; cooldown: number; pointGrace: number;
  anchor: Vector3; summonAnchor: Vector3; summonTime: number; summonArmed: boolean;
  shieldLock: boolean; announced: boolean;
};
type Label = { name: string; setProperties(properties: Record<string, unknown>): void };
type Button = Label & { addEventListener(type: 'click', callback: () => void): void; removeEventListener(type: 'click', callback: () => void): void };
const INSTRUCTIONS = {
  bolt: 'Point, pinch to charge, release to fire.', shield: 'Extend an open palm forward and hold.',
  slash: 'Hold two fingers, then sweep sideways.', blast: 'Open palm near chest, hold, then push.',
} as const;
const TUTORIAL = [
  'Raise a hand near your chest. Pinch, hold, then pull upward to summon.',
  'Point and pinch, then release a Rune Bolt toward a target.',
  'Start the trial. Extend an open palm to block the incoming sparks.',
  'Close your hand near the pages to reveal the sword handle.',
  'Release, grab the handle, then physically pull the blade free.',
  'Swing firmly to send a cutting aura forward. Your free hand can still cast.',
  'Point the tip down above the pages, then push the entire blade into the book.',
  'Trial complete. Try a charged palm blast, or change your magic attribute.',
] as const;
const HINTS = [
  'Pinch and lift at your chest. Trigger and grip, or G.',
  'Point, pinch, release. Trigger, or hold 1.',
  'Open palm forward. A or X, or hold 2.',
  'Close your hand on the pages. Grip, or hold E.',
  'Grab the handle and pull. Hold E and drag up.',
  'A full, fast swing releases the aura. Relaxing your grip keeps the sword equipped.',
  'Tip first, from above. Desktop: hold R and drag downward to insert.',
  'Palm near chest, then push. B or Y, or hold 3.',
] as const;

export class CombatSystem extends createSystem({
  books: { required: [Combat, Grimoire] }, targets: { required: [TrainingTarget] },
  uiHover: { required: [RayInteractable, Hovered] },
}) {
  private entity?: Entity;
  private book!: Object3D;
  private living!: LivingBook;
  private controls!: MagicInput;
  private visuals!: CombatVisuals;
  private impacts!: ImpactVFX;
  private signatures!: SignatureVFX;
  private readonly desktopSword=new DesktopSword();
  private gripModel!: Object3D;
  private forearmModel!: Object3D;
  private resolvePower=0;
  private ultimateArmed=false;
  private guarding=false;
  private guardWasDown=false;
  private ultimateWasDown=false;
  private vortexWasDown=false;
  private swordCharge=0;
  private attackMouseX=0;
  private attackMouseY=0;
  private audio = new CombatAudio();
  private weapon!: WeaponController;
  private arena!: ArenaCombat;
  private casts: HandCast[] = [];
  private shieldHealth = [3, 3];
  private desktopHands = [createHandIntent('left'), createHandIntent('right')];
  private hands: readonly HandIntent[] = this.desktopHands;
  private keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private pull = 0;
  private lastMouseY = 0;
  private desktopGrip = false;
  private state = 'Dormant';
  private stateTime = 0;
  private bookDrop = 0;
  private mana = 100;
  private attribute: MagicAttribute = 'shadow';
  private dominant: 'left' | 'right' = 'right';
  private step = 0;
  private note = '';
  private noteTime = 0;
  private panel?: UIKitMLAsset;
  private statusLabel?: Label;
  private bodyLabel?: Label;
  private hintLabel?: Label;
  private debugLabel?: Label;
  private head = new Vector3();
  private forward = new Vector3();
  private desired = new Vector3();
  private temp = new Vector3();
  private normal = new Vector3(0, 1, 0);
  private headRotation = new Quaternion();
  private bookRotation = new Quaternion();
  private yawRotation = new Quaternion();
  private tiltRotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 4);
  private up = new Vector3(0, 1, 0);
  private time = 0;

  init(): void {
    const bind = (entity: Entity) => this.bind(entity);
    this.cleanupFuncs.push(this.queries.books.subscribe('qualify', bind));
    for (const entity of this.queries.books.entities) bind(entity);
  }

  private bind(entity: Entity): void {
    if (this.entity || !entity.object3D) return;
    this.entity = entity; this.book = entity.object3D; this.book.visible = false;
    this.controls = new MagicInput(this.world);
    const smoke=AssetManager.getTexture('smoke-density');
    if(!smoke)throw new Error('The smoke texture must be loaded before combat starts.');
    smoke.colorSpace=SRGBColorSpace;setSmokeTexture(smoke);
    this.living = new LivingBook(this.book);
    this.visuals = new CombatVisuals();
    this.world.createTransformEntity(this.visuals.root);
    this.signatures=new SignatureVFX();this.world.createTransformEntity(this.signatures.root);
    const impactRoot = new Group(); this.world.createTransformEntity(impactRoot);
    this.impacts = new ImpactVFX(impactRoot);
    this.world.renderer.localClippingEnabled = true;
    this.weapon = new WeaponController(this.world.requireSceneObject('sword'), this.book, this.visuals, (event, position) => {
      if(event!=='aura')this.audio.play(position, this.attribute, event === 'prepare' ? 'page' : 'grab', event === 'extract' ? 2 : 1);
      if (event === 'prepare') { this.page(5, 'Veilblade', 'Release, grasp the hilt, then pull.'); this.advance(4); }
      if (event === 'extract') this.advance(5);
      if (event === 'return') this.advance(7);
      if(event==='aura')this.castSwordSkill();
    });
    this.gripModel=this.weapon.sword.getObjectByName('DesktopGrip')!;
    this.forearmModel=this.gripModel.getObjectByName('Forearm')!;
    this.arena = new ArenaCombat(this.world, this.visuals, this.impacts, this.audio, () => this.queries.targets.entities, (event) => {
      if (!this.entity) return;
      if (event === 'hit') { this.increment('hits');this.resolvePower=Math.min(100,this.resolvePower+12);if (this.weapon.state === 'Held') this.advance(6); }
      if (event === 'block' || event === 'shield-break') { this.increment('blocks'); this.advance(3); }
      if (event === 'deflect') { this.increment('deflections'); this.advance(6); }
      if(event==='counter'){this.increment('deflections');this.resolvePower=Math.min(100,this.resolvePower+35);this.notify('ANTI-MAGIC COUNTER! Your next cut is empowered.');this.haptic(this.weapon.holderIndex,.8,110);}
      if(event==='victory'){this.notify('WARDEN DEFEATED. Return the blade to seal the trial.');this.audio.play(this.head,'shadow','summon',4);}
      if (event === 'hurt') this.notify('A spark reached you. Raise a shield or intercept with the blade.');
      if (event === 'shield-break') this.notify('Aegis shattered. Lower your hand before raising it again.');
    });
    for (let i = 0; i < 2; i++) this.casts.push({ spell: null, elapsed: 0, cooldown: 0, pointGrace: 0, anchor: new Vector3(), summonAnchor: new Vector3(), summonTime: 0, summonArmed: false, shieldLock: false, announced: false });
    this.bindPanel(); this.bindDesktop();
    const uiTimer = window.setInterval(() => this.refreshPanel(), 200);
    this.cleanupFuncs.push(() => window.clearInterval(uiTimer));
    this.cleanupFuncs.push(() => { this.controls.dispose(); this.weapon.dispose(); this.living.dispose(); this.visuals.dispose(); this.signatures.dispose(); this.impacts.dispose(); this.audio.dispose(); });
    this.reset();
  }

  update(delta: number): void {
    if (!this.entity) return;
    const dt = Math.min(delta, 0.05);
    if (this.world.visibilityState.peek() === VisibilityState.VisibleBlurred) {
      this.cancelHands(); this.weapon.suspend(); return;
    }
    this.time += dt; this.stateTime += dt;
    this.world.camera.getWorldPosition(this.head);
    this.world.camera.getWorldQuaternion(this.headRotation);
    this.forward.set(0, 0, -1).applyQuaternion(this.headRotation).normalize();
    this.controls.update(dt);
    if (this.world.renderer.xr.isPresenting) this.hands = this.controls.hands;
    else { this.updateDesktop(dt); this.hands = this.desktopHands; }
    this.audio.listener(this.head, this.forward);
    for (let i = 0; i < 2; i++) this.summonGesture(i, dt);
    if (this.state === 'Summoning' && this.stateTime >= 1.25) { this.transition('Idle'); this.advance(1); }
    if (this.state === 'Dismissing' && this.stateTime >= 0.85) this.transition('Dormant');
    const active = this.state === 'Idle';
    this.followBook(dt);
    const immersive=this.world.renderer.xr.isPresenting;
    this.weapon.attackActive=immersive||this.desktopSword.striking;
    if(this.weapon.state==='Held') {
      const owner=this.hands[this.weapon.holderIndex],free=this.hands[1-this.weapon.holderIndex];
      const guard=immersive?(owner.mode==='hand'?owner.pinch:owner.shield):this.guarding;
      if(guard&&!this.guardWasDown)this.weapon.parryTime=.32;
      this.guardWasDown=guard;
      this.swordCharge=owner.pinch?Math.min(1.2,this.swordCharge+dt):0;
      const ultimate=owner.blast||(free.mode==='hand'&&free.pose==='four'&&free.stableTime>.6);
      if(immersive && ultimate && !this.ultimateWasDown)this.armDivider();
      this.ultimateWasDown=ultimate;
      const vortex=free.slash||(free.mode==='hand'&&free.pose==='two'&&free.stableTime>.15);
      if(immersive && vortex && !this.vortexWasDown)this.castVortex();
      this.vortexWasDown=vortex;
    }
    const desktopDraw=!this.world.renderer.xr.isPresenting && this.weapon.state==='Extracting';
    this.weapon.update(dt, this.hands, active);
    if(this.weapon.state==='Stored'||this.weapon.state==='Sheathing')this.ultimateArmed=false;
    // Moving from the desktop draw position to the guard is not a player swing.
    if(desktopDraw && this.weapon.state==='Held')this.weapon.suspend();
    this.gripModel.visible=!immersive && (this.weapon.state==='Held'||this.weapon.state==='Extracting'||this.weapon.state==='Sheathing');
    if(this.gripModel.visible)this.desktopSword.poseForearm(this.forearmModel,this.weapon.sword,this.head,this.headRotation);
    this.signatures.blade(this.weapon.sword,this.weapon.state==='Held' && this.ultimateArmed);
    this.visuals.bladeAura(this.weapon.sword,this.attribute,this.weapon.state==='Held',this.weapon.swingSpeed);
    if (this.weapon.state === 'Held' && this.weapon.swingSpeed > 1.4) this.visuals.swordTrail(this.weapon.tip, this.attribute, this.hands[this.weapon.holderIndex].position);
    for (let i = 0; i < 2; i++) this.updateSpell(i, dt, active);
    this.mana = Math.min(100, this.mana + dt * (this.casts[0].spell || this.casts[1].spell ? 1 : 9));
    const reveal = this.state === 'Dormant' ? 0 : this.state === 'Summoning' ? smooth(this.stateTime / 0.65) : this.state === 'Dismissing' ? 1 - smooth((this.stateTime - 0.25) / 0.6) : 1;
    const opening = this.state === 'Summoning' ? smooth((this.stateTime - 0.4) / 0.7) : this.state === 'Dismissing' ? 1 - smooth(this.stateTime / 0.4) : 1;
    this.living.update(dt, this.time, reveal, opening, this.casts[0].spell || this.casts[1].spell ? 1 : 0.15,this.headRotation);
    this.signatures.setView(this.headRotation);this.visuals.setView(this.headRotation);this.impacts.setView(this.headRotation);
    this.visuals.bookOpening(this.book,this.attribute,this.state==='Summoning'?this.stateTime/1.25:this.state==='Dismissing'?1-this.stateTime/.85:-1);
    this.visuals.update(dt);
    this.arena.update(dt, this.head, this.hands, this.weapon, this.shieldHealth, this.attribute, active);
    this.signatures.update(dt,this.arena.vortexTime,this.arena.vortexCenter);
    this.impacts.setViewerPosition(this.head); this.impacts.update(dt);
    this.entity.setValue(Combat, 'mana', this.mana);
    this.entity.setValue(Combat, 'weapon', this.weapon.state);
    this.entity.setValue(Combat, 'extraction', this.weapon.progress);
    this.entity.setValue(Combat, 'spellLeft', this.casts[0].spell ?? '');
    this.entity.setValue(Combat, 'spellRight', this.casts[1].spell ?? '');
    this.entity.setValue(Combat,'swordAction',immersive?(this.weapon.parryTime>0?'Counter':this.ultimateArmed?'Black Divider':'Tracked'):this.guarding?'Guard':this.desktopSword.action);
    this.entity.setValue(Combat,'resolve',this.resolvePower);this.entity.setValue(Combat,'counterTime',this.weapon.counterTime);
    this.entity.setValue(Combat,'vortexTime',this.arena.vortexTime);this.entity.setValue(Combat,'bossHealth',this.arena.bossHealth);this.entity.setValue(Combat,'bossPhase',this.arena.bossPhase);
    this.noteTime = Math.max(0, this.noteTime - dt);
  }

  private followBook(dt: number): void {
    const drawing = this.weapon.state === 'Preparing' || this.weapon.state === 'Ready' || this.weapon.state === 'Extracting' || this.weapon.state === 'Sheathing';
    const casting = this.casts[0].spell !== null || this.casts[1].spell !== null;
    const using = this.weapon.state === 'Held' || casting;
    const desktop=!this.world.renderer.xr.isPresenting;
    const targetDrop = casting ? (desktop ? .03 : .26) : using ? (desktop ? .03 : .025) : 0;
    this.bookDrop += (targetDrop - this.bookDrop) * (1 - Math.exp(-dt * 5));
    if (drawing) return;
    this.temp.copy(this.forward); this.temp.y = 0; this.temp.normalize();
    this.desired.copy(this.head).addScaledVector(this.temp, desktop ? .66 : .56);
    if(this.weapon.state==='Held')this.desired.addScaledVector(this.normal.crossVectors(this.up,this.temp),this.dominant==='right'?.22:-.22);
    const personality = GRIMOIRES[this.attribute].hoverSpeed;
    this.desired.y -= (desktop ? .25 : .22) + this.bookDrop;
    this.desired.y += Math.sin(this.time * personality * 1.7) * 0.01;
    this.temp.subVectors(this.desired, this.book.position);
    const distance = this.temp.length();
    if (distance > 0.001) this.book.position.addScaledVector(this.temp, Math.min(1 - Math.exp(-dt * 4), dt * 0.8 / distance));
    const yaw = Math.atan2(-this.forward.x, -this.forward.z);
    this.yawRotation.setFromAxisAngle(this.up, yaw);
    this.bookRotation.copy(this.yawRotation).multiply(this.tiltRotation);
    this.book.quaternion.slerp(this.bookRotation, 1 - Math.exp(-dt * 4));
  }

  private summonGesture(index: number, dt: number): void {
    const hand = this.hands[index], cast = this.casts[index];
    if (!hand.tracked || this.weapon.holderIndex === index) { cast.summonArmed = false; return; }
    if (hand.summon && this.weapon.state === 'Stored') { this.toggleSummon(); return; }
    if (hand.mode !== 'hand') return;
    const nearChest = hand.position.distanceTo(this.head) < 0.65 && hand.position.y < this.head.y - 0.12;
    if (hand.pinchDown && nearChest && (this.state === 'Dormant' || cast.pointGrace <= 0) && this.weapon.state === 'Stored') {
      cast.summonArmed = true; cast.summonTime = 0; cast.summonAnchor.copy(hand.position);
    }
    if (!cast.summonArmed) return;
    if (!hand.pinch) { cast.summonArmed = false; return; }
    cast.summonTime += dt;
    if (cast.summonTime >= 0.28 && hand.position.y - cast.summonAnchor.y >= 0.12) {
      cast.summonArmed = false; this.toggleSummon();
    }
  }

  private toggleSummon(): void {
    this.audio.unlock();
    if (this.state === 'Summoning' || this.state === 'Dismissing') return;
    if(this.weapon.state!=='Stored') { this.notify('Push the sword tip-first into the book before dismissing it.');return; }
    if (this.casts.some(cast => cast.spell === 'blast' || cast.spell === 'bolt')) {
      this.notify('Finish or release the current action before dismissing.'); return;
    }
    if (this.state === 'Dormant') {
      this.book.position.copy(this.head).addScaledVector(this.forward, 0.4); this.book.position.y -= 0.4;
      this.transition('Summoning'); this.page(0, GRIMOIRES[this.attribute].name, 'Your intent awakens the pages.');
    } else {
      this.cancelHands(); this.transition('Dismissing');
    }
    this.audio.play(this.book.position, this.attribute, 'summon');
  }

  private updateSpell(index: number, dt: number, active: boolean): void {
    const hand = this.hands[index], cast = this.casts[index];
    cast.cooldown = Math.max(0, cast.cooldown - dt);
    cast.pointGrace = hand.pose === 'point' ? 0.45 : Math.max(0, cast.pointGrace - dt);
    const owned = this.weapon.holderIndex === index || hand.mode !== 'hand' && hand.grab || cast.summonArmed || this.queries.uiHover.entities.size > 0;
    if(this.world.renderer.xr.isPresenting && this.weapon.state==='Held' && (hand.slash || hand.mode==='hand' && (hand.pose==='two'||hand.pose==='four'))) {this.cancelCast(index);this.visuals.hand(index,hand.position,hand.direction,this.book.position,this.attribute,0,false,this.time);return;}
    if (!active || !hand.tracked || owned) { this.cancelCast(index); this.visuals.hand(index, hand.position, hand.direction, this.book.position, this.attribute, 0, false, this.time); return; }
    const palm = hand.mode === 'hand';
    const forwardPalm = hand.palmNormal.dot(this.forward) > 0.35;
    const open = palm ? hand.pose === 'open' && forwardPalm : hand.shield || hand.blast;
    if (!open) { cast.shieldLock = false; this.shieldHealth[index] = 3; }
    if (this.shieldHealth[index] <= 0) { cast.shieldLock = true; if (cast.spell === 'shield') this.cancelCast(index); }
    if (!cast.spell && cast.cooldown <= 0) {
      let spell: SpellId | null = null;
      if (hand.pinchDown && (!palm || cast.pointGrace > 0)) spell = 'bolt';
      else if (hand.slash || palm && hand.pose === 'two') spell = 'slash';
      else if (open && !cast.shieldLock) spell = palm ? (hand.position.distanceTo(this.head) < 0.46 ? 'blast' : 'shield') : hand.blast ? 'blast' : 'shield';
      if (spell) this.beginSpell(index, spell);
    }
    const spell = cast.spell;
    let shield = false, charge = 0;
    if (spell) {
      cast.elapsed += dt;
      if (spell === 'bolt') {
        charge = Math.min(1, cast.elapsed / SPELLS.bolt.charge) * 0.3;
        if (hand.pinchUp) { if (cast.elapsed >= SPELLS.bolt.charge) this.releaseSpell(index, 1); else this.cancelCast(index); }
      } else if (spell === 'shield') {
        if (this.mana < 0.2 && open && !cast.shieldLock) {
          cast.shieldLock = true; this.shieldHealth[index] = 0;
          this.impacts.emit(hand.position, hand.palmNormal, this.attribute, 'barrier', 2);
          this.audio.play(hand.position, this.attribute, 'impact', 2);
        }
        if (!open || cast.shieldLock) this.cancelCast(index);
        else if (cast.elapsed >= SPELLS.shield.charge) {
          shield = true; this.mana = Math.max(0, this.mana - SPELLS.shield.drain * dt);
          if (!cast.announced) { cast.announced = true; this.audio.play(hand.position, this.attribute, 'cast'); }
        }
      } else if (spell === 'blast') {
        charge = Math.min(1, cast.elapsed / SPELLS.blast.charge);
        const push = this.temp.subVectors(hand.position, cast.anchor).dot(hand.palmNormal) > 0.12 && hand.velocity.dot(hand.palmNormal) > 0.7;
        if (cast.elapsed >= 0.65 && (palm ? push : !hand.blast)) this.releaseSpell(index, charge);
        else if (palm && !open || !palm && !hand.blast) this.cancelCast(index);
      } else {
        charge = Math.min(1, cast.elapsed / SPELLS.slash.charge) * 0.65;
        const sweep = hand.position.distanceTo(cast.anchor) > 0.16 && hand.velocity.length() > 0.7;
        if (cast.elapsed >= SPELLS.slash.charge && (sweep || !palm && !hand.slash)) this.releaseSpell(index, 1);
        else if (palm && hand.pose !== 'two') this.cancelCast(index);
      }
    }
    if (!cast.spell) { charge = 0; shield = false; }
    this.visuals.hand(index, hand.position, palm && shield ? hand.palmNormal : hand.direction, this.book.position, this.attribute, charge, shield, this.time);
  }

  private beginSpell(index: number, spell: SpellId): void {
    const cast = this.casts[index];
    if (this.mana < SPELLS[spell].cost) { cast.cooldown = 0.4; this.notify('Mana is recovering. Wait a moment.'); return; }
    cast.spell = spell; cast.elapsed = 0; cast.announced = false; cast.anchor.copy(this.hands[index].position);
    this.page(SPELLS[spell].page, SPELLS[spell].name, INSTRUCTIONS[spell]);
    this.audio.play(this.hands[index].position, this.attribute, 'charge');
  }

  private castSwordSkill():void {
    const ultimate=this.ultimateArmed, counter=this.weapon.counterTime>0;
    if(!ultimate && this.mana<12)return;
    this.temp.copy(this.head);this.temp.y-=.22;
    const sweep=!this.world.renderer.xr.isPresenting&&this.desktopSword.verticalAttack?this.desired.set(0,-1,0).applyQuaternion(this.headRotation):this.weapon.sweepDirection;
    this.signatures.cut(this.temp,this.forward,sweep,ultimate);
    this.arena.dimensionCut(this.temp,this.forward,sweep,ultimate,counter||this.desktopSword.empowered||this.swordCharge>.45);
    this.weapon.counterTime=0;
    if(ultimate){this.ultimateArmed=false;this.resolvePower=0;}else this.mana-=12;
    this.increment('casts');this.audio.play(this.weapon.tip,'shadow','cast',ultimate?4:2);this.haptic(this.weapon.holderIndex,ultimate?.9:.45,ultimate?180:70);
    this.page(ultimate?8:6,ultimate?'Black Divider':'Dimension Cut',ultimate?'One decisive cut. Break the Warden.':'Your swing opens a fracture through space.');
  }

  private armDivider():void {
    if(this.weapon.state!=='Held'||this.resolvePower<100){this.notify('Build 100 Resolve through hits and timed counters.');return;}
    if(!this.world.renderer.xr.isPresenting && !this.desktopSword.divider())return;
    this.ultimateArmed=true;this.audio.play(this.weapon.tip,'shadow','charge',4);this.notify('BLACK DIVIDER. Commit to a full cut.');
  }

  private castVortex():void {
    if(this.state!=='Idle'||this.mana<24)return;
    if(!this.arena.vortex(this.head,this.forward)){this.notify('Wind Vortex is recovering.');return;}
    this.mana-=24;this.increment('casts');this.page(7,'Wind Vortex','Gather your enemies, then cut through the opening.');
    this.audio.play(this.arena.vortexCenter,'wind','cast',3);
  }

  private releaseSpell(index: number, charge: number): void {
    const cast = this.casts[index], hand = this.hands[index], id = cast.spell;
    if (!id) return;
    const spell = SPELLS[id];
    if (this.mana >= spell.cost) {
      const factor = id === 'blast' ? 0.4 + charge * 0.6 : 1;
      const direction = id === 'blast' && hand.mode === 'hand' ? hand.palmNormal : hand.direction;
      this.temp.copy(id === 'bolt' ? hand.aimPosition : hand.position).addScaledVector(direction, 0.06);
      if (this.visuals.launch(this.temp, direction, spell.speed, this.attribute, id, spell.damage * factor, spell.power * factor)) {
        this.mana -= spell.cost; this.increment('casts'); this.advance(2);
        this.audio.play(hand.position, this.attribute, 'cast', spell.power * factor);
        this.haptic(index, 0.3, 70);
      }
    }
    cast.cooldown = spell.cooldown; this.cancelCast(index);
  }

  private cancelCast(index: number): void { this.casts[index].spell = null; this.casts[index].elapsed = 0; }
  private cancelHands(): void { for (let i = 0; i < 2; i++) { this.cancelCast(i); this.casts[i].summonArmed = false; } this.visuals.reset();this.signatures.reset();this.desktopSword.reset();this.guarding=false; }
  private page(page: number, title: string, instruction: string): void {
    this.living.setPage(page, title, instruction); this.entity?.setValue(Grimoire, 'page', page);
    this.audio.play(this.book.position, this.attribute, 'page');
  }
  private transition(state: string): void { this.state = state; this.stateTime = 0; this.entity?.setValue(Combat, 'state', state); }
  private advance(step: number): void { this.step = Math.max(this.step, step); this.entity?.setValue(Combat, 'tutorialStep', this.step); }
  private notify(message: string): void { this.note = message; this.noteTime = 3; }
  private increment(field: 'casts' | 'hits' | 'blocks' | 'deflections'): void { if (this.entity) this.entity.setValue(Combat, field, (this.entity.getValue(Combat, field) ?? 0) + 1); }
  private haptic(index: number, intensity: number, duration: number): void {
    const actuator = this.world.input.xr.getPrimaryInputSource(this.hands[index].side)?.gamepad?.hapticActuators?.[0];
    if (actuator) void actuator.pulse(intensity, duration).catch(() => {});
  }

  private bindPanel(): void {
    this.panel = this.world.requireSceneObject<UIKitMLAsset>('prompt-panel');
    this.statusLabel = this.label('status'); this.bodyLabel = this.label('body'); this.hintLabel = this.label('hint'); this.debugLabel = this.label('debug');
    this.button('summon-button', () => this.toggleSummon());
    this.button('xr-button', () => { this.audio.unlock(); void this.world.launchXR(); });
    this.button('exit-button', () => { this.cancelHands(); this.weapon.suspend(); void this.world.exitXR(); });
    this.button('emitter-button', () => {
      this.audio.unlock();this.arena.startBoss();this.notify('WARDEN AWAKENED. Break its armor with cuts and Wind Vortex.');
    });
    this.button('attribute-button', () => {
      if (this.weapon.state !== 'Stored' || this.casts.some(cast => cast.spell)) { this.notify('Return the sword and release spells before changing magic.'); return; }
      this.attribute = this.attribute === 'shadow' ? 'wind' : this.attribute === 'wind' ? 'fire' : 'shadow';
      this.living.setAttribute(this.attribute); this.entity?.setValue(Combat, 'attribute', this.attribute);
      this.label('title')?.setProperties({ text: GRIMOIRES[this.attribute].name });
      this.label('attribute-button')?.setProperties({ text: `Magic: ${this.attribute}` });
    });
    this.button('hand-button', () => {
      if (this.weapon.state !== 'Stored') { this.notify('Return the sword before changing handedness.'); return; }
      this.dominant = this.dominant === 'right' ? 'left' : 'right';
      this.entity?.setValue(Combat, 'dominantHand', this.dominant);
      this.label('hand-button')?.setProperties({ text: `${this.dominant === 'right' ? 'Right' : 'Left'} handed` });
    });
    this.button('reset-button', () => this.reset());
    const visibility = (state: VisibilityState) => {
      const immersive = state !== VisibilityState.NonImmersive;
      this.label('xr-button')?.setProperties({ display: immersive ? 'none' : 'flex' });
      this.label('exit-button')?.setProperties({ display: immersive ? 'flex' : 'none' });
      this.debugLabel?.setProperties({ display: immersive ? 'none' : 'flex' });
      this.keys.clear(); this.desktopGrip = false;
      this.weapon.suspend();
      if (!immersive) this.cancelHands();
    };
    this.cleanupFuncs.push(this.world.visibilityState.subscribe(visibility));
  }

  private label(id: string): Label | undefined {
    const label = this.panel?.getElementById(id) as Label | undefined;
    if (label) label.name = id;
    return label;
  }

  private button(id: string, callback: () => void): void {
    const button = this.label(id) as Button | undefined;
    if (!button) throw new Error(`Missing training control ${id}`);
    button.addEventListener('click', callback);
    this.cleanupFuncs.push(() => button.removeEventListener('click', callback));
  }

  private refreshPanel(): void {
    if (!this.entity) return;
    const state = this.state === 'Idle' ? this.weapon.state === 'Held' ? 'COMBAT READY' : 'GRIMOIRE AWAKE' : this.state.toUpperCase();
    this.statusLabel?.setProperties({ text: `${state} / MANA ${Math.floor(this.mana)} / HITS ${this.entity.getValue(Combat, 'hits')} / BLOCKS ${this.entity.getValue(Combat, 'blocks')}` });
    this.label('resolve')?.setProperties({text:this.resolvePower>=100?'BLACK DIVIDER READY':`RESOLVE ${Math.floor(this.resolvePower)} / 100`,color:this.resolvePower>=100?'#ffcd73':'#c5a8f5'});
    this.label('resolve-fill')?.setProperties({width:`${Math.min(100,this.resolvePower)}%`});
    this.label('boss-fill')?.setProperties({width:`${Math.max(0,this.arena.bossHealth/3.6)}%`});
    this.label('boss')?.setProperties({text:this.arena.bossPhase==='Dormant'?'OBSIDIAN WARDEN / Start trial':this.arena.bossPhase==='Defeated'?'VICTORY / WARDEN DEFEATED':`WARDEN ${Math.ceil(this.arena.bossHealth)} / 360 | ${this.arena.bossPhase.toUpperCase()} | ARMOR ${Math.ceil(this.arena.bossArmor)}`});
    this.bodyLabel?.setProperties({ text: this.noteTime > 0 ? this.note : TUTORIAL[this.step] });
    this.hintLabel?.setProperties({ text: this.weapon.state==='Held'?(this.world.renderer.xr.isPresenting?'Swing to cut / A or X: counter / free thumbstick: vortex / B or Y: Divider':'Click/F: cut / right click: counter / V: vortex / Q: Divider / R: sheathe / 1-4: cast spells'):HINTS[this.step] });
    this.label('summon-button')?.setProperties({ text: this.state === 'Dormant' ? 'Summon' : 'Dismiss' });
    const left = this.hands[0], right = this.hands[1];
    const a = left.tracked ? `${left.mode}: ${left.pose}` : 'untracked';
    const b = right.tracked ? `${right.mode}: ${right.pose}` : 'untracked';
    this.debugLabel?.setProperties({ text: `L ${a} / R ${b} / Sword ${this.weapon.state} ${Math.round(this.weapon.progress * 100)}%` });
    this.entity.setValue(Combat, 'gestureLeft', a); this.entity.setValue(Combat, 'gestureRight', b);
  }

  private reset(): void {
    this.cancelHands(); this.keys.clear(); this.desktopGrip = false; this.pull = 0; this.bookDrop = 0;
    this.weapon.reset(); this.arena.reset(); this.impacts.reset();
    this.desktopSword.reset();this.resolvePower=0;this.ultimateArmed=this.guardWasDown=this.ultimateWasDown=this.vortexWasDown=false;
    this.mana = 100; this.step = 0; this.noteTime = 0; this.shieldHealth[0] = this.shieldHealth[1] = 3;
    for (const cast of this.casts) { cast.cooldown = 0; cast.shieldLock = false; cast.pointGrace = 0; }
    this.transition('Dormant'); this.book.visible = false;
    for (const field of ['casts', 'hits', 'blocks', 'deflections', 'tutorialStep'] as const) this.entity?.setValue(Combat, field, 0);
    this.label('emitter-button')?.setProperties({ text: 'Start trial' });
    this.refreshPanel();
  }

  private bindDesktop(): void {
    const down = (event: KeyboardEvent) => {
      if (this.world.renderer.xr.isPresenting || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      if (!['KeyG', 'KeyE', 'KeyR', 'KeyF', 'KeyV', 'KeyQ', 'KeyT', 'Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code)) return;
      event.preventDefault(); this.audio.unlock(); this.keys.add(event.code);
      if (event.code === 'KeyG') this.toggleSummon();
      if (event.code === 'KeyR') {
        if (this.weapon.state === 'Held') {
          this.weapon.reset();
          this.desktopSword.reset();
          this.desktopGrip = false;
          this.pull = 0;
          this.guarding = false;
          this.notify('Sword sheathed into the grimoire.');
        } else {
          this.pull = 0;
          this.desktopSword.reset();
          this.weapon.suspend();
          this.guarding = false;
        }
      }
      if(event.code==='KeyF'&&this.weapon.state==='Held'){this.desktopSword.press();this.desktopSword.release();}
      if(event.code==='KeyV')this.castVortex();if(event.code==='KeyQ')this.armDivider();
      if(event.code==='KeyT'&&this.state==='Idle')this.arena.startBoss();
      if (event.code === 'KeyE') { this.desktopGrip = true; if (this.weapon.state === 'Ready') this.pull = 0; }
    };
    const up = (event: KeyboardEvent) => {
      this.keys.delete(event.code);if(event.code==='KeyE')this.desktopGrip=false;
      if(event.code==='KeyR')this.weapon.suspend();
    };
    const move = (event: PointerEvent) => {
      this.mouseX = event.clientX / window.innerWidth * 2 - 1; this.mouseY = 1 - event.clientY / window.innerHeight * 2;
      if (this.desktopGrip && this.weapon.state === 'Extracting') this.pull = Math.max(0, Math.min(0.65, this.pull + (this.lastMouseY - event.clientY) * 0.004));
      if(this.keys.has('KeyR') && (this.weapon.state==='Held'||this.weapon.state==='Sheathing'))this.pull=Math.max(0,Math.min(.9,this.pull+(event.clientY-this.lastMouseY)*.003));
      this.lastMouseY = event.clientY;
    };
    const blur = () => { this.keys.clear(); this.desktopGrip = false; this.cancelHands(); this.weapon.suspend(); };
    const unlock = () => this.audio.unlock();
    const attackDown=(event:PointerEvent)=>{
      if(this.world.renderer.xr.isPresenting||this.weapon.state!=='Held'||this.keys.has('KeyR')||this.queries.uiHover.entities.size>0)return;
      if(event.button===0){this.attackMouseX=this.mouseX;this.attackMouseY=this.mouseY;this.desktopSword.press();}
      if(event.button===2){this.guarding=true;this.desktopSword.guarding=true;event.preventDefault();}
    };
    const attackUp=(event:PointerEvent)=>{if(event.button===0)this.desktopSword.release(this.mouseX-this.attackMouseX,this.mouseY-this.attackMouseY);if(event.button===2){this.guarding=false;this.desktopSword.guarding=false;}};
    const context=(event:MouseEvent)=>{if(this.weapon.state==='Held')event.preventDefault();};
    window.addEventListener('pointerdown',attackDown);window.addEventListener('pointerup',attackUp);window.addEventListener('contextmenu',context);
    this.cleanupFuncs.push(()=>{window.removeEventListener('pointerdown',attackDown);window.removeEventListener('pointerup',attackUp);window.removeEventListener('contextmenu',context);});
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('pointermove', move); window.addEventListener('blur', blur); window.addEventListener('pointerdown', unlock);
    this.cleanupFuncs.push(() => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('pointermove', move); window.removeEventListener('blur', blur); window.removeEventListener('pointerdown', unlock); });
  }

  private updateDesktop(dt: number): void {
    const casterIndex = this.weapon.state === 'Held' ? (1 - this.weapon.holderIndex) : 1;
    for (let index = 0; index < 2; index++) {
      const hand = this.desktopHands[index];
      const grip = index === 1 && this.desktopGrip;
      const isCaster = index === casterIndex || (this.weapon.state !== 'Held' && (index === 0 && this.keys.has('Digit2') || index === 1));
      const pinch = isCaster && this.keys.has('Digit1');
      hand.grabDown = grip && !hand.grab; hand.grabUp = !grip && hand.grab; hand.grab = grip;
      hand.pinchDown = pinch && !hand.pinch; hand.pinchUp = !pinch && hand.pinch; hand.pinch = pinch;
      hand.tracked = true; hand.mode = 'desktop'; hand.validConfidence = 1; hand.stableTime += dt;
      hand.shield = isCaster && this.keys.has('Digit2');
      hand.blast = isCaster && this.keys.has('Digit3');
      hand.slash = isCaster && this.keys.has('Digit4');
      hand.pose = grip ? 'fist' : hand.shield || hand.blast ? 'open' : hand.slash ? 'two' : 'point';
      this.temp.copy(hand.position);
      hand.position.copy(this.head); hand.position.x += index ? 0.26 : -0.26; hand.position.y -= 0.28; hand.position.z -= 0.4;
      hand.direction.set(this.mouseX, this.mouseY, 0.5).unproject(this.world.camera).sub(this.head).normalize();
      hand.palmNormal.copy(hand.direction);
      if (index === 1) {
        if (this.weapon.state === 'Stored' && grip) hand.position.copy(this.book.position);
        else if (this.weapon.state === 'Ready' || this.weapon.state === 'Preparing') hand.position.copy(this.weapon.handlePosition);
        else if (this.weapon.state === 'Extracting') hand.position.copy(this.weapon.portalPosition).addScaledVector(this.weapon.portalNormal, 0.29 + this.pull);
      }
      hand.quaternion.setFromUnitVectors(this.up, hand.direction);
      if(index===1 && this.weapon.state==='Held' && !this.keys.has('KeyR')) {
        this.desktopSword.update(dt,hand,this.head,this.headRotation,this.mouseX,this.mouseY);
      }
      if(index===1 && this.keys.has('KeyR') && (this.weapon.state==='Held'||this.weapon.state==='Sheathing')) {
        hand.position.copy(this.weapon.portalPosition);hand.position.y+=.94-this.pull;
        this.desired.set(0,-1,0);hand.quaternion.setFromUnitVectors(this.up,this.desired);
      }
      hand.velocity.subVectors(hand.position, this.temp).divideScalar(dt);
      hand.aimPosition.copy(hand.position);
    }
  }
}
