# Platform & Monetization Engineer

## Mission

Everything between the web app and the phone: the Capacitor shell, the Android
build, the ad units, and the billing path. When this role does its job well, nobody
else has to think about any of it.

## Owns

| Area | Files |
|---|---|
| Services | `src/services/ads.js`, `native.js`, `billing.js`, `entitlements.js` |
| Android shell | `android/**` — manifest, `MainActivity.java`, gradle, resources |
| Capacitor | `capacitor.config.json` |
| Build tooling | `scripts/build-apk.ps1`, `run-emulator.ps1`, `fix-truststore.ps1` |
| Docs | `MONETIZATION-WIRING.md` |

## Does not own

`src/ui/**`, `src/audio/**`, `src/main.js`.

## Frozen service contracts

Every one of these must be safe to call in a desktop browser with no Capacitor
present. Nothing here may throw — an ad failure is never a reason for a sleep app
to break.

```js
Ads.init() / isAvailable() / showBanner() / hideBanner()
   / maybeShowInterstitial() / showRewarded() / setAdsDisabled(bool)
   / lastRewardedFailure()   -> 'unavailable' | 'declined' | null
Native.isNative() / keepAwake(on) / backgroundMode(on) / openUrl(url) / onBackButton(fn)
Billing.PRODUCT_ID / PRICE_DISPLAY / init() / isAvailable() / purchasePremium() / restore()
Entitlements.isUnlocked(id) / isPremium() / setPremium() / hasNightPass() / grantNightPass()
```

`lastRewardedFailure()` exists because `isAvailable()` answers the wrong question: it
reports that the SDK initialised, which stays true when the network cannot deliver a
single impression. The paywall's grace rule keys off the failure reason instead.
Do not collapse these back together.

## Environment facts for this machine

Both of these are non-obvious and both will waste an hour if forgotten.

**`JAVA_HOME` must be Android Studio's bundled JBR 21**
(`C:\Program Files\Android\Android Studio\jbr`). The system JDK 17 will not build
Capacitor 7.

**Norton intercepts TLS.** It re-signs every HTTPS certificate with its own root,
which the JDK does not trust, so Gradle cannot resolve a single dependency. The fix
is a merged truststore in `android/certs/`, pointed at from `android/gradle.properties`.
If you ever see `PKIX path building failed`, run `scripts/fix-truststore.ps1`.
The same interception applies **inside the emulator**, which is why AdMob cannot fill
there — it is not an app bug.

`org.gradle.caching` is deliberately off; on Windows with antivirus active it fails
packing the dex tree.

## Ad rules that are product decisions

- Banner on the mixer screen only.
- At most one interstitial per local calendar day, on a cold start, never on first
  ever launch, and the day is recorded only after a *confirmed* show so a failed load
  does not burn the slot.
- Rewarded is the only ad the user opts into. Hard 30-second timeout so a wedged SDK
  cannot wedge the unlock sheet. Tear down listeners on every path.
- `canServe()` reads `Entitlements.isPremium()` live, so premium kills every ad path
  with no extra wiring.
- Nothing on sleep surfaces.

## Judgement call already made

A maintained background-mode plugin was installed, synced, and then **rejected** after
inspecting the merged manifest: it unions `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` and
`FOREGROUND_SERVICE_MICROPHONE` into the app, plus a foreground service whose
hand-reviewed justification string claims we need to stay alive for third-party SIP
servers. A sleep app asking for the microphone is a trust catastrophe and a likely
Play rejection.

The fallback is bedside keep-awake. The correct fix is a small **first-party
foreground service of type `mediaPlayback`** — that permission is already declared in
the manifest — driven by a MediaSession. It needs no extra permissions, gives a proper
lockscreen transport, and passes review. That is a Java change, not a plugin install.

## How to verify

```powershell
npm run build
npx cap sync android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
cd android; .\gradlew.bat assembleDebug
adb logcat -s Capacitor Ads chromium
```

Confirm after every `cap sync` that the AdMob `APPLICATION_ID` meta-data survived in
the manifest — its absence crashes the app at launch, and the build script hard-fails
if it is missing. Confirm every service method no-ops cleanly with no native shell.

## Now

1. **Google UMP consent for EEA/UK/Switzerland.** Currently absent. It is both a
   policy problem and lost revenue — without it those users only see non-personalised
   ads. Highest-value item in this charter.
2. Release signing config and `bundleRelease` — debug builds only today.
3. The first-party `mediaPlayback` foreground service.
4. Wire real billing when a Play Console product exists: three marked `TODO(billing)`
   blocks in `billing.js` contain the exact code.
