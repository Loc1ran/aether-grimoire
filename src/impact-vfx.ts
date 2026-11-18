import {
  AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute,
  CircleGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, Quaternion, Vector3,
} from '@iwsdk/core';
import { wedgeGeometry } from './scene-assets/lib/relic-forms.js';
import { clockSpell, spellMaterial, tintSpell } from './spell-material.js';
import { flowRibbon } from './scene-assets/lib/magic-surfaces.js';
import {
  GRIMOIRES, IMPACT_LEVELS, IMPACT_PROFILES, impactDensity, impactLevel,
  type MagicAttribute, type SurfaceKind,
} from './combat-data.js';

type Burst = {
  group: Group; flash: Mesh; wave: Mesh; debris: InstancedMesh; sparks: InstancedMesh;
  dust: InstancedMesh; glow: MeshBasicMaterial; waveMat: MeshBasicMaterial;
  chipMat: MeshStandardMaterial; sparkMat: MeshBasicMaterial; dustMat: MeshBasicMaterial;
  age: number; duration: number; radius: number; seed: number; attribute: MagicAttribute;
  surface: SurfaceKind; density: number; gravity: Vector3;
};
type Mark = {
  group: Group; cracks: Mesh; slash: Mesh; scorch: Mesh;
  ink: MeshBasicMaterial; burn: MeshBasicMaterial; age: number; life: number;
};

/** A fixed visual pool: all transforms are local to each hit's outward normal (+Z). */
export class ImpactVFX {
  private readonly bursts: Burst[] = [];
  private readonly marks: Mark[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: (MeshBasicMaterial | MeshStandardMaterial)[] = [];
  private readonly stamp = new Object3D();
  private readonly normal = new Vector3();
  private readonly forward = new Vector3(0, 0, 1);
  private readonly viewer = new Vector3(0, 1.6, 0);
  private nextBurst = 0;
  private nextMark = 0;
  private sequence = 0;
  private lowQuality = false;
  private readonly view=new Quaternion();

  constructor(private readonly root: Group) {
    root.name = 'ImpactEffects';
    root.userData.iwsdkPreviewBounds = 'exclude';
    const sphere = new PlaneGeometry(1,1);
    const ring = new PlaneGeometry(1,1);
    const chip = wedgeGeometry();
    const spark = flowRibbon(.1,.02,.09);
    const disc = new CircleGeometry(1,48);
    const crystal = new CircleGeometry(.5,48);
    const cracks = crackGeometry();
    const slash = slashGeometry();
    this.geometries.push(sphere, ring, chip, spark, disc, crystal, cracks, slash);
    for (let i = 0; i < 8; i++) {
      const group = new Group();
      group.name = `ImpactBurst_${i}`;
      const glow = this.lightMaterial('flare');
      const waveMat = this.lightMaterial('flare');
      const chipMat = new MeshStandardMaterial({ color: 0x88818c, roughness: 0.9, transparent: true });
      const sparkMat = this.lightMaterial('ribbon');
      const dustMat = spellMaterial('smoke',.2);
      this.materials.push(chipMat, dustMat);
      const flash = new Mesh(crystal, glow);
      flash.name = 'ImpactFlash';
      const wave = new Mesh(ring, waveMat);
      wave.name = 'ImpactPressureFlash';
      const debris = new InstancedMesh(chip, chipMat, 12);
      debris.name = 'AnimatedFragments';
      const sparks = new InstancedMesh(spark, sparkMat, 16);
      sparks.name = 'DirectionalSparks';
      const dust = new InstancedMesh(sphere, dustMat, 4);
      dust.name = 'DustAndSmoke';
      debris.frustumCulled = sparks.frustumCulled = dust.frustumCulled = false;
      group.add(flash, wave, debris, sparks, dust);
      group.visible = false;
      root.add(group);
      this.bursts.push({ group, flash, wave, debris, sparks, dust, glow, waveMat, chipMat, sparkMat, dustMat,
        age: 100, duration: 1, radius: 1, seed: 0, attribute: 'shadow', surface: 'stone', density: 1, gravity: new Vector3() });
    }
    for (let i = 0; i < 12; i++) {
      const group = new Group();
      group.name = `SurfaceMark_${i}`;
      const ink = new MeshBasicMaterial({ color: 0x211a2a, transparent: true, depthWrite: false, side: DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      const burn = spellMaterial('mist',.25);
      burn.polygonOffset=true;burn.polygonOffsetFactor=-1;burn.polygonOffsetUnits=-1;
      this.materials.push(ink, burn);
      const crackMesh = new Mesh(cracks, ink);
      crackMesh.name = 'GroundCracks';
      const slashMesh = new Mesh(slash, ink);
      slashMesh.name = 'SlashMark';
      const scorch = new Mesh(disc, burn);
      scorch.name = 'ScorchResidue';
      scorch.position.z = -0.001;
      group.add(scorch, crackMesh, slashMesh);
      group.visible = false;
      root.add(group);
      this.marks.push({ group, cracks: crackMesh, slash: slashMesh, scorch, ink, burn, age: 100, life: 1 });
    }
  }

  setQuality(quality: 'low' | 'high'): void { this.lowQuality = quality === 'low'; }
  setViewerPosition(position: Vector3): void { this.viewer.copy(position); }
  setView(rotation:Quaternion):void { this.view.copy(rotation); }

  get activeCount(): number {
    let count = 0;
    for (const burst of this.bursts) if (burst.group.visible) count++;
    for (const mark of this.marks) if (mark.group.visible) count++;
    return count;
  }

  emit(position: Vector3, normal: Vector3, attribute: MagicAttribute, surface: SurfaceKind, power: number, slash = false, leaveMark = false): void {
    if (!finiteVector(position) || !finiteVector(normal) || normal.lengthSq() < 0.00001) return;
    const profile = IMPACT_PROFILES[surface];
    const magic = GRIMOIRES[attribute];
    if (!profile || !magic) return;
    const level = impactLevel(power);
    const settings = IMPACT_LEVELS[level - 1];
    const density = impactDensity(position.distanceToSquared(this.viewer), this.lowQuality);
    const burst = this.bursts[this.nextBurst++ % (this.lowQuality ? 4 : 8)];
    this.normal.copy(normal).normalize();
    burst.group.position.copy(position).addScaledVector(this.normal, 0.012);
    burst.group.quaternion.setFromUnitVectors(this.forward, this.normal);
    this.stamp.quaternion.copy(burst.group.quaternion).invert();
    burst.gravity.set(0, -2.8, 0).applyQuaternion(this.stamp.quaternion);
    burst.group.visible = true;
    burst.age = 0;
    burst.duration = settings.duration;
    burst.radius = settings.radius;
    burst.seed = this.sequence++;
    burst.attribute = attribute;
    burst.surface = surface;
    burst.density = density;
    burst.glow.color.setHex(magic.color);
    burst.waveMat.color.setHex(magic.color);
    burst.sparkMat.color.setHex(magic.color);
    burst.chipMat.color.setHex(surface === 'barrier' ? magic.color : profile.color);
    burst.chipMat.emissive.setHex(surface === 'barrier' ? magic.secondary : 0);
    burst.dustMat.color.setHex(attribute === 'shadow' ? magic.secondary : profile.dust);
    tintSpell(burst.glow,attribute);
    tintSpell(burst.sparkMat,attribute);
    burst.debris.count = Math.max(2, Math.floor(profile.debris * settings.density * density));
    burst.sparks.count = Math.max(2, Math.floor(profile.sparks * settings.density * density));
    burst.dust.count = level >= 3 && density > 0.5 ? 4 : 2;
    this.animateBurst(burst);
    if(!leaveMark)return;
    const mark = this.marks[this.nextMark++ % (this.lowQuality ? 6 : 12)];
    mark.group.position.copy(position).addScaledVector(this.normal, 0.006);
    mark.group.quaternion.copy(burst.group.quaternion);
    mark.group.scale.setScalar(settings.radius * 0.9);
    mark.group.visible = true;
    mark.age = 0;
    mark.life = profile.markLife;
    mark.cracks.visible = !slash && surface !== 'metal' && surface !== 'barrier';
    mark.slash.visible = slash;
    mark.slash.rotation.z = (burst.seed * 1.73) % Math.PI;
    mark.cracks.rotation.z = (burst.seed * 0.37) % Math.PI;
    mark.scorch.visible = !slash;
    mark.ink.color.setHex(profile.mark);
    mark.burn.color.setHex(attribute === 'fire' ? 0x20100c : profile.mark);
    mark.ink.opacity = 0.9;
    mark.burn.opacity = attribute === 'fire' ? 0.3 : 0.12;
  }

  update(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    for (const burst of this.bursts) {
      if (!burst.group.visible) continue;
      burst.age += delta;
      if (burst.age >= burst.duration) { burst.group.visible = false; continue; }
      this.animateBurst(burst);
    }
    for (const mark of this.marks) {
      if (!mark.group.visible) continue;
      mark.age += delta;
      const fade = Math.min(1, (mark.life - mark.age) / Math.min(2, mark.life));
      if (fade <= 0) { mark.group.visible = false; continue; }
      mark.ink.opacity = fade * 0.9;
      mark.burn.opacity = fade * 0.24;
    }
  }

  reset(): void {
    for (const burst of this.bursts) {
      burst.age = burst.duration;
      burst.group.visible = false;
    }
    for (const mark of this.marks) {
      mark.age = mark.life;
      mark.group.visible = false;
    }
    this.nextBurst = this.nextMark = this.sequence = 0;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const burst of this.bursts) { burst.debris.dispose(); burst.sparks.dispose(); burst.dust.dispose(); }
    this.root.clear();
  }

  private lightMaterial(kind: 'flare'|'sigil'|'ribbon' = 'sigil'): MeshBasicMaterial {
    const material = spellMaterial(kind);
    this.materials.push(material);
    return material;
  }

  private animateBurst(burst: Burst): void {
    const t = burst.age;
    const fraction = t / burst.duration;
    const fade = 1 - fraction;
    const radius = burst.radius;
    const wind = burst.attribute === 'wind';
    const flashScale = radius * (0.18 + Math.min(t, 0.12) * 1.8);
    burst.flash.scale.set(flashScale*2.6,flashScale*2.6,1);
    burst.flash.rotation.z = t * 9;
    burst.glow.opacity = Math.max(0, 1 - t * 7) * 0.85;
    burst.flash.visible = burst.glow.opacity > 0;
    burst.wave.scale.set(radius*(.4+Math.sqrt(fraction)*2),radius*(.12+fraction*.5),1);
    burst.wave.position.z = 0.015 + t * 0.025;
    burst.waveMat.opacity = Math.max(0,.25-t*1.6);
    burst.chipMat.opacity = Math.min(1, fade * 4);
    burst.sparkMat.opacity = fade * fade;
    burst.dustMat.opacity = IMPACT_PROFILES[burst.surface].dustOpacity * Math.sin(Math.PI * fraction);
    clockSpell(burst.dustMat,t+burst.seed);
    clockSpell(burst.glow,t);
    clockSpell(burst.sparkMat,t);
    for (let i = 0; i < burst.debris.count; i++) {
      const angle = i * 2.39996 + burst.seed * 0.83 + (wind ? t * 2 : 0);
      const speed = radius * (0.55 + (i % 4) * 0.18);
      const size = radius * (0.035 + (i % 3) * 0.015) * Math.min(1, fade * 3);
      this.stamp.position.set(Math.cos(angle) * speed * t, Math.sin(angle) * speed * t,
        radius * (0.7 + (i % 5) * 0.19) * t);
      this.stamp.position.addScaledVector(burst.gravity, t * t * 0.5);
      this.stamp.position.z = Math.max(size * 0.5, this.stamp.position.z);
      this.stamp.rotation.set(t * (3 + i), angle + t * 2, t * 4);
      this.stamp.scale.set(size, size * (burst.surface === 'wood' ? 3 : 0.8), size * 0.7);
      this.stamp.updateMatrix();
      burst.debris.setMatrixAt(i, this.stamp.matrix);
    }
    burst.debris.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < burst.sparks.count; i++) {
      const angle = i * 2.39996 + burst.seed + (wind ? t * 3 : 0);
      const speed = radius * (0.6 + (i % 5) * 0.13);
      this.stamp.position.set(Math.cos(angle) * speed * t, Math.sin(angle) * speed * t,
        0.025 + t * radius * (0.5 + (i % 3) * 0.3));
      if (burst.attribute === 'fire') this.stamp.position.addScaledVector(burst.gravity, -t * 0.16);
      this.stamp.rotation.set(angle, angle, 0);
      this.stamp.scale.set(radius * 0.02 * fade, radius * 0.012 * fade, radius * (wind ? 0.16 : 0.07));
      this.stamp.updateMatrix();
      burst.sparks.setMatrixAt(i, this.stamp.matrix);
    }
    burst.sparks.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < burst.dust.count; i++) {
      const angle = i * 1.5708 + burst.seed;
      this.stamp.position.set(Math.cos(angle) * radius * fraction * 0.5, Math.sin(angle) * radius * fraction * 0.5,
        radius * (0.09 + fraction * 0.2));
      if (burst.attribute !== 'wind') this.stamp.position.addScaledVector(burst.gravity, -t * 0.045);
      this.stamp.quaternion.copy(burst.group.quaternion).invert().multiply(this.view);this.stamp.rotateZ(angle+t*.15);
      this.stamp.scale.setScalar(radius * (0.35 + fraction * 0.70));
      this.stamp.updateMatrix();
      burst.dust.setMatrixAt(i, this.stamp.matrix);
    }
    burst.dust.instanceMatrix.needsUpdate = true;
  }
}

function finiteVector(vector: Vector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function crackGeometry(): BufferGeometry {
  const positions: number[] = [];
  const stroke = (ax: number, ay: number, bx: number, by: number, width: number) => {
    const length = Math.hypot(bx - ax, by - ay);
    const dx = -(by - ay) / length * width;
    const dy = (bx - ax) / length * width;
    positions.push(ax - dx, ay - dy, 0, bx - dx, by - dy, 0, bx + dx, by + dy, 0,
      ax - dx, ay - dy, 0, bx + dx, by + dy, 0, ax + dx, ay + dy, 0);
  };
  for (let branch = 0; branch < 7; branch++) {
    const angle = branch * Math.PI * 2 / 7;
    let x = 0;
    let y = 0;
    for (let segment = 1; segment <= 4; segment++) {
      const direction = angle + Math.sin(branch * 9 + segment * 4) * 0.18;
      const bx = Math.cos(direction) * segment * 0.21;
      const by = Math.sin(direction) * segment * 0.21;
      stroke(x, y, bx, by, 0.018 - segment * 0.003);
      if (segment === 2) stroke(bx, by, bx + Math.cos(direction + 0.75) * 0.2,
        by + Math.sin(direction + 0.75) * 0.2, 0.006);
      x = bx;
      y = by;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function slashGeometry(): BufferGeometry {
  const positions = [
    -0.8, -0.04, 0, 0.75, -0.01, 0, 0.3, 0.055, 0,
    -0.8, -0.04, 0, 0.3, 0.055, 0, -0.45, 0.025, 0,
    -0.5, -0.08, 0, 0.6, -0.055, 0, -0.15, -0.06, 0,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
