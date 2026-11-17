import { CatmullRomCurve3, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Path, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from '@iwsdk/core';
import { bevelBox, LoftSurface, sampleRange } from './lib/hardsurface.js';
import { dartGeometry, wedgeGeometry } from './lib/relic-forms.js';
import { createKatana } from './katana.scene-asset.js';
import { relicGrain } from './lib/relic-finish.js';

const stone = new MeshStandardMaterial({ color: '#697373', roughness: 0.88, bumpMap: relicGrain, bumpScale: .012 });
const ash = new MeshStandardMaterial({ color: '#999b8f', roughness: 0.76, bumpMap: relicGrain, bumpScale: .007 });
const obsidian = new MeshStandardMaterial({ color: '#101c25', metalness: 0.65, roughness: 0.3 });
const gold = new MeshStandardMaterial({ color: '#c4a367', metalness: 0.82, roughness: 0.34 });
const rune = new MeshStandardMaterial({ color: '#ddd7c5', emissive: '#91aab5', emissiveIntensity: .45, roughness: 0.2, metalness: 0.3 });

function loftMesh(name: string, geometry: ReturnType<LoftSurface['build']>, material: MeshStandardMaterial): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

export function createSword(): Group { return createKatana(); }

/** Floor origin. The chest sits at y=1.2 and the face looks along +Z. */
export function createTrainingTarget(): Group {
  const root = new Group();
  root.name = 'RuneSentinel';
  const core = new Group();
  core.name = 'TargetCore';
  const body = LoftSurface.tube([
    { z: 0.02, halfW: 0.2, hUp: 0.13, hDown: 0.13, power: 2.2 },
    { z: 0.12, halfW: 0.16, hUp: 0.1, hDown: 0.1, power: 2 },
    { z: 0.26, halfW: 0.065, hUp: 0.045, hDown: 0.05, power: 1.8 },
    { z: 0.58, halfW: 0.07, hUp: 0.048, hDown: 0.055, power: 1.6 },
    { z: 0.88, halfW: 0.13, hUp: 0.07, hDown: 0.1, power: 1.35 },
    { z: 1.1, halfW: 0.22, hUp: 0.09, hDown: 0.13, power: 1.25 },
    { z: 1.26, halfW: 0.34, hUp: 0.1, hDown: 0.12, power: 1.2 },
    { z: 1.36, halfW: 0.09, hUp: 0.06, hDown: 0.07, power: 1.8 },
    { z: 1.5, halfW: 0.12, hUp: 0.08, hDown: 0.09, power: 1.6 },
    { z: 1.62, halfW: 0.018, hUp: 0.016, hDown: 0.014, power: 2.1 },
  ]).build([0, 0.02, 0.08, 0.12, 0.2, 0.26, 0.4, 0.58, 0.73, 0.88, 1.02, 1.1, 1.18, 1.26, 1.31, 1.36, 1.43, 1.5, 1.57, 1.62], 28, true);
  body.rotateX(-Math.PI / 2);
  core.add(loftMesh('TargetStone', body, stone));

  const hoodShape=new Shape();
  hoodShape.moveTo(-.22,1.24);hoodShape.bezierCurveTo(-.18,1.49,-.16,1.6,0,1.72);
  hoodShape.bezierCurveTo(.16,1.6,.18,1.49,.22,1.24);hoodShape.quadraticCurveTo(0,1.35,-.22,1.24);
  const opening=new Path();opening.moveTo(-.10,1.35);opening.quadraticCurveTo(-.12,1.51,0,1.61);opening.quadraticCurveTo(.12,1.51,.10,1.35);opening.quadraticCurveTo(0,1.29,-.10,1.35);
  hoodShape.holes.push(opening);
  const hood=new Mesh(new ExtrudeGeometry(hoodShape,{depth:.075,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:3,curveSegments:20,steps:1}),obsidian);
  hood.name='CarvedHood';hood.position.z=.025;core.add(hood);
  const maskShape=new Shape();maskShape.moveTo(0,.115);maskShape.quadraticCurveTo(-.095,.095,-.073,-.035);
  maskShape.lineTo(0,-.125);maskShape.lineTo(.073,-.035);maskShape.quadraticCurveTo(.095,.095,0,.115);
  const mask=new Mesh(new ExtrudeGeometry(maskShape,{depth:.014,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:3,curveSegments:12,steps:1}),gold);
  mask.name='SentinelVisage';mask.position.set(0,1.46,.1);core.add(mask);
  for(const sign of [-1,1]) {
    const eye=new Shape();eye.moveTo(sign*.012,1.48);eye.lineTo(sign*.062,1.493);eye.lineTo(sign*.047,1.466);eye.closePath();
    const slit=new Mesh(new ExtrudeGeometry(eye,{depth:.002,bevelEnabled:false}),obsidian);
    slit.name=sign<0?'VisageEyeLeft':'VisageEyeRight';slit.position.z=.122;core.add(slit);
  }
  const heart = new Mesh(new SphereGeometry(1,20,12), rune);
  heart.name = 'TargetHeart';
  heart.scale.set(0.035, 0.065, 0.025);
  heart.position.set(0, 1.12, 0.14);
  core.add(heart);
  const seal=new Mesh(new TorusGeometry(.081,.003,6,48),gold);seal.name='HeartSeal';seal.position.set(0,1.12,.14);core.add(seal);

  const fragments = new Group();
  fragments.name = 'Fragments';
  fragments.visible = false;
  const chip = wedgeGeometry();
  for (let i = 0; i < 7; i++) {
    const fragment = new Mesh(chip, i % 2 === 0 ? stone : ash);
    fragment.name = `TargetFragment${i}`;
    const column = i % 3;
    const row = Math.floor(i / 3);
    fragment.position.set((column - 1) * 0.16, 0.95 + row * 0.22, 0.08);
    fragment.scale.setScalar(0.22 + (i % 3) * 0.04);
    fragments.add(fragment);
  }
  root.add(core, fragments);
  return root;
}

/** 3 x 2.8m niche wall. Floor origin, carved face toward +Z. */
export function createArenaWall(): Group {
  const root = new Group();
  root.name = 'TrainingWall';
  const wall=new Shape();wall.moveTo(-1.5,0);wall.lineTo(1.5,0);wall.lineTo(1.5,2.8);wall.lineTo(-1.5,2.8);wall.closePath();
  const arch=new Path();arch.moveTo(-.86,.14);arch.lineTo(-.86,1.52);arch.bezierCurveTo(-.86,2.09,-.32,2.42,0,2.62);arch.bezierCurveTo(.32,2.42,.86,2.09,.86,1.52);arch.lineTo(.86,.14);arch.closePath();wall.holes.push(arch);
  const masonry=new Mesh(new ExtrudeGeometry(wall,{depth:.22,bevelEnabled:true,bevelSize:.018,bevelThickness:.012,bevelSegments:3,curveSegments:24,steps:1}),stone);
  masonry.name='ContinuousGothicMasonry';masonry.position.z=-.18;root.add(masonry);
  const mouldingPoints=[new Vector3(-.94,.14,.065),new Vector3(-.94,1.52,.065),new Vector3(-.69,2.16,.065),new Vector3(0,2.71,.065),new Vector3(.69,2.16,.065),new Vector3(.94,1.52,.065),new Vector3(.94,.14,.065)];
  const archMoulding=new Mesh(new TubeGeometry(new CatmullRomCurve3(mouldingPoints),80,.036,8,false),ash);
  archMoulding.name='CarvedArchMoulding';root.add(archMoulding);
  for(const side of [-1,1]) {
    const pillar=LoftSurface.tube([
      {z:.12,halfW:.13,hUp:.09,hDown:.09,power:3},{z:.24,halfW:.1,hUp:.07,hDown:.07,power:3},
      {z:.32,halfW:.065,hUp:.06,hDown:.06,power:2},{z:2.38,halfW:.065,hUp:.06,hDown:.06,power:2},
      {z:2.48,halfW:.11,hUp:.09,hDown:.09,power:3},{z:2.59,halfW:.13,hUp:.1,hDown:.1,power:3},
    ]).build([.12,.2,.24,.28,.32,1.3,2.38,2.43,2.48,2.59],20,true);pillar.rotateX(-Math.PI/2);
    const column=new Mesh(pillar,ash);column.name=side<0?'WestEngagedColumn':'EastEngagedColumn';column.position.set(side*1.18,0,.08);root.add(column);
  }
  for(const x of [-.38,0,.38]) {
    const bar=new Mesh(new TubeGeometry(new CatmullRomCurve3([new Vector3(x,.14,.025),new Vector3(x,1.5,.025),new Vector3(x*.72,2.2-Math.abs(x)*.5,.025)]),12,.009,5,false),gold);
    bar.name=`BronzeWindowTracery${x}`;root.add(bar);
  }
  const foot = new Mesh(bevelBox(3.08, 0.14, 0.36, 0.015), ash);
  foot.name = 'WallFoot';
  foot.position.set(0, 0.07, 0.02);
  const crown = new Mesh(bevelBox(3.08, 0.12, 0.28, 0.012), ash);
  crown.name = 'WallCrown';
  crown.position.set(0, 2.72, 0.02);
  root.add(foot, crown);
  return root;
}

/** Suspended claw cage. Origin is the crystal; shots leave along local +Z. */
export function createEmitter(): Group {
  const root = new Group();
  root.name = 'ArcaneEmitter';
  const cage = new Group();
  cage.name = 'EmitterCage';
  const rib = LoftSurface.tube([
    { z: -0.02, halfW: 0.018, hUp: 0.012, hDown: 0.01, power: 2 },
    { z: 0.08, halfW: 0.014, hUp: 0.01, hDown: 0.008, cy: 0.11, power: 1.8 },
    { z: 0.2, halfW: 0.01, hUp: 0.008, hDown: 0.006, cy: 0.02, power: 2 },
  ]).build([-0.02, 0.06, 0.12, 0.2], 6, true);
  for (let i = 0; i < 3; i++) {
    const claw = loftMesh(`EmitterRib${i}`, rib.clone(), i === 1 ? gold : obsidian);
    claw.rotation.z = i * (Math.PI * 2 / 3);
    cage.add(claw);
  }
  const heart = new Mesh(new SphereGeometry(.055,24,16), rune);
  heart.name = 'EmitterHeart';
  for(let i=0;i<2;i++) {
    const orbit=new Mesh(new TorusGeometry(.115+i*.024,.003,6,64),gold);
    orbit.name=`OrreryOrbit${i}`;orbit.rotation.set(.5+i*.9,i*.7,.4);cage.add(orbit);
  }
  root.add(cage, heart);
  return root;
}
