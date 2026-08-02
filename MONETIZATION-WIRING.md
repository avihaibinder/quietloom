# Monetization wiring

How `ads.js`, `native.js` and `billing.js` connect to the rest of Quietloom, what
they promise, and what the app owner still has to do.

Status as of this build: **`src/main.js` and `src/ui/*` are already wired
against this contract and verified on a device.** The sections below are the
reference, not a to-do list — except for [What the owner must do](#what-the-owner-must-do).

---

## 1. Boot order

Monetization comes up *behind* the UI. A slow or failed ad SDK must never be
visible to someone who just wants rain.

```js
import { Ads }          from './services/ads.js';
import { Native }       from './services/native.js';
import { Billing }      from './services/billing.js';
import { Entitlements } from './services/entitlements.js';
```

1. Render the UI and attach the scene canvas.
2. `Billing.init()` — fire and forget, `.catch()` it. Currently a no-op.
3. `Ads.init()` — fire and forget, `.catch()` it. Then, in `.then()`:
   `await reconcileBanner()` and `await maybeOpeningInterstitial()`.

Never `await` either init on the critical path to first paint.

`Native` needs no init. `Native.isNative()` is **synchronous and correct on the
very first call**, including before any plugin has finished loading —
`@capacitor/core` is imported statically for exactly this reason. (The
`setTimeout(..., 0)` around the `[quietloom] ready` log in `main.js` is no longer
necessary; harmless if left.)

---

## 2. Banner

One rule, one function. Every state change funnels through `reconcileBanner()`:

```js
const allowed = onMixerScreen && !anySheetOpen && !Entitlements.isPremium();
allowed ? await Ads.showBanner() : await Ads.hideBanner();
```

Call it on: `screen:changed`, `entitlements:changed`, any sheet open/close, and
once after `Ads.init()` resolves.

The native banner floats **above** the WebView, so it will sit on top of any
open sheet or the bedside screen. Hiding it is not cosmetic — it is the
difference between a usable sheet and a broken one.

**Never show a banner on bedside or breathing.** See `research.md`: an ad on a
sleep surface is a real harm, not just a taste question.

### Reserving space

Listen for the bus event and pad the layout — do not hardcode 60px:

```js
bus.on('ads:banner', ({ visible, heightPx }) => {
  document.documentElement.style.setProperty('--ad-h', visible ? `${heightPx}px` : '0px');
});
```

`Ads.bannerHeight()` returns the same number synchronously if you need it.

---

## 3. Interstitial

`Ads.maybeShowInterstitial()` → `Promise<boolean>` (true only if one was
actually displayed). It self-limits to **once per local calendar day** via
`KEYS.lastInterstitialDay`, and records the day **only after a confirmed show**,
so a failed load never burns the day's single slot.

Show it in exactly one place: **a cold start, after the first paint has
settled, when nothing else is happening.** The current guard is

- not the first-ever launch (first impression > one impression),
- ~1.4s after boot,
- no sheet open, on the mixer, audio not already running.

**Do not** wire it to `timer:done`, `audio:stopped`, or app resume. Those fire
while the user is asleep or falling asleep.

If it returns `true`, call `reconcileBanner()` afterwards — returning from a
full-screen ad can leave the banner state stale.

---

## 4. Rewarded video (the night pass)

```js
const earned = await Ads.showRewarded();   // Promise<boolean>
if (earned) Entitlements.grantNightPass(); // expires 11:00 local
```

`true` **only** when AdMob fires the real `Rewarded` event. Dismissal, load
failure, show failure, or 30 seconds of silence all resolve `false`. There is a
hard 30s timeout so a wedged SDK can never wedge the paywall sheet. Listeners
are torn down on every path, so repeated opens do not leak.

Gate the button on `Ads.isAvailable()` and show an honest "not available right
now" when it is false, rather than a button that does nothing.

---

## 5. Premium suppression

`Ads` reads `Entitlements.isPremium()` live inside its internal `canServe()`
guard, so **the moment premium is granted, every ad path is already dead** —
no wiring required. `Ads.setAdsDisabled(true)` exists as an explicit override
(it also hides a live banner immediately) but is belt-and-braces.

You still want `reconcileBanner()` on `entitlements:changed` to tear down a
banner that is already on screen.

To demo the premium UI tonight without a Play Console:

```js
Billing.__grantPremiumForTesting(true);
// or, from a connected DevTools console (chrome://inspect):
window.__quietloom.grantPremium(true);
```

---

## 6. Bus events emitted

| Event        | Payload                     | When |
|--------------|-----------------------------|------|
| `ads:banner` | `{ visible, heightPx }`     | Banner shown, hidden, resized by the SDK, or failed to load. Always emitted at least once per `showBanner()`/`hideBanner()` call, **including in a desktop browser** (`{visible:false, heightPx:0}`), so the UI can rely on it unconditionally. |

`ads.js` emits nothing else. `billing.js` emits `entitlements:changed` when the
dev grant flips premium. `native.js` emits nothing.

---

## 7. Native

```js
Native.isNative()            // sync, correct immediately
Native.platform()            // 'android' | 'ios' | 'web'
Native.keepAwake(on)         // Promise<boolean> — true if a wake lock is held
Native.backgroundMode(on)    // Promise<boolean> — see below
Native.openUrl(url)          // http/https only; system browser on device
Native.onBackButton(fn)      // returns unsubscribe; fn returns true if it consumed the press
Native.onAppStateChange(fn)  // returns unsubscribe; fn(isActive)
```

`onBackButton`: return `true` from your handler when you consumed the press
(e.g. you closed a sheet). Return falsy and the app is **minimised**, not
destroyed — someone pressing back at bedtime wants the rain to keep playing.

`keepAwake` and `backgroundMode` share one wake lock via independent request
flags, so turning one off does not stomp the other.

Every method is a silent no-op off-device.

---

## 8. Background audio — the decision

**Decision: no background-mode plugin ships in this build.
`Native.backgroundMode()` degrades to the screen wake lock.**

`@anuradev/capacitor-background-mode@7.2.1` was installed, `cap sync`'d, and its
**merged** manifest inspected. It unions these into our AndroidManifest:

```
android.permission.RECORD_AUDIO                    <- microphone, "dangerous"
android.permission.SYSTEM_ALERT_WINDOW             <- draw over other apps
android.permission.FOREGROUND_SERVICE_MICROPHONE
android.permission.FOREGROUND_SERVICE_SPECIAL_USE
android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
```

plus a service declared `foregroundServiceType="specialUse|microphone"` whose
`PROPERTY_SPECIAL_USE_FGS_SUBTYPE` string claims the app must stay alive
*"to receive messages and calls from third party SIP servers"*. Google reviews
that string by hand at submission, and it is not true of this app.

A sleep app that asks for the **microphone** is a trust catastrophe — users are
in bed — and a near-certain Play review rejection. The Gradle build itself was
fine; the problem is the shipped product. It was uninstalled, `cap sync` re-run,
and the build re-verified clean (dependency tree back to 4 runtime packages).

**What we ship instead:** bedside mode holds a screen wake lock. `main.js`
already calls `Native.keepAwake(true)` + `Native.backgroundMode(true)` on
entering bedside. The screen stays on (the UI dims it to black), so the WebView
is never suspended and the `AudioContext` keeps running. That is the intended
overnight posture anyway, and it needs no extra permission.

**Known limitation:** if the user presses Home or the screen locks, Android may
eventually suspend or kill the WebView and audio stops. There is no media
notification and no lockscreen transport.

**The correct fix, when there is time:** a small first-party Android foreground
service of type `mediaPlayback` driven by a `MediaSession`. The
`FOREGROUND_SERVICE_MEDIA_PLAYBACK` permission is **already declared** in
`AndroidManifest.xml`. It needs no extra permissions, gives a proper lockscreen
transport, and passes Play review. It is a ~150-line Java change in
`android/app/src/main/java/com/quietloom/sleepscapes/`, not a plugin install.

---

## 9. Billing

`isAvailable()` returns `false` and `purchasePremium()` returns
`{ok:false, reason:'unavailable'}` until real billing is wired. The paywall must
branch on `isAvailable()` and show "coming soon" rather than a dead button.

Reasons the UI may receive (`BILLING_REASONS`): `unavailable`, `cancelled`,
`already-owned` (returned with `ok:true`), `nothing-to-restore`, `error`.

Wiring it later is three marked blocks — search `billing.js` for
**`TODO(billing)`**. Each contains the exact code to paste. Product ID is
`quietloom_premium_forever`. Note `cordova-plugin-purchase` attaches to
`window.CdvPurchase`; it is **not** an ES module, so do not `import` it.

---

## 10. Build & run

```powershell
npm run android                          # build + sync + assemble + install + launch
.\scripts\build-apk.ps1 -NoInstall       # build the APK only
.\scripts\build-apk.ps1 -SkipEmulator    # use an attached phone, never boot an AVD
.\scripts\build-apk.ps1 -Clean           # gradlew clean first
.\scripts\run-emulator.ps1               # boot Pixel_9a and wait for sys.boot_completed
```

`build-apk.ps1` forces `JAVA_HOME` to Android Studio's bundled **JBR 21**
(Capacitor 7 will not build on this machine's default JDK 17), sets
`ANDROID_HOME`, and re-checks after `cap sync` that the AdMob
`APPLICATION_ID` meta-data is still in the manifest — losing it crashes the app
at launch, and it is the classic post-sync regression.

APK: `android\app\build\outputs\apk\debug\app-debug.apk`

Both scripts are **ASCII-only on purpose.** Windows PowerShell 5.1 reads a
BOM-less UTF-8 `.ps1` as CP1252, where an em dash's third byte (`0x94`) becomes
a smart quote `”` — which PowerShell treats as a *string delimiter*. One em dash
in a comment will break the whole script with errors pointing 30 lines away.
Keep them ASCII, or save as UTF-8 **with BOM**.

---

## What the owner must do

### Before any public release — blocking

1. **Replace the three test ad unit IDs** in `src/services/ads.js` (`AD_UNITS`,
   marked at the top of the file) with real units from the AdMob console, and
   set `TEST_MODE = false` on the line below them.
2. **Replace the AdMob application ID** in
   `android/app/src/main/AndroidManifest.xml` —
   `com.google.android.gms.ads.APPLICATION_ID` is currently Google's public test
   ID `ca-app-pub-3940256099942544~3347511713`.
   Leaving the test app-ID with real units, or vice versa, means zero revenue.
3. **Delete `Billing.__grantPremiumForTesting()` and the `window.__quietloom` block**
   at the bottom of `src/services/billing.js`. It grants premium to anyone who
   opens DevTools.
4. **AdMob policy:** apps serving ads to EEA/UK users need a consent flow. The
   plugin ships a UMP wrapper (`AdMob.requestConsentInfo()` /
   `showConsentForm()` — see `@capacitor-community/admob`'s consent module).
   Not wired; nothing calls it yet.
5. **Play Data Safety form** must declare the AdMob SDK's advertising-ID
   collection. The `com.google.android.gms.permission.AD_ID` permission is
   already declared.
6. Release builds need a real signing config — `android/app/build.gradle` has
   only the debug default.

### Known environment issues on this machine

- **Test ads cannot fill on this emulator.** Norton's TLS interception re-signs
  HTTPS with `CN=Norton Web/Mail Shield Root`, which the emulator's 149-cert
  system trust store does not contain. *Every* HTTPS client inside the emulator
  fails with `ERR_CERT_AUTHORITY_INVALID` (`net_error -202`) — the Google Play
  Store itself cannot sync. The Ads SDK therefore reports
  `Ad failed to load : 0` (INTERNAL_ERROR).
  This is **not** an app bug: the request path is verified correct
  (right unit IDs, `isTesting:true`, adaptive banner, bottom-center) and the app
  degrades gracefully. To see a real test ad, either turn off Norton's HTTPS
  scanning, install its root into the emulator's system store, or **install the
  APK on a real phone on a network Norton is not intercepting** — easiest by far.
- **`scripts/fix-truststore.ps1` currently does not parse** (3 syntax errors) —
  it has the em-dash/CP1252 problem described above, on lines 8, 22 and 46.
  Replace its em dashes with `-` and it will run. Worth fixing before you need
  it, because you will only need it when the build is already broken.
- Gradle's build cache is deliberately **off** in `android/gradle.properties`;
  on Windows with AV active it fails packing the dex tree.
