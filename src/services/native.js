/**
 * The single seam between Quietloom and Capacitor.
 *
 * Nothing else in the app may import a Capacitor plugin directly. Every method
 * here is safe to call in a desktop browser, where they all degrade to no-ops
 * (or, for openUrl, to plain window.open).
 *
 * Public API (FROZEN CONTRACT):
 *   Native.isNative()            -> boolean            (sync, safe before init)
 *   Native.keepAwake(on)         -> Promise<boolean>   true if actually applied
 *   Native.backgroundMode(on)    -> Promise<boolean>   see BACKGROUND AUDIO below
 *   Native.openUrl(url)          -> Promise<void>
 *   Native.onBackButton(handler) -> () => void         unsubscribe function
 *
 * ---------------------------------------------------------------------------
 * BACKGROUND AUDIO — DECISION: no background-mode plugin. Shipping as a
 * documented no-op with keep-awake as the fallback.
 *
 * `@anuradev/capacitor-background-mode@7.2.1` was installed, synced and its
 * merged manifest inspected. It unions these into our AndroidManifest:
 *
 *     android.permission.RECORD_AUDIO              <- microphone, "dangerous"
 *     android.permission.SYSTEM_ALERT_WINDOW       <- draw over other apps
 *     android.permission.FOREGROUND_SERVICE_MICROPHONE
 *     android.permission.FOREGROUND_SERVICE_SPECIAL_USE
 *     android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
 *
 * plus a foreground service declared `foregroundServiceType="specialUse|
 * microphone"` whose PROPERTY_SPECIAL_USE_FGS_SUBTYPE string claims the app
 * needs to stay alive "to receive messages and calls from third party SIP
 * servers" — untrue for us, and Google reviews that string by hand.
 *
 * A sleep app that asks for the microphone is a trust catastrophe and an
 * near-certain Play review rejection. It was uninstalled and the build
 * re-verified clean. See MONETIZATION-WIRING.md for the upgrade path.
 *
 * What we ship instead: bedside mode holds a screen wake lock (screen on,
 * dimmed to black by the UI), which is the intended overnight posture anyway
 * and keeps the WebView's AudioContext alive without any extra permission.
 * ---------------------------------------------------------------------------
 */

/* --------------------------- plugin refs --------------------------- */

// @capacitor/core is imported STATICALLY and deliberately. It is safe on the
// web (isNativePlatform() simply returns false) and it is the only way
// isNative() can be correct on the very first synchronous call — a lazy import
// makes the app report native=false for the first few frames of boot, which had
// the UI mis-detecting the platform.
import { Capacitor } from '@capacitor/core';

// The actual plugins stay lazy so that a broken/missing one degrades to a
// no-op instead of taking the whole boot down.
let KeepAwake = null;
let CapApp = null;

let loadPromise = null;
let keepAwakeSupported = null; // null = unknown, true/false once probed

/** True when running inside a Capacitor native shell. Correct immediately. */
function detectNative() {
  try {
    return !!Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

const nativeFlag = detectNative();

/**
 * Two independent reasons to hold the screen awake. Either one keeps it on;
 * we only release when both are off. Prevents backgroundMode(false) from
 * stomping an active bedside session and vice versa.
 */
const wakeRequests = { keepAwake: false, backgroundMode: false };
let wakeApplied = false;

/** Idempotent lazy load. Never throws. */
function ensureLoaded() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Plain browser: leave every plugin null so each method no-ops.
    if (!nativeFlag) return;

    try {
      ({ KeepAwake } = await import('@capacitor-community/keep-awake'));
    } catch (err) {
      console.warn('[native] keep-awake unavailable', err);
    }
    try {
      ({ App: CapApp } = await import('@capacitor/app'));
    } catch (err) {
      console.warn('[native] @capacitor/app unavailable', err);
    }
  })();

  return loadPromise;
}

// Warm the plugin imports immediately so the first keepAwake()/onBackButton()
// does not pay the import cost. isNative() is already correct without this.
ensureLoaded();

/** Apply or release the wake lock to match the current request flags. */
async function reconcileWakeLock() {
  const want = wakeRequests.keepAwake || wakeRequests.backgroundMode;
  if (want === wakeApplied) return wakeApplied;

  if (!nativeFlag || !KeepAwake) {
    wakeApplied = false;
    return false;
  }

  try {
    if (keepAwakeSupported === null) {
      const res = await KeepAwake.isSupported();
      keepAwakeSupported = !!res?.isSupported;
      if (!keepAwakeSupported) console.info('[native] keep-awake not supported here');
    }
    if (!keepAwakeSupported) return false;

    if (want) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();

    wakeApplied = want;
    return wakeApplied;
  } catch (err) {
    console.warn('[native] keep-awake toggle failed', err);
    return wakeApplied;
  }
}

/* ------------------------------------------------------------------------ */

export const Native = {
  /**
   * Synchronous and correct from the very first call, including before any
   * plugin has finished loading. Returns false in any browser (`vite dev`).
   */
  isNative() {
    return nativeFlag;
  },

  /** 'android' | 'ios' | 'web'. Useful for platform-specific copy. */
  platform() {
    try {
      return Capacitor?.getPlatform?.() ?? 'web';
    } catch {
      return 'web';
    }
  },

  /**
   * Hold the screen on (bedside mode). Releasing is what actually matters for
   * battery, so always pair a keepAwake(true) with a keepAwake(false).
   *
   * @param {boolean} on
   * @returns {Promise<boolean>} whether a wake lock is now held
   */
  async keepAwake(on) {
    await ensureLoaded();
    wakeRequests.keepAwake = !!on;
    return reconcileWakeLock();
  },

  /**
   * No dedicated background-audio plugin ships in this build — see the header.
   * We degrade to the screen wake lock, which keeps the AudioContext running
   * for the bedside use case. Returns false in a browser and false if the
   * wake lock could not be taken, so callers can show honest UI.
   *
   * TODO(background-audio): the correct long-term fix is a small first-party
   * Android foreground service of type `mediaPlayback` driven by a MediaSession
   * (the FOREGROUND_SERVICE_MEDIA_PLAYBACK permission is already declared in
   * AndroidManifest.xml). That needs no extra permissions, gives a proper
   * lockscreen transport, and passes Play review. It is a Java-side change, not
   * a plugin install.
   *
   * @param {boolean} on
   * @returns {Promise<boolean>} true if audio is being actively protected
   */
  async backgroundMode(on) {
    await ensureLoaded();
    wakeRequests.backgroundMode = !!on;
    const held = await reconcileWakeLock();
    if (on && !held) {
      console.info('[native] backgroundMode requested but unavailable — no-op');
    }
    return held;
  },

  /**
   * Open an external link (the research citations). Uses the system browser on
   * device via @capacitor/app, falling back to window.open everywhere else.
   */
  async openUrl(url) {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      console.warn('[native] refusing to open non-http url', url);
      return;
    }

    await ensureLoaded();

    if (nativeFlag && CapApp?.openUrl) {
      try {
        await CapApp.openUrl({ url });
        return;
      } catch (err) {
        console.warn('[native] App.openUrl failed, falling back', err);
      }
    }

    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.warn('[native] window.open failed', err);
    }
  },

  /**
   * Android hardware/gesture back button. Call the returned function to
   * unsubscribe. In a browser this returns a no-op unsubscribe immediately, so
   * the UI can wire it unconditionally.
   *
   * The handler receives Capacitor's { canGoBack } payload. If your handler
   * consumes the event (closed a sheet), return true — otherwise we let the
   * default happen and the OS minimises/exits the app.
   *
   * @param {(info: {canGoBack: boolean}) => boolean|void} handler
   * @returns {() => void} unsubscribe
   */
  onBackButton(handler) {
    if (typeof handler !== 'function') return () => {};

    let handle = null;
    let cancelled = false;

    ensureLoaded()
      .then(async () => {
        if (cancelled || !nativeFlag || !CapApp?.addListener) return;
        try {
          handle = await CapApp.addListener('backButton', (info) => {
            let consumed = false;
            try {
              consumed = handler(info) === true;
            } catch (err) {
              console.error('[native] backButton handler threw', err);
              consumed = true; // never let a UI bug exit the app mid-sleep
            }
            if (!consumed) {
              try {
                CapApp.minimizeApp?.();
              } catch {
                /* ignore */
              }
            }
          });
          if (cancelled) {
            await handle?.remove?.();
            handle = null;
          }
        } catch (err) {
          console.warn('[native] backButton listener failed', err);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try {
        handle?.remove?.();
      } catch {
        /* ignore */
      }
      handle = null;
    };
  },

  /**
   * App foreground/background transitions — useful for pausing the canvas
   * renderer while backgrounded. Returns an unsubscribe function.
   * @param {(isActive: boolean) => void} handler
   */
  onAppStateChange(handler) {
    if (typeof handler !== 'function') return () => {};

    let handle = null;
    let cancelled = false;

    ensureLoaded()
      .then(async () => {
        if (cancelled || !nativeFlag || !CapApp?.addListener) return;
        try {
          handle = await CapApp.addListener('appStateChange', ({ isActive }) => {
            try {
              handler(!!isActive);
            } catch (err) {
              console.error('[native] appStateChange handler threw', err);
            }
          });
          if (cancelled) {
            await handle?.remove?.();
            handle = null;
          }
        } catch (err) {
          console.warn('[native] appStateChange listener failed', err);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try {
        handle?.remove?.();
      } catch {
        /* ignore */
      }
      handle = null;
    };
  },
};
