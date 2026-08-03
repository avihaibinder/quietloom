# Quietloom — Handoff

The honest state of things: what works, what is verified, what is not, and the
shortest path from here to money.

Read this first, then `BUSINESS.md` for the go-live checklist and `team/` for who
owns what. Keep this file true as things change.

---

## What you have

**A React Native app.** Expo SDK 57 / RN 0.86, TypeScript strict throughout.

```powershell
npm install
npx expo prebuild --platform android
npm run fix-truststore     # only on a machine with TLS-inspecting antivirus
npm run android            # debug build: Metro serves the JS, __DEV__ on
npm run android:release    # release build: Hermes bytecode in the APK, __DEV__ off
```

`npm run android` is the development loop. It is a **debug** build and it is a different
performance class, not "release minus a bit" — **never judge how fast the app feels on it.**
`README.md` § "Which build variant, and why it matters" has the full table.

**Quietloom — Living Sleepscapes** (`com.quietloom.rn`) is a sleep-sounds app where
every sound is synthesised in real time. There is not a single audio file in the
project. That is the product, not a shortcut: a recording loops, and once you notice
the loop point you cannot un-notice it. Quietloom never repeats, weighs almost
nothing, and costs nothing in licensing — forever.

The positioning is **the only sleep app that cites its sources**. Every sound carries
an evidence badge and an info card linking to the actual study. `research.md` is the
full bibliography, and several product decisions come straight out of it and
deliberately contradict what competitors ship:

| Decision | Why |
|---|---|
| Pink noise is the default, not white | Zhou 2012 found steady pink noise significantly increased stable sleep time; the evidence for white is weaker than its popularity |
| The sleep timer defaults **ON** at 45 minutes | The evidence supports sound for sleep *onset* far better than all-night noise. Riedy 2021 rates continuous-noise evidence "very low" |
| The ocean swell is exactly 10 s = 0.1 Hz | That is baroreflex resonance, six breaths a minute. The waves double as a breathing pacer |
| Bedside mode is deep red, not white | Red suppresses melatonin far less than blue or white light |
| Breathing defaults to 6 bpm, not 4-7-8 | 6 bpm has the stronger empirical base; 4-7-8 is offered but badged "Emerging" |
| A "Nursery-safe" volume cap exists | WHO and AAP guidance on bedroom sound levels. Nobody else ships this |

---

## The port: where this build came from

Quietloom was a Vite + Capacitor web app until this rewrite. **It is now React
Native only; the web build has been deleted.** The port was a transcription, not a
redesign — every DSP constant, every research claim and every product rule was
carried across unchanged, and the frozen contracts (bus event names, engine API,
service APIs) are identical. Read `UI-WIRING.md` and `MONETIZATION-WIRING.md` for
those contracts.

What changed on purpose:

| | Was | Now |
|---|---|---|
| Audio | Web Audio API | `react-native-audio-api` (native, same API shape) |
| Scenes | Canvas 2D | Skia, behind a Canvas2D adapter so the scenes port line-for-line |
| Storage | localStorage | AsyncStorage behind a synchronous cache |
| Ads | `@capacitor-community/admob` | `react-native-google-mobile-ads` (banner is now a React component) |
| Shell | Capacitor 7 | Expo SDK 57; `android/` and `ios/` are generated, not committed |

**Two deviations worth knowing about, both in the audio engine:**

1. **There is no `DynamicsCompressorNode`.** The final safety stage is a
   `WaveShaperNode` running a tanh soft-clip at drive 1.2 — unity gain at sleep
   listening levels, ceiling ≈ 0.695, which is what the old −4 dB / 6:1 compressor
   actually did at full scale. This matters: getting it wrong the other way would
   have made the nursery-safe cap quietly *louder* than the web build while still
   reading "45%".
2. **`visibilitychange` became `AppState`.** Same wake-on-resume behaviour.

---

## Verified on a device

Run on a Pixel 9a emulator (Android 16), debug build, from a clean `expo prebuild`:

- Launches, and the mixer renders correctly — presets, layer cards, evidence
  badges, locked-layer state, sliders, bottom bar.
- Session restore works: the saved mix and scene come back.
- **Audio runs.** Tapping Play opens a real `AAudio` output stream
  (`AAUDIO_OK`, `requestStart` → state 4) through Oboe.
- The sleep timer auto-starts on `audio:started` and counts down from 45:00.
- **Background audio works** — the thing the Capacitor build never had. The
  `mediaPlayback` foreground service comes up (`isForeground=true`,
  `types=0x00000002`) with an ongoing `category=transport` notification on an
  `audio_playback` channel.
- The merged manifest carries **no `RECORD_AUDIO`** — verified on the **release** APK too
  (`aapt2 dump permissions`), not just debug. The microphone trust claim holds.
- **But the release manifest does declare `SYSTEM_ALERT_WINDOW`**, and it is ours, not
  React Native's debug manifest: `expo prebuild` generates
  `android/app/src/main/AndroidManifest.xml` from the template in
  `@expo/config-plugins/build/plugins/withAndroidBaseMods.js:56-68`, which ships
  `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE`
  under a comment reading "OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU DO NOT NEED". Nobody
  removed them. The app uses none of the four. "Display over other apps" is a sensitive
  permission, it is visible to every user on the store listing, and a Play reviewer will ask
  a sleep app why it wants it. Fix in `app.json` — `android.blockedPermissions` (supported in
  SDK 57, `@expo/config-plugins/build/android/Permissions.js:64`) — then prebuild and rebuild.
  Do this before the first upload, not after.

Two real bugs were found by doing this, both now fixed, and neither was
reachable without a device — see the `copyToChannel` and lazy-ad-SDK commits.

## NOT verified, and why

**Whether you like how it sounds.** A stream opening is not a sound. Nobody has
listened to this build, and the emulator is the wrong place to judge it. The
soft-clip substitution in particular deserves ears on real headphones.

**Anything beyond the first screen.** Bedside, breathing, the sheets, the moon
tap, the Skia scenes under motion, and an overnight run are all still untested.

**Every ad flow**, for two reasons — the emulator cannot fill (below), and the
ad SDK is currently excluded from the build (also below).

**A rendered ad, and a real reward callback.** Unchanged from the previous build:
this machine runs Norton, which intercepts HTTPS and re-signs every certificate with
its own root CA. The Android emulator's trust store does not contain that root, so
*every* HTTPS client inside the emulator fails certificate validation — including
the Play Store's own sync. Install on a real phone on a normal network.

## BLOCKER: the ad SDK does not build on Expo SDK 57

`react-native-google-mobile-ads@16.4.0` (the latest) is **currently excluded
from the native build** — `expo.autolinking.exclude` in `package.json`, and its
config plugin is out of `app.json`. The app is fully functional without it and
degrades to no ads, but it also earns nothing, so this has to be resolved.

The cause is upstream, not ours. The library calls `AgeRestrictedTreatment`,
which only exists in `play-services-ads` 25.3+, and 25.3+ is compiled with
Kotlin 2.3.0 metadata. Expo SDK 57 ships Kotlin 2.1.20, which cannot read it.
Every version was probed and there is no gap:

| play-services-ads | Result |
|---|---|
| 24.5.0, 25.0, 25.1, 25.2 | `Unresolved reference 'AgeRestrictedTreatment'` |
| 25.3.0, 25.4.0 | `metadata is 2.3.0, expected version is 2.1.0` |

Ways out, best first:

1. **Raise the project's Kotlin to 2.3.x** via `expo-build-properties`
   (`android.kotlinVersion`), which also needs a matching `kspVersion` — Expo's
   `kotlinVersion → kspVersion` map in `expo-modules-core` has no 2.3 entry and
   falls back to a KSP that will not match. Setting `ext.kotlinVersion` by hand
   in the generated `android/build.gradle` does **not** work; the Kotlin plugin
   classpath resolves earlier, in plugin management.
2. **Wait for Expo to move to Kotlin 2.3**, then just delete the exclusion.
3. **Pin an older `react-native-google-mobile-ads`** whose Kotlin does not call
   the 25.3-only API.

Whichever you pick, re-add the plugin block to `app.json` and drop
`expo.autolinking.exclude` from `package.json`, then prebuild and rebuild.

**A rendered ad, and a real reward callback.** Unchanged from the previous build:
this machine runs Norton, which intercepts HTTPS and re-signs every certificate with
its own root CA. The Android emulator's trust store does not contain that root, so
*every* HTTPS client inside the emulator fails certificate validation — including
the Play Store's own sync. Install on a real phone on a normal network.

**Whether you like how it sounds.** The old measurement harness rendered the *web*
engine through an `OfflineAudioContext` in headless Chrome. That engine is gone, so
nothing renders samples today — see the note at the top of `tools/analyse-samples.mjs`
for what was lost and how to rebuild it (the analysis half still works on any WAV).

What the old measurements confirmed about the DSP that was transcribed here — the
numbers should not have moved, but nobody has re-measured:

| Check | Result |
|---|---|
| Ocean swell period | **10.0 s** — the 0.1 Hz breathing pacer, exact |
| Binaural | crest 1.4 and 100% of weighted energy at 200–800 Hz: a clean 250 Hz sine pair |
| Pink noise | flat per octave |
| Brown noise | steep low-frequency tilt |
| White noise | rising with bandwidth |
| Thunder | 73% low, crest 19, sparse loud events |
| Fire / crickets | 18 and 7 transients per second — grains are firing |
| Level balance | continuous layers within a 5.5 dB window, peaks ≤ 0.35 |

That process found two real faults calculation had missed: wind was ~12 dB too quiet
to hear next to anything else, and fire put 87% of its energy below 200 Hz so it read
as a rumble instead of a crackle. Both fixes are in the ported constants. One
methodological note worth keeping: unweighted, fire *still* measures 88% low and the
fix looks like it failed. The ear is roughly 25 dB less sensitive at 100 Hz than at
3 kHz, so the unweighted number was the wrong question. Use the A-weighted column.

---

## Carried over from the previous build

These were verified on a Pixel 9a emulator against the Capacitor app. The logic
behind them was ported unchanged, but **the ports themselves are unverified**:

- Clean install and launch, no crash, no saved state
- Audio synthesis producing a real output stream
- AdMob initialising in test mode
- Sleep timer counting down and the fade scheduled on the audio clock
- Bedside mode: red clock, wake lock held
- Breathing pacer with Coherence (Strong) default and 4-7-8 (Emerging) secondary
- Evidence sheet with live citation links
- The unlock flow granting a night pass
- The premium dev backdoor confirmed absent from the production bundle

An 8-hour simulated run of the old audio engine (with JS timers throttled to once per
minute, as Android does with the screen off) held a flat node count and never emptied
its 90-second scheduling horizon. That test caught a real leak of ~500 orphaned audio
nodes on preset swap. The fix — the voice pool in `src/audio/noise.ts` — is ported;
the 8-hour run is not repeatable without the old harness.

---

## The three things that will cost you money if you forget them

1. **It earns $0 until you swap the ad IDs.** Everything runs on Google's public test
   units. `BUSINESS.md` step 4 has the detail: `AD_UNITS` and `TEST_MODE` in
   `src/services/ads.ts`, **plus** the app IDs in the
   `react-native-google-mobile-ads` plugin block of `app.json`. Both, or you earn
   nothing.
2. **`android/` is generated.** `npx expo prebuild` rewrites it from `app.json`, so
   hand-edits to the manifest or Gradle files vanish. This replaces the old
   "editing `src/` is not enough, run `npm run sync`" trap with the opposite one.
3. **A new Play developer account needs 12 testers for 14 continuous days** before
   you can publish to production. Start that clock today; it is the longest pole by
   far.

---

## Known gaps, ranked by how much they matter

1. **Nothing has run on a device.** See above. Everything else on this list is
   theoretical until that changes.
2. **No EEA consent form.** `ads.ts` never calls the UMP API, which
   `react-native-google-mobile-ads` bundles. That is both a GDPR/Google-policy
   problem and lost revenue (non-personalised ads only in the EEA, UK and
   Switzerland). Fix before launching in Europe.
3. **Real in-app purchase is a scaffold.** `src/services/billing.ts` has three
   `TODO(billing)` blocks containing the code to paste, targeting `react-native-iap`.
4. **No production upload keystore.** Note the correction: a release APK *is* buildable today.
   `android/app/build.gradle` gives the `release` buildType `signingConfig signingConfigs.debug`,
   so `npm run android:release` produces a real, installable, `__DEV__`-off APK — same
   application ID as a debug build, so it installs straight over one. What is missing is a
   **production upload key**: the debug keystore is a public, well-known key, it cannot be used
   to publish, and the key you first upload with is permanent for the life of the listing.
   Generate one, back it up somewhere that is not this machine, and enrol in Play App Signing
   before the first upload. Nothing about this blocks sideloading or measuring today.
5. **No audio measurement harness.** The renderer half died with the web app. The
   DSP is unmeasured in its current form.
6. **Node count on rich presets was ~3,900** in the web engine. Flat and leak-free
   there, but it is the number to watch on a low-end phone, and the RN engine has
   not been profiled at all.

**Background audio is no longer on this list.** It was the Capacitor build's
second-worst gap: audio stopped when the screen turned off outside bedside mode,
because the only maintained plugin demanded `RECORD_AUDIO` and declared a foreground
service falsely claiming the app talks to SIP servers. `react-native-audio-api` ships
a proper `mediaPlayback` foreground service, an iOS background mode and a lock-screen
notification, with **no microphone permission**. Keep it that way — see
`MONETIZATION-WIRING.md` §8.

---

## Do not let anyone describe "Deep Pulse" as slow-wave enhancement

It reproduces the *pulse pattern* from Papalambros 2017 open-loop — five pink-noise
pulses at ~0.8 Hz, then a matching gap. The actual study phase-locked those pulses to
each slow oscillation using live EEG. Quietloom has no EEG and cannot do that. It is
labelled "Experimental" in the app and in `research.md` for exactly this reason. Keep
it that way; over-claiming health benefits is how wellness apps get pulled.

---

## Where things live

```
research.md              Every study, with links. The product spec as much as the bibliography.
BUSINESS.md              Revenue model, realistic numbers, and the go-live checklist.
PRIVACY.md               Publishable privacy policy (fill in the placeholders, host it).
README.md                Dev setup and the two environment gotchas.
UI-WIRING.md             How the UI is wired.
MONETIZATION-WIRING.md   How the ad and billing services are wired.
App.tsx                  Composition root — boot order, banner policy, lifecycle.
src/audio/               The generative engine. Start at engine.ts.
src/scenes/              Skia scenes. Start at canvas.ts, then renderer.ts.
src/ui/                  Screens and sheets. Start at screens/MixerScreen.tsx.
src/services/            Ads, billing, entitlements, native.
src/data/evidence.ts     The citation metadata behind every badge.
scripts/fix-truststore.ps1   Run this if Gradle starts failing with PKIX errors.
scripts/run-emulator.ps1     Boots the Pixel_9a AVD (the one with Play services).
```

**Two environment notes for this machine.** `JAVA_HOME` needs a JDK 17 or newer —
RN 0.86 compiles against 17, and the machine's existing `ms-17.0.15` is fine. (The
old "must be Android Studio's JBR 21" rule was a Capacitor 7 constraint and no
longer applies.) And Norton's TLS interception means Gradle needs a merged
truststore; `scripts/fix-truststore.ps1` rebuilds it, and you must re-point
`android/gradle.properties` at it after every prebuild because that file is
generated.
