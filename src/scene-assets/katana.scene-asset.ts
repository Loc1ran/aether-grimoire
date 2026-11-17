import { CatmullRomCurve3, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Path, Shape, TubeGeometry, Vector3 } from '@iwsdk/core';
import { LoftSurface, sampleRange } from './lib/hardsurface.js';
import { relicGrain } from './lib/relic-finish.js';
import { createSwordGrip } from './sword-grip.scene-asset.js';

/** Hilt origin, cutting edge on -X, continuous blade along +Y, tip at (0,.84,0). */
export function createKatana(): Group {
  const root = new Group(); root.name = 'Veilblade';
  const black = new MeshStandardMaterial({ color: '#12121a', metalness: .78, roughness: .27, bumpMap: relicGrain, bumpScale: .00012 });
  const edge = new MeshStandardMaterial({ color: '#aeb9bf', metalness: .92, roughness: .22 });
  const brass = new MeshStandardMaterial({ color: '#a98a4c', metalness: .86, roughness: .3 });
  const cord = new MeshStandardMaterial({ color: '#17131a', roughness: .9, bumpMap: relicGrain, bumpScale: .00035 });
  const skin = new MeshStandardMaterial({ color: '#b9b3a1', roughness: .92, bumpMap: relicGrain, bumpScale: .0007 });
  const add = (name: string, geometry: import('@iwsdk/core').BufferGeometry, material: MeshStandardMaterial, parent = root) => {
    const mesh = new Mesh(geometry, material); mesh.name = name; parent.add(mesh); return mesh;
  };
  const grip = LoftSurface.tube([
    { z: -.145, halfW: .016, hUp: .012, power: 2.6 },
    { z: -.08, halfW: .02, hUp: .014, power: 2.5 },
    { z: .065, halfW: .018, hUp: .013, power: 2.5 },
  ]).build(sampleRange(-.145,.065,16),20,true); grip.rotateX(-Math.PI/2);
  add('RayskinGrip',grip,skin);
  for(const direction of [-1,1]) {
    const points:Vector3[]=[];
    for(let i=0;i<=240;i++) {
      const t=i/240, a=direction*t*Math.PI*16, width=.019+Math.sin(t*Math.PI)*.002;
      points.push(new Vector3(Math.cos(a)*width,-.14+t*.2,Math.sin(a)*.015));
    }
    add(`CrosswovenSilk${direction}`,new TubeGeometry(new CatmullRomCurve3(points),240,.0038,6,false),cord);
  }
  for(const [name,y,height] of [['Kashira',-.15,.018],['Fuchi',.063,.027],['Habaki',.095,.041]] as const) {
    const geometry=LoftSurface.tube([
      {z:y,halfW:.022,hUp:.016,power:3}, {z:y+height,halfW:.021,hUp:.015,power:3},
    ]).build([y,y+height],16,true);geometry.rotateX(-Math.PI/2);add(name,geometry,brass);
  }
  const guard=new Shape();
  for(let i=0;i<=64;i++) {
    const a=i/64*Math.PI*2,r=.051*(1+.14*Math.cos(a*4)),x=Math.cos(a)*r,y=Math.sin(a)*r*.8;
    if(i===0)guard.moveTo(x,y);else guard.lineTo(x,y);
  }
  for(const side of [-1,1]) {
    const hole=new Path();hole.absellipse(side*.032,0,.009,.018,0,Math.PI*2,true,0);guard.holes.push(hole);
  }
  const guardGeometry=new ExtrudeGeometry(guard,{depth:.006,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:2,curveSegments:24});
  guardGeometry.rotateX(Math.PI/2);const tsuba=add('PiercedTsuba',guardGeometry,black);tsuba.position.y=.095;
  const blade=new Group();blade.name='Blade';root.add(blade);
  const stations=[
    {x:.12,leadZ:-.022,trailZ:.017,thickUp:.0035,power:1.2},
    {x:.3,leadZ:-.032,trailZ:.008,thickUp:.0032,power:1.2},
    {x:.56,leadZ:-.039,trailZ:-.002,thickUp:.0028,power:1.2},
    {x:.76,leadZ:-.025,trailZ:.005,thickUp:.0022,power:1.2},
    {x:.84,leadZ:-.001,trailZ:.001,thickUp:.0008,power:1.2},
  ];
  const geometry=LoftSurface.blade(stations).build(sampleRange(.12,.84,81),16,true);
  geometry.rotateX(Math.PI/2);geometry.rotateZ(Math.PI/2);add('BladeSteel',geometry,black,blade);
  // The cutting bevel follows the same curved edge and tapers into the kissaki.
  const edgeStations=stations.map(s=>({...s,trailZ:s.leadZ+(s.trailZ-s.leadZ)*.22,thickUp:s.thickUp*.92}));
  const bevel=LoftSurface.blade(edgeStations).build(sampleRange(.12,.84,81),12,true);
  bevel.rotateX(Math.PI/2);bevel.rotateZ(Math.PI/2);add('PolishedCuttingBevel',bevel,edge,blade);
  const tip=new Group();tip.name='BladeTip';tip.position.y=.84;root.add(tip);
  const hand=createSwordGrip();hand.name='DesktopGrip';hand.visible=false;root.add(hand);
  return root;
}
