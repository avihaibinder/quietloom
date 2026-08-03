/**
 * A working stand-in for the ad NETWORK, not a spy on the ad SDK.
 *
 * WHY THIS EXISTS
 * `src/services/ads.ts` lazily `await import()`s react-native-google-mobile-ads
 * only after `TurboModuleRegistry.get('RNGoogleMobileAdsModule')` says the
 * native half is present. On this repo it never is — package.json excludes the
 * SDK from autolinking — so `showRewarded()`'s state machine has never once run
 * end to end anywhere, on any machine. This file is the only way to run it.
 *
 * WHAT IT MODELS: the four things an ad network can do to us, plus silence.
 * The distinction between them is the entire product decision (standing
 * decision 2, the grace rule): 'complete' and 'dismiss' both mean an ad really
 * played, and only 'dismiss' withholds the unlock. 'noFill', 'showThrows' and
 * 'silent' are the network failing, and the user must not pay for that.
 *
 * WHY IT IS NOT A BAG OF vi.fn()
 * CEO lead 5 — a test that asserts a mock was called proves nothing. So nothing
 * here records calls for assertion. It emits the SDK's real event sequences and
 * the tests assert what `showRewarded()` RETURNS and what
 * `lastRewardedFailure()` reports afterwards, which is exactly what the paywall
 * branches on.
 *
 * WHAT IT DOES NOT PROVE, stated so nobody cites it later: that the real SDK
 * fires these events in this order on a real device. It cannot. No ad has ever
 * been seen rendering on this project (QA blocker 5). This proves our
 * CLASSIFICATION of the events — which is precisely where the bug was — and
 * retires no device test.
 *
 * Wired in by `resolve.alias` in vitest.config.mts. Metro never sees this file.
 */

/** What the network does after `load()`. */
export type AdScript =
  /** Loads, shows, pays out, closes. The happy path. */
  | 'complete'
  /** Loads, shows, and the user closes it early. The ONLY genuine decline. */
  | 'dismiss'
  /** No fill / network error. Never loads. */
  | 'noFill'
  /** Loads, but `show()` rejects. */
  | 'showThrows'
  /** Total silence — a wedged SDK. Only the hard timeout ends this. */
  | 'silent';

interface Network {
  script: AdScript;
}

const network: Network = { script: 'complete' };

/** Test-only: choose what the network does next. */
export function __setAdScript(script: AdScript): void {
  network.script = script;
}

/** Test-only: back to defaults. Call in beforeEach. */
export function __resetAdNetwork(): void {
  network.script = 'complete';
}

/* --------------------------------------------------------------- event types */
/* Values mirror the real SDK's: note that AdEventType.LOADED and              */
/* RewardedAdEventType.LOADED are DIFFERENT strings, which is load-bearing —   */
/* ads.ts registers the rewarded one and the generic CLOSED/ERROR on the same  */
/* ad object, and they must not collide.                                       */

export const AdEventType = {
  LOADED: 'loaded',
  OPENED: 'opened',
  CLOSED: 'closed',
  CLICKED: 'clicked',
  ERROR: 'error',
} as const;

export const RewardedAdEventType = {
  LOADED: 'rewarded_loaded',
  EARNED_REWARD: 'rewarded_earned_reward',
} as const;

export const MaxAdContentRating = {
  G: 'G',
  PG: 'PG',
  T: 'T',
  MA: 'MA',
} as const;

/* ---------------------------------------------------------------- the ad unit */

type Handler = (payload?: unknown) => void;

class FakeAd {
  private handlers = new Map<string, Set<Handler>>();

  constructor(
    private readonly kind: 'rewarded' | 'interstitial',
    readonly unitId: string,
  ) {}

  addAdEventListener(type: string, fn: Handler): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }

  private emit(type: string, payload?: unknown): void {
    for (const fn of [...(this.handlers.get(type) ?? [])]) fn(payload);
  }

  load(): void {
    const { script } = network;
    if (script === 'silent') return; // nothing, ever. The timeout is the only exit.
    // A microtask, not a timer: the load/show/close sequence must complete
    // without any test having to advance a clock, so the ONE test that does
    // advance one is unambiguously testing the hard timeout.
    queueMicrotask(() => {
      if (script === 'noFill') {
        this.emit(AdEventType.ERROR, new Error('no fill'));
        return;
      }
      this.emit(this.kind === 'rewarded' ? RewardedAdEventType.LOADED : AdEventType.LOADED);
    });
  }

  show(): Promise<void> {
    if (network.script === 'showThrows') {
      return Promise.reject(new Error('ad failed to present'));
    }
    queueMicrotask(() => {
      if (this.kind === 'rewarded') {
        if (network.script === 'complete') {
          this.emit(RewardedAdEventType.EARNED_REWARD, { type: 'night_pass', amount: 1 });
        }
        // 'dismiss' reaches CLOSED with no reward — an ad really played and was
        // closed early. That is the one case the grace rule does NOT forgive.
        this.emit(AdEventType.CLOSED);
      } else {
        if (network.script === 'complete') this.emit(AdEventType.OPENED);
        this.emit(AdEventType.CLOSED);
      }
    });
    return Promise.resolve();
  }
}

export const RewardedAd = {
  createForAdRequest(unitId: string): FakeAd {
    return new FakeAd('rewarded', unitId);
  },
};

export const InterstitialAd = {
  createForAdRequest(unitId: string): FakeAd {
    return new FakeAd('interstitial', unitId);
  },
};

/* -------------------------------------------------------------- default export */

interface MobileAds {
  setRequestConfiguration(config: unknown): Promise<void>;
  initialize(): Promise<unknown[]>;
}

/** `mobileAds()` — ads.ts checks `typeof mod.default === 'function'`. */
export default function mobileAds(): MobileAds {
  return {
    async setRequestConfiguration(_config: unknown): Promise<void> {},
    async initialize(): Promise<unknown[]> {
      return [];
    },
  };
}
