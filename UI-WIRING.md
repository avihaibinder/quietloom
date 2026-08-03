# UI wiring — what `App.tsx` must do

Owner: Frontend. Files in this slice: `App.tsx`, `src/ui/**`, `src/scenes/**`.

> **Status:** `App.tsx` as it stands today already does everything in this document.
> Nothing needs changing. This file is the contract, so it stays correct if the
> composition root is rewritten again.

---

## 1. The entry point

```tsx
await hydrate();              // MUST come first — the store is async, the app is not
restoreSession();             // decides the scene and the starting mix
// ...then render <Root/>
```

`hydrate()` loads every persisted key into `core/store`'s cache. Everything downstream reads
settings synchronously, so nothing may render before it resolves.

`restoreSession()` runs before first paint because it sets the scene and the mix, and calls
`primeSceneAccent()` so the UI is tinted correctly on the very first frame.

The render tree order matters — later siblings paint on top:

```tsx
<SceneView/>        // the Skia canvas, pointerEvents="none"
<MixerScreen/>      // the scrolling main surface
<MoonTap/>          // absolutely positioned over the moon
<AdBanner/>         // pinned above the bar by the root
<BottomBar/>        // transport
<TimerSheet/> <PaywallSheet/> <EvidenceSheet/> <MixesSheet/>
<BreathingOverlay/> <BedsideOverlay/> <ToastHost/>
```

### Android back button

```ts
Native.onBackButton(() => closeTopLayer());
```

`closeTopLayer()` closes the top-most surface (sheet **or** the bedside / breathing overlays — they
share one layer stack) and returns `true`. It returns `false` when nothing is open, which is the
signal to let the system default happen: on a root activity that moves the task to the back rather
than destroying it. Someone pressing back at bedtime wants the rain to keep playing.

### Banner ↔ sheet collisions

`src/ui/layers.ts` is the layer stack. `anyLayerOpen()` is the query; `subscribeLayers(fn)` is the
notification. The root subscribes and reconciles the banner from there — no observers, no polling.

---

## 2. Bus events

### Emitted by the UI

| Event | Payload | When |
|---|---|---|
| `screen:changed` | `{ name: 'mixer' \| 'bedside' \| 'breathing' }` | Overlay enter/exit, and once at the end of boot |
| `ads:banner` | `{ visible:false, heightPx:0 }` | Entering bedside — collapses the UI's own spacer only. **Ads owns the real policy.** |
| `toast` | `{ message }` | Via `toast()` from `core/bus` throughout |
| `scene:changed` | `{ scene }` | UI-internal (persists the scene to settings). Safe to ignore. |
| `preset:cleared` | `{}` | UI-internal (a saved mix replaced a preset). Safe to ignore. |
| `ui:settings` | `{ nurserySafe }` | UI-internal. Safe to ignore. |

### Consumed by the UI

| Event | What the UI does |
|---|---|
| `audio:started` | Play button → Pause, `Scenes.resume()`, starts the sleep timer if enabled |
| `audio:stopped` | Play button → Play, `Scenes.pause()`, cancels the sleep timer |
| `mix:changed` | Re-renders the mixer from the new state, persists `KEYS.lastMix`, updates scene intensity |
| `timer:tick` | Bottom-bar countdown + bedside sub-line |
| `timer:set` | Bottom-bar label |
| `timer:done` | Toast + `engine.stop()` (idempotent — safe if the root also calls it) |
| `entitlements:changed` | Re-renders the layer list, preset chips and the header pill |
| `ads:banner` | Reserves bottom padding on the mixer so the bar and content lift above the ad |

`mix:changed` is the single source of truth for the mixer: state is held in `MixerScreen` and fed
down. A slider, a preset and a saved mix therefore all move the UI by the same path.

---

## 3. Engine API used

Frozen contract only, plus three additive methods:

- `engine.getOceanPhase()` — breathing "sync to the waves"
- `engine.setNurserySafe(bool)` — hard cap in the audio graph
- `Ads.setAdsDisabled(true)` — called when the user becomes premium
- `Ads.lastRewardedFailure()` — the paywall grace rule branches on this

---

## 4. Things the UI deliberately does NOT do

- **Never touches audio before a gesture.** The play button is the only path to `engine.start()`.
- **Does not own banner policy.** It only reserves layout space from `ads:banner`.
- **Does not call `Ads.showBanner()`.** Exiting bedside emits `screen:changed{name:'mixer'}`;
  the root reconciles from there.
- Calls `Native.keepAwake(true/false)` on bedside enter/exit. The root doing the same on
  `screen:changed` is harmless — `native.ts` keeps one request slot per reason.

---

## 5. Persistence (all via `core/store`)

| Key | Written by |
|---|---|
| `KEYS.lastMix` | Every `mix:changed`, debounced 400 ms; flushed when the app backgrounds |
| `KEYS.mixes` | The "My mixes" sheet |
| `settings.timerMinutes` / `timerEnabled` / `chime` | Timer sheet (default **45 min, ON**) |
| `settings.nurserySafe` | Volume guide |
| `settings.breathPattern` | Breathing overlay (default `coherence`) |
| `settings.reduceMotion` | The toggle under the volume row |
| `settings.scene` | Whenever a preset sets the scene |

Settings have no bus event. `useSettings()` is the single re-render path; anything writing settings
from outside a component calls `notifySettingsChanged()`.

---

## 6. Scenes contract (implemented, frozen)

`Scenes.setScene('rain'|'embers'|'waves'|'stars'|'moonrise')` · `setIntensity(0..1)` ·
`setNightMode(bool)` · `pause()` · `resume()` · plus `getScene()` and `isRunning()`.

- Capped at 24 fps by a frame-time accumulator inside `SceneView`.
- The loop is **fully cancelled** when the app is backgrounded, when paused (audio stopped or
  bedside on), or when reduced motion is active — the setting *or* the OS switch. `pause()` settles
  to a still composition rather than freezing a half-drawn frame.
- Scenes no longer publish accent colours. `SCENE_ACCENTS` in `src/ui/theme.ts` owns the palette
  and `useSceneAccent()` is how a component reads it.
- `waves` crest period is `SWELL_PERIOD = 10s` (0.1 Hz), matched to `OCEAN_HZ`. Keep them equal.
- Scenes draw through `Ctx2D` (`src/scenes/canvas.ts`), a Canvas2D-shaped adapter over Skia. It
  implements only the subset the scenes use; add to it rather than reaching for raw Skia in a
  scene, or the five scenes stop being comparable to each other.

---

## 7. Nothing needed from the CEO

The UI is complete and self-contained against today's `engine.ts`, `ads.ts`, `billing.ts`,
`native.ts` and `entitlements.ts`. Two optional polish items if there is time:

1. `Billing.PRICE_DISPLAY` is read at render time, so a real Play price will appear automatically
   once billing is live.
2. The rewarded-ad **grace rule** (`src/ui/sheets/PaywallSheet.tsx`) grants a night pass whenever
   the ad did not come back `declined`. That is intentional. Do not "fix" it.
