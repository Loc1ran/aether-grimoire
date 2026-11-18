import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending, Object3D, PlaneGeometry, Quaternion, Shape, Vector3 } from '@iwsdk/core';
import { clockSpell, spellMaterial } from './spell-material.js';
import { wedgeGeometry } from './scene-assets/lib/relic-forms.js';
import { SmokeVolume } from './smoke-volume.js';

export class SignatureVFX {
  readonly root=new Group();
  readonly vortex=new Group();
  readonly divider=new Group();
  private time=0;
  private readonly materials: MeshBasicMaterial[]=[];
  private readonly geometries: BufferGeometry[]=[];
  private readonly cuts: {root:Group;life:number;size:number;smoke:SmokeVolume}[]=[];
  private readonly cyclone=new SmokeVolume(36,0xbab7ad);
  private readonly view=new Quaternion();
  private readonly localView=new Quaternion();
  private readonly dividerSmoke=new SmokeVolume(10,0x85847f);
  private readonly dividerSteel=new MeshStandardMaterial({color:0x171d24,metalness:.86,roughness:.34});
  private readonly up=new Vector3(0,0,1);
  private readonly direction=new Vector3();
  private readonly rotation=new Quaternion();
  private readonly card=new PlaneGeometry(1,1);

  constructor() {
    this.root.name='SignatureMagic';this.geometries.push(this.card);
    for(let n=0;n<4;n++) {
      const cut=new Group();cut.name=`DimensionFracture${n}`;cut.visible=false;
      for(let i=0;i<3;i++) {
        const material=this.material(i===0?0xb98c67:i===1?0x090b0e:0xd6d7cf,'rift');
        if(i===1)material.blending=NormalBlending;
        const layer=new Mesh(this.card,material);layer.name=i===1?'BlackSpatialCut':'FractureEdge';
        layer.position.z=-i*.003;cut.add(layer);
      }
      const smoke=new SmokeVolume(18,0x686762);cut.add(smoke.mesh);
      this.cuts.push({root:cut,life:0,size:1,smoke});this.root.add(cut);
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
      const wind=new Mesh(geometry,this.material(i===0?0x727973:0xbfc5bf,'ribbon'));
      wind.name=`HelicalWindSheet${i}`;wind.rotation.y=i*Math.PI/2;wind.scale.setScalar(1-i*.09);this.vortex.add(wind);
    }
    this.vortex.add(this.cyclone.mesh);
    const chip=wedgeGeometry();this.geometries.push(chip);
    for(let i=0;i<12;i++) {
      const debris=new Mesh(chip,this.material(i%3===0?0x7c6b55:0x4c4e4a,'sigil'));
      debris.material.blending=NormalBlending;
      debris.name=`LiftedDebris${i}`;debris.scale.setScalar(.025+(i%3)*.015);this.vortex.add(debris);
    }
    const blade=new Shape();blade.moveTo(-.055,.12);blade.lineTo(-.13,1.45);blade.lineTo(-.04,1.95);blade.lineTo(.09,1.5);blade.lineTo(.055,.12);blade.closePath();
    const bladeGeometry=new ExtrudeGeometry(blade,{depth:.024,bevelEnabled:true,bevelThickness:.005,bevelSize:.004,bevelSegments:2,steps:1});
    bladeGeometry.translate(0,0,-.012);this.geometries.push(bladeGeometry);
    const steel=new Mesh(bladeGeometry,this.dividerSteel);steel.name='ForgedAntiMagicBlade';this.divider.add(steel,this.dividerSmoke.mesh);
    this.divider.name='BlackDivider';this.divider.visible=false;this.root.add(this.divider);
  }
  private material(color:number,kind:'rift'|'ribbon'|'sigil'):MeshBasicMaterial {
    const material=spellMaterial(kind);material.color.setHex(color);this.materials.push(material);return material;
  }
  setView(rotation:Quaternion):void { this.view.copy(rotation); }
  cut(origin:Vector3,forward:Vector3,sweep:Vector3,ultimate=false):void {
    const cut=this.cuts.find(c=>c.life<=0)??this.cuts[0];cut.life=.85;cut.size=ultimate?1.5:1;
    this.rotation.setFromUnitVectors(this.up,this.direction.copy(forward).normalize());
    cut.root.position.copy(origin).addScaledVector(forward,1.55);cut.root.quaternion.copy(this.rotation);
    this.direction.copy(sweep).applyQuaternion(this.rotation.invert());cut.root.rotateZ(Math.atan2(this.direction.y,this.direction.x));
    cut.root.visible=true;
  }
  blade(sword:Object3D,visible:boolean):void {
    this.divider.visible=visible;if(!visible)return;
    this.divider.position.copy(sword.position);this.divider.quaternion.copy(sword.quaternion);
    this.localView.copy(sword.quaternion).invert().multiply(this.view);this.dividerSmoke.setView(this.localView);
    for(let i=0;i<10;i++){const t=(this.time*.4+i/10)%1;this.dividerSmoke.particle(i,Math.sin(i*2.4)*.06,.15+t*1.75,Math.cos(i*2.4)*.04,.09+t*.16,i+t,Math.sin(t*Math.PI)*.25);}
    this.dividerSmoke.commit();
  }
  update(dt:number,vortexTime:number,center:Vector3):void {
    this.time+=dt;for(const material of this.materials)clockSpell(material,this.time);
    for(const cut of this.cuts) {
      cut.life=Math.max(0,cut.life-dt);cut.root.visible=cut.life>0;
      if(cut.life<=0)continue;
      const age=.85-cut.life,opening=1-Math.exp(-age*30),width=(.2+opening*3.6)*cut.size;
      for(let i=0;i<3;i++) {
        const layer=cut.root.children[i] as Mesh<BufferGeometry,MeshBasicMaterial>;
        layer.scale.set(width,(i===0?.65:i===1?.45:.035)*cut.size,1);
        layer.material.opacity=Math.max(0,1-age*(i===1?1.6:3.5));
      }
      this.localView.copy(cut.root.quaternion).invert().multiply(this.view);cut.smoke.setView(this.localView);
      for(let i=0;i<18;i++) {
        const u=i/17,fade=Math.sin(u*Math.PI)*Math.min(1,age*16)*Math.min(1,cut.life*2);
        cut.smoke.particle(i,(u-.5)*width,Math.sin(i*2.4)*age*.24,-.02-i*.002,(.12+age*.45)*cut.size,i+age*.3,fade*.25);
      }
      cut.smoke.commit();
    }
    this.vortex.visible=vortexTime>0;if(!this.vortex.visible)return;
    this.vortex.position.copy(center);this.vortex.position.y=.06;
    const fade=Math.min(1,vortexTime*2,Math.max(0,(3-vortexTime)*4));this.vortex.scale.setScalar(.8+fade*.2);
    for(let i=0;i<this.vortex.children.length;i++) {
      if(this.vortex.children[i]===this.cyclone.mesh)continue;
      const layer=this.vortex.children[i] as Mesh<BufferGeometry,MeshBasicMaterial>;
      layer.material.opacity=fade*(i<4?.10:.8);
      if(i<4)layer.rotation.y=this.time*(2.5+i*.3)+i*Math.PI/2;
      else {const t=(this.time*.45+i*.173)%1,a=this.time*4+i*2.399,r=.22+t*.45;layer.position.set(Math.cos(a)*r,t*1.6,Math.sin(a)*r);layer.rotation.set(a,t*5,a*.5);}
    }
    this.cyclone.setView(this.view);
    for(let i=0;i<36;i++) {
      const t=(this.time*.37+i/36)%1,a=this.time*(2.7-t)+i*2.399,r=.18+t*.62;
      this.cyclone.particle(i,Math.cos(a)*r,t*2.15,Math.sin(a)*r,.35+t*.85,a*.16,Math.sin(t*Math.PI)*fade*.36);
    }
    this.cyclone.commit();
  }
  reset():void { for(const cut of this.cuts){cut.life=0;cut.root.visible=false;}this.vortex.visible=this.divider.visible=false; }
  dispose():void { for(const cut of this.cuts)cut.smoke.dispose();this.cyclone.dispose();this.dividerSmoke.dispose();this.dividerSteel.dispose();for(const geometry of this.geometries)geometry.dispose();for(const material of this.materials)material.dispose(); }
}
