import { AssetType, defineAssets } from '@iwsdk/core';
import { createCandle } from './scene-assets/grimoire.scene-asset.js';
import { createSword, createTrainingTarget, createArenaWall, createEmitter } from './scene-assets/combat.scene-asset.js';
import {
  createFloorRing,
  createScriptoriumFloor,
} from './scene-assets/scriptorium.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  'scriptorium-floor': createScriptoriumFloor(),
  'floor-ring': createFloorRing(),
  grimoire: { url: publicAssetUrl('models/aether-codex.glb'), type: AssetType.GLTF },
  candle: createCandle(),
  sword: createSword(),
  'training-target': createTrainingTarget(),
  'arena-wall': createArenaWall(),
  emitter: createEmitter(),
  'prompt-panel': {
    url: publicAssetUrl('ui/prompt.uikitml'),
    type: AssetType.UIKitML,
    name: 'Prompt Panel',
  },
});
