# Quietloom

> New here? Read [`team/README.md`](team/README.md) for who owns what and the
> standing product decisions, then your own charter in [`team/`](team/).

**Living Sleepscapes** — a sleep-sounds app where **every sound is synthesised in real time**.
There are no audio files anywhere in the project. Rain, ocean, fire, wind, crickets, thunder,
pink/brown/white noise, binaural beats and the slow-wave pulse are all generated from oscillators,
filtered noise and a 1/f amplitude envelope, which means the audio never loops, the app stays tiny,
and there are no sample licences to pay for — ever.

The other half of the idea is that **every sound cites its source**. Each layer carries an evidence
badge (Strong / Moderate / Emerging / Traditional) and an info card that links to the actual
peer-reviewed paper. See [`research.md`](research.md) for the full source list, and
[`BUSINESS.md`](BUSINESS.md) for monetisation, the go-live checklist and the launch plan.

Package ID: `com.quietloom.rn`

## Stack

React Native, TypeScript throughout, strict mode. The app began as a Vite + Capacitor web app; it
is now React Native only and the web build has been removed. Every piece below replaced a browser
API of the same shape, which is why the code reads as a transcription rather than a rewrite.

| Piece | What it is |
|---|---|
| Expo SDK 57 / RN 0.86 | App shell, build and native config. No custom native code. |
| `react-native-audio-api` | The entire sound engine ([`src/audio/engine.ts`](src/audio/engine.ts)) — a native implementation of the Web Audio API. |
| `@shopify/react-native-skia` | The scenes, drawn through a small Canvas2D adapter ([`src/scenes/canvas.ts`](src/scenes/canvas.ts)). |
| `react-native-google-mobile-ads` | Banner, interstitial and rewarded video. |
| `@react-native-async-storage/async-storage` | Persistence, behind a synchronous cache. |
| `expo-keep-awake` | Holds the screen in bedside mode. |
| `expo-web-browser` | Opens the research citations. |

## Running it

```powershell
npm install
npx expo prebuild --platform android   # generates android/ from app.json
npm run fix-truststore                 # re-point Gradle at the merged CA store (see gotcha 2)
npm run android                        # build, install and launch — DEBUG
npm run typecheck                      # tsc --noEmit, no device needed
```

`android/` and `ios/` are **generated** and git-ignored. `npx expo prebuild` rebuilds them from
`app.json`, so anything you are tempted to edit by hand in there belongs in `app.json` or a config
plugin instead — otherwise the next prebuild silently throws your change away.

Building on Windows needs Git for Windows installed at its default location: `react-native-audio-api`
runs a bash script from Gradle and reaches for `C:\Program Files\Git\usr\bin\bash.exe` by absolute
path. [`plugins/withWindowsGitBashPath.js`](plugins/withWindowsGitBashPath.js) then repairs that
script's `PATH` — without it the build dies on `mkdir: command not found`.

There is no browser dev mode any more. The audio engine, the scenes and the ad SDK are all native
modules, so a device or emulator is the development loop. `npm run typecheck` and Metro's bundler
still catch most mistakes without one.

### Which build variant, and why it matters

`expo run:android` with no `--variant` gives you a **debug** build. A React Native debug build is
not "release minus a bit" — it is a different performance class: dev-mode React with its extra
checks, an unminified dev bundle served live by Metro over the wire, LogBox, and every `console.*`
crossing the bridge. **Performance must never be judged on a debug build.** We lost a round to
exactly that: a report of "the entire app is SUPER SLOW" turned out to be the only build anyone
had ever run, and no release build existed to compare it with.

| Command | What you get |
|---|---|
| `npm run android` | **Debug.** Metro serves the JS live, `__DEV__` on, `debuggable`. The daily loop. Never measure on it. |
| `npm run android:optimized` | **`--variant debugOptimized`** (SDK 54+). The native C++ is rebuilt with `-DCMAKE_BUILD_TYPE=Release`, so Skia and the audio engine run at full speed while the debugger and Metro stay attached. It is still a *debuggable* variant, so the **JS is still the dev bundle** — it does nothing for the JS thread. A good middle step, not a stand-in for release. |
| `npm run android:release` | **Release.** JS is compiled to Hermes bytecode and packaged into the APK, `__DEV__` off, no Metro, no LogBox. The only build a performance claim may rest on. |
| `npm run apk:release` | The same release APK, **built but not installed** — use this when no device is attached. |

The release APK lands at `android/app/build/outputs/apk/release/app-release.apk`. It is signed
with the **debug** keystore (`android/app/build.gradle` gives the `release` buildType
`signingConfig signingConfigs.debug`), which is fine for sideloading and for measurement — it has
the same application ID as a debug build, so it installs straight over one — but it can never be
uploaded to Play. See `HANDOFF.md` for that gap.

`assembleRelease` builds all four ABIs. If you know the target device, restrict it — most of an
APK this size is native libraries, so one ABI instead of four cuts both the build time and the
artifact substantially:

```powershell
npm run apk:release -- -PreactNativeArchitectures=arm64-v8a
```

`arm64-v8a` covers every Android phone made in the last decade, including the Galaxy A56 we test
on. `expo run:android` already does this automatically for **debug** builds when a device is
attached, but not for release — so a release APK is much larger than the debug one unless you say
so. Compare like with like when comparing sizes.

## Project layout

```
App.tsx                  Composition root — boot order, banner policy, lifecycle.
src/types.ts             The frozen contracts: bus events, engine state, domain types.
src/audio/engine.ts      The synthesiser. Every layer, every filter, the 1/f envelope.
src/audio/background.ts  Audio session, foreground service, lock-screen controls.
src/scenes/canvas.ts     Canvas2D-shaped adapter over Skia. The scenes are written to it.
src/scenes/renderer.ts   Scene state and frame composition (rain/waves/stars/embers/moonrise).
src/core/bus.ts          Tiny typed pub-sub. How modules talk without importing each other.
src/core/store.ts        AsyncStorage behind a sync cache. Every persisted key lives here.
src/core/timer.ts        Sleep timer with the fade-out. Defaults ON at 45 minutes.
src/data/evidence.ts     Study metadata behind every sound. Mirrors research.md.
src/data/presets.ts      The curated mixes.
src/services/ads.ts      AdMob. Frozen public API; nothing in it is allowed to throw.
src/services/billing.ts  Play Billing. Currently a scaffold — see the TODO blocks inside.
src/services/entitlements.ts  Free tier, night pass, premium.
src/services/native.ts   Platform shims: keep-awake, back button, external links.
src/ui/                  Screens, sheets, overlays and the shared component set.
scripts/                 Environment-repair scripts (see the gotchas below).
tools/                   Audio measurement. Read the note at the top of analyse-samples.mjs.
```

## Environment gotchas on this machine

Two things will waste an hour each if you do not know about them. Both are Gradle problems, so both
still bite after `expo prebuild` even though there is no Capacitor left.

### 1. `JAVA_HOME` needs to be a JDK 17 or newer

React Native 0.86's Gradle plugin compiles against Java 17
(`@react-native/gradle-plugin` → `JdkConfiguratorUtils.kt`), so 17 is the floor and 21 is fine too.

On this machine `JAVA_HOME` is already `C:\Users\aviha\.jdks\ms-17.0.15`, which works. Android
Studio's bundled JetBrains Runtime (`C:\Program Files\Android\Android Studio\jbr`, currently 21)
is an equally good choice if you ever need to switch.

> This used to be stricter. The Capacitor build specifically required Android Studio's JBR 21 and
> would not build on a system JDK 17 — that constraint left with Capacitor. Ignore any older note
> saying JBR is mandatory.

Symptoms of getting this wrong are `Unsupported class file major version` or an AGP complaint about
the JVM target.

### 2. Norton intercepts TLS, and the JDK does not trust its CA

This machine runs Norton, which man-in-the-middles every HTTPS connection and re-signs it with
"Norton Web/Mail Shield Root". Windows trusts that root. The JDK ships its **own** separate CA
store and does not. So Gradle cannot reach `dl.google.com` or Maven Central and every dependency
resolution dies with:

```
PKIX path building failed: unable to find valid certification path to requested target
```

Rebuild a merged truststore with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fix-truststore.ps1
```

The script copies the current JBR `cacerts`, scans the Windows certificate stores for anything that
looks like an interception root (Norton, Kaspersky, ESET, Bitdefender, Avast, AVG, Zscaler,
Fiddler) and imports whatever it finds. JBR does not support
`-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT`, which is why we merge rather than delegate.

Then point Gradle at it in `android/gradle.properties`. Do this **after each prebuild** — that file
is generated, so the setting does not survive:

```properties
systemProp.javax.net.ssl.trustStore=C:/Projects/MoneyMaker/android/certs/cacerts-with-norton.jks
systemProp.javax.net.ssl.trustStorePassword=changeit
```

**On a machine without TLS interception, skip all of this** — the stock truststore works.

`scripts/run-emulator.ps1` boots the Pixel_9a AVD and waits for it. Use that image specifically: it
ships Google Play services, and AdMob will not serve even test ads without them.

## Before you ship

The app runs on **Google's official AdMob test ad unit IDs** and earns exactly zero, and
`billing.ts` is a scaffold that reports "coming soon". Both are intentional for development.
[`BUSINESS.md`](BUSINESS.md) has the numbered go-live checklist. The RN form of its first item: the
unit IDs live in [`src/services/ads.ts`](src/services/ads.ts) **and** the app IDs live in the
`react-native-google-mobile-ads` plugin block of [`app.json`](app.json). Both have to change.
