import {
  BufferGeometry, CanvasTexture, Color, DoubleSide, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, SRGBColorSpace,
} from '@iwsdk/core';
import { GRIMOIRES, type MagicAttribute } from './combat-data.js';
import { flowRibbon } from './scene-assets/lib/magic-surfaces.js';
import { clockSpell, spellMaterial, tintSpell } from './spell-material.js';

export function leafTurnProgress(time: number, index: number): number {
  const t = Math.max(0, Math.min(1, time - index * 0.14));
  return t * t * (3 - 2 * t);
}

/** Presentation of the articulated asset; combat continues to own all player intent. */
export class LivingBook {
  private readonly left: Object3D;
  private readonly right: Object3D;
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly pageMaterials: MeshStandardMaterial[] = [];
  private readonly canvases: CanvasRenderingContext2D[] = [];
  private readonly textures: CanvasTexture[] = [];
  private readonly leaves: Object3D[] = [];
  private readonly leafGeometry: BufferGeometry[] = [];
  private readonly leafRest: Float32Array[] = [];
  private readonly wisps: Mesh<BufferGeometry, MeshBasicMaterial>[] = [];
  private readonly wispGeometry = flowRibbon(0.6, 0.1, 0.5);
  private readonly tint = new Color();
  private attribute: MagicAttribute = 'shadow';
  private selected = -1;
  private title = 'The Umbral Codex';
  private instruction = 'Your intent awakens the pages.';
  private turn = 2;
  private energy = 0;

  constructor(private readonly root: Object3D) {
    this.left = this.require('CoverLeft'); this.right = this.require('CoverRight');
    for (const name of ['Control_Next','Control_Prev','Control_Seal','SealRing','Halo',
      'StampEmber','StampGale','StampTide','StampVeil','MoteEmber','MoteGale','MoteTide','MoteVeil']) this.require(name).visible = false;
    for (const name of ['PageLeft', 'PageRight']) {
      const page = this.require(name) as Mesh;
      const material = (page.material as MeshStandardMaterial).clone();
      const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot paint the grimoire parchment.');
      const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4; texture.flipY = false;
      // glTF UVs use the top-left image convention.
      material.map = texture; material.color.set(0xffffff); material.roughness = 0.86;
      material.side = DoubleSide; material.emissive.setHex(0x000000);
      page.material = material;
      this.materials.push(material); this.pageMaterials.push(material);
      this.canvases.push(ctx); this.textures.push(texture);
    }
    for (let i=0;i<3;i++) {
      const leaf=this.require(`TurningLeaf${i}`), sheet=this.require(`TurningSheet${i}`) as Mesh;
      sheet.geometry=sheet.geometry.clone();sheet.material=this.pageMaterials[i%2];
      this.leaves.push(leaf); this.leafGeometry.push(sheet.geometry);
      this.leafRest.push(new Float32Array(sheet.geometry.attributes.position.array));leaf.visible=false;
    }
    const aura=this.require('Aura');
    for(let i=0;i<10;i++) {
      const material=spellMaterial(i%3===0?'mist':'ribbon',0);
      const wisp=new Mesh(this.wispGeometry,material); wisp.name=`FlowingPageInk${i}`;
      aura.add(wisp);this.wisps.push(wisp);
    }
    this.setAttribute('shadow'); this.setPage(0,this.title,this.instruction);
  }

  setAttribute(attribute: MagicAttribute): void {
    this.attribute=attribute; this.tint.setHex(GRIMOIRES[attribute].color);
    for(let i=0;i<this.wisps.length;i++) tintSpell(this.wisps[i].material,attribute,i%3===0);
    if(this.canvases.length===2) this.paint();
  }

  setPage(page: number, title: string, instruction: string): void {
    if(this.selected===page&&this.title===title&&this.instruction===instruction)return;
    this.turn=this.selected<0?2:0;
    this.selected=page;this.title=title;this.instruction=instruction;this.paint();
  }

  update(delta: number, time: number, reveal: number, opening: number, energized: number): void {
    const visible=Math.max(0,Math.min(1,reveal)), open=Math.max(0,Math.min(1,opening));
    this.energy+=(energized-this.energy)*(1-Math.exp(-delta*5));
    this.root.visible=visible>.002;
    this.root.scale.setScalar(Math.max(.001,visible*visible*(3-2*visible)));
    const fold=.12+1.45*(1-open);
    this.left.rotation.y=fold; this.right.rotation.y=-fold;
    this.turn=Math.min(2,this.turn+delta*1.55*GRIMOIRES[this.attribute].pageSpeed);
    for(let i=0;i<3;i++) {
      const p=leafTurnProgress(this.turn,i), leaf=this.leaves[i];
      leaf.visible=p>0&&p<1&&open>.75;
      if(!leaf.visible)continue;
      leaf.rotation.y=-(Math.PI-fold*2)*p;
      const positions=this.leafGeometry[i].attributes.position, rest=this.leafRest[i];
      for(let j=0;j<positions.count;j++) {
        const u=Math.max(0,Math.min(1,(rest[j*3]-.009)/.186));
        positions.setZ(j,rest[j*3+2]+Math.sin(u*Math.PI)*Math.sin(p*Math.PI)*.047+u*u*Math.sin(p*Math.PI*2)*.012);
      }
      positions.needsUpdate=true;this.leafGeometry[i].computeVertexNormals();
    }
    const speed=this.attribute==='wind'?1.2:this.attribute==='fire'?.9:.48;
    for(let i=0;i<this.wisps.length;i++) {
      const wisp=this.wisps[i], cycle=(time*speed*.3+i*.173)%1;
      const a=i*2.399+cycle*(this.attribute==='wind'?4:1), reach=.025+cycle*.09;
      wisp.position.set(Math.cos(a)*reach,Math.sin(a)*reach*.6,.015+cycle*.14);
      wisp.rotation.set(Math.sin(a)*.4,Math.cos(a)*.4,a+time*speed*.2);
      wisp.scale.set(.08+cycle*.1,.065+cycle*.06,.06+cycle*.14);
      wisp.material.opacity=Math.sin(cycle*Math.PI)*(.08+this.energy*.35)*open*visible;
      clockSpell(wisp.material,time+i*.2);
    }
  }

  dispose(): void {
    for(const material of this.materials)material.dispose();
    for(const texture of this.textures)texture.dispose();
    for(const geometry of this.leafGeometry)geometry.dispose();
    for(const wisp of this.wisps)wisp.material.dispose();
    this.wispGeometry.dispose();
  }

  private require(name: string): Object3D {
    const object=this.root.getObjectByName(name);
    if(!object)throw new Error(`Living grimoire is missing ${name}`);
    return object;
  }

  private paint(): void {
    for(let side=0;side<2;side++) {
      const c=this.canvases[side], paper=c.createRadialGradient(390,480,80,384,512,650);
      paper.addColorStop(0,'#f3e8ca');paper.addColorStop(.7,'#e3d1a5');paper.addColorStop(1,'#b29a6a');
      c.fillStyle=paper;c.fillRect(0,0,768,1024);c.globalAlpha=.07;c.fillStyle='#674d2c';
      for(let i=0;i<1600;i++)c.fillRect((i*137)%768,(i*251)%1024,1+(i%3),1);
      c.globalAlpha=1;c.strokeStyle='#9d8357';c.lineWidth=1;c.strokeRect(40,42,688,940);c.strokeRect(51,53,666,918);
      c.textAlign='center';c.fillStyle='#352c29';c.font='small-caps 30px Georgia, serif';
      c.fillText(side===0?'LIBER · AETHERIS':this.title.toUpperCase(),384,111,590);
      c.font='14px Georgia, serif';c.fillStyle='#877044';c.fillText(side===0?'THE THREEFOLD TESTAMENT':`ARS ${String(Math.max(1,this.selected)).padStart(2,'0')}  /  ${this.attribute.toUpperCase()}`,384,145);
      c.save();c.translate(384,side===0?425:395);c.strokeStyle=side===0?'#665137':`#${this.tint.getHexString()}`;
      for(let ring=0;ring<3;ring++) {c.lineWidth=ring===1?2:1;c.beginPath();c.arc(0,0,138+ring*17,0,Math.PI*2);c.stroke();}
      for(let i=0;i<24;i++) {
        c.save();c.rotate(i*Math.PI/12);c.beginPath();c.moveTo(0,-157);c.lineTo(0,-167);c.stroke();
        if(i%3===0){c.font='18px Georgia';c.fillText(['✦','·','III','V'][i%4],0,-182);}c.restore();
      }
      const lobes=this.attribute==='wind'?6:this.attribute==='fire'?3:4;
      for(let i=0;i<lobes;i++) {
        c.save();c.rotate(i*Math.PI*2/lobes);c.beginPath();c.moveTo(0,105);
        c.bezierCurveTo(-110,-35,-55,-140,0,-112);c.bezierCurveTo(55,-140,110,-35,0,105);c.stroke();c.restore();
      }
      c.fillStyle='#5d4734';c.beginPath();c.arc(0,0,19,0,Math.PI*2);c.fill();c.restore();
      c.textAlign='left';c.strokeStyle='#8c7552';c.lineWidth=1.1;c.globalAlpha=.65;
      for(let row=0;row<8;row++) {
        const y=650+row*23;
        for(let col=0;col<19;col++) {
          const x=102+col*30, n=(row*7+col*11+side*3)%7;
          c.beginPath();c.moveTo(x,y);c.lineTo(x+4,y-5-n);c.lineTo(x+9,y-3);c.lineTo(x+12,y-8);c.stroke();
          if(n<3){c.beginPath();c.moveTo(x+3,y-4);c.lineTo(x+11,y-4);c.stroke();}
        }
      }
      c.globalAlpha=1;c.textAlign='center';c.fillStyle='#42382d';c.font='21px Georgia, serif';
      const words=(side===0?'What the soul remembers, the hand makes real.':this.instruction).split(/\s+/u);
      let line='', y=882;
      for(const word of words) {
        const next=line?`${line} ${word}`:word;
        if(c.measureText(next).width>550&&line){c.fillText(line,384,y);line=word;y+=27;}else line=next;
      }
      c.fillText(line,384,y);c.font='16px Georgia, serif';c.fillStyle='#8c7552';
      c.fillText(side===0?'—  I  —':`—  ${Math.max(1,this.selected+1)}  —`,384,950);this.textures[side].needsUpdate=true;
    }
  }
}
