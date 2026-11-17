import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, NormalBlending, Object3D, PlaneGeometry, Quaternion, Shape, ShapeGeometry, Vector3 } from '@iwsdk/core';
import { clockSpell, spellMaterial } from './spell-material.js';
import { wedgeGeometry } from './scene-assets/lib/relic-forms.js';

export class SignatureVFX {
  readonly root=new Group();
  readonly vortex=new Group();
  readonly divider=new Group();
  private time=0;
  private readonly materials: MeshBasicMaterial[]=[];
  private readonly geometries: BufferGeometry[]=[];
  private readonly cuts: {root:Group;life:number;size:number}[]=[];
  private readonly up=new Vector3(0,0,1);
  private readonly direction=new Vector3();
  private readonly rotation=new Quaternion();
  private readonly card=new PlaneGeometry(1,1);

  constructor() {
    this.root.name='SignatureMagic';this.geometries.push(this.card);
    for(let n=0;n<4;n++) {
      const cut=new Group();cut.name=`DimensionFracture${n}`;cut.visible=false;
      for(let i=0;i<3;i++) {
        const material=this.material(i===0?0xff4369:i===1?0x05040b:0xe5d4ff,'rift');
        if(i===1)material.blending=NormalBlending;
        const layer=new Mesh(this.card,material);layer.name=i===1?'BlackSpatialCut':'FractureEdge';
        layer.scale.y=i===0?1:i===1?.5:.07;layer.position.z=i*.003;cut.add(layer);
      }
      this.cuts.push({root:cut,life:0,size:1});this.root.add(cut);
    }
    this.vortex.name='WindVortex';this.vortex.visible=false;this.root.add(this.vortex);
    const geometry=new BufferGeometry(),positions:number[]=[],uv:number[]=[],indices:number[]=[];
    for(let i=0;i<=96;i++) {
      const t=i/96,a=t*Math.PI*5,r=.10+t*.56;
      for(const side of [-1,1]){positions.push(Math.cos(a)*r,t*1.8+side*(.035+t*.1),Math.sin(a)*r);uv.push(t,(side+1)/2);}
      if(i<96){const p=i*2;indices.push(p,p+1,p+2,p+1,p+3,p+2);}
    }
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();this.geometries.push(geometry);
    for(let i=0;i<4;i++) {
      const wind=new Mesh(geometry,this.material(i===0?0x214c47:0x9dffe0,'ribbon'));
      wind.name=`HelicalWindSheet${i}`;wind.rotation.y=i*Math.PI/2;wind.scale.setScalar(1-i*.09);this.vortex.add(wind);
    }
    const chip=wedgeGeometry();this.geometries.push(chip);
    for(let i=0;i<12;i++) {
      const debris=new Mesh(chip,this.material(i%3===0?0xceba87:0x6e8581,'sigil'));
      debris.name=`LiftedDebris${i}`;debris.scale.setScalar(.025+(i%3)*.015);this.vortex.add(debris);
    }
    const blade=new Shape();blade.moveTo(-.055,.12);blade.lineTo(-.13,1.45);blade.lineTo(-.04,1.95);blade.lineTo(.09,1.5);blade.lineTo(.055,.12);blade.closePath();
    const bladeGeometry=new ShapeGeometry(blade,8);this.geometries.push(bladeGeometry);
    for(let i=0;i<2;i++) {
      const material=this.material(i===0?0xff2858:0x07050b,'sigil');if(i===1)material.blending=NormalBlending;
      const layer=new Mesh(bladeGeometry,material);layer.name=i?'AntiMagicBlade':'CrimsonCuttingEdge';layer.scale.x=i?1:1.13;layer.position.z=i*.002;this.divider.add(layer);
    }
    this.divider.name='BlackDivider';this.divider.visible=false;this.root.add(this.divider);
  }
  private material(color:number,kind:'rift'|'ribbon'|'sigil'):MeshBasicMaterial {
    const material=spellMaterial(kind);material.color.setHex(color);this.materials.push(material);return material;
  }
  cut(origin:Vector3,forward:Vector3,sweep:Vector3,ultimate=false):void {
    const cut=this.cuts.find(c=>c.life<=0)??this.cuts[0];cut.life=.65;cut.size=ultimate?1.5:1;
    this.rotation.setFromUnitVectors(this.up,this.direction.copy(forward).normalize());
    cut.root.position.copy(origin).addScaledVector(forward,1.55);cut.root.quaternion.copy(this.rotation);
    this.direction.copy(sweep).applyQuaternion(this.rotation.invert());cut.root.rotateZ(Math.atan2(this.direction.y,this.direction.x));
    cut.root.visible=true;
  }
  blade(sword:Object3D,visible:boolean):void {
    this.divider.visible=visible;if(!visible)return;
    this.divider.position.copy(sword.position);this.divider.quaternion.copy(sword.quaternion);
  }
  update(dt:number,vortexTime:number,center:Vector3):void {
    this.time+=dt;for(const material of this.materials)clockSpell(material,this.time);
    for(const cut of this.cuts) {
      cut.life=Math.max(0,cut.life-dt);cut.root.visible=cut.life>0;
      const age=.65-cut.life,opening=Math.min(1,age/.085);
      cut.root.scale.set((.2+opening*3.8)*cut.size,(.3+Math.sin(age*7)*.18)*cut.size,1);
      for(const child of cut.root.children)(child as Mesh<BufferGeometry,MeshBasicMaterial>).material.opacity=Math.min(1,cut.life*5);
    }
    this.vortex.visible=vortexTime>0;if(!this.vortex.visible)return;
    this.vortex.position.copy(center);this.vortex.position.y=.06;
    const fade=Math.min(1,vortexTime*2,Math.max(0,(3-vortexTime)*4));this.vortex.scale.setScalar(.8+fade*.2);
    for(let i=0;i<this.vortex.children.length;i++) {
      const layer=this.vortex.children[i] as Mesh<BufferGeometry,MeshBasicMaterial>;
      layer.material.opacity=fade*(i===0?.28:.65);
      if(i<4)layer.rotation.y=this.time*(2.5+i*.3)+i*Math.PI/2;
      else {const t=(this.time*.45+i*.173)%1,a=this.time*4+i*2.399,r=.22+t*.45;layer.position.set(Math.cos(a)*r,t*1.6,Math.sin(a)*r);layer.rotation.set(a,t*5,a*.5);}
    }
  }
  reset():void { for(const cut of this.cuts){cut.life=0;cut.root.visible=false;}this.vortex.visible=this.divider.visible=false; }
  dispose():void { for(const geometry of this.geometries)geometry.dispose();for(const material of this.materials)material.dispose(); }
}
