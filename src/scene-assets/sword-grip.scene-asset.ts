import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector3 } from '@iwsdk/core';
import { LoftSurface, sampleRange } from './lib/hardsurface.js';
import { relicGrain } from './lib/relic-finish.js';
import handData from './sword-hand.json';

/** Sword hilt origin; fingers curl around local Y, forearm retreats along +Z. */
export function createSwordGrip(): Group {
  const root=new Group();root.name='SwordGrip';
  const glove=new MeshStandardMaterial({color:0x51483c,roughness:.78});
  const leather=new MeshStandardMaterial({color:0x18202b,roughness:.65,bumpMap:relicGrain,bumpScale:.0005});
  const trim=new MeshStandardMaterial({color:0x987956,metalness:.65,roughness:.42});
  const palm=new BufferGeometry();palm.setAttribute('position',new Float32BufferAttribute(handData.position,3));
  palm.setAttribute('normal',new Float32BufferAttribute(handData.normal,3));palm.setIndex(handData.index);
  const hand=new Mesh(palm,glove);hand.name='SculptedPalm';root.add(hand);
  const forearm=new Group();forearm.name='Forearm';forearm.position.set(.045,-.070,.033);
  forearm.quaternion.setFromUnitVectors(new Vector3(0,0,1),new Vector3(0,-.917,.399).normalize());root.add(forearm);
  const sleeve=LoftSurface.tube([
    {z:0,halfW:.026,hUp:.028,hDown:.026,power:2.1},
    {z:.05,halfW:.029,hUp:.029,hDown:.027,power:2.1},
    {z:.17,halfW:.042,hUp:.037,hDown:.035,power:2.2},
    {z:.3,halfW:.052,hUp:.045,hDown:.041,power:2.2},
  ]).build(sampleRange(0,.3,24),24,true);
  const arm=new Mesh(sleeve,glove);arm.name='SleevedForearm';forearm.add(arm);
  for(let i=0;i<2;i++) {
    const start=i?.21:0,end=start+(i?.09:.035);
    const cuff=LoftSurface.tube([
      {z:start,halfW:.03+i*.018,hUp:.032+i*.01,power:2.5},
      {z:end,halfW:.033+i*.022,hUp:.033+i*.014,power:2.5},
    ]).build(sampleRange(start,end,8),24,true);
    const bracer=new Mesh(cuff,i?leather:trim);bracer.name=i?'ForearmBracer':'WristBinding';forearm.add(bracer);
  }
  return root;
}
