import { BufferGeometry, Float32BufferAttribute } from '@iwsdk/core';

/** Swept, tapered ribbon. Local +Z is travel; its curve wraps around that axis. */
export function flowRibbon(turns = 0.7, radius = 0.22, width = 0.25): BufferGeometry {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, a = t * Math.PI * 2 * turns;
    const taper = Math.sin(t * Math.PI);
    for (const side of [-1, 1]) {
      const r = radius * taper + side * width * taper * 0.5;
      positions.push(Math.cos(a) * r, Math.sin(a) * r, t - 0.5);
      uv.push(t, (side + 1) / 2);
    }
    if (i < 48) { const n = i * 2; indices.push(n,n+1,n+2,n+1,n+3,n+2); }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv,2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** A curved slash with a fine outer edge, in local XY. */
export function crescentSurface(): BufferGeometry {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i=0;i<=48;i++) {
    const t=i/48, a=-1.25+t*2.5;
    for(const side of [0,1]) {
      const r=.72-side*.25*Math.sin(Math.PI*t);
      positions.push(Math.sin(a)*r,Math.cos(a)*r-.35,side*.035*Math.sin(Math.PI*t));
      uv.push(t,side);
    }
    if(i<48) {const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
