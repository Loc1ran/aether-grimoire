import { DataTexture, RepeatWrapping, RGBAFormat, UnsignedByteType } from '@iwsdk/core';
import { makeRandom } from './hardsurface.js';

const size=128, pixels=new Uint8Array(size*size*4), random=makeRandom(211);
for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
  const i=(y*size+x)*4, n=105+random()*55+Math.sin(x*.5+Math.sin(y*.2))*12;
  pixels[i]=pixels[i+1]=pixels[i+2]=n;pixels[i+3]=255;
}
/** Shared subtle surface grain, deterministic in both editor and runtime. */
export const relicGrain=new DataTexture(pixels,size,size,RGBAFormat,UnsignedByteType);
relicGrain.wrapS=relicGrain.wrapT=RepeatWrapping;
relicGrain.repeat.set(3,3);relicGrain.needsUpdate=true;
