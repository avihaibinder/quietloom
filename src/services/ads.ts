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

import { Platform } from 'react-native';
import mobileAds, {
  AdEventType,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

import { bus } from '../core/bus';
import { KEYS, read, write } from '../core/store';
import { Entitlements } from './entitlements';

/* ------------------------------------------------------------------------ *
 * AD UNIT IDS
 *
 * These are Google's OFFICIAL TEST unit IDs (via TestIds). They always fill,
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
  banner: TestIds.ADAPTIVE_BANNER, // TEST banner
  interstitial: TestIds.INTERSTITIAL, // TEST interstitial
  rewarded: TestIds.REWARDED, // TEST rewarded video
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

    try {
      await mobileAds().setRequestConfiguration({
        // A sleep app is used by (and near) all ages. Keep the inventory tame.
        maxAdContentRating: MaxAdContentRating.G,
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

    interstitialInFlight = true;
    const cleanups: Array<() => void> = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      const ad = InterstitialAd.createForAdRequest(AD_UNITS.interstitial);

      let shown = false;
      let settled = false;

      const ok = await new Promise<boolean>((resolve) => {
        const finish = (didShow: boolean) => {
          if (settled) return;
          settled = true;
          resolve(didShow);
        };

        cleanups.push(
          ad.addAdEventListener(AdEventType.LOADED, () => {
            ad.show().catch((err: unknown) => {
              console.warn('[ads] interstitial failed to show', err);
              finish(false);
            });
          }),
          ad.addAdEventListener(AdEventType.OPENED, () => {
            shown = true;
            // Do not resolve yet — wait for CLOSED so the caller knows the
            // user is back before it resumes anything.
          }),
          ad.addAdEventListener(AdEventType.CLOSED, () => finish(shown)),
          ad.addAdEventListener(AdEventType.ERROR, (err: Error) => {
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

    rewardedInFlight = true;
    lastRewardedFailure = 'unavailable'; // until something proves otherwise
    const cleanups: Array<() => void> = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      const ad = RewardedAd.createForAdRequest(AD_UNITS.rewarded);

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
          ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
            ad.show().catch((err: unknown) => {
              console.warn('[ads] rewarded failed to show', err);
              finish(false);
            });
          }),
          ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
            // This is the ONLY event that earns the unlock.
            console.info('[ads] reward earned', reward);
            rewarded = true;
            finish(true);
          }),
          ad.addAdEventListener(AdEventType.CLOSED, () => {
            // Order is not guaranteed; if EARNED_REWARD already fired we keep
            // true. Reaching here without a reward means an ad really played
            // and they closed it early — the one case that is a genuine
            // decline.
            finish(rewarded, 'declined');
          }),
          ad.addAdEventListener(AdEventType.ERROR, (err: Error) => {
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
