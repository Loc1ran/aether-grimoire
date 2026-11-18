import { AdditiveBlending, DoubleSide, MeshBasicMaterial, NormalBlending, type Texture } from '@iwsdk/core';
import { GRIMOIRES, type MagicAttribute } from './combat-data.js';

/** Soft, moving ink contours on the effect surface; no texture downloads or frame allocations. */
export type SpellSurface = 'ribbon' | 'mist' | 'flare' | 'sigil' | 'smoke' | 'rift' | 'ink' | 'edge' | 'aura' | 'wake' | 'ward';
let smokeTexture: Texture | undefined;
export function setSmokeTexture(texture: Texture): void { smokeTexture=texture; }
export function spellMaterial(kind: SpellSurface, opacity = 1): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color: 0xc2b1f1, transparent: true, opacity, depthWrite: false, side: DoubleSide,
    blending: kind === 'mist' || kind === 'smoke' || kind === 'ink' ? NormalBlending : AdditiveBlending, toneMapped: false,
  });
  if(kind==='smoke' && smokeTexture)material.map=smokeTexture;
  const time = { value: 0 }, style = { value: 0 };
  material.userData.clock = time;
  material.userData.style = style;
  material.onBeforeCompile = shader => {
    shader.uniforms.spellTime = time;
    shader.uniforms.spellStyle = style;
    shader.vertexShader = 'varying vec2 spellUv;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nspellUv = uv;');
    shader.fragmentShader = `varying vec2 spellUv; uniform float spellTime; uniform float spellStyle;
      float inkHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float inkNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(inkHash(i),inkHash(i+vec2(1,0)),f.x),mix(inkHash(i+vec2(0,1)),inkHash(i+vec2(1,1)),f.x),f.y);
      }
      float inkFbm(vec2 p) { return inkNoise(p)*.57+inkNoise(p*2.07)*.28+inkNoise(p*4.13)*.15; }
    \n` + shader.fragmentShader.replace('#include <alphatest_fragment>', `
      vec2 p = spellUv;
      float t = spellTime;
      float flow = sin(p.x * 21.0 - t * 4.5) * sin(p.y * 17.0 + t * 2.0);
      float fine = sin(p.x * 49.0 + p.y * 31.0 - t * 6.0) * 0.12;
      float shape;
      ${kind === 'ward' ? `
        vec2 cells=p*vec2(16.0,8.0), cell=floor(cells), local=fract(cells);
        float first=3.0,second=3.0;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++) {
          vec2 o=vec2(float(x),float(y));
          vec2 seed=vec2(inkHash(cell+o),inkHash(cell+o+37.0));
          float d=length(o+seed-local);
          if(d<first){second=first;first=d;}else{second=min(second,d);}
        }
        shape=(.12+.9*(1.0-smoothstep(.008,.035,second-first)))*smoothstep(.02,.2,p.y);
        shape*=.55+.45*inkFbm(p*6.0+t*.15);
      ` : kind === 'aura' ? `
        float stream=inkFbm(vec2(p.x*4.0,p.y*7.0-t*1.4));
        float curl=(inkFbm(vec2(p.y*5.0-t*.5,t*.16))-.5)*.22;
        float taper=pow(max(0.0,sin(p.y*3.14159)),.65);
        float width=(.17+stream*.24)*taper;
        float distance=abs(p.x-.5-curl*taper);
        shape=(1.0-smoothstep(width*.18,max(.001,width),distance));
        shape*=taper*smoothstep(.16,.72,stream);
      ` : kind === 'wake' ? `
        shape=pow(1.0-p.x,2.5)*sin(p.y*3.14159);
        shape*=smoothstep(.15,.65,inkFbm(vec2(p.x*6.0-t*2.0,p.y*4.0)));
      ` : kind === 'smoke' && material.map ? 'shape = 1.0;' : kind === 'smoke' ? `
        vec2 q=vec2(p.x*3.7,p.y*3.0-t*.65);
        float billow=inkFbm(q+inkFbm(q+t*.08)*1.8);
        float width=(.42-p.y*.3)*(0.65+billow*.7);
        float drift=sin(p.y*5.0-t)*.07+(.5-billow)*.15;
        shape=(1.0-smoothstep(width*.25,width,abs(p.x-.5-drift)));
        shape*=smoothstep(.24,.69,billow)*smoothstep(0.0,.1,p.y)*(1.0-smoothstep(.55,1.0,p.y));
      ` : kind === 'rift' ? `
        float fracture=(inkFbm(vec2(p.x*18.0,t*.8))-.5)*.16;
        shape=(1.0-smoothstep(.005,.065,abs(p.y-.5-fracture)))*pow(sin(p.x*3.14159),.7);
      ` : kind === 'ink' || kind === 'edge' ? `
        float ragged=inkFbm(vec2(p.x*17.0-t*1.7,p.y*8.0+t*.3));
        shape=smoothstep(0.0,.10,p.x)*(1.0-smoothstep(.88,1.0,p.x));
        ${kind === 'ink' ? 'shape*=smoothstep(.12,.42,ragged+p.y*.45);' : 'shape*=1.0-smoothstep(.035,.18+ragged*.12,p.y);'}
      ` : kind === 'sigil' ? 'shape = 1.0;' : kind === 'ribbon' ? `
        float center = 0.5 + sin(p.x * 11.0 - t * 2.0) * 0.11;
        float width = pow(max(0.0, sin(p.x * 3.14159)), 0.65) * (0.32 + flow * 0.06);
        if (spellStyle > 1.5) width *= 0.5 + 0.5 * (1.0 - p.x);
        shape = 1.0 - smoothstep(width * 0.3, max(0.001,width), abs(p.y - center));
        shape *= smoothstep(0.0, 0.12, p.x) * (1.0 - smoothstep(0.85,1.0,p.x));
        if (spellStyle > 0.5 && spellStyle < 1.5) shape *= 0.65 + 0.35 * sin(p.y * 80.0 + flow);
      ` : `
        float radius = length((p - 0.5) * 2.0);
        shape = 1.0 - smoothstep(0.1, 0.95 + flow * 0.13, radius);
        ${kind === 'mist' ? 'shape *= smoothstep(-0.5, 0.7, flow + fine);' : 'shape = pow(shape, 2.3);'}
      `}
      diffuseColor.a *= max(0.0, shape);
      if (diffuseColor.a < 0.005) discard;
      #include <alphatest_fragment>
    `);
  };
  material.customProgramCacheKey = () => `aether-${kind}-${!!material.map}-v3`;
  return material;
}

export function tintSpell(material: MeshBasicMaterial, attribute: MagicAttribute, dark = false): void {
  material.color.setHex(dark ? GRIMOIRES[attribute].secondary : GRIMOIRES[attribute].color);
  if (material.userData.style) material.userData.style.value = attribute === 'fire' ? 2 : attribute === 'wind' ? 1 : 0;
}

export function clockSpell(material: MeshBasicMaterial, time: number): void {
  if (material.userData.clock) material.userData.clock.value = time;
}
