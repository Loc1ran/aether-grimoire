import { AssetType, defineAssets } from '@iwsdk/core';
import { createSwordGrip } from './scene-assets/sword-grip.scene-asset.js';
import { createWarden } from './scene-assets/warden.scene-asset.js';
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
  manuscript: { url: publicAssetUrl('textures/codex-manuscript.png'), type: AssetType.Texture, priority: 'critical' },
  'smoke-density': { url: publicAssetUrl('textures/smoke-density.png'), type: AssetType.Texture, priority: 'critical' },
  candle: createCandle(),
  sword: createSword(),
  'sword-grip': createSwordGrip(),
  warden: createWarden(),
  'training-target': createTrainingTarget(),
  'arena-wall': createArenaWall(),
  emitter: createEmitter(),
  'prompt-panel': {
    url: publicAssetUrl('ui/prompt.uikitml'),
    type: AssetType.UIKitML,
    name: 'Prompt Panel',
  },
});
