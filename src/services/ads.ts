/**
 * AdMob integration — Quietloom (react-native-google-mobile-ads).
 *
 * FROZEN CONTRACT. Every method below is called by the UI layer and MUST be
 * safe to call anywhere, including web (`expo start --web`). Nothing in this
 * file is allowed to throw: an ad failure is never a reason for a sleep app to
 * break.
 *
 * Public API (do not change):
 *   Ads.init()                    -> Promise<void>
 *   Ads.isAvailable()             -> boolean
 *   Ads.lastRewardedFailure()     -> 'unavailable' | 'declined' | null
 *   Ads.showBanner()              -> Promise<void>   emits bus 'ads:banner'
 *   Ads.hideBanner()              -> Promise<void>   emits bus 'ads:banner'
 *   Ads.maybeShowInterstitial()   -> Promise<boolean>  (max once per calendar day)
 *   Ads.showRewarded()            -> Promise<boolean>  (true ONLY on real reward)
 *   Ads.setAdsDisabled(bool)      -> void            (premium kill switch)
 *   Ads.bannerHeight()            -> number
 *
 * Product rules encoded here (see research.md — ads are banned from sleep
 * surfaces because an unexpected loud ad at 23:50 is an actual harm):
 *   - The banner is only ever shown where the caller asks for it. This module
 *     never shows one on its own, and it refuses entirely once premium is on.
 *   - At most ONE interstitial per local calendar day, and never while premium.
 *   - The rewarded ad is the only ad the user opts into; it hard-times-out
 *     after 30s so a stalled SDK can never wedge the unlock flow.
 *
 * RN ARCHITECTURE NOTE. With react-native-google-mobile-ads the banner is a
 * React COMPONENT (<BannerAd/>), not an SDK-positioned overlay like the
 * Capacitor plugin's. So this module no longer talks to a native banner view:
 * it keeps the caller's intent ({ desiredVisible, bannerHeightPx }) plus a
 * tiny subscription, and <AdBanner/> (AdBanner.tsx) renders/unmounts the real
 * component off that state and reports the measured height back here. The bus
 * event 'ads:banner' and every public method behave exactly as on web.
 */

import { Platform, TurboModuleRegistry } from 'react-native';

// The SDK is loaded LAZILY, never at module scope. This is not a style
// preference — it is load-bearing, and the web build did the same thing for
// the same reason ("a bad plugin can never take the boot down").
//
// react-native-google-mobile-ads calls TurboModuleRegistry.getEnforcing() the
// moment it is evaluated, which THROWS if the native module is missing. A
// static import therefore turns any ad-SDK problem into a white screen before
// a single line of Quietloom runs: no rain, no scenes, no UI. An app whose
// whole job is to help someone sleep must not be taken down by an ad network.
//
// Type-only imports are erased at compile time and cannot trigger that.
type AdsSdk = typeof import('react-native-google-mobile-ads');

let sdk: AdsSdk | null = null;

/**
 * Is the SDK's native half actually in this binary?
 *
 * This check is what makes the lazy import safe, and wrapping the import in
 * try/catch is NOT a substitute for it. Metro's module loader (guardedLoadModule
 * in metro-runtime/src/polyfills/require.js) runs every module factory inside
 * its own try/catch: on a throw it hands the error to ErrorUtils.reportFatalError
 * and RETURNS, without rethrowing. So a module that blows up on evaluation does
 * not reject the import() that asked for it — it resolves with a hollow exports
 * object, and the catch below never runs. That is how a missing native module
 * used to surface here as a red "Invariant Violation" in the log followed by
 * `undefined is not a function` from init(), instead of the quiet unavailable
 * path this module is built around.
 *
 * `get` is the non-throwing sibling of `getEnforcing`: it returns null for a
 * module that is not registered, which is exactly the question being asked.
 */
function hasNativeAdsModule(): boolean {
  try {
    return TurboModuleRegistry.get('RNGoogleMobileAdsModule') != null;
  } catch {
    return false;
  }
}

/** Resolve the SDK once. Returns null if it is not present or fails to load. */
async function loadSdk(): Promise<AdsSdk | null> {
  if (sdk) return sdk;

  // Ask before importing, so the SDK never gets the chance to throw at all.
  if (!hasNativeAdsModule()) {
    console.info('[ads] ad SDK is not in this build — running without ads');
    return null;
  }

  try {
    const mod = await import('react-native-google-mobile-ads');
    // Belt and braces against the hollow-module case described above: only
    // cache something that actually looks like the SDK.
    if (typeof mod?.default !== 'function') {
      console.warn('[ads] ad SDK loaded but is unusable — running without ads');
      return null;
    }
    sdk = mod;
    return sdk;
  } catch (err) {
    console.warn('[ads] ad SDK unavailable — running without ads', err);
    return null;
  }
}

import { bus } from '../core/bus';
import { KEYS, read, write } from '../core/store';
import { Entitlements } from './entitlements';

/* ------------------------------------------------------------------------ *
 * AD UNIT IDS
 *
 * These are Google's OFFICIAL TEST unit IDs, written out as literals rather
 * than read from the SDK's TestIds constant — that constant would need the
 * module at import time, which is exactly what this file must not do.
 * They always fill,
 * they never earn money, and they are safe to ship to an emulator or a test
 * device.
 *
 * >>> REPLACE ALL THREE WITH THE REAL UNITS FROM THE ADMOB CONSOLE BEFORE  <<<
 * >>> A PRODUCTION RELEASE, AND ALSO REPLACE THE androidAppId / iosAppId   <<<
 * >>> OF THE react-native-google-mobile-ads PLUGIN IN rn/app.json          <<<
 * >>> (currently the Google sample app IDs), THEN REBUILD THE NATIVE APP.  <<<
 *
 * Also flip TEST_MODE to false at the same time.
 * ------------------------------------------------------------------------ */
export const AD_UNITS = {
  banner: 'ca-app-pub-3940256099942544/9214589741', // TEST adaptive banner
  interstitial: 'ca-app-pub-3940256099942544/1033173712', // TEST interstitial
  rewarded: 'ca-app-pub-3940256099942544/5224354917', // TEST rewarded video
};

/**
 * While true, the TestIds above are in play. Unlike the Capacitor plugin
 * there is no per-request `isTesting` flag — the test unit IDs ARE the test
 * mode. Flip together with AD_UNITS.
 */
const TEST_MODE = true;

/** Fallback banner height when no real one has been measured yet. */
const FALLBACK_BANNER_HEIGHT_PX = 60;

/** A rewarded ad that has not paid out within this window is a failed unlock. */
const REWARDED_TIMEOUT_MS = 30_000;

/* ------------------------------------------------------------------------ */

export type RewardedFailure = 'unavailable' | 'declined' | null;

/**
 * THE GRACE RULE, as a pure function.
 *
 * An ad that never loaded is not a decline. Only 'declined' — an ad that really
 * played and was closed early — withholds the night pass; every other failure
 * grants it anyway. This is deliberately generous: locking someone out of
 * falling asleep because our ad network had no fill is a real harm, and the
 * alternative failure mode costs us a few cents.
 *
 * It lives here, extracted and exported, for one reason: this rule was once
 * specified against `Ads.isAvailable()` — which reports that the SDK started,
 * not that an ad can be delivered — was implemented exactly as written, passed
 * review, and silently refused to unlock anything on a device. It is the worst
 * bug history in this repository and it was previously unreachable by any test,
 * because it lived inside a `useCallback` in a sheet component.
 *
 * Additive only: the frozen `Ads` public contract is unchanged.
 */
export function shouldGrantNightPass(earned: boolean, failure: RewardedFailure): boolean {
  return earned || failure !== 'declined';
}

let initialised = false; // init() ran to completion on a native platform
let initFailed = false; // init() threw — treat the whole module as unavailable
let adsDisabled = false; // explicit kill switch (premium)

/** The caller asked for a banner. The component decides if one can render. */
let desiredVisible = false;
/** Last measured banner height, in RN dp (the analogue of CSS px). */
let bannerHeightPx = 0;

/** Guards against two overlapping rewarded flows. */
let rewardedInFlight = false;
/** Guards against two overlapping interstitial flows. */
let interstitialInFlight = false;

/**
 * Why the last rewarded attempt did not pay out.
 *
 *   'unavailable' — no ad could be loaded or shown (no fill, network, timeout,
 *                   wedged SDK). The user did nothing wrong.
 *   'declined'    — an ad really played and they closed it early.
 *   null          — the reward was earned.
 *
 * The paywall needs this distinction: isAvailable() only says the SDK came up,
 * which is true even when the ad network cannot deliver a single impression.
 * Treating a failed load as a decline is how you lock someone out of falling
 * asleep, so the grace rule keys off this instead.
 */
let lastRewardedFailure: RewardedFailure = null;

/** True on a platform where the Google Mobile Ads SDK exists at all. */
function isNativePlatform(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

/** Every ad path funnels through this. If it is false, the call is a no-op. */
function canServe(): boolean {
  if (adsDisabled) return false;
  if (!initialised || initFailed) return false;
  if (!isNativePlatform()) return false;
  try {
    if (Entitlements.isPremium()) return false;
  } catch {
    /* entitlements unavailable — fall through, ads are allowed */
  }
  return true;
}

/** Local calendar day as 'YYYY-MM-DD'. Local, not UTC: "today" is the user's. */
function todayKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emitBanner(): void {
  bus.emit('ads:banner', {
    visible: desiredVisible,
    heightPx: desiredVisible ? bannerHeightPx || FALLBACK_BANNER_HEIGHT_PX : 0,
  });
}

/* ------------------------------------------------------------------------ *
 * Banner state subscription — component-support API, used only by
 * <AdBanner/>. Not part of the frozen Ads contract.
 * ------------------------------------------------------------------------ */

export interface BannerState {
  desiredVisible: boolean;
  bannerHeightPx: number;
}

const bannerSubscribers = new Set<() => void>();

function notifyBanner(): void {
  for (const fn of [...bannerSubscribers]) {
    try {
      fn();
    } catch (err) {
      console.error('[ads] banner subscriber threw', err);
    }
  }
}

/** Subscribe to banner-state changes. Returns an unsubscribe function. */
export function subscribeBanner(fn: () => void): () => void {
  bannerSubscribers.add(fn);
  return () => {
    bannerSubscribers.delete(fn);
  };
}

export function getBannerState(): BannerState {
  return { desiredVisible, bannerHeightPx };
}

/**
 * Called by <AdBanner/> once the loaded banner has been measured, so layout
 * can reserve exactly that much space instead of the fallback guess.
 */
export function reportBannerHeight(px: number): void {
  const h = Math.round(px);
  if (!Number.isFinite(h) || h <= 0) return; // 0 = torn down, not a real size
  if (h === bannerHeightPx) return;
  bannerHeightPx = h;
  notifyBanner();
  if (desiredVisible) emitBanner();
}

/**
 * Called by <AdBanner/> when the ad failed to load: give the space back to
 * the layout. The next showBanner() remounts the component for a fresh try.
 */
export function reportBannerFailed(): void {
  desiredVisible = false;
  bannerHeightPx = 0;
  notifyBanner();
  emitBanner();
}

/* ------------------------------------------------------------------------ */

export const Ads = {
  /**
   * Initialise the SDK. Safe to call more than once. Off-device this resolves
   * immediately and leaves isAvailable() false.
   */
  async init(): Promise<void> {
    if (initialised || initFailed) return;

    if (!isNativePlatform()) {
      console.info('[ads] not a native platform — ads disabled');
      initFailed = true;
      return;
    }

    const mod = await loadSdk();
    if (!mod) {
      initFailed = true;
      return;
    }

    try {
      const mobileAds = mod.default;
      await mobileAds().setRequestConfiguration({
        // A sleep app is used by (and near) all ages. Keep the inventory tame.
        maxAdContentRating: mod.MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
      await mobileAds().initialize();

      initialised = true;
      console.info('[ads] Google Mobile Ads initialised (test mode =', TEST_MODE, ')');
    } catch (err) {
      console.warn('[ads] ads init failed — running without ads', err);
      initFailed = true;
    }
  },

  /** False in a browser, false if init threw, false once premium/disabled. */
  isAvailable(): boolean {
    return canServe();
  },

  /**
   * Why the last showRewarded() did not pay out: 'unavailable', 'declined', or
   * null when it did. Callers deciding whether to be generous should branch on
   * this, NOT on isAvailable() — the SDK can be perfectly healthy and still be
   * unable to deliver a single ad.
   */
  lastRewardedFailure(): RewardedFailure {
    return lastRewardedFailure;
  },

  /**
   * Explicit kill switch. Call with true when the user becomes premium.
   * Hides any live banner immediately.
   */
  setAdsDisabled(on: boolean): void {
    adsDisabled = !!on;
    if (adsDisabled && desiredVisible) {
      // Fire and forget — hideBanner is itself fully guarded.
      void this.hideBanner();
    }
  },

  /** Current banner height in dp (0 when hidden). Handy for layout code. */
  bannerHeight(): number {
    return desiredVisible ? bannerHeightPx || FALLBACK_BANNER_HEIGHT_PX : 0;
  },

  /**
   * Ask for the adaptive bottom banner. <AdBanner/> mounts the real component
   * wherever the composition root placed it. Emits 'ads:banner' optimistically
   * with the fallback height (exactly as the web build did), then again with
   * the real measured height once the component reports it.
   */
  async showBanner(): Promise<void> {
    if (!canServe()) {
      desiredVisible = false;
      bannerHeightPx = 0;
      notifyBanner();
      emitBanner();
      return;
    }

    desiredVisible = true;
    notifyBanner();
    // Optimistic: emit now with the fallback so layout does not jump later.
    emitBanner();
  },

  /**
   * Hide the banner (the component unmounts). Always emits
   * {visible:false, heightPx:0} so a caller can rely on the event even in a
   * browser.
   */
  async hideBanner(): Promise<void> {
    desiredVisible = false;
    bannerHeightPx = 0;
    notifyBanner();
    emitBanner();
  },

  /**
   * At most one interstitial per local calendar day. Records the day only
   * after the SDK confirms the ad was actually opened, so a failed load does
   * not burn the day's single slot.
   *
   * @returns true if an interstitial was actually displayed
   */
  async maybeShowInterstitial(): Promise<boolean> {
    if (!canServe()) return false;
    if (interstitialInFlight) return false;

    const today = todayKey();
    if (read<string | null>(KEYS.lastInterstitialDay, null) === today) return false;

    // canServe() implies init() completed, so the SDK is already resolved.
    const mod = sdk;
    if (!mod) return false;

    interstitialInFlight = true;
    const cleanups: Array<() => void> = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      const ad = mod.InterstitialAd.createForAdRequest(AD_UNITS.interstitial);

      let shown = false;
      let settled = false;

      const ok = await new Promise<boolean>((resolve) => {
        const finish = (didShow: boolean) => {
          if (settled) return;
          settled = true;
          resolve(didShow);
        };

        cleanups.push(
          ad.addAdEventListener(mod.AdEventType.LOADED, () => {
            ad.show().catch((err: unknown) => {
              console.warn('[ads] interstitial failed to show', err);
              finish(false);
            });
          }),
          ad.addAdEventListener(mod.AdEventType.OPENED, () => {
            shown = true;
            // Do not resolve yet — wait for CLOSED so the caller knows the
            // user is back before it resumes anything.
          }),
          ad.addAdEventListener(mod.AdEventType.CLOSED, () => finish(shown)),
          ad.addAdEventListener(mod.AdEventType.ERROR, (err: Error) => {
            console.warn('[ads] interstitial unavailable', err);
            finish(false);
          }),
        );

        // Safety net: never leave the caller awaiting forever.
        timer = setTimeout(() => finish(shown), REWARDED_TIMEOUT_MS);

        ad.load();
      });

      if (ok) write(KEYS.lastInterstitialDay, today);
      return ok;
    } catch (err) {
      console.warn('[ads] interstitial unavailable', err);
      return false;
    } finally {
      if (timer) clearTimeout(timer);
      for (const off of cleanups) {
        try {
          off();
        } catch {
          /* ignore */
        }
      }
      interstitialInFlight = false;
    }
  },

  /**
   * The opt-in rewarded video behind the night pass.
   *
   * Resolves TRUE only when the SDK fires the actual EARNED_REWARD event. A
   * dismissal, a load failure, a show failure, or 30 seconds of silence all
   * resolve FALSE. Listeners are always torn down, so this is safe to call
   * repeatedly.
   */
  async showRewarded(): Promise<boolean> {
    if (!canServe()) {
      lastRewardedFailure = 'unavailable';
      return false;
    }
    if (rewardedInFlight) {
      lastRewardedFailure = 'unavailable';
      return false;
    }

    const mod = sdk;
    if (!mod) {
      lastRewardedFailure = 'unavailable';
      return false;
    }

    rewardedInFlight = true;
    lastRewardedFailure = 'unavailable'; // until something proves otherwise
    const cleanups: Array<() => void> = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      const ad = mod.RewardedAd.createForAdRequest(AD_UNITS.rewarded);

      let rewarded = false;
      let settled = false;

      return await new Promise<boolean>((resolve) => {
        const finish = (ok: boolean, reason: Exclude<RewardedFailure, null> = 'unavailable') => {
          if (settled) return;
          settled = true;
          lastRewardedFailure = ok ? null : reason;
          resolve(ok);
        };

        cleanups.push(
          ad.addAdEventListener(mod.RewardedAdEventType.LOADED, () => {
            ad.show().catch((err: unknown) => {
              console.warn('[ads] rewarded failed to show', err);
              finish(false);
            });
          }),
          ad.addAdEventListener(mod.RewardedAdEventType.EARNED_REWARD, (reward) => {
            // This is the ONLY event that earns the unlock.
            console.info('[ads] reward earned', reward);
            rewarded = true;
            finish(true);
          }),
          ad.addAdEventListener(mod.AdEventType.CLOSED, () => {
            // Order is not guaranteed; if EARNED_REWARD already fired we keep
            // true. Reaching here without a reward means an ad really played
            // and they closed it early — the one case that is a genuine
            // decline.
            finish(rewarded, 'declined');
          }),
          ad.addAdEventListener(mod.AdEventType.ERROR, (err: Error) => {
            console.warn('[ads] rewarded failed to load/show', err);
            finish(false);
          }),
        );

        // Hard timeout. A wedged SDK must never wedge the unlock sheet.
        timer = setTimeout(() => {
          console.warn('[ads] rewarded timed out after', REWARDED_TIMEOUT_MS, 'ms');
          finish(false);
        }, REWARDED_TIMEOUT_MS);

        ad.load();
      });
    } catch (err) {
      console.warn('[ads] rewarded unavailable', err);
      return false;
    } finally {
      if (timer) clearTimeout(timer);
      for (const off of cleanups) {
        try {
          off();
        } catch {
          /* ignore */
        }
      }
      rewardedInFlight = false;
    }
  },

  /** Test helper: clears the once-per-day interstitial lock. Dev only. */
  __resetInterstitialDay(): void {
    write(KEYS.lastInterstitialDay, null);
  },
};
