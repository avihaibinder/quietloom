/**
 * Composition root. Port of src/main.js plus the wiring half of ui/index.js.
 *
 * Wires the four independent halves of the app together: the generative audio
 * engine, the UI, the Skia scenes, and the monetization services. Everything
 * below is orchestration — no feature logic lives here.
 *
 * Boot order matters:
 *   1. store.hydrate() before anything reads a setting. AsyncStorage is async;
 *      the rest of the app is written against a synchronous store.
 *   2. Session restore before the mixer's first paint, because it decides the
 *      scene and the starting mix.
 *   3. Ads.init() and Billing.init() are fire-and-forget. They must never block
 *      first paint, and off-device they resolve having done nothing.
 *   4. Nothing touches the AudioContext until the user taps play.
 */

import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { initBackgroundAudio } from './src/audio/background';
import { engine } from './src/audio/engine';
import { bus, toast } from './src/core/bus';
import { getSettings, hydrate, KEYS, read, setSettings, write } from './src/core/store';
import { SleepTimer } from './src/core/timer';
import { Scenes } from './src/scenes/renderer';
import { SceneView } from './src/scenes/SceneView';
import { AdBanner } from './src/services/AdBanner';
import { Ads } from './src/services/ads';
import { Billing } from './src/services/billing';
import { Entitlements } from './src/services/entitlements';
import { Native } from './src/services/native';
import type { EngineState, MixSpec, ScreenName, SoundId } from './src/types';
import { BottomBar } from './src/ui/components/BottomBar';
import { ToastHost } from './src/ui/components/ToastHost';
import { primeSceneAccent, useBusEvent } from './src/ui/hooks';
import { anyLayerOpen, closeTopLayer, subscribeLayers } from './src/ui/layers';
import { sceneIntensity } from './src/ui/mixState';
import { BedsideOverlay, enterBedside } from './src/ui/overlays/BedsideOverlay';
import { BreathingOverlay, openBreathing } from './src/ui/overlays/BreathingOverlay';
import { MixerScreen } from './src/ui/screens/MixerScreen';
import { MoonTap } from './src/ui/screens/MoonTap';
import { applyPreset } from './src/ui/screens/PresetRow';
import { EvidenceSheet } from './src/ui/sheets/EvidenceSheet';
import { MixesSheet } from './src/ui/sheets/MixesSheet';
import { PaywallSheet } from './src/ui/sheets/PaywallSheet';
import { openTimerSheet, TimerSheet, useTimerWiring } from './src/ui/sheets/TimerSheet';
import { BAR_HEIGHT, color } from './src/ui/theme';

/**
 * Deliberately a free preset. A first-ever launch that opens on a locked
 * sleepscape reads as a paywall, and the upsell lands better once someone has
 * actually heard how good the free tier sounds.
 */
const DEFAULT_PRESET = 'rainfall';

/** Screens where a banner is allowed. Sleep surfaces are never in this list. */
const BANNER_SCREENS = new Set<ScreenName>(['mixer']);

/** Let the first paint settle before an ad can steal the screen. */
const INTERSTITIAL_DELAY_MS = 1400;

/** Dragging a slider fires mix:changed continuously — do not thrash storage. */
const PERSIST_DEBOUNCE_MS = 400;

export default function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrate();
      if (cancelled) return;

      // Restore the nursery cap before any sound can play.
      if (getSettings().nurserySafe) engine.setNurserySafe(true);

      restoreSession();
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaProvider>
      {ready ? <Root /> : <View style={styles.root} />}
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

/** Restore the last mix, or fall back to the default preset. */
function restoreSession(): void {
  const settings = getSettings();
  const saved = read<{ master?: number; layers?: MixSpec['layers'] } | null>(KEYS.lastMix, null);

  if (saved?.layers) {
    const layers: MixSpec['layers'] = {};
    for (const [key, spec] of Object.entries(saved.layers)) {
      const id = key as SoundId;
      layers[id] = { ...spec, enabled: !!spec?.enabled && Entitlements.isUnlocked(id) };
    }
    engine.applyMix({ layers });
    if (typeof saved.master === 'number') engine.setMasterVolume(saved.master);
    try {
      Scenes.setScene(settings.scene ?? 'rain');
    } catch {
      /* renderer is optional */
    }
  } else {
    applyPreset(DEFAULT_PRESET, { silent: true });
  }

  primeSceneAccent(Scenes.getScene());

  try {
    Scenes.setIntensity(sceneIntensity(engine.getState()));
  } catch {
    /* renderer is optional */
  }
}

function Root(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [avoidRects, setAvoidRects] = useState<LayoutRectangle[]>([]);
  const screenRef = useRef<ScreenName>('mixer');
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingState = useRef<EngineState | null>(null);

  useTimerWiring();

  /* ------------------------------------------------------------- banner --- */

  /**
   * The banner is allowed only on the mixer, only when nothing is covering it,
   * and never for a premium user. Every state change funnels through here so
   * there is exactly one rule to reason about.
   */
  const reconcileBanner = useCallback(() => {
    const allowed =
      BANNER_SCREENS.has(screenRef.current) && !anyLayerOpen() && !Entitlements.isPremium();
    void (async () => {
      try {
        if (allowed) await Ads.showBanner();
        else await Ads.hideBanner();
      } catch (err) {
        console.warn('[main] banner reconcile failed', err);
      }
    })();
  }, []);

  /* ------------------------------------------------------------ screens --- */

  useBusEvent('screen:changed', ({ name }) => {
    if (!name) return;
    screenRef.current = name;
    reconcileBanner();

    // Bedside is the overnight posture: hold the screen so the app — and with
    // it the audio session — is never suspended.
    const sleeping = name === 'bedside';
    void Native.keepAwake(sleeping);
    void Native.backgroundMode(sleeping);
    Scenes.setNightMode(sleeping);
  });

  useBusEvent('entitlements:changed', () => {
    reconcileBanner();
    // Belt and braces: a paying user should never see another banner.
    if (Entitlements.isPremium()) {
      try {
        Ads.setAdsDisabled(true);
      } catch {
        /* stub-safe */
      }
    }
  });

  // A sheet or overlay opening must take the banner down with it.
  useEffect(() => subscribeLayers(reconcileBanner), [reconcileBanner]);

  /* --------------------------------------------------- scene + persistence */

  useBusEvent('mix:changed', (state) => {
    pendingState.current = state;
    if (!persistTimer.current) {
      persistTimer.current = setTimeout(() => {
        persistTimer.current = null;
        const s = pendingState.current;
        pendingState.current = null;
        if (s) write(KEYS.lastMix, { master: s.master, layers: s.layers });
      }, PERSIST_DEBOUNCE_MS);
    }
    try {
      Scenes.setIntensity(sceneIntensity(state));
    } catch {
      /* renderer is optional */
    }
  });

  useBusEvent('scene:changed', ({ scene }) => {
    if (scene) setSettings({ scene });
  });

  useBusEvent('audio:started', () => {
    try {
      Scenes.resume();
    } catch {
      /* renderer is optional */
    }
  });

  useBusEvent('audio:stopped', () => {
    try {
      Scenes.pause();
    } catch {
      /* renderer is optional */
    }
  });

  useBusEvent('timer:done', () => {
    // The engine has already faded itself out on the audio clock by now.
    void engine.stop().catch((err) => console.warn('[main] stop after timer failed', err));
    // No ad here — see maybeOpeningInterstitial().
  });

  /* ----------------------------------------------------------- lifecycle --- */

  useEffect(() => {
    SleepTimer.bind(engine);
    initBackgroundAudio(engine);

    // Android back closes the topmost surface. With nothing open we return
    // false, which minimises the app rather than destroying it — someone
    // pressing back at bedtime wants the rain to keep playing.
    const offBack = Native.onBackButton(() => closeTopLayer());

    const offAppState = Native.onAppStateChange((isActive) => {
      if (!isActive) {
        // Never lose the last mix to process death while backgrounded.
        const s = pendingState.current;
        if (s) {
          if (persistTimer.current) clearTimeout(persistTimer.current);
          persistTimer.current = null;
          write(KEYS.lastMix, { master: s.master, layers: s.layers });
          pendingState.current = null;
        }
        return;
      }
      // Returning to the app: the OS may have suspended the context under us.
      if (engine.isRunning()) {
        engine.start().catch(() => toast('Tap play to resume'));
      }
      reconcileBanner();
    });

    // Monetization comes up behind the UI. A slow or failed ad SDK must not be
    // visible to someone who just wants rain.
    Billing.init().catch((err) => console.warn('[main] billing init', err));
    Ads.init()
      .then(async () => {
        reconcileBanner();
        await maybeOpeningInterstitial(() => screenRef.current, reconcileBanner);
      })
      .catch((err) => console.warn('[main] ads init', err));

    bus.emit('screen:changed', { name: 'mixer' });

    console.info(
      `[quietloom] ready — native=${Native.isNative()} premium=${Entitlements.isPremium()} pass=${Entitlements.hasNightPass()}`,
    );

    return () => {
      offBack();
      offAppState();
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [reconcileBanner]);

  /* ---------------------------------------------------------------- view --- */

  const onEmptyPlay = useCallback(() => applyPreset(DEFAULT_PRESET, { silent: true }), []);

  return (
    <View style={styles.root}>
      <SceneView />
      <MixerScreen onControlsLayout={setAvoidRects} />
      <MoonTap avoidRects={avoidRects} />
      {/* AdBanner is layout-neutral by design; the root decides it sits
          directly above the transport bar and never over it. */}
      <View style={[styles.bannerSlot, { bottom: insets.bottom + BAR_HEIGHT }]}>
        <AdBanner />
      </View>
      <BottomBar
        onEmptyPlay={onEmptyPlay}
        onTimerPress={openTimerSheet}
        onBreathePress={openBreathing}
        onBedsidePress={enterBedside}
      />

      <TimerSheet />
      <PaywallSheet />
      <EvidenceSheet />
      <MixesSheet />

      <BreathingOverlay />
      <BedsideOverlay />
      <ToastHost />
    </View>
  );
}

/**
 * At most one interstitial per day, on a cold start only.
 *
 * Deliberately NOT wired to timer:done or audio:stopped. Those fire while the
 * user is asleep or falling asleep, and an ad at 3am would be an actual harm —
 * it is also the fastest way to earn one-star reviews on a sleep app.
 * Skipped entirely on a first-ever launch: the first impression is worth more
 * than one impression.
 */
async function maybeOpeningInterstitial(
  currentScreen: () => ScreenName,
  reconcileBanner: () => void,
): Promise<void> {
  const firstRun = read<boolean | null>(KEYS.seenIntro, null) === null;
  write(KEYS.seenIntro, true);
  if (firstRun) return;

  await new Promise((r) => setTimeout(r, INTERSTITIAL_DELAY_MS));
  if (anyLayerOpen() || currentScreen() !== 'mixer' || engine.isRunning()) return;

  try {
    if (await Ads.maybeShowInterstitial()) reconcileBanner();
  } catch (err) {
    console.warn('[main] interstitial failed', err);
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  bannerSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15, // under the bar (20), over the mixer
  },
});
