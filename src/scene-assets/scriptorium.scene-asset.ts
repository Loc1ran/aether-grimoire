import {
  createScenePrimitiveObject,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from '@iwsdk/core';
import { relicGrain } from './lib/relic-finish.js';

/** Dark floor under the reading place. Origin at the center, on the ground. */
export function createScriptoriumFloor(): Group {
  const floor = createScenePrimitiveObject(
    { geometry: { type: 'plane', size: [8, 8] } },
    new MeshStandardMaterial({
      color: '#343d40',
      roughness: 0.8,
      bumpMap: relicGrain, bumpScale: .008,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'ScriptoriumFloor';
  const root = new Group();
  root.name = 'ScriptoriumFloorRoot';
  root.add(floor);
  return root;
}

/** Broken ring of inlaid plates. Origin on the floor, local +Y up. */
export function createFloorRing(): Group {
  const root = new Group();
  root.name = 'FloorRingRoot';
  const metal = new MeshStandardMaterial({
    color: '#ad9670', roughness: 0.48, metalness: 0.68,
  });
  for (let i = 0; i < 3; i++) {
    const ring = new Mesh(new TorusGeometry(.31+i*.025,i===1?.0018:.0009,5,128),metal);
    ring.name=`EngravedCircle${i}`;ring.rotation.x=-Math.PI/2;root.add(ring);
  }
  for(let i=0;i<8;i++) {
    const arc=new Mesh(new TorusGeometry(.14,.0008,4,32,Math.PI*1.4),metal);
    arc.name=`CompassArc${i}`;arc.rotation.set(-Math.PI/2,0,i*Math.PI/4);arc.position.set(Math.cos(i*Math.PI/4)*.16,0,Math.sin(i*Math.PI/4)*.16);root.add(arc);
  }
  return root;
}
