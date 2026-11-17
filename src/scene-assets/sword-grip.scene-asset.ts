import { CatmullRomCurve3, Group, Mesh, MeshStandardMaterial, TubeGeometry, Vector3 } from '@iwsdk/core';
import { LoftSurface, sampleRange } from './lib/hardsurface.js';
import { relicGrain } from './lib/relic-finish.js';

/** Sword hilt origin; fingers curl around local Y, forearm retreats along +Z. */
export function createSwordGrip(): Group {
  const root=new Group();root.name='SwordGrip';
  const glove=new MeshStandardMaterial({color:0x32262a,roughness:.85,bumpMap:relicGrain,bumpScale:.0003});
  const leather=new MeshStandardMaterial({color:0x18202b,roughness:.65,bumpMap:relicGrain,bumpScale:.0005});
  const trim=new MeshStandardMaterial({color:0x987956,metalness:.65,roughness:.42});
  const palm=LoftSurface.tube([
    {z:-.015,halfW:.025,hUp:.043,hDown:.034,cx:.035,cy:-.035,power:2.7},
    {z:.02,halfW:.031,hUp:.047,hDown:.038,cx:.036,cy:-.037,power:2.4},
    {z:.06,halfW:.026,hUp:.031,hDown:.029,cx:.054,cy:-.065,power:2.2},
    {z:.095,halfW:.026,hUp:.027,hDown:.025,cx:.067,cy:-.086,power:2},
    {z:.19,halfW:.039,hUp:.035,hDown:.033,cx:.11,cy:-.13,power:2.1},
    {z:.34,halfW:.052,hUp:.045,hDown:.04,cx:.19,cy:-.2,power:2.2},
  ]).build(sampleRange(-.015,.34,32),24,true);
  const hand=new Mesh(palm,glove);hand.name='SculptedPalmAndForearm';root.add(hand);
  for(let i=0;i<4;i++) {
    const y=.014-i*.022, radius=i===3?.009:.011;
    const curve=new CatmullRomCurve3([
      new Vector3(.047,y,.018),new Vector3(.017,y+.002,.031),new Vector3(-.019,y,.024),
      new Vector3(-.031,y,-.002),new Vector3(-.019,y-.002,-.025),new Vector3(.012,y-.002,-.024),
    ]);
    const finger=new Mesh(new TubeGeometry(curve,22,radius,10,false),glove);finger.name=`CurledFinger${i}`;root.add(finger);
  }
  const thumbCurve=new CatmullRomCurve3([new Vector3(.063,-.054,.01),new Vector3(.056,-.024,-.024),new Vector3(.029,.004,-.041),new Vector3(-.005,.009,-.036)]);
  const thumb=new Mesh(new TubeGeometry(thumbCurve,22,.013,12,false),glove);thumb.name='OpposedThumb';root.add(thumb);
  for(let i=0;i<2;i++) {
    const start=.10+i*.16,end=start+(i?.075:.042);
    const cuff=LoftSurface.tube([
      {z:start,halfW:.032+i*.018,hUp:.034+i*.012,cx:.07+(start-.1)*.5,cy:-.09-(start-.1)*.45,power:2.5},
      {z:end,halfW:.036+i*.019,hUp:.036+i*.014,cx:.07+(end-.1)*.5,cy:-.09-(end-.1)*.45,power:2.5},
    ]).build(sampleRange(start,end,8),24,true);
    const bracer=new Mesh(cuff,i?leather:trim);bracer.name=i?'ForearmBracer':'WristBinding';root.add(bracer);
  }
  return root;
}
