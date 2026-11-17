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
| Sword aura | Make a firm, full swing to launch a cutting wave forward. Small movements do not fire it. |
| Return sword | Point the tip down above the pages, enter the opening from the top, and push the blade all the way to the hilt. Partial insertion can be stopped or reversed. |

Each hand owns its action independently. The sword hand cannot cast; the free hand can. Relaxing your grip keeps the sword equipped. Tracking loss freezes it and clears swing momentum; it does not store it. The guide shows detected poses, current spell, mana, insertion/extraction progress, and hit/block counts. Dismissal is blocked until the sword has been manually sheathed. Reset explicitly clears the training session.

## Controllers and desktop preview

Controller trigger prepares/releases a bolt; grip handles the sword. Hold A/X for shield, B/Y for blast, and press/hold the thumbstick for slash. Release the blast/slash button after charging, or sweep for a slash. Hold trigger + grip near the torso for 0.6 seconds to summon/dismiss. Bindings and recognition thresholds are in `src/magic-input.ts`.

Desktop: **G** summon, hold/release **1** bolt, hold **2** shield, hold/release **3** blast, hold/release **4** slash. Press/release **E** to prepare the hilt, press **E** again and drag upward while holding it to extract. Release **E** after extraction. **Left click and drag** chooses a horizontal, diagonal, or overhead sword cut; hold for 0.45 seconds before releasing to empower it. **F** performs a quick alternating cut. Moving the mouse alone does not attack. **Right click** raises a counter guard: intercept during its first 0.32 seconds to destroy a spell and empower the next cut. **V** creates Wind Vortex. **Q**, at 100 Resolve, performs Black Divider. **T** starts or restarts the Warden encounter. Hold **R** and drag downward to push the sword into the book. Pressing **R** alone does not store it.

While wielding in VR, swing the actual blade to make a Dimension Cut. The sword hand's **A/X** opens the counter window; the free hand's **thumbstick** casts Wind Vortex; the sword hand's **B/Y** arms Black Divider at 100 Resolve, which releases on the next swing. With tracked hands, pinch the sword hand to counter, show two fingers with the free hand for Vortex, or hold four fingers for 0.6 seconds to arm Divider. Ordinary free-hand casting remains available.

The Obsidian Warden has 360 health and an armor phase. Cuts and the vortex break its armor, creating a five-second damage opening; below half health it attacks faster. Successful hits and timed counters build Resolve. Black Divider bypasses armor. Defeating the Warden stops its attacks and displays victory; the sword remains equipped until manually returned. Desktop attacks have windup, cutting, and recovery phases; damage and signature cuts are enabled only during the cutting phase.

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
