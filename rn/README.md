# Quietloom — React Native port

TypeScript / React Native (Expo) port of the Capacitor web app in the repo root.
Built side-by-side: nothing in the original app was touched, and this folder is
self-contained. The product rules, DSP constants and research decisions are
ported verbatim — see the root `research.md`, `HANDOFF.md` and `team/` for why
they are what they are.

## Stack

| Concern | Web app (root) | This port |
|---|---|---|
| Language | Vanilla JS | TypeScript (strict) |
| Shell | Capacitor 7 WebView | Expo SDK 57 / React Native 0.86 |
| Audio | Web Audio API | `react-native-audio-api` (same API shape, native engine) |
| Scenes | Canvas 2D | `@shopify/react-native-skia` behind a small Canvas2D adapter |
| UI | Hand-rolled DOM | React components, hand-rolled styles from the same tokens |
| Storage | localStorage | AsyncStorage behind a synchronous cache (`src/core/store.ts`) |
| Ads | @capacitor-community/admob | `react-native-google-mobile-ads` |
| Keep-awake | @capacitor-community/keep-awake | `expo-keep-awake` |
| Billing | scaffold (frozen API) | same scaffold, TODOs target `react-native-iap` |

## What this port fixes that the web build could not

- **Background audio.** The Capacitor build stops when the screen turns off
  outside bedside mode (HANDOFF "known gaps" #2 — the available plugin demanded
  `RECORD_AUDIO`, which we refused). `react-native-audio-api` ships a
  first-party Android `mediaPlayback` foreground service and an iOS `audio`
  background mode, plus a lock-screen media notification with play/pause.
  Configured in `app.json`, wired in `src/audio/background.ts`.
  **No microphone permission anywhere.** Keep that true.
- **A real limiter caveat:** the library has no DynamicsCompressorNode, so the
  final safety stage is a gentle tanh soft-clip (WaveShaper) instead. Levels
  were already balanced upstream (peaks ≤ 0.35 per the root HANDOFF
  measurements), so this stage should rarely engage.

## Layout (file-for-file against the web app)

```
App.tsx                     composition root — port of src/main.js + ui/index.js glue
src/types.ts                shared domain types; the frozen bus/event contracts
src/core/    bus, store, timer        <- src/core/*
src/data/    presets, evidence        <- src/data/*
src/audio/   engine, scheduler, noise, onef, chime, layers/*  <- src/audio/*
             background.ts            NEW: session options + media notification
src/scenes/  canvas.ts (Canvas2D→Skia adapter), renderer, SceneView, 5 scenes
src/services/ ads (+AdBanner), billing, entitlements, native   <- src/services/*
src/ui/      theme (tokens from style.css), layer stack, sheets, hooks,
             components/, screens/, overlays/
```

Frozen contracts (bus event names, engine public API, `Scenes` API, service
APIs) are identical to the web app, so the two codebases stay comparable and
either can be reasoned about from the same docs (`UI-WIRING.md`,
`MONETIZATION-WIRING.md`).

## Run it

```powershell
cd rn
npm install
npx expo prebuild --platform android   # generates android/ from app.json
npx expo run:android                   # build + install on device/emulator
```

Type-check without a device: `npm run typecheck`.

Environment notes for this machine (same as the root README):
- RN 0.86 needs JDK 17+. Android Studio's bundled JBR works.
- Norton's TLS interception can break Gradle downloads here too. If Gradle
  fails with PKIX errors, apply the same merged-truststore fix as the root
  project (`scripts/fix-truststore.ps1` is written for `android/certs/`; point
  it at `rn/android/` after prebuild).

## Before any release (same three money items as HANDOFF, RN edition)

1. **Ad IDs are Google's test units.** Replace `TEST_MODE`/unit ids in
   `src/services/ads.ts` AND the two app ids in the
   `react-native-google-mobile-ads` plugin block of `app.json`.
2. **Billing is a scaffold.** `src/services/billing.ts` reports unavailable;
   the paywall shows "coming soon" for the paid path. The TODO blocks contain
   the `react-native-iap` wiring.
3. **EEA consent (UMP) is still not implemented** — same known gap as the web
   build. `react-native-google-mobile-ads` bundles the UMP SDK; wire it in
   `ads.init()` before launching in Europe.

Also: `app.json` uses `com.quietloom.rn` so a test install can coexist with the
Capacitor app (`com.quietloom.app`). Switch it before shipping if this port
replaces the original.

## Standing product decisions (unchanged — do not erode)

No ads on sleep surfaces. The rewarded-ad grace rule stands. Sleep timer
defaults ON at 45 min. The free tier stays genuinely useful (rain, ocean, pink,
brown). Zero audio files — everything is synthesised. No over-claiming; Deep
Pulse stays labelled experimental, binaural stays badged Emerging.
