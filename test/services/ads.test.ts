/**
 * MAP ENTRY #3 — THE GRACE RULE, and the `showRewarded()` machine that feeds it.
 *
 * This is the worst bug history in the repository. The rule was once specified
 * against `Ads.isAvailable()` — which reports that the SDK started, not that an
 * ad can be delivered — implemented exactly as written, reviewed, and shipped.
 * It silently refused to unlock anything on a device with no ad fill. Standing
 * product decision 2 (team/README.md) exists because of it:
 *
 *   "If a rewarded ad fails to load, the unlock is granted anyway. Only a
 *    genuine dismissal counts as declining."
 *
 * It was untestable until seam S1 landed an hour before this file was written:
 * the decision lived inside a `useCallback` in PaywallSheet.tsx, and the
 * classification lived in a module-level `let` interleaved with the native SDK.
 *
 * WHAT IS PROVEN HERE: the decision table, exhaustively; and that every way the
 * ad network can fail us reaches the GRANT side of it, driven through the real
 * `Ads.showRewarded()` rather than by hand.
 *
 * WHAT IS NOT PROVEN, said plainly so no one cites this file for it:
 *  - that the real SDK fires these events in this order on a device. It cannot
 *    be proven here. No ad has ever been seen rendering on this project (QA
 *    blocker 5), and package.json excludes the SDK from autolinking, so no
 *    build has an ad path at all. This proves our CLASSIFICATION of the events.
 *  - the last three lines of PaywallSheet.tsx, which are tier 3. The composition
 *    is replicated in `attemptNightPass()` below and is the seam's contract;
 *    that the sheet still calls it that way is checked by the typechecker, not
 *    by this file.
 *
 * No assertion in this file is "a mock was called" (CEO lead 5). Every one is
 * either a pure return value or "can this user now hear a paid sound".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { shouldGrantNightPass, type RewardedFailure } from '../../src/services/ads';

/* ========================================================================== *
 * 1. THE DECISION TABLE — pure, no mocks, no modules, no clock.
 * ========================================================================== */

describe('shouldGrantNightPass — the grace rule as a decision table', () => {
  // The complete cross product. Six rows, and only ONE of them withholds.
  const TABLE: Array<{ earned: boolean; failure: RewardedFailure; grants: boolean; why: string }> = [
    { earned: true, failure: null, grants: true, why: 'the reward really was earned' },
    { earned: false, failure: 'unavailable', grants: true, why: 'no fill is not the user declining' },
    { earned: false, failure: null, grants: true, why: 'no reward, no recorded failure — be generous' },
    { earned: false, failure: 'declined', grants: false, why: 'an ad played and was closed early' },
    { earned: true, failure: 'declined', grants: true, why: 'a real reward outranks a stale reason' },
    { earned: true, failure: 'unavailable', grants: true, why: 'a real reward outranks a stale reason' },
  ];

  for (const { earned, failure, grants, why } of TABLE) {
    it(`(${earned}, ${JSON.stringify(failure)}) ${grants ? 'GRANTS' : 'WITHHOLDS'} — ${why}`, () => {
      expect(shouldGrantNightPass(earned, failure)).toBe(grants);
    });
  }

  it('withholds in EXACTLY ONE of the six reachable states', () => {
    // Two-sided on purpose. A rule that never withholds is a free unlock button
    // and the ad revenue is zero; a rule that withholds twice has re-introduced
    // the original bug in a new place. Neither shows up if you only assert the
    // one row you were thinking about.
    const withheld = TABLE.filter((row) => !shouldGrantNightPass(row.earned, row.failure));
    expect(withheld).toHaveLength(1);
    expect(withheld[0]).toMatchObject({ earned: false, failure: 'declined' });
  });

  it('is a pure function of its two arguments — same input, same answer, always', () => {
    // The original defect was that the decision consulted a THIRD thing (SDK
    // health). Nothing about the module's state may move this answer.
    for (const row of TABLE) {
      const first = shouldGrantNightPass(row.earned, row.failure);
      expect(shouldGrantNightPass(row.earned, row.failure)).toBe(first);
    }
  });
});

/* ========================================================================== *
 * 2. THE MACHINE — showRewarded() driven against a fake ad network.
 * ========================================================================== */

type PlatformOS = 'android' | 'ios' | 'web';
type AdScript = 'complete' | 'dismiss' | 'noFill' | 'showThrows' | 'silent';

/**
 * A fresh module registry per case. `src/services/ads.ts` keeps `initialised`,
 * `sdk`, `adsDisabled` and `lastRewardedFailure` in module-level `let`s, so
 * without this every test would inherit the previous one's SDK.
 */
async function loadAds(opts: { os?: PlatformOS; sdkInBinary?: boolean } = {}) {
  const { os = 'android', sdkInBinary = true } = opts;
  vi.resetModules();

  const rn = await import('../../__mocks__/react-native');
  const network = await import('../../__mocks__/google-mobile-ads');
  const storage = await import('../../__mocks__/async-storage');
  rn.__resetReactNative();
  network.__resetAdNetwork();
  storage.__resetAsyncStorage();

  rn.__setPlatformOS(os);
  if (sdkInBinary) rn.__registerTurboModule('RNGoogleMobileAdsModule');

  const store = await import('../../src/core/store');
  await store.hydrate();

  const { Entitlements } = await import('../../src/services/entitlements');
  const ads = await import('../../src/services/ads');

  return {
    Ads: ads.Ads,
    grants: ads.shouldGrantNightPass,
    Entitlements,
    setScript: (s: AdScript) => network.__setAdScript(s),
  };
}

type Ctx = Awaited<ReturnType<typeof loadAds>>;

/**
 * Exactly what PaywallSheet.tsx does at :95-101 after seam S1, so the assertion
 * below is the user-visible outcome and not a restatement of the rule.
 */
async function attemptNightPass(ctx: Ctx): Promise<boolean> {
  const earned = await ctx.Ads.showRewarded();
  const reason = ctx.Ads.lastRewardedFailure();
  if (ctx.grants(earned, reason)) ctx.Entitlements.grantNightPass();
  return ctx.Entitlements.hasNightPass();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('showRewarded — how each outcome is classified', () => {
  it('a completed ad earns the reward and records no failure', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('complete');

    expect(await ctx.Ads.showRewarded()).toBe(true);
    expect(ctx.Ads.lastRewardedFailure()).toBeNull();
  });

  it('an ad that PLAYED and was closed early is the one genuine decline', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('dismiss');

    expect(await ctx.Ads.showRewarded()).toBe(false);
    expect(ctx.Ads.lastRewardedFailure()).toBe('declined');
  });

  it('no fill is unavailable, NOT declined', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('noFill');

    expect(await ctx.Ads.showRewarded()).toBe(false);
    expect(ctx.Ads.lastRewardedFailure()).toBe('unavailable');
  });

  it('an ad that loads but fails to present is unavailable, NOT declined', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('showThrows');

    expect(await ctx.Ads.showRewarded()).toBe(false);
    expect(ctx.Ads.lastRewardedFailure()).toBe('unavailable');
  });

  it('a wedged SDK times out rather than hanging the unlock sheet', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('silent');

    // Fake ONLY the timer functions: the fake network drives its event
    // sequences on microtasks, which must keep running normally so that this
    // is unambiguously a test of the 30 s hard timeout and nothing else.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = ctx.Ads.showRewarded();

    // Two-sided: still pending just before the deadline, resolved just after.
    // A one-sided "it eventually resolves" would also pass if the timeout were
    // 30 milliseconds, which would cut off every real ad.
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(29_000);
    expect(settled, 'resolved too early — a real ad would be cut off').toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(await pending).toBe(false);
    expect(ctx.Ads.lastRewardedFailure()).toBe('unavailable');
  });

  it('reports unavailable off-device, without touching the SDK', async () => {
    const ctx = await loadAds({ os: 'web' });
    await ctx.Ads.init();

    expect(ctx.Ads.isAvailable()).toBe(false);
    expect(await ctx.Ads.showRewarded()).toBe(false);
    expect(ctx.Ads.lastRewardedFailure()).toBe('unavailable');
  });

  it('reports unavailable when the ad SDK is not in the binary at all', async () => {
    // This is the ACTUAL state of every build of this app today: package.json
    // excludes react-native-google-mobile-ads from autolinking.
    const ctx = await loadAds({ sdkInBinary: false });
    await ctx.Ads.init();

    expect(ctx.Ads.isAvailable()).toBe(false);
    expect(await ctx.Ads.showRewarded()).toBe(false);
    expect(ctx.Ads.lastRewardedFailure()).toBe('unavailable');
  });

  it('reports unavailable before init() has ever run', async () => {
    const ctx = await loadAds();
    expect(await ctx.Ads.showRewarded()).toBe(false);
    expect(ctx.Ads.lastRewardedFailure()).toBe('unavailable');
  });

  it('serves no rewarded ad to a premium user', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('complete');
    ctx.Entitlements.setPremium(true);

    expect(ctx.Ads.isAvailable()).toBe(false);
    expect(await ctx.Ads.showRewarded()).toBe(false);
  });

  it('serves no rewarded ad once the kill switch is on', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('complete');
    ctx.Ads.setAdsDisabled(true);

    expect(await ctx.Ads.showRewarded()).toBe(false);
    expect(ctx.Ads.lastRewardedFailure()).toBe('unavailable');
  });

  it('refuses a second overlapping flow without disturbing the first', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('silent');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const first = ctx.Ads.showRewarded();

    // A double tap on "Watch an ad" must not start a second ad.
    expect(await ctx.Ads.showRewarded()).toBe(false);

    await vi.advanceTimersByTimeAsync(31_000);
    expect(await first).toBe(false);
    expect(ctx.Ads.lastRewardedFailure()).toBe('unavailable');

    // ...and the guard released, so a later attempt is not wedged forever.
    ctx.setScript('complete');
    vi.useRealTimers();
    expect(await ctx.Ads.showRewarded()).toBe(true);
  });
});

/* ========================================================================== *
 * 3. END TO END — did the user actually get their night pass?
 * ========================================================================== */

describe('standing decision 2 — the user is not punished for our ad network', () => {
  beforeEach(() => {
    // Fixed evening clock: a pass granted now must be live, so a false in these
    // tests means the grace rule withheld it and not that it expired.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 3, 22, 30, 0, 0));
  });

  it('grants the pass when the ad network had no fill', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('noFill');

    expect(await attemptNightPass(ctx)).toBe(true);
    expect(ctx.Entitlements.isUnlocked('fire')).toBe(true);
  });

  it('grants the pass when the ad loaded but could not be presented', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('showThrows');

    expect(await attemptNightPass(ctx)).toBe(true);
  });

  it('grants the pass when there is no ad SDK in the build at all', async () => {
    // THE REGRESSION TEST FOR THE ORIGINAL BUG. Here `isAvailable()` is false —
    // the exact condition the rule was once wrongly written against. If anyone
    // ever reverts the rule to key off SDK health, this is the line that goes
    // red, and it goes red for the same reason the users complained.
    const ctx = await loadAds({ sdkInBinary: false });
    await ctx.Ads.init();

    expect(ctx.Ads.isAvailable()).toBe(false);
    expect(await attemptNightPass(ctx)).toBe(true);
    expect(ctx.Entitlements.isUnlocked('binaural')).toBe(true);
  });

  it('grants the pass when the ad really played and paid out', async () => {
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('complete');

    expect(await attemptNightPass(ctx)).toBe(true);
  });

  it('does NOT grant the pass when the user watched an ad and closed it early', async () => {
    // The other side of the rule, and the reason it is not simply "always
    // grant". Without this row the grace rule is a free unlock button.
    const ctx = await loadAds();
    await ctx.Ads.init();
    ctx.setScript('dismiss');

    expect(await attemptNightPass(ctx)).toBe(false);
    expect(ctx.Entitlements.isUnlocked('fire')).toBe(false);
    // ...and the free four are untouched by any of this.
    expect(ctx.Entitlements.isUnlocked('rain')).toBe(true);
  });
});
