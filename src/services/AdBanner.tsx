/**
 * The banner ad slot — the one real architecture difference from the web
 * build. With react-native-google-mobile-ads the banner is a React component,
 * not an SDK-positioned native overlay, so ads.ts holds the caller's intent
 * and this component turns it into pixels.
 *
 * The composition root places <AdBanner/> anchored at the bottom, above the
 * bottom bar — this component is layout-neutral and self-contained: it renders
 * null unless the module state says visible AND ads may serve (never once
 * premium — that is product law, not a style choice), measures the loaded
 * banner via onLayout, and reports the real height back to ads.ts so layout
 * can reserve exactly that much space ('ads:banner' on the bus).
 */

import { useCallback, useEffect, useState, type ComponentType, type JSX } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { bus } from '../core/bus';
import {
  AD_UNITS,
  Ads,
  getBannerState,
  reportBannerFailed,
  reportBannerHeight,
  subscribeBanner,
} from './ads';

/**
 * The banner view, resolved lazily.
 *
 * Same reason as ads.ts: react-native-google-mobile-ads throws on evaluation
 * when its native module is missing, so importing it at module scope would
 * take the whole app down before anything renders. A sleep app must survive a
 * broken ad SDK, so the component is fetched on demand and this file renders
 * nothing until (and unless) it arrives.
 */
interface BannerModule {
  BannerAd: ComponentType<{
    unitId: string;
    size: string;
    /** The SDK reports the filled size here — that is our real height source. */
    onAdLoaded?: (dimensions: { width: number; height: number }) => void;
    onAdFailedToLoad?: (error: Error) => void;
  }>;
  bannerSize: string;
}

let bannerModule: BannerModule | null = null;
let bannerLoadFailed = false;

async function loadBanner(): Promise<BannerModule | null> {
  if (bannerModule || bannerLoadFailed) return bannerModule;
  try {
    const mod = await import('react-native-google-mobile-ads');
    bannerModule = {
      BannerAd: mod.BannerAd as BannerModule['BannerAd'],
      bannerSize: mod.BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
    };
    return bannerModule;
  } catch (err) {
    console.warn('[ads] banner component unavailable', err);
    bannerLoadFailed = true;
    return null;
  }
}

export function AdBanner(): JSX.Element | null {
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    // Re-render on banner intent changes AND on entitlement flips: buying
    // premium mid-session must take the live banner down immediately.
    const offBanner = subscribeBanner(rerender);
    const offEntitlements = bus.on('entitlements:changed', rerender);
    return () => {
      offBanner();
      offEntitlements();
    };
  }, [rerender]);

  /**
   * The real measurement. The BannerAd view only takes its size once an ad
   * has actually loaded, so a height > 0 here means "loaded and this tall".
   * reportBannerHeight ignores zero/duplicate heights and re-emits
   * 'ads:banner' with the true value.
   */
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    reportBannerHeight(e.nativeEvent.layout.height);
  }, []);

  const onAdLoaded = useCallback((dimensions: { width: number; height: number }) => {
    // Belt and braces alongside onLayout: the SDK tells us the ad's own size
    // at load. Same value, and reportBannerHeight dedupes.
    reportBannerHeight(dimensions.height);
  }, []);

  const onAdFailedToLoad = useCallback((error: Error) => {
    console.warn('[ads] banner failed to load', error);
    // Give the space back. The next Ads.showBanner() remounts us for a fresh
    // load attempt.
    reportBannerFailed();
  }, []);

  const { desiredVisible } = getBannerState();
  const wanted = desiredVisible && Ads.isAvailable();

  useEffect(() => {
    if (wanted && !bannerModule && !bannerLoadFailed) void loadBanner().then(rerender);
  }, [rerender, wanted]);

  if (!wanted || !bannerModule) return null;

  const { BannerAd, bannerSize } = bannerModule;
  return (
    <View style={styles.slot} onLayout={onLayout}>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={bannerSize}
        onAdLoaded={onAdLoaded}
        onAdFailedToLoad={onAdFailedToLoad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: '100%',
    alignItems: 'center',
  },
});
