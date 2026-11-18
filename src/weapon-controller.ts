import { Material, Mesh, Object3D, Plane, Quaternion, Vector3 } from '@iwsdk/core';
import type { CombatVisuals } from './combat-visuals.js';
import type { HandIntent } from './magic-input.js';
import { canEmitSwordAura } from './combat-math.js';

export type WeaponState = 'Stored' | 'Preparing' | 'Ready' | 'Extracting' | 'Held' | 'Sheathing';
type WeaponEvent = 'prepare' | 'grab' | 'extract' | 'return' | 'swing' | 'aura';

export class WeaponController {
  state: WeaponState = 'Stored';
  holderIndex = -1;
  progress = 0;
  readonly tip = new Vector3();
  readonly previousTip = new Vector3();
  readonly portalPosition = new Vector3();
  readonly portalNormal = new Vector3(0, 1, 0);
  readonly handlePosition = new Vector3();
  readonly sweepDirection = new Vector3();
  swingSpeed = 0;
  swingDistance = 0;
  attackActive = true;
  parryTime = 0;
  counterTime = 0;
  private readonly materials: Material[] = [];
  private readonly clippingPlane = new Plane();
  private readonly clippingPlanes = [this.clippingPlane];
  private readonly pullStart = new Vector3();
  private readonly deltaPosition = new Vector3();
  private readonly bladeDirection = new Vector3();
  private readonly insertionPoint = new Vector3();
  private readonly extractRotation = new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI);
  private elapsed = 0;
  private slowTime = 0;
  private auraCooldown = 0;
  private rearmed = false;
  private tipValid = false;
  private aboveSlot = false;
  private needsReanchor = false;

  constructor(readonly sword: Object3D, private readonly book: Object3D,
    private readonly visuals: CombatVisuals,
    private readonly onEvent: (event: WeaponEvent, position: Vector3) => void) {
    if (!sword.getObjectByName('BladeSteel')) throw new Error('Weapon requires a continuous BladeSteel mesh.');
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
    const dt = Math.max(0, Math.min(.05, delta));
    this.auraCooldown = Math.max(0, this.auraCooldown-dt);
    this.parryTime=Math.max(0,this.parryTime-dt);this.counterTime=Math.max(0,this.counterTime-dt);
    this.previousTip.copy(this.tip); this.swingSpeed = 0;
    this.updateAperture();
    if (!active) { this.suspend(); return; }
    if (this.state === 'Stored') {
      for (let i=0;i<hands.length;i++) {
        const hand=hands[i];
        if (hand.tracked && hand.validConfidence>=.85 && hand.grabDown && hand.position.distanceToSquared(this.portalPosition)<.23*.23) {
          this.state='Preparing';this.holderIndex=i;this.elapsed=0;this.rearmed=false;
          this.sword.visible=true;this.setClipping(true);this.onEvent('prepare',this.portalPosition);break;
        }
      }
    }
    if (this.state === 'Preparing' || this.state === 'Ready') {
      this.placeInAperture(0);this.visuals.portal.visible=true;
      const owner=hands[this.holderIndex];
      if (!owner?.tracked || owner.validConfidence<.85) { this.suspend(); return; }
      if (!owner.grab) this.rearmed=true;
      if (this.state==='Preparing') {
        this.elapsed+=dt;if(this.elapsed>=.38)this.state='Ready';
      } else if(this.rearmed) {
        for(let i=0;i<hands.length;i++) {
          const hand=hands[i];
          if(hand.tracked && hand.validConfidence>=.85 && hand.grabDown && hand.position.distanceToSquared(this.handlePosition)<.14*.14) {
            this.state='Extracting';this.holderIndex=i;this.pullStart.copy(hand.position);this.onEvent('grab',this.handlePosition);break;
          }
        }
      }
    }
    this.updateDrawn(dt,hands);
  }

  private updateDrawn(dt: number, hands: readonly HandIntent[]): void {
    if(this.state!=='Extracting' && this.state!=='Held' && this.state!=='Sheathing')return;
    const hand=hands[this.holderIndex];
    if(!hand?.tracked || hand.validConfidence<.85) { this.suspend();return; }
    if(this.needsReanchor) {
      if(this.state==='Extracting')this.pullStart.copy(hand.position).addScaledVector(this.portalNormal,-this.progress*.55);
      if(this.state==='Sheathing') {
        this.state='Held';this.progress=1;this.setClipping(false);this.visuals.portal.visible=false;
      }
      this.needsReanchor=false;
    }
    if(this.state==='Extracting') {
      if(!hand.grab)return;
      const pull=this.deltaPosition.subVectors(hand.position,this.pullStart).dot(this.portalNormal);
      this.progress=Math.max(0,Math.min(1,pull/.55));this.placeInAperture(this.progress*.55);
      if(this.progress<1)return;
      this.state='Held';this.setClipping(false);this.visuals.portal.visible=false;this.tipValid=false;
      this.onEvent('extract',this.sword.position);
    }
    this.sword.position.copy(hand.position);this.sword.quaternion.copy(hand.quaternion);
    this.bladeDirection.set(0,1,0).applyQuaternion(this.sword.quaternion);
    this.tip.copy(this.sword.position).addScaledVector(this.bladeDirection,.84);
    const hadTip=this.tipValid;
    if(!hadTip) { this.previousTip.copy(this.tip);this.tipValid=true; }
    const height=this.tip.y-this.portalPosition.y;
    const radial=Math.hypot(this.tip.x-this.portalPosition.x,this.tip.z-this.portalPosition.z);
    const downward=this.bladeDirection.y<-.92;
    if(this.state==='Held') {
      if(!downward || radial>.13 || height>.4)this.aboveSlot=false;
      if(downward && radial<.085 && height>.025 && height<.3)this.aboveSlot=true;
      // A fast push can cross the whole page plane between two frames.
      if(hadTip && this.aboveSlot && downward && radial<.085 && height<=.01 && this.tip.y<this.previousTip.y-.000001) {
        this.state='Sheathing';this.setClipping(true);this.visuals.portal.visible=true;this.swingDistance=0;
      }
    }
    if(this.state==='Sheathing') {
      this.visuals.portal.visible=true;
      const hiltHeight=this.sword.position.y-this.portalPosition.y;
      this.insertionPoint.copy(this.sword.position).addScaledVector(this.bladeDirection,-hiltHeight/this.bladeDirection.y);
      const offset=Math.hypot(this.insertionPoint.x-this.portalPosition.x,this.insertionPoint.z-this.portalPosition.z);
      if(!downward || offset>.105 || height>.035) {
        this.state='Held';this.progress=1;this.aboveSlot=false;this.setClipping(false);this.visuals.portal.visible=false;
      } else {
        this.progress=Math.max(0,Math.min(1,1+height/.72));
        if(hiltHeight<=.14) { this.onEvent('return',this.portalPosition);this.reset(); }
      }
      this.swingSpeed=this.swingDistance=0;this.aboveSlot=false;return;
    }
    if(downward && radial<.13 && height<.4 && height>-.15) { this.swingDistance=0;return; }
    const distance=this.tip.distanceTo(this.previousTip);
    this.sweepDirection.subVectors(this.tip,this.previousTip);
    this.swingSpeed=dt>0?Math.min(15,distance/dt):0;
    if(this.swingSpeed>.8) {
      this.slowTime=0;this.swingDistance=Math.min(2,this.swingDistance+distance);
      if(this.attackActive && canEmitSwordAura(this.swingSpeed,this.swingDistance,this.auraCooldown)) {
        this.auraCooldown=.65;this.onEvent('aura',this.tip);
      }
    } else {
      this.slowTime+=dt;if(this.slowTime>=.1)this.swingDistance=0;
    }
  }

  suspend(): void {
    this.tipValid=false;this.swingSpeed=this.swingDistance=0;this.aboveSlot=false;this.needsReanchor=true;
  }

  reset(): void {
    this.state='Stored';this.holderIndex=-1;this.progress=0;this.elapsed=this.slowTime=this.auraCooldown=0;
    this.parryTime=this.counterTime=0;this.attackActive=true;
    this.rearmed=false;this.suspend();this.sword.visible=false;this.visuals.portal.visible=false;
    this.sword.scale.setScalar(1);this.setClipping(false);this.tip.set(0,0,0);this.previousTip.set(0,0,0);
  }

  dispose(): void { this.reset();for(const material of this.materials)material.dispose(); }

  private updateAperture(): void {
    if(this.state!=='Sheathing') { this.book.getWorldPosition(this.portalPosition);this.portalPosition.y+=.045; }
    this.handlePosition.copy(this.portalPosition).addScaledVector(this.portalNormal,.29);
    this.clippingPlane.setFromNormalAndCoplanarPoint(this.portalNormal,this.portalPosition);
    this.visuals.portal.position.copy(this.portalPosition);this.visuals.portal.rotation.set(-Math.PI/2,0,0);
  }

  private placeInAperture(pull: number): void {
    this.sword.position.copy(this.handlePosition).addScaledVector(this.portalNormal,pull);
    this.sword.quaternion.copy(this.extractRotation);
    this.tip.copy(this.sword.position).addScaledVector(this.portalNormal,-.84);this.previousTip.copy(this.tip);
  }

  private setClipping(enabled: boolean): void {
    for(const material of this.materials) {
      if(Boolean(material.clippingPlanes?.length)!==enabled) {
        material.clippingPlanes=enabled?this.clippingPlanes:null;material.needsUpdate=true;
      }
    }
  }
}
