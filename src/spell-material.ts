import { AdditiveBlending, DoubleSide, MeshBasicMaterial, NormalBlending } from '@iwsdk/core';
import { GRIMOIRES, type MagicAttribute } from './combat-data.js';

/** Soft, moving ink contours on the effect surface; no texture downloads or frame allocations. */
export function spellMaterial(kind: 'ribbon' | 'mist' | 'flare' | 'sigil', opacity = 1): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color: 0xc2b1f1, transparent: true, opacity, depthWrite: false, side: DoubleSide,
    blending: kind === 'mist' ? NormalBlending : AdditiveBlending, toneMapped: false,
  });
  const time = { value: 0 }, style = { value: 0 };
  material.userData.clock = time;
  material.userData.style = style;
  material.onBeforeCompile = shader => {
    shader.uniforms.spellTime = time;
    shader.uniforms.spellStyle = style;
    shader.vertexShader = 'varying vec2 spellUv;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nspellUv = uv;');
    shader.fragmentShader = `varying vec2 spellUv; uniform float spellTime; uniform float spellStyle;\n` + shader.fragmentShader.replace('#include <alphatest_fragment>', `
      vec2 p = spellUv;
      float t = spellTime;
      float flow = sin(p.x * 21.0 - t * 4.5) * sin(p.y * 17.0 + t * 2.0);
      float fine = sin(p.x * 49.0 + p.y * 31.0 - t * 6.0) * 0.12;
      float shape;
      ${kind === 'sigil' ? 'shape = 1.0;' : kind === 'ribbon' ? `
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
  material.customProgramCacheKey = () => `aether-${kind}-v1`;
  return material;
}

export function tintSpell(material: MeshBasicMaterial, attribute: MagicAttribute, dark = false): void {
  material.color.setHex(dark ? GRIMOIRES[attribute].secondary : GRIMOIRES[attribute].color);
  if (material.userData.style) material.userData.style.value = attribute === 'fire' ? 2 : attribute === 'wind' ? 1 : 0;
}

export function clockSpell(material: MeshBasicMaterial, time: number): void {
  if (material.userData.clock) material.userData.clock.value = time;
}
