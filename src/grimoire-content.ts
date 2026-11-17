export const SCHOOL_IDS = ['ember', 'gale', 'tide', 'veil'] as const;
export type SchoolId = (typeof SCHOOL_IDS)[number];

export const PAGE_COUNT = 6;
export const LAST_PAGE = PAGE_COUNT - 1;

export type CastState = {
  ember: boolean;
  gale: boolean;
  tide: boolean;
  veil: boolean;
  bound: boolean;
};

export type School = {
  id: SchoolId;
  title: string;
  ink: string;
  line: string;
  frequencies: number[];
};

export const SCHOOLS: readonly School[] = [
  {
    id: 'ember',
    title: 'Ember Seal',
    ink: '#ff6a2a',
    line: 'A coal that orbits the book. Pinch the seal to call it.',
    frequencies: [196, 392],
  },
  {
    id: 'gale',
    title: 'Gale Seal',
    ink: '#8fd4ff',
    line: 'A ribbon of wind. Pinch the seal to loose it.',
    frequencies: [587, 784],
  },
  {
    id: 'tide',
    title: 'Tide Seal',
    ink: '#2ec6c0',
    line: 'A ring of living water. Pinch the seal to raise it.',
    frequencies: [311, 466],
  },
  {
    id: 'veil',
    title: 'Veil Seal',
    ink: '#c9a6ff',
    line: 'A lantern that stays. Pinch the seal to light it.',
    frequencies: [440, 659],
  },
];

export function schoolForPage(page: number): School | undefined {
  if (page < 1 || page > SCHOOLS.length) return undefined;
  return SCHOOLS[page - 1];
}

export function castCount(state: CastState): number {
  return (
    (state.ember ? 1 : 0) +
    (state.gale ? 1 : 0) +
    (state.tide ? 1 : 0) +
    (state.veil ? 1 : 0)
  );
}

export function isSchoolCast(state: CastState, id: SchoolId): boolean {
  return state[id];
}
