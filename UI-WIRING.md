# UI wiring — what `main.js` must do

Owner: Frontend. Files in this slice: `index.html`, `src/style.css`, `src/ui/**`, `src/scenes/**`.

> **Status:** `src/main.js` as it stands today already does everything in this document.
> Nothing needs changing. This file is the contract, so it stays correct if `main.js` is
> rewritten again.

---

## 1. The entry point

```js
import { Scenes } from './scenes/renderer.js';
import { initUI, closeTopSheet, anyLayerOpen } from './ui/index.js';

Scenes.attach(document.getElementById('scene-canvas')); // MUST come first
initUI({ engine, Scenes });
```

`Scenes.attach()` must run **before** `initUI()`, because session restore sets the scene.

`initUI` also returns `{ closeTopSheet, anyLayerOpen }` if you prefer not to import them.

### Android back button

```js
Native.onBackButton(() => closeTopSheet());
```

`closeTopSheet()` closes the top-most surface (sheet **or** the bedside / breathing
overlays — they share one layer stack) and returns `true`. It returns `false` when
nothing is open, which is your signal to minimise rather than exit.

### Banner ↔ sheet collisions

`sheet.js` toggles `layer-open` on `<html>` whenever any surface opens or closes.
`anyLayerOpen()` is the programmatic form. A `MutationObserver` on
`documentElement`'s `class` is the cheapest way to keep a native banner in sync
(that is what `main.js` does today).

---

## 2. Bus events

### Emitted by the UI

| Event | Payload | When |
|---|---|---|
| `screen:changed` | `{ name: 'mixer' \| 'bedside' \| 'breathing' }` | Overlay enter/exit, and once at the end of `initUI` |
| `ads:banner` | `{ visible:false, heightPx:0 }` | Entering bedside — collapses the UI's own spacer only. **Ads owns the real policy.** |
| `toast` | `{ message }` | Via `toast()` from `core/bus.js` throughout |
| `scene:changed` | `{ scene }` | UI-internal (persists the scene to settings). Safe to ignore. |
| `preset:cleared` | `{}` | UI-internal (a saved mix replaced a preset). Safe to ignore. |
| `ui:settings` | `{ nurserySafe }` | UI-internal. Safe to ignore. |

### Consumed by the UI

| Event | What the UI does |
|---|---|
| `audio:started` | Play button → Pause, `Scenes.resume()`, starts the sleep timer if enabled |
| `audio:stopped` | Play button → Play, `Scenes.pause()`, cancels the sleep timer |
| `mix:changed` | Syncs every card/slider in place, persists `KEYS.lastMix`, updates scene intensity |
| `timer:tick` | Bottom-bar countdown + bedside sub-line |
| `timer:set` | Bottom-bar label |
| `timer:done` | Toast + `engine.stop()` (idempotent — safe if you also call it) |
| `entitlements:changed` | Rebuilds the layer list and preset chips, repaints the header button |
| `ads:banner` | Sets `--banner-h` on `<html>` and the height of `#banner-spacer`, so the bar lifts above the ad |

---

## 3. Engine API used

Frozen contract only, plus three additive methods, each guarded with `typeof`:

- `engine.getOceanPhase()` — breathing "sync to the waves"
- `engine.setNurserySafe(bool)` — hard cap in the audio graph
- `Ads.setAdsDisabled(true)` — called when the user becomes premium
- `Ads.lastRewardedFailure()` — the paywall grace rule branches on this

---

## 4. Things the UI deliberately does NOT do

- **Never touches audio before a gesture.** `#btn-play` is the only path to `engine.start()`.
- **Does not own banner policy.** It only reserves layout space from `ads:banner`.
- **Does not call `Ads.showBanner()`.** Exiting bedside emits `screen:changed{name:'mixer'}`;
  reconcile from there.
- Calls `Native.keepAwake(true/false)` on bedside enter/exit. `main.js` doing the same on
  `screen:changed` is harmless — `native.js` keeps one request slot.

---

## 5. Persistence (all via `core/store.js`)

| Key | Written by |
|---|---|
| `KEYS.lastMix` | Every `mix:changed`; restored on boot (locked layers forced off) |
| `KEYS.mixes` | The "My mixes" sheet |
| `settings.timerMinutes` / `timerEnabled` / `chime` | Timer sheet (default **45 min, ON**) |
| `settings.nurserySafe` | Volume guide |
| `settings.breathPattern` | Breathing overlay (default `coherence`) |
| `settings.reduceMotion` | The toggle under the volume row |
| `settings.scene` | Whenever a preset sets the scene |

---

## 6. Scenes contract (implemented, frozen)

`Scenes.attach(canvas)` · `setScene('rain'|'embers'|'waves'|'stars')` · `setIntensity(0..1)`
· `setNightMode(bool)` · `pause()` · `resume()` · plus `getScene()` and `isRunning()`.

- Capped at 24 fps by a frame-time accumulator; `devicePixelRatio` clamped to 1.5.
- The rAF loop is **fully cancelled** when `document.hidden`, when paused (audio stopped or
  bedside on), or when reduced motion is active. `pause()` settles to a still composition
  rather than freezing a half-drawn frame.
- `setScene()` also writes `--accent`, `--accent-soft` and `data-scene` onto `<html>`, which
  is how the whole UI re-tints per scene.
- `waves` crest period is `SWELL_PERIOD = 10s` (0.1 Hz), matched to `OCEAN_HZ`. Keep them equal.

---

## 7. Nothing needed from the CEO

The UI is complete and self-contained against today's `engine.js`, `ads.js`, `billing.js`,
`native.js` and `entitlements.js`. Two optional polish items if there is time:

1. `Billing.PRICE_DISPLAY` is read at render time, so a real Play price will appear
   automatically once billing is live.
2. The rewarded-ad **grace rule** (`src/ui/paywall.js`) grants a night pass whenever the ad
   did not come back `declined`. That is intentional. Do not "fix" it.
