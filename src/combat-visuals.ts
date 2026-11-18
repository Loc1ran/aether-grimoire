import {
  BufferGeometry, CircleGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Quaternion, RingGeometry, SphereGeometry, Vector3,
} from '@iwsdk/core';
import { GRIMOIRES, type MagicAttribute, type SpellId } from './combat-data.js';
import { crescentSurface, flowRibbon } from './scene-assets/lib/magic-surfaces.js';
import { clockSpell, spellMaterial, tintSpell, type SpellSurface } from './spell-material.js';
import { SmokeVolume } from './smoke-volume.js';

export type Shot = {
  root: Group; core: Mesh; crescent: Mesh; tail: Mesh; material: MeshBasicMaterial;
  previous: Vector3; velocity: Vector3; life: number; enemy: boolean;
  damage: number; power: number; attribute: MagicAttribute; spell: SpellId;
  wisps: Mesh<BufferGeometry, MeshBasicMaterial>[]; edge: Mesh; age: number; aura: boolean; roll: number;
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
  readonly bladeGlow = new Group();
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
  private readonly smokeCard = new PlaneGeometry(1,1);
  private readonly auraRotation = new Quaternion();
  private readonly openingLayers: Mesh<BufferGeometry,MeshBasicMaterial>[] = [];
  private readonly bladeLayers: Mesh<BufferGeometry,MeshBasicMaterial>[] = [];
  private readonly smoke=new SmokeVolume(100,0x77736c);
  private readonly view=new Quaternion();

  constructor() {
    this.root.name = 'CombatEffects';
    this.root.add(this.smoke.mesh);
    this.dart = flowRibbon(0,0,.26);
    this.streak = flowRibbon(.12,.035,.08);
    this.ribbon = crescentSurface();
    this.ward = new SphereGeometry(.31,40,24,0,Math.PI*2,0,Math.PI/2);
    this.membrane.rotateX(-Math.PI/2);
    this.tear = new CircleGeometry(.12,64);
    for (let i = 0; i < 20; i++) {
      const root = new Group();
      const material = this.material(1,'ribbon');
      root.name = `Projectile${i}`;
      root.visible = false;
      const core = new Mesh(this.dart, material);
      for(let n=1;n<3;n++){const flame=new Mesh(this.dart,material);flame.rotation.z=n*Math.PI/3;core.add(flame);}
      const crescent = new Mesh(this.ribbon, this.material(1,'ink'));
      const edge = new Mesh(this.ribbon, this.material(1,'edge'));edge.name='CuttingAuraEdge';edge.position.z=.003;crescent.add(edge);
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
        life: 0, enemy: false, damage: 0, power: 1, attribute: 'shadow', spell: 'bolt', wisps, edge, age: 0, aura: false, roll: 0,
      });
    }
    for (let i = 0; i < 2; i++) {
      const shield = new Mesh(this.ward, this.material(.48,'ward'));
      shield.name = i ? 'AegisRight' : 'AegisLeft';
      for (let plate = 0; plate < 2; plate++) {
        const layer = new Mesh(this.ward, this.material(plate === 0 ? .12 : .035,'ward'));
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
    this.glyph.name = 'LivingInkSummon';
    this.glyph.visible = false;
    for (let i = 0; i < 24; i++) {
      const layer=new Mesh(i<8?this.smokeCard:this.streak,this.material(0,i<7?'smoke':i===7?'rift':'ribbon'));
      layer.name=i<7?`RisingInkPlume${i}`:i===7?'PageGutterRift':`EscapingEmber${i}`;
      this.openingLayers.push(layer);this.glyph.add(layer);
    }
    this.root.add(this.glyph);
    const uv:number[]=[],indices:number[]=[];
    for(let n=0;n<12;n++){uv.push(n/11,0,n/11,1);if(n<11){const p=n*2;indices.push(p,p+1,p+2,p+1,p+3,p+2);}}
    this.trailGeometry.setAttribute('position',new Float32BufferAttribute(this.trailPositions,3));
    this.trailGeometry.setAttribute('uv',new Float32BufferAttribute(uv,2));this.trailGeometry.setIndex(indices);
    const trail=new Mesh(this.trailGeometry,this.material(0,'wake'));trail.name='ContinuousSwordWake';trail.frustumCulled=false;trail.visible=false;
    this.trail.push(trail);this.root.add(trail);
    this.bladeGlow.name='BladeBoundAura';this.bladeGlow.visible=false;
    for(let i=0;i<6;i++) {
      const layer=new Mesh(this.smokeCard,this.material(0,i<3?'smoke':'aura'));
      layer.name=i<3?`BladeInk${i}`:`BladeFlame${i-3}`;
      layer.position.set(.018,.47,0);layer.rotation.y=(i%3)*Math.PI/3;
      layer.scale.set(i<3?.20:.14,i<3?.84:.78,1);
      this.bladeGlow.add(layer);this.bladeLayers.push(layer);
    }
    this.root.add(this.bladeGlow);
  }

  private material(opacity = 1, kind: SpellSurface = 'ribbon'): MeshBasicMaterial {
    const material=spellMaterial(kind,opacity);this.materials.push(material);return material;
  }
  setView(rotation:Quaternion):void { this.view.copy(rotation);this.smoke.setView(rotation); }

  launch(position: Vector3, direction: Vector3, speed: number, attribute: MagicAttribute, spell: SpellId, damage: number, power: number, enemy = false, aura = false, roll = 0): boolean {
    let shot: Shot | undefined;
    for (const candidate of this.shots) if (candidate.life <= 0) { shot = candidate; break; }
    if (!shot) return false;
    shot.root.position.copy(position);
    shot.previous.copy(position);
    shot.velocity.copy(direction).normalize().multiplyScalar(speed);
    shot.root.quaternion.setFromUnitVectors(this.axis, this.direction.copy(direction).normalize());
    shot.life = aura?1.2:4;
    shot.aura=aura;shot.roll=roll;
    shot.enemy = enemy;
    shot.attribute = attribute;
    shot.spell = spell;
    shot.damage = damage;
    shot.power = power;
    shot.age=0;
    shot.root.visible = true;
    tintSpell(shot.material,enemy?'fire':attribute);
    tintSpell(shot.crescent.material as MeshBasicMaterial,attribute);
    (shot.crescent.material as MeshBasicMaterial).color.setHex(attribute==='wind'?0x103a2d:0x09060d);
    tintSpell(shot.edge.material as MeshBasicMaterial,attribute);
    if(aura && attribute==='shadow')(shot.edge.material as MeshBasicMaterial).color.setHex(0xd5c2a2);
    tintSpell(shot.tail.material as MeshBasicMaterial,attribute);
    const reach = enemy ? 0.07 : spell === 'blast' ? 0.2 : 0.055;
    shot.core.visible = spell !== 'slash';
    shot.core.scale.set(enemy?.18:spell==='blast'?.75:.28,enemy?.18:spell==='blast'?.75:.28,enemy?.25:spell==='blast'?1.35:.55);
    shot.crescent.visible = spell === 'slash';
    shot.crescent.scale.set(aura?1.8:.95,aura?1.3:.8,1);
    shot.crescent.rotation.z=roll;
    shot.tail.scale.set(reach*2,reach*2,spell==='blast'?1.5:.65);
    for(let i=0;i<shot.wisps.length;i++) {
      const wisp=shot.wisps[i];tintSpell(wisp.material,attribute,i===0&&attribute==='shadow');
      wisp.scale.set(reach*(attribute==='wind'?5:3.5),reach*(attribute==='wind'?5:3.5),spell==='blast'?.7:.38);
      wisp.position.z=-.08-i*.035;wisp.material.opacity=i===0?.6:.75;
    }
    return true;
  }

  swordAura(position: Vector3, forward: Vector3, sweep: Vector3, attribute: MagicAttribute): boolean {
    this.auraRotation.setFromUnitVectors(this.axis,this.direction.copy(forward).normalize()).invert();
    this.direction.copy(sweep).applyQuaternion(this.auraRotation);
    // Judge swing direction independently of frame rate; speed/travel are gated by the weapon.
    if(this.direction.x*this.direction.x+this.direction.y*this.direction.y<=this.direction.lengthSq()*.04)return false;
    const roll=Math.atan2(this.direction.y,this.direction.x);
    return this.launch(position,forward,8.5,attribute,'slash',32,2,false,true,roll);
  }

  bladeAura(sword: Object3D, attribute: MagicAttribute, held: boolean, speed: number): void {
    this.bladeGlow.visible=held && sword.visible;
    if(!this.bladeGlow.visible)return;
    this.bladeGlow.position.copy(sword.position);this.bladeGlow.quaternion.copy(sword.quaternion);
    for(let i=0;i<this.bladeLayers.length;i++) {
      const layer=this.bladeLayers[i];tintSpell(layer.material,attribute,i<3);
      if(attribute==='shadow')layer.material.color.setHex(i<3?0x393b3c:0xd5c8ac);
      layer.material.opacity=(i<3?.045:.035)+Math.min(speed/15,1)*.12;
    }
  }

  bookOpening(book: Object3D, attribute: MagicAttribute, progress: number): void {
    this.glyph.visible=progress>=0 && progress<1;
    if(!this.glyph.visible)return;
    this.glyph.position.copy(book.position);this.glyph.position.y+=.025;
    const envelope=Math.pow(Math.sin(Math.PI*progress),.75);
    for(let i=0;i<this.openingLayers.length;i++) {
      const layer=this.openingLayers[i];
      tintSpell(layer.material,attribute,i<5);
      if(i<5)layer.material.color.setHex(attribute==='shadow'?0x70716b:attribute==='fire'?0x68574b:0x88918e);
      if(i<7) {
        const side=(i-3)/3, lift=.13+progress*.23;
        layer.position.set(side*(.055+progress*.04),lift,.035*Math.sin(i*2.4));
        layer.quaternion.copy(this.view);layer.rotateZ(i*.87+progress*.14);
        layer.scale.setScalar(.14+progress*.27);layer.material.opacity=envelope*(i<5?.18:.08);
      } else if(i===7) {
        layer.position.set(0,.015,0);layer.quaternion.copy(book.quaternion);layer.scale.set(.35,.2,1);
        layer.material.opacity=envelope*.8;
      } else {
        const t=(progress*1.6+i*.137)%1,a=i*2.399;
        layer.position.set(Math.cos(a)*t*.3,t*.55,Math.sin(a)*t*.18);
        layer.rotation.set(.5,Math.cos(a),a);layer.scale.set(.018,.012,.045+t*.08);
        layer.material.opacity=Math.sin(t*Math.PI)*envelope*.85;
      }
      clockSpell(layer.material,this.time+i*.37);
    }
  }

  hand(index: number, position: Vector3, direction: Vector3, book: Vector3, attribute: MagicAttribute, charge: number, shield: boolean, time: number): void {
    const orb = this.charges[index];
    orb.visible = charge > 0;
    orb.position.copy(position).addScaledVector(direction, 0.08);
    orb.quaternion.setFromUnitVectors(this.axis, direction);
    const amount = Math.min(1, charge);
    orb.scale.set(.09+amount*.11,.09+amount*.11,.10+amount*.22);
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
    const material = trail.material as MeshBasicMaterial;
    material.opacity=.38;tintSpell(material,attribute);
    const positions=this.trailGeometry.attributes.position.array as Float32Array;
    // A pose jump must start a new wake instead of drawing a screen-wide triangle.
    if(this.trailReady && Math.hypot(position.x-positions[0],position.y-positions[1],position.z-positions[2])>.24)this.trailReady=false;
    trail.visible = this.trailReady;
    positions.copyWithin(6,0,positions.length-6);
    this.direction.lerpVectors(grip,position,.72);
    for(let i=0;i<(this.trailReady?1:12);i++) {
      const n=i*6;positions[n]=position.x;positions[n+1]=position.y;positions[n+2]=position.z;
      positions[n+3]=this.direction.x;positions[n+4]=this.direction.y;positions[n+5]=this.direction.z;
    }
    for(let n=6;n<positions.length;n+=6) {
      if(Math.hypot(position.x-positions[n],position.y-positions[n+1],position.z-positions[n+2])>.3)positions.copyWithin(n,n-6,n);
    }
    this.trailGeometry.attributes.position.needsUpdate=true;this.trailReady=true;
  }

  update(delta: number): void {
    this.time+=delta;
    for(const material of this.materials)clockSpell(material,this.time);
    for(let i=0;i<this.bladeLayers.length;i++)clockSpell(this.bladeLayers[i].material,this.time+(i%3)*1.73);
    for (let index=0;index<this.shots.length;index++) {
      const shot=this.shots[index];
      this.direction.copy(shot.velocity).normalize();
      for(let i=0;i<5;i++) {
        const t=(this.time*2.5+i*.2)%1,length=shot.spell==='blast'?1.5:.65,angle=i*2.399+this.time;
        this.smoke.particle(index*5+i,shot.root.position.x-this.direction.x*t*length+Math.cos(angle)*t*.04,
          shot.root.position.y-this.direction.y*t*length+t*.13,shot.root.position.z-this.direction.z*t*length,
          (.05+t*.24)*(shot.spell==='blast'?1.7:1),angle*.15,shot.life>0?Math.sin(t*Math.PI)*.20:0);
      }
      if (shot.life <= 0) { shot.root.visible = false; continue; }
      shot.previous.copy(shot.root.position);
      shot.root.position.addScaledVector(shot.velocity, delta);
      shot.life -= delta;
      shot.age+=delta;
      shot.core.rotation.z += delta * (shot.spell === 'blast' ? 3 : 9);
      shot.crescent.rotation.z = shot.roll+Math.sin(shot.age*3)*.04;
      (shot.crescent.material as MeshBasicMaterial).opacity=Math.min(1,shot.life*4);
      (shot.edge.material as MeshBasicMaterial).opacity=Math.min(1,shot.life*5);
      shot.tail.rotation.z += delta*(shot.attribute==='wind'?6:1.2);
      for(let i=0;i<shot.wisps.length;i++) {
        const wisp=shot.wisps[i];wisp.rotation.z+=delta*(shot.attribute==='wind'?5:shot.attribute==='fire'?2:.65)*(i%2?1:-1);
        wisp.material.opacity=(i===0?.5:.8)*Math.min(1,shot.age*14)*Math.min(1,shot.life*6);
      }
    }
    this.smoke.commit();
    if (this.portal.visible) {
      for (const fang of this.portal.children) fang.rotation.y += delta * 2.4;
    }
    for (const trail of this.trail) {
      const material = trail.material as MeshBasicMaterial;
      material.opacity = Math.max(0, material.opacity - delta * 3.2);
      trail.visible = material.opacity > 0;
      if(!trail.visible)this.trailReady=false;
    }
  }

  reset(): void {
    for (const shot of this.shots) { shot.life = 0; shot.root.visible = false; }
    for (const object of this.shields) object.visible = false;
    for (const object of this.charges) object.visible = false;
    for (const beam of this.beams) for (const bead of beam) bead.visible = false;
    for (const trail of this.trail) { trail.visible = false; (trail.material as MeshBasicMaterial).opacity=0; }
    this.portal.visible = false;
    this.glyph.visible = false;
    this.bladeGlow.visible = false;
    this.trailReady = false;
    for(let i=0;i<100;i++)this.smoke.particle(i,0,0,0,0,0,0);this.smoke.commit();
  }

  dispose(): void {
    this.dart.dispose();
    this.streak.dispose();
    this.ribbon.dispose();
    this.ward.dispose();
    this.tear.dispose();
    this.membrane.dispose();this.trailGeometry.dispose();
    this.smokeCard.dispose();
    this.smoke.dispose();
    for(const material of this.materials)material.dispose();
  }
}
