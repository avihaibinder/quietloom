/**
 * AdMob integration — Drift / Sleepscapes.
 *
 * FROZEN CONTRACT. Every method below is called by the UI layer and MUST be
 * safe to call anywhere, including a desktop browser with no Capacitor at all.
 * Nothing in this file is allowed to throw: an ad failure is never a reason for
 * a sleep app to break.
 *
 * Public API (do not change):
 *   Ads.init()                    -> Promise<void>
 *   Ads.isAvailable()             -> boolean
 *   Ads.showBanner()              -> Promise<void>   emits bus 'ads:banner'
 *   Ads.hideBanner()              -> Promise<void>   emits bus 'ads:banner'
 *   Ads.maybeShowInterstitial()   -> Promise<boolean>  (max once per calendar day)
 *   Ads.showRewarded()            -> Promise<boolean>  (true ONLY on real reward)
 *   Ads.setAdsDisabled(bool)      -> void            (premium kill switch)
 *
 * Product rules encoded here (see research.md — ads are banned from sleep
 * surfaces because an unexpected loud ad at 23:50 is an actual harm):
 *   - The banner is only ever shown where the caller asks for it. This module
 *     never shows one on its own, and it refuses entirely once premium is on.
 *   - At most ONE interstitial per local calendar day, and never while premium.
 *   - The rewarded ad is the only ad the user opts into; it hard-times-out
 *     after 30s so a stalled SDK can never wedge the unlock flow.
 */

import { Capacitor } from '@capacitor/core';
import { bus } from '../core/bus.js';
import { KEYS, read, write } from '../core/store.js';
import { Entitlements } from './entitlements.js';

/* ------------------------------------------------------------------------ *
 * AD UNIT IDS
 *
 * These are Google's OFFICIAL TEST unit IDs. They always fill, they never earn
 * money, and they are safe to ship to an emulator or a test device.
 *
 * >>> REPLACE ALL THREE WITH THE REAL UNITS FROM THE ADMOB CONSOLE BEFORE  <<<
 * >>> A PRODUCTION RELEASE, AND ALSO REPLACE THE APPLICATION_ID META-DATA  <<<
 * >>> IN android/app/src/main/AndroidManifest.xml.                         <<<
 *
 * Also flip TEST_MODE to false at the same time.
 * ------------------------------------------------------------------------ */
export const AD_UNITS = {
  banner: 'ca-app-pub-3940256099942544/6300978111', // TEST banner
  interstitial: 'ca-app-pub-3940256099942544/1033173712', // TEST interstitial
  rewarded: 'ca-app-pub-3940256099942544/5224354917', // TEST rewarded video
};

/** While true, every request is flagged as a test request. Flip with AD_UNITS. */
const TEST_MODE = true;

/** Fallback banner height when the plugin never reports a real one. */
const FALLBACK_BANNER_HEIGHT_PX = 60;

/** A rewarded ad that has not paid out within this window is a failed unlock. */
const REWARDED_TIMEOUT_MS = 30_000;

/* ------------------------------------------------------------------------ *
 * Lazy, failure-tolerant plugin loading.
 *
 * @capacitor/core is static (safe on web, and needed synchronously). The AdMob
 * module itself is imported dynamically so a desktop browser never evaluates
 * it and a bad plugin can never take the boot down.
 * ------------------------------------------------------------------------ */

let AdMob = null;
let E = null; // { BannerAdSize, BannerAdPosition, BannerAdPluginEvents, InterstitialAdPluginEvents, RewardAdPluginEvents }

let initialised = false; // init() ran to completion on a native platform
let initFailed = false; // init() threw — treat the whole module as unavailable
let adsDisabled = false; // explicit kill switch (premium)

let bannerVisible = false;
let bannerHeightPx = 0;
let bannerListeners = []; // PluginListenerHandle[]

/** Guards against two overlapping rewarded flows. */
let rewardedInFlight = false;

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
let lastRewardedFailure = null;
/** Guards against two overlapping interstitial flows. */
let interstitialInFlight = false;

/** True when we are running inside a Capacitor native shell. */
function isNativeShell() {
  try {
    return !!Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** Every ad path funnels through this. If it is false, the call is a no-op. */
function canServe() {
  if (adsDisabled) return false;
  if (!initialised || initFailed) return false;
  if (!isNativeShell() || !AdMob) return false;
  try {
    if (Entitlements.isPremium()) return false;
  } catch {
    /* entitlements unavailable — fall through, ads are allowed */
  }
  return true;
}

/** Local calendar day as 'YYYY-MM-DD'. Local, not UTC: "today" is the user's. */
function todayKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emitBanner() {
  bus.emit('ads:banner', {
    visible: bannerVisible,
    heightPx: bannerVisible ? bannerHeightPx || FALLBACK_BANNER_HEIGHT_PX : 0,
  });
}

/** Remove a set of PluginListenerHandles, tolerating any shape/failure. */
async function removeHandles(handles) {
  for (const h of handles) {
    try {
      await h?.remove?.();
    } catch {
      /* ignore */
    }
  }
}

/**
 * addListener that never rejects. Returns a handle or null.
 * Collect the results and pass them to removeHandles() — this is how we keep
 * repeated rewarded/interstitial opens from leaking listeners.
 */
async function listen(event, fn) {
  try {
    return await AdMob.addListener(event, fn);
  } catch (err) {
    console.warn('[ads] addListener failed', event, err);
    return null;
  }
}

/* ------------------------------------------------------------------------ */

export const Ads = {
  /**
   * Load the plugin and initialise the SDK. Safe to call more than once.
   * Off-device this resolves immediately and leaves isAvailable() false.
   */
  async init() {
    if (initialised || initFailed) return;

    if (!isNativeShell()) {
      console.info('[ads] not a native platform — ads disabled');
      initFailed = true;
      return;
    }

    try {
      const mod = await import('@capacitor-community/admob');
      AdMob = mod.AdMob;
      E = {
        BannerAdSize: mod.BannerAdSize,
        BannerAdPosition: mod.BannerAdPosition,
        BannerAdPluginEvents: mod.BannerAdPluginEvents,
        InterstitialAdPluginEvents: mod.InterstitialAdPluginEvents,
        RewardAdPluginEvents: mod.RewardAdPluginEvents,
        MaxAdContentRating: mod.MaxAdContentRating,
      };

      await AdMob.initialize({
        initializeForTesting: TEST_MODE,
        testingDevices: [],
        // A sleep app is used by (and near) all ages. Keep the inventory tame.
        maxAdContentRating: E.MaxAdContentRating?.General ?? 'General',
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });

      initialised = true;
      console.info('[ads] AdMob initialised (test mode =', TEST_MODE, ')');
    } catch (err) {
      console.warn('[ads] AdMob init failed — running without ads', err);
      initFailed = true;
      AdMob = null;
    }
  },

  /** False in a browser, false if init threw, false once premium/disabled. */
  isAvailable() {
    return canServe();
  },

  /**
   * Why the last showRewarded() did not pay out: 'unavailable', 'declined', or
   * null when it did. Callers deciding whether to be generous should branch on
   * this, NOT on isAvailable() — the SDK can be perfectly healthy and still be
   * unable to deliver a single ad.
   *
   * @returns {'unavailable'|'declined'|null}
   */
  lastRewardedFailure() {
    return lastRewardedFailure;
  },

  /**
   * Explicit kill switch. Call with true when the user becomes premium.
   * Hides any live banner immediately.
   */
  setAdsDisabled(on) {
    adsDisabled = !!on;
    if (adsDisabled && bannerVisible) {
      // Fire and forget — hideBanner is itself fully guarded.
      this.hideBanner();
    }
  },

  /** Current banner height in CSS px (0 when hidden). Handy for layout code. */
  bannerHeight() {
    return bannerVisible ? bannerHeightPx || FALLBACK_BANNER_HEIGHT_PX : 0;
  },

  /**
   * Show the adaptive bottom banner. Emits 'ads:banner' with the real reported
   * height once the SDK knows it, so the UI can reserve exactly that much space.
   */
  async showBanner() {
    if (!canServe()) {
      bannerVisible = false;
      bannerHeightPx = 0;
      emitBanner();
      return;
    }

    try {
      // Listeners are attached once and reused for the life of the banner.
      if (bannerListeners.length === 0) {
        const onSize = (size) => {
          const h = Number(size?.height);
          // The plugin reports height 0 when the banner is torn down.
          if (Number.isFinite(h) && h > 0) {
            bannerHeightPx = Math.round(h);
            if (bannerVisible) emitBanner();
          }
        };
        const onLoaded = () => {
          bannerVisible = true;
          emitBanner();
        };
        const onFailed = (err) => {
          console.warn('[ads] banner failed to load', err);
          bannerVisible = false;
          bannerHeightPx = 0;
          emitBanner();
        };

        bannerListeners = (
          await Promise.all([
            listen(E.BannerAdPluginEvents.SizeChanged, onSize),
            listen(E.BannerAdPluginEvents.Loaded, onLoaded),
            listen(E.BannerAdPluginEvents.FailedToLoad, onFailed),
          ])
        ).filter(Boolean);
      }

      await AdMob.showBanner({
        adId: AD_UNITS.banner,
        adSize: E.BannerAdSize.ADAPTIVE_BANNER,
        position: E.BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: TEST_MODE,
      });

      // Optimistic: emit now with the fallback so layout does not jump later.
      bannerVisible = true;
      emitBanner();
    } catch (err) {
      console.warn('[ads] showBanner failed', err);
      bannerVisible = false;
      bannerHeightPx = 0;
      emitBanner();
    }
  },

  /**
   * Hide and destroy the banner. Always emits {visible:false, heightPx:0} so a
   * caller can rely on the event even in a browser.
   */
  async hideBanner() {
    const wasNative = isNativeShell() && !!AdMob && initialised && !initFailed;
    // Nothing was ever put on screen, so there is nothing to take down. Without
    // this the plugin throws "you tried to hide a banner that was never shown"
    // on every screen change before the first fill, which buries real errors.
    const everRequested = bannerListeners.length > 0;
    bannerVisible = false;
    bannerHeightPx = 0;

    if (wasNative && everRequested) {
      try {
        await AdMob.hideBanner();
      } catch (err) {
        console.warn('[ads] hideBanner failed', err);
      }
      try {
        await AdMob.removeBanner();
      } catch {
        /* already gone */
      }
      await removeHandles(bannerListeners);
      bannerListeners = [];
    }

    emitBanner();
  },

  /**
   * At most one interstitial per local calendar day. Records the day only after
   * the SDK confirms the ad was actually shown, so a failed load does not burn
   * the day's single slot.
   *
   * @returns {Promise<boolean>} true if an interstitial was actually displayed
   */
  async maybeShowInterstitial() {
    if (!canServe()) return false;
    if (interstitialInFlight) return false;

    const today = todayKey();
    if (read(KEYS.lastInterstitialDay, null) === today) return false;

    interstitialInFlight = true;
    const handles = [];
    try {
      let shown = false;
      let settled = false;

      const done = new Promise((resolve) => {
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };

        Promise.all([
          listen(E.InterstitialAdPluginEvents.Showed, () => {
            shown = true;
            // Do not resolve yet — wait for Dismissed so the caller knows the
            // user is back before it resumes anything.
          }),
          listen(E.InterstitialAdPluginEvents.Dismissed, () => finish(shown)),
          listen(E.InterstitialAdPluginEvents.FailedToShow, (err) => {
            console.warn('[ads] interstitial failed to show', err);
            finish(false);
          }),
        ]).then((hs) => handles.push(...hs.filter(Boolean)));

        // Safety net: never leave the caller awaiting forever.
        setTimeout(() => finish(shown), REWARDED_TIMEOUT_MS);
      });

      await AdMob.prepareInterstitial({
        adId: AD_UNITS.interstitial,
        isTesting: TEST_MODE,
      });
      await AdMob.showInterstitial();

      const ok = await done;
      if (ok) write(KEYS.lastInterstitialDay, today);
      return ok;
    } catch (err) {
      console.warn('[ads] interstitial unavailable', err);
      return false;
    } finally {
      await removeHandles(handles);
      interstitialInFlight = false;
    }
  },

  /**
   * The opt-in rewarded video behind the night pass.
   *
   * Resolves TRUE only when AdMob fires the actual Rewarded event. A dismissal,
   * a load failure, a show failure, or 30 seconds of silence all resolve FALSE.
   * Listeners are always torn down, so this is safe to call repeatedly.
   *
   * @returns {Promise<boolean>}
   */
  async showRewarded() {
    if (!canServe()) {
      lastRewardedFailure = 'unavailable';
      return false;
    }
    if (rewardedInFlight) {
      lastRewardedFailure = 'unavailable';
      return false;
    }

    rewardedInFlight = true;
    lastRewardedFailure = 'unavailable'; // until something proves otherwise
    const handles = [];
    let timer = null;

    try {
      let rewarded = false;
      let settled = false;
      let resolveDone;
      const done = new Promise((res) => {
        resolveDone = res;
      });

      const finish = (ok, reason = 'unavailable') => {
        if (settled) return;
        settled = true;
        lastRewardedFailure = ok ? null : reason;
        resolveDone(ok);
      };

      const attached = await Promise.all([
        listen(E.RewardAdPluginEvents.Rewarded, (item) => {
          // This is the ONLY event that earns the unlock.
          console.info('[ads] reward earned', item);
          rewarded = true;
          finish(true);
        }),
        listen(E.RewardAdPluginEvents.Dismissed, () => {
          // Order is not guaranteed; if Rewarded already fired we keep true.
          // Reaching here without a reward means an ad really played and they
          // closed it early — the one case that is a genuine decline.
          finish(rewarded, 'declined');
        }),
        listen(E.RewardAdPluginEvents.FailedToShow, (err) => {
          console.warn('[ads] rewarded failed to show', err);
          finish(false);
        }),
        listen(E.RewardAdPluginEvents.FailedToLoad, (err) => {
          console.warn('[ads] rewarded failed to load', err);
          finish(false);
        }),
      ]);
      handles.push(...attached.filter(Boolean));

      // Hard timeout. A wedged SDK must never wedge the unlock sheet.
      timer = setTimeout(() => {
        console.warn('[ads] rewarded timed out after', REWARDED_TIMEOUT_MS, 'ms');
        finish(false);
      }, REWARDED_TIMEOUT_MS);

      await AdMob.prepareRewardVideoAd({
        adId: AD_UNITS.rewarded,
        isTesting: TEST_MODE,
      });

      // showRewardVideoAd resolves with the reward item on some platforms.
      // Treat that as corroboration, but the event above remains the source
      // of truth so we never grant on a stale/empty resolution.
      AdMob.showRewardVideoAd()
        .then((item) => {
          if (item && Number(item.amount) > 0) {
            rewarded = true;
            finish(true);
          }
        })
        .catch((err) => {
          console.warn('[ads] showRewardVideoAd rejected', err);
          finish(false);
        });

      return await done;
    } catch (err) {
      console.warn('[ads] rewarded unavailable', err);
      return false;
    } finally {
      if (timer) clearTimeout(timer);
      await removeHandles(handles);
      rewardedInFlight = false;
    }
  },

  /** Test helper: clears the once-per-day interstitial lock. Dev only. */
  __resetInterstitialDay() {
    write(KEYS.lastInterstitialDay, null);
  },
};
