import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  LatheGeometry, SphereGeometry, Vector2,
} from '@iwsdk/core';
import { bevelBox, LoftSurface } from './lib/hardsurface.js';
import { auraBand, dartGeometry, flameGeometry } from './lib/relic-forms.js';

const board = new MeshStandardMaterial({ color: '#4a2e1c', roughness: 0.68, metalness: 0.06 });
const leather = new MeshStandardMaterial({ color: '#2a1810', roughness: 0.78, metalness: 0.08 });

const parchment = new MeshStandardMaterial({
  color: '#f3e4c4',
  roughness: 0.86,
  metalness: 0,
});

const gold = new MeshStandardMaterial({
  color: '#e7c56a',
  emissive: '#a07828',
  emissiveIntensity: 0.35,
  roughness: 0.38,
  metalness: 0.64,
});

const PAGE_W = 0.168;
const PAGE_H = 0.232;
const PAGE_X = 0.092;

function sheet(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
}

function plate(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(bevelBox(size[0], size[1], size[2], Math.min(size[0], size[1], size[2]) * 0.08), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
}

/** Open spellbook. Origin is the spine, on the page plane, local +Z toward the reader. */
export function createGrimoire(): Group {
  const root = new Group();
  root.name = 'GrimoireBook';

  const coverLeft = new Group();
  coverLeft.name = 'CoverLeft';
  const coverRight = new Group();
  coverRight.name = 'CoverRight';
  coverLeft.add(plate('CoverLeftLeather', [0.236, 0.318, 0.03], [-PAGE_X, 0, -0.022], board));
  coverRight.add(plate('CoverRightLeather', [0.236, 0.318, 0.03], [PAGE_X, 0, -0.022], board));
  coverLeft.add(plate('CoverLeftPanel', [0.168, 0.236, 0.006], [-PAGE_X, 0, -0.006], leather));
  coverRight.add(plate('CoverRightPanel', [0.168, 0.236, 0.006], [PAGE_X, 0, -0.006], leather));
  const spineGeo = LoftSurface.tube([
    { z: -0.148, halfW: 0.012, hUp: 0.008, hDown: 0.014, power: 2 },
    { z: -0.08, halfW: 0.016, hUp: 0.01, hDown: 0.02, power: 1.6 },
    { z: 0, halfW: 0.017, hUp: 0.011, hDown: 0.022, power: 1.45 },
    { z: 0.08, halfW: 0.016, hUp: 0.01, hDown: 0.02, power: 1.6 },
    { z: 0.148, halfW: 0.012, hUp: 0.008, hDown: 0.014, power: 2 },
  ]).build([-0.148, -0.08, 0, 0.08, 0.148], 8, true);
  spineGeo.rotateX(-Math.PI / 2);
  const spine = new Mesh(spineGeo, leather);
  spine.name = 'Spine';
  root.add(coverLeft, coverRight, spine);
  const ribGeo = LoftSurface.tube([
    { z: -0.007, halfW: 0.024, hUp: 0.03, hDown: 0.012, power: 2.2 },
    { z: 0.007, halfW: 0.024, hUp: 0.03, hDown: 0.012, power: 2.2 },
  ]).build([-0.007, 0.007], 6, true);
  ribGeo.rotateX(-Math.PI / 2);
  for (const y of [-0.075, 0, 0.075]) {
    const rib = new Mesh(ribGeo, gold);
    rib.name = y === 0 ? 'SpineRib' : `SpineRib${y > 0 ? 'N' : 'S'}`;
    rib.position.y = y;
    root.add(rib);
  }
  const bossGeo = LoftSurface.tube([
    { z: 0, halfW: 0.01, hUp: 0.01, hDown: 0.004, power: 2 },
    { z: 0.012, halfW: 0.016, hUp: 0.014, hDown: 0.006, power: 1.5 },
    { z: 0.022, halfW: 0.004, hUp: 0.004, hDown: 0.002, power: 2 },
  ]).build([0, 0.012, 0.022], 6, true);
  for (const side of [-1, 1]) {
    const cover = side < 0 ? coverLeft : coverRight;
    for (const y of [-1, 1]) {
      const boss = new Mesh(bossGeo, gold);
      boss.name = `CoverBoss${side}_${y > 0 ? 'N' : 'S'}`;
      boss.position.set(side * 0.188, y * 0.136, -0.004);
      cover.add(boss);
    }
  }
  const inlay = new Mesh(auraBand(0.4, 0.292, 0.04, 0.016, 0.004), gold);
  inlay.name = 'CoverInlay';
  inlay.position.z = -0.004;
  root.add(inlay);

  const leftPage = sheet('PageLeft', [PAGE_W, PAGE_H, 0.006], [-PAGE_X, 0, 0.004], parchment);
  coverLeft.add(leftPage);
  const hinge = new Group();
  hinge.name = 'PageHinge';
  hinge.add(sheet('PageRight', [PAGE_W, PAGE_H, 0.006], [PAGE_X, 0, 0.004], parchment));
  const edgePaper = new MeshStandardMaterial({ color: '#d9c294', roughness: 0.92 });
  for (let layer = 0; layer < 6; layer++) {
    const edge = sheet(
      `PageEdge${layer}`,
      [PAGE_W - layer * 0.002, PAGE_H - 0.008 - layer * 0.0015, 0.0032],
      [PAGE_X, 0, -0.001 - layer * 0.0032],
      layer % 2 === 0 ? parchment : edgePaper,
    );
    hinge.add(edge);
  }

  const seal = new Mesh(dartGeometry(), gold);
  seal.name = 'SealRing';
  seal.scale.set(0.06, 0.04, 0.02);
  seal.position.set(PAGE_X, 0.01, 0.012);
  const sealCore = new Mesh(dartGeometry(), new MeshStandardMaterial({
    color: '#ff6a2a', emissive: '#ff6a2a', emissiveIntensity: 0.85, roughness: 0.32,
  }));
  sealCore.name = 'Control_Seal';
  sealCore.scale.set(0.04, 0.025, 0.03);
  sealCore.position.set(PAGE_X, 0.01, 0.02);
  hinge.add(seal, sealCore);
  hinge.add(plate('Control_Next', [0.05, 0.034, 0.012], [PAGE_X + 0.09, -0.118, 0.004], gold));
  coverRight.add(hinge);
  coverLeft.add(plate('Control_Prev', [0.05, 0.034, 0.012], [-PAGE_X - 0.09, -0.118, 0.004], new MeshStandardMaterial({
    color: '#8d7044', emissive: '#5c4318', emissiveIntensity: 0.2, roughness: 0.45, metalness: 0.5,
  })));

  const stampColors = ['#ff6a2a', '#8fd4ff', '#2ec6c0', '#c9a6ff'];
  const stampNames = ['StampEmber', 'StampGale', 'StampTide', 'StampVeil'];
  const crystal = dartGeometry();
  stampNames.forEach((name, index) => {
    const stamp = new Mesh(crystal, new MeshStandardMaterial({
      color: stampColors[index], emissive: new Color(stampColors[index]), emissiveIntensity: 0.2, roughness: 0.35,
    }));
    stamp.name = name;
    stamp.scale.set(0.018, 0.012, 0.028);
    stamp.position.set(-0.176, 0.08 - index * 0.046, 0.002);
    coverLeft.add(stamp);
  });

  const halo = new Group();
  halo.name = 'Halo';
  stampNames.forEach((_, index) => {
    const mote = new Mesh(crystal, new MeshStandardMaterial({
      color: stampColors[index], emissive: new Color(stampColors[index]), emissiveIntensity: 1.1, roughness: 0.28,
    }));
    mote.name = ['MoteEmber', 'MoteGale', 'MoteTide', 'MoteVeil'][index];
    const along = index - 1.5;
    mote.position.set(along * 0.07, 0.15, 0.03);
    mote.scale.set(0.03, 0.018, 0.045);
    mote.visible = false;
    halo.add(mote);
  });
  const aura = new Group();
  aura.name = 'Aura';
  root.add(aura, halo);
  return root;
}

const wax = new MeshStandardMaterial({
  color: '#f4efe4',
  roughness: 0.62,
});

const flame = new MeshStandardMaterial({
  color: '#ffb15a',
  emissive: '#ff8a2a',
  emissiveIntensity: 1.4,
  roughness: 0.4,
});

/** A small candle, origin on the floor. */
export function createCandle(): Group {
  const root = new Group();
  root.name = 'Candle';
  const stick = new Mesh(new LatheGeometry([
    new Vector2(.014,.006),new Vector2(.016,.014),new Vector2(.013,.026),new Vector2(.013,.09),new Vector2(.011,.102),new Vector2(.006,.097),new Vector2(.003,.099),
  ],24),wax);
  stick.name = 'CandleWax';
  const drip = new Mesh(new LatheGeometry([new Vector2(0,0),new Vector2(.023,0),new Vector2(.027,.004),new Vector2(.025,.008),new Vector2(.017,.011),new Vector2(.015,.008)],32),gold);
  drip.name = 'CastBrassDish';
  const flameShape=new SphereGeometry(1,20,14), p=flameShape.attributes.position;
  for(let i=0;i<p.count;i++){const t=(p.getY(i)+1)/2;p.setXYZ(i,p.getX(i)*.008*(1-t*.65)+t*t*.003,t*.035,p.getZ(i)*.006*(1-t*.65));}
  flameShape.computeVertexNormals();
  const fire = new Mesh(flameShape, flame);
  fire.position.y = 0.1;
  fire.name = 'CandleFlame';
  root.add(drip, stick, fire);
  return root;
}
