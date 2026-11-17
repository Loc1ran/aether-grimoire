import { Euler, Quaternion, Vector3 } from '@iwsdk/core';
import type { HandIntent } from './magic-input.js';

/** Authored wrist/arm motion for mouse input; tracked VR hands keep their own pose. */
export class DesktopSword {
  action = 'Ready';
  striking = false;
  empowered = false;
  ultimate = false;
  guarding = false;
  private held = false;
  private elapsed = 0;
  private charge = 0;
  private angle = 0;
  private alternate = 1;
  private readonly rotation = new Euler(0,0,0,'YXZ');
  private readonly targetRotation = new Quaternion();
  private readonly localPosition = new Vector3(.28,-.28,-.52);
  private readonly localRotation = new Quaternion();
  private readonly targetPosition = new Vector3();

  press(): void { if(this.action==='Ready' && !this.guarding){this.held=true;this.charge=0;this.action='Charging';} }
  release(dx=0,dy=0): void {
    if(!this.held)return;
    this.held=false;this.empowered=this.charge>=.45;this.ultimate=false;
    this.angle=Math.hypot(dx,dy)>.06?Math.atan2(-dy,dx):(this.alternate>0?-.55:Math.PI-.55);
    this.alternate*=-1;this.action='Windup';this.elapsed=0;
  }
  divider(): boolean {
    if(this.action!=='Ready' && this.action!=='Charging')return false;
    this.held=false;this.empowered=true;this.ultimate=true;this.angle=Math.PI/2;
    this.action='Windup';this.elapsed=0;return true;
  }
  reset(): void { this.action='Ready';this.elapsed=this.charge=0;this.held=this.guarding=this.striking=this.empowered=this.ultimate=false; }
  update(dt: number, hand: HandIntent, head: Vector3, view: Quaternion, mouseX: number, mouseY: number): void {
    this.elapsed+=dt;this.striking=false;
    const windup=this.ultimate?.38:.15, cut=this.ultimate?.25:.20, recovery=.34;
    if(this.action==='Windup' && this.elapsed>=windup){this.action='Cut';this.elapsed-=windup;}
    if(this.action==='Cut' && this.elapsed>=cut){this.action='Recovery';this.elapsed-=cut;}
    if(this.action==='Recovery' && this.elapsed>=recovery){this.action='Ready';this.elapsed=0;this.empowered=this.ultimate=false;}
    this.targetPosition.set(.28+mouseX*.035,-.29+mouseY*.025,-.52);
    this.rotation.set(-.48,mouseX*.12,-.12,'YXZ');
    if(this.guarding && this.action==='Ready') {
      this.targetPosition.set(.24,-.30,-.5);this.rotation.set(-Math.PI/2,-.6,1.08,'YXZ');
    } else if(this.action==='Charging') {
      this.charge=Math.min(1.2,this.charge+dt);
      this.targetPosition.set(.35,-.12,-.34);this.rotation.set(.25,-.65,-.8,'YXZ');
    } else if(this.action==='Windup'||this.action==='Cut'||this.action==='Recovery') {
      const vertical=Math.abs(Math.sin(this.angle))>.75;
      const sign=Math.cos(this.angle)<0?1:-1;
      let t=this.action==='Windup'?0:this.action==='Cut'?Math.min(1,this.elapsed/cut):1;
      t=t*t*(3-2*t);this.striking=this.action==='Cut';
      if(vertical) {
        this.targetPosition.set(.07,-.08-t*.28,-.38-t*.18);
        this.rotation.set(.3-t*2.65,0,-.08,'YXZ');
      } else {
        this.targetPosition.set(sign*(.34-t*.62),-.2-Math.sin(this.angle)*(t-.5)*.22,-.48-Math.sin(t*Math.PI)*.13);
        this.rotation.set(-Math.PI/2+Math.sin(this.angle)*(t-.5),sign*(-1.25+t*2.5),-Math.sin(this.angle)*.6,'YXZ');
      }
    }
    this.targetRotation.setFromEuler(this.rotation);
    const smoothing=1-Math.exp(-dt*(this.striking?38:18));
    this.localPosition.lerp(this.targetPosition,smoothing);this.localRotation.slerp(this.targetRotation,smoothing);
    hand.position.copy(this.localPosition).applyQuaternion(view).add(head);
    hand.quaternion.copy(view).multiply(this.localRotation);
  }
}
