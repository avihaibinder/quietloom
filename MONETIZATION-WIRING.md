# Monetization wiring

How `ads.ts`, `native.ts` and `billing.ts` connect to the rest of Quietloom, what
they promise, and what the app owner still has to do.

Status as of this build: **`App.tsx` and `src/ui/` are already wired against
this contract.** The sections below are the reference, not a to-do list — except
for [What the owner must do](#what-the-owner-must-do).

The public APIs here survived the move from Capacitor to React Native unchanged.
Where the platform forced a difference it is called out inline.

---

## 1. Boot order

Monetization comes up *behind* the UI. A slow or failed ad SDK must never be
visible to someone who just wants rain.

```ts
import { Ads }          from './src/services/ads';
import { Native }       from './src/services/native';
import { Billing }      from './src/services/billing';
import { Entitlements } from './src/services/entitlements';
```

1. `hydrate()` the store, restore the session, render.
2. `Billing.init()` — fire and forget, `.catch()` it. Currently a no-op.
3. `Ads.init()` — fire and forget, `.catch()` it. Then, in `.then()`:
   `reconcileBanner()` and `await maybeOpeningInterstitial()`.

Never `await` either init on the critical path to first paint.

`Native` needs no init. `Native.isNative()` is synchronous and correct on the
very first call — it reads `Platform.OS`.

---

## 2. Banner

One rule, one function. Every state change funnels through `reconcileBanner()`:

```ts
const allowed = onMixerScreen && !anyLayerOpen() && !Entitlements.isPremium();
allowed ? await Ads.showBanner() : await Ads.hideBanner();
```

Call it on: `screen:changed`, `entitlements:changed`, any layer push/pop
(`subscribeLayers`), and once after `Ads.init()` resolves.

**Never show a banner on bedside or breathing.** See `research.md`: an ad on a
sleep surface is a real harm, not just a taste question.

### The one architectural difference from the web build

`react-native-google-mobile-ads` renders the banner as a **React component**,
not an SDK-positioned native overlay floating above a WebView. So:

- `ads.ts` holds the caller's intent (`showBanner()` / `hideBanner()`) plus the
  measured height, and still emits `ads:banner` with the same payload.
- `AdBanner.tsx` turns that into pixels. It renders `null` unless the module
  state says visible **and** ads may serve, so premium tears it down instantly.
- `App.tsx` pins it directly above the transport bar.

This removes a whole class of web-era bug: the banner can no longer paint on top
of an open sheet, because it is inside the tree and below the sheet.

### Reserving space

Listen for the bus event and pad the layout — do not hardcode 60px:

```ts
useBusEvent('ads:banner', ({ visible, heightPx }) =>
  setBannerH(visible ? Math.max(0, heightPx) : 0),
);
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
- no layer open, on the mixer, audio not already running.

**Do not** wire it to `timer:done`, `audio:stopped`, or app resume. Those fire
while the user is asleep or falling asleep.

If it returns `true`, call `reconcileBanner()` afterwards — returning from a
full-screen ad can leave the banner state stale.

---

## 4. Rewarded video (the night pass)

```ts
const earned = await Ads.showRewarded();   // Promise<boolean>
if (earned) Entitlements.grantNightPass(); // expires 11:00 local
```

`true` **only** when the SDK fires the real `EARNED_REWARD` event. Dismissal,
load failure, show failure, or 30 seconds of silence all resolve `false`. There
is a hard 30s timeout so a wedged SDK can never wedge the paywall sheet.
Listeners are torn down on every path, so repeated opens do not leak.

### The grace rule — deliberate, do not "fix"

`Ads.lastRewardedFailure()` returns `'unavailable' | 'declined' | null`.
`'declined'` means an ad genuinely played and the user closed it early. That is
the **only** case the paywall treats as a refusal; every other failure grants
the pass anyway.

Branch on this, never on `Ads.isAvailable()` — the SDK reports itself available
as soon as it initialises, which stays true when the network cannot deliver a
single impression. Nobody gets locked out of falling asleep because an ad server
was having a bad night.

---

## 5. Premium suppression

`Ads` reads `Entitlements.isPremium()` live inside its internal `canServe()`
guard, so **the moment premium is granted, every ad path is already dead** —
no wiring required. `Ads.setAdsDisabled(true)` exists as an explicit override
(it also hides a live banner immediately) but is belt-and-braces.

You still want `reconcileBanner()` on `entitlements:changed` to tear down a
banner that is already on screen.

To demo the premium UI without a Play Console, in a dev build:

```ts
Billing.__grantPremiumForTesting(true);
// or, from a connected debugger console:
globalThis.__quietloom.grantPremium(true);
```

---

## 6. Bus events emitted

| Event        | Payload                     | When |
|--------------|-----------------------------|------|
| `ads:banner` | `{ visible, heightPx }`     | Banner shown, hidden, measured, or failed to load. Always emitted at least once per `showBanner()`/`hideBanner()` call, **including when ads cannot serve at all** (`{visible:false, heightPx:0}`), so the UI can rely on it unconditionally. |

`ads.ts` emits nothing else. `billing.ts` emits `entitlements:changed` when the
dev grant flips premium. `native.ts` emits nothing.

---

## 7. Native

```ts
Native.isNative()            // sync, correct immediately
Native.platform()            // 'android' | 'ios' | 'web'
Native.keepAwake(on)         // Promise<boolean> — true if a wake lock is held
Native.backgroundMode(on)    // Promise<boolean> — see below
Native.openUrl(url)          // http/https only; in-app browser
Native.onBackButton(fn)      // returns unsubscribe; fn returns true if it consumed the press
Native.onAppStateChange(fn)  // returns unsubscribe; fn(isActive)
```

`onBackButton`: return `true` from your handler when you consumed the press
(e.g. you closed a sheet). Return falsy and the system default happens — on a
root activity that moves the task to the back rather than destroying it, so
someone pressing back at bedtime keeps the rain playing.

`keepAwake` and `backgroundMode` share one wake lock via independent request
flags, so turning one off does not stomp the other.

---

## 8. Background audio — RESOLVED

**This was the biggest known gap in the Capacitor build. React Native closed it.**

`react-native-audio-api` provides a first-party Android foreground service of
type `mediaPlayback`, an iOS `audio` background mode, and a lock-screen media
notification with working transport controls. It is configured declaratively in
[`app.json`](app.json) and wired in `src/audio/background.ts`:

- audio session options (`playback` category),
- interruption observation,
- `PlaybackNotificationManager` showing the enabled layers as the "artist" line,
  hidden on stop — a stopped sleep app should leave no notification behind,
- pause/play/stop from the notification driving `engine.stop()` / `engine.start()`.

**Crucially, it needs no microphone permission.** That was the whole reason the
Capacitor plugin was rejected: `@anuradev/capacitor-background-mode@7.2.1`
unioned `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` and
`FOREGROUND_SERVICE_MICROPHONE` into the manifest, and declared a foreground
service whose reviewer-facing string claimed the app talks to third-party SIP
servers. A sleep app asking for the microphone is a trust catastrophe and a
near-certain Play rejection.

**Keep it that way.** No recording API is referenced anywhere in `src/audio/`,
and nothing should introduce one. `AudioManager` exposes recording-permission
helpers; they are not for us.

Bedside mode still holds the screen wake lock. That is now a comfort feature —
the dimmed red clock is the intended overnight posture — rather than the only
thing keeping audio alive.

---

## 9. Billing

`isAvailable()` returns `false` and `purchasePremium()` returns
`{ok:false, reason:'unavailable'}` until real billing is wired. The paywall must
branch on `isAvailable()` and show "coming soon" rather than a dead button.

Reasons the UI may receive (`BILLING_REASONS`): `unavailable`, `cancelled`,
`already-owned` (returned with `ok:true`), `nothing-to-restore`, `error`.

Wiring it later is three marked blocks — search `src/services/billing.ts` for
**`TODO(billing)`**. Each contains the code to paste, targeting
`react-native-iap` (`npx expo install react-native-iap`, then a dev build — it
will not run in Expo Go). Product ID is `quietloom_premium_forever`, a
non-consumable.

---

## 10. Build & run

```powershell
npm install
npx expo prebuild --platform android   # regenerate android/ from app.json
npx expo run:android                   # build, install, launch
.\scripts\run-emulator.ps1             # boot Pixel_9a and wait for sys.boot_completed
```

Use the Pixel_9a AVD specifically: it ships Google Play services, and AdMob will
not serve even test ads on a plain AOSP image.

`android/` is generated and git-ignored. The AdMob application IDs live in the
`react-native-google-mobile-ads` plugin block of `app.json`, which is what writes
them into the manifest — so the classic Capacitor regression (losing the
`APPLICATION_ID` meta-data on re-sync and crashing at launch) cannot happen here.
Any manifest edit made by hand is thrown away on the next prebuild.

Both PowerShell scripts are **ASCII-only on purpose.** Windows PowerShell 5.1
reads a BOM-less UTF-8 `.ps1` as CP1252, where an em dash's third byte (`0x94`)
becomes a smart quote which PowerShell treats as a *string delimiter*. One em
dash in a comment breaks the whole script with errors pointing 30 lines away.
Keep them ASCII, or save as UTF-8 **with BOM**.

---

## What the owner must do

### Before any public release — blocking

1. **Replace the three test ad unit IDs** in `src/services/ads.ts` (`AD_UNITS`,
   marked at the top of the file) with real units from the AdMob console, and
   set `TEST_MODE = false` on the line below them.
2. **Replace the AdMob application IDs** in the
   `react-native-google-mobile-ads` plugin block of `app.json` — currently
   Google's public test IDs. Leaving a test app-ID with real units, or vice
   versa, means zero revenue.
3. **Confirm the dev backdoor is absent from the release bundle.**
   `Billing.__grantPremiumForTesting()` and the `globalThis.__quietloom` block
   are gated on `__DEV__`, which Metro replaces with `false` and strips in a
   production build. Verify it rather than assume it — the web build's
   equivalent was checked against the shipped bundle, and this one should be too.
4. **AdMob policy:** apps serving ads to EEA/UK/Swiss users need a consent flow.
   `react-native-google-mobile-ads` bundles the UMP SDK
   (`AdsConsent.requestInfoUpdate()` / `showForm()`). **Not wired; nothing calls
   it yet.** This is both a policy problem and lost revenue (non-personalised
   ads only) — fix before launching in Europe.
5. **Play Data Safety form** must declare the AdMob SDK's advertising-ID
   collection.
6. Release builds need a real signing config and an upload keystore.

### Known environment issues on this machine

- **Test ads may not fill on this emulator.** Norton's TLS interception re-signs
  HTTPS with `CN=Norton Web/Mail Shield Root`, which the emulator's system trust
  store does not contain, so *every* HTTPS client inside the emulator fails
  certificate validation — the Play Store itself cannot sync. The Ads SDK then
  reports a load failure that is **not** an app bug. To see a real test ad,
  either turn off Norton's HTTPS scanning, install its root into the emulator's
  system store, or **install on a real phone on a normal network** — easiest by
  far, and still the single most valuable unverified thing on the list.
- Gradle's build cache should stay **off** on this machine; with AV active it
  intermittently fails packing the dex tree.
