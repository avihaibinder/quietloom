# Drift — Handoff

Built overnight. This file is the honest state of things: what works, what is
verified, what is not, and the shortest path from here to money.

Read this first, then `BUSINESS.md` for the go-live checklist.

---

## What you have

**A working Android app.** `android/app/build/outputs/apk/debug/app-debug.apk` (8.6 MB).
Install it on any Android phone with:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

Or rebuild everything from scratch with one command:

```powershell
npm install
.\scripts\build-apk.ps1
```

**Drift — Living Sleepscapes** (`com.drift.sleepscapes`) is a sleep-sounds app where
every sound is synthesised in real time by the Web Audio API. There is not a single
audio file in the project. That is the product, not a shortcut: a recording loops, and
once you notice the loop point you cannot un-notice it. Drift never repeats, weighs
almost nothing, and costs nothing in licensing — forever.

The positioning is **the only sleep app that cites its sources**. Every sound carries an
evidence badge and an info card linking to the actual study. `research.md` is the full
bibliography, and several product decisions come straight out of it and deliberately
contradict what competitors ship:

| Decision | Why |
|---|---|
| Pink noise is the default, not white | Zhou 2012 found steady pink noise significantly increased stable sleep time; the evidence for white is weaker than its popularity |
| The sleep timer defaults **ON** at 45 minutes | The evidence supports sound for sleep *onset* far better than all-night noise. Riedy 2021 rates continuous-noise evidence "very low" |
| The ocean swell is exactly 10 s = 0.1 Hz | That is baroreflex resonance, six breaths a minute. The waves double as a breathing pacer |
| Bedside mode is deep red, not white | Red suppresses melatonin far less than blue or white light |
| Breathing defaults to 6 bpm, not 4-7-8 | 6 bpm has the stronger empirical base; 4-7-8 is offered but badged "Emerging" |
| A "Nursery-safe" volume cap exists | WHO and AAP guidance on bedroom sound levels. Nobody else ships this |

---

## Verified on a device

All of the following was confirmed on a Pixel 9a emulator, not assumed:

- Clean install and launch, no crash, no saved state
- Audio synthesis producing a real `AAudio` output stream at `usage=USAGE_MEDIA`
- AdMob initialising in test mode
- Sleep timer counting down and the fade scheduled on the audio clock
- Bedside mode: red clock, wake lock acquired via the KeepAwake plugin
- Breathing pacer with Coherence (Strong) default and 4-7-8 (Emerging) secondary
- Evidence sheet with live citation links
- The unlock flow granting a night pass
- The premium dev backdoor confirmed **absent** from the production bundle

An 8-hour simulated run of the audio engine (with JS timers throttled to once per
minute, as Android does with the screen off) held a flat node count and never emptied
its 90-second scheduling horizon. That test caught a real leak of ~500 orphaned audio
nodes on preset swap, which is fixed.

---

## NOT verified, and why

**A rendered ad, and a real reward callback.** This machine runs Norton, which
intercepts HTTPS and re-signs every certificate with its own root CA. The Android
emulator's trust store does not contain that root, so *every* HTTPS client inside the
emulator fails certificate validation — including the Play Store's own sync. AdMob
reports `Ad failed to load : 0`.

The request path is verified correct: the right ad units, `isTesting: true`, the test
device registered, listeners attached and torn down cleanly. Every failure degrades
gracefully. But to actually watch a test ad play you need to **install the APK on a
real phone on a normal network**. That is the single most valuable thing you can do
next, and it takes five minutes.

**Whether you like how it sounds.** The synthesis is now measured rather than assumed —
see below — but taste is yours. Listen to `samples/` and adjust the `TRIM` table at the
top of `src/audio/engine.js` if anything sits wrong.

---

## Listen to it without a phone

```powershell
node tools/render-samples.mjs     # writes samples/*.wav
node tools/analyse-samples.mjs    # reports what each one actually is
```

The first drives the real engine through an `OfflineAudioContext` in headless Chrome, so
it needs no speakers and no device. The second reports crest factor, transient density,
envelope modulation and A-weighted spectral balance per file.

What the measurements confirm:

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

That process found two real faults that calculation had missed: wind was ~12 dB too
quiet to hear next to anything else, and fire put 87% of its energy below 200 Hz so it
read as a rumble instead of a crackle. Both are fixed.

One methodological note worth keeping: unweighted, fire *still* measures 88% low and the
fix looks like it failed. The ear is roughly 25 dB less sensitive at 100 Hz than at
3 kHz, so the unweighted number was the wrong question. Use the A-weighted column.

---

## The three things that will cost you money if you forget them

1. **It earns $0 until you swap the ad IDs.** Everything runs on Google's public test
   units. `BUSINESS.md` step 4 has the exact lines: `AD_UNITS` and `TEST_MODE` in
   `src/services/ads.js`, plus the `APPLICATION_ID` meta-data in
   `android/app/src/main/AndroidManifest.xml`.

2. **Editing `src/` is not enough.** `android/app/src/main/assets/public/` holds a
   compiled copy of the web app. Always run `npm run sync` (or the build script) after
   changing anything under `src/`, or you will ship the test IDs by accident.

3. **A new Play developer account needs 12 testers for 14 continuous days** before you
   can publish to production. Start that clock today; it is the longest pole by far.

---

## Known gaps, ranked by how much they matter

1. **No EEA consent form.** `ads.js` never calls Google's UMP API. That is both a
   GDPR/Google-policy problem and lost revenue (non-personalised ads only in the EEA,
   UK and Switzerland). Fix before launching in Europe.
2. **Audio stops when the screen turns off outside bedside mode.** The maintained
   background-mode plugin was rejected during the build: it silently demands
   `RECORD_AUDIO` and declares a foreground service falsely claiming the app talks to
   SIP servers. A sleep app asking for your microphone is a trust catastrophe and a
   likely Play rejection. The correct fix is a small first-party foreground service of
   type `mediaPlayback` — the permission is already declared in the manifest. Until
   then, bedside mode (screen on, dimmed to near-black) is the overnight posture.
3. **Real in-app purchase is a scaffold.** `src/services/billing.js` has three
   `TODO(billing)` blocks containing the exact code to paste once you have a Play
   Console product.
4. **No release signing config.** Debug builds only. `BUSINESS.md` has the `keytool`
   command and the gradle block.
5. **Node count on rich presets is ~3,900.** Flat and leak-free, but it is the number to
   watch on a low-end phone. Halving the scheduler horizon for rain droplets and fire
   crackles halves it, if field testing ever complains.

---

## Do not let anyone describe "Deep Pulse" as slow-wave enhancement

It reproduces the *pulse pattern* from Papalambros 2017 open-loop — five pink-noise
pulses at ~0.8 Hz, then a matching gap. The actual study phase-locked those pulses to
each slow oscillation using live EEG. Drift has no EEG and cannot do that. It is
labelled "Experimental" in the app and in `research.md` for exactly this reason. Keep it
that way; over-claiming health benefits is how wellness apps get pulled.

---

## Where things live

```
research.md              Every study, with links. The product spec as much as the bibliography.
BUSINESS.md              Revenue model, realistic numbers, and the go-live checklist.
PRIVACY.md               Publishable privacy policy (fill in the placeholders, host it).
README.md                Dev setup and the two environment gotchas.
MONETIZATION-WIRING.md   How the ad and billing services are wired.
UI-WIRING.md             How the UI is wired.
src/audio/               The generative engine. Start at engine.js.
src/ui/                  Screens and sheets. Start at index.js.
src/services/            Ads, billing, entitlements, native. The only files that touch Capacitor.
src/data/evidence.js     The citation metadata behind every badge.
scripts/build-apk.ps1    Build, install, launch, one command.
scripts/fix-truststore.ps1   Run this if Gradle starts failing with PKIX errors.
```

**Two environment notes for this machine.** `JAVA_HOME` must point at Android Studio's
bundled JBR 21 — the system JDK 17 will not build Capacitor 7. And Norton's TLS
interception means Gradle needs the merged truststore in `android/certs/`; if it ever
breaks, `scripts/fix-truststore.ps1` rebuilds it.
