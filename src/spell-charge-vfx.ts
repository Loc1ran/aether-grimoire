import { BufferGeometry, Group, Mesh, MeshBasicMaterial, NormalBlending, OctahedronGeometry, PlaneGeometry, RingGeometry } from '@iwsdk/core';
import { type MagicAttribute, type SpellId } from './combat-data.js';
import { crescentSurface, flowRibbon } from './scene-assets/lib/magic-surfaces.js';
import { clockSpell, spellMaterial, tintSpell, type SpellSurface } from './spell-material.js';

/** A persistent pool: selecting a skill never creates meshes in the frame loop. */
export class SpellChargeVFX {
  readonly root = new Group();
  readonly forms: Record<Exclude<SpellId, 'shield'>, Group> = {
    bolt: new Group(), slash: new Group(), blast: new Group(), blades: new Group(), thunder: new Group(),
  };
  private readonly card = new PlaneGeometry(1, 1);
  private readonly lance = flowRibbon(0, 0, .26);
  private readonly helix = flowRibbon(1.3, .22, .2);
  private readonly crescent = crescentSurface();
  private readonly shard = new OctahedronGeometry(1);
  private readonly ring = new RingGeometry(.88, 1, 64);
  private readonly materials: MeshBasicMaterial[] = [];
  private readonly ids = ['bolt', 'slash', 'blast', 'blades', 'thunder'] as const;

  constructor() {
    for (const spell of this.ids) {
      const form = this.forms[spell]; form.name = `${spell}Charge`; form.visible = false; this.root.add(form);
    }
    const bolt = this.forms.bolt;
    for (let i = 0; i < 3; i++) {
      const spear = this.mesh(bolt, this.lance, 'ribbon', `RuneSpear${i}`);
      spear.rotation.z = i * Math.PI / 3; spear.scale.set(.55, .55, .48);
    }
    for (let i = 0; i < 2; i++) {
      const ring = this.mesh(bolt, this.card, 'mandala', `AcceleratorSeal${i}`);
      ring.scale.setScalar(.25 - i * .06); ring.position.z = -.13 + i * .12;
    }
    const slash = this.forms.slash;
    for (let i = 0; i < 3; i++) {
      const blade = this.mesh(slash, this.crescent, i === 0 ? 'ink' : 'edge', `CrescentBlade${i}`);
      blade.scale.set(.52, .52, .52); blade.position.set(0, -i * .024, -i * .018);
    }
    const blast = this.forms.blast;
    for (let i = 0; i < 3; i++) {
      const core = this.mesh(blast, this.card, 'nova', `AstralCore${i}`);
      core.rotation.y = i * Math.PI / 3; core.scale.setScalar(.30);
    }
    for (let i = 0; i < 3; i++) {
      const ribbon = this.mesh(blast, this.helix, 'ribbon', `AccretionRibbon${i}`);
      ribbon.rotation.set(i * Math.PI / 3, .7, i * 2.094); ribbon.scale.set(.65, .65, .40);
    }
    const blades = this.forms.blades;
    for (let i = 0; i < 5; i++) {
      const crystal = this.mesh(blades, this.shard, 'sigil', `ObsidianShard${i}`);
      crystal.scale.set(.028, .10 + (i % 2) * .035, .028);
      crystal.material.blending = NormalBlending;
      const edge = new Mesh(this.shard, spellMaterial('sigil', .85));
      edge.name = `ShardEmberEdge${i}`; edge.material.color.setHex(0xff8b30); edge.material.wireframe = true;
      edge.scale.setScalar(1.035); this.materials.push(edge.material); crystal.add(edge);
    }
    const crown = this.mesh(blades, this.card, 'mandala', 'EruptionSeal');
    crown.scale.setScalar(.40); crown.rotation.x = -Math.PI / 2; crown.position.y = -.09;
    const thunder = this.forms.thunder;
    for (let i = 0; i < 4; i++) {
      const arc = this.mesh(thunder, this.card, 'storm', `LightningFork${i}`);
      arc.scale.set(.17, .43, 1); arc.rotation.y = i * Math.PI / 4;
    }
    for (let i = 0; i < 2; i++) {
      const halo = this.mesh(thunder, this.ring, 'sigil', `StormHalo${i}`);
      halo.scale.setScalar(.11 + i * .035); halo.rotation.x = Math.PI / 2;
    }
    this.root.visible = false;
  }

  private mesh(parent: Group, geometry: BufferGeometry, kind: SpellSurface, name: string): Mesh<BufferGeometry, MeshBasicMaterial> {
    const material = spellMaterial(kind); this.materials.push(material);
    const mesh = new Mesh(geometry, material); mesh.name = name; parent.add(mesh); return mesh;
  }

  update(spell: SpellId | null, attribute: MagicAttribute, charge: number, time: number): void {
    this.root.visible = spell !== null && spell !== 'shield' && charge > 0;
    for (const id of this.ids) this.forms[id].visible = id === spell && this.root.visible;
    if (!this.root.visible || !spell || spell === 'shield') return;
    const form = this.forms[spell], amount = Math.min(1, Math.max(0, charge));
    const pulse = 1 + Math.sin(time * 5) * .035;
    this.root.scale.setScalar((.65 + amount * .35) * pulse);
    form.rotation.set(0, 0, 0);
    for (let i = 0; i < form.children.length; i++) {
      const mesh = form.children[i] as Mesh<BufferGeometry, MeshBasicMaterial>;
      tintSpell(mesh.material, attribute, spell === 'slash' && i === 0);
      clockSpell(mesh.material, time + i * .37);
      mesh.material.opacity = .65 + amount * .3;
      if (spell === 'bolt') {
        mesh.material.opacity = i < 3 ? .65 : .8;
        mesh.rotation.z = time * (i < 3 ? 2 : i === 3 ? -.8 : 1.1) + i * Math.PI / 3;
        if (i < 3) mesh.scale.z = .32 + amount * .22;
      } else if (spell === 'slash') {
        form.rotation.z = -.35 + Math.sin(time * 1.7) * .1;
        mesh.position.y = -i * (.018 + Math.sin(time * 3) * .006);
        mesh.material.opacity = i === 0 ? .95 : i === 1 ? .95 : .35;
      } else if (spell === 'blast') {
        mesh.material.opacity = i < 3 ? .5 : .75;
        mesh.rotation.z = time * (i % 2 ? 1.6 : -1.3) + i * 2.094;
        if (i >= 3) mesh.rotation.y = time * .7 + i;
      } else if (spell === 'blades') {
        mesh.material.color.setHex(i < 5 ? 0x29182c : 0xff692d);
        mesh.material.opacity = i < 5 ? 1 : .85;
        if (i < 5) {
          const angle = time * .85 + i * Math.PI * 2 / 5;
          mesh.position.set(Math.cos(angle) * .105, Math.sin(time * 3 + i) * .025, Math.sin(angle) * .105);
          mesh.rotation.set(.18 * Math.sin(angle), -angle, .18 * Math.cos(angle));
        } else mesh.rotation.z = -time * .35;
      } else {
        mesh.material.color.setHex(i < 4 ? 0x9deaff : 0x66aaff);
        if (i < 4) {
          mesh.rotation.z = Math.sin(time * 2 + i) * .25;
          mesh.material.opacity = .7 + .22 * Math.sin(time * 9 + i * 1.7);
        } else {
          mesh.position.y = Math.sin(time * 2 + i * Math.PI) * .11;
          mesh.rotation.y = time * (i === 4 ? .8 : -.8);
        }
      }
    }
  }

  dispose(): void {
    for (const geometry of [this.card, this.lance, this.helix, this.crescent, this.shard, this.ring]) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
