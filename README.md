# Aether Grimoire

A seated, original fantasy spellcasting trial built with IWSDK 1.1 and TypeScript for immersive WebXR. This repository is a web app, not a Unity project or an Android APK.

```sh
npm install
npm run dev
```

Use the managed browser's **Runtime** view to play and **Editor** to inspect the scene. The grimoire starts hidden. Enter VR, summon it deliberately, and use **Start trial** when ready for incoming projectiles. All controls also appear on the in-world guide. No locomotion is required.

## Hands

| Action | Gesture |
| --- | --- |
| Summon / dismiss | Near the chest, pinch for at least 0.28 seconds and pull upward 12 cm. Finish casting or extraction before dismissing. |
| Rune Bolt | Point, pinch for at least 0.18 seconds, then release. |
| Aegis Circle | Extend an open palm forward, away from the chest, and hold. Lower the hand to recover after three hits break the shield. |
| Astral Rupture | Open the palm near the chest, charge at least 0.65 seconds, then push forward. Maximum charge is 1.6 seconds. |
| Crescent Sever | Hold two fingers for 0.35 seconds, then sweep at least 16 cm. |
| Prepare sword | Close the whole hand within 23 cm of the pages. Proximity alone does nothing. |
| Extract sword | Release, close the hand within 14 cm of the visible hilt, and pull outward 55 cm along the aperture. Pulling backward retracts it. |
| Return sword | Release the grip, preferably near the book. Releasing elsewhere also safely dissolves it back. |

Each hand owns its action independently. The gripping hand cannot cast; the free hand can. Tracking loss cancels casting and returns the weapon safely. The guide shows detected poses, current spell, mana, extraction progress, and hit/block counts.

## Controllers and desktop preview

Controller trigger prepares/releases a bolt; grip handles the sword. Hold A/X for shield, B/Y for blast, and press/hold the thumbstick for slash. Release the blast/slash button after charging, or sweep for a slash. Hold trigger + grip near the torso for 0.6 seconds to summon/dismiss. Bindings and recognition thresholds are in `src/magic-input.ts`.

Desktop: **G** summon, hold/release **1** bolt, hold **2** shield, hold/release **3** blast, hold/release **4** slash. Aim with the mouse. Press/release **E** to prepare the hilt, press **E** again and drag upward while holding it to extract. Keep **E** held while wielding; move the mouse to swing. **R** returns the weapon. Desktop input runs through the same gameplay state machine but does not validate tracked-hand behavior.

Use **Magic** for Shadow/Wind/Fire variants, **handedness** to move the book to the other side, and **Reset trial** to clear projectiles, marks, damage, mana use, and progress. Existing reading-mode save data is untouched.

## Implementation

`iwsdk.config.json` selects `public/scenes/arena.iwsdk.scene.json`. The previous reading scene and scripts remain available. `CombatSystem` coordinates input, `LivingBook`, `WeaponController`, `ArenaCombat`, and shared `ImpactVFX`. Spell, grimoire, surface, and effect-level data live in `src/combat-data.ts`.

Impacts use surface normals, bounded mesh/particle pools, scripted debris, expanding rings, fading cracks, scorch/slash marks, and synthesized spatial sounds. Targets temporarily swap to fragments and reset. The floor and walls retain their collision geometry. High quality permits 8 bursts and 12 marks; `ImpactVFX.setQuality('low')` reduces these to 4 and 6. There are at most 20 projectiles. No camera shake or full-screen post-processing is used.

The procedural art and synthesized audio are original demonstration assets. They are not final production animation/audio assets.

## Checks and Quest validation

```sh
npm run typecheck
npm test
npm run build
```

The automated checks cover swept hit detection, impact budgets/scaling, gesture debounce, tracking-loss cancellation, accidental extraction prevention, signed pulling, rigid blade reveal, and ownership. Emulator scenario scripts under `tests/verify-*.mjs` exercise actual input and inspect runtime state; run them against a managed dev session with browser automation enabled.

Physical Quest validation is still required. With the headset on the same network, open the network URL from `npx @iwsdk/cli dev status`, accept the local development certificate, and enter VR. For USB automation use the project's native Quest test workflow.

1. Start seated with empty hands; verify comfortable book reach for both handedness choices.
2. Summon, dismiss, and resummon ten times; ordinary reaching and fists away from the pages must not trigger actions.
3. Cast every spell using hands, then controllers. Check palm direction, fingertip origin, charge cancellation, and page timing.
4. Prepare, release/regrab, partially extract, retract, finish extraction, and return. Test occlusion/tracking loss at each stage.
5. Swing into the close target, block/deflect incoming sparks, and cast with the free hand while holding the sword. Small jitter must not damage targets.
6. Fire into ground/walls and break the shield; verify normal-aligned marks, attribute effects, audio, cleanup, and full reset.
7. Profile on the intended Quest at its selected refresh rate, including simultaneous shields, fragments, and repeated impacts. Emulator timing is not a Quest performance result.

Guide: [Testing Your Experience](https://iwsdk.dev/guides/02-testing-experience.html).
