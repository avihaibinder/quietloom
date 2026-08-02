# Quietloom — Living Sleepscapes

A sleep-sounds app for Android where **every sound is synthesised in real time in the Web Audio
API**. There are no audio files anywhere in the project. Rain, ocean, fire, wind, crickets, thunder,
pink/brown/white noise, binaural beats and the slow-wave pulse are all generated from oscillators,
filtered noise and a 1/f amplitude envelope, which means the audio never loops, the APK stays tiny,
and there are no sample licences to pay for — ever.

The other half of the idea is that **every sound cites its source**. Each layer carries an evidence
badge (Strong / Moderate / Emerging / Traditional) and an info card that links to the actual
peer-reviewed paper. See [`research.md`](research.md) for the full source list, and
[`BUSINESS.md`](BUSINESS.md) for monetisation, the go-live checklist and the launch plan.

Package ID: `com.quietloom.app`

## Stack

| Piece | What it is |
|---|---|
| Vite 7 | Dev server and bundler. No framework — plain ES modules and DOM. |
| Web Audio API | The entire sound engine (`src/audio/engine.js`). |
| Canvas 2D | The visualiser / scenes (`src/scenes/renderer.js`). |
| Capacitor 7 | Native Android shell. `dist/` is copied into the APK as static assets. |
| `@capacitor-community/admob` 7.2.0 | Banner, interstitial and rewarded video. |
| `@capacitor-community/keep-awake` | Keeps the screen alive in bedside mode. |
| `@anuradev/capacitor-background-mode` | Keeps audio running when the app is backgrounded. |

## Running it

```bash
npm install
npm run dev        # Vite dev server — full app in a desktop browser, no ads
npm run sync       # vite build + npx cap sync android
npm run android    # scripts/build-apk.ps1 — build, sync, gradle assembleDebug, install
```

`npm run dev` is where you should spend nearly all your time. The audio engine, the scenes, the
timer, the paywall UI and the evidence cards all work in a plain browser. Ads and billing detect
that they are not inside a Capacitor shell and quietly disable themselves — `Ads.isAvailable()`
returns `false` and nothing throws. You only need a device or emulator to test the ad flows, the
background-audio behaviour and the wake lock.

## Project layout

```
index.html               Single page. All screens are DOM nodes inside it.
src/main.js              Composition root — boots the engine, ads, billing, scenes.
src/audio/engine.js      The synthesiser. Every layer, every filter, the 1/f envelope.
src/scenes/renderer.js   Canvas visualiser (rain / waves / stars / embers).
src/core/bus.js          Tiny pub-sub. How modules talk without importing each other.
src/core/store.js        localStorage wrapper. Every persisted key lives here.
src/core/timer.js        Sleep timer with the fade-out. Defaults ON at 45 minutes.
src/data/evidence.js     Study metadata behind every sound. Mirrors research.md.
src/data/presets.js      The six curated mixes.
src/services/ads.js      AdMob. Frozen public API; nothing in it is allowed to throw.
src/services/billing.js  Play Billing. Currently a stub — see the TODO block inside.
src/services/entitlements.js  Free tier, night pass, premium.
src/services/native.js   Capacitor feature detection and native shims.
src/ui/                  Sheets, paywall, evidence cards, toasts.
android/                 Capacitor-generated Android project.
scripts/                 Build and environment-repair scripts.
```

## Environment gotchas on this machine

Two things will waste an hour each if you do not know about them.

### 1. `JAVA_HOME` must be Android Studio's JBR 21

Gradle 8.x with AGP 8.x and `compileSdk 35` needs Java 21. Point `JAVA_HOME` at the JetBrains
Runtime that ships inside Android Studio, not at a system JDK 17 or 23:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
& "$env:JAVA_HOME\bin\java.exe" -version   # should say 21.x
```

Set it permanently in the user environment variables so `gradlew` picks it up in every new shell.
Symptoms of getting this wrong are `Unsupported class file major version` or an AGP complaint about
the JVM target.

### 2. Norton intercepts TLS, and the JDK does not trust its CA

This machine runs Norton, which man-in-the-middles every HTTPS connection and re-signs it with
"Norton Web/Mail Shield Root". Windows trusts that root. The JDK ships its **own** separate CA store
and does not. So Gradle cannot reach `dl.google.com` or Maven Central and every single dependency
resolution dies with:

```
PKIX path building failed: unable to find valid certification path to requested target
```

The fix is already in the repo. `android/certs/cacerts-with-norton.jks` is a copy of the JDK's own
`cacerts` with the Norton root imported into it, and `android/gradle.properties` points Gradle at it:

```properties
systemProp.javax.net.ssl.trustStore=C:/Projects/MoneyMaker/android/certs/cacerts-with-norton.jks
systemProp.javax.net.ssl.trustStorePassword=changeit
```

If you upgrade the JDK, or Norton rotates its CA, that merged store goes stale and the PKIX error
comes back. Rebuild it with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fix-truststore.ps1
```

The script copies the current JBR `cacerts`, scans the Windows certificate stores for anything that
looks like an interception root (Norton, Kaspersky, ESET, Bitdefender, Avast, AVG, Zscaler, Fiddler)
and imports whatever it finds. JBR does not support
`-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT`, which is why we merge rather than delegate.

**On a machine without TLS interception, delete those two `systemProp` lines** from
`android/gradle.properties` and everything works with the stock truststore.

One related note: `org.gradle.caching` is deliberately **off** in `gradle.properties`. With
antivirus active on Windows it intermittently fails packing the dex tree with
`Could not get file mode for ...classes2.dex`. Leave it off.

## Before you ship

The app currently runs on **Google's official AdMob test ad unit IDs** and earns exactly zero. The
`billing.js` module is a stub that reports "coming soon". Both are intentional for development.
[`BUSINESS.md`](BUSINESS.md) has the numbered go-live checklist — which lines in which files to
change, how to get an upload keystore, and what Play Console needs from you.
