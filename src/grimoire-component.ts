import { createComponent, Types } from '@iwsdk/core';

/**
 * State for the one grimoire. Authored defaults match a fresh book;
 * GrimoireSystem may restore a saved reading after init.
 */
export const Grimoire = createComponent('Grimoire', {
  page: { type: Types.Int32, default: 0 },
  turning: { type: Types.Boolean, default: false },
  turnElapsed: { type: Types.Float32, default: 0 },
  turnTarget: { type: Types.Int32, default: 0 },
  emberCast: { type: Types.Boolean, default: false },
  galeCast: { type: Types.Boolean, default: false },
  tideCast: { type: Types.Boolean, default: false },
  veilCast: { type: Types.Boolean, default: false },
  bound: { type: Types.Boolean, default: false },
  stars: { type: Types.Int32, default: 0 },
});
