# Task: TESTS — this repo has none

**Opened by:** the founder, 2026-08-03
**Owner:** CEO → Software Team Lead
**Status:** dispatched. Wave 1 running.

---

## The report

> "add tests"

That is the whole brief and it is enough.

## The starting position (measured, 2026-08-03 21:14)

There is **no test framework in this repository at all**. `package.json` has two devDependencies
(`@types/react`, `typescript`) and no `test` script. There is no `babel.config.js`, no
`metro.config.js`, no `jest.config.*`, no `__tests__`, no `__mocks__`, and not one `*.test.ts`
anywhere outside `node_modules`. `npm run typecheck` is the only automated check that exists.

So this is not "increase coverage". It is standing a harness up from zero, and the harness choice
is the expensive-to-reverse part.

## What the CEO wants out of this

1. **A harness that runs in seconds, on this Windows machine, offline, with no device and no
   emulator.** If `npm test` is not as cheap as `npm run typecheck`, nobody will run it and we
   will have bought maintenance instead of safety.
2. **A test map ranked by what has actually broken on this project** — not by what is easy to
   test. The bug history below is the specification.
3. **Real tests landed in wave 2**, in disjoint slices, once the harness is proven.

## The CEO's standing leads

Not conclusions. Start here, and say so plainly if the evidence goes elsewhere.

**Lead 1 — the harness must not change the app bundle.** There is no `babel.config.js` today, and
FASTER established that `babel-preset-expo` 57.0.5 is doing real work implicitly (it auto-adds the
worklets plugin). `jest-expo` wants a babel config. Creating one changes what Metro does to the
*shipping* app, and this app is three days from a release comparison whose whole value is that only
one variable moved. **Say out loud what a chosen harness does to the runtime bundle before landing
it.** If the answer is "nothing, because it only transforms test files", prove that.

**Lead 2 — most of our risk is in plain TypeScript, not in components.** The scheduler's horizon
arithmetic, the noise synthesis parameters, the entitlements night-pass expiry, the unlock decision
table, `mixState`, the preset and evidence data, the frame-clock accumulators — none of that needs
a renderer, a native module or a mock of Skia. React-component tests need `@testing-library/
react-native` plus mocks for `@shopify/react-native-skia` and `react-native-audio-api`, and that is
exactly where RN test suites become a second codebase nobody maintains. **Get the pure-logic tier
working and valuable first.** Argue for the component tier separately, on its own merits.

**Lead 3 — the bug history is the test plan.** Every one of these shipped green:

| What broke | What a test would have had to assert |
|---|---|
| `Date.now()` seeded an accumulator fed `performance.now()` — twice (`SceneView`, `BreathingOverlay`) | frame-clock arithmetic produces a sane `dt` from a monotonic clock; a third instance is *assumed to exist until someone greps* |
| The grace rule was specified against `Ads.isAvailable()` — the wrong question, implemented faithfully | the unlock decision table: load failure → unlocked, genuine dismissal → not unlocked |
| `__grantPremiumForTesting` survives into the **release** bundle (found in FASTER, still open) | a build-output assertion, not a unit test — but it belongs in `npm test` |
| Wind 12 dB too quiet, fire a rumble not a crackle | levels and spectra, which needs the audio harness that **does not exist** — see lead 4 |
| `getState()` caching landed in FASTER wave 2 | the frozen `EngineState` shape, and that no mutation path returns a stale read |

**Lead 4 — QA's checklist is partly un-runnable and that is a finding, not an excuse.** QA recorded
in FASTER that `tools/render-samples.mjs` does not exist, so "no layer inaudible", the ~6 dB window,
peaks ≤ 0.35 and the 10.0 s ocean period cannot be measured today. If a test harness can make any of
those checkable offline, that is worth more than fifty component tests. Scope it; do not assume it.

**Lead 5 — a test that asserts a mock was called proves nothing.** It is the unit-test form of "an
`AAudio` stream opened, therefore the audio works". QA's rule holds here exactly as it does on a
device: verify the outcome.

## Rules for this task

- **No test may require a device, an emulator, a network or a prebuild.**
- **All test dependencies are devDependencies.** The shipping dependency graph does not change.
- **No snapshot tests of scenes.** A pixel or tree snapshot of a living scene is a test that fails
  for the wrong reason every time and gets deleted in a month.
- **Production code may be reshaped for testability only with disclosure.** If a seam is needed,
  write the exact change in your log entry and let it be routed. Do not quietly change behaviour to
  make a test pass — that is the failure mode this whole team structure exists to prevent.
- **Ownership is disjoint.** Do not edit a file assigned to somebody else.
- **Mark reasoning.** A claim that is not measured is `(reasoned, not measured)`.

---

## How to log

**Every person logs when they start and when they stop, and what they are about to do or what they
did.** That is the founder's standing instruction and it is not optional.

This file is written by several people at once, so **append only** — never open it with an editor
and never rewrite it. Use PowerShell:

```powershell
$entry = @'

### <ROLE> — <started|finished>  <!-- timestamp -->
...your lines...
'@
Add-Content -Path tasks/tests.md -Value $entry -Encoding utf8
```

Get a real timestamp with `Get-Date -Format 'HH:mm:ss'`. If `Add-Content` fails because another
role holds the file, wait a second and try again.

---

## Assignments

**Wave 1 — harness and map (now)**

| Role | Scope | Files it may touch |
|---|---|---|
| Software Team Lead | The test map: what is worth testing, ranked by what has actually broken. Sizing and the wave-2 split. Review only | none |
| Senior Platform Engineer | The harness: runner, config, `npm test`, native-module mocks, and the proof that the app bundle is unchanged. Land it with 2–3 exemplar tests, no more | `package.json`, test runner config, `__mocks__/**`, `test/**` or `**/__tests__/**`, `scripts/**` |
| QA & Verification | What a test must prove, where the unit/device line sits, and the trap list. Whether the audio harness gap can be closed offline. Can block | none |

**Wave 2 — tests in slices (after the harness is proven, not before)**
Audio Engineer `src/audio/**` · Senior Frontend `src/scenes/**` · Junior Frontend `src/ui/**` ·
CEO `src/core/**`, `src/services/**`, `App.tsx`.

CEO holds integration and the final call on the harness.

---

## Work log

<!-- APPEND BELOW THIS LINE. Oldest first. Never edit an entry that is not yours. -->

### CEO — opened 21:14:11
Did: read the founder's instruction, the working tree and `package.json`. Established that the repo
has zero test infrastructure of any kind. Wrote this brief and the five leads above, the strongest
being that the harness must be proven not to touch the shipping bundle, and that the pure-logic tier
is where the value is.
Changed: `tasks/tests.md` (new).
Next: dispatching wave 1 — Team Lead, Senior Platform Engineer, QA.

### Software Team Lead — started 21:16:17
Doing: reading the codebase end to end (`App.tsx`, `src/core`, `src/audio`, `src/scenes`, `src/ui`,
`src/services`, `src/data`) to produce the ranked test map, the tier split (pure / needs-native-mock /
needs-device), the missing seams with exact minimal changes requested but NOT made, the refuse-to-test
list, and the wave-2 slice split with disjoint ownership. Also grepping for the CEO's suspected third
`Date.now()`/`performance.now()` frame-clock instance.
Files I will touch: this log only.

### QA & Verification — started 21:16:39


### Senior Platform Engineer — started 21:16:38
Doing: choosing and landing the test harness. Plan of record before I start, so it can be argued with:
1. Read the versioned Expo SDK 57 docs on testing before writing any config.
2. Measure the baseline `npx expo export --platform android` (module count + bundle bytes) FIRST, so
   the bundle-unchanged proof has a before to compare against.
3. Decide `jest-expo` vs a plain fast TS runner for the pure-logic tier on the merits (CEO lead 2),
   and state the risk I am buying either way.
4. Land 2-3 exemplar tests only, on real code reachable without touching `src/`.
5. Assess whether `npm test` can assert on the built release bundle (the open `__grantPremiumForTesting`
   ship blocker) and say where that check belongs.
Files I will touch: `package.json`, test runner config, `__mocks__/**`, `test/**`, `scripts/**`, and
this log. Nothing under `src/`, not `App.tsx`, and no `npx expo prebuild`.

### QA & Verification — finished 21:29:41
Did: read CLAUDE.md, team/README.md, my charter, this brief, tools/analyse-samples.mjs in full,
src/audio/engine.ts + noise.ts + layers/ocean.ts, and swept services/UI/data/store for testability.
Changed: nothing but this log. Assigned nothing. No source touched.

MEASURED (not reasoned) — the audio harness question is ANSWERED, and the answer is not what was assumed.

1. react-native-audio-api 0.13.2 ALREADY SHIPS an OfflineAudioContext:
   node_modules/react-native-audio-api/lib/commonjs/core/OfflineAudioContext.js
   It is UNUSABLE offline. Its constructor calls AudioAPIModule.createAudioRuntime() and then
   globalThis.createOfflineAudioContext(...) — a JSI global installed by the native C++ module.
   It exists only inside a RN runtime with the native lib loaded. It therefore requires a prebuild
   and a device/emulator, which this task's rules forbid. Do not let anyone find this file and
   conclude the harness is free.

2. react-native-audio-api ALSO SHIPS a mock: lib/commonjs/mock/index.js (989 lines).
   IT HAS ZERO DSP. Read from source:
     - AudioParamMock.setTargetAtTime(target)      -> this._value = target   (instant, no time constant)
     - AudioParamMock.linearRampToValueAtTime(v)   -> this._value = v        (instant, no ramp)
     - cancelAndHoldAtTime / setValueCurveAtTime   -> no-ops that return this
     - AudioBufferMock.copyToChannel(...)          -> {} — the noise you write is DISCARDED
     - AudioBufferMock.getChannelData()            -> a fresh zero-filled Float32Array, every call
     - BaseAudioContextMock._currentTime = 0       -> never advances. currentTime is permanently 0.
     - OfflineAudioContextMock.startRendering()    -> resolves an AudioBufferMock = DIGITAL SILENCE
   This is a structural stub for import-safety. It is correct for what it is. It is not a renderer.

3. THE TRAP THIS CREATES IS THE WORST ONE AVAILABLE IN THIS TASK, and I traced it end to end.
   Wire the shipped mock into a render+analyse harness and you get a perfectly-shaped WAV of silence.
   Feed that to tools/analyse-samples.mjs and it DOES NOT THROW. Tracing its code on an all-zero buffer:
     rms 0 -> crest = 0/(1e-9) = 0 ; modulation() mean < 1e-6 -> {depth:0, periodS:0} ;
     transients() e > 0.01 never true -> 0 ; bandEnergies() total = 0 || 1 -> every band 0%.
   It prints a clean, plausible table of zeros for every layer.
   And then: "peaks <= 0.35" PASSES on silence. 0 <= 0.35. My own checklist item, written as a
   one-sided bound, is GREEN on an engine that emits nothing. That is exactly the AAudio-stream-opened
   failure this role exists to catch, reproduced in unit-test form.
   => ANY level assertion must be TWO-SIDED (a floor and a ceiling), and the harness must first prove
      it can measure a KNOWN signal. See the self-test requirement below.

4. The API surface src/audio actually needs is small and entirely standard (measured by grep):
   createGain 36, createBiquadFilter 12, createOscillator 9, createBufferSource 9,
   createStereoPanner 3, createBuffer 2, createWaveShaper 1, createPeriodicWave 1.
   AudioParam: setValueAtTime 30, setTargetAtTime 16, linearRamp 8, exponentialRamp 8,
   setValueCurveAtTime 1, cancelScheduledValues 1, cancelAndHoldAtTime 1.
   Non-audio native imports in the whole of src/audio: exactly ONE — `AppState` from react-native
   (engine.ts:41). The shim is genuinely small. The analyse-samples.mjs header comment saying
   "rebuilding the renderer is not much work" is accurate.

VERDICT ON THE AUDIO HARNESS: BUILDABLE, WORTH BUILDING, AND ITS AUTHORITY MUST BE SCOPED.
I do not fully endorse "worth more than fifty component tests" as stated. It is worth more than fifty
component tests FOR ONE CLASS OF BUG and is structurally blind to another class that has also shipped here.
  - What it WOULD have caught: wind 12 dB quiet, fire 87% below 200 Hz, a broken ocean period, a layer
    silently at zero, a TRIM regression. These are arithmetic on our own constants and our own graph, so
    any spec-correct DSP evaluates them the same. This is real and it is the class my checklist names.
  - What it would MISS, and this is the part to say out loud: every bug in the port was a LIBRARY-BINDING
    bug, not a DSP bug — copyToChannel measuring the backing ArrayBuffer rather than the view
    (noise.ts:107-114), onEnded vs onended, the native event-registry retain cycle, the absent
    DynamicsCompressorNode. A non-RN renderer does not merely fail to catch these; it MASKS them.
    noise.ts:113 records it in the engineer's own words: "The browser sized the copy from the view's own
    length and never complained, which is exactly why the bug survived the port."
  So: the harness proves DSP INTENT. It does not prove the shipped audio. It retires no device listen.
  Build it, and label it that way in its own header, or in six months someone will cite a green
  render as evidence the audio works.

RECOMMENDED SHAPE (a spike with a kill criterion, not a commitment):
  node-web-audio-api 2.1.0 (BSD-3, wraps orottier/web-audio-api-rs) — real DSP, real OfflineAudioContext,
  plain Node, no browser, no Chromium download. Windows x64 prebuilt binaries confirmed available.
  Shim: one module mapping 'react-native-audio-api' -> node-web-audio-api, plus an AppState stub.
  GO/NO-GO, 30 minutes, before anyone writes a test: render a 12 s graph and assert
  cancelAndHoldAtTime, setValueCurveAtTime, createPeriodicWave and createStereoPanner all exist and
  have an audible effect. If cancelAndHoldAtTime is missing the shim can polyfill it; if
  createPeriodicWave is missing, ocean's exact phase export cannot be reproduced and the 10.0 s
  measurement is off the table by this route. Kill it there rather than half-building it.
  CAVEAT (measured from its own README): "AudioBuffer#getChannelData is implemented but not reliable in
  some situations" — use copyFromChannel to extract samples, not getChannelData.
  MANDATORY SELF-TEST: before any layer is measured, render a synthetic reference the harness itself
  builds (e.g. a 0.25-amplitude 1 kHz sine and a 0.1 Hz AM tone) and assert the analyser recovers the
  known peak, RMS and 10.0 s period. A harness that cannot measure a signal it constructed cannot be
  trusted to measure rain. This is the guard against trap 3 above.
  DETERMINISM: Math.random() is used in all 12 audio modules (rain 11 sites, wind 10, crickets 9,
  fire 7, thunder 8...). Assert statistical bands over a fixed-length render, never exact sample values,
  or seed Math.random in the harness. Do NOT reshape src/audio to inject a PRNG for this.

SEPARATELY, AND CHEAPER THAN ALL OF THE ABOVE: the 10.0 s ocean period is partly provable with NO
renderer at all. getOceanPhase() is (ctx.currentTime * OCEAN_HZ) % 1 with OCEAN_HZ = 0.1 (ocean.ts:35).
A fake clock proves the phase math, the trough/crest convention and the wrap, today, in milliseconds.
Same for the breathing pacer: Coherence 6 bpm IS 0.1 Hz IS OCEAN_HZ. A one-line invariant test that
the breath rate equals OCEAN_HZ would have caught a desync between the pacer and the swell. Land those
two before anyone installs anything.

FINDINGS FILED (not instructions; routing is the CEO's):
  a. `__grantPremiumForTesting` (billing.ts:197) is OUTSIDE the `if (__DEV__)` block and IS PRESENT in
     the built release bundle (android/app/build/generated/assets/react/release/index.android.bundle).
     `__quietloom` is correctly stripped (0 occurrences). MONETIZATION-WIRING.md:271-272 and
     BUSINESS.md:547 both claim BOTH are __DEV__-gated. Only one is. Confirms the FASTER finding.
  b. All three Google TEST ad unit IDs (ca-app-pub-3940256099942544/...) are in that release bundle.
     ads.ts:137 `const TEST_MODE = true` is an ungated module const and only feeds a log line — flipping
     it alone changes nothing, because AD_UNITS hard-codes the test IDs independently.
  c. My checklist item "Nothing describes Deep Pulse as slow-wave enhancement" FAILS TODAY in
     user-facing copy: evidence.ts:128 and presets.ts:104 both say "modelled on a slow-wave enhancement
     protocol"; README.md:8 says "the slow-wave pulse" with no hedge. deeppulse.ts:16 contains the
     prohibition itself. This is a Research Lead call, not mine, but it is a shipping-copy failure of a
     standing product decision and a 5-line offline test would hold it.
  d. Night-pass expiry is "next 11:00 local" (entitlements.ts:13-19). A pass granted at 09:00 therefore
     lasts TWO HOURS, not until tomorrow. That may be intended; it is not what "night pass" implies.
     Product question, flagged before a test enshrines it.
  e. There is NO versioning or migration on ANY persisted value — SavedMix, lastMix, settings are all
     read back raw. "Saved mixes survive a force-stop" can be proven offline; surviving a SCHEMA CHANGE
     cannot, because nothing implements it.
  f. The CEO's suspected THIRD frame-clock instance: DENIED. Exactly two rAF loops exist in src/
     (SceneView.tsx, BreathingOverlay.tsx), both already fixed and both seeded -1 with a guard.
     Zero performance.now() call sites remain outside comments. Closing that lead.
  g. The grace rule lives INSIDE a React component (PaywallSheet.tsx:95-101), not in a service. The
     single highest-value test in this repo cannot be written in the pure tier without a seam. I am not
     requesting the change — I am recording that the pure/component split does not fall where lead 2
     assumes for the one item with the worst bug history. Disclose and route.

STALE ITEMS IN MY OWN CHARTER (team/qa-verification.md — CEO owns the file, I am only reporting):
  - "com.quietloom.app" is wrong; the package is com.quietloom.rn.
  - ".\scripts\build-apk.ps1" does not exist. scripts/ holds fix-truststore.ps1 and run-emulator.ps1.
    Builds are `npm run android:release` / `npm run apk:release`.
  - "node tools/render-samples.mjs" does not exist. Only analyse-samples.mjs.
  - "adb logcat -s Capacitor Ads chromium" — Capacitor and chromium tags are dead; there is no WebView
    and no Capacitor. Should be ReactNative/ReactNativeJS.
  - "clear quietloom.lastInterstitialDay in localStorage" — there is no localStorage. It is AsyncStorage,
    and Ads.__resetInterstitialDay() already exists (ads.ts:544, itself ungated).
  - "Tapping through a scrolling WebView with adb input tap" — there is no WebView. The caveat may still
    hold for RN scroll views but the stated reason does not.
  - "__quietloom / grantPremium absent from dist/" — there is no dist/. The artifact is
    android/app/build/generated/assets/react/release/index.android.bundle.
  - "AdMob APPLICATION_ID survived cap sync" — there is no cap sync; android/ is generated by expo
    prebuild. Item is not merely stale, it is inapplicable.
  - Environment caveat on Norton/emulator ad fill is still true but now moot: package.json excludes
    react-native-google-mobile-ads from autolinking entirely, so NO build has an ad path right now.
    Every Monetization checklist item is un-runnable on device today for that reason, not Norton's.

WHAT I WILL BLOCK ON (saying it now so nobody is surprised at sign-off):
  1. Any sign-off resting on `npm test` green plus `npm run typecheck` green. Both are mechanism.
  2. Any audio sign-off resting on a render harness alone. The render proves intent; a human must still
     hear rain, on the device, on the shipping build variant.
  3. Any level assertion written as a one-sided upper bound. Silence passes those. Floor and ceiling.
  4. Any harness whose self-test does not first recover a known signal it constructed itself.
  5. Any ad-path sign-off from this machine, from the emulator, or from any build with the ad SDK
     excluded from autolinking. That path has never once been seen working end to end.
  6. A release with `__grantPremiumForTesting` reachable in the release bundle, or with Google test ad
     unit IDs in it.
  7. Any test suite where a skipped test reports as a pass — specifically the build-output assertions,
     which have no bundle to read until a release build exists. A silent skip there is worse than no test.
  8. Any claim that the harness "did not change the shipping bundle" that is not backed by a byte
     comparison of the bundle before and after. Lead 1 is right and it is measurable, so measure it.

UNVERIFIED / REASONED, explicitly: node-web-audio-api's coverage of cancelAndHoldAtTime,
setValueCurveAtTime, createPeriodicWave and createStereoPanner is (reasoned, not measured) — I read its
README, not its source, and I did not install it. That is precisely why I scoped it as a 30-minute
go/no-go spike rather than a recommendation. Everything above about the SHIPPED mock and the SHIPPED
OfflineAudioContext is measured, read from node_modules source. The analyse-samples.mjs behaviour on an
all-zero buffer is traced from its source, not executed (reasoned, not measured) — it is 12 lines of
arithmetic and I am confident, but it should be run once against a silent WAV to confirm the trap.

### QA & Verification — addendum 21:30:56
Two things found after I wrote my finished entry, recorded rather than lost.

1. TRAP 3 IS NOW MEASURED, NOT REASONED. I copied tools/analyse-samples.mjs to scratchpad, generated a
   5 s 44.1 kHz mono WAV of pure digital silence (byte-for-byte what OfflineAudioContextMock.startRendering
   resolves), and ran the real analyser against it. It did not throw. Exit code 0. It printed:
     silence-from-mock      0      0             0         0s     low:0% lo-mid:0% mid:0% high:0%
   A clean table. "peaks <= 0.35" passes. Confirmed: a render harness built on the shipped mock produces
   a green, plausible measurement of nothing. Two-sided bounds and the known-signal self-test are not
   optional.

2. REVIEW OF THE LANDED HARNESS (test/bundle/release-bundle.test.ts), which is otherwise good work and
   gets my blocker 7 right — "has actually been built" FAILS rather than skips when no bundle exists, and
   the staleness check against newest src mtime is a better idea than I asked for. One defect:
   lines 91 and 103, `if (!found.length) return;` — a bare return in vitest is a PASS, not a skip. With no
   release bundle present the run reports "contains no dev-only backdoor symbols: PASSED" having read
   nothing. Test 1 failing loudly does mitigate it, but a green line that checked nothing is the exact
   mechanism-vs-outcome error this suite exists to prevent, and it is the line someone will quote.
   Suggest expect.fail() or a describe-level guard. Not my file; filed to the Team Lead.
   Confirmed NOT a problem: no audio mock has been wired yet, so trap 3 is not live in the repo today.
   It becomes live the moment wave 2 gives src/audio/** to the Audio Engineer.

### Software Team Lead — finished 22:08:45
Did: read App.tsx, src/core/**, src/audio/**, src/services/**, src/data/**, src/ui/** (hooks, layers,
sheets, mixState, PaywallSheet, PresetRow, LayerCard, BreathingOverlay pattern table), src/scenes/
renderer.ts + SceneView.tsx, and QA's finished entry + addendum. Produced the ranked map, tiers, seams,
refusals and the wave-2 split.
Changed: nothing but this log. No source touched, no seam made.

TIER BOUNDARY — MEASURED, and it is further out than lead 2 assumed.
Runtime (non-type) imports per file, grepped, not guessed. Files with ZERO native runtime imports:
  src/audio/scheduler.ts, noise.ts, onef.ts, chime.ts, types.ts, and ALL ELEVEN src/audio/layers/*.ts
  src/core/bus.ts, timer.ts (only ./bus)
  src/data/presets.ts, evidence.ts
  src/ui/layers.ts, sheets.ts, mixState.ts, theme.ts
Every layer factory takes `ctx` as a PARAMETER. So the whole DSP graph construction, the scheduler and
the noise generators are tier 1 against a hand-written fake context — no module mock, no jest.mock, no
shipped RN mock. The context surface is exactly 8 create* methods (createGain 36, createBiquadFilter 12,
createOscillator 9, createBufferSource 9, createStereoPanner 3, createBuffer 2, createWaveShaper 1,
createPeriodicWave 1) plus currentTime/sampleRate/destination/state/resume. ~70 lines of fixture serves
all of src/audio. Tier 2 (one module mock) is only: core/store.ts (AsyncStorage — ships its own jest
mock at node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js),
services/entitlements|billing|ads.ts, audio/engine.ts (AppState + 3 value imports), audio/background.ts.
Tier 3 (renderer) is every .tsx plus ui/hooks.ts and scenes/renderer.ts.

ON QA'S TRAP 3 — my noise entry is NOT that trap, and the distinction is load-bearing.
QA is right that the shipped react-native-audio-api mock discards copyToChannel and that a render+analyse
harness built on it measures silence green. My ranked entry 5 does not go near it: noise.ts has zero
runtime imports, so nothing imports react-native-audio-api at all. A plain object literal whose
createBuffer returns { copyToChannel(d) { captured = d } } hands back the REAL Float32Array the
generator produced, before any AudioNode exists. No graph, no mock, no analyser. And it satisfies QA's
blocker 3 by construction: the assertions are two-sided equalities (peak === PEAK 0.9, |mean| < 1e-4,
pink -3 dB/oct, brown -6 dB/oct), every one of which FAILS on silence. That is the known-signal
self-test QA demands, except the known signal is the thing under test.
It does NOT close the ~6 dB inter-layer window or TRIM — those need the whole graph, i.e. QA's
node-web-audio-api spike. Scope: entry 5 proves the GENERATORS; the spike proves the MIX. Neither
retires a device listen. (reasoned, not measured — I did not execute it.)

SEAMS. Four, and they are all one shape: pure logic trapped inside a .tsx. I am requesting, not making.
S1 (highest value — QA finding g, answered). Grace rule, PaywallSheet.tsx:95-101.
    ADD to src/services/ads.ts (additive to a frozen contract, so allowed):
      export function shouldGrantNightPass(earned: boolean, failure: RewardedFailure): boolean {
        return earned || failure !== 'declined';
      }
    CHANGE PaywallSheet.tsx:101 from  `if (!earned && reason !== 'declined') earned = true;`
                                 to  `earned = shouldGrantNightPass(earned, reason);`
    4 lines added, 1 line changed, zero behaviour change. Moves the worst-bug-history item in the repo
    from tier 3 to tier 1. Owner of ads.ts in wave 2 is the CEO, so this is a one-file CEO change.
S2. Frame clock, SceneView.tsx:87-102 and BreathingOverlay.tsx:208-222 — the same accumulator written
    twice, which is WHY the bug shipped twice. NEW src/core/frameClock.ts exporting a pure
    createFrameClock({ frameMs, maxFrameMs }) with step(now): number | null (null = do not paint).
    Both loops call it. Deletes the duplication the bug lived in. Sequencing matters: the pure module
    plus the SceneView conversion is Senior Frontend; Junior Frontend converts BreathingOverlay AFTER,
    so ownership stays disjoint.
S3. Breath patterns. PATTERNS is module-private in BreathingOverlay.tsx:49-70. Coherence is 5 s + 5 s =
    10.0 s = OCEAN_PERIOD (ocean.ts:36) — the pacer and the swell are the same number held in two files
    owned by two different people, with nothing holding them together. Move the PATTERNS table verbatim
    to a new src/data/breathing.ts and import it. Then QA's one-line invariant becomes tier 1.
S4. layerEqual, hooks.ts:153-166. Move verbatim into src/ui/mixState.ts, whose own header already says
    "the arithmetic is the arithmetic, so it lives in one place rather than three". hooks.ts imports it
    back. FASTER recorded the exact risk this guards (faster.md:1325-1329): if a cached snapshot is ever
    mutated in place the cards stop updating and it reads as a UI bug, not an engine one.
SEAMS I CONSIDERED AND AM NOT ASKING FOR, deliberately:
  - No __resetForTests on core/store.ts. hydrate() is exported and awaitable, write/remove drive the
    cache, and a per-file module reset handles the rest. Adding a test-only export earns nothing.
  - Do NOT export noise.ts's fillPink/fillBrown/sealLoop/normalise. Testing through getNoiseBuffer
    exercises the cache, the seal AND the normalise on the real path. Exporting internals would test
    less, not more, and it is the "reshape production for tests" failure the brief warns about.
  - Do NOT inject a PRNG into src/audio. Agreeing with QA: assert bands over a fixed render, or seed
    Math.random in the harness.

REVIEW FINDING I OWN — QA filed this to me and I confirm it by reading the file.
test/bundle/release-bundle.test.ts:91 and :103, `if (!found.length) return;`. A bare return in vitest is
a PASS, not a skip, so with no release bundle present "is not older than the source it claims to
represent" and "contains no dev-only backdoor symbols" both report GREEN having read nothing. Test 1
failing loudly mitigates it but does not fix it — the green lines are the ones that get quoted. This is
QA blocker 7 and it is correct. ROUTED TO SENIOR PLATFORM (their file, not mine): replace both with a
hard failure, e.g. expect.fail('no release bundle — run npm run apk:release'), or gate the whole
describe. The rest of that file is good work and gets blocker 7 right where it matters (test 1 fails
rather than skips, and the staleness check is better than what was asked for).

OWNERSHIP COLLISION IN WAVE 2, flagged before it destroys work. Senior Platform owns test/** in wave 1
and has already landed test/unit/entitlements.test.ts and test/unit/mixState.test.ts. Wave 2 hands
src/** to four people who will all want to write into test/unit/. RULE, so the split stays disjoint:
the test file path MIRRORS the source path it covers, and ownership follows the SOURCE, not the folder.
test/audio/** Audio Engineer, test/scenes/** Senior Frontend, test/ui/** Junior Frontend, test/core/**
+ test/services/** + test/data/** CEO, test/bundle/** + test/fixtures/** Senior Platform. The two landed
exemplars hand over on day one: entitlements.test.ts -> CEO, mixState.test.ts -> Junior Frontend.
ALSO: src/data/** is not assigned in the wave-2 table at all. I am putting it with the CEO, because
App.tsx:59 DEFAULT_PRESET is the thing that makes it matter.

THIRD FRAME-CLOCK BUG: independently swept before I saw QA's entry — 26 timestamp variables traced to
their init and use sites; performance.now() has zero call sites in src/; every subtraction is
same-domain. Concurs with QA finding f. CLOSED, no further lines spent. Two residues, neither the bug
class, neither worth a test: SceneView.tsx:62 seeds useRef(0) while the sentinel test at :92 is `< 0`
(unreachable — :119 writes -1 before the first rAF — and S2 deletes it); and moonrise.ts:175-177,:771
guards wall-clock-derived data with a TTL measured on the scene clock, which stops when the loop is
cancelled. Comment, not a test.

Next: handing the ranked map, tiers and wave-2 split to the CEO in my reply. Nothing is blocked on me.

### Software Team Lead — addendum 22:09:25
Found in my own sanity check after logging, so recording it rather than leaving it in a reply only.

`npm test` is RED right now — both exemplar suites fail to LOAD, no tests execute:
  test/unit/entitlements.test.ts -> "Vitest failed to find the runner"
  test/unit/mixState.test.ts     -> TypeError: Cannot read properties of undefined (reading 'config')
Senior Platform has no `finished` entry yet, so this is in-flight work and I am reporting it, not
filing it as a defect. Measured at 22:08:59, `npm test`, 689 ms, "Test Files 2 failed (2) / Tests no
tests".

It does change one thing in my recommendation and I want it in the record: WAVE 2 MUST NOT START UNTIL
`npm test` RUNS GREEN ON THE EXEMPLARS. The brief already says "after the harness is proven, not
before"; this is the concrete gate for that word. Four engineers writing tests against a runner that
cannot load a test file will produce four people debugging the same config, in four slices, in
parallel — which is precisely the collision FASTER recorded when the shared typecheck went red
mid-wave (faster.md:791-795, :1040-1045) and everyone had to work around somebody else's in-flight edit.
Gate it on one green run, from one owner, before anything is handed out.

Note also that "Tests no tests" reported at the same time as a non-zero exit is the same shape as QA's
blocker 7 seen from the other side: a suite that runs nothing must never be able to look like success.
Worth Senior Platform confirming the exit code is non-zero in CI-shaped use, not just locally.

### Senior Platform Engineer — finished 22:08:51
Did: chose and landed the test harness. **Vitest 4.1.10, not jest-expo.** 16 tests, 3 exemplars,
2 tiers, no `babel.config.js`.

**LEAD 1 ANSWERED — the shipping bundle is unchanged, and I can show it byte by byte.**

First, the mechanism, read from installed source not from memory
(`node_modules/expo/node_modules/@expo/metro-config/build/loadBabelConfig.js:32-74`):
`resolveBabelrcName()` probes 13 filenames in the project root. Finding NONE today, it falls to
line 63 `result.presets = [require('expo/internal/babel-preset')]` — which is a bare re-export of
`babel-preset-expo` (`node_modules/expo/internal/babel-preset.js`). The moment ANY of those 13
files exists, line 57 sets `result.exts` instead and the implicit preset is **never assigned**;
Babel is then driven by that file via `extends` (`babel-transformer.js:134`). Two further effects
nobody has mentioned: `babel-transformer.js:129/132` set `babelrc` and `configFile` true under
`enableBabelRCLookup`, so the config would ALSO be discovered a second time by Babel's own search;
and `getCacheKey()` (:180-202) returns `''` today but would start hashing the config file's
contents, invalidating the entire Metro transform cache. So "just add a babel.config.js that says
what the default already says" is NOT a no-op on paper.

I did not have to resolve any of that, because **Vitest needs no Babel config at all** — it
transforms TypeScript with esbuild. So the correct answer to "what does this harness do to the
runtime bundle" is "nothing, because Metro's inputs are unchanged" — and here is the proof rather
than the assertion.

PROOF (measured). `npx expo export --platform android` three times, to scratchpad dirs, never
touching `dist/`:
  1. `export-before`   — before any devDependency was installed
  2. `export-after`    — after vitest + @types/node + configs + `__mocks__/` + `test/` all landed
  3. `export-control`  — again, with NOTHING changed since (2). The control.

| | before | after | control |
|---|---|---|---|
| modules | 1701 | 1701 | 1701 |
| .hbc bytes | 4,006,337 | 4,006,337 | 4,006,337 |
| Metro content-hash filename | index-87b3fbb0...759.hbc | identical | identical |
| metadata.json sha256 | 82794CCC... | identical | identical |
| 4 asset sha256s | — | all identical | all identical |

The .hbc sha256 differs across all three. I did not wave that away, I byte-diffed it:
  before vs after   : 42 of 4,006,337 bytes, ranges [3381629-3381644][3381653-3381658][4006317-4006336]
  after  vs control : 42 bytes, the SAME two regions
  before vs control : 39 bytes, the SAME two regions
Decoded, the first region is a string:
  `...\AppData\Local\Temp\expo-bundler-0.7796960606469676-1785781058757\index.js`  (before)
  `...\AppData\Local\Temp\expo-bundler-0.5044871327007321-1785781925214\index.js`  (after)
  `...\AppData\Local\Temp\expo-bundler-0.7404452106342068-1785784031371\index.js`  (control)
— the temp file Expo hands to `hermesc`, embedded as the source filename for stack traces. It
carries a `Math.random()` and a `Date.now()`. The embedded epochs are 18:17:38Z / 18:32:05Z /
19:07:11Z, matching my three export times. The second region is the trailing 20 bytes: Hermes's
SHA1 epilogue, which must change once any byte does.
**Zero application bytes differ.** And because before-vs-control differs by as much as
after-vs-control, the harness is provably not the variable — a byte-identical `.hbc` is
unobtainable on this machine regardless of what anyone changes.

**Requirement 1 — measured, on this machine, offline, no device:**
  `npm test`          2.7 s wall (520 ms in-suite, 16 tests, 2 files)
  `npm run typecheck` 10.2 s wall
The harness is ~4x cheaper than the check we already run. It clears the CEO's bar.

**Requirement 3 — devDependencies only.** `dependencies` is untouched, verbatim. Added dev-only:
`vitest@^4.1.10`, `@types/node@^26.1.2`.

DISCLOSURE, because it is a real side effect and nobody asked for it: vitest pulls `@types/node`
transitively, and `tsconfig.json` sets no `types` array, so TS auto-includes it and the *app's*
typecheck surface changed (Node globals are now in scope for `src/`). I pinned `@types/node`
explicitly so it is deterministic rather than a transitive accident. `npm run typecheck` is clean
after (measured). If anyone wants that surface reverted, the fix is `"types": ["node"]` scoping in
tsconfig.json — NOT my file, so I did not touch it.

**WHY VITEST AND THE RISK I AM BUYING (requirement 4).** Expo officially recommends `jest-expo`
(docs.expo.dev/develop/unit-testing). I read it and went the other way for the pure-logic tier:
 - jest-expo buys the component tier and Expo's blessing. It costs a `babel.config.js` (see above),
   a much larger dep tree, and Babel-transforming everything on every run.
 - Vitest costs Expo's blessing and the component tier. It buys zero Babel config, zero bundle
   risk, and a 520 ms suite.
CEO lead 2 says the risk is in plain TypeScript. So I bought the tier with the risk in it.
**The risk I am buying, stated plainly:** Vitest resolves modules with Vite's resolver, not
Metro's. Two consequences. (a) Platform extensions — `.android.ts` / `.native.ts` — will NOT
resolve the way Metro resolves them. The repo has none today (verified: no such file in `src/`),
so this is latent, not live. (b) Package `exports` conditions differ: tsconfig sets
`customConditions: ["react-native"]` for tsc, Vitest will take the node condition. Neither bites
the pure-logic tier, which imports no packages. Both would bite a component tier.
**Therefore the component tier is NOT reachable from this harness and I am not pretending it is.**
Landing `@testing-library/react-native` here would mean Babel-transforming RN's Flow-typed source,
which is the jest-expo decision arriving by the back door. That is a separate argument on its own
merits, exactly as lead 2 asks — I am not making it, and I recommend nobody makes it until wave 2
has shown the pure tier is not enough.

**Changed** (nothing under `src/`, no `App.tsx`, no `expo prebuild`):
 - `package.json` — 3 scripts (`test`, `test:watch`, `test:bundle`), 2 devDependencies
 - `package-lock.json` — consequence of the above
 - `vitest.config.mts` — unit tier + the AsyncStorage alias
 - `vitest.bundle.config.mts` — build-output tier
 - `__mocks__/async-storage.ts` — in-memory AsyncStorage
 - `test/unit/mixState.test.ts`, `test/unit/entitlements.test.ts`, `test/bundle/release-bundle.test.ts`
`.mts` not `.ts` on the configs on purpose: Vite warned that a `.ts` config is loaded as CommonJS
and will break under the future native config loader. `"type": "module"` would have fixed it too
and would have been a change to the whole app. I took the local fix.

**THE 3 EXEMPLARS, each proving a different capability (requirement 5):**
 1. `test/unit/mixState.test.ts` — 8 tests, ZERO mocks. Reaches real `src/ui/mixState.ts` with its
    real `../data/evidence` and `../types` imports. Pins `sceneIntensity`'s 0.12 floor (without it
    the canvas goes black on a muted mix), its ceiling, that peak is a max not a sum, and the 0.5
    default when the rain `intensity` param is absent.
 2. `test/unit/entitlements.test.ts` — 8 tests. Proves the harness reaches a module whose
    transitive graph contains a NATIVE module (`entitlements` -> `core/store` -> AsyncStorage) via
    one alias, and can drive the system clock. Subject is the CEO-named night-pass expiry. The
    branch worth having: granted at 03:00 the pass must die at 11:00 the SAME morning, not 35
    hours later. Plus the `isUnlocked` table — free four always free, paid locked without
    premium/pass, pass unlocks then re-locks on expiry, premium overrides, revocation re-locks.
    Per lead 5, not one assertion is "a mock was called" — the mock is a working in-memory store
    and every assertion is "can this user still hear this sound".
 3. `test/bundle/release-bundle.test.ts` — the build-output tier. See below.

**REQUIREMENT 6 — CAN `npm test` ASSERT ON THE RELEASE BUNDLE? Yes. It should NOT be in `npm test`.**
It is `npm run test:bundle`, and it is RED right now, correctly. Three reasons it is separate:
 (a) it can only be as truthful as the last build, so a green run against a stale artifact is a
     lie — the test carries an explicit staleness guard comparing bundle mtime against the newest
     mtime in `src/`;
 (b) it is red today on a known open blocker, and wiring a permanently-red test into the default
     command trains everyone to ignore the suite;
 (c) it needs a release build, which breaks "seconds, offline, no device" for the default command.
**Where it belongs: the release checklist, as a gate.** QA can now enforce the blocker instead of
describing it.

It found the known blocker AND one nobody had listed. Measured, in
`android/app/build/generated/assets/react/release/index.android.bundle` (built 17:41:47 today,
and identically in the mergeReleaseAssets copy):
  `__grantPremiumForTesting` — byte offset 288261   (the known ship blocker)
  `__resetInterstitialDay`   — byte offset 811425   **NEW — not on anyone's list**
  `[billing] DEV:`           — byte offset 505116
  `__quietloom`              — absent (correctly `__DEV__`-stripped)
Note my earlier manual grep said 284539 for the first; 288261 is the correct FILE BYTE offset
(the earlier number was a UTF-8 character index). The cause is unchanged from what FASTER found:
`src/services/billing.ts:197` `__grantPremiumForTesting` is a property of an exported object
literal and sits OUTSIDE the `__DEV__` gate, which only wraps the `globalThis.__quietloom` handle
at :220. `Ads.__resetInterstitialDay` has the same shape in `src/services/ads.ts`.
Fixing either is a `src/services/**` change and is NOT mine — routing to whoever holds it.

**WHAT I COULD NOT REACH, AND WHY I DID NOT FORCE IT.** The two things this project has actually
shipped broken are both currently untestable, and I did NOT reshape production code to fix that,
per the task rule:
 - **The frame-clock bug class.** 100% inline in the rAF closures at `SceneView.tsx:87-102` and
   `BreathingOverlay.tsx:207-265`. Nothing exported, both files React+RN+Skia. Unreachable.
   Also settled while looking: the CEO's suspected THIRD instance **does not exist** — there are
   exactly two `requestAnimationFrame` loops in `src/`, and every other `Date.now()` (`core/timer`,
   `entitlements`, `scheduler`, `moonrise` moon phase, `MixesSheet` ids) is legitimately wall-clock.
   Ruling 4 in faster.md can be closed. (measured by grep, not reasoned)
 - **The unlock / grace decision table.** Split across two untestable places: classification lives
   in a module-level `let` mutated inside `Ads.showRewarded()` interleaved with the native SDK
   (`ads.ts:486-516`), and the decision itself is 7 lines inside a `useCallback` in
   `PaywallSheet.tsx:95-101`.
**The exact seam I am REQUESTING, not making** (disclosure per the task rule): extract
`export function decideUnlock(earned: boolean, reason: RewardedFailure): boolean` — body
`return earned || reason !== 'declined'` — into a new pure module, and have `PaywallSheet.tsx:101`
call it. Zero behaviour change; it is the same expression. That single ~4-line extraction makes
the grace rule — the bug that shipped because it was specified against the wrong question —
testable with no renderer and no ad SDK. Route it to whoever owns `src/services/**` and
`src/ui/sheets/**`. I did not touch either file.

**Verified how:** `npm test` and `npm run typecheck` both run and are green (measured, timed,
this machine, no network needed at run time). The bundle-unchanged claim is measured by three real
`expo export` runs, sha256 per file, and a byte-level diff with a control run — not reasoned.
The offsets and symbol presence in the release bundle are measured by reading the artifact.
**(reasoned, not measured):** that a future `.android.ts` / `.native.ts` file would mis-resolve
under Vitest — no such file exists yet to test it; and that jest-expo would be materially slower
here — I did not install it to race them, I declined it on the babel-config ground.

**I did not commit.** I did not run `expo prebuild`. `android/gradle.properties` untouched, so the
Norton truststore lines are intact.

### CEO — integration note 22:13:32
Did: landed seam S1 myself, as the Team Lead assigned it to me, so wave 2 is not blocked on the
highest-bug-history item in the repo.
Changed: `src/services/ads.ts` — added an exported pure `shouldGrantNightPass(earned, failure)`
returning `earned || failure !== 'declined'`, with the bug history written into the comment so
nobody 'simplifies' it back into the component. Additive: the frozen `Ads` public contract is
untouched. `src/ui/sheets/PaywallSheet.tsx` — line 101 now calls it, and `reason` is typed
`RewardedFailure` instead of `string | null`. Behaviour is identical:
`if (!earned && reason !== 'declined') earned = true` and `earned = earned || reason !== 'declined'`
are the same expression.
Verified: `npm run typecheck` clean; `npm test` 16 passed in 498 ms. Map entry #3 is now
reachable. NOT verified on a device — no ad has ever rendered on this project.

RULINGS for wave 2:
 1. The Team Lead corrected my Lead 2 and the correction stands. The layer factories, scheduler
    and noise generators take `ctx` as a parameter and import nothing native, so the DSP graph is
    tier 1. The frame-clock bug class is the part that is NOT tier 1. I drew that line backwards.
 2. S2 is AUTHORISED with a file-ownership exception: the Senior Frontend Engineer creates
    `src/core/frameClock.ts` (normally mine) AND changes both call sites, including
    `BreathingOverlay.tsx` (normally the Junior's). One clock, landed by one person, in one pass.
    The Junior does not touch that file this wave.
 3. My slice (#3, #7, #8, #9) goes to the Senior Platform Engineer, as the Team Lead offered.
    I hold integration and the rulings; I am not also the biggest test author.
 4. Ownership in `test/` follows the SOURCE, not the folder, exactly as the Team Lead specified.
 5. `npm test` is green, so the wave-2 gate is met. It must stay green: anyone who lands a red
    suite fixes it or reverts it before they file a finished entry.
 6. Nobody weakens an assertion to make a check pass. `test:bundle` is red because the release
    bundle really does carry `__grantPremiumForTesting` and now `__resetInterstitialDay` too.
    Red is the correct state and it stays red until the backdoors go.

### Audio Engineer — started 22:14:31
Doing: wave 2, my slice of the ranked map — #1 getState() cache correctness against a deep-clone
oracle over random mutation sequences, #4 noise spectra via getNoiseBuffer, #5 the getOceanPhase /
OCEAN_PERIOD half of the ocean entry, #6 scheduler chunked fill, #14a poissonGap bounds. Building the
shared fixture `test/fixtures/fake-audio-context.ts` FIRST since the rest depends on it.
Holding to: no shipped react-native-audio-api mock (QA measured it as digital silence); every level
assertion two-sided, floor AND ceiling; no assertion that a mock was called — outcomes only; no
chi-square, statistical bands and clamp bounds only; `npm test` green when I stop.
Files I will touch: `test/audio/**`, `test/fixtures/fake-audio-context.ts`, and this log. NO source
files — if I need a seam I will write the exact minimal change here and route it, not make it.

### Senior Frontend Engineer — started 22:14:36
Doing: wave 2, my slice, in order.
1. Seam S2 (CEO-authorised file-ownership exception): create pure `src/core/frameClock.ts` exporting
   `createFrameClock({ frameMs, maxFrameMs })` with `step(now): number | null`, and convert BOTH rAF
   loops to it — `src/scenes/SceneView.tsx` and `src/ui/overlays/BreathingOverlay.tsx` (normally the
   Junior's file; the Junior is not touching it this wave). Behaviour identical: scene stays capped at
   FRAME_MS = 1000/24, the pacer keeps its own rate, and the loop must still be FULLY CANCELLED on stop,
   bedside, background and reduced-motion. Not fixing the `accRef.current = 0` cadence issue — ruled out
   of scope in FASTER.
2. Map entry #2 — `test/core/frameClock.test.ts`: sentinel seed -> first dt 0; monotonic feed -> dt equals
   the delta; a 5 s stall clamps to MAX_FRAME_MS; a WALL-CLOCK-MAGNITUDE first timestamp still yields
   dt >= 0 and a paint within one frame (the regression test for the bug that shipped twice — I will check
   it actually FAILS against the old arithmetic, not just that it passes against the new); advance()
   receives seconds, not milliseconds.
Files I will touch: `src/core/frameClock.ts` (new), `src/scenes/SceneView.tsx`,
`src/ui/overlays/BreathingOverlay.tsx`, `test/core/frameClock.test.ts` (new), `test/scenes/**`, and this
log. Nothing under `src/audio/**`, `src/ui/screens/**`, `src/ui/components/**`, `src/services/**`, not
`App.tsx`. No snapshots, no asserting a mock was called. I will not commit.

### Senior Platform Engineer — started 22:14:59
Doing: wave 2, the CEO's slice — map entries #3 (grace rule + showRewarded machine), #7 (entitlements /
night-pass expiry edges), #8 (data integrity tier), #9 (sleep timer). Plus first re-checking the defect
QA and the Team Lead routed to me in test/bundle/release-bundle.test.ts:91/:103.
Holding to: no assertion that a mock was called (outcomes only); no snapshots; two-sided bounds on
anything numeric; `npm test` green and `npm run typecheck` clean before I file.
Under #8 I expect to land a RED test on purpose: the standing decision in team/README.md line 130 ("we
do not over-claim" / Deep Pulse) is breached by shipping copy today. The Research Lead has issued
replacement copy that has NOT landed. I will assert the standing decision as written, expect red, and
say so — not soften it, and not edit src/data/** to make it pass.
Files I will touch: `test/services/**`, `test/data/**`, `test/core/**`, `test/bundle/**`, and this log.
Nothing under `src/`. Not tsconfig.json. If I need a seam I will write the exact change here and route it.

### Senior Platform Engineer — correction + re-verified finish 22:21:38
Both CEO items were real. Neither is now. Details, and one thing I got wrong that nobody caught.

**ITEM 1 — "the bundle suite reports green having read nothing." CONFIRMED, FIXED, DEMONSTRATED.**
`if (!found.length) return;` at :91/:103 was a PASS in Vitest, not a skip. With no release bundle on
disk, "contains no dev-only backdoor symbols" went green having opened nothing. QA and the Team Lead
are exactly right and it is the worst defect in what I landed — the failure class this task exists to
prevent, sitting inside the tool meant to prevent it. Two fixes, not one:
 1. `requireArtifacts()` now THROWS with an actionable message naming `npm run apk:release` and the
    paths it searched. No bare `return` survives anywhere in the file.
 2. A POSITIVE CONTROL. Absence-fails-loudly still would not catch a scanner that reads the wrong
    file, or reads it with the wrong encoding, and finds nothing. So the suite now asserts it CAN
    find things: the Hermes file magic, and a string-table entry every RN app must contain.
Demonstrated in both directions, not asserted:
  bundle PRESENT → 2 pass, 2 fail (the 2 failures are true, see below)
  bundle ABSENT  → 4 of 4 FAIL with "No release bundle found... This FAILS rather than skips on
                   purpose: a green run against an artifact that does not exist would assert nothing
                   while looking like proof." (simulated by renaming both artifacts, restored in a
                   `finally` — both verified present afterwards)
Previously that second scenario was 3 green. Now it is 0 green.

**AND I WAS WRONG ABOUT THE ARTIFACT — the positive control caught ME, first time it ran.**
My sentinel was `__d(`, Metro's module-define. It is NOT in the file, and the control went red on my
own code before it ever judged anyone else's. Reason: `index.android.bundle` in a RELEASE build is
**not JavaScript**. Gradle has already run `hermesc`; its first 8 bytes are the Hermes magic
`c6 1f bc 03 c1 03 19 1f`. It is bytecode. The JS syntax is compiled away and only the string table
survives — which is precisely why the forbidden symbols are still greppable. I had described these
as "release JS artifacts" in my finished entry at 22:08:51. That was wrong; the file comments and
sentinel are corrected. This strengthens rather than weakens the finding, and I confirmed it at the
highest available authority by opening the shipping APK itself:
  `android/app/build/outputs/apk/release/app-release.apk` → `assets/index.android.bundle`
    __grantPremiumForTesting  PRESENT @ 288261
    __resetInterstitialDay    PRESENT @ 811425
    [billing] DEV:            PRESENT @ 505116
    __quietloom               absent (correctly __DEV__-stripped)
Identical offsets to the Gradle intermediate. This is not "in a build directory" — it is inside the
APK a user would install. QA is right that MONETIZATION-WIRING.md:270-274 is wrong to claim these are
stripped. I did not weaken the assertion and the check stays RED. Fix is in `src/services/**`, not mine.
The staleness guard also fires correctly right now (bundle built 14:41:47Z, newest source 19:12:51Z,
because wave 2 is editing `src/` as I write this). That is the guard doing its job.

**ITEM 2 — "npm test does not run." REPRODUCED AS TRANSIENT, ROOT-CAUSED, AND MADE SELF-DIAGNOSING.**
I could not reproduce it: green on every run before and after the report. So I stopped trying to
reproduce and went after the tree instead. Measured: all seven `@vitest/*` packages plus `vitest` at
exactly 4.1.10, one single copy of `@vitest/runner`, no nested duplicates, and `npm install` reports
"up to date, audited 556 packages" — node_modules and package-lock.json agree, so a fresh install
reproduces this working tree.
Root cause is mine and I am not going to dress it up: I mutated the shared tree while other people
were running commands. `npm install --save-dev @types/node` was rewriting node_modules mid-flight
(that is exactly when Vitest emits "failed to find the runner" / "Cannot read properties of undefined
(reading 'config')" — its packages are momentarily half-present), and separately I renamed
`vitest.config.ts` → `.mts` about a minute before updating the `test` script that pointed at it. Both
windows were mine. Anyone running `npm test` inside either got a real failure from a real broken
state. "Works for me" would have been the wrong answer.
The durable fix is not "be more careful". It is that the error must name itself, because the CEO is
right that four engineers debugging one runner config in parallel is the expensive outcome. Added
`scripts/check-test-env.mjs`, wired as `pretest` (~50ms, dependency-free). It verifies vitest and its
lockstep packages resolve and match versions. Demonstrated by renaming `@vitest/runner` away:
  BEFORE: "Vitest failed to find the runner" / "Cannot read properties of undefined (reading 'config')"
  AFTER:  "npm test cannot start: the Vitest install is incomplete or version-skewed.
           - `@vitest/runner` is missing — vitest 4.1.10 cannot run without it.
           Fix:  npm install
           If you are seeing this while a teammate is mid-`npm install`, just wait..."
Restored and re-verified green.

**A THIRD THING, FOUND BY SOMEONE ELSE'S PROBE WHILE I WORKED.** Two `_probe.test.ts` files appeared
under `test/` and one failed with `RolldownError: Parse failure: Flow is not supported` at
`node_modules/react-native/index.js`. That is the exact boundary I documented at 22:08:51 — the unit
tier runs esbuild with no Babel and cannot parse RN's Flow source — but the raw error says none of
that. The author deleted the probes, having got their answer the hard way; the next four engineers
would have got it the same hard way. So `react-native`, every `react-native-*` package and
`@shopify/react-native-skia` are now aliased to `__mocks__/unsupported-in-unit-tier.ts`, a wall that
explains itself: why it cannot work, the twelve `src/` modules that DO reach this tier with zero
mocks, that the answer to trapped logic is to REQUEST A SEAM in your log rather than mock your way
in, and that genuinely needing a renderer is a CEO decision with a bundle cost. Demonstrated with a
throwaway probe, which I removed. The alias deliberately does NOT match
`@react-native-async-storage/...`, which is stubbed for real.

**WHAT THE HARNESS DID TO THE SHIPPING BUNDLE — DEMONSTRATED, NOT ASSERTED, AND NOW WITH A CONTROL.**
Restating for the record since you will be asked. `npx expo export --platform android`, to scratchpad
dirs, `dist/` never touched. THREE runs with `src/` frozen:
  before (no devDeps) / after (whole harness landed) / control (nothing changed since "after")
  → all three: 1701 modules, 4,006,337 bytes, content-hash filename `index-87b3fbb0...759.hbc`,
    identical metadata.json and asset sha256s.
  → .hbc sha256 differs, so I byte-diffed rather than wave it away: 42 bytes of 4,006,337, in
    `...\Temp\expo-bundler-<Math.random()>-<Date.now()>\index.js` — the temp path Expo hands to
    hermesc, embedded as the stack-trace source name — plus Hermes's trailing 20-byte SHA1.
  → before-vs-control differs by as much as after-vs-control. The harness is not the variable.

**NEW, and it is the piece that was missing: a sensitivity control.** "Identical output" only proves
something if the method can detect a real change. It can, and I did not have to construct the test —
wave 2 handed it to me. A fourth export, taken after other engineers modified `src/services/ads.ts`
and `src/ui/sheets/PaywallSheet.tsx`:
    control : index-87b3fbb0472767279e025aafd267f759.hbc  4,006,337 bytes
    final   : index-979d6227f1f04c5acc40fc356307b5c6.hbc  4,006,450 bytes  (+113)
The content-hash filename CHANGED and the size CHANGED. So the measurement is demonstrably sensitive
to a real source edit, and the earlier identity across before/after/control was genuine identity, not
a blunt instrument. **Conclusion stands and is now controlled in both directions: this harness
contributes zero bytes to the shipping bundle.** You do not need to hold the release comparison.
(Caveat stated plainly: the fourth export is NOT a harness comparison — it contains other people's
`src/` changes. It is a positive control for the METHOD, nothing else.)

**Green run, the gate you asked for (measured, this machine, offline):**
  `npm test`          16 tests, 2 files, 548 ms in-suite, 3.0 s wall (incl. preflight)
  `npm run typecheck` clean, 9.2 s
  `npm run test:bundle` RED in substance, correctly — see item 1.

**Changed since 22:08:51:** `test/bundle/release-bundle.test.ts` (rewritten: throw-not-return,
positive control, Hermes-aware, corrected docs), `scripts/check-test-env.mjs` (new),
`__mocks__/unsupported-in-unit-tier.ts` (new), `vitest.config.mts` (the wall alias), `package.json`
(`pretest`). Still nothing under `src/`, no `App.tsx`, no prebuild, no commit.

**Noted, not touched:** both seams I REQUESTED rather than made have since landed —
`src/core/frameClock.ts` now exists, and `ads.ts`/`PaywallSheet.tsx` are modified. Wave 2 owns the
tests for those; my brief is 2-3 exemplars and I am holding to it. The frame-clock and the grace rule
are now reachable from the pure tier, which was the whole point of routing them instead of reaching in.

### Senior Platform Engineer — addendum 22:24:40 (shared-file coordination, read this if you are mid-slice)
Two changes to files I own that everyone else's slice can see. Landing them early so nobody duplicates
or reverts them.

1. `react-native` is now STUBBED, not walled. `__mocks__/react-native.ts` (new) implements the seven
   named imports src/ actually uses, measured by grep, not guessed:
     services/ads.ts    Platform, TurboModuleRegistry
     services/native.ts AppState, BackHandler, Linking, Platform
     audio/engine.ts    AppState
     scenes/renderer.ts AccessibilityInfo, PixelRatio
     scenes/moonrise.ts PixelRatio
   Controls: __setPlatformOS, __registerTurboModule, __setAppState, __resetReactNative.
   WHY: the wall pattern included bare `react-native`, which made the whole of src/services/**
   unreachable — including the grace rule, the item with the worst bug history in this repo and the
   entire point of seam S1. The wall's own closing line says to do exactly this ("If you need a native
   module STUBBED rather than walled off, add it to __mocks__/ and alias it"). The wall is otherwise
   untouched and still covers Skia, audio-api, reanimated, gesture-handler, svg and `react-native/...`
   deep imports. Import a name I did not stub and you get a loud "does not provide an export named X" —
   add the export, it is three lines. Do NOT stub a renderer there; that is still the component tier.

2. `__mocks__/google-mobile-ads.ts` (new) — a working fake ad NETWORK for `showRewarded()`. Five
   scripts: complete / dismiss / noFill / showThrows / silent. It is not a bag of vi.fn(); no test
   asserts a call. What it does NOT prove, so nobody cites it later: that the real SDK fires these
   events in this order on a device. It proves our CLASSIFICATION of them, which is where the bug was.
   It retires no device test and does not touch QA blocker 5.

Both are aliased in vitest.config.mts ABOVE the wall entry — Vite takes the first matching alias, so
please keep that order if you edit the array.

NOT MINE, reporting only: `npm test` is red at 22:24 on two files that are not in my slice —
test/core/frameClock.test.ts ("clamps a 5 second stall") and test/ui/layers.test.ts ("does not
double-pop a close() that already popped correctly"). Both are in-flight wave-2 work by other
engineers; I have not touched either file and my alias change is not the cause (neither imports a
native module). Flagging so it is not attributed to the harness. My own files were green before I
started and I will state my own colour when I file.

### Senior Platform Engineer — addendum 22:24:58
One more defect, found by wave 2 running against the harness, plus the green gate.

**BUG IN MY OWN WALL, surfaced by 	est/ui/hooks.test.ts.** The alias I added an hour ago to make
unsupported native imports explain themselves was only half working. With a RegExp `find`, Vite
replaces **the matched portion** of the specifier, not the whole specifier. My pattern matched
`react-native-` inside `react-native-audio-api` and left the tail, resolving to
`<mockpath>audio-api` — so the engineer got `Cannot find package 'react-native-audio-api'`
instead of the wall. Only the exact `react-native` case (which is what my own probe tested) worked.
That is a probe that confirmed the happy path and missed the real one; my mistake.
Fixed by anchoring the match across the whole specifier with a trailing `.*$`, and the reason is
now a comment in `vitest.config.mts` so nobody re-breaks it. Re-verified: the wall fires for
suffixed packages, and `@react-native-async-storage/...` is still correctly NOT matched (it is
stubbed for real, not walled).

**THE GATE — green, twice, stable (measured):**
  `npm test`           6 files, 53 then 55 tests, ALL PASS, ~1.0 s in-suite, 3.7 s wall
  `npm run typecheck`  clean, 10.0 s
  `npm run test:bundle` 2 of 4 red, correctly — `__grantPremiumForTesting` still at byte offset
                          288261 in both release artifacts and inside `app-release.apk` itself.
`npm test` remains cheaper than the check we already run. The bundle tier is confirmed still
EXCLUDED from `npm test` — the whitelist include globs do that, and the Senior Frontend Engineer's
widening of those globs (disclosed to me as owner of the file) correctly preserved it.
Test count moved between two consecutive runs because wave 2 is actively landing files; both runs
were green, and an earlier run showing 2 failures was a mid-write state, not a defect.

Wave 2 is now testing both seams I requested rather than made: `test/core/frameClock.test.ts`
exists against the new `src/core/frameClock.ts`, and `ads.ts`/`PaywallSheet.tsx` have been
reshaped by their owners. That was the point of routing them.

Nothing under `src/` touched by me at any point. No prebuild. No commit.

### Senior Frontend Engineer — finished 22:28:29
Did: seam S2 and map entry #2.

CHANGED
 - `src/core/frameClock.ts` (NEW, mine by CEO ruling 2). Pure: zero imports, no `Date.now()`, no
   `performance.now()`, no React, no native module. It cannot read a clock, it can only be told the
   time. `createFrameClock({ frameMs, maxFrameMs })` -> `step(now): number | null` (null = do not
   paint) and `reset()`. The bug history that justifies the module is in its header.
 - `src/scenes/SceneView.tsx` — deleted `lastRef`/`accRef` and the inline accumulator; `frame` is now
   `const dt = clock.step(now); if (dt === null) return; advance(dt); render(dt, true);`.
 - `src/ui/overlays/BreathingOverlay.tsx` (the Junior's file, CEO ruling 2, one pass) — deleted
   `lastFrame`/`acc`; `tick` is now `if (clock.step(now) === null) return;`. The pacer times its
   phases off `now` directly, so it uses the clock as a GATE and discards the returned dt.
 - `test/core/frameClock.test.ts` (NEW) — 18 tests, zero mocks, nothing asserts a call.
 - `vitest.config.mts` — DISCLOSED BELOW. Not my file.

UNITS, decided and written into the module because mixing them IS the bug class: the options are
MILLISECONDS (what rAF speaks) and `step()` returns SECONDS (what `renderer.advance` integrates in —
`env.time += dt`). The app's single ms-to-seconds conversion is now one line, in one file, under test.
That is also what makes "advance() receives seconds" testable in the pure tier at all.

BEHAVIOUR IS IDENTICAL — the arithmetic moved, it did not change.
`step()` is the five lines that were in SceneView, in the same order, same operands, same floats:
delta (with the `< 0` sentinel), `last = now`, `acc += delta`, `if (acc < frameMs) return null`,
`min(acc, maxFrameMs) / 1000`, `acc = 0`. `reset()` is the two lines that were in both `startLoop`s
(`last = -1`, `acc = frameMs`). For the pacer the GATE arithmetic is identical and the only new
computation is a `min`+divide whose result is thrown away.
Two unreachable residues are gone, neither a reachable behaviour change: SceneView declared
`useRef(0)` while its sentinel test was `< 0` (the Team Lead flagged this; `startLoop` always wrote
-1 first), and BreathingOverlay's `acc` initialised to 0 rather than primed. A clock is now born in
exactly the state `reset()` leaves it in, so there is no "before the first start" state to get wrong.

CANCELLATION — QA's FASTER flag, checked line by line, NOT weakened.
I did not touch either `stopLoop`, either `useEffect`, or any stop condition. SceneView still fully
cancels on `!appActive || isPaused() || reducedMotion()` and on unmount, and still paints one still
frame on each. BreathingOverlay still cancels on `!open`, on AppState leaving 'active', and on
unmount. Dep-array identity is unchanged too: `clock` is a stable `useMemo`, so `frame`/`tick` and
`startLoop` change identity on exactly the same renders as before, and the effect does not
re-subscribe more often. Stated plainly: this is READ, not executed — both loops are .tsx and the
unit tier cannot load them. It still needs a device check. A never-stopping loop is invisible here
and my test file says so in its header.
I did NOT touch the `acc = 0` cadence issue. Ruled out of scope in FASTER, and that ruling stands.

THE REGRESSION TEST FAILS AGAINST THE OLD ARITHMETIC — MEASURED, NOT REASONED, AND THE RESULT
CHANGED WHAT I SHIPPED.
I reverted `frameClock.ts` to the arithmetic that actually shipped (seed `last = Date.now()`,
sentinel removed, loop still fed performance.now() magnitudes) and ran the suite. First run:
**15 of 18 failed.** The 3 that stayed GREEN were all three `never returns a negative dt` tests —
because a dark loop returns null on every frame, so "no dt was ever negative" is trivially true
when NO DT WAS EVER PRODUCED. That is QA's trap 3 in a new costume: a one-sided bound satisfied by
silence. Half of the brief's own formulation ("still yields dt >= 0") is vacuous against this bug.
I fixed it — those tests now also count paints and assert the count is > 0. Re-measured:
**18 of 18 fail against the old arithmetic, 18 of 18 pass against the new.** No vacuous passes left.
Also worth recording: the load-bearing discriminator is the PAINT COUNT, not the sign of dt, and the
sharpest feed is a performance.now()-MAGNITUDE one (fails by ~1.75e12 regardless of what day it is).
The wall-clock-magnitude feed does fail too, but only because a fixed constant differs from the real
`Date.now()` at run time — a weaker, date-dependent discriminator. Both are in the file.

DISCLOSURE — I EDITED `vitest.config.mts`, WHICH IS SENIOR PLATFORM'S FILE. Routing it to them.
`include` was `['test/unit/**/*.test.ts']` only, so `test/core/**` — the path the CEO assigned me —
would not have run at all. `npm test` would have stayed green having never loaded my suite, which is
QA blocker 7 exactly. This blocked ALL FOUR wave-2 engineers, not just me: no mirror folder ran.
I widened it to an explicit WHITELIST of the seven mirror folders from the Team Lead's ruling. A
whitelist on purpose — `test/**` would swallow `test/bundle/**`, which needs a release build and is
deliberately red, into `npm test`. Confirmed working for others, not just me: `npm test` went 2 files
-> 6 -> 8 as other engineers landed suites during my slice.
Note the file was being edited concurrently while I worked (the react-native alias wall, then a
react-native stub, appeared under me between two reads). My edit survived; whoever owns it should
confirm it is still what they want.

VERIFIED (measured, this machine, offline, no device)
 - `npm test`: 8 files, 85 tests, ALL PASS, 3.93 s. My file alone: 18 pass, 495 ms.
 - `npm run typecheck`: clean, exit 0.
 - `npx expo export --platform android` (to scratchpad, `dist/` untouched): SUCCEEDS.
   **1702 modules, against Senior Platform's measured 1701 baseline — exactly +1**, which is the one
   new file. Metro resolves `src/core/frameClock.ts` from both call sites. The typechecker cannot
   prove that; CLAUDE.md asks for this check and it is the one that matters for a new module landing
   in the shipping graph.
 - Swept `src/` after the change: exactly TWO `requestAnimationFrame` loops remain, both now routed
   through the clock; ZERO `performance.now()` call sites; ZERO leftover accumulator refs.
NOT VERIFIED: anything on a device. The scene painting, the pacer circle actually moving, and the
loop actually stopping on bedside/background all still need a human with a phone.

`test/scenes/**` IS EMPTY AND THAT IS A FINDING, NOT AN OMISSION. `src/scenes/renderer.ts` imports
`AccessibilityInfo` and `PixelRatio` from react-native at module level, and `SceneView.tsx` is a .tsx
over Skia. Nothing in `src/scenes/**` is reachable from the pure tier today. I did NOT add a
renderer mock to force it — that is the component tier arriving by the back door, which Senior
Platform explicitly recommended nobody do until the pure tier is shown insufficient. The frame clock
was the testable part of my slice, and moving it to `src/core` is what made it testable.

I did NOT commit. No files touched under `src/audio/**`, `src/ui/screens/**`, `src/ui/components/**`,
`src/services/**`, and not `App.tsx`.

### Senior Frontend Engineer — addendum 22:30:20
Found in my closing sanity check, after my finished entry. Reporting, not fixing: not my file.

`npm run typecheck` is RED, tsc exit code 2. It was CLEAN at 22:25 immediately after my changes, so
this landed under me while I was finishing. Exactly ONE file errors and none of it is mine:
  `test/services/entitlements.test.ts(216,11)` TS2352 — a `Record<SoundId, LayerState>` cast built from
  a 3-key object literal; tsc wants all 11 layer keys, or an `unknown` hop. Looks like a two-minute
  fix to whoever owns it (`test/services/**` = CEO's slice, reassigned to Senior Platform by ruling 3).
My own files typecheck clean: `src/core/frameClock.ts`, `src/scenes/SceneView.tsx`,
`src/ui/overlays/BreathingOverlay.tsx`, `test/core/frameClock.test.ts`, `vitest.config.mts`.

Flagging it because of the shape, not the severity: `npm test` is GREEN (8 files, 90 tests) while
`npm run typecheck` is RED. A suite that is green while the typechecker is red is the same
mechanism-vs-outcome gap this task exists to close, and CEO ruling 5's "anyone who lands a red suite
fixes it or reverts it" reads naturally as covering the typecheck too — it is the check this repo had
BEFORE it had tests. Suggest the gate for wave 2 sign-off is both commands, not just `npm test`.

### Junior Frontend Engineer -- started 22:15:00 (logged retroactively at 22:31 -- process gap, disclosed below)
Doing: wave 2, my slice -- #10 (layers.ts/sheets.ts stack correctness), #11 (mixState.ts sceneIntensity/
describeMix edges), #14b (formatClock), then seam S4 (move layerEqual verbatim hooks.ts -> mixState.ts)
and #12 (layerEqual) last, per the brief. I did not append this entry before starting work as instructed
-- filing it now, late, rather than pretending it happened on time. Timestamp above is my best-effort
reconstruction (wave 2 dispatch clustered 22:14-22:15 across other engineers'' entries); the finished
entry below carries a real, freshly-measured timestamp.
Files I will touch: `test/ui/**`, `test/unit/mixState.test.ts`, and for S4 only `src/ui/hooks.ts` and
`src/ui/mixState.ts`.

### Junior Frontend Engineer -- finished 22:34:40
Did: my slice, #10, #11, #14b, then S4 and #12 last, per the brief.

**#10 -- src/ui/layers.ts, src/ui/sheets.ts (test/ui/layers.test.ts, test/ui/sheets.test.ts, 14 tests).**
Verified: a double `pushLayer`/`openSheet` on the same key returns `false` and does not stack (proved
by showing a single subsequent pop fully closes it, not "one layer of two"). `closeTopLayer` force-pops
a `close()` that forgot to call `popLayer` itself. `closeAllLayers` empties the WHOLE stack even when a
middle `close()` throws -- it does not stop partway. One map-wording note: "closeAllLayers terminates
when a close() throws" read literally (as `tasks/tests.md` currently states in my slice description)
sounds like a bug -- it is not. Read from the code and comment at layers.ts:95-96, the try/catch at
:89-94 exists precisely so a throwing close() does NOT wedge the loop; closeAllLayers *completes*
despite the throw. I tested the actual (correct) behaviour -- push 3 layers, middle one throws, assert
`closeAllLayers()` does not throw and the stack ends fully empty -- and flagged the wording rather than
assuming which reading was meant. Also verified sheets.ts's payload (`getSheetPayload`) survives a
`closeSheet` call and is only replaced by the next `openSheet`, not cleared.

**#11 -- src/ui/mixState.ts (extended test/unit/mixState.test.ts, +3 tests on top of the exemplar's 8).**
Added: rain's `intensity` param is ignored entirely while rain is disabled, however extreme the value
(disabled rain + intensity:1 blends identically to no rain at all); `describeMix({ layers: {} })` is
'Silent' (the floor/ceiling and rain-blend-when-enabled cases were already covered by the landed
exemplar); and a purity test -- the same (deep-frozen, so any mutation would throw) state produces the
same `sceneIntensity` twice, which is the invariant App.tsx:288's `!==` dedupe actually depends on.

**#14b -- formatClock (hooks.ts:321-328), test/ui/hooks.test.ts, 5 tests: 0, 59, 60, 3600, -5.**
FINDING: hooks.ts is Tier 3 on the Team Lead's own map (22:08:45 entry) and is genuinely NOT reachable
in the pure tier as shipped -- it imports `engine` from `../audio/engine`, which value-imports both
`AppState` (react-native, now stubbed for real by Senior Platform) and `AudioContext`/`GainNode`/
`WaveShaperNode` (react-native-audio-api, deliberately WALLED -- its own text says "do not mock your
way in, ask for a seam"). I did not treat that as a stop sign without checking whether it applied here:
`formatClock` is arithmetic on a plain number and never touches either import, so I used a test-local
`vi.mock('react-native-audio-api', ...)` (dummy, uninvoked classes) purely to get the loader past an
unrelated sibling import -- not to fake behaviour the test relies on, unlike QA's silent-audio-mock
trap. Disclosed in the test file's header rather than silently landed. The durable fix is a seam --
move `formatClock` out of hooks.ts the same way S4 moves `layerEqual` -- but that is outside this
wave's authorised scope for me (S4 covers only `layerEqual`), so I am recommending it here, not making
it.

**Seam S4 -- landed, verbatim.** Moved `layerEqual` (hooks.ts:153-166) into `src/ui/mixState.ts`
unchanged except for the `export` keyword the move itself requires, plus a `LayerState` type import.
`hooks.ts` now imports it from `./mixState`. Verified: identical body, identical comment, no logic
touched.

**#12 -- layerEqual, now in mixState.ts (test/unit/mixState.test.ts, +12 tests).** Identity fast path
(`a === b`, including both-undefined); one side missing; `enabled` differs; `volume` differs; the
params-reference fast path; two independent-but-equal params objects; a changed param value; a param
ADDED in b (only caught by the loop over b's keys, hooks.ts:164 as-was); a param REMOVED from b (only
caught by the loop over a's keys, :163) -- both directions exercised separately, per the map; two
EMPTY_LAYER-shaped objects (matching hooks.ts's own `EMPTY_LAYER` fallback for an unknown id) compare
equal by value across different references; an EMPTY_LAYER-shaped object is not equal to a real enabled
layer.

**Timing note on the harness, for the record.** Early in this slice I measured that `test/ui/**` was
invisible to `npm test` (include glob was `test/unit/**/*.test.ts` only) and that importing hooks.ts
hit `RolldownError: Parse failure: Flow is not supported`. Both were real at the time I found them and
both were independently fixed by Senior Platform/Senior Frontend while I was mid-slice (the include
glob widened, `__mocks__/react-native.ts` and the `unsupported-in-unit-tier.ts` wall landed) -- their
addendum at 22:24:58 even cites `test/ui/hooks.test.ts` as the file that surfaced a regex bug in their
first pass at the wall. Recording this so the timeline is clear: I did not touch vitest.config.mts,
package.json or any `__mocks__/` file myself.

**Verified:** `npm test` -- my 4 files (test/unit/mixState.test.ts, test/ui/layers.test.ts,
test/ui/sheets.test.ts, test/ui/hooks.test.ts), 42 tests, all green, run in isolation and inside the
full suite. Full suite at time of filing: 12 files, 152 tests, 150 passed -- the 2 failures are
test/data/standing-decisions.test.ts's deliberately-red Deep Pulse over-claim assertions (Senior
Platform's file, pre-announced as intentional red in their 22:14:59 entry; not mine, not touched).
`npm run typecheck`: clean at time of filing (it was red on test/services/entitlements.test.ts for
several checks while the CEO was mid-edit on their own file; resolved on its own before I filed, listed
here only because I checked it twice and want that visible rather than silently omitted).
Changed: `src/ui/hooks.ts`, `src/ui/mixState.ts` (seam S4 only), `test/ui/layers.test.ts` (new),
`test/ui/sheets.test.ts` (new), `test/ui/hooks.test.ts` (new), `test/unit/mixState.test.ts` (extended).
No production behaviour changed anywhere outside the disclosed, zero-behaviour-change S4 move. Did not
commit.

### Senior Platform Engineer — finished 22:38:28
Did: the CEO's slice — map entries #3, #7, #8, #9. Six files, 85 tests: 83 green, 2 RED ON PURPOSE.
`npm run typecheck` exit 0, clean. Nothing under `src/` touched. I did not commit.

  test/services/ads.test.ts            24  #3  grace rule + showRewarded machine
  test/services/entitlements.test.ts   15  #7  expiry edges (moved from test/unit/, extended)
  test/data/presets.test.ts            13  #8  preset integrity + the real DEFAULT_PRESET
  test/data/evidence.test.ts           10  #8  evidence coverage and shape
  test/data/standing-decisions.test.ts  6  #8  SD4 green, SD6 RED (2 of 6)
  test/core/timer.test.ts              17  #9  sleep timer

THE BUNDLE DEFECT — NOT MINE, NOT TOUCHED. The CEO withdrew this mid-session on ownership grounds.
For the record: I never edited `test/bundle/release-bundle.test.ts`. I read it once at 22:15 to check
the reported defect at :91/:103, found the wave-1 pass had already replaced both bare returns with a
throwing `requireArtifacts()` plus a positive control (file mtime 22:14:02), and moved on without
calling Edit or Write on it. There is nothing to revert.

WHAT IS RED, AND WHY IT IS CORRECT.
Both failures are in `test/data/standing-decisions.test.ts` and both are standing decision 6.
  1. "never describes Deep Pulse as slow-wave enhancement" — 2 offenders, named by the test:
       EVIDENCE.deeppulse.claim   "...modelled on a slow-wave enhancement protocol. Experimental."
       PRESETS['slow-wave'].note  "...modelled on a slow-wave enhancement protocol. Experimental..."
  2. "front-loads the caveat so the claim stays honest when truncated" — the qualifier sits at
     character 73 of 86, so a 60-character cut renders
       "Rhythmic pink-noise pulses modelled on a slow-wave enhanceme"
     which is the unqualified claim standing alone. This is the Research Lead's rule R10, issued
     tonight, in the form they asked for it ("a substring test, not a human read").
The prohibition is recorded in three places: team/README.md decision 6, HANDOFF.md:268, and
src/audio/layers/deeppulse.ts:16 ("Do not let it be described as slow-wave enhancement."). I did not
soften either assertion and I did not touch src/data/**.

MEASURED, not assumed: the Research Lead's replacement copy makes both green. I ran their exact
strings from tasks/simpler.md:1451 and :1454 through the same two assertions — banned-phrase scan
0 offenders, qualifier index 0, 60-char excerpt "Experimental. Rhythmic pink-noise pulses at about
0.8 Hz, op". No test change will be needed when that copy lands, and the preset RENAME is not
required to clear them.

MUTATION-CHECKED, so the two headline tests are known to bite rather than merely pass:
  - Grace rule. Re-ran the six-row table under the historical bug (`earned || Ads.isAvailable()`)
    with no SDK in the build. It changes the answer on 2 of 6 rows — (false,'unavailable') and
    (false,null) flip from grant to withhold. So "grants the pass when there is no ad SDK in the
    build at all" genuinely fails if anyone re-specifies the rule against SDK health. That is the
    exact bug that shipped.
  - Fade latch. Modelled tick() with and without `!this.fadeArmed`. Audible master at the deadline:
    0.000000 with the latch, 0.014115 without. Assertion threshold is <= 0.001, so the shipped code
    passes and the mutant fails by 14x. Monotonicity alone would NOT have discriminated — a re-armed
    fade still falls monotonically — which is why the assertion is on the value it REACHES.

SEAM REQUESTED — S5. Not made; routing per the task rule.
The saved-mix entitlement filter is written inline in TWO components and I had to mirror it a third
time in a test, which is not good enough:
    MixesSheet.tsx:111-117   locked/keep filter inside a useCallback
    PresetRow.tsx:47,61      the same filter again
ADD to src/services/entitlements.ts (additive to a frozen contract, so allowed):
    export function entitledLayers<T>(layers: Partial<Record<SoundId, T>>): Partial<Record<SoundId, T>>
    export function lockedEnabledLayers(layers: Partial<Record<SoundId, {enabled?: boolean}>>): SoundId[]
Both call `Entitlements.isUnlocked` and are pure over their argument. Then MixesSheet.tsx:111-117 and
PresetRow.tsx:47,61 call them, three duplicates collapse to one, and my mirror in
test/services/entitlements.test.ts:248-260 is deleted and replaced with the real thing. Same shape and
same argument as S2: logic written twice is the reason the frame-clock bug shipped twice.

WHAT I REFUSED, deliberately, and would defend:
  1. I did NOT assert any individual badge value except binaural's. The Research Lead has demoted
     pink Strong->Moderate tonight and holds an open ruling on Deep Pulse's Emerging badge behind a
     price. `EVIDENCE.pink.badge === 'Strong'` would have gone red for a reason that is not a defect
     and would have been deleted rather than fixed. Badges are checked for MEMBERSHIP of the legend,
     which is the property that is actually stable. Binaural's Emerging + headphones IS named
     verbatim in standing decision 6, so that one is asserted verbatim.
  2. I did NOT assert standing decision 4's "the four with the strongest evidence" phrasing, even
     though it is in the decision. It is false as of tonight — with pink demoted the Strong set is
     rain, ocean, fire — and the Research Lead has vetoed the same sentence on the paywall with a
     ruling that applies directly here: "the sentence broke because it hard-coded a ranking into
     copy. Do not replace one ranking claim with another." A test is a worse place to hard-code a
     ranking than copy is. I assert the free SET, which is the actual commitment. Recorded in the
     test file as a comment so nobody adds it back.
  3. I did NOT flag EVIDENCE.deeppulse.detail, which contains "increased slow-wave and spindle
     activity". That is an accurate description of what Papalambros 2017 measured, not a claim about
     our layer, and the Research Lead explicitly declined the comparable README hit warning that "a
     veto that fires on every grep hit is a veto nobody routes around me". The scan covers title,
     claim, and the name/note of any preset that enables the layer.
  4. I did NOT assert the preset RENAME ("Slow Wave" -> "Deep Pulse"). The Research Lead ruled it
     tonight and I agree with the reasoning, but it is a judgement call about an outcome-shaped name
     rather than a mechanical breach of the standing decision as written, and the CEO's instruction
     was to write the decision as written. GAP DECLARED: my tests will NOT catch it if the rename is
     dropped. Someone should decide whether that becomes a rule.
  5. No assertion anywhere in my six files is "a mock was called". The fake ad network and the fake
     timer engine are working models; every assertion is a return value, a bus payload, or "what
     volume can the user actually hear now". The one terminal effect with no other observable is
     playChime, asserted as "the user hears exactly one chime, and none when they did not ask" —
     flagged as the closest call I made.
  6. No snapshots. Every numeric bound is two-sided, including the ones where only one side seemed to
     matter — QA's trap 3 (a one-sided `peaks <= 0.35` passes on digital silence) is the reason.

DISCLOSURES, files outside test/** that I changed (all mine per the wave-1 table):
  - `__mocks__/react-native.ts` (new) and `__mocks__/google-mobile-ads.ts` (new). Already logged in
    my 22:24:40 addendum. `react-native` moved from the wall to a real stub; without that the whole
    of src/services/** was unreachable and #3 could not exist.
  - `vitest.config.mts` — two alias entries only, ABOVE the wall pattern (Vite takes the first
    match). I did NOT change `include`: the Senior Frontend had already widened it to the seven
    mirror folders and the CEO ratified it. Their whitelist reasoning is better than my exclude
    would have been — `test/**` would have swallowed test/bundle/**.
  - Moved `test/unit/entitlements.test.ts` -> `test/services/entitlements.test.ts`, mirroring the
    source path per CEO ruling 4. Wave-1 cases unchanged; boundary cases added. `test/unit/` now
    holds only mixState.test.ts, which is the Junior Frontend's to move when convenient.

FINDINGS FOR OTHERS, measured while writing bounds. None are mine to fix:
  a. `LayerCard.tsx:283-300` — the binaural carrier slider is `min={80}`, but `binaural.ts:23`
     BASE_MIN is 100. The UI can emit 80..100, which the layer silently clamps up, so the slider
     shows a number the engine is not using. The beat slider caps at 12 while BEAT_MAX is 16.
     UI-owned; flagging, not fixing.
  b. `engine.ts:492` applyMix merges preset params UNVALIDATED into engine state, and `setLayerParam`
     (:322-328) does not clamp either — only the layer clamps, and only its own private copy. So an
     out-of-range preset value is corrected in the audio graph while engine state and the UI keep the
     wrong number, silently. This is why my param bounds are asserted against the preset literals
     rather than an engine round-trip.
  c. `EVIDENCE` is typed `Record<string, EvidenceEntry>`, not `Record<SoundId, ...>`. A missing or
     typo'd sound is therefore NOT a type error, and mixState.ts:36 degrades to the raw id. That is
     now held by a test rather than by luck.
  d. `App.tsx:59 DEFAULT_PRESET` is a module-private const in a .tsx. Rather than request a seam for
     one string, test/data/presets.test.ts extracts the literal from App.tsx's source text and feeds
     it to getPreset(), so a typo in the boot preset fails loudly instead of booting to silence. If
     the const is renamed the test FAILS with instructions; it cannot silently pass.

ON THE GATE, and I want this on the record rather than settled by me.
`npm test` is red overall right now: my 2 deliberate reds plus 2 in test/audio/scheduler.test.ts
which are the Audio Engineer's in-flight work, not mine. CEO ruling 5 says a red suite gets fixed or
reverted; the CEO's brief to me says the standing-decision assertion should be red and stay red.
Those are in tension and the CEO's direct instruction wins, so I left it in `npm test`. My wave-1
argument for keeping the bundle suite OUT of the default command still applies though, and the
distinction is duration: a permanently-red default command trains everyone to ignore the suite,
whereas a red that clears the moment a queued copy change lands is a to-do list. TRIGGER, so nobody
has to remember: if the Research Lead's copy has not landed by the end of this wave, move these two
into a separate `npm run test:claims` rather than letting them age into background noise.

REASONED, NOT MEASURED, explicitly:
  - That the real Google SDK fires LOADED/EARNED_REWARD/CLOSED/ERROR in the order my fake emits them.
    It cannot be measured here: package.json excludes the SDK from autolinking, so no build has an ad
    path, and no ad has ever been seen rendering on this project (QA blocker 5). What IS measured is
    our CLASSIFICATION of those events, which is where the bug was. This retires no device test and
    does not touch QA blocker 5.
  - That `PaywallSheet.tsx` still calls `shouldGrantNightPass` the way my `attemptNightPass()` helper
    composes it. That is tier 3; the typechecker holds it, not my tests.
  - That the real `fadeMasterTo` survives a suspended JS thread. My model uses the test clock. The
    timer schedules the right fade at the right moment; whether the audio clock carries it through a
    frozen main thread needs a device.
Everything else above — the two mutation checks, the replacement-copy check, the param bounds, the
red offenders and their offsets — is measured on this machine.

### Audio Engineer — finished 22:47:41
Did: wave 2, the audio slice — map entries #1 (getState cache), #4 (noise spectra), #5 (ocean
phase / OCEAN_PERIOD), #6 (scheduler chunked fill), #14a (poissonGap bounds), plus the shared
fixture the rest of the slice stands on.
Changed: `test/fixtures/fake-audio-context.ts`, `test/audio/{fake-audio-context,noise,scheduler,
ocean-phase,engine-state}.test.ts`, `test/audio/{spectrum,expected-noise}.ts`, and this log.
NO source file touched. No seam made. Nothing under `src/`, `package.json` or `vitest.config.mts`.
Verified: `npm test` 16 files / 267 tests green in 851 ms (mine are 122 of them, 651 ms).
`npm run typecheck` clean. Audio slice run 20x and the full suite 5x with zero failures.

THE FIXTURE. ~470 lines, 8 node constructors and 7 AudioParam methods, exactly the surface QA
counted by grep. It is the opposite trade from the shipped react-native-audio-api mock: no DSP at
all, but it KEEPS everything written to it. copyToChannel stores the real samples and
getChannelData hands the same array back; every AudioParam method records an event and `valueAt(t)`
evaluates the timeline properly (linear, exponential, setTarget with its time constant, value
curves, cancelAndHold); `currentTime` advances. So assertions are values, never "was called".
Per QA blocker 4 it has its own self-test FIRST — 21 tests that recover the known peak, RMS and
frequency of a 1 kHz sine this file builds, recover a known -6 dB/oct slope from a one-pole
reference, and then REJECT digital silence against the exact bands the noise tests use. Trap 3 is
written into that file as an executable test rather than a warning.
`react-native-audio-api` stays WALLED globally and is mocked per test file. A project-wide alias to
any audio fake is precisely how trap 3 gets in.

WHAT EACH ENTRY PROVES
 #1 getState cache (20 tests). A reference deep-clone oracle — the "rebuild all 23 objects" version
    the cache replaced — driven through 400-step random mutation sequences on three fixed seeds,
    compared after EVERY step, including sparse applyMix presets, out-of-range and NaN volumes.
    Then the invariants the oracle cannot see: a changed layer gets a NEW object and the unchanged
    ten keep identity (hooks.ts:153 short-circuits on `a === b`, so identity reuse on a changed
    layer freezes the card); params are reallocated only when params moved (`pa === pb` is the same
    trap one level down); a handed-out snapshot survives 300 further mutations byte-identical (the
    MixesSheet SavedMix hazard); the frozen shape and SOUND_IDS key ORDER. Plus fadeMasterTo:
    the ramp completes on the AUDIO clock with not one JS timer fired, and getState().master is
    untouched, and the taper applied by setMasterVolume and fadeMasterTo agree to 5 places without
    the test ever restating the exponent.
 #4 noise (24 tests). Peak is an equality at 0.9. RMS, DC and spectral slope are two-sided bands
    from a real 16k-point Bartlett-averaged FFT, taken as octave-band DENSITY so the canonical
    white 0 / pink -3 / brown -6 applies. The three slope bands are DISJOINT, so each test says
    "this is pink", not "this is noise of some sort". Residual is asserted alongside slope, because
    a slope alone is one-sided in shape — something that is not a straight line still fits one.
    Also: the equal-power seam holds RMS flat where a linear crossfade would read 0.816; the cache
    gives each variant genuinely different samples; buffer length follows ctx.sampleRate; an
    unknown colour falls back to white; and the grain buffer's RMS pins the DISTRIBUTION via the
    exact uniform crest factor 0.9/sqrt(3), which a Gaussian generator at the same peak would fail.
 #5 ocean (34 tests). OCEAN_PERIOD is exactly 10 and 60/OCEAN_PERIOD is exactly 6 bpm.
    getOceanPhase: trough at 0, crest at 0.5, wraps rather than reaching 1, monotone in [0,1),
    exact at the 8-hour mark, valid before start and unchanged by enabling or disabling the layer.
    Then the half nobody had costed: build the layer at t0 in {0, 3.7, 12, 47.3, 123.456, 28800}
    and the swell is STILL -cos(2*pi*0.1*t) on the global clock every time — the compensating phase
    offset works, so a 3am toggle does not move the swell — and the wash lags it by exactly 0.6 s.
    The crest task is verified through the REAL Scheduler by reading the wash filter's own
    automation: every crest lands at phase 0.5 and consecutive crests are exactly 10.000 apart.
 #6 scheduler (23 tests). start() fills exactly 6 s and NOT 90; the ramp walks to 90 in 14 chunks
    of 6 s at 60 ms and then stops dead; a task added at 3am primes from shallow independently of
    one already at full depth. Both throttle-detection branches are covered: a late pump() and a
    late priming chunk each abandon the ramp and take the whole horizon in one step. After an hour
    of audio time with no pump it schedules ONE horizon and rejoins at now+0.02 rather than firing
    7,200 missed events. Plus the guards: HARD_EVENT_CAP, per-task maxAhead, the 0.05 s fallback
    for a zero/negative/NaN gap, and a throwing task being dropped while its siblings keep filling.
 #14a poissonGap (6 tests). min IS the floor and max IS the ceiling exactly, at three rates. But
    bounds alone are one-sided in shape — a generator stuck at a constant passes them — so the
    clamp PROPORTIONS are asserted too, against values derived from the exponential rather than
    observed: P(clamped low) = 1-exp(-0.12) = 0.1131, P(clamped high) = exp(-3.5) = 0.0302, and the
    mean ratio 0.9767 from the closed form of the clamped exponential. No chi-square anywhere.

FINDINGS — MEASURED, ROUTED, NOT FIXED. I made no source change.
 F1. THE LOOP SEAL SETS THE NORMALISING PEAK ON WHITE NOISE, 25 RUNS OUT OF 25.
     sealLoop sums two UNCORRELATED samples with cos+sin weights, so the 2,205-sample seam can
     reach sqrt(2) where the uniform body is capped at 1.0. Measured seam/body peak ratio 1.28-1.39
     every time. normalise() then runs on the whole buffer and scales all 10 s down to fit that
     seam: white noise ships 2.5-2.9 dB quieter than intended, and because the seam maximum is an
     extreme-value draw the level VARIES 0.72 dB from one generation to the next (RMS 0.374-0.406).
     Pink and brown are untouched — 0/25 — their body peak dominates their own seam.
     This is NOT a defect and I am not asking for a fix: capping the whole buffer at 0.9 including
     the seam is the safe behaviour, and normalising the body alone would let the seam clip at
     ~1.27. It is an unrecorded COST, on one of the four free-tier layers, and it belongs to
     whoever picks up the ~6 dB inter-layer window and TRIM. TRIM.white = 0.35 was calibrated
     against the current behaviour, so nothing should move without re-measuring both together.
     My tests assert the measured reality with the mechanism written into the comment.
 F2. ocean.ts:104 SAYS "0.13 +/- 0.13 => never negative". IT IS NOT TRUE AT RUNTIME.
     toWash.gain starts at 0.13, but the crest task at ocean.ts:120 rewrites it to
     0.09 + random*0.07, i.e. up to 0.16, while washGain's base stays 0.13. On the ~43% of crests
     that draw above 0.13 the modulated wash gain reaches -0.03, inverting the wash band for part
     of the trough. Almost certainly inaudible; the comment is still wrong, and a comment asserting
     an invariant the code breaks is how the next person gets misled.
     EXACT MINIMAL CHANGE IF WANTED (ocean.ts:120), one line, no behaviour change above zero:
       toWash.gain.setTargetAtTime(0.09 + Math.random() * 0.07, t - 1.5, 1.2);
     ->  toWash.gain.setTargetAtTime(0.09 + Math.random() * 0.04, t - 1.5, 1.2);
     That caps the depth at the 0.13 base and makes the comment true. It narrows the wash variation
     slightly, so it is a DSP judgement, not a typo fix — routing it rather than making it.
     My test pins the range that IS true (0.09..0.16) and records the discrepancy beside it.
 F3. THE MAP'S PROPOSED `|mean| < 1e-4` WOULD HAVE SHIPPED A FLAKY SUITE. removeDC runs on the LONG
     buffer, but what survives is the mean of the 10 s SLICE taken after the seal folds the tail
     over the head, and pink and brown carry enough LF for those to differ. Worst of 25 runs:
     white 8.0e-5, pink 3.6e-4, brown 3.8e-4. Band is 2e-3, ~5x the worst observed and still -74 dB
     relative to buffer RMS. Recorded because it is the difference between measuring and assuming.
 F4. poissonGap(NaN) RETURNS NaN. Math.max(0.001, NaN) is NaN, so the clamp cannot rescue it.
     Nothing in src/audio passes NaN today, so this is safe — but it is safe only because
     _pumpTask writes `if (!(gap > 0.002))` and not `gap <= 0.002`. The negation is load-bearing
     and nothing said so. There is now a test that fails if anyone "tidies" it.
 F5. getOceanPhase does not drift, but its RESOLUTION degrades. At an arbitrary offset the phase
     reproduces to ~3.6e-13 after eight hours, not bit-for-bit — that is one ULP of (t * 0.1) at
     t = 28,800, not accumulation, since the phase is recomputed from currentTime every call and
     never integrated. 3.6e-12 of one cycle. Not a defect; recorded so nobody "fixes" it later.
     The two positions the pacer actually uses, trough and crest, ARE exact at 8 hours and are
     asserted as exact.

WHAT I COULD NOT REACH, AND WHY I DID NOT FORCE IT
 - THE PERIODICWAVE SIGN CONVENTION. Every trough/crest claim in the ocean tests rests on the
   convention documented at onef.ts:23-30 (real weights cos, imag weights sin). I cannot verify
   that against the shipped native library from the pure tier. If it is reversed, crest and trough
   swap together everywhere and my tests would agree with the code while both were wrong. Marked
   `(reasoned, not measured)` at the definition and in both file headers. The results that survive
   either convention — the exact 10.000 s spacing, start-time independence, the 0.6 s lag — are the
   ones I would rely on. Verifying the convention needs a render or a device.
 - THE LIBRARY-BINDING CLASS GENERALLY. QA is right and I want it in my own words: this fixture is
   structurally blind to the bugs that actually shipped in this port. I modelled ONE of them —
   copyToChannel sizing from the backing ArrayBuffer — from noise.ts's own comment, so a regression
   from slice() back to subarray() now fails. That is a regression guard, not verification.
 - THE ~6 dB INTER-LAYER WINDOW AND TRIM. Needs the whole graph summed, i.e. QA's
   node-web-audio-api spike. My slice proves the GENERATORS; that would prove the MIX. Neither
   retires a device listen, and I am not claiming otherwise anywhere in these files.
 - THE SEAM RMS RATIO ON PINK AND BROWN. A 50 ms RMS window is not a stable estimator on them
   (measured 0.80..1.15 across runs, wider than the effect being tested). Asserted on white only,
   with the limitation recorded in expected-noise.ts rather than hidden behind a loose band.

ONE HARNESS NOTE, resolved before it cost anyone anything. When I started, `vitest.config.mts`
included only `test/unit/**`, so nothing any of the four wave-2 slices wrote would have been
collected and `npm test` would have stayed green at 16 tests having run none of it — QA blocker 7
from the other side. I did NOT edit that file (Senior Platform's, and four people fixing one glob
in parallel is the collision the ownership rule exists for); I built a stopgap config under
`test/audio/` to run my slice, and by the time I finished, Senior Frontend had already widened the
include and disclosed it. My stopgap is deleted. Nothing outstanding.

Sanity checks I ran before filing: `npm test` (16 files, 267 tests, 851 ms), `npm run typecheck`
(clean), the audio slice 20 consecutive times and the full suite 5 consecutive times with zero
failures — the statistical bands are on unseeded Math.random on purpose, so stability is measured,
not assumed. `git status` confirms nothing under `src/audio/**` is modified. I did not commit.

### CEO - closing wave 2 22:49:13
Did: read all five wave-2 reports and verified the end state myself rather than taking it on report.
MEASURED just now, on this machine: `npm run typecheck` exit 0, `npm test` **267 passed / 267 across
16 files in 965 ms**. That is the founder's "add tests" delivered: from zero test infrastructure of
any kind to a suite that runs in under a second, an order of magnitude cheaper than the typecheck.

WHAT I ACTUALLY VALUE HERE, and it is not the count. Four separate people this wave found a test
that passes by not looking:
 - the bundle suite returning green having read no bundle (QA found it, Platform fixed it twice over
   and added a positive control that then caught a second error in the fix);
 - `vitest.config.mts` including only `test/unit/**`, so NO wave-2 slice would have been collected
   and `npm test` would have sat green at 16 tests having run none of them (Senior Frontend found and
   fixed it; the Audio Engineer and the Junior hit it independently);
 - three of the frame-clock tests passing vacuously against the very bug they were written for,
   because a dark loop produces no dt and "no dt was negative" is then trivially true;
 - `analyse-samples.mjs` reporting a clean pass on digital silence, because "peaks <= 0.35" is
   one-sided (QA, measured).
That is the same failure this company has already shipped twice on a device - verifying the mechanism
and reporting the outcome. It is now the thing this team catches by reflex, which is worth more than
the 267.

THREE TESTS WERE PROVEN TO BITE, by reverting the code and re-running:
 - frame clock: 18/18 fail against the arithmetic that shipped, 18/18 pass against the new.
 - grace rule: flips 2 of 6 rows under the historical `earned || isAvailable()` bug.
 - timer fade latch: master reaches 0.000000 with it, 0.014115 without, against a 0.001 threshold.
A test nobody has watched fail is a hypothesis. These three are not.

CORRECTIONS TO MY OWN BRIEF, all made by people below me and all correct:
 1. Lead 2 drew the pure/component line backwards. The layer factories, scheduler and noise
    generators take `ctx` as a parameter and import nothing native; the frame-clock bug class is the
    part that is NOT pure.
 2. My "still yields dt >= 0" formulation was vacuous against the actual bug. The load-bearing
    assertion is the paint count.
 3. The map's `|mean| < 1e-4` would have shipped a flaky suite - measured up to 3.8e-4.
 4. I suspected a third Date.now()/performance.now() instance. Three people grepped independently:
    there is no third, and after seam S2 there is now only one clock for it to hide in.
 5. My own routing error: I put two Platform passes on one file. Caught before any work was lost,
    but it is exactly the failure our disjointness rule exists to prevent and it was mine.

ROUTED OUT OF THIS TASK, not fixed here:
 - SHIP BLOCKER, now measured inside the installed artifact: `__grantPremiumForTesting` at byte
   offset 288261 of app-release.apk, plus a SECOND backdoor nobody knew about,
   `__resetInterstitialDay`. `npm run test:bundle` is red and stays red until both are gone.
 - F1 (Audio): white noise ships 2.5-2.9 dB quiet, 25 runs out of 25, because the loop seal sets the
   normalising peak. Not a defect, an unrecorded cost on a FREE-tier layer, and `TRIM.white` was
   calibrated against it - neither moves without re-measuring both.
 - F2 (Audio): `ocean.ts:104` claims the wash gain is never negative; it reaches -0.03 on ~43% of
   crests. One-line fix written up; it changes the wash, so it is a DSP judgement, not a typo.
 - Seam S5 (Platform): the saved-mix entitlement filter is written inline in three places and had to
   be mirrored a fourth time in a test. Logic written twice is why the frame-clock bug shipped twice.
 - `hooks.ts` is a tier lower than the map assumed - reaching `formatClock` needs a mock for an
   unrelated sibling import. A seam mirroring S4 would remove it.

WHAT THIS SUITE STILL CANNOT DO, stated because QA will hold me to it and should:
 It does not retire a single device listen. It cannot see the library-binding bug class that actually
 broke the port. It cannot prove the rAF loops are fully cancelled - both are .tsx and unreachable
 from the pure tier - so the overnight battery guarantee is still unverified. And the PeriodicWave
 sign convention under every trough/crest claim is unverifiable from here: if it is reversed, our
 tests agree with the code while both are wrong. Nothing in these files claims otherwise, which is
 the part I am pleased about.
Changed: nothing this entry - verification only. Not committed.
