import {
  BufferGeometry, CircleGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, Vector3,
} from '@iwsdk/core';
import { GRIMOIRES, type MagicAttribute, type SpellId } from './combat-data.js';
import { crescentSurface, flowRibbon } from './scene-assets/lib/magic-surfaces.js';
import { clockSpell, spellMaterial, tintSpell } from './spell-material.js';

export type Shot = {
  root: Group; core: Mesh; crescent: Mesh; tail: Mesh; material: MeshBasicMaterial;
  previous: Vector3; velocity: Vector3; life: number; enemy: boolean;
  damage: number; power: number; attribute: MagicAttribute; spell: SpellId;
  wisps: Mesh<BufferGeometry, MeshBasicMaterial>[]; age: number;
};

export class CombatVisuals {
  readonly root = new Group();
  readonly shots: Shot[] = [];
  readonly shields: Mesh[] = [];
  readonly charges: Mesh[] = [];
  readonly beams: Mesh[][] = [];
  readonly portal: Mesh;
  readonly glyph: Group;
  readonly trail: Mesh[] = [];
  private direction = new Vector3();
  private axis = new Vector3(0, 0, 1);
  private up = new Vector3(0, 1, 0);
  private dart: BufferGeometry;
  private streak: BufferGeometry;
  private ribbon: BufferGeometry;
  private ward: BufferGeometry;
  private tear: BufferGeometry;
  private trailReady = false;
  private readonly materials: MeshBasicMaterial[] = [];
  private readonly trailGeometry = new BufferGeometry();
  private readonly trailPositions = new Float32Array(24*3);
  private readonly membrane = new CircleGeometry(.29,64);
  private time = 0;

  constructor() {
    this.root.name = 'CombatEffects';
    this.dart = new SphereGeometry(.5,20,12);
    this.streak = flowRibbon(1.2,.22,.35);
    this.ribbon = crescentSurface();
    this.ward = new RingGeometry(.275,.285,96);this.ward.rotateX(-Math.PI/2);
    this.membrane.rotateX(-Math.PI/2);
    this.tear = new CircleGeometry(.12,64);
    for (let i = 0; i < 20; i++) {
      const root = new Group();
      const material = this.material(1,'flare');
      root.name = `Projectile${i}`;
      root.visible = false;
      const core = new Mesh(this.dart, material);
      const crescent = new Mesh(this.ribbon, this.material());
      const tail = new Mesh(this.streak, this.material());
      core.name = 'Core';
      crescent.name = 'Crescent';
      tail.name = 'Trail';
      tail.position.z = -0.14;
      root.add(core, crescent, tail);
      const wisps: Mesh<BufferGeometry,MeshBasicMaterial>[]=[];
      for(let n=0;n<3;n++) {
        const wisp=new Mesh(this.streak,this.material(.5,n===0?'mist':'ribbon'));
        wisp.name=`SpellFlow${n}`;wisp.rotation.z=n*Math.PI*2/3;root.add(wisp);wisps.push(wisp);
      }
      this.root.add(root);
      this.shots.push({
        root, core, crescent, tail, material, previous: new Vector3(), velocity: new Vector3(),
        life: 0, enemy: false, damage: 0, power: 1, attribute: 'shadow', spell: 'bolt', wisps, age: 0,
      });
    }
    for (let i = 0; i < 2; i++) {
      const shield = new Mesh(this.ward, this.material(.9,'sigil'));
      shield.name = i ? 'AegisRight' : 'AegisLeft';
      for (let plate = 0; plate < 2; plate++) {
        const layer = new Mesh(plate===0?this.ward:this.membrane, this.material(plate === 0 ? .65 : .075,plate===0?'sigil':'flare'));
        layer.name = plate === 0 ? 'WardRim' : 'WardInner';
        layer.scale.setScalar(plate === 0 ? .85 : 1);
        layer.position.y = 0.01 + plate * 0.012;
        shield.add(layer);
      }
      shield.visible = false;
      this.shields.push(shield);
      this.root.add(shield);
      const charge = new Mesh(this.dart, this.material(.8,'flare'));
      charge.name = i ? 'ChargeRight' : 'ChargeLeft';
      charge.visible = false;
      this.charges.push(charge);
      this.root.add(charge);
      for(let n=0;n<3;n++) {
        const coil=new Mesh(this.streak,this.material(.7));coil.name=`ChargeCoil${n}`;
        coil.rotation.z=n*Math.PI*2/3;coil.scale.set(1.8,1.8,1.8);charge.add(coil);
      }
      const beam: Mesh[] = [];
      for (let n = 0; n < 6; n++) {
        const bead = new Mesh(this.streak, this.material(0.55));
        bead.visible = false;
        beam.push(bead);
        this.root.add(bead);
      }
      this.beams.push(beam);
    }
    this.portal = new Mesh(this.tear, this.material(.95,'mist'));
    this.portal.name = 'WeaponAperture';
    this.portal.visible = false;
    for (const side of [-1, 1]) {
      const fang = new Mesh(this.streak, this.material(.8));
      fang.name = side < 0 ? 'ApertureLeft' : 'ApertureRight';
      fang.scale.set(.18,.18,.36);
      fang.position.set(side * 0.07, side * 0.08, 0.02);
      fang.rotation.z = side * 0.9;
      this.portal.add(fang);
    }
    this.root.add(this.portal);
    this.glyph = new Group();
    this.glyph.name = 'SummoningGlyph';
    this.glyph.visible = false;
    const sealGeometry=new RingGeometry(.97,1,96);
    for (let i = 0; i < 3; i++) {
      const circle = new Mesh(sealGeometry, this.material(.7,'sigil'));circle.name=`SummoningCircle${i}`;
      circle.scale.setScalar(1-i*.19);this.glyph.add(circle);
    }
    this.root.add(this.glyph);
    const uv:number[]=[],indices:number[]=[];
    for(let n=0;n<12;n++){uv.push(n/11,0,n/11,1);if(n<11){const p=n*2;indices.push(p,p+1,p+2,p+1,p+3,p+2);}}
    this.trailGeometry.setAttribute('position',new Float32BufferAttribute(this.trailPositions,3));
    this.trailGeometry.setAttribute('uv',new Float32BufferAttribute(uv,2));this.trailGeometry.setIndex(indices);
    const trail=new Mesh(this.trailGeometry,this.material(0));trail.name='ContinuousSwordWake';trail.frustumCulled=false;trail.visible=false;
    this.trail.push(trail);this.root.add(trail);
  }

  private material(opacity = 1, kind: 'ribbon'|'mist'|'flare'|'sigil' = 'ribbon'): MeshBasicMaterial {
    const material=spellMaterial(kind,opacity);this.materials.push(material);return material;
  }

  launch(position: Vector3, direction: Vector3, speed: number, attribute: MagicAttribute, spell: SpellId, damage: number, power: number, enemy = false): boolean {
    let shot: Shot | undefined;
    for (const candidate of this.shots) if (candidate.life <= 0) { shot = candidate; break; }
    if (!shot) return false;
    shot.root.position.copy(position);
    shot.previous.copy(position);
    shot.velocity.copy(direction).normalize().multiplyScalar(speed);
    shot.root.quaternion.setFromUnitVectors(this.axis, this.direction.copy(direction).normalize());
    shot.life = 4;
    shot.enemy = enemy;
    shot.attribute = attribute;
    shot.spell = spell;
    shot.damage = damage;
    shot.power = power;
    shot.age=0;
    shot.root.visible = true;
    tintSpell(shot.material,enemy?'fire':attribute);
    tintSpell(shot.crescent.material as MeshBasicMaterial,attribute);
    tintSpell(shot.tail.material as MeshBasicMaterial,attribute);
    const reach = enemy ? 0.07 : spell === 'blast' ? 0.2 : 0.055;
    shot.core.visible = spell !== 'slash';
    shot.core.scale.set(reach,reach,reach*(attribute==='fire'?2.4:1.6));
    shot.crescent.visible = spell === 'slash';
    shot.crescent.scale.set(.95,.8,1);
    shot.tail.scale.set(reach*3,reach*3,spell==='blast'?.85:.55);
    for(let i=0;i<shot.wisps.length;i++) {
      const wisp=shot.wisps[i];tintSpell(wisp.material,attribute,i===0&&attribute==='shadow');
      wisp.scale.set(reach*(attribute==='wind'?5:3.5),reach*(attribute==='wind'?5:3.5),spell==='blast'?.7:.38);
      wisp.position.z=-.08-i*.035;wisp.material.opacity=i===0?.6:.75;
    }
    return true;
  }

  hand(index: number, position: Vector3, direction: Vector3, book: Vector3, attribute: MagicAttribute, charge: number, shield: boolean, time: number): void {
    const orb = this.charges[index];
    orb.visible = charge > 0;
    orb.position.copy(position).addScaledVector(direction, 0.08);
    orb.quaternion.setFromUnitVectors(this.axis, direction);
    const amount = Math.min(1, charge);
    orb.scale.set(0.03 + amount * 0.05, 0.02 + amount * 0.035, 0.05 + amount * 0.16);
    tintSpell(orb.material as MeshBasicMaterial,attribute);
    for(let i=0;i<orb.children.length;i++) {
      const coil=orb.children[i] as Mesh<BufferGeometry,MeshBasicMaterial>;
      tintSpell(coil.material,attribute);coil.rotation.z=time*(attribute==='wind'?3:1.5)+i*Math.PI*2/3;
    }
    const barrier = this.shields[index];
    barrier.visible = shield;
    barrier.position.copy(position).addScaledVector(direction, 0.14);
    barrier.quaternion.setFromUnitVectors(this.up, direction);
    barrier.scale.setScalar(1.05 + Math.sin(time * 2) * .015);
    tintSpell(barrier.material as MeshBasicMaterial,attribute);
    let plateIndex = 0;
    for (const child of barrier.children) {
      if (!(child instanceof Mesh)) continue;
      child.rotation.y = time*.2*(plateIndex===0?1:-1);
      tintSpell(child.material as MeshBasicMaterial,attribute);
      plateIndex += 1;
    }
    this.direction.copy(position).sub(book);
    const span = this.direction.length();
    if (span > 0.001) this.direction.multiplyScalar(1 / span);
    for (let n = 0; n < this.beams[index].length; n++) {
      const bead = this.beams[index][n];
      bead.visible = charge > 0 || shield;
      const t = (time * 0.85 + n / this.beams[index].length) % 1;
      bead.position.lerpVectors(book, position, t);
      bead.position.y += Math.sin(t * Math.PI) * 0.08;
      bead.quaternion.setFromUnitVectors(this.axis, this.direction);
      bead.scale.set(.035,.035,Math.max(.08,span*.35));
      (bead.material as MeshBasicMaterial).opacity=Math.sin(t*Math.PI)*.32;
      tintSpell(bead.material as MeshBasicMaterial,attribute);
    }
  }

  swordTrail(position: Vector3, attribute: MagicAttribute, grip: Vector3): void {
    const trail = this.trail[0];
    trail.visible = true;
    const material = trail.material as MeshBasicMaterial;
    material.opacity=.7;tintSpell(material,attribute);
    const positions=this.trailGeometry.attributes.position.array as Float32Array;
    positions.copyWithin(6,0,positions.length-6);
    this.direction.lerpVectors(grip,position,.3);
    for(let i=0;i<(this.trailReady?1:12);i++) {
      const n=i*6;positions[n]=position.x;positions[n+1]=position.y;positions[n+2]=position.z;
      positions[n+3]=this.direction.x;positions[n+4]=this.direction.y;positions[n+5]=this.direction.z;
    }
    this.trailGeometry.attributes.position.needsUpdate=true;this.trailReady=true;
  }

  update(delta: number): void {
    this.time+=delta;
    for(const material of this.materials)clockSpell(material,this.time);
    for (const shot of this.shots) {
      if (shot.life <= 0) { shot.root.visible = false; continue; }
      shot.previous.copy(shot.root.position);
      shot.root.position.addScaledVector(shot.velocity, delta);
      shot.life -= delta;
      shot.age+=delta;
      shot.core.rotation.z += delta * (shot.spell === 'blast' ? 3 : 9);
      shot.crescent.rotation.z = Math.sin(shot.age*3)*.12;
      shot.tail.rotation.z += delta*(shot.attribute==='wind'?6:1.2);
      for(let i=0;i<shot.wisps.length;i++) {
        const wisp=shot.wisps[i];wisp.rotation.z+=delta*(shot.attribute==='wind'?5:shot.attribute==='fire'?2:.65)*(i%2?1:-1);
        wisp.material.opacity=(i===0?.5:.8)*Math.min(1,shot.age*14)*Math.min(1,shot.life*6);
      }
    }
    if (this.glyph.visible) {
      for (let i = 0; i < this.glyph.children.length; i++) {
        this.glyph.children[i].rotation.z += delta * (.4 + i * .2) * (i === 1 ? -1 : 1);
      }
    }
    if (this.portal.visible) {
      for (const fang of this.portal.children) fang.rotation.y += delta * 2.4;
    }
    for (const trail of this.trail) {
      const material = trail.material as MeshBasicMaterial;
      material.opacity = Math.max(0, material.opacity - delta * 2.2);
      trail.visible = material.opacity > 0;
      if(!trail.visible)this.trailReady=false;
    }
  }

  reset(): void {
    for (const shot of this.shots) { shot.life = 0; shot.root.visible = false; }
    for (const object of this.shields) object.visible = false;
    for (const object of this.charges) object.visible = false;
    for (const beam of this.beams) for (const bead of beam) bead.visible = false;
    for (const trail of this.trail) trail.visible = false;
    this.portal.visible = false;
    this.glyph.visible = false;
    this.trailReady = false;
  }

  dispose(): void {
    this.dart.dispose();
    this.streak.dispose();
    this.ribbon.dispose();
    this.ward.dispose();
    this.tear.dispose();
    this.membrane.dispose();this.trailGeometry.dispose();
    (this.glyph.children[0] as Mesh).geometry.dispose();
    for(const material of this.materials)material.dispose();
  }
}
