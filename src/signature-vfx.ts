import { AdditiveBlending, BufferGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending, Object3D, PlaneGeometry, Quaternion, RingGeometry, Shape, Vector3 } from '@iwsdk/core';
import { clockSpell, spellMaterial } from './spell-material.js';
import { wedgeGeometry } from './scene-assets/lib/relic-forms.js';
import { SmokeVolume } from './smoke-volume.js';

interface EarthSpike {
  root: Group;
  outer: Mesh;
  inner: Mesh;
  origin: Vector3;
  tilt: number;
  yaw: number;
  delay: number;
  active: boolean;
}

export class SignatureVFX {
  readonly root=new Group();
  readonly vortex=new Group();
  readonly divider=new Group();
  readonly spikesRoot=new Group();
  readonly lightningRoot=new Group();
  private time=0;
  private readonly materials: (MeshBasicMaterial|MeshStandardMaterial)[]=[];
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

  // Earth Spikes state
  private readonly earthSpikes: EarthSpike[]=[];
  private spikesAge=0;
  private spikesActive=false;
  private readonly spikesSmoke=new SmokeVolume(28,0x4e463d);
  private readonly spikeNormal=new Vector3(0,1,0);
  private readonly spikeSide=new Vector3();

  // Sky Lightning state
  private lightningLife=0;
  private readonly lightningBolt: Group=new Group();
  private readonly lightningCoreMat=new MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,blending:AdditiveBlending,depthWrite:false,toneMapped:false});
  private readonly lightningAuraMat=new MeshBasicMaterial({color:0x70bbff,transparent:true,opacity:0,blending:AdditiveBlending,depthWrite:false,toneMapped:false});
  private readonly lightningRingMat=new MeshBasicMaterial({color:0x99ddff,transparent:true,opacity:0,blending:AdditiveBlending,side:DoubleSide,depthWrite:false,toneMapped:false});
  private readonly lightningRing: Mesh;

  constructor() {
    this.root.name='SignatureMagic';this.geometries.push(this.card);
    for(let n=0;n<4;n++) {
      const cut=new Group();cut.name=`DimensionFracture${n}`;cut.visible=false;
      for(let i=0;i<3;i++) {
        const material=this.material(i===0?0xab67ff:i===1?0x090b0e:0xead7ff,'rift');
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
      const wind=new Mesh(geometry,this.material(i===0?0x39cba7:0xa1ffe5,'ribbon'));
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

    // Build Earth Spikes
    this.spikesRoot.name='EarthSpikes';this.root.add(this.spikesRoot);
    const outerGeo=new CylinderGeometry(0.02,0.24,1.8,5);outerGeo.translate(0,0.9,0);this.geometries.push(outerGeo);
    const innerGeo=new CylinderGeometry(0.025,0.25,1.82,5);innerGeo.translate(0,0.91,0);this.geometries.push(innerGeo);
    const spikeSteelMat=new MeshStandardMaterial({color:0x15181e,roughness:0.36,metalness:0.75});
    const spikeRuneMat=new MeshBasicMaterial({color:0xff9b38,transparent:true,opacity:0.85,blending:AdditiveBlending,wireframe:true,depthWrite:false,toneMapped:false});
    this.materials.push(spikeSteelMat,spikeRuneMat);
    for(let i=0;i<8;i++) {
      const group=new Group();group.name=`ObsidianSpike${i}`;group.visible=false;
      const outer=new Mesh(outerGeo,spikeSteelMat);
      const inner=new Mesh(innerGeo,spikeRuneMat);
      group.add(outer,inner);
      this.spikesRoot.add(group);
      this.earthSpikes.push({
        root:group,outer,inner,origin:new Vector3(),tilt:0,yaw:0,delay:0,active:false,
      });
    }
    this.spikesRoot.add(this.spikesSmoke.mesh);

    // Build Sky Lightning
    this.lightningRoot.name='SkyLightning';this.lightningRoot.visible=false;this.root.add(this.lightningRoot);
    const lightningGeo=this.buildLightningGeometry();this.geometries.push(lightningGeo);
    const coreMesh=new Mesh(lightningGeo,this.lightningCoreMat);coreMesh.name='LightningCore';
    const auraMesh=new Mesh(lightningGeo,this.lightningAuraMat);auraMesh.name='LightningAura';auraMesh.scale.set(1.4,1,1.4);
    this.lightningBolt.add(coreMesh,auraMesh);
    const ringGeo=new RingGeometry(1.45,1.6,64);ringGeo.rotateX(-Math.PI/2);this.geometries.push(ringGeo);
    this.lightningRing=new Mesh(ringGeo,this.lightningRingMat);this.lightningRing.position.y=0.02;this.lightningRing.name='ThunderShockwaveRing';
    this.lightningRoot.add(this.lightningBolt,this.lightningRing);
    const seal=new Mesh(this.card,this.material(0x6aaaff,'mandala'));
    seal.name='HeavenJudgementSeal';seal.rotation.x=-Math.PI/2;seal.scale.setScalar(2.5);seal.position.y=.025;
    this.lightningRoot.add(seal);
    this.materials.push(this.lightningCoreMat,this.lightningAuraMat,this.lightningRingMat);
  }

  private buildLightningGeometry():BufferGeometry {
    const geo=new BufferGeometry();
    const pts: [number,number,number][]=[
      [0,4.8,0],[0.16,4.1,-0.12],[-0.22,3.4,0.15],[0.24,2.7,-0.10],
      [-0.18,2.0,0.16],[0.15,1.3,-0.12],[-0.12,0.7,0.08],[0,0.0,0],
    ];
    // Secondary fork branching from point 3
    const forkPts: [number,number,number][]=[
      [0.24,2.7,-0.10],[0.55,2.1,-0.20],[0.85,1.5,-0.28],
    ];
    const positions:number[]=[];const uvs:number[]=[];const indices:number[]=[];
    const addSegmentStrip=(p1:[number,number,number],p2:[number,number,number],w:number,axis:'xy'|'zy')=>{
      const base=positions.length/3;
      const dx=axis==='xy'?w:0, dz=axis==='zy'?w:0;
      positions.push(
        p1[0]-dx,p1[1],p1[2]-dz,
        p1[0]+dx,p1[1],p1[2]+dz,
        p2[0]-dx,p2[1],p2[2]-dz,
        p2[0]+dx,p2[1],p2[2]+dz,
      );
      uvs.push(0,0, 1,0, 0,1, 1,1);
      indices.push(base,base+1,base+2, base+1,base+3,base+2);
    };
    for(let i=0;i<pts.length-1;i++){
      const w=0.08*(1-i/pts.length*0.4);
      addSegmentStrip(pts[i],pts[i+1],w,'xy');
      addSegmentStrip(pts[i],pts[i+1],w,'zy');
    }
    for(let i=0;i<forkPts.length-1;i++){
      const w=0.045*(1-i/forkPts.length*0.5);
      addSegmentStrip(forkPts[i],forkPts[i+1],w,'xy');
      addSegmentStrip(forkPts[i],forkPts[i+1],w,'zy');
    }
    geo.setAttribute('position',new Float32BufferAttribute(positions,3));
    geo.setAttribute('uv',new Float32BufferAttribute(uvs,2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private material(color:number,kind:'rift'|'ribbon'|'sigil'|'mandala'):MeshBasicMaterial {
    const material=spellMaterial(kind);material.color.setHex(color);this.materials.push(material);return material;
  }
  setView(rotation:Quaternion):void { this.view.copy(rotation); }

  triggerSpikes(origin:Vector3,forward:Vector3):void {
    this.spikesAge=0;this.spikesActive=true;
    this.spikeSide.set(-forward.z,0,forward.x).normalize();
    for(let i=0;i<this.earthSpikes.length;i++) {
      const spike=this.earthSpikes[i];
      const dist=0.85+i*0.62;
      const lateral=(i%2===0?0.22:-0.22)*(1+i*0.12);
      spike.origin.copy(origin).addScaledVector(forward,dist).addScaledVector(this.spikeSide,lateral);
      spike.origin.y=0;
      spike.tilt=0.25+Math.sin(i*2.1)*0.08;
      spike.yaw=Math.atan2(forward.x,forward.z)+Math.sin(i*1.8)*0.25;
      spike.delay=i*0.042;
      spike.active=true;
      spike.root.position.copy(spike.origin);
      spike.root.position.y=-1.85;
      spike.root.rotation.set(0,0,0);
      spike.root.rotateY(spike.yaw);
      spike.root.rotateX(spike.tilt);
      spike.root.scale.setScalar(0.75+i*0.06);
      spike.root.visible=true;
    }
  }

  triggerLightning(target:Vector3):void {
    this.lightningRoot.position.set(target.x,0,target.z);
    this.lightningLife=1.05;
    this.lightningRoot.visible=true;
    this.lightningCoreMat.opacity=this.lightningAuraMat.opacity=this.lightningRingMat.opacity=0;
    this.lightningBolt.rotation.y=0;
    this.lightningRing.scale.setScalar(0.1);
  }

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
    this.time+=dt;for(const material of this.materials)if(material instanceof MeshBasicMaterial)clockSpell(material,this.time);

    // Update Earth Spikes
    if(this.spikesActive) {
      this.spikesAge+=dt;
      let anyActive=false;
      this.spikesSmoke.setView(this.view);
      for(let i=0;i<this.earthSpikes.length;i++) {
        const spike=this.earthSpikes[i];
        if(!spike.active)continue;
        if(this.spikesAge<spike.delay){spike.root.position.y=-1.85;anyActive=true;continue;}
        const t=this.spikesAge-spike.delay;
        if(t<=0.11) {
          anyActive=true;
          const p=t/0.11;
          const rise=Math.sin(p*Math.PI*0.5);
          spike.root.position.y=-1.85*(1-rise);
        } else if(t<=0.85) {
          anyActive=true;
          spike.root.position.y=Math.sin(t*45)*0.008;
        } else if(t<=1.32) {
          anyActive=true;
          const fade=(t-0.85)/0.47;
          spike.root.position.y=-1.85*fade;
          spike.root.scale.setScalar((0.75+i*0.06)*(1-fade*0.3));
        } else {
          spike.active=false;spike.root.visible=false;
        }
        const dust=Math.max(0,1-t/.65);
        for(let n=0;n<3;n++)this.spikesSmoke.particle(i*3+n,spike.origin.x+(n-1)*.12,.08+t*.18,spike.origin.z+n*.05,.3+t*.6,i+n+t,dust*.3);
      }
      this.spikesSmoke.commit();
      if(!anyActive)this.spikesActive=false;
    }

    // Update Sky Lightning
    if(this.lightningLife>0) {
      this.lightningLife=Math.max(0,this.lightningLife-dt);
      const age=1.05-this.lightningLife, ratio=this.lightningLife/1.05;
      const strike=Math.exp(-age*9)+.65*Math.exp(-Math.pow((age-.24)*13,2));
      this.lightningCoreMat.opacity=strike;
      this.lightningAuraMat.opacity=strike*.65;
      this.lightningBolt.rotation.y=Math.sin(age*12)*.22;
      this.lightningBolt.scale.set(1+Math.sin(age*18)*.12,1,1+Math.cos(age*16)*.12);
      const ringScale=age*2.2;
      this.lightningRing.scale.setScalar(Math.max(0.1,ringScale));
      this.lightningRingMat.opacity=ratio*0.85;
      const seal=this.lightningRoot.children[2] as Mesh<BufferGeometry,MeshBasicMaterial>;
      seal.material.opacity=ratio*.75;seal.rotation.z=age*.7;
      if(this.lightningLife<=0)this.lightningRoot.visible=false;
    }

    // Update Dimension Fracture Cuts
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

    // Update Wind Vortex
    this.vortex.visible=vortexTime>0;if(!this.vortex.visible)return;
    this.vortex.position.copy(center);this.vortex.position.y=.06;
    const fade=Math.min(1,vortexTime*2,Math.max(0,(3-vortexTime)*4));this.vortex.scale.setScalar(.8+fade*.2);
    for(let i=0;i<this.vortex.children.length;i++) {
      if(this.vortex.children[i]===this.cyclone.mesh)continue;
      const layer=this.vortex.children[i] as Mesh<BufferGeometry,MeshBasicMaterial>;
      layer.material.opacity=fade*(i<4?.36:.8);
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
  reset():void {
    for(const cut of this.cuts){cut.life=0;cut.root.visible=false;}
    for(const spike of this.earthSpikes){spike.active=false;spike.root.visible=false;}
    this.lightningLife=0;this.lightningRoot.visible=false;
    this.spikesActive=false;this.spikesAge=0;
    for(let i=0;i<28;i++)this.spikesSmoke.particle(i,0,0,0,0,0,0);
    this.spikesSmoke.commit();
    this.vortex.visible=this.divider.visible=false;
  }
  dispose():void {
    for(const cut of this.cuts)cut.smoke.dispose();
    this.cyclone.dispose();this.dividerSmoke.dispose();this.dividerSteel.dispose();
    this.spikesSmoke.dispose();
    for(const geometry of this.geometries)geometry.dispose();
    for(const material of this.materials)material.dispose();
  }
}
