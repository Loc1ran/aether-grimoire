/** Earliest point on a swept segment that enters a sphere, or Infinity. */
export function segmentSphere(
  ax: number, ay: number, az: number, bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number, radius: number,
): number {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const x = ax - cx, y = ay - cy, z = az - cz;
  const a = dx * dx + dy * dy + dz * dz;
  const c = x * x + y * y + z * z - radius * radius;
  if (c <= 0) return 0;
  if (a < 1e-10) return Infinity;
  const b = x * dx + y * dy + z * dz;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : Infinity;
}

export function extractionProgress(distance: number, length = 0.55): number {
  return Math.max(0, Math.min(1, distance / length));
}

export function canDamageSwing(speed: number, displacement: number, cooldown: number): boolean {
  return speed >= 1.1 && displacement >= 0.065 && cooldown <= 0;
}

export function smooth(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
