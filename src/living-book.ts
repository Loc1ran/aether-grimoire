import {
  AssetManager, BufferGeometry, CanvasTexture, Color, DoubleSide, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PlaneGeometry, PointLight, Quaternion, SRGBColorSpace, Vector3,
} from '@iwsdk/core';
import { GRIMOIRES, type MagicAttribute } from './combat-data.js';
import { clockSpell, spellMaterial, tintSpell } from './spell-material.js';
import { SmokeVolume } from './smoke-volume.js';

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
  private readonly wispGeometry = new PlaneGeometry(1,1);
  private readonly tint = new Color();
  private attribute: MagicAttribute = 'shadow';
  private selected = -1;
  private title = 'The Umbral Grimoire';
  private instruction = 'Your intent awakens the pages.';
  private turn = 2;
  private energy = 0;
  private readonly manuscript:CanvasImageSource;
  private readonly smoke=new SmokeVolume(12,0x68665f);
  private readonly localView=new Quaternion();
  private readonly rising=new Vector3();
  private readonly pageLight=new PointLight(0xe8ba78,0,.65,2);

  constructor(private readonly root: Object3D) {
    const manuscript=AssetManager.getTexture('manuscript');
    if(!manuscript?.image)throw new Error('The manuscript texture must be loaded before opening the grimoire.');
    this.manuscript=manuscript.image as CanvasImageSource;
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
      material.side = DoubleSide; material.emissive.setHex(0x000000);material.bumpMap=texture;material.bumpScale=.00012;
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
    aura.add(this.smoke.mesh);this.pageLight.position.set(0,0,.07);aura.add(this.pageLight);
    for(let i=0;i<10;i++) {
      const material=spellMaterial('flare',0);
      const wisp=new Mesh(this.wispGeometry,material); wisp.name=`PageEmber${i}`;
      aura.add(wisp);this.wisps.push(wisp);
    }
    this.setAttribute('shadow'); this.setPage(0,this.title,this.instruction);
  }

  setAttribute(attribute: MagicAttribute): void {
    this.attribute=attribute; this.tint.setHex(GRIMOIRES[attribute].color);
    for(let i=0;i<this.wisps.length;i++) tintSpell(this.wisps[i].material,attribute,i>=4);
    if(this.canvases.length===2) this.paint();
  }

  setPage(page: number, title: string, instruction: string): void {
    if(this.selected===page&&this.title===title&&this.instruction===instruction)return;
    this.turn=this.selected<0?2:0;
    this.selected=page;this.title=title;this.instruction=instruction;this.paint();
  }

  update(delta: number, time: number, reveal: number, opening: number, energized: number, view:Quaternion): void {
    const visible=Math.max(0,Math.min(1,reveal)), open=Math.max(0,Math.min(1,opening));
    this.energy+=(energized-this.energy)*(1-Math.exp(-delta*5));
    this.root.visible=visible>.002;
    this.root.scale.setScalar(Math.max(.001,visible*visible*(3-2*visible)));
    const fold=.12+1.45*(1-open);
    this.left.rotation.y=fold; this.right.rotation.y=-fold;
    this.localView.copy(this.root.getWorldQuaternion(this.localView)).invert();
    this.rising.set(0,1,0).applyQuaternion(this.localView);this.localView.multiply(view);
    this.smoke.setView(this.localView);this.smoke.mesh.visible=open>.2;
    this.pageLight.intensity=(.015+this.energy*.065)*open*visible;
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
    for(let i=0;i<12;i++) {
      const t=(time*.23+i/12)%1,angle=i*2.399,timeFade=Math.sin(t*Math.PI);
      const lift=t*(.1+this.energy*.09),x=Math.cos(angle)*(.06+t*.045),y=Math.sin(angle)*.11;
      this.smoke.particle(i,x+this.rising.x*lift,y+this.rising.y*lift,.026+this.rising.z*lift,.055+t*.10,i+t*.2,timeFade*(.035+this.energy*.10)*open*visible);
      if(i>=this.wisps.length)continue;
      const wisp=this.wisps[i];wisp.position.set(x*.55,y,.03).addScaledVector(this.rising,t*.20);
      wisp.quaternion.copy(this.localView);wisp.scale.setScalar(.002+this.energy*.003);
      wisp.material.opacity=timeFade*(.15+this.energy*.45)*open*visible;clockSpell(wisp.material,time);
    }
    this.smoke.commit();
  }

  dispose(): void {
    for(const material of this.materials)material.dispose();
    for(const texture of this.textures)texture.dispose();
    for(const geometry of this.leafGeometry)geometry.dispose();
    for(const wisp of this.wisps)wisp.material.dispose();
    this.wispGeometry.dispose();
    this.smoke.dispose();this.pageLight.dispose();
  }

  private require(name: string): Object3D {
    const object=this.root.getObjectByName(name);
    if(!object)throw new Error(`Living grimoire is missing ${name}`);
    return object;
  }

  private paint(): void {
    for(let side=0;side<2;side++) {
      const c=this.canvases[side];
      c.clearRect(0,0,768,1024);
      c.drawImage(this.manuscript,side*768,0,768,1024,0,0,768,1024);
      const gutter=c.createLinearGradient(side===0?690:0,0,side===0?768:78,0);
      gutter.addColorStop(0,side===0?'rgba(22,14,8,0)':'rgba(22,14,8,.5)');
      gutter.addColorStop(1,side===0?'rgba(22,14,8,.5)':'rgba(22,14,8,0)');
      c.fillStyle=gutter;c.fillRect(side===0?690:0,0,78,1024);
      c.textAlign='center';c.fillStyle='#392c20';c.font='small-caps 26px Georgia, serif';
      c.fillText(side===0?'LIBER AETHERIS':this.title.toUpperCase(),384,72,570);
      c.font='12px Georgia, serif';c.fillStyle='#754d31';
      c.fillText(side===0?'THE ASHEN TESTAMENT':this.attribute.toUpperCase()+' / '+String(Math.max(1,this.selected)).padStart(2,'0'),384,96);
      c.fillStyle='#332a21';c.font='20px Georgia, serif';
      const words=(side===0?'What the soul remembers, the hand makes real.':this.instruction).split(/\s+/u);
      let line='',y=930;
      for(const word of words) {
        const next=line?line+' '+word:word;
        if(c.measureText(next).width>560&&line){c.fillText(line,384,y);line=word;y+=25;}else line=next;
      }
      c.fillText(line,384,y);this.textures[side].needsUpdate=true;
    }
  }
}
