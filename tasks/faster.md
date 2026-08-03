# Task: FASTER — the app is too slow

**Opened by:** the founder, 2026-08-03
**Owner:** CEO → Software Team Lead
**Status:** code landed, reviewed, and built — **awaiting the founder's device verdict**.
Nothing here is verified. Two APKs exist for a before/after comparison; see the CEO closing entry.

---

## The report

> "I have run the app. Although it looks good, the entire app is SUPER SLOW — like way too
> slow. The scene, the screens, everything."

That is the whole brief and it is enough. Nobody is to argue with it, ask for a repro, or
report back that a build passed. The founder held the phone and it was slow. Our job is to
find out why and fix it.

## What the CEO wants out of this

1. **Research.** Why React Native apps are slow in general, and what the specific pitfalls
   are for *this* stack — RN 0.86, Expo SDK 57, Hermes, the New Architecture,
   `@shopify/react-native-skia`, `react-native-audio-api`.
2. **A full read of the code** against that list. Not a spot check — every file in `src/`
   and `App.tsx`.
3. **Fixes.** Ranked by how much they actually buy, applied with disjoint file ownership.

## The CEO's standing leads

Not conclusions. Start here, and say so plainly if the evidence goes elsewhere.

**Lead 1 — is the founder even running a release build?** `HANDOFF.md` says every device run
so far has been a debug build. A React Native debug build is not "release minus a bit"; it is
a different performance class — dev-mode React with its extra checks, an unminified dev
bundle, LogBox, and every `console.*` crossing the bridge. If the answer is "debug", a large
share of the complaint may evaporate on a release build and we must know that *before* anyone
refactors anything. **Answer this first. It is cheap and it re-scopes everything else.**

**Lead 2 — the renderer repaints through React state, 24 times a second.**
[`src/scenes/SceneView.tsx`](../src/scenes/SceneView.tsx) calls `setPicture(...)` inside the
rAF callback. Every frame that is: a new `Ctx2D`, a new `SkPicture` via `createPicture`, a
React re-render, and a commit to the native view tree — 24× a second, all night. The
documented Skia pattern for animation is to drive the canvas from the UI thread and not go
through React state per frame.

**Lead 3 — this got slow at a knowable moment.** Until the `performance.now()` fix landed
yesterday, the rAF loop ran but *never painted* — the accumulator was ~1.75e12 ms negative.
So the scene render cost has never once been paid on a device until now. The slowness and
that fix are almost certainly the same event. This is a strong hint that the renderer is the
centre of gravity, but it does **not** explain slow *screens* on its own — see lead 4.

**Lead 4 — "the screens too."** The founder says everything is slow, not just the scene. A
24fps repaint loop starves the JS thread that also drives touch, layout and the sheets, so
lead 2 could explain it entirely. But do not assume that. Look for the ordinary React
mistakes independently: work in render, unmemoized props into lists, context churn, effects
that fire per keystroke or per frame, and anything subscribing every component to a
high-frequency bus event.

## Rules for this task

- **Verify the outcome, not the mechanism.** "It typechecks" and "the build passed" are not
  findings. A finding is "this does N allocations per frame, here is the line."
- **Measure or say you didn't.** If a claim is reasoning rather than measurement, mark it
  `(reasoned, not measured)`. We have shipped a confident wrong answer before.
- **No behaviour changes smuggled in as optimisation.** The 24fps cap, the pause-when-not-
  playing rule, the 90-second audio scheduling horizon, the exact 10.000 s ocean period and
  everything in `team/README.md` § Standing product decisions are untouchable without the
  CEO. Making the app fast by making it do less of what it promises is not a fix.
- **Ownership is disjoint.** Do not edit a file assigned to somebody else. If you need a
  change there, write it in your log entry and it will be routed.

---

## How to log

**Every person logs when they start and when they stop, and what they are about to do or
what they did.** That is the founder's instruction and it is not optional.

This file is written by many people at once, so **append only** — never open it with an
editor and never rewrite it. Use PowerShell:

```powershell
$entry = @'

### <ROLE> — <started|finished>  <!-- timestamp filled below -->
...your lines...
'@
Add-Content -Path tasks/faster.md -Value $entry -Encoding utf8
```

Get a real timestamp with `Get-Date -Format 'HH:mm:ss'`. If `Add-Content` fails because
another role holds the file, wait a second and try again.

Entry shape:

```
### Senior Frontend Engineer — started 14:02:11
About to: audit src/scenes/** for per-frame allocation and React-state repaint.

### Senior Frontend Engineer — finished 14:31:40
Did: read SceneView, canvas.ts, renderer.ts and all five scenes.
Found: <the finding, with file:line>
Changed: <files, or "nothing — investigation only">
Verified: <how, or "not verified — reasoned only">
```

---

## Assignments

| Role | Scope | Files it may touch |
|---|---|---|
| Software Team Lead | Triage, sizing, the split, final technical review | none (review only) |
| Performance Research | Web research: RN/Expo/Skia/Hermes performance pitfalls | none (research only) |
| Senior Platform Engineer | Build posture: debug vs release, Hermes, New Architecture, bundle | `app.json`, `package.json`, build scripts |
| Senior Frontend Engineer | The renderer and the scene layer | `src/scenes/**` |
| Junior Frontend Engineer | Screens, components, hooks — React-level cost | `src/ui/**` |
| Audio Engineer | Main-thread cost of the engine, node counts | `src/audio/**` |
| QA & Verification | How we prove it got faster; blocks a bad fix | none |

CEO holds `App.tsx`, `src/core/**`, `src/types.ts` and integration.

---

## Work log

<!-- APPEND BELOW THIS LINE. Oldest first. Never edit an entry that is not yours. -->

### CEO — started 2026-08-03
Did: read the report, the charters and the working tree. Wrote this brief. Recorded four
standing leads above, the strongest being that the app became slow at the moment the
renderer first began painting, and that nobody has yet confirmed whether the founder's
build was debug or release.
Changed: `tasks/faster.md` (new).
Next: dispatching the team.

### Software Team Lead — started 15:11:40
About to: triage the FASTER report. Reading the seams the specialists do not own — `App.tsx`,
`src/core/**` (bus, store), `src/ui/hooks.ts`, and how the bus, store and render tree interact.
Looking specifically for re-renders at animation frequency, sync writes on a hot path, JS-thread
work that belongs on the UI or audio thread, and effect dependency churn. Investigation only —
I will change no code.

### Performance Research — started 15:12:06
About to: web research on RN 0.86 / Expo SDK 57 / Hermes / New Architecture / @shopify/react-native-skia 2.6.2 /
react-native-audio-api 0.13 / reanimated 4.5.1 + worklets 0.10 performance pitfalls. Priorities: (1) debug vs
release cost with real figures, (2) the documented correct way to animate a Skia canvas in RN 2.x and whether
per-frame React setState of an SkPicture is a named anti-pattern, (3) JS-thread starvation effects on touch and
navigation, (4) ordinary React re-render killers, (5) SDK 57 / RN 0.86 specific regressions.
Research only — I will change no code.

### Senior Platform Engineer — started 15:12:17
About to: answer CEO Lead 1 — debug vs release. Establishing from the repo what a developer
running this project actually gets (README, package.json scripts, app.json, scripts/*.ps1),
then auditing build posture for runtime speed: Hermes, newArchEnabled, expo-build-properties,
ProGuard/R8/minify, release signing, the plugins/ config plugins, and dev-only code on hot
paths. Also writing the recipe for a release build the founder can install, including whether
the ad-SDK autolinking exclusion or missing signing config blocks it. Investigation only —
I will change no code and no config.

### Senior Frontend Engineer — started 15:12:39
About to: audit `src/scenes/**` end to end — SceneView.tsx, renderer.ts, canvas.ts, types.ts and
all five scenes (rain, embers, waves, stars, moonrise). Testing CEO Lead 2 hardest: whether driving
the frame loop through React `setPicture()` per frame is the documented anti-pattern for our exact
`@shopify/react-native-skia` version, and what the correct API is instead. Then per-frame allocation,
per-scene draw-call counts (moonrise especially — it is now on every launch), blur/ImageFilter cost,
shader and path rebuilds, O(viewport-area) particle counts, still-frame vs animated work, and whether
the rAF loop is genuinely fully cancelled on stop / background / bedside / reduced-motion.
Investigation only — I will change no code.

### Junior Frontend Engineer — started 15:13:05
About to: audit src/ui/** end to end (~4,300 lines / ~25 files) for React-level performance
mistakes: work in render, new object/array/inline-closure props, missing React.memo (LayerCard
especially), effect/callback/memo dependency churn, high-frequency state (sliders, breathing
pacer, timer countdown), Animated without useNativeDriver, unvirtualized .map() lists, bus/store
subscriptions causing wide re-renders, and sheets/overlays doing work while closed/unmounted.
Investigation only — I will change no code.

### Audio Engineer — started 15:13:26
About to: audit `src/audio/**` end to end (engine.ts, noise.ts, scheduler.ts, onef.ts, chime.ts,
background.ts, types.ts and all nine layers) for JS-main-thread cost while playing. Answering:
how much work the scheduler does per wake, the node count for the default and a rich preset, the
number of JS->native crossings per play/stop/preset-swap, every setInterval/setTimeout in the
engine, whether the noise.ts voice pool actually reuses nodes, and whether anything runs while the
engine is STOPPED. Ruling the engine in or out as a contributor to the general UI slowness.
Investigation only — I will change no code.

### QA & Verification — started 15:13:50
About to: define how we will prove the app actually got faster, before any fix lands. Producing
(1) a before/after measurement protocol the founder can realistically run on the real device,
using tools that exist on this machine; (2) the user-visible pass/fail checks that turn "the
entire app is SUPER SLOW" into things a human can judge without instruments; (3) a trap list of
the ways this task is most likely to produce a fix that only looks right; (4) the regression
subset of my release checklist that must be re-run after a performance refactor. Also recording
what I can and cannot verify from this build machine.
I change no code and assign no work. I can block.

### Software Team Lead — finished 15:18:11
Did: read `App.tsx`, `src/core/*` (bus, store, timer), `src/ui/hooks.ts`, and every seam between
them — the whole bus subscriber graph, the render tree under `Root`, `src/scenes/SceneView.tsx` +
`renderer.ts` + `canvas.ts` at the boundary, `src/audio/engine.ts` `getState`/emit sites,
`src/audio/background.ts`, and the ui screens/overlays that consume high-frequency events.
Ran `npm run typecheck`: clean.

Found (all `(reasoned, not measured)` unless marked otherwise — I ran no profiler and no device):

1. `mix:changed` is an animation-frequency event with a 5-way fan-out and nobody treats it as one.
   `@react-native-community/slider` `onValueChange` (`src/ui/components/SliderRow.tsx:88`) calls
   `engine.setLayerVolume` per touch-move. `src/audio/engine.ts:299` (and :289/:306/:318/:399)
   emits `mix:changed` with `this.getState()`, and `getState()` (`src/audio/engine.ts:366`)
   rebuilds 1 + 11 + 11 = 23 objects every call. Five subscribers: `App.tsx:249`,
   `src/ui/screens/MixerScreen.tsx:81` (`setState` -> re-renders the ENTIRE mixer: PresetRow, 11
   LayerCards, ~13 SliderRows, MasterRow — roughly 60-100 component instances), 
   `src/ui/sheets/MixesSheet.tsx:50` (`setState` + `useMemo` at :52, fires even while the sheet
   is CLOSED), `src/ui/overlays/BedsideOverlay.tsx:109` (guarded, fine),
   `src/audio/background.ts:120` (dedup-guarded, fine). Dragging any slider is the worst thing a
   user can do to this app, and it is the first thing they do.

2. The mix:changed -> scene seam repaints the whole Skia picture per slider tick while paused.
   `App.tsx:260` calls `Scenes.setIntensity` on every `mix:changed`. `setIntensity`
   (`src/scenes/renderer.ts:187`) calls `notify()` when `paused || reducedMotion()`, which wakes
   `SceneView`'s `evaluate` (`src/scenes/SceneView.tsx:92`) -> `render(0,false)` -> a fresh
   `Ctx2D` + `createPicture` + `setPicture`. For the rain scene that also allocates a fresh
   gradient shader every time (`src/scenes/rain.ts:156` in `drawStill`). Nobody owns this line:
   App.tsx is the CEO's, renderer.ts is Frontend's.

3. A scroll of the mixer re-renders the whole app tree ~7x/second.
   `MixerScreen` publishes control rects on a 140 ms debounce (`MixerScreen.tsx:125-138`) as a
   BRAND NEW array of new objects, into `Root`'s `setAvoidRects` (`App.tsx:163`, `:358`).
   Identity always changes, so `Root` re-renders, and nothing under it is memoized — SceneView,
   MixerScreen, MoonTap, AdBanner, BottomBar, 4 sheets, 2 overlays, ToastHost, all of it.

4. BUG, not perf: the breathing pacer never animates. `src/ui/overlays/BreathingOverlay.tsx:189`
   seeds `lastFrame` with `Date.now()` while `tick` (:140) is handed `performance.now()` — the
   EXACT bug just fixed in SceneView, documented at `src/scenes/SceneView.tsx:78-83`. `acc` goes
   to about -1.75e12 and never climbs back past `FRAME_MS`. Same for `phaseStart` at :191/:202/
   :225/:245 vs `now` at :168. The circle sits frozen at `MIN_SCALE` showing "Ready" forever.
   A frozen screen reads as a slow screen.

5. `reanimated` 4.5.1, `react-native-worklets` 0.10.1 and `react-native-gesture-handler` 2.32
   are installed and autolinked but imported by ZERO app files, and there is NO `babel.config.js`
   and NO `metro.config.js` anywhere in the repo. Reanimated 4 without its worklets babel plugin is
   a native runtime being installed at startup for nothing. Platform must confirm what babel preset
   is actually applying.

6. `src/ui/hooks.ts:34` — `useEffect` with no dependency array, so every `useBusEvent` schedules
   a passive effect on every render of its host. 24 call sites. Small, but it is paid on the hot path.

Not a problem, checked and cleared: `src/core/bus.ts` (copies the handler set per emit — 
correct, cheap); `src/core/store.ts` `write` is cache-sync + fire-and-forget AsyncStorage, and the
only hot caller is debounced 400 ms at `App.tsx:252`; `background.ts` dedupes the notification;
`BedsideOverlay` guards on `isBedsideOpen()`; `Sheet` returns null when closed; every effect
dep array except `hooks.ts:34` is correct and no subscription churns.

Also confirms Lead 1 from my side: `HANDOFF.md:76` says the only device run was a debug build and
`HANDOFF.md:226` says "No release signing config. Debug builds only." (measured — that is the file
saying it, not a device test.) Platform owns proving it.

Changed: nothing — investigation only, per the wave rules.
Verified: not verified on a device. Every claim above is reading, not measurement, and is marked so.

### Senior Platform Engineer — finished 15:18:45
Did: audited build posture end to end — README.md, HANDOFF.md, package.json, app.json,
plugins/withWindowsGitBashPath.js, scripts/*.ps1, the generated android/ tree, the built
app-debug.apk, and .expo/dev/logs/. Investigation only.

**LEAD 1 ANSWERED — it was a debug build, confirmed three independent ways (measured):**
1. `android/app/build/outputs/apk/debug/app-debug.apk` (95.4 MB, 14:55:12 today) is the ONLY
   artifact ever built. No release/ output directory exists.
2. The APK contains **no JS bundle** — `assets/` holds only `app.config`. JS is served live
   by Metro, so `__DEV__`=true, React dev build, unminified, Hermes parses source instead of
   loading precompiled .hbc bytecode.
3. `.expo/dev/logs/start.log`: `devserver:start mode=development` at 14:55:13 (1 s after the
   APK), then `metro:client_log` `[quietloom] ready` from the device at 14:55:37. Merged
   manifest `android:debuggable="true"`, `usesCleartextTraffic="true"`.
   The documented workflow guarantees this: README.md:40 / HANDOFF.md:18 both say
   `npx expo run:android`, and expo CLI `run/android/index.js:111` +
   `resolveGradlePropsAsync.js:36` default `--variant` to `debug`.

**Config audit (all measured from the generated tree):**
- Hermes ON — `android/gradle.properties:42`, and `libhermesvm.so` is in the APK. Correct.
- New Architecture ON — `android/gradle.properties:38`; `libappmodules.so` (codegen) in the
  APK. It is NOT a lever: `@react-native/gradle-plugin/.../ProjectUtils.kt:34` is literally
  `fun Project.isNewArchEnabled(): Boolean = true`, and ReactRootProjectPlugin.kt:72 errors that
  `newArchEnabled=false` is unsupported since RN 0.82. Both native halves are new-arch ready
  (`@shopify/react-native-skia` 2.6.2 codegenConfig type "all"; `react-native-audio-api`
  0.13.2 type "modules"). Nothing to change and nothing incompatible.
- `expo-build-properties` is NOT installed and not in app.json. All Gradle values are template
  defaults.
- **A release build IS producible today.** `android/app/build.gradle:112-115` defines a
  `release` buildType signing with `signingConfigs.debug`, and `android/app/debug.keystore`
  exists. HANDOFF.md:226 "No release signing config" is true only about a *production upload*
  keystore — it does not block an installable comparison build.
- R8/minify OFF even in release: `android/app/build.gradle:69`
  (`android.enableMinifyInReleaseBuilds` defaults false) and no override in gradle.properties.
  Leave it off for the first comparison — one variable at a time.
- `reactNativeArchitectures` = all four (gradle.properties:31): build time and APK size only.
- `EX_DEV_CLIENT_NETWORK_INSPECTOR=true` (gradle.properties:58) — debug-only instrumentation.
- React Compiler is OFF — `.expo/dev/logs/start.log` metro:config `"reactCompiler":false`.
  SDK 57 supports `experiments.reactCompiler` (`@expo/config-types` ExpoConfig.d.ts:256).
  A candidate for lead 4, but AFTER the release comparison. Not my call to enable.
- app.json and `plugins/withWindowsGitBashPath.js` cost nothing at runtime — the plugin only
  patches an Exec task's PATH at build time.

**console.\* audit (measured):** 53 real call sites in `src/` + `App.tsx`, and
**ZERO on any hot path** — none in `src/scenes/` at all; `core/bus.ts:35` and
`audio/scheduler.ts:116` are inside `catch` blocks, not steady state. The "every console
crosses the bridge" concern is real in debug (start.log proves the channel is live) but it is
NOT a material share of this slowdown. Do not spend a wave deleting logs.

**Handed to other owners (not mine to touch):**
- Skia logs 5 deprecation warnings per launch (start.log): `SkPath.arcToOval/moveTo/lineTo/
  close/quadTo` are deprecated in Skia 2.x in favour of `Skia.PathBuilder`. Fires 5x per
  launch, so module scope not per frame — but it says `src/scenes/canvas.ts` is on Skia's
  legacy mutable-path API. For the Senior Frontend Engineer.
- `SYSTEM_ALERT_WINDOW` appears in the merged **debug** manifest. Source is
  `node_modules/react-native/ReactAndroid/src/debug/AndroidManifest.xml` — debug-only, absent
  from release. Our trust claim holds; I will re-verify on the release merged manifest.
- `android/gradle.properties` has NO `systemProp.javax.net.ssl.trustStore` lines, which
  README.md:123-129 says must be re-added after every prebuild. It built anyway because the
  Gradle module cache is warm (185 groups). A release build with minify OFF should need no new
  downloads, but this is the one real risk.

Changed: **nothing — investigation only. No code, no config.**
Verified: measured from the generated android/ tree, the built APK's zip entries, the RNGP and
expo-CLI sources in node_modules, and the Metro dev-server logs. The size of the debug-vs-release
gap itself is (reasoned, not measured) — closing that is exactly what the release build is for.

### Audio Engineer — finished 15:18:46
Did: read all 17 files under src/audio/ (engine, scheduler, noise, onef, chime, background, types,
nine layers), plus the react-native-audio-api JS wrapper layer (BaseAudioContext, AudioNode,
AudioParam, AudioBufferBaseSourceNode, AudioScheduledSourceNode) and its native event registry, to
cost a JS->native crossing properly instead of guessing.

VERDICT: the audio engine is NOT a meaningful contributor to the general slowness. High confidence.
The decisive fact (measured by reading the call graph): the engine does literally zero JS
main-thread work while stopped. new AudioEngine() at engine.ts:520 only builds a plain state record
and registers one AppState listener. _ensureContext() has exactly two call sites, start() at
engine.ts:225 and playChime() at engine.ts:339 — so there is no AudioContext, no Scheduler and no
setInterval until the user taps play. There is exactly one setInterval in the whole engine
(scheduler.ts:62) and it only exists between start() and stop(). The founder saw the welcome screen
and the scene stutter before any of this exists.

Found (ranked, engine-side, all real but none of them "the whole app is slow"):

1. scheduler.ts:88 + :111 — the 90 s horizon is filled in ONE synchronous burst inside add(),
   which runs inside start() / applyMix(). Default preset (rainfall: rain@0.5 + pink) that is
   ~1,305 droplets = ~2,610 native nodes and ~61,000 JSI crossings in one block, on top of ~22 s of
   noise-buffer synthesis in JS (noise.ts:127-147). One long freeze on the play tap, repeated on
   every preset swap and layer toggle. (reasoned, not measured)

2. noise.ts:197 — VoicePool.track sets source.onEnded, and the library never unregisters the
   listener (AudioScheduledSourceNode.ts:50-61 discards the subscription; setting onEnded = null at
   noise.ts:209 writes '0' but does not call removeAudioEventListener). The native registry
   (AudioEventHandlerRegistry.cpp:57 / :106) holds a shared_ptr<jsi::Function> forever and never
   erases on dispatch. Every droplet permanently retains its JS closure and both node wrappers:
   ~52,000/hour at the default preset. Unbounded Hermes heap growth over a night -> rising GC
   pressure. Library-side defect, engine-side trigger. (reasoned, not measured)

3. Steady state is fine: ~73 droplets per 5 s tick, ~3,400 JSI crossings, ~146 nodes. One or two
   dropped frames every 5 s while rain plays, nothing like the reported slowness.
   (reasoned, not measured)

Node counts (the numbers the charter says to watch): default preset ~2,660 standing nodes (2,610 of
them pre-scheduled droplets); rich preset rainy-cabin ~3,830 — the charter's ~3,900 figure survived
the port intact. Nodes are native and cost the audio thread, not the JS thread.

Routed to other owners (I did not touch them):
 - src/ui/** — engine.ts:299/:306/:318 emit mix:changed with a freshly allocated getState() (23
   objects) on every slider onValueChange, i.e. ~60/s during a drag. Each emit synchronously
   re-renders MixerScreen, MixesSheet and BedsideOverlay and calls Scenes.setIntensity. Real, but
   only while a finger is on a slider, and the fix is memoization/throttling in the UI.

Escalated to the CEO: no non-negotiable needs to change. The 90 s horizon, the 10.000 s ocean
period, the 1/f envelopes and the no-worklet rule are all intact and none of them need relaxing for
speed. If finding 1 is ever worth fixing, the horizon does not have to shrink — the FILL can be
chunked so the tick walks out to 90 s instead of building it in one block; full depth is reached
before the screen-off throttling risk begins. CEO's call, not mine.

Changed: nothing — investigation only.
Verified: not verified on a device — reasoned from the code and from the library's JS/C++ sources.
The crossing counts come from reading the wrapper (each createGain = 12 JSI calls, each
createBufferSource = 18, each AudioParam automation call = 3), not from a profiler.

### Junior Frontend Engineer — finished 15:18:46
Did: read all 26 files under src/ui/ (5,556 lines) end to end — every component, hook,
overlay and sheet in the slice. Also read App.tsx and src/audio/engine.ts (read-only, for
data-flow context on bus events I do not own) to confirm how often mix:changed fires and
what getState() allocates.
Found (ranked, all file:line, all reasoned-not-measured — no profiler run):
1. WORST OFFENDER — MixerScreen.tsx:81 takes the WHOLE EngineState on every 'mix:changed'
   and setState()s it, re-rendering the entire mixer screen. LayerCard.tsx:51 has no
   React.memo, so all 11 sound cards re-render on every tick. engine.ts:366-373 getState()
   deep-clones all 11 layers + their params objects (~23 allocations) on every call, and it
   is called on every setLayerVolume/setLayerParam/setLayerEnabled/setMasterVolume
   (engine.ts:249,264,289,299,306,318,399) — i.e. on every point of a slider drag
   (SliderRow.tsx:88-91 calls onChange unthrottled on every native onValueChange tick).
   This is the "slider re-renders the whole mixer" pattern the brief called out by name.
2. BreathingOverlay.tsx:138-180 drives its ~30fps pulse (FRAME_MS, line 29) through plain
   useState (setScale/setLabel/setCycles), not Animated — every tick is a full JS-thread
   React re-render of the whole overlay, for as long as it's open. Line 146 also calls
   oceanAvailable() -> engine.getState() (the same deep clone from #1) every single frame
   just to read one boolean.
3. Sheets mounted for the whole session (App.tsx:372-378, Team Lead's file, not mine to
   edit) do work while closed: MixesSheet.tsx:50 re-renders on every mix:changed (i.e. every
   slider tick app-wide) regardless of sheet open state; TimerSheet.tsx:90 re-renders once a
   second for the ~45min the sleep timer runs, sheet open or not. BedsideOverlay.tsx:109-111
   and BreathingOverlay.tsx:195-217 do this correctly (gate on isBedsideOpen()/open before
   touching state) — good patterns already in the codebase to copy.
4. MixesSheet.tsx:152's inline onArm closure changes identity every parent render, which
   invalidates MixRow's useMemo'd PanResponder at MixesSheet.tsx:182-200 on every tick while
   the sheet is open.
5. No component in src/ui/ uses React.memo — harmless for rarely-rendered buttons, but
   LayerCard.tsx:51 and MasterRow.tsx:24 sit directly under finding #1's hot path with no
   circuit breaker.
Also checked and found CLEAN in this slice: every Animated.timing/spring call already sets
useNativeDriver: true on native-drivable properties (opacity/transform) — no missing-driver
violations found (BreathingOverlay's problem is not using Animated at all, see #2); every
.map() list uses a stable key (no index keys); no broken useEffect/useCallback dependency
arrays found.
Changed: nothing — investigation only, as instructed.
Verified: read every file in src/ui/ (5,556 lines, all 26 files) plus App.tsx and
audio/engine.ts for bus-emission context. All findings are code-reading + reasoning, marked
(reasoned, not measured) — no device/profiler run this pass. Full file:line list with
one-line fixes handed to the CEO/Team Lead directly.

### QA & Verification — finished 15:19:28
Did: defined the before/after measurement protocol, the user-visible pass/fail checks, and the
trap list. No code changed, no build run, no work assigned.

MEASURED (not reasoned) — CEO Lead 1 is answered, from the device itself:
The founder's phone was attached to this workstation during this wave (it has since been
unplugged). I queried it read-only before it went:
  - Device: Samsung SM-A566B (Galaxy A56), Exynos s5e8855, Android 16 / SDK 36. Mid-range, not low-end.
  - Installed: com.quietloom.rn, versionName 0.1.0, `flags=[ DEBUGGABLE HAS_CODE ... ]`,
    firstInstallTime = lastUpdateTime = 2026-08-03 14:55:33.
  - On disk: android/app/build/outputs/apk/debug/app-debug.apk, 95.4 MB, written 14:55:12.
    It is the ONLY apk in build/outputs. No release APK has ever been built in this repo.
  - android/app/build.gradle sets no `bundleInDebug` and no debug bundle asset was generated,
    so that build loaded its JS from Metro over the wire, dev-mode on.
=> The founder judged a DEBUGGABLE, dev-mode, Metro-served build. That is a different performance
class, not "release minus a bit". Every number taken so far describes a build we will never ship.

ALSO MEASURED, and it unblocks the fix for the above:
  - android/app/build.gradle:115 — the release buildType uses `signingConfig signingConfigs.debug`.
    A release APK can be built and installed TODAY with no keystore work. HANDOFF.md's "no release
    signing config" gap does NOT block measuring a release build.
  - `android.enableMinifyInReleaseBuilds` is unset and defaults false (app/build.gradle:69), so
    release here does not run R8. Irrelevant to the JS-thread question; relevant to final ship shape.
  - Choreographer log buffer held zero "Skipped frames" lines by the time I looked — the buffer had
    rotated. There is no before-number in existence. Nobody has one.

Preserved: copied the 14:55 debug APK out of build/outputs to scratchpad
(`...\scratchpad\baseline\app-debug-BASELINE-1455.apk`). `npx expo run:android` overwrites that
path, and it is the only artifact of the state the founder actually judged. Do not lose it.

The protocol, in three tiers (full text delivered to the CEO):
  T0 BEFORE ANY REFACTOR IS JUDGED — build release, install on the SM-A566B, capture the same
     numbers. Without a release-BEFORE we can never attribute a win to anyone's code.
  T1 Founder, no tools, ~3 min: 7 stopwatch/eyeball checks (cold start to interactive <=2s; slider
     knob stays under the finger; sheet opens+closes clean; scene motion EVEN not fast; play->sound
     <=300ms; screen switches <=300ms; still even after 10 min idle).
  T2 QA/engineer, device on USB, one paste, ~2 min: `dumpsys gfxinfo <pkg> reset` -> use 60s ->
     `dumpsys gfxinfo`: janky-frames %, 50/90/95/99th frame times, missed vsync; plus
     `logcat -s Choreographer` skipped-frame counts, `top` for %CPU, `am start -W` for cold start.
     Bad: >25% janky (Play-vitals bad-behaviour bar), p90 >33ms, any "Skipped 30+ frames" while idle.
  T3 Perfetto only if T2 shows jank and nobody can say which thread. Not before.
  Caveat recorded: gfxinfo measures the UI/render thread, NOT the JS thread, so it can under-report
  JS starvation (which is what "the screens are slow" sounds like). The RN perf monitor gives JS fps
  but exists only in debug — so it cannot be part of a release before/after. Do not mix them.

Filed as findings, not instructions to anyone:
  - The battery trap: SceneView.tsx guarantees the rAF loop is FULLY cancelled when paused/bedside/
    backgrounded/reduced-motion. If the renderer moves to a UI-thread clock (the documented Skia fix),
    that guarantee is the easiest thing to silently lose, because a UI-thread clock keeps ticking
    without React. This app runs all night. A never-stopping loop is worse than the bug we are fixing
    and is invisible in a 60-second test. I will require a measured CPU-at-idle number, paused and
    bedside, before I sign off.
  - Guarded constants — if any of these move, it is a product change, not an optimisation:
    SceneView.tsx:27 FRAME_MS=1000/24 · rain.ts:20-22 layer base counts · waves.ts:12 SWELL_PERIOD=10
    ("Do not change") · waves.ts:14 BAND_COUNT=7 · moonrise.ts:495 blades · renderer.ts:40
    REFERENCE_AREA · scheduler.ts:21 HORIZON_SECONDS=90.
  - MY OWN CHECKLIST IS PARTLY UN-RUNNABLE and I am saying so rather than pretending otherwise:
    `tools/render-samples.mjs` does not exist (only analyse-samples.mjs), so "no layer inaudible",
    the ~6 dB window, peaks <=0.35 and the 10.0 s ocean period CANNOT be measured today. If audio is
    touched for performance I have ears and nothing else. `scripts/build-apk.ps1` does not exist.
    My charter's package id (com.quietloom.app) is wrong; it is com.quietloom.rn. The logcat tags
    (Capacitor, chromium) are dead. Every Monetization item is un-runnable while the ad SDK is
    excluded from the build.

What I cannot verify from here: I cannot hold the phone. The founder holds the only device that has
reproduced this and it is no longer attached. I cannot judge sound (no render harness). I cannot
verify any ad path (SDK excluded, plus Norton TLS interception). Perf must NOT be judged on the
Pixel 9a emulator — it borrows the host CPU and hides exactly this class of problem.

Changed: nothing. Verified: build posture verified against the device and the build outputs, as above;
everything about the fix itself is unverified because no fix exists yet.
I will block a sign-off that rests on debug-only numbers, on `npm run typecheck`, or on "feels faster".

### Performance Research — finished 15:27:10
Did: web research against RN/Expo/Skia/Reanimated first-party docs, plus verification of the EXACT installed
APIs by reading `node_modules/@shopify/react-native-skia@2.6.2` and `babel-preset-expo@57.0.5` source.
Changed: nothing — research only.
Verified: doc quotes have source URLs; library-internal claims were read from the installed package source, not
inferred. No first-party QUANTITATIVE debug-vs-release multiplier exists — do not let anyone quote one.

Headline conclusions:
1. Lead 2 is CORRECT, and the mechanism is worse than stated. Verified in Skia 2.6.2 source:
   `renderer/Canvas.js` runs `useLayoutEffect(() => root.render(children), [children, ...])`. Because
   `setPicture` re-renders SceneView, `children` is a NEW element every frame, so every frame runs a full
   SECOND React reconciler pass (`sksg/Reconciler.js` -> `skiaReconciler.updateContainer`) plus
   `container.redraw()`, which does `Rea.stopMapper` + `new ReanimatedRecorder` + `visit(root)` +
   `runOnUI` — all on the JS thread, 24x/sec. Per frame today: Ctx2D alloc, createPicture, app React commit,
   Skia reconciler commit, mapper teardown/rebuild, cross-thread schedule.
2. The fix is small and version-exact. `Picture`'s props are `SkiaProps<PictureProps>` = `SkPicture |
   { value: SkPicture }`, and `ReanimatedRecorder.drawPicture` calls `processAnimationValues`, so a
   Reanimated shared value in `picture` installs a UI-thread mapper (`Rea.startMapper`) that redraws with
   ZERO React renders. Writing `picture.value = createPicture(...)` from the existing rAF loop removes items
   3-6 above without moving any scene code. `createPicture` is already marked `"worklet"` in 2.6.2, so a
   later full move to the UI thread is the library's intended end state.
3. Two APIs the internet will suggest are WRONG for 2.6.2: `useDrawCallback`/`SkiaView` are REMOVED, and
   `<Canvas>` has NO `mode` prop (`mode="default"|"continuous"` survives only on the low-level
   `SkiaPictureView`). Any fix built on those is built on a v0.x/v1 blog post.
4. Lead 1 stands: `npx expo run:android` produces a DEBUG build by default (Expo docs). Also flagging
   `--variant debugOptimized` (SDK 54+) as a cheap middle step. RN and Reanimated docs both state release
   builds are much faster, but neither publishes a number.
5. Build-posture findings for the Platform Engineer (I do not own these files): there is no `babel.config.js`
   and no `metro.config.js`. Worklets still work — `babel-preset-expo` 57.0.5 auto-adds
   `react-native-worklets/plugin` (`build/configs/expo.js:109-115`) — but Worklets BUNDLE MODE is off, which
   (a) leaves the SDK 57 known regression in place (importing reanimated costs 25-30% memory on RN 0.85+ Hermes;
   Expo's own workaround is bundle mode) and (b) is a prerequisite for ever workletising the scene renderer.
   `babel-preset-expo` does NOT include `transform-remove-console`, so all 51 `console.*` sites across 13
   files still execute in release; RN's perf doc calls these "a big bottleneck in the JavaScript thread".
   `experiments.reactCompiler` is not set although `babel-plugin-react-compiler` is installed.
6. Negative findings, to save people time: no `StrictMode` anywhere, so dev double-rendering is NOT a factor.
   The New Architecture is unconditionally on in SDK 57 (legacy removed in SDK 55) — it is not a toggle anyone
   can get wrong, and it makes Fabric commits cheaper, not more expensive.
Full prioritised audit checklist with source URLs delivered to the CEO.

### Senior Frontend Engineer — finished 15:30:23
Did: read all 1,911 lines of `src/scenes/**` (SceneView.tsx, renderer.ts, canvas.ts, types.ts, rain,
embers, waves, stars, moonrise). Read the installed `@shopify/react-native-skia@2.6.2` source in
node_modules to settle Lead 2 from the code rather than from memory. Built an instrumented harness
(counting mock of Skia + the real compiled scene modules) and MEASURED per-scene draw calls, path
allocations, paint setters and colour parses per frame at 390x844 and 412x915.

**Lead 2 — CONFIRMED, and worse than stated.** `SceneView.tsx:32,42-49` holds the SkPicture in React
state. `Canvas.js` (node_modules .../renderer/Canvas.js) does `useLayoutEffect(() => root.render(children),
[children,...])` — `children` is a fresh element every render, so every frame runs `SkiaSGRoot.render()`:
`container.mount()` + a FULL second react-reconciler pass + a Promise/microtask + `container.redraw()`.
`Container.native.js` `redraw()` then allocates `new ReanimatedRecorder` + a native `Skia.Recorder()`,
re-`visit()`s the whole scene graph, and dispatches `Rea.runOnUI()`. All of that, 20-24x/second.
Correct API for 2.6.2 (verified in the installed source, not guessed): `Picture`'s `picture` prop is
`AnimatedProps<PictureProps>` (`skia/types/Recorder.d.ts` `drawPicture`), so a
`Rea.useSharedValue<SkPicture>` passed to `<Picture picture={sv}/>` is registered by
`ReanimatedRecorder.processAnimationValues` and driven by a Reanimated **mapper on the UI thread** —
`applyUpdates` + `setJsiProperty`, zero React render, zero reconcile, zero recorder rebuild. The library
uses this exact pattern itself in `usePathValue`/`usePictureAsTexture`.

Found (MEASURED per frame @390x844, JS->Skia crossings):
- stars `931` (154 draw calls, 767 paint setters) — `stars.ts:115` header says "cheap on purpose"; it is the worst.
- moonrise `487` no sheep / `608` with sheep (83 / 95 draw calls, 13 `Skia.Path.Make`/frame for the sheep)
- waves `381` + `11.4` native colour parses/frame; the 512-entry cache wholesale-`clear()`s **every 2.00 s**
  (`canvas.ts:60`), evicting every constant every other scene relies on. Source: `waves.ts:109,113` `.toFixed(4)`.
- rain `282` (5 draw calls but 242 path verbs), embers `222` (43.6 additive sprite blits)
- `canvas.ts:422-451` re-resets and reconfigures the shared SkPaint on EVERY draw: ~5 setters per draw call
  measured across all five scenes. Highest-leverage single change in the adapter.
- `renderer.ts:169-176` `setScene` has NO same-scene guard: re-tapping the moonrise preset re-runs
  `init()` = 9 offscreen raster surfaces, 42 shader builds, 76 paths, 269 path verbs, 4 Gaussian blur passes,
  synchronously on the JS thread. Nothing is ever `dispose()`d (all are `SkJSIInstance`).
- `rain.ts:156-159` builds a new Gradient2D + SkShader on EVERY still repaint (measured), and a still
  repaint fires on every `notify()` — including every `setIntensity` tick while paused (`renderer.ts:187`).
- Blur audit: only `moonrise.ts:256` and `moonrise.ts:363`, both build-time on offscreen sprites, filters
  memoized by sigma (`canvas.ts:129`). **No per-frame blur anywhere.** Clean.
- Particle counts are correctly clamped to [0.45, 2.2] of one phone (`rain/embers/stars/moonrise` resize). Clean.

**Pause posture — one genuine hole.** Backgrounded, audio-stopped, bedside and the OS reduce-motion switch
all fully cancel the loop, verified. But toggling the **in-app** `reduceMotion` setting ON while audio is
playing does NOT: `MixerScreen.tsx:99-108` pokes `Scenes.resume()`, and `renderer.ts:206` early-returns
when already unpaused, so no `notify()`, so `evaluate()` never re-runs and `reducedMotion()` is never
re-read. The loop keeps animating at 24fps until some unrelated event fires. Battery/heat bug, my file.
Fix is a `Scenes.refresh()` in `renderer.ts` + a one-line call site in `src/ui/screens/MixerScreen.tsx`
(junior's file) — **needs routing by the CEO.**

Also noted (accuracy, NOT to be "fixed" as a speed change): `SceneView.tsx:62` zeroes the accumulator
instead of subtracting `FRAME_MS`, so on a 60Hz display the cap is really 20fps, not 24.

Changed: **nothing — investigation only.**
Verified: draw-call / allocation counts are MEASURED by running the real scene modules against an
instrumented Skia mock. The Skia 2.6.2 API claims are read from the installed package source. The
device-level cost of the React-state repaint path is REASONED, NOT MEASURED — it needs a device profile.

### Senior Frontend Engineer — started 15:34:08
About to: implement the approved wave-1 fixes in my four files only — `src/scenes/SceneView.tsx`,
`src/scenes/canvas.ts`, `src/scenes/renderer.ts`, `src/scenes/stars.ts`. In priority order:
(1) move the SkPicture from React state to a reanimated `useSharedValue` passed straight to
`<Picture picture={sv}/>`, and remove the conditional child that would force a reconcile;
(2) paint dirty-flag cache in canvas.ts:422-451; (3) same-scene guard in renderer.ts:169-176;
(4) `Scenes.refresh()` for the in-app reduceMotion pause hole (call site in MixerScreen.tsx is
NOT mine — I will write the exact one-line change into my finish entry for routing);
(5) conservative `dispose()` where an object is provably dead; (6) alpha-bucketed star batching
via a new Ctx2D primitive; (7) rect-literal reuse and the save() snapshot, if time remains.
Constraints I am holding: FRAME_MS stays 1000/24, the loop must still be FULLY cancelled on
stop/bedside/background/reduced-motion, no scene draws less or looks different, and I am NOT
touching the `accRef.current = 0` cadence issue (out of scope, CEO's call).
Not touching waves.ts / rain.ts / moonrise.ts — junior has those in parallel.

### Audio Engineer — started 15:36:10
About to: implement the three CEO-authorised wave-2 fixes in `src/audio/**` only.
(1) engine.ts getState() — stop rebuilding 23 objects per call; cache per-layer LayerState and the
    top-level EngineState, invalidate exhaustively on every mutation path. Frozen contract: shape
    must stay byte-for-byte identical; a stale read is worse than an allocation. fadeMasterTo must
    keep NOT mutating master.
(2) noise.ts VoicePool — hold and explicitly remove the onEnded subscription so one-shot voices stop
    leaking a native listener + JS closure (~52k/hour). Reading the installed library source for the
    real unsubscribe API; if none exists I will say so and reduce handler count instead.
(3) scheduler.ts — chunk the horizon fill so the 5 s tick walks out to 90 s instead of building the
    whole block inside start(). HORIZON_SECONDS stays 90; every discrete event stays pre-scheduled
    on ctx.currentTime; I will state time-to-full-depth and defend it against Android screen-off
    timer throttling, and will not land it if I cannot.
Holding: no AudioWorklet/ScriptProcessor, ocean period stays 10.000 s, no 1/f envelope removed, no
ramp from an unset AudioParam. Touching src/audio/** and nothing else.
Cannot verify by ear or by measurement: `tools/render-samples.mjs` does not exist, so this repo has
no audio harness today. Everything below will be reasoned, not measured.

### Senior Platform Engineer — started 15:36:32
About to: build the RELEASE APK (the wave-1 deliverable nobody has ever produced), then fix the
docs that made a debug build the only option on offer.
Plan: (1) restore the Norton truststore lines in android/gradle.properties via
scripts/fix-truststore.ps1 — they are wiped by every prebuild and are the one real risk;
(2) NO expo prebuild (it would wipe them again); (3) `gradlew assembleRelease` with
minifyEnabled left OFF (one variable at a time; proguard-rules.pro has never been exercised
against the dynamic import() in src/services/ads.ts); (4) then verify the artifact itself —
size vs the 95.4 MB debug APK, that assets/index.android.bundle is PRESENT (proof the JS is
bundled and not Metro-served), and that the merged RELEASE manifest carries no
SYSTEM_ALERT_WINDOW and no RECORD_AUDIO (the debug one does, from RN's own debug manifest).
Then: README.md + HANDOFF.md + a package.json script so `--variant release` is on offer.
Touching only README.md, HANDOFF.md, package.json (scripts) and scripts/**. No source files —
four other engineers are editing src/ underneath me right now.

### CEO - integration note 15:37:20
Did: read all seven wave-1 reports and set the fix queue. Took `App.tsx` myself.
Found (mine): `setAvoidRects` accepted a fresh array of fresh objects from MixerScreen on a
140ms debounce, so identity always changed and Root re-rendered - and Root is the entire app
(SceneView, MixerScreen, MoonTap, AdBanner, BottomBar, 4 sheets, 2 overlays, ToastHost).
Merely scrolling the mixer re-rendered everything about 7 times a second.
Changed: `App.tsx` - added `sameRects()` value comparison and a `publishAvoidRects`
callback that swallows the no-op. MixerScreen keeps the same `onControlsLayout` contract;
the Junior Frontend Engineer is fixing the publish side in parallel. Belt and braces on purpose.
Verified: `npm run typecheck` clean. Effect is reasoned, not measured - no device here.

CEO rulings recorded for the team:
 1. Chunked scheduler fill is AUTHORISED (Audio Engineer), on the condition that
    HORIZON_SECONDS stays 90 and full depth is reached well before backgrounding is
    plausible. The horizon exists because Android throttles JS timers with the screen off.
 2. The 20fps-vs-24fps cadence issue the Senior Frontend Engineer found in SceneView is
    real, is NOT in scope for a speed task, and stays on the backlog. Fixing it makes the
    app do more work.
 3. Nobody reduces particle counts, drops the frame cap, or weakens the pause rules to buy
    speed. Every fix must be the same picture drawn with fewer crossings.
 4. Two Date.now()/performance.now() bugs have now been found in this codebase (SceneView,
    BreathingOverlay). Assume there is a third until someone has grepped for it.

### Junior Frontend Engineer — started 15:38:22
About to: implement wave-1 fixes in my three files only — `src/ui/overlays/BreathingOverlay.tsx`,
`src/ui/sheets/MixesSheet.tsx`, `src/ui/sheets/TimerSheet.tsx`. In priority order:
(1) FIX THE PACER BUG (Team Lead finding 4) — `BreathingOverlay.tsx:189/191/202/225/245` seed
    `lastFrame`/`phaseStart` from `Date.now()` while rAF hands `tick` (:140) `performance.now()`.
    Same class of bug as the one fixed in `SceneView.tsx:76-89` yesterday; I will copy that fix's
    shape (a `-1` sentinel + primed accumulator, no wall clock anywhere in the loop) so the two
    files agree, and I will show the dt arithmetic in my finish entry;
(2) take the pacer off React state — `Animated.Value` + `setValue()` on the tick for circle scale
    and halo scale/opacity, React state only for the phase label and the breath count; cache
    `oceanAvailable()` (:146 -> engine.getState(), the 23-object clone) and recompute it on
    `mix:changed` instead of every frame;
(3) gate `MixesSheet.tsx:50` and `TimerSheet.tsx:90` on the sheet actually being open, copying the
    existing guard pattern at `BedsideOverlay.tsx:109-111`, with an explicit resync-on-open so a
    sheet can never show stale state the instant it opens;
(4) stabilise the `onArm` closure at `MixesSheet.tsx:152` so the `useMemo`d PanResponder at :182-200
    stops rebuilding every render.
Constraints I am holding: Coherence 6 bpm stays default and 4-7-8 stays badged-Emerging secondary;
ocean sync keeps tracking `engine.getOceanPhase()` (the 0.1 Hz baroreflex pacer); the visual timing
of the breath is unchanged; the timer keeps counting down whether or not its sheet is open.
Not touching `src/scenes/**`, `src/audio/**`, `src/ui/screens/**`, `src/ui/components/**`,
`src/ui/hooks.ts` or `App.tsx` — other engineers hold those.

### Junior Frontend Engineer — started 15:40:51
About to: implement the approved wave-2 fixes in my five files only —
`src/ui/screens/MixerScreen.tsx`, `src/ui/screens/LayerCard.tsx`, `src/ui/screens/MasterRow.tsx`,
`src/ui/components/SliderRow.tsx`, `src/ui/hooks.ts`. In order:
(1) a per-layer external store in hooks.ts (same `useSyncExternalStore` shape as `useSettings`) so a
LayerCard subscribes to its OWN layer only and MixerScreen stops swapping the whole EngineState on
every `mix:changed`; (2) `React.memo` on LayerCard and MasterRow with value comparison, not identity;
(3) kill the inline arrow props at LayerCard.tsx:102,114,126,139,161,188,197 and hoist the closure-free
`format` functions to module constants; (4) audit `useBusEvent` (hooks.ts:29-42) against all its call
sites; (5) value-compare the control rects in MixerScreen.tsx:125-138 and skip the publish when they are
unchanged — my half only, the `onControlsLayout` prop contract does not change; (6) the Senior Frontend
Engineer's routed one-liner at MixerScreen.tsx:99-108, IF `Scenes.refresh()` has landed in renderer.ts
by the time I look — I will not guess at a name.
Constraints I am holding: the slider thumb must not lag the finger (I am not throttling the engine
call at all — memoisation is the win); no change to the paywall or the locked-layer grace rule; the
`engine.getState()` shape and the `mix:changed` payload are frozen and I only read them; the mixer must
look and lay out exactly as it does now.
Not touching: `src/scenes/**`, `src/audio/**`, `BreathingOverlay.tsx`, `src/ui/sheets/**`, `App.tsx`.

### Junior Frontend Engineer — started 15:34:32
About to: implement the three approved wave-1 fixes in my three files only —
`src/scenes/waves.ts`, `src/scenes/rain.ts`, `src/scenes/moonrise.ts`. Read canvas.ts
(read-only) first to confirm the Ctx2D adapter supports globalAlpha and how stylePaint
multiplies it against a parsed color's own alpha. Plan: (1) waves.ts — replace the
per-frame `rgba(...)` string builds at :109/:113 with two constant color strings plus
ctx.globalAlpha; (2) rain.ts — cache the drawStill veil gradient, invalidated only on
resize (same pattern as the existing bg/mist cache); (3) moonrise.ts — the sheep's
fleece/puffs/tail/head/ear are constant in local space, so rasterize them once into a
cached OffscreenSprite (unit- and dpr-aware, matching the moon/meadow sprite pattern
already in this file) and blit it under a translation each frame; the 4 legs stay live
vector strokes since they genuinely animate (gait swing, hop tuck). Also hoisting the
legs/puffs tuple arrays to module constants. Not touching SceneView.tsx, canvas.ts,
renderer.ts or stars.ts — Senior has those in parallel.

### Junior Frontend Engineer — finished 15:44:18
Did: all three assigned fixes, in my three files only.

1. `src/scenes/waves.ts:16-22,116-127` — added two constant, fully-opaque color
   strings (`CREST_FILL`, `CREST_STROKE`) and replaced the two per-frame
   `.toFixed(4)` `rgba(...)` template strings (old :109/:113) with
   `ctx.globalAlpha = <the same numeric expression>` set right before each
   `fill()`/`stroke()`, reset to 1 after the loop. Confirmed from canvas.ts (read-only)
   that `stylePaint` does `p.setAlphaf(color[3] * this.globalAlpha)` for a solid-color
   fillStyle, so a fully-opaque constant string (alpha=1) times globalAlpha reproduces
   the exact original alpha, at slightly *higher* precision than the old toFixed(4)
   round-trip. `SWELL_PERIOD` and `BAND_COUNT` untouched. Now only 2 waves colors (plus
   the 6 static gradient stops, already cached) ever reach Skia.Color, instead of two
   fresh strings every band every frame.
   Verified: `npm run typecheck` clean. Visual result NOT verified — reasoned only,
   needs a device. I'm fairly confident here because the substitution is
   value-for-value identical (same numeric alpha, same RGB), not a restructuring.

2. `src/scenes/rain.ts:40,58-61,81-95,168-175` — added a module-level `veil` cache
   alongside the existing `bg`/`mist`, an `ensureVeil(ctx, env)` that builds it once
   and returns the cached `Gradient2D` on subsequent calls, and cleared it in
   `resetGradients()` (called from `init`/`resize`) exactly like `bg`/`mist` already
   are. `drawStill` now calls `ensureVeil` instead of constructing a fresh gradient
   every repaint. The veil's stops are hardcoded colors independent of intensity, so
   viewport size (via resize) is the only real invalidation input, matching the
   existing bg/mist pattern exactly. Layer base counts at :20-22 untouched.
   Verified: `npm run typecheck` clean. Visual result NOT verified — reasoned only,
   needs a device, though this is a pure "build once, reuse until resize" cache with
   an established sibling pattern in the same file, so risk is low.

3. `src/scenes/moonrise.ts:520-712` — this one needed a design call within the
   optimization, logging it here rather than deciding silently: the `Ctx2D` adapter
   (canvas.ts, read-only to me) has no way to hand back a previously-built `SkPath`
   for `fill()`/`stroke()` to reuse — `beginPath()` always allocates a fresh
   `Skia.Path.Make()` internally. So "build the path once" isn't reachable through the
   adapter as written. Instead I used the pattern this exact file already established
   for its other static shapes (the moon, the meadow, the halo): fleece, the 4 puffs,
   the tail, head and ear never change shape frame to frame — only the legs (gait
   swing, hop tuck) and the sheep's position do. I rasterize the unchanging parts once
   into a cached `OffscreenSprite` (`ensureSheepBody`, :561-613), sized and transformed
   by the current `unit` and `env.dpr` for crispness, invalidated only when `unit` or
   dpr change (i.e. on resize, via the cache-key check at :563 — not per frame). The 4
   legs stay live vector strokes (they must, to keep the gait animation and hop tuck
   correct) but now iterate a hoisted `SHEEP_LEGS` constant instead of a fresh literal
   array. `SHEEP_PUFFS` is hoisted the same way, into the sprite-build function.
   Z-order preserved explicitly: legs drawn first (own save/restore at :684-696) then
   the body sprite blitted on top (:702-709), matching the original legs-then-fleece-
   then-head order. Alpha compositing preserved exactly: the fleece/puffs/tail alpha
   (0.82) is applied *inside* the sprite's own draw pass (same globalAlpha value, same
   draw order, same overlap behavior as the original), not re-applied as a second
   multiply at blit time, so overlapping puffs composite identically to before. Per
   sheep-frame Skia.Path.Make calls drop from ~12-13 to 4 (one per leg beginPath); the
   two tuple arrays (legs, puffs) are no longer allocated per frame. Blade count
   (:495, untouched), moon phase maths (untouched), 60-120s live gap / 4-8s welcome
   bring-forward (stepSheep/armSheep/launchSheep untouched, not even read past
   confirming I wasn't near them) all unchanged.
   Verified: `npm run typecheck` clean. Visual result explicitly NOT verified — I
   cannot see the scene render. This is the riskiest of the three changes (a
   rasterize-once-blit-per-frame restructuring, not a value-for-value substitution),
   so flagging plainly: reasoned only, needs a device, and this is the one I'd want
   someone to actually look at a launched app for before trusting it. The specific
   thing to check on-device: the sheep's fleece/head edges should look exactly as
   crisp as before at both ends of the `unit` range (small phone vs. large phone), and
   the fleece should not show any visible seam/double-alpha at the puff overlaps.

Changed: `src/scenes/waves.ts`, `src/scenes/rain.ts`, `src/scenes/moonrise.ts` only.
Did not touch SceneView.tsx, canvas.ts, renderer.ts, stars.ts, or anything under
src/ui/**, src/audio/**, App.tsx.

Found outside my three files, not touched, flagging for routing:
- While typechecking mid-task, `npm run typecheck` briefly failed with 3 errors in
  `src/ui/overlays/BreathingOverlay.tsx` (`Cannot find name 'scale'` etc., lines
  ~368-381) — a file outside my scope, evidently being edited concurrently by another
  role. It resolved on its own by my next run a few minutes later, so this is not a
  live issue, just noting it was seen mid-flight in case it recurs.

Verified overall: `npm run typecheck` passes clean as of this entry. No device/render
check was possible from here on any of the three fixes — all three need an on-device
or emulator visual pass before sign-off, moonrise.ts especially.

### Senior Platform Engineer — finished 15:48:15
Did: **built the release APK.** It exists. This is the first release artifact this repo has ever
produced. Also fixed the documentation that made a debug build the only option on offer.

**THE ARTIFACT (all MEASURED from the file itself, not from the build log):**
- Path: `android/app/build/outputs/apk/release/app-release.apk`
- **52.26 MiB (54,793,966 bytes)** vs the debug baseline's **95.41 MiB (100,049,634 bytes)** —
  **45.2% smaller**, and it is a like-for-like comparison: both are **arm64-v8a only**, 27 native
  libs each (`aapt2 dump badging` -> `native-code: 'arm64-v8a'`).
- `assets/index.android.bundle` is **PRESENT**, 3,249,424 bytes, stored uncompressed
  (`enableBundleCompression=false`, app/build.gradle:17 — deliberate, it lets Android mmap it).
  First 8 bytes are `c6 1f bc 03 c1 03 19 1f` = the **Hermes bytecode magic**. So this is
  precompiled .hbc, not JS source and not Metro. Metro log line: `Android Bundled 6348ms
  index.ts (1701 modules)`. **Lead 1 is now closed on both sides: we have a debug artifact and a
  release artifact and they are different objects.**
- `debuggable` attribute: **absent** (debug APK has `debuggable=true`).
  `usesCleartextTraffic`: **absent** (debug APK has `=true`).
- Signed with the debug keystore, and I checked rather than assumed: both APKs are
  `Signer #1 SHA-256 fac61745...033b9c`, identical. Same applicationId, same versionCode 1,
  same cert => **`adb install -r` puts it straight over the founder's installed debug build.**
- Build: `gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`, BUILD SUCCESSFUL in
  **4m 10s**, 671 tasks. minifyEnabled **OFF** (left at the default) as instructed — one variable
  at a time, and `proguard-rules.pro` has still never been exercised against the dynamic
  `import()` in `src/services/ads.ts`. No prebuild was run, so nothing in `android/` was
  regenerated.

**MANIFEST PERMISSION CHECK — I WAS WRONG IN WAVE 1, AND IT MATTERS.**
I wrote that `SYSTEM_ALERT_WINDOW` came from `react-native/ReactAndroid/src/debug/AndroidManifest.xml`
and would be "absent from release". It is **NOT absent from release.** `aapt2 dump permissions`
on `app-release.apk` lists it. The release manifest-merger report
(`android/app/build/outputs/logs/manifest-merger-release-report.txt:144`) traces it to
**our own** `android/app/src/main/AndroidManifest.xml:7`, which `expo prebuild` generates from the
template at `@expo/config-plugins/build/plugins/withAndroidBaseMods.js:56-68` — a block that ships
`SYSTEM_ALERT_WINDOW`, `VIBRATE`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` under a comment
literally reading "OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU DO NOT NEED". Nobody ever removed them.
The app uses none of the four. A sleep app asking to draw over other apps is the same class of trust
problem as the background-audio plugin this team already rejected.
- `RECORD_AUDIO`: **absent from the release merge entirely** (searched the merger report, zero hits).
  That half of the trust claim holds.
- Fix is `android.blockedPermissions` in `app.json` (supported here —
  `@expo/config-plugins/build/android/Permissions.js:64`), then prebuild + rebuild.
  **`app.json` is not mine this wave and a prebuild would wipe the truststore lines and invalidate
  this APK, so I did NOT touch it. Routing to the CEO.** Recorded in HANDOFF.md.

**WHAT IS IN THIS APK — read this before anyone measures with it.**
I hashed `App.tsx` + all 63 files under `src/` immediately before starting the build and again
after. Metro bundled at a moment when the tree was at **HEAD 91ab31a with only `App.tsx` dirty**
and `npm run typecheck` **clean** (I ran it first, deliberately). During the 4m10s build, 14 files
changed underneath me — the Audio Engineer's and Junior Frontend's wave-2 fixes landed
(`audio/engine.ts`, `noise.ts`, `scheduler.ts`, `ui/hooks.ts`, `SliderRow`, `LayerCard`,
`MasterRow`, `MixerScreen`, `MixesSheet`, `TimerSheet`, `BreathingOverlay`, plus
`scenes/rain|waves|moonrise.ts`). **None of them are in this APK.** `scenes/SceneView.tsx`,
`canvas.ts`, `renderer.ts` and `stars.ts` were untouched at bundle time, so the Skia
React-state repaint is still in it too.
=> That is not a defect, it is the artifact QA asked for: this is the **release-BEFORE** baseline
for QA's T0 protocol — the exact code the founder judged, built as release. Attribution is now
possible. Preserved next to QA's debug baseline as
`...scratchpad/baseline/app-release-BASELINE-1544-91ab31a.apk`, because the next
`assembleRelease` overwrites `app-release.apk`.

**Truststore:** `android/certs/cacerts-with-norton.jks` did not exist at all and
`gradle.properties` had no truststore lines. `scripts/fix-truststore.ps1` rebuilt the store
(it found the real `CN=Norton Web/Mail Shield Root`) and wired both lines in. Zero PKIX failures
in the build. No `--offline` needed.

**ABI call, stated so it can be overruled:** arm64-v8a only, and this was a judgement, not a
shortcut. New fact that changes the framing — `expo run:android` restricts ABIs to the attached
device's, **but only for debug builds**
(`@expo/cli/.../run/android/resolveGradlePropsAsync.js:70-79`: `isDebugBuild` gate). So the 95.4 MB
debug baseline was *already* arm64-only, while a default `--variant release` would have built all
four and produced a size number that could not be compared with it. The founder's only device is
the arm64 SM-A566B that QA read off the hardware. A universal APK is one flag away and documented:
`npm run apk:release` (no `-P` flag) builds all four.

Changed (my files only, no source file touched):
- `README.md` — the "Running it" block now says `npm run android` is DEBUG, adds
  `npm run fix-truststore`, and a new "### Which build variant, and why it matters" subsection:
  a four-row table (debug / debugOptimized / release / apk-only), the plain statement that
  **performance must never be judged on a debug build**, the APK path, the debug-key caveat, and
  the ABI note above.
- `package.json` — added `android:optimized`, `android:release`, `apk:release`, `fix-truststore`.
  Removed the dead `"web": "expo start --web"` script (there is no web build; CLAUDE.md says to
  fix stale web references where found).
- `HANDOFF.md` — the quickstart now shows both variants and warns off measuring on debug;
  gap #4 "No release signing config. Debug builds only." rewritten to "No production upload
  keystore" with the real gap (the debug key is public, cannot publish, and the first upload key
  is permanent); and the `SYSTEM_ALERT_WINDOW` correction added next to the RECORD_AUDIO claim.

One correction to the brief worth having on the record: **`--variant debugOptimized` does NOT give
you a release JS bundle.** `@react-native/gradle-plugin` `ReactExtension.kt:106` defaults
`debuggableVariants` to `['debug', 'debugOptimized']`, so that variant is still Metro-served with
`__DEV__` on; `AgpConfiguratorUtils.kt:44-49` shows all it changes is
`-DCMAKE_BUILD_TYPE=Release` for the C++. It speeds up Skia and the audio engine, not the JS
thread. I documented it that way so nobody measures on it by mistake.

Verified: everything above is measured from the APK with `aapt2` / `apksigner` / zip entry
inspection and from the release manifest-merger report — not from the build log and not reasoned.
**Not verified: that the app actually launches.** The founder's phone is not attached, there is no
emulator running, and I have not executed this APK. It is a build artifact that passes every static
check I can make; whether it boots is the founder's first test, and the install command is in my
report to the CEO.

### Junior Frontend Engineer — finished 15:47:44
Did: implemented the three fixes in my three files only — `src/ui/overlays/BreathingOverlay.tsx`,
`src/ui/sheets/MixesSheet.tsx`, `src/ui/sheets/TimerSheet.tsx`. Read `src/scenes/SceneView.tsx`,
`src/ui/overlays/BedsideOverlay.tsx`, `src/core/timer.ts`, `src/ui/hooks.ts`, `src/ui/sheets.ts`,
`src/ui/layers.ts` and `src/ui/components/Sheet.tsx` read-only for the patterns and the seams.

## FIX 1 — the breathing pacer. It has never animated. It does now.

`BreathingOverlay.tsx` had TWO clocks seeded from `Date.now()` and read against the
`performance.now()` value `requestAnimationFrame` hands the callback: `lastFrame` (was :189) and
`phaseStart` (was :191/:202/:225/:245, read against `now` at :168). Both are gone. The loop is now
seeded exactly the way `SceneView.tsx:76-89` seeds its own — a `-1` sentinel meaning "no previous
frame", resolved from the frame clock itself, plus a primed accumulator — so the two files agree
and neither reads a wall clock inside a frame loop.

### THE ARITHMETIC (this is the verification, not an assertion)

`FRAME_MS = 1000/30 = 33.333 ms`. `Date.now()` on 2026-08-03 = 1,785,715,200,000 ms
(= 20,454 days to 2026-01-01, + 214 days, x 86,400 x 1000). Take a user opening the pacer 30 s
after launch, so `performance.now()` ~ 30,000 ms.

BEFORE (what shipped):
  tick 1: dt = now - lastFrame = 30,000 - 1,785,715,200,000 = **-1,785,715,170,000 ms**
          (~ -1.7857e12, i.e. -56.6 years)
          acc = 0 + (-1.7857e12) = -1.7857e12. `acc < 33.333` -> return.
  tick 2: dt = +16.7 ms (a sane frame). acc = -1,785,715,169,983. Still `< 33.333` -> return.
  Frames needed for acc to climb back to a frame boundary at ~16.7 ms each:
          1.7857e12 / 16.7 = **1.07e11 frames = 56.6 years at 60 Hz.**
  And independently, `elapsed = (30,000 - 1,785,715,200,000)/1000 = -1.786e9 s`, which is never
  `>= phase.dur` (5 s), so the phase index could never advance EITHER. Two independent freezes.
  Result: `setScale` was never reached. The circle sat at MIN_SCALE = 0.42 reading "Ready", forever.

AFTER (`startLoop`: `lastFrame = -1`, `acc = FRAME_MS`, `phaseStart = -1`):
  tick 1 (now = T1): `lastFrame < 0` so **dt = 0** — the first callback has nothing to measure
          against and we do not guess. acc = 33.333 + 0 = 33.333; `33.333 < 33.333` is FALSE, so it
          advances on frame one (that is what priming the accumulator buys). acc = 0.
          `phaseStart < 0` -> phaseStart = T1, on the frame clock. elapsed = 0 s, t = 0,
          easeInOut(0) = 0.5 - 0.5*cos(0) = 0, scale = 0.42 + 0.58*0 = **0.42** — the true start of
          the inhale, painted immediately.
  tick 2 (60 Hz, now = T1 + 16.667): **dt = +16.667 ms** — a real, positive, sane frame time.
          acc = 16.667 < 33.333 -> return. That is the 30 fps cap working, not the bug.
  tick 3 (now = T1 + 33.333): dt = +16.667, acc = 33.333 -> advances, acc = 0.
          elapsed = 0.0333 s, t = 0.0333/5 = 0.006667,
          easeInOut = 0.5 - 0.5*cos(pi*0.006667) = 1.0966e-4,
          scale = 0.42 + 0.58*1.0966e-4 = **0.4200636**. The circle is growing.
  It reaches scale 1.0 at elapsed = 5 s, then the exhale returns it to 0.42 over 5 s:
  10 s a breath = **6 breaths / minute**, which is the coherence pace the product promises.

Note I did NOT change `acc.current = 0` to `acc -= FRAME_MS`. That is the same cadence question the
Senior Frontend Engineer flagged at `SceneView.tsx:62` and declared out of scope; it costs sample
rate, not breath timing, because the scale is computed from `now - phaseStart` (absolute) and not
from accumulated dt. Deliberately left alone so the two loops stay identical.

## FIX 2 — the pacer no longer animates through React.

- The circle's scale is now an `Animated.Value` constructed as
  `new Animated.Value(MIN_SCALE, { useNativeDriver: true })`. That matters and I checked it in the
  installed source rather than assuming: `react-native/Libraries/Animated/nodes/AnimatedValue.js:111-113`
  calls `__makeNative()` straight from the constructor, and `setValue` at :197-211 then takes the
  `__isNative` branch — it posts `setAnimatedNodeValue` to the native animated node and explicitly
  SKIPS the JS flush ("don't perform a flush for natively driven values", :204).
  `AnimatedWithChildren.__addChild:41-51` propagates `__makeNative` to the style/props nodes, so the
  whole chain is native. Net: zero React renders and zero reconciliation per tick.
  `AnimatedNode.__makeNative:73-81` only sets a flag — the native node is created lazily in
  `__getNativeTag()` — so a mounted-but-closed overlay costs nothing for holding the value.
- The halo's `scale * 1.18` and `0.18 + 0.3 * (scale - MIN_SCALE)` were JS arithmetic in the style
  object on every render. Both are LINEAR in scale, so they are now two `interpolate()`s on the same
  native node, and they are exact, not approximate:
    haloScale:   [0.42, 1] -> [0.4956, 1.18];  0.4956 + (in-0.42)*(0.6844/0.58) = 1.18*in  exactly.
    haloOpacity: [0.42, 1] -> [0.18, 0.354];   0.18 + (in-0.42)*(0.174/0.58) = 0.18+0.3(in-0.42) exactly.
  Default extrapolation is 'extend' (linear), so they stay exact outside the range too.
- `oceanAvailable()` -> `engine.getState()` (the ~23-object clone) is out of the frame loop. It is
  cached in `oceanRef` and refreshed from the `mix:changed` PAYLOAD, so the refresh costs no
  getState() at all. The engine emits `mix:changed` immediately after `audio:started` (engine.ts:248-249)
  and `audio:stopped` (:263-264), so the cache tracks `running` too and the "ocean stopped underneath
  us" fallback still fires. The refresh is itself gated on `isBreathingOpen()`.
- `setLabel` and `setCanSync` were called EVERY tick with almost always the same value. Both are now
  change-guarded (`labelRef`, and a bail-out updater for canSync), so React state is touched only
  when a human-readable thing actually changes: the phase label (~every 5 s) and the breath count
  (~every 10 s). Was ~30 full overlay re-renders/second; now ~0.3/second.

Held, and checked line by line: Coherence 6 bpm is still the default (`initialPattern`) and still
first in the chip row; 4-7-8 is still second and still badged from `BREATH_EVIDENCE`. The ocean sync
still reads `engine.getOceanPhase()` on every advancing tick — only the AVAILABILITY boolean is
cached, never the phase, so the 0.1 Hz baroreflex pacer is untouched. Phase durations, `easeInOut`,
MIN_SCALE, SPAN and the ocean cosine are byte-identical.

## FIX 3 — the two sheets no longer work while closed.

Both copy `BedsideOverlay.tsx:106-111` (gate on the open predicate before touching state), and both
pair the gate with an explicit resync-on-open, because a gate without one just trades a perf bug for
a correctness bug:
- `MixesSheet`: `useBusEvent('mix:changed', ...)` now gates on `isSheetOpen('mixes')`. It was taking
  the whole EngineState on every slider touch-move for the entire session, re-rendering the
  `activeLayerIds` useMemo, every saved-mix row and every row's PanResponder, with the sheet closed.
- `TimerSheet`: `timer:tick` now gates on `isSheetOpen('timer')` — that is ~2,700 re-renders of an
  unwatched sheet removed per 45-minute timer. `timer:set` and `timer:done` are deliberately left
  UNGATED: they fire a handful of times a session, there is nothing to save, and leaving them alone
  keeps `running` honest with no extra reasoning required.
- Stale-on-open, reasoned explicitly as instructed: both sheets take `useSheet(id)` and resync in a
  `useEffect` keyed on `open` — Mixes re-reads `engine.getState()` + `loadMixes()` and clears any
  armed delete confirm; Timer re-reads `SleepTimer.getRemaining()` + `isRunning()`. The effect runs
  on the commit where `open` flips true, which is the SAME commit that starts `<Sheet>`'s 260 ms
  slide-up from fully off-screen (`Sheet.tsx:71-87`), so the resync lands before the panel is
  legible. The timer resync is exact rather than best-effort because `getRemaining()` is derived
  from the deadline (`timer.ts:65-68`), not accumulated from ticks, so skipped ticks cannot drift it.
- The countdown itself is untouched: `SleepTimer`'s deadline, its `setInterval`, the fade arming at
  `timer.ts:77-82` and `timer:done` all live in `src/core/timer.ts` and know nothing about the sheet.
  `timerSummary()` (used by bedside) reads the timer live and was never affected.
- `MixesSheet.tsx` MixRow: the inline `onArm` is stabilised with the latest-ref pattern already used
  by `useBusEvent` in `hooks.ts:29-42` — `onArmRef.current = onArm` and the `useMemo` deps drop to
  `[]`, so the PanResponder is built once per row instead of being torn down and rebuilt on every
  parent render while the sheet is open. Behaviour is identical and it cannot go stale.

## THE THIRD `Date.now()` / `performance.now()` BUG — I looked, and there is NOT one.

The CEO asked. Answer: **no third instance exists in this codebase, and I can bound that claim.**
Swept every `.ts`/`.tsx` in `App.tsx`, `src/` and `plugins/` for `requestAnimationFrame`,
`performance.now`, `Date.now()` and `.getTime()`. There are exactly TWO `requestAnimationFrame`
loops in the whole app — `SceneView.tsx` (fixed yesterday) and `BreathingOverlay.tsx` (fixed now).
Every surviving `Date.now()` is a genuine wall-clock use that is only ever compared against another
wall-clock reading:
  - `core/timer.ts:40,67` — deadline vs Date.now. Self-consistent.
  - `services/entitlements.ts:35` — stored expiry vs Date.now. Self-consistent.
  - `ui/sheets/MixesSheet.tsx:98,100` — mix id and createdAt. Not a clock comparison.
  - `scenes/moonrise.ts:172,192,725,738` — `moonPlace`/`buildMoon` genuinely WANT the wall clock
    (hour-of-day for the moon's arc, calendar day for the lunar phase sprite). The cache key pair
    `moonAt`/`env.time` at :105,:170-172 is scene-time vs scene-time. Correct as written — NOT a
    third instance, so nobody should "fix" it.
I also checked the one other place two clocks could meet, `audio/scheduler.ts`: the wall clock
(:109,:153,:183,:192) is used ONLY for throttle detection (Date.now vs Date.now) and the audio clock
`ctx.currentTime` (:131-135) ONLY for scheduling. They are never compared. Clean.

Changed: `src/ui/overlays/BreathingOverlay.tsx`, `src/ui/sheets/MixesSheet.tsx`,
`src/ui/sheets/TimerSheet.tsx`. Nothing else. No behaviour change smuggled in.

Verified:
 - MEASURED: my slice typechecks clean. Project-wide `npm run typecheck` is currently RED, but every
   error is in `src/ui/screens/MixerScreen.tsx` / `LayerCard.tsx`, which another engineer is editing
   live (the error text changed between three consecutive runs) and which are not mine. To make the
   claim about my own work defensible rather than "it was someone else's fault", I typechecked my
   three files plus their entire transitive dependency graph in isolation against the project's
   tsconfig: **clean, zero errors.** My three files produced zero errors in every run.
 - MEASURED, by reading the installed `react-native` source, not from memory: the
   `AnimatedValue.js:111` / `:197-211` and `AnimatedWithChildren.js:41-51` behaviour above, and that
   `AnimatedStyle` passes static style keys through untouched so the mixed static+animated style
   objects are safe.
 - MEASURED, by reading: the `Date.now()` sweep and the scheduler clock separation above.
 - REASONED, NOT MEASURED: the dt arithmetic is arithmetic — it is derived from the code, not from a
   device. NOTHING here has run on hardware. In particular these three need a device before anyone
   calls fix 1 done: (a) that the circle visibly breathes at 6 bpm and the inhale/exhale labels
   alternate; (b) that the native-driver path actually paints under the New Architecture in this app
   (it is the standard supported path, but I have not seen a pixel); (c) that the pacer still stops
   dead when the app is backgrounded — the rAF loop is still fully cancelled in `stopLoop`, but a
   frozen loop that never painted also never showed a battery cost, and this one will.
 - NOT VERIFIED: no re-render counts, no profiler, no frame timings. The claim "~30 renders/sec ->
   ~0.3/sec" is counted from the code paths, not observed.

Nothing to route to another owner — everything I needed was inside my three files.

### Audio Engineer — finished 15:51:40
Did: landed all three CEO-authorised wave-2 fixes. Files changed, and ONLY these:
`src/audio/engine.ts`, `src/audio/noise.ts`, `src/audio/scheduler.ts`. `npm run typecheck` clean.

--------------------------------------------------------------------------------
FIX 1 — getState() no longer rebuilds 23 objects per call. LANDED.
--------------------------------------------------------------------------------
Three-level copy-on-write cache in engine.ts (`_stateCache` / `_layersCache` / `_layerCache` +
`_paramsCache`). The returned shape is byte-for-byte what it was: `{master, running, layers}` with
each layer `{enabled, volume, params}`, `layers` keyed in SOUND_IDS order, same key insertion order
(so JSON.stringify parity holds for SavedMix).

Allocations per call: no change since the last call -> **0**. A volume or enable tick -> **3**
(new LayerState, new layers record, new EngineState). A params tick -> 4. A master tick -> 1.
Was 23 on every single call.

THE SAFETY INVARIANT: nothing returned is ever mutated in place afterwards. A changed layer gets a
NEW LayerState (and a new params object only if params actually moved); the other ten keep their
previous identity. That matters beyond speed: `MixesSheet.tsx:74` stores `engine.getState().layers`
straight into a SavedMix. Under in-place mutation that saved mix would have silently followed the
live engine forever. Under copy-on-write it is a snapshot with exactly the semantics the old deep
clone gave it. This is why I did NOT make the `layers` record identity-stable, which would have been
one allocation cheaper — correctness first, as instructed.

EXHAUSTIVE LIST OF MUTATION PATHS, as required. Three invalidators, and they are the only writers of
the cache fields:
  `_dirtyTop()`           master / running changed
  `_dirtyLayer(id)`       that layer's enabled or volume changed
  `_dirtyLayerParams(id)` that layer's params changed (calls _dirtyLayer too)

  1. constructor              builds this.layers            -> caches start null, nothing to dirty
  2. start()          :234    `_running = true`             -> _dirtyTop
  3. stop()           :256    `_running = false`            -> _dirtyTop
  4. setLayerEnabled()        `layers[id].enabled`          -> _dirtyLayer(id)
  5. setLayerVolume()         `layers[id].volume`           -> _dirtyLayer(id)
  6. setLayerParam()          `layers[id].params[name]`     -> _dirtyLayerParams(id)
  7. setMasterVolume()        `master`                      -> _dirtyTop
  8. applyMix()               enabled + volume + params, every id, incl. the else-branch that only
                              drops a layer                 -> _dirtyLayerParams(id) for all 11
DELIBERATELY NOT INVALIDATING, and each is a decision not an oversight:
  9. fadeMasterTo()     does not touch `master` by design. The sleep timer fades to zero and later
                        restores `getState().master`, so the logical level must survive the fade.
                        Unchanged, and verified below.
 10. setNurserySafe()   `_nursery` is not part of EngineState; it is read through isNurserySafe().
 11. _applyLayer / _ensureLayer / _disposeLayer / _buildGraph / _wake / _ensureContext / playChime —
     read this.layers, write AudioNodes only. `_ensureLayer` passes `this.layers[id].params` BY
     REFERENCE to the layer factory; I checked all nine factories and none mutates it (rain,
     thunder, binaural each copy into a local `p`; the rest ignore params entirely). If a future
     layer ever writes to `io.params` it must call `_dirtyLayerParams` — noted in the code.
 12. `this.layers` is private and no file outside engine.ts touches it (grepped).

VERIFIED (measured, not reasoned — this part I could actually test): I loaded the REAL engine.ts
with stubbed native deps and diffed the cached getState() against a reference implementation of the
old deep clone. 24 assertions pass, including shape/key-order parity, all 11 mutation paths, the
held-snapshot (SavedMix) case, layer identity stability, and fadeMasterTo. Then a fuzz of **50,000
random public-API calls comparing cached vs deep-clone after EVERY call: 0 stale values**, and
1,234 snapshots held across the whole run: 0 drifted. Harness in scratchpad, not committed.

For the engineer memoizing the UI side: on a rain-slider drag, `getState().layers[id]` is a NEW
object for `rain` and the **identical** object for the other ten. Reference equality is now a valid
memo test per layer. `state.layers` and `state` itself always change identity when anything changes.

--------------------------------------------------------------------------------
FIX 2 — the one-shot voice listener leak. LANDED, and my wave-1 mechanism was WRONG.
--------------------------------------------------------------------------------
I read the installed 0.13.2 sources properly this time (JS + C++) instead of stopping at the JS
wrapper, and I owe a correction:

  - `AudioEventSubscription.remove()` EXISTS and calls `removeAudioEventListener(name, id)` ->
    `AudioEventHandlerRegistry::unregisterHandler` -> `eventHandlers_[ENDED].erase(id)`.
    But the class is not exported (only as a type) and `AudioScheduledSourceNode`'s setter throws
    the subscription away, so there is NO handle to hold. `audioEventEmitter` and `node` are both
    `protected`. So "hold the subscription object" is not reachable through public API.
  - HOWEVER `onEnded = null` is not the no-op I reported in wave 1. Chain, all read from source:
      `onEnded = null` -> `node.onEnded = '0'` (AudioScheduledSourceNode.ts:52)
      -> `assignOnEndedCallbackId(0)` (AudioScheduledSourceNodeHostObject.cpp:26)
      -> `EventCaller::assignCallbackId(0)` (EventCaller.hpp:34) — previous id != 0, so it calls
      -> `unregisterCallback(previous)` -> `registry.unregisterHandler(ENDED, previous)`
      -> `eventHandlers_[ENDED].erase(id)` (AudioEventHandlerRegistry.cpp:68)
    That is the SAME method on the SAME registry that `subscription.remove()` reaches. Identical.
  - So `dispose()` at noise.ts was ALREADY unregistering correctly. My wave-1 entry was wrong about
    that line. The leak was entirely on the path I did not check: a voice that simply ENDS. The
    handler fires, `handleEventOnJSThread` never erases it (AudioEventHandlerRegistry.cpp:106), and
    the closure retains `source`/`nodes`/`voice` -> the JS wrapper -> the host object, whose
    destructor is the only other thing that would have unregistered it. A closed JS<->native retain
    cycle. That path is ~all ~52,000 voices an hour; dispose is a handful. So the leak is real and
    the proportion is worse than I said, but the mechanism I named was the wrong half.

THE FIX (noise.ts, `VoicePool.track`): the ended handler now nulls `source.onEnded` as its last act,
which erases the native registration and breaks the cycle. Re-entering the registry from inside a
dispatch is explicitly supported — `handleEventOnJSThread` copies the matching handlers out, drops
the mutex, and only then calls into JS, with a comment saying it does so precisely because a handler
may register/unregister. The `shared_ptr` copy in the local vector keeps the function alive for the
duration of its own call.
I did NOT reach into the protected `audioEventEmitter`/`node` fields to fake a subscription handle:
that would bypass the library's own bookkeeping and break silently on upgrade, for zero benefit,
since the public route provably lands on the same `unregisterHandler`.
Cost: one extra JSI property write per voice, paid at end-of-life and spread over time, in exchange
for a bounded heap. I did not reduce handler count — the brief said only to do that if no unsubscribe
existed, and one does.
Verified: read from source (JS wrapper, host object, EventCaller, registry). NOT verified at runtime —
proving the heap is now flat needs an 8-hour device run with a Hermes heap snapshot, which nobody
can do from this machine.

--------------------------------------------------------------------------------
FIX 3 — the 90 s horizon is now walked out, not built in one block. LANDED.
--------------------------------------------------------------------------------
`HORIZON_SECONDS` is still 90 and I did not touch it. Every discrete event is still pre-scheduled on
`ctx.currentTime`; nothing moved onto a JS timer. Each TASK now carries its own `depth`, starting at
`PRIME_STEP_SECONDS = 6` and walked to 90 in 6 s chunks, one chunk per `PRIME_INTERVAL_MS = 60`
(60 ms > one 24 fps frame at 41.7 ms, so the JS thread gets a whole frame back between chunks).
Depth is PER TASK, not global, which is what also takes layer toggles and preset swaps off the
one-big-block path — a task added at 3am primes exactly like one added at the play tap.

TIME TO FULL DEPTH, and why it is safely inside the window (MEASURED, by running the real
scheduler.ts against a fake audio clock and fake timers; harness in scratchpad):
  - Synchronous cost of `start()` at the default preset (rain @0.5 = 14.5 droplets/s):
    **88 droplets**, vs ~1,305 before. ~14.8x smaller, matching the 6/90 ratio.
  - 14 further chunks of ~88 droplets each, one every 60 ms.
  - **FULL 90 s DEPTH IS REACHED 840 ms AFTER start().**
  - Droplets in flight at full depth: 1,318 — the same population as before. Nothing is scheduled
    less, only later. Largest single chunk: 88 droplets (~176 native nodes), vs ~2,610 nodes and
    ~61,000 JSI crossings in one block.
  - Layer toggle 4 hours in: 30 crackles synchronously, full depth 840 ms later.

WHY 840 ms IS SAFE, in three parts:
  1. It is short. Android's screen-off throttling can only bite once the app is backgrounded. A user
     cannot tap play and background the app inside 0.84 s, and no screen timeout is that short. The
     realistic gap between "tap play" and "press power" is seconds at minimum.
  2. Nothing in that window depends on a timer. Everything a chunk creates is already on
     `ctx.currentTime` and survives on the audio thread whatever happens to the JS clock afterwards.
     A shallower horizon can only ever thin discrete events out LATER; it can never make audio
     stutter now. The continuous layers — noise beds, the ocean swell, wind, every 1/f envelope —
     are OscillatorNode -> AudioParam and are not scheduled here at all, so they are untouched by
     this change under any timing.
  3. There is a hard fallback. Both the 5 s tick and the 60 ms priming step check how late they
     arrived. A tick more than 2x late, or a priming step more than 1 s late, means the JS clock is
     ALREADY being throttled — priming is abandoned and the full 90 s horizon is taken immediately,
     in that same callback. Verified in the harness: with the priming chain killed at t=0 and the
     first interval arriving 60 s late, depth jumps 6 -> 90 and the task refills. The asymmetry is
     deliberate: a false positive costs one burst, i.e. exactly today's behaviour; a false negative
     costs silence.
`maxAhead` semantics are untouched — it was always a per-pump event cap, and per-pump work is now
strictly smaller, so it cannot bite anywhere it did not before.
NOT FIXED, and out of my authorised scope: the ~22 s of noise-buffer synthesis + two ~1.9 MB
`copyToChannel` copies happen in the LAYER FACTORIES (`_ensureLayer`), not in the scheduler, so
chunking does not touch them. They are cached per (type, variant) in a WeakMap keyed by the context,
so they are a once-per-context cost and do NOT repeat on preset swap. Left alone.

--------------------------------------------------------------------------------
NOT VERIFIED BY EAR. NOT VERIFIED BY MEASUREMENT OF AUDIO.
--------------------------------------------------------------------------------
QA is right: `tools/render-samples.mjs` does not exist. **There is no audio measurement harness in
this repo today.** I cannot render, I cannot analyse, I cannot listen. Everything I measured above
is JS-level logic against fake clocks and stubbed nodes — event counts, timings, object identity.
None of it is a sample. Nobody has heard any of this.

WHAT A HUMAN MUST LISTEN FOR ON A DEVICE, in priority order:
  1. **A gap or thinning in droplet/crackle density starting ~6 s after tapping play**, and again
     ~6 s after toggling a layer on or loading a preset. This is THE failure mode of fix 3: if the
     priming chain ever stalls, rain goes from "rain" to "a hiss with occasional ticks" and the bed
     keeps playing underneath, which is easy to miss if you are not listening for density. Listen to
     rain alone at intensity ~1.0 for the first 30 s. It must not sparsen.
  2. **Clicks on layer toggle, on preset swap and at the play/stop fades.** I changed no ramp and no
     anchor, but node lifetime moved in fix 2 (voices now unregister themselves), so a voice being
     released a moment earlier than before would show up as a tick. Toggle every layer on and off
     ten times each.
  3. **A layer that silently stops responding to its slider**, or a slider that snaps back. That
     would be the fix-1 cache returning a stale value. My fuzz says it cannot, but the fuzz is not
     a device. Drag every slider full range, fast, and watch the knob track the finger.
  4. **The ocean swell period must still be exactly 10.000 s**, and the breathing pacer must stay in
     phase with it over several minutes. I touched neither, but `getOceanPhase()` reads the same
     clock the scheduler does.
  5. **Thunder must still arrive.** It has a 6-31 s start delay and is the sparsest task, so it is
     the one most sensitive to a depth bug. Leave thunder on alone for 5 minutes.
  6. **Overnight:** the app must still be making sound after 8 hours, and droplet density at hour 8
     must sound the same as at minute 1. That is the only real test of fix 2 and of the throttling
     fallback in fix 3.

Changed: `src/audio/engine.ts`, `src/audio/noise.ts`, `src/audio/scheduler.ts`. Nothing else.
Verified: `npm run typecheck` clean. Fix 1 and fix 3 verified by running the real modules against
instrumented stubs (numbers above are measured). Fix 2 verified by reading the library's JS and C++
sources. NO audio was rendered, measured or heard, by me or by anyone.

### Junior Frontend Engineer — finished 15:53:19
Did: implemented the wave-2 fixes in my five files. `npm run typecheck` clean (re-run last against
everyone else's landed work, not just mine).

**1. Per-layer subscription replaces the whole-state broadcast.** New external store in
`src/ui/hooks.ts:123-257`, same shape as `useSettings` (`useSyncExternalStore` + a module store that
stays synchronous and framework-free). ONE module-level `bus.on('mix:changed')` at `hooks.ts:208`
folds each payload into per-layer snapshots, comparing BY VALUE (`layerEqual`, `hooks.ts:153`:
enabled, volume, and every params key in both directions). A layer's listeners are woken only when
that layer's own numbers moved. Exports `useLayerState(id)` (`hooks.ts:245`) and `useMasterVolume()`
(`hooks.ts:252`). `MixerScreen.tsx:81` `useBusEvent('mix:changed', setState)` is GONE — the screen no
longer subscribes to the event at all (`MixerScreen.tsx:92-99` says why, so nobody puts it back).
`LayerCard.tsx:169` and `MasterRow.tsx:28` now read their own slice.
Effect: dragging rain's level used to re-render header + PresetRow + 11 LayerCards + ~13 SliderRows +
MasterRow. It now re-renders one card and the one slider inside it. (reasoned, not measured)

**2. React.memo with value comparison.** `LayerCard.tsx:331` (`propsEqual`, `:327`),
`MasterRow.tsx:92`, and — same hot path, so I did it too — `SliderRow.tsx:115`.
DEVIATION, please read: the brief asked for the value comparison to live in the memo comparators.
I put it in the STORE instead. `engine.getState()` allocates fresh objects, so I removed the
freshly-allocated object from the props entirely rather than defend against it eleven times: the
layer values are compared once per emit in `layerEqual`, and reach the card as a hook, not a prop.
What is left in the props is `id` and `unlocked`, both primitives, and `propsEqual` compares those.
`MasterRow` ended up with no props at all, so there is nothing to compare there — the comparison it
needs happens in `useMasterVolume`'s store. `LayerCardProps` changed (`layer` out, `unlocked` in) and
`MasterRowProps` is gone; both were used only by `MixerScreen`. `unlocked` is a prop, not a local
read, precisely so the memo cannot swallow a lock disappearing mid-session.

**3. Inline arrow props killed** at every line listed: `LayerCard.tsx:102,114,126,139,161,188,197`
are now `useCallback`s (`LayerCard.tsx:172-203`). The five `format` functions close over nothing, so
they are module constants (`LayerCard.tsx:57-61`, `MasterRow.tsx:21-22`). The chip arrow at :161 was
inside a `.map()`, where a hook is illegal, so the chip became its own memoised component
(`BinauralChip`, `LayerCard.tsx:67`).

**BEYOND THE BRIEF, flag it if you disagree — it reverts on its own.** After (1), the one card that
legitimately re-renders at touch-move rate still redrew its whole head — toggle, title, badge,
description, evidence dot — 60 times a second, none of which moves during a drag. Extracted as
`LayerHeader` (`LayerCard.tsx:104`), memoised. It is a component boundary only: the rendered view
tree, the styles and the accessibility props are byte-identical, and no host view was added.

**4. `hooks.ts:34` — no change, and I want to be explicit about why.** The fix described in the
assignment is ALREADY in the code, and was at HEAD before this task started (`git log` shows
`0a9d3c7` as the only commit ever to touch the file). `useBusEvent` already uses the latest-ref
pattern: the effect at :34 with no dep array only assigns `saved.current = handler`, and the
SUBSCRIBING effect below it already has `[event]`. It does not re-subscribe on every render. Team
Lead's finding 6 is a misread of which of the two effects has the empty deps. I read all call sites
(32 now, in 11 files: App 7, TimerSheet 6, BottomBar 5, PresetRow 3, MixerScreen 2, ToastHost 2,
MoonTap 2, BedsideOverlay 2, MixesSheet 1, PaywallSheet 1, MasterRow 1) — every one passes a string
literal as `event`, so `[event]` is constant and each mounted hook subscribes exactly once for its
lifetime. Handlers that close over state (BottomBar, TimerSheet, MasterRow's `applyCap`) get the
freshest closure through the ref. Adding `[handler]` to the ref-writer would be churn worth nothing,
and adding it to the subscriber is the trap the brief warned about. Left alone deliberately.

**5. Control rects — my half.** `MixerScreen.tsx:153-163` builds the array, compares it BY VALUE
against the last published one (`rectsEqual`, `:75`) and returns without calling `onControlsLayout`
when nothing moved. The `(rects: LayoutRectangle[]) => void` contract is unchanged, the 140 ms
debounce is unchanged. A relayout that lands in the same place, or a scroll that settles back on the
same offset, no longer re-renders the app root. A scroll IN PROGRESS still publishes every 140 ms —
the y really is different each time — so the CEO's half is still needed for that.

**6. `Scenes.refresh()` — it landed while I was working, so it IS wired.** Not present when I first
read `renderer.ts` (~15:41); present at `renderer.ts:229` when I re-checked before logging. Called at
`MixerScreen.tsx:126`, ADDED AFTER the existing `resume()`/`pause()` rather than replacing them —
purely additive, so it cannot regress the pause posture, and `refresh()` re-asks unconditionally
where both of those early-return. Senior: if you meant `resume()` to be replaced outright, say so and
I will cut the line.

Held: the engine call on `onValueChange` is NOT throttled, deferred or debounced — nothing on the
drag path changed at all. The thumb is still driven by SliderRow's own state at full native rate and
`draggingRef` still blocks the echo (`SliderRow.tsx:60-62`). Paywall and locked-layer logic untouched
— `activate()` still re-reads `Entitlements.isUnlocked(id)` fresh at tap time, and I did not go near
the `lastRewardedFailure()` grace rule. `getState()` and the `mix:changed` payload are read only.
Nothing about the mixer's appearance or layout changed.

Risk I am carrying into review, honestly:
 - **NOT MEASURED. No device, no profiler.** Everything above is reasoning about render counts. I
   cannot tell you a millisecond. QA's T0/T2 protocol still has to judge this.
 - My store holds references to the layer objects the engine emits, and my fast path is an identity
   check. That is only correct while an emitted snapshot is never mutated in place afterwards. It
   holds today — the Audio Engineer's new `getState()` cache (`engine.ts:453-481`) REPLACES snapshot
   objects rather than mutating them, which makes my compare cheaper still (10 identity hits + 1 real
   compare per emit) — but the two caches are now coupled by that invariant. If anyone ever mutates a
   cached snapshot in place, my cards stop updating and it will look like a UI bug, not an engine one.
 - `MasterRow` taking no props reads oddly next to `LayerCard` taking two. It is deliberate, not an
   oversight.
 - `LayerHeader` is the one change nobody asked me for.

Routed to other owners, not mine to touch:
 - `App.tsx:260` still calls `Scenes.setIntensity` on every `mix:changed`, which still repaints a
   still frame per slider tick while paused (`renderer.ts:187`). My work does not touch that path —
   the whole-app-root re-render is now mostly gone, but this seam is not. CEO + Senior Frontend.
 - `src/ui/sheets/MixesSheet.tsx:50` still takes the whole `EngineState` on every `mix:changed` while
   CLOSED. It can now be one line: `useLayerState`/`useMasterVolume`, or a gate on sheet-open. Whoever
   owns that file this wave — the hook is exported and ready.

Changed: `src/ui/hooks.ts`, `src/ui/screens/MixerScreen.tsx`, `src/ui/screens/LayerCard.tsx`,
`src/ui/screens/MasterRow.tsx`, `src/ui/components/SliderRow.tsx`. Nothing else.
Verified: `npm run typecheck` clean. Import graph checked by hand for the one new edge
(`ui/hooks.ts` -> `audio/engine.ts`): nothing outside `src/ui/` imports `src/ui/`, so no cycle. Every
`useBusEvent` call site read. NOT verified on a device, NOT profiled, and no render count measured.

### Senior Frontend Engineer — finished 15:56:41
Did: implemented all seven approved fixes in my four files — `src/scenes/SceneView.tsx`,
`src/scenes/canvas.ts`, `src/scenes/renderer.ts`, `src/scenes/stars.ts`. Nothing else touched.
Verified: `npm run typecheck` clean, and `npx expo export --platform android` succeeded
(1701 modules, 4 MB .hbc) — so the new `react-native-reanimated` import resolves through Metro.
NO DEVICE. Every performance claim below is a native-call count read or derived from source,
not a profile. Marked per item.

1. SharedValue picture — LANDED. (verified against library source; effect NOT measured)
   `useState<SkPicture>` is gone. `useSharedValue<SkPicture>` seeded with an empty picture goes
   straight to `<Picture picture={sv}/>`. Both silent defeaters handled: the
   `picture ? <Picture/> : null` conditional is gone (hence the seed, so the prop is never null),
   and the child element is `useMemo`d — that second one matters more than it looks, because the
   Team Lead's finding 3 has `Root` re-rendering ~7x/second on a mixer scroll and an unmemoised
   child hands `Canvas.js` a new `children` every time, which is a full `root.render()`.
   Nothing else inside `<Canvas>` takes a per-frame plain-JS prop.
   The rAF loop, FRAME_MS, MAX_FRAME_MS, start/stop and every cancellation rule are unchanged —
   the clock is still an ordinary JS-thread rAF, and I did not move it to the UI thread.
   For QA's battery question specifically: no continuous UI-thread clock is introduced.
   `Canvas.js` calls `useReanimatedFrame(cb, !!onSize)` and we pass no `onSize`, so that frame
   callback is registered with autostart=false. The only UI-thread work is the Reanimated mapper
   Skia installs, and a mapper runs only when one of its input mutables changes. When the loop is
   cancelled nothing writes `picture.value`, so nothing ticks. (reasoned from source — this is
   exactly the claim QA should hold me to with a measured idle-CPU number.)

2. Paint dirty-flag cache — LANDED. (call counts derived from code; NOT measured)
   `basePaint()` no longer calls `reset()`. `Ctx2D` now carries a JS mirror of every paint field
   this file ever writes (colour, alpha, shader, dither, image filter, blend, style, stroke width,
   stroke cap) and pushes only the diffs. antiAlias is set once in the constructor.
   Three places I chose safety over speed, on purpose:
   - `imagePaint()` explicitly rewrites opaque black rather than relying on my reading that Skia
     ignores the paint's RGB when blitting a colour image. It does not ignore it for alpha-only
     images, and being wrong there is a tint on every sprite in the app.
   - `clearShader()` also clears dither, so a solid fill after a gradient is exactly what
     `reset()` used to produce rather than approximately.
   - colour equality is object identity on the `parseColor` cache entry. A cache clear
     (`canvas.ts:60`, which waves triggers every 2 s) only costs one extra write, never a miss.
   Starfield goes from 6 native calls per star to 2 on this change alone.

3. Same-scene guard — LANDED. One line, `renderer.ts` `setScene`.
   Checked all four call sites first. `PresetRow.tsx:73` emits `scene:changed` on the bus itself,
   so nothing depended on `setScene`'s `notify()`. `setWelcomeMode` is an independent module flag
   in moonrise and does not need `init()` to re-run, so the welcome hand-off still works when the
   sleeper's own scene IS moonrise. First-layout `setViewport` still inits the current scene, so
   a startup `setScene('rain')` that no-ops is not an uninitialised rain.

4. The pause hole — my side LANDED, call site ROUTED. `Scenes.refresh()` is exported.
   THE ONE-LINE CHANGE SOMEBODY ELSE NEEDS, in `src/ui/screens/MixerScreen.tsx`, inside
   `onReduceMotion` (currently :99-110). Add `Scenes.refresh();` as the first statement inside
   the `try`, i.e. between the existing `try {` at :102 and `if (engine.isRunning())` at :103:

       (next: boolean) => {
         patchSettings({ reduceMotion: next });
         try {
           Scenes.refresh();                        // <-- ADD THIS ONE LINE
           if (engine.isRunning()) Scenes.resume();
           else Scenes.pause();
         } catch {

   Order is load-bearing: `patchSettings` -> `setSettings` -> `write` puts it in the store cache
   synchronously (`store.ts:60`), so `reducedMotion()` reads the new value. `Scenes` is already
   imported in that file, so it is genuinely one line and no import.

5. Disposal — PARTIALLY landed, deliberately.
   Done, each with a proof rather than a hope:
   - the frame `Ctx2D`'s SkPaint and its last SkPath, released at the end of every picture
     callback (`Ctx2D.dispose()`, called from SceneView). `JsiSkCanvas::drawPath` calls
     `path->snapshot()` — SkPathBuilder::snapshot is a copy, not a detach — and SkCanvas copies
     paints into the record, so both are dead once the callback returns.
   - `Ctx2D.beginPath()` disposes the path it is replacing, same proof. ~20 native paths a frame.
   - `OffscreenSprite` disposes its stale SkImage when the sprite is drawn into again, and gained
     a `dispose()` for the whole sprite (image + ctx + surface).
   SKIPPED, and this is the one that matters: THE PER-FRAME SkPicture IS NEVER DISPOSED.
   `dispose()` flips an atomic flag on the C++ instance (`JsiSkWrappingHostObject::safeDispose`),
   and worklets hands the SAME instance to the UI runtime
   (`serializable.native.js` `cloneHostObject` -> `createSerializableHostObject`). Disposing a
   picture the UI-thread mapper may still be reading throws "Attempted to access a disposed
   object" on the UI thread. There is no moment at which JS can prove the UI thread is finished
   with it, so 24 pictures a second still go to Hermes GC. That is the correct trade and I am not
   going to pretend otherwise.

6. Star batching — LANDED, but the win is smaller than the draw-call count suggests and I want
   that on the record. New `AlphaRectBatch` + `Ctx2D.fillRectBatch()` in canvas.ts, used by
   stars.ts. Per-bucket SkPaths are kept alive and `reset()` rather than rebuilt, which also
   removes ~550 native host-object creations a second.
   Honest accounting for the 150-star field, per frame:
     before                       900 native calls, 150 rect objects, 150 records in the picture
     after item 2 alone          ~300 native calls,   0 rect objects, 150 records
     after item 6 as well        ~200 native calls,   0 rect objects,  ~23 records
   So batching is roughly another 30% off the native calls, and 6.5x fewer recorded draw ops and
   paint copies — NOT a 6x overall win, because `path.addRect` costs about what `canvas.drawRect`
   costs on the JS side. I looked at the three primitives that would give a true bulk win and
   rejected all of them: `drawPoints` takes one stroke width per call so it would have to quantise
   star SIZE as well as alpha; `drawVertices` and `drawAtlas` are one call for the whole field but
   neither antialiases, and these stars are 0.8-3.4 px at fractional positions where AA is most of
   the image; `Skia.Path.MakeFromCmds` is one call per bucket but reads ~30 JSI values per rect
   internally, so it may well be slower than drawRect and I could not tell without a device.
   THE ONE PLACE OUTPUT IS NOT BIT-IDENTICAL: alpha is snapped to one of 32 evenly spaced levels
   (0 and 1 both exact), worst case 1/62 of full opacity — under 4/255 of one channel on the
   brightest star over a near-black sky. Also, two stars in the same bucket that overlap now union
   instead of compositing twice, and the field draws in bucket order rather than insertion order.
   No star is moved, resized, dropped or added. If the CEO wants strict bit-identity, revert the
   one `ctx.fillRectBatch(batch)` line in stars.ts to the old per-star `fillRect` loop; the paint
   cache alone still delivers the 3x and nothing else has to change.

7. Rect literals and the save() snapshot — LANDED.
   `fillRect`, `drawImage` (both source and destination) and `ovalArc` write into per-context
   scratch objects. `JsiSkRect::fromValue` reads the four properties synchronously and builds a
   fresh SkRect, so nothing retains the JS object — checked, not assumed.
   `save()`/`restore()` pool their snapshots behind a depth index instead of push/pop and copy the
   matrix in place; `setTransform` writes the CTM mirror in place too (every inverse term is
   computed before the write). An unbalanced restore still no-ops, as Canvas2D requires.

Deliberately NOT done: the `accRef.current = 0` cadence issue (real cap is 20fps, not 24) is
untouched, as instructed — it is the CEO's call and fixing it makes the app do more work.
FRAME_MS is still 1000/24. No scene draws less. I did not open waves.ts, rain.ts or moonrise.ts.

Routed to whoever owns the other scenes (I added these, I did not apply them outside stars):
 - `AlphaRectBatch` + `Ctx2D.fillRectBatch(batch)` — for any scene drawing many small
   axis-aligned rects that differ only in opacity. Read the class doc first: it is for dust, not
   for scenery, and it would be wrong for large or opaque shapes.
 - `OffscreenSprite.dispose()` — moonrise rebuilds about nine raster surfaces per init and
   releases none of them. The same-scene guard in item 3 stops the repeated rebuilds, but a real
   scene switch still leaks the old set. moonrise.ts is not mine; this is the tool for it.
 - `Ctx2D.dispose()` — only for a context that is finished with. NEVER on a sprite's ctx.

Also flagging: `SkPath.addRect` and `SkPath.reset` are on Skia 2.x's deprecated mutable-path API,
so launch will log two more deprecation lines. It is warn-once per method name
(`JsiSkPath.h` `warnDeprecatedPathMethod` keeps a static set) — I checked that before shipping a
call in a 150-iteration loop, because per-call logging would have been catastrophic.

Needs a device, and I cannot close these from here:
 - all of it, as frame time. My numbers are native-call counts, not milliseconds.
 - QA's idle-CPU-at-pause number, paused and bedside. I preserved the cancellation contract
   exactly and the loop is still plain rAF, but the picture now lands through a Reanimated mapper
   and only hardware proves nothing ticks when nothing writes.
 - a visual A/B of the starfield against the old build, to confirm the alpha bucketing is
   invisible in a dark room. That is the only pixel-level change I made.
Changed: `src/scenes/SceneView.tsx`, `src/scenes/canvas.ts`, `src/scenes/renderer.ts`,
`src/scenes/stars.ts`.

### Software Team Lead — started 16:00:21
About to: final technical review of the whole wave-2 working tree before it goes to the CEO.
Reading adversarially, not trusting any engineer's note: (1) the rAF cancellation contract in
SceneView.tsx under the SharedValue picture; (2) the coupling between hooks.ts's identity-check
layer store and engine.ts's copy-on-write getState() — every mutation path in engine.ts checked
myself; (3) canvas.ts paint dirty-flag invalidation completeness; (4) scheduler.ts chunked horizon
fill, HORIZON_SECONDS=90, time-to-depth, and the throttle-detection fallback including spurious
fire; (5) BreathingOverlay's native-driven Animated.Value phase timing and 6 bpm arithmetic;
(6) resync-on-open in MixesSheet/TimerSheet; (7) moonrise.ts sheep sprite — z-order, alpha
compositing, resize invalidation — which deviated from the authorised fix; (8) frozen contracts
(getState shape, AudioEngine API, bus events, Ads/Billing/Entitlements/Native); (9) standing
product decisions; (10) whether a junior made an architectural call they should not have.
Excluded from this review: the pre-existing uncommitted work (WelcomeScreen, plugins/, ad-SDK
hardening). Review only — I will change no code.

### QA & Verification — started 16:00:39
About to: wave-2 verification gate. Reading all six engineers' fix reports in this file, then
producing (1) the founder-facing check sheet for the SM-A566B / Android 16 (release-BEFORE vs
release-AFTER), (2) the ranked device-verification list pulled from what the engineers themselves
said needs a device, with the consequence of each failing, (3) my blocking conditions for sign-off,
(4) an honest statement of which parts of my own release checklist are un-runnable after a refactor
of this size. First I will confirm for myself that
scratchpad/baseline/app-release-BASELINE-1544-91ab31a.apk exists and is the pre-wave-2 release
artifact, rather than taking it on trust.
I change no code, build nothing, assign nothing. I can block.

### QA & Verification — finished 16:06:42
Did: read all six engineers' wave-2 fix reports, verified the release baseline myself, and produced
the founder check sheet, the ranked device list and my blocking conditions. Changed no code, built
nothing, assigned nothing.

MEASURED — the release-BEFORE baseline is real, and I checked rather than took it on trust:
  - `scratchpad/baseline/app-release-BASELINE-1544-91ab31a.apk` SHA-256
    D9CA1083F1B6008F8B767F275A89762F12CD8A69D8BF5A65CD04FB7CB37A07AF, 54,793,966 bytes.
  - `android/app/build/outputs/apk/release/app-release.apk` hashes to THE SAME VALUE. The
    preserved copy is a true byte-for-byte duplicate, and the on-disk artifact is still the BEFORE.
  - Inside it: `assets/index.android.bundle`, 3,249,424 bytes, stored uncompressed, first 8 bytes
    `c6 1f bc 03 c1 03 19 1f` = Hermes bytecode magic. arm64-v8a only, 27 native libs.
    Platform's artifact claims all hold up.

MEASURED — BUT THE BASELINE IS CONTAMINATED ON ONE FILE, AND THE LOG SAYS OTHERWISE.
Platform's 15:48:15 entry states the wave-2 fixes to `scenes/rain|waves|moonrise.ts` are NOT in
this APK. That is wrong for waves.ts, and I can prove it:
  - The JS bundle was written at **15:40:58** (`android/app/build/generated/assets/react/release/
    index.android.bundle`, and the identical copy under `intermediates/.../mergeReleaseAssets`).
  - `src/scenes/waves.ts` was last written at **15:40:30** — 28 s BEFORE the bundle.
  - Both constants that fix introduced, `rgb(64, 138, 150)` and `rgb(150, 220, 218)`, are
    present in the baseline bundle's string table (offsets 395462 and 473355). They do not exist at
    HEAD 91ab31a. **The waves.ts fix is in the BEFORE build.**
  - `src/scenes/rain.ts` (15:40:43) also predates the bundle write. Its diff adds no new string
    literal, so I cannot discriminate it — assume it is in too.
  - `src/scenes/moonrise.ts` (15:41:25) and every other wave-2 file were written AFTER 15:40:58
    and are genuinely absent. Spot-checked: `ensureSheepBody`, `fillRectBatch`, `useLayerState`
    all absent.
=> The baseline is still a valid BEFORE for everything that matters — the Skia React-state repaint,
the mixer re-render storm, the one-block scheduler fill, the frozen pacer, the sheep sprite are all
absent from it. But it is NOT "the exact code the founder judged", and nobody may claim a win for
the waves.ts colour-parse fix off this pair. It is unattributable from these two builds.

MEASURED — there is NO AFTER BUILD. app-release.apk on disk IS the baseline. Nothing can be
compared until someone runs assembleRelease again, and that rebuild overwrites the only on-disk
BEFORE. The scratchpad copy is now the sole surviving BEFORE artifact. Do not lose it.

MEASURED — build posture for the AFTER build: `android/gradle.properties` currently HAS the two
Norton truststore lines. `app.json` is untouched since 10:22 and has no `android.blockedPermissions`.
So the AFTER build is one `assembleRelease` away and needs no prebuild. If the SYSTEM_ALERT_WINDOW
fix lands in app.json first it forces a prebuild, which wipes those lines and changes the native
side — that must be a separate build AFTER this comparison, not folded into it.

MEASURED — RELEASE HYGIENE FAILURE, unrelated to speed, found while grepping the baseline bundle.
My charter line "`__quietloom` / `grantPremium` absent from the built bundle" FAILS today.
`__quietloom` IS correctly stripped (absent). But `__grantPremiumForTesting` is present at
offset 287177, and so is its `[billing] DEV: premium set to` warning string. Only the
`globalThis` handle is `__DEV__`-gated; the method on the exported Billing object survives into
release bytecode. `MONETIZATION-WIRING.md:270-274` claims both are stripped by `__DEV__` — that
is wrong and should be corrected. Not a blocker for the performance A/B. It IS a ship blocker.
Routing to the CEO; `src/services/billing.ts` is not mine.

STILL UN-RUNNABLE, re-confirmed this wave (nothing changed since my 15:19:28 entry):
  - `tools/render-samples.mjs` does not exist; only `tools/analyse-samples.mjs`, which has
    nothing to analyse. Three audio files changed this wave and NOBODY has heard a sample. The
    Audio Engineer says the same in his own entry. "No layer inaudible", the ~6 dB window,
    peaks <= 0.35 and the 10.0 s ocean period remain un-measurable.
  - `scripts/build-apk.ps1` still does not exist. `npm run apk:release` is now the nearest thing.
  - Every Monetization checklist item remains un-runnable while the ad SDK is excluded.
  - `adb devices` is EMPTY. No phone, no emulator. I executed nothing.

MY BLOCKING CONDITIONS, restated and extended. I will not sign this off on:
  1. debug-only numbers; 2. `npm run typecheck`; 3. `npx expo export` succeeding; 4. "feels
  faster". Both 2 and 3 are green right now and neither has run one line of this code on a phone.
NEW for wave 2, all four are hard:
  5. A measured idle-CPU number on the SM-A566B, scene paused AND in bedside. Stated in wave 1;
     the renderer changed underneath it since, so it now matters more, not less. The picture reaches
     the canvas through a Reanimated UI-thread mapper and "nothing ticks when nothing writes" is
     reasoned from library source, not measured.
  6. A human listening to rain alone for 30 s from the play tap, confirming density does not thin at
     ~6 s. That is the named failure mode of the chunked fill and the bed masks it.
  7. The breathing circle observed animating at 6 bpm (one full cycle per 10 s), AND observed
     stopping when backgrounded. That loop has never executed before, so this is also the first time
     it has ever cost battery.
  8. One variable at a time: the AFTER build must be assembleRelease, minify still OFF, arm64-only,
     no prebuild, no app.json change.
Sign-off is per-fix, not per-wave. Fifteen files changed across six engineers; "faster overall" is
not an answer if one of them regressed.

Delivered to the CEO: the founder check sheet (11 items, pasteable verbatim, no instruments, screen-
shot A/B for the starfield and the sheep since neither survives a from-memory comparison), the
ranked device-verification list with the consequence of each failure, the blocking conditions above,
and the un-runnable list.
Changed: nothing. Verified: the baseline APK, the bundle timestamps and the bundle string table are
MEASURED, first-hand, from the files. Everything about whether wave 2 is faster is UNVERIFIED,
because no AFTER build exists and no device is attached.

### Software Team Lead — finished 16:16:45
Did: read the whole working diff adversarially — SceneView, canvas, renderer, stars, waves, rain,
moonrise, engine, noise, scheduler, hooks, MixerScreen, LayerCard, MasterRow, SliderRow, both
sheets, BreathingOverlay, App.tsx, package.json, README, HANDOFF — plus Sheet.tsx, entitlements.ts,
ocean.ts, timer.ts and the nine layer factories read-only for the seams. Verified the library
claims I could: JsiSkCanvas.h:355 drawPath really does call path->snapshot(), so beginPath()'s and
Ctx2D.dispose()'s disposal proofs hold. Changed no code.

VERIFIED MYSELF, not taken on trust:
 - rAF cancellation contract INTACT and IMPROVED. evaluate() (SceneView.tsx:127-136) still calls
   stopLoop() on all of !appActive / isPaused() / reducedMotion(); stopLoop still cancels. render
   /frame/startLoop/stopLoop are all stable callbacks so the effect runs once. The in-app
   reduceMotion hole is genuinely closed by Scenes.refresh(); the junior put the call AFTER
   resume()/pause() instead of before as routed — I traced all four state combinations and the
   order is immaterial, both work.
 - The two caches ARE safe, and I checked engine.ts myself rather than reading the log. All 8
   mutation paths invalidate (start/stop/setLayerEnabled/setLayerVolume/setLayerParam/
   setMasterVolume/applyMix incl. its else-branch/constructor-null). The one path that could
   break it is engine.ts:576 passing this.layers[id].params BY REFERENCE to the factories — I
   read all nine: rain.ts:41 and thunder.ts:27 copy into a local p, the other seven ignore params.
   Nothing mutates. And hooks.ts:153 layerEqual is identity-fast-path THEN full value compare,
   so it is more robust than its author credited it.
 - canvas.ts paint mirror is COMPLETE. Every native writer (setAntiAlias/BlendMode/ImageFilter/
   Color/Alphaf/Shader/Dither/Style/StrokeWidth/StrokeCap) has a mirror field. The gradient
   branch leaves pColor pointing at an RGB the paint still holds, so the next solid fill is
   correct. setTransform's inverse-and-concat is algebraically right (checked term by term).
 - Scheduler: HORIZON_SECONDS=90 and new Scheduler(ctx) takes the default. Depth is per task and
   only reset in add(), which the layer factories call once per instantiation — setParam does NOT
   re-add, so a slider drag cannot collapse the horizon. 6s + 14x6s at 60ms = 840ms to full depth.
   Under sustained sub-1s throttling each chunk still buys 6s of audio against a <1s gap, so it
   cannot run dry; past 1s late the fallback takes the whole horizon.
 - Breathing: 5+5=10s = 6 bpm unchanged, halo interpolations exact at both endpoints, and
   getOceanPhase() is still read per advancing tick (only the availability BOOLEAN is cached).
 - Sheet resync-on-open is sound: Sheet.tsx:61 renders null until its own effect sets rendered,
   which runs BEFORE the parent's resync effect in the same passive flush, so no stale paint.
 - Frozen contracts: getState() shape byte-identical incl. SOUND_IDS key order; no AudioEngine
   method, bus event or Ads/Billing/Entitlements/Native API touched. LayerCardProps and
   MasterRowProps confirmed by grep to have been local to MixerScreen.
 - Standing decisions: FRAME_MS 1000/24, SWELL_PERIOD 10, OCEAN_PERIOD, 1/f, 90s horizon,
   BAND_COUNT 7, blade/particle counts, coherence default, no-ads-on-sleep-surfaces — all intact.

FOUND (blocking):
 1. moonrise.ts:602-607 — the sheep's ear silently loses its round line cap. The original relied
    on ctx.lineCap='round' set for the legs still being in effect; the sprite's own Ctx2D defaults
    to 'butt' (canvas.ts:280). A 1.6-wide, 3.2-long stroke goes ~33% shorter with square ends.
    One line: g.lineCap='round' before the ear stroke. Junior Frontend.
 2. moonrise.ts:565 — "exactly as crisp as before" is false by construction. env.dpr is capped at
    MAX_SPRITE_SCALE=2 (renderer.ts:44,122) while the SM-A566B is ~2.6-2.8, so the sheep body is
    now a 73px sprite upscaled ~1.4x and bilinearly resampled at a fractional destination every
    frame. Correct for the big memory-bound sprites, wrong for a ~73x46 one. Senior Frontend + Junior.
 3. Verification gate, not a code fix: nobody has seen the SharedValue picture paint. If Skia's
    mapper does not fire, the failure is total and silent — a black opaque canvas under the whole
    UI, every screen, all night. Must be device check #1.
 4. SceneView.tsx:34 is the first app-level import of react-native-reanimated, and there is no
    babel.config.js or metro.config.js in this repo (verified), so Worklets bundle mode is OFF and
    the SDK 57 memory regression Performance Research recorded is unmitigated. Nobody in wave 2
    wrote this down. Senior Platform.

FOUND (non-blocking): LayerCard's unlocked is now computed only when MixerScreen renders, and
the night pass expires on a wall clock with no event (entitlements.ts:31-36) — the visual lock can
go stale longer than before; the functional gate at LayerCard.tsx:173 still re-checks at tap.
sheepBody is never disposed on resize though OffscreenSprite.dispose() now exists. The breathing
pacer runs a 30fps rAF on top of the scene's 24fps with the scene NOT paused behind a 94%-opaque
overlay — newly material because the pacer now actually does work. The pacer does not honour
reduceMotion. scheduler.ts:159 cannot tell OS throttling from a blocked JS thread and answers the
latter with more work. AlphaRectBatch bucket 0 draws a transparent path. team/software-team-lead.md
:52-53 still references the browser path and Capacitor — stale.

JUDGEMENTS: star-alpha quantisation — revert the one line (stars.ts:145). The absolute bound is
right but it understates where it bites: at low scene intensity the faintest stars are drawn up to
~68% brighter than intended and twinkle across two levels, and it is the smallest of the seven wins
(~100 native calls on top of the ~630 the paint cache already banked). Moonrise sprite — the
structure is CORRECT (z-order, mirroring and the 0.82 in-sprite compositing all verified equivalent
term by term) and the junior was right to log the design call, but it was not a junior's call to
make and the mis-sizing is mine.

SIZING ERROR, recorded against myself per my own charter §3.5: the Junior Frontend Engineer made
four decisions in this wave that my own sizing table puts in the Big column — the new external
store and ui->audio import edge in hooks.ts, the LayerCardProps/MasterRowProps interface change,
the LayerHeader extraction, and the moonrise sprite. All four were disclosed, none smuggled, and
the work is good. The routing was wrong, not the engineer.

Changed: nothing — review only.
Verified: by reading, plus the library sources named above. NO DEVICE. Nothing in this diff has
been seen on a screen by anybody, and that — not any of the caches — is the largest open risk.

### Senior Frontend Engineer — started 16:19:21
About to: implement the CEO's three rulings on the wave-2 scene layer, in `src/scenes/stars.ts`
and `src/scenes/moonrise.ts` only.
(1) RULING 1 — revert the star-alpha quantisation at stars.ts:145 back to the exact per-star
    `fillRect` loop, so star alpha is bit-exact again. Keeping the paint dirty-flag cache, which is
    the bulk of the win. Leaving `AlphaRectBatch`/`fillRectBatch` in canvas.ts even if it goes
    unused — canvas.ts is not in scope for this ruling and the primitive is sound.
(2) RULING 2 — restore the round line cap on the sheep's ear in the sprite build (moonrise.ts:602-607),
    which the fresh Ctx2D no longer inherits from the legs, then sweep the WHOLE sprite build for the
    same class of bug: every paint field the old inline code inherited from an earlier draw and the
    fresh context now defaults differently (lineCap, lineJoin, lineWidth, globalAlpha, fillStyle,
    strokeStyle). I expect a sibling and I am looking for it specifically.
(3) RULING 3 — rasterise the sheep body sprite at the TRUE device pixel ratio (`PixelRatio.get()`)
    instead of the `MAX_SPRITE_SCALE`-capped `env.dpr`, so a 73px sprite is never bilinearly
    upscaled on the founder's ~2.6-2.8 dpr SM-A566B. NOT touching MAX_SPRITE_SCALE or env.dpr
    semantics — the meadow sprite depends on that cap. Cache key must move to the scale actually used
    so a rotation/resize still rebuilds.
(4) Non-blocking, same file: dispose the old sheep sprite on resize (moonrise.ts:550) — moonrise
    calls `OffscreenSprite.dispose()` nowhere.
Constraints I am holding: the sheep must look EXACTLY as before — same size, same z-order (legs then
body), same 0.82 fleece alpha compositing, same gait. No other optimisations, no refactors. Not
touching app.json, package.json or anything needing a prebuild (it would wipe the Norton truststore
lines before the CEO's release build).

### Senior Frontend Engineer — finished 17:38:04
Did: implemented the CEO's three rulings, in `src/scenes/stars.ts` and `src/scenes/moonrise.ts`
only. Nothing else opened, nothing else touched.
Verified: `npm run typecheck` clean; `npx expo export --platform android` succeeded (1701 modules,
4 MB .hbc — same module count as before, so nothing was dropped from or added to the graph).
NO DEVICE. Everything visual below is reasoned from the code, not seen.

**RULING 1 — star-alpha quantisation REVERTED.** `stars.ts` `drawField` is byte-for-byte the
loop that was there at HEAD: `ctx.globalAlpha = a * (0.5 + 0.5 * env.intensity)` then
`ctx.fillRect` per star, exact alpha, insertion order, overlapping stars compositing twice again.
`AlphaRectBatch` and the `batch` module constant are gone from the file and so is the import.
`git diff src/scenes/stars.ts` is now ONE hunk and it is a comment — there is no remaining
behavioural difference from HEAD in that file, which is the strongest form of "reverted" available.
Kept, as instructed: the paint dirty-flag cache in canvas.ts, which is the bulk of the win and costs
no pixels (6 native calls per star -> 2; ~931 -> ~300 per frame). Batching was worth ~100 more.

AS ORDERED, THE PRIMITIVE STAYS: `AlphaRectBatch` and `Ctx2D.fillRectBatch()` are still in
`canvas.ts` and are now used by NOBODY — grep confirms stars.ts was the only call site. They are
sound, documented and tested by construction, and another scene drawing dust may want them. Whoever
reads canvas.ts next: that is deliberate dead code, not an oversight. (canvas.ts is untouched by me
this pass.)

**RULING 2 — the ear's round cap is back, and there is NO sibling. I looked properly.**
Fixed: `g.lineCap = 'round'` before the ear stroke in `ensureSheepBody`, with a comment saying
why so the next person does not "clean it up". The ear is a 1.6-wide, 3.2-long stroke, so the two
round caps put 0.8 back at each end — the drawn ear was ~33% short with square ends.
Checked the sprite build against the ORIGINAL inline code field by field, and this is the whole
table. Fresh `Ctx2D` defaults: fillStyle '#000000', strokeStyle '#000000', lineWidth 1,
lineCap 'butt', globalAlpha 1, globalCompositeOperation 'source-over', filter 'none'.
 - `fillStyle` — written before every fill in both versions (FLEECE, then DARK). Same.
 - `strokeStyle` — written before the only stroke in both. Same.
 - `lineWidth` — written (1.6) before the only stroke in both. Same.
 - `globalAlpha` — written explicitly (0.82, then 1) in both. Same.
 - `globalCompositeOperation` — never written by the sheep in either version. The old code
   inherited 'source-over' from the live ctx (traced `paint()`: moonrise never changes it, and
   `nightPass` runs after `paintFrame`'s restore), and the fresh ctx defaults to 'source-over'.
   Equal, by luck rather than by design, but equal.
 - `filter` — same argument: 'none' inherited, 'none' by default. Equal.
 - `lineCap` — 'round' inherited, 'butt' by default. THE BUG. Now written.
 - `lineJoin` — does not exist. `grep -rn lineJoin src/` is empty; the Ctx2D adapter never
   implemented it, so it cannot be a sibling. (The ear is a 2-point line anyway: no joins.)
So the answer to "this one will have a sibling" is: it does not, and I am not going to manufacture
one. lineCap was the only paint field the sprite could inherit and lose, because it is the only one
the old code left implicit.
ONE MORE THING I CHECKED WHILE I WAS THERE, because it is the same class and it would have been
catastrophic rather than subtle: `globalAlpha` on the LIVE ctx at the moment the sprite is blitted
must be exactly 1, or the in-sprite 0.82 fleece gets multiplied twice and the whole sheep goes
translucent. `paint()` sets `ctx.globalAlpha = 1` after the halo (moonrise.ts, before the moon
disc) and nothing between there and `drawSheep` touches it. It is 1. The 0.82 compositing is
intact and unchanged.
Also re-derived the sprite's bounding box with the cap restored: the ear now reaches x = 17.8,
y = -9.3 in local units, inside SHEEP_BODY x [-17, 20], y [-13, 9]. The box does not need to grow —
the padding the junior left is enough. Nothing is clipped.

**RULING 3 — the sheep body is rasterised at the true device ratio.**
`ensureSheepBody` now takes `scale = Math.max(1, PixelRatio.get() || 1)` instead of the
MAX_SPRITE_SCALE-capped `env.dpr`. On the founder's SM-A566B (~2.625) with unit = 1 the sprite
goes 74x44 px -> ~97x58 px, i.e. ~13 KB -> ~23 KB of texture, and the blit stops being a ~1.4x
bilinear magnification and becomes ~1:1.
Scoped exactly as ruled: `MAX_SPRITE_SCALE` and `env.dpr` are UNTOUCHED, `renderer.ts` is
untouched, and the moon and meadow still build at the capped `env.dpr` — the meadow is
`env.w * dpr` wide and uncapping it is what would blow up. `ensureSheepBody` no longer reads
`env` at all, so the parameter is gone; that is its only signature change and it has one caller.
Cache invalidation: the key is now `(unit, scale)` where `scale` is the value actually
rasterised at — `sheepBodyDpr` was renamed `sheepBodyScale` so the name cannot drift from the
thing it guards. `unit` is only ever assigned in `build()`, which runs on init and on every
resize/rotation, and `build()` now releases the sprite outright (below), so a rotation rebuilds
deterministically. `PixelRatio.get()` is a fixed display density and does not change under
rotation, but it stays in the key because it is what the raster depends on.

**NON-BLOCKING, done: the resize leak is closed.** New `releaseSheepBody()` calls
`OffscreenSprite.dispose()` (image + ctx + surface) and clears both cache keys. Called from
`build()` — so the surface is handed back at the rotation, not at the next sheep 60-120 s later —
and defensively from `ensureSheepBody` before it replaces a stale sprite. Safe by the contract
written into `OffscreenSprite.dispose()` in wave 2: a picture that already blitted the sprite
holds its own native reference to the SkImage, so releasing ours cannot disturb a frame still on
screen. This is moonrise's first `dispose()` call; the other ~9 sprites per init still leak on a
scene switch and that is NOT in scope for this wave.

Unchanged and re-verified by reading the diff: z-order (legs stroked first, body blitted over them),
the 0.82 fleece alpha, the mirror (`scale(sheep.dir, 1)` on the blit vs
`scale(sheep.dir * unit, unit)` on the vector — local x [-17, 20] maps to [-20, 17] either way),
the gait, the hop, `tuck`, `bob`, the 40*unit margins, SHEEP_GAP/CROSS, no sheep in bedside and
none in the still frame.

WHAT I AM STILL UNEASY ABOUT (nobody has seen any of this on a screen):
 1. Ruling 3 removes the MAGNIFICATION, not the RESAMPLING. The sheep's x is continuous, so the
    blit still lands at a fractional device-pixel offset every frame and bilinear sampling still
    softens it slightly against the old analytic vector draw. Rounding the destination would fix it
    and would make the walk step. This is inherent to any sprite sheep and I am not going to pretend
    the sprite is now pixel-identical to the vector — it is the same size and the same shape, at
    ~1:1 instead of ~1.4x. A screenshot A/B against the pre-wave-2 baseline is the only way to
    settle whether it reads as soft. QA already has that on the founder check sheet.
 2. `OffscreenSprite` rounds its pixel dimensions to integers, so at ratio 2.625 the sprite is
    97x58 px carrying 97.125 x 57.75 of content — a 0.1-0.4% scale residue in the blit and a
    sub-pixel crop at the right/bottom edge. Both are far inside the padding. Stating it so nobody
    reads "1:1" as literal.
 3. The ear fix and the sizing fix are both invisible in a typecheck and a bundle. Neither has a
    test. The sheep appears once every 60-120 s and for ~10 s, so a device check has to be patient
    or use the welcome screen, where the first sheep is brought forward to 4-8 s. That is the cheap
    way to look at it: open the app, watch the welcome screen, the sheep crosses within 8 seconds.
 4. Ruling 1 gives back ~100 native calls a frame on the stars scene. If the device profile comes
    back saying stars is still the worst scene, that is the honest cost of the ruling and it was
    made with the number in front of everyone.
Changed: `src/scenes/stars.ts`, `src/scenes/moonrise.ts`. Nothing else.

### CEO - closing wave 2 17:42:48
Did: read the Team Lead's review and QA's protocol, ruled on the three blockers, had the
Senior Frontend Engineer implement the rulings, then built the AFTER APK myself.

RULINGS:
 1. Star-alpha quantisation REVERTED. The Team Lead is right that the bound was correct in
    absolute terms and understated where it bites - faint stars up to ~68% bright at low
    intensity, twinkling across two levels. Smallest win in the wave, only pixel change in
    the diff, and this app's product is looking good at 3am. Badly proportioned trade.
 2. Sheep ear round line cap RESTORED. Checked for a sibling bug; there is none, and the
    engineer declined to manufacture one. Good.
 3. Sheep sprite now rasterises at the true device pixel ratio, NOT the capped env.dpr.
    The founder's A56 is ~2.6, the cap is 2, so the first thing anyone sees was a 1.4x
    bilinear upscale of a small moving silhouette. Scoped to the sheep; MAX_SPRITE_SCALE
    and env.dpr semantics untouched.
 4. Reanimated Worklets bundle mode: NOT NOW. It is a real un-mitigated memory regression
    and it is the next thing to do, but it needs a prebuild, which wipes the truststore
    lines and changes the native side. QA is right: one variable at a time. It goes after
    the comparison, not into it.

BUILT: android/app/build/outputs/apk/release/app-release.apk - 52.27 MiB, Hermes bundle
3,260,092 bytes inside. Both baselines preserved in scratchpad/baseline/ (the rebuild
overwrites the release output path, so the preserved copy is the only surviving BEFORE).

ACCEPTED, with the whole team's caveat stated plainly: NOT ONE LINE OF THIS HAS BEEN SEEN
ON A SCREEN. The biggest risk in the diff is not any of the caches everyone worried about -
those were checked and are right. It is that the scene now paints through a code path
nobody has ever executed, and its failure mode is a silent full-screen black rectangle.

ROUTED OUT OF THIS TASK, both mine to schedule:
 - SHIP BLOCKER, found by QA while grepping the release bytecode:
   __grantPremiumForTesting survives into the release bundle. Only the globalThis handle is
   __DEV__-gated; the method on the exported Billing object is not. MONETIZATION-WIRING.md
   lines 270-274 claim both are stripped - that is false. Anyone who can attach a debugger
   unlocks every paid layer forever. Not a perf bug. Fix before any public build.
 - We ship four permissions we do not use, incl. SYSTEM_ALERT_WINDOW, from Expo's prebuild
   template. RECORD_AUDIO is still clean. Fix via app.json blockedPermissions, next prebuild.

Next: the founder runs QA's check sheet on both APKs. Sign-off is per-fix, not per-wave.
