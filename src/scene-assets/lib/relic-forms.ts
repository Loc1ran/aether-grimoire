import { BufferGeometry, Float32BufferAttribute } from '@iwsdk/core';
import { ensureOutwardWinding } from './hardsurface.js';

function solid(vertices: number[][], faces: number[][]): BufferGeometry {
  const positions: number[] = [];
  for (const vertex of vertices) positions.push(vertex[0], vertex[1], vertex[2]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(faces.flat());
  geometry.computeVertexNormals();
  return ensureOutwardWinding(geometry);
}

/** Faceted spell dart. Length runs along local +Z, about 1.2 long. */
export function dartGeometry(): BufferGeometry {
  const sides = 5;
  const mid: number[][] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + 0.35;
    const reach = i % 2 === 0 ? 0.2 : 0.12;
    mid.push([Math.cos(angle) * reach, Math.sin(angle) * reach * 0.62, i % 2 === 0 ? 0.08 : -0.02]);
  }
  const vertices = [[0, 0, 0.78], [0, 0, -0.46], ...mid];
  const faces: number[][] = [];
  for (let i = 0; i < sides; i++) {
    const a = 2 + i;
    const b = 2 + (i + 1) % sides;
    faces.push([0, a, b], [1, b, a]);
  }
  return solid(vertices, faces);
}

/** Tapered streak along local +Z, for trails and sparks. */
export function streakGeometry(): BufferGeometry {
  const vertices = [
    [0, 0, 0.5],
    [0.08, 0.025, -0.15],
    [-0.02, 0.07, -0.2],
    [-0.08, -0.02, -0.12],
    [0.015, -0.07, -0.22],
    [0, 0, -0.55],
  ];
  return solid(vertices, [
    [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
    [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4],
  ]);
}

/** Heater plate. The face lies in XZ and local +Y is the face normal. */
export function heaterGeometry(width = 0.64, height = 0.78, thickness = 0.03): BufferGeometry {
  const half = width / 2;
  const right: Array<[number, number]> = [
    [0, height * 0.5],
    [half * 0.62, height * 0.44],
    [half, height * 0.16],
    [half * 0.86, -height * 0.05],
    [half * 0.4, -height * 0.34],
    [0, -height * 0.5],
  ];
  const outline = right.concat(right.slice(1, -1).reverse().map(([x, z]) => [-x, z] as [number, number]));
  return slab(outline, thickness);
}

/** Irregular stone chip, used for breaks and dust. */
export function wedgeGeometry(): BufferGeometry {
  return solid([
    [-0.55, -0.08, -0.28],
    [0.62, -0.1, -0.16],
    [0.18, -0.12, 0.58],
    [-0.36, -0.05, 0.22],
    [0.04, 0.2, 0.02],
    [0.28, 0.16, -0.22],
  ], [
    [0, 1, 4], [1, 5, 4], [1, 2, 5], [2, 4, 5], [2, 3, 4], [3, 0, 4],
    [0, 5, 1], [0, 3, 5], [3, 2, 5],
  ]);
}

/** Flat scorch, local +Z out of the surface. */
export function charMarkGeometry(): BufferGeometry {
  const outline: Array<[number, number]> = [
    [0.05, 0.72], [0.48, 0.4], [0.7, 0.05], [0.42, -0.28],
    [0.62, -0.58], [0.08, -0.74], [-0.4, -0.5], [-0.68, -0.08],
    [-0.46, 0.36], [-0.18, 0.66],
  ];
  return slab(outline, 0.02);
}

/** Shards lying on the local XY surface, bursting along +Z. */
export function splinterCrownGeometry(): BufferGeometry {
  const vertices: number[][] = [[0, 0, 0.02]];
  const faces: number[][] = [];
  for (let i = 0; i < 7; i++) {
    const angle = i * (Math.PI * 2 / 7) + 0.2;
    const reach = 0.55 + (i % 3) * 0.22;
    const spread = 0.08 + (i % 2) * 0.05;
    const left = angle - spread;
    const right = angle + spread;
    const base = vertices.length;
    vertices.push(
      [Math.cos(left) * 0.12, Math.sin(left) * 0.12, 0.01],
      [Math.cos(angle) * reach, Math.sin(angle) * reach, 0.08 + (i % 2) * 0.05],
      [Math.cos(right) * 0.12, Math.sin(right) * 0.12, 0.01],
    );
    faces.push([0, base, base + 1], [0, base + 1, base + 2], [base, base + 2, base + 1]);
  }
  return solid(vertices, faces);
}

/** Torn vertical opening in the local XY plane. */
export function slitGeometry(): BufferGeometry {
  const outline: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const y = (t - 0.5) * 0.42;
    const pinch = Math.sin(t * Math.PI);
    const bite = 0.045 * pinch * (i % 2 === 0 ? 1 : 0.55);
    outline.push([bite, y]);
  }
  for (let i = 9; i >= 0; i--) outline.push([-outline[i][0] * 0.8, outline[i][1]]);
  return slab(outline, 0.012);
}

/** Candle flame, local +Y up. */
export function flameGeometry(): BufferGeometry {
  const sides = 5;
  const ring: number[][] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    ring.push([Math.cos(angle) * (i % 2 ? 0.45 : 0.7), 0.15, Math.sin(angle) * (i % 2 ? 0.35 : 0.55)]);
  }
  const vertices = [[0, 1.15, 0], [0, -0.15, 0], ...ring];
  const faces: number[][] = [];
  for (let i = 0; i < sides; i++) {
    const a = 2 + i;
    const b = 2 + (i + 1) % sides;
    faces.push([0, b, a], [1, a, b]);
  }
  return solid(vertices, faces);
}

function slab(outline: Array<[number, number]>, thickness: number): BufferGeometry {
  const count = outline.length;
  const half = thickness / 2;
  const vertices: number[][] = [];
  for (const [x, z] of outline) vertices.push([x, -half, z]);
  for (const [x, z] of outline) vertices.push([x, half, z]);
  const faces: number[][] = [];
  for (let i = 1; i < count - 1; i++) faces.push([0, i, i + 1]);
  for (let i = 1; i < count - 1; i++) faces.push([count, count + i + 1, count + i]);
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    faces.push([i, next, count + next], [i, count + next, count + i]);
  }
  return solid(vertices, faces);
}

/** Rounded frame around an open book. The face lies in XY and thickness runs along Z. */
export function auraBand(width: number, height: number, radius: number, band: number, depth = 0.008): BufferGeometry {
  const outer = roundedLoop(width / 2, height / 2, radius, 6);
  const inner = roundedLoop(width / 2 - band, height / 2 - band, Math.max(0.008, radius - band * 0.6), 6);
  const count = outer.length;
  const half = depth / 2;
  const vertices: number[][] = [];
  for (const [x, y] of outer) vertices.push([x, y, -half]);
  for (const [x, y] of inner) vertices.push([x, y, -half]);
  for (const [x, y] of outer) vertices.push([x, y, half]);
  for (const [x, y] of inner) vertices.push([x, y, half]);
  const faces: number[][] = [];
  const top = count * 2;
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    faces.push([top + i, top + next, top + count + next], [top + i, top + count + next, top + count + i]);
    faces.push([i, count + next, next], [i, count + i, count + next]);
    faces.push([i, next, top + next], [i, top + next, top + i]);
    faces.push([count + i, top + count + next, next + count], [count + i, top + count + i, top + count + next]);
  }
  return solid(vertices, faces);
}

function roundedLoop(halfW: number, halfH: number, radius: number, segments: number): Array<[number, number]> {
  const curve = Math.min(radius, halfW - 0.001, halfH - 0.001);
  const corners: Array<[number, number, number]> = [
    [halfW - curve, halfH - curve, 0],
    [-halfW + curve, halfH - curve, Math.PI / 2],
    [-halfW + curve, -halfH + curve, Math.PI],
    [halfW - curve, -halfH + curve, Math.PI * 1.5],
  ];
  const points: Array<[number, number]> = [];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i < segments; i++) {
      const angle = start + (i / segments) * (Math.PI / 2);
      points.push([cx + Math.cos(angle) * curve, cy + Math.sin(angle) * curve]);
    }
  }
  return points;
}
