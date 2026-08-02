/**
 * Composition root.
 *
 * Wires the four independent halves of the app together: the generative audio
 * engine, the UI, the canvas scenes, and the monetization services. Everything
 * below is orchestration — no feature logic lives here.
 *
 * Boot order matters:
 *   1. Scenes.attach() before initUI(), because the UI sets the scene during
 *      session restore.
 *   2. Ads.init() and Billing.init() are fire-and-forget. They must never block
 *      first paint, and on a desktop browser they resolve having done nothing.
 *   3. Nothing touches the AudioContext until the user taps play.
 */

import './style.css';
import { bus, toast } from './core/bus.js';
import { engine } from './audio/engine.js';
import { SleepTimer } from './core/timer.js';
import { getSettings, KEYS, read, write } from './core/store.js';
import { Scenes } from './scenes/renderer.js';
import { Ads } from './services/ads.js';
import { Billing } from './services/billing.js';
import { Native } from './services/native.js';
import { Entitlements } from './services/entitlements.js';
import { initUI, closeTopSheet, anyLayerOpen } from './ui/index.js';

/** Screens where a banner is allowed. Sleep surfaces are never in this list. */
const BANNER_SCREENS = new Set(['mixer']);

/** Let the first paint settle before an ad can steal the screen. */
const INTERSTITIAL_DELAY_MS = 1400;

let currentScreen = 'mixer';

/* ------------------------------------------------------------------ ads --- */

/**
 * The banner is allowed only on the mixer, only when nothing is covering it,
 * and never for a premium user. Every state change funnels through here so
 * there is exactly one rule to reason about.
 */
async function reconcileBanner() {
  const allowed =
    BANNER_SCREENS.has(currentScreen) && !anyLayerOpen() && !Entitlements.isPremium();
  try {
    if (allowed) await Ads.showBanner();
    else await Ads.hideBanner();
  } catch (err) {
    console.warn('[main] banner reconcile failed', err);
  }
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
async function maybeOpeningInterstitial() {
  const firstRun = read(KEYS.seenIntro, null) === null;
  write(KEYS.seenIntro, true);
  if (firstRun) return;

  await new Promise((r) => setTimeout(r, INTERSTITIAL_DELAY_MS));
  if (anyLayerOpen() || currentScreen !== 'mixer' || engine.isRunning()) return;

  try {
    if (await Ads.maybeShowInterstitial()) await reconcileBanner();
  } catch (err) {
    console.warn('[main] interstitial failed', err);
  }
}

/* ---------------------------------------------------------------- wiring --- */

function wireScreens() {
  bus.on('screen:changed', ({ name } = {}) => {
    if (!name) return;
    currentScreen = name;
    reconcileBanner();

    // Bedside is the overnight posture: hold the screen so the WebView — and
    // with it the AudioContext — is never suspended.
    const sleeping = name === 'bedside';
    Native.keepAwake(sleeping);
    Native.backgroundMode(sleeping);
    Scenes.setNightMode(sleeping);
  });

  bus.on('entitlements:changed', reconcileBanner);

  // The native banner floats above the WebView, so it would sit on top of any
  // open sheet. sheet.js signals open/closed by toggling `layer-open` on <html>;
  // watching the class is how we stay in sync without reaching into its state.
  new MutationObserver(reconcileBanner).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

function wireTimer() {
  SleepTimer.bind(engine);

  bus.on('timer:done', async () => {
    // The engine has already faded itself out on the audio clock by now.
    try {
      await engine.stop();
    } catch (err) {
      console.warn('[main] stop after timer failed', err);
    }
    // No ad here. See maybeOpeningInterstitial().
  });
}

function wireLifecycle() {
  // Android back closes the topmost sheet. With nothing open we return false,
  // which minimises the app rather than destroying it — someone pressing back
  // at bedtime wants the rain to keep playing, not to be killed.
  Native.onBackButton(() => closeTopSheet());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    // Returning to the app: the OS may have suspended the context underneath us.
    if (engine.isRunning()) {
      engine.start().catch(() => {
        toast('Tap play to resume');
      });
    }
    reconcileBanner();
  });
}

/* ------------------------------------------------------------------ boot --- */

async function boot() {
  const canvas = document.getElementById('scene-canvas');
  if (canvas) Scenes.attach(canvas);

  wireTimer();
  wireScreens();

  initUI({ engine, Scenes });

  wireLifecycle();

  // Restore the nursery cap before any sound can play.
  const settings = getSettings();
  if (settings.nurserySafe) engine.setNurserySafe?.(true);

  // Monetization comes up behind the UI. A slow or failed ad SDK must not be
  // visible to someone who just wants rain.
  Billing.init().catch((err) => console.warn('[main] billing init', err));
  Ads.init()
    .then(async () => {
      await reconcileBanner();
      await maybeOpeningInterstitial();
    })
    .catch((err) => console.warn('[main] ads init', err));

  // Native.isNative() is synchronous but only accurate once the Capacitor import
  // has resolved, so this log waits a tick rather than reporting native=false on
  // an actual device.
  setTimeout(() => {
    console.info(
      `[quietloom] ready — native=${Native.isNative()} premium=${Entitlements.isPremium()} pass=${Entitlements.hasNightPass()}`,
    );
  }, 0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
