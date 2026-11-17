import { createComponent, Types } from '@iwsdk/core';

export const Combat = createComponent('Combat', {
  state: { type: Types.String, default: 'Dormant' },
  mana: { type: Types.Float32, default: 100 },
  attribute: { type: Types.String, default: 'shadow' },
  dominantHand: { type: Types.String, default: 'right' },
  weapon: { type: Types.String, default: 'Stored' },
  extraction: { type: Types.Float32, default: 0 },
  casts: { type: Types.Int32, default: 0 },
  hits: { type: Types.Int32, default: 0 },
  blocks: { type: Types.Int32, default: 0 },
  deflections: { type: Types.Int32, default: 0 },
  tutorialStep: { type: Types.Int32, default: 0 },
  gestureLeft: { type: Types.String, default: 'untracked' },
  gestureRight: { type: Types.String, default: 'untracked' },
  spellLeft: { type: Types.String, default: '' },
  spellRight: { type: Types.String, default: '' },
});

export const TrainingTarget = createComponent('TrainingTarget', {
  health: { type: Types.Float32, default: 100 },
  radius: { type: Types.Float32, default: 0.36 },
  surface: { type: Types.String, default: 'stone' },
  resetAfter: { type: Types.Float32, default: 0 },
});
