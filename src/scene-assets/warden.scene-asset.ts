import { Group, Mesh, MeshStandardMaterial } from '@iwsdk/core';
import { createTrainingTarget } from './combat.scene-asset.js';
import { LoftSurface, sampleRange } from './lib/hardsurface.js';
import { relicGrain } from './lib/relic-finish.js';

/** Floor origin, face +Z; 1.9 m crowned sentinel with articulated shoulder armor. */
export function createWarden(): Group {
  const root=createTrainingTarget();root.name='ObsidianWarden';
  const core=root.getObjectByName('TargetCore')!;
  const steel=new MeshStandardMaterial({color:0x263241,metalness:.76,roughness:.35,bumpMap:relicGrain,bumpScale:.001});
  const gold=new MeshStandardMaterial({color:0xbda06a,metalness:.82,roughness:.32});
  const ember=new MeshStandardMaterial({color:0xff696b,emissive:0xff173d,emissiveIntensity:2});
  const armor=new Group();armor.name='WardenArmor';core.add(armor);
  for(const side of [-1,1]) {
    const geometry=LoftSurface.tube([
      {z:.82,halfW:.055,hUp:.065,cx:side*.32,power:2.4},
      {z:1.03,halfW:.09,hUp:.095,cx:side*.36,power:2.2},
      {z:1.23,halfW:.17,hUp:.14,cx:side*.30,power:2.5},
      {z:1.38,halfW:.12,hUp:.11,cx:side*.29,power:2.1},
      {z:1.50,halfW:.012,hUp:.018,cx:side*.39,power:2},
    ]).build(sampleRange(.82,1.5,32),24,true);geometry.rotateX(-Math.PI/2);
    const shoulder=new Mesh(geometry,steel);shoulder.name=side<0?'WardenLeftPauldron':'WardenRightPauldron';armor.add(shoulder);
    const crest=LoftSurface.tube([
      {z:1.54,halfW:.035,hUp:.026,cx:side*.1,cy:0,power:2},
      {z:1.7,halfW:.028,hUp:.022,cx:side*.15,cy:.01,power:2},
      {z:1.88,halfW:.002,hUp:.003,cx:side*.18,cy:.01,power:2},
    ]).build(sampleRange(1.54,1.88,16),16,true);crest.rotateX(-Math.PI/2);
    const horn=new Mesh(crest,gold);horn.name=side<0?'CrownLeft':'CrownRight';armor.add(horn);
  }
  const heart=root.getObjectByName('TargetHeart') as Mesh;heart.material=ember;heart.scale.multiplyScalar(1.7);
  return root;
}
