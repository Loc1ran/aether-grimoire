export type MagicAttribute = 'shadow' | 'wind' | 'fire';
export type SurfaceKind = 'stone' | 'metal' | 'wood' | 'dirt' | 'barrier';
export type SpellId = 'bolt' | 'shield' | 'slash' | 'blast';
export type ImpactLevel = 1 | 2 | 3 | 4;

export const GRIMOIRES = {
  shadow: { name: 'The Umbral Codex', color: 0xd0c5ac, secondary: 0x353a43, auraIntensity: 0.8, hoverSpeed: 0.8, pageSpeed: 1, pitch: 148 },
  wind: { name: 'The Verdant Testament', color: 0xb5c9cf, secondary: 0x455258, auraIntensity: 0.65, hoverSpeed: 1.3, pageSpeed: 1.4, pitch: 392 },
  fire: { name: 'The Cinder Covenant', color: 0xffad4b, secondary: 0xa93724, auraIntensity: 1, hoverSpeed: 1, pageSpeed: 1.15, pitch: 220 },
} as const;

export const SPELLS = {
  bolt: { name: 'Rune Bolt', cost: 8, cooldown: 0.45, charge: 0.18, page: 1, damage: 18, speed: 8, power: 1 },
  shield: { name: 'Aegis Circle', cost: 0, cooldown: 0.3, charge: 0.35, page: 2, damage: 0, speed: 0, power: 2, drain: 8, durability: 3 },
  slash: { name: 'Crescent Sever', cost: 16, cooldown: 0.8, charge: 0.35, page: 3, damage: 30, speed: 6, power: 2 },
  blast: { name: 'Astral Rupture', cost: 28, cooldown: 1.4, charge: 1.6, page: 4, damage: 60, speed: 5, power: 4 },
} as const;

export const IMPACT_PROFILES = {
  stone: { color: 0x88818c, dust: 0xaaa3ad, mark: 0x211a2a, debris: 12, sparks: 5, dustOpacity: 0.2, markLife: 8, sound: 120 },
  metal: { color: 0xb5b5c2, dust: 0x636a7a, mark: 0x423a50, debris: 3, sparks: 16, dustOpacity: 0.06, markLife: 5, sound: 650 },
  wood: { color: 0x987044, dust: 0x997653, mark: 0x382818, debris: 10, sparks: 4, dustOpacity: 0.17, markLife: 7, sound: 190 },
  dirt: { color: 0x66503f, dust: 0x857365, mark: 0x3b3029, debris: 8, sparks: 3, dustOpacity: 0.2, markLife: 6, sound: 90 },
  barrier: { color: 0xd3bbff, dust: 0x8a67af, mark: 0xb78aff, debris: 12, sparks: 12, dustOpacity: 0.04, markLife: 0.65, sound: 520 },
} as const;

export const IMPACT_LEVELS = [
  { radius: 0.28, duration: 0.75, density: 0.45 },
  { radius: 0.55, duration: 1, density: 0.65 },
  { radius: 0.95, duration: 1.3, density: 0.85 },
  { radius: 1.5, duration: 1.6, density: 1 },
] as const;

export function impactLevel(power: number): ImpactLevel {
  return (Number.isFinite(power) ? Math.max(1, Math.min(4, Math.ceil(power))) : 1) as ImpactLevel;
}

export function impactDensity(distanceSquared: number, lowQuality: boolean): number {
  if (!Number.isFinite(distanceSquared) || distanceSquared < 0) return 0;
  return (distanceSquared > 144 ? 0.25 : distanceSquared > 36 ? 0.5 : 1) * (lowQuality ? 0.6 : 1);
}
