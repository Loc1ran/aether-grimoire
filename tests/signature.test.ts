import assert from 'node:assert/strict';
import { Group, Quaternion, Vector3 } from '@iwsdk/core';
import { DesktopSword } from '../src/desktop-sword.js';
import { createHandIntent } from '../src/magic-input.js';
import { ArenaCombat } from '../src/arena-combat.js';
import { CombatVisuals } from '../src/combat-visuals.js';
import { ImpactVFX } from '../src/impact-vfx.js';
import { SignatureVFX } from '../src/signature-vfx.js';
import { createEmitter, createSword, createTrainingTarget } from '../src/scene-assets/combat.scene-asset.js';

const animator=new DesktopSword(),hand=createHandIntent('right'),head=new Vector3(0,1.6,0),view=new Quaternion();
for(let i=0;i<30;i++)animator.update(.016,hand,head,view,0,0);
assert.equal(animator.striking,false);
const readyBlade=new Vector3(0,1,0).applyQuaternion(hand.quaternion);
assert.ok(readyBlade.y>.96,'ready blade must point vertically up');
for(let i=0;i<45;i++)animator.update(.016,hand,head,view,-.8,-.5);
const aimedLeft=new Vector3(0,1,0).applyQuaternion(hand.quaternion);
for(let i=0;i<45;i++)animator.update(.016,hand,head,view,.8,.5);
const aimedRight=new Vector3(0,1,0).applyQuaternion(hand.quaternion);
assert.ok(aimedLeft.y>.94 && aimedRight.y>.94,'mouse movement must not lay the resting blade flat');
assert.equal(animator.striking,false,'aiming the held blade is not an attack');
animator.press();for(let i=0;i<40;i++)animator.update(.016,hand,head,view,0,0);animator.release(1,0);
let left=Infinity,right=-Infinity,cutFrames=0,firstTip=0,lastTip=0;
const tip=new Vector3();
const posedSword=createSword(),arm=posedSword.getObjectByName('Forearm')!;
const elbow=new Vector3(),wrist=new Vector3(),shoulder=new Vector3(.23,-.22,.04).applyQuaternion(view).add(head);
let recoveryStart:Quaternion|undefined,recoveryEnd:Quaternion|undefined;
for(let i=0;i<60;i++) {
  animator.update(.016,hand,head,view,0,0);
  posedSword.position.copy(hand.position);posedSword.quaternion.copy(hand.quaternion);
  animator.poseForearm(arm,posedSword,head,view);posedSword.updateMatrixWorld(true);
  elbow.set(0,0,.3);arm.localToWorld(elbow);
  arm.getWorldPosition(wrist);
  assert.ok(Math.abs(elbow.distanceTo(wrist)-.29)<.00001,'forearm length must remain fixed through the cut');
  assert.ok(Math.abs(elbow.distanceTo(shoulder)-.31)<.00001,'elbow must remain reachable from the shoulder');
  if(animator.action==='Recovery'){recoveryStart??=hand.quaternion.clone();recoveryEnd=hand.quaternion.clone();}
  if(animator.striking){tip.set(0,.84,0).applyQuaternion(hand.quaternion).add(hand.position);if(cutFrames===0)firstTip=tip.x;lastTip=tip.x;left=Math.min(left,tip.x);right=Math.max(right,tip.x);cutFrames++;}
}
assert.ok(cutFrames>5 && right-left>1,'horizontal attack must sweep the blade across the body');
assert.ok(lastTip>firstTip,'a rightward drag must cut left to right');
assert.equal(animator.action,'Ready');assert.equal(animator.striking,false);
assert.ok(recoveryStart!.angleTo(recoveryEnd!)>.4,'recovery must move continuously back toward guard');
assert.ok(animator.divider());assert.equal(animator.ultimate,true);
animator.reset();assert.equal(animator.ultimate,false);
for(let i=0;i<40;i++)animator.update(.016,hand,head,view,0,0);
animator.press();animator.release();
let defaultFirstY:number|undefined,defaultLastY=0;
for(let i=0;i<60;i++){
  animator.update(.016,hand,head,view,0,0);
  if(animator.striking){tip.set(0,.84,0).applyQuaternion(hand.quaternion).add(hand.position);defaultFirstY??=tip.y;defaultLastY=tip.y;}
}
assert.ok(defaultFirstY!-defaultLastY>.8,'default click and F must produce an overhead downward cut');
for(const dy of [-1,1]) {
  for(let i=0;i<40;i++)animator.update(.016,hand,head,view,0,0);
  animator.press();animator.release(0,dy);
  let firstY:number|undefined,lastY=0;
  for(let i=0;i<60;i++){
    animator.update(.016,hand,head,view,0,0);
    if(animator.striking){tip.set(0,.84,0).applyQuaternion(hand.quaternion).add(hand.position);firstY??=tip.y;lastY=tip.y;}
  }
  assert.ok((lastY-firstY!)*dy>0,'vertical drag direction must control rising versus overhead cuts');
}

const target=createTrainingTarget();target.position.z=-2.5;
const values:any={health:360,radius:.4,surface:'metal',resetAfter:0,boss:true};
const entity:any={object3D:target,getValue:(_:unknown,f:string)=>values[f],setValue:(_:unknown,f:string,v:unknown)=>{values[f]=v;}};
const sword=createSword(),emitter=createEmitter();emitter.position.set(0,1.7,-3.3);
const world:any={requireSceneObject:(id:string)=>id==='emitter'?emitter:sword};
const visuals=new CombatVisuals(),impacts=new ImpactVFX(new Group()),events:string[]=[];
const arena=new ArenaCombat(world,visuals,impacts,{play(){}} as any,()=>[entity],e=>events.push(e));
const hands=[createHandIntent('left'),createHandIntent('right')];hands.forEach(h=>h.tracked=true);
const weapon:any={state:'Held',holderIndex:1,tip:new Vector3(.54,1.4,-.6),previousTip:new Vector3(.54,1.4,-.6),swingSpeed:0,swingDistance:0,attackActive:false,parryTime:.2,counterTime:0};
sword.position.set(-.3,1.4,-.6);
visuals.launch(new Vector3(0,1.4,-1.3),new Vector3(0,0,1),2,'fire','bolt',1,1,true);
visuals.update(.5);arena.update(.5,head,hands,weapon,[3,3],'shadow',true);
assert.ok(events.includes('counter'));assert.equal(weapon.parryTime,0);assert.equal(weapon.counterTime,4);
assert.ok(visuals.shots.every(s=>s.life<=0),'counter must destroy the intercepted spell');
arena.startBoss();
assert.ok(arena.vortex(head,new Vector3(0,0,-1)));assert.equal(arena.vortex(head,new Vector3(0,0,-1)),false,'vortex cooldown prevents spam');
arena.update(.1,head,hands,weapon,[3,3],'shadow',true);
assert.ok(target.position.z>-2.5&&target.position.y>0,'vortex must move and lift targets');
const hp=values.health;
arena.dimensionCut(new Vector3(0,1.35,0),new Vector3(0,0,-1),new Vector3(1,0,0));
assert.ok(values.health<hp&&arena.bossArmor<100,'cut must damage health and armor');
arena.dimensionCut(new Vector3(0,1.35,0),new Vector3(0,0,-1),new Vector3(0,1,0),true);
arena.dimensionCut(new Vector3(0,1.35,0),new Vector3(0,0,-1),new Vector3(0,1,0),true);
assert.equal(arena.bossPhase,'Defeated');assert.ok(events.includes('victory'));assert.equal(arena.emitterEnabled,false);
arena.reset();assert.equal(values.health,360);assert.equal(arena.vortexTime,0);assert.equal(arena.bossPhase,'Dormant');
const signature=new SignatureVFX();signature.cut(head,new Vector3(0,0,-1),new Vector3(1,0,0));signature.update(.1,2,arena.vortexCenter);
assert.ok(signature.vortex.visible);signature.reset();assert.equal(signature.vortex.visible,false);
signature.dispose();visuals.dispose();impacts.dispose();
console.log('PASS full sword arcs, timed counter, vortex crowd control, armor damage, ultimate victory and reset');
