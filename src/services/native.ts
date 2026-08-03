/**
 * The single seam between Quietloom and the platform.
 *
 * Nothing else in the app may import a platform module for these concerns
 * directly. Every method here is safe to call on any platform, including web
 * (`expo start --web`), where they all degrade to no-ops (or, for openUrl, to
 * the browser itself).
 *
 * Public API (FROZEN CONTRACT):
 *   Native.isNative()            -> boolean            (sync, safe before init)
 *   Native.platform()            -> 'android'|'ios'|'web'
 *   Native.keepAwake(on)         -> Promise<boolean>   true if a lock is held
 *   Native.backgroundMode(on)    -> Promise<boolean>   see BACKGROUND AUDIO below
 *   Native.openUrl(url)          -> Promise<void>
 *   Native.onBackButton(handler) -> () => void         unsubscribe function
 *   Native.onAppStateChange(h)   -> () => void         unsubscribe function
 *
 * ---------------------------------------------------------------------------
 * BACKGROUND AUDIO — where it actually lives in this build.
 *
 * The web/Capacitor build shipped backgroundMode() as a DOCUMENTED NO-OP: the
 * only plugin on offer demanded RECORD_AUDIO, SYSTEM_ALERT_WINDOW and a
 * hand-reviewed "special use" foreground service, and a sleep app that asks
 * for the microphone is a trust catastrophe and a near-certain Play review
 * rejection. It was rejected on purpose, and the wake lock stood in.
 *
 * The RN build gets real background audio from the audio stack instead:
 * react-native-audio-api runs a `mediaPlayback` foreground service with a
 * media notification (configured in app.json, wired by the audio module),
 * which is exactly the first-party fix the web build's TODO asked for — zero
 * extra permissions, a proper lockscreen transport, and it passes Play review.
 *
 * backgroundMode() therefore stays only for contract compatibility: it keeps
 * a screen wake-lock request slot as a belt-and-braces fallback, and
 * keep-awake's real job is now just the bedside-mode screen hold.
 * ---------------------------------------------------------------------------
 */

import { AppState, BackHandler, Linking, Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as WebBrowser from 'expo-web-browser';

/** Tag for our keep-awake lock so we never release someone else's. */
const WAKE_TAG = 'quietloom-bedside';

/** True on a device/emulator, false on web. Correct from the first call. */
const nativeFlag = Platform.OS === 'android' || Platform.OS === 'ios';

/**
 * Two independent reasons to hold the screen awake. Either one keeps it on;
 * we only release when both are off. Prevents backgroundMode(false) from
 * stomping an active bedside session and vice versa.
 */
const wakeRequests = { keepAwake: false, backgroundMode: false };
let wakeApplied = false;

/** Apply or release the wake lock to match the current request flags. */
async function reconcileWakeLock(): Promise<boolean> {
  const want = wakeRequests.keepAwake || wakeRequests.backgroundMode;
  if (want === wakeApplied) return wakeApplied;

  if (!nativeFlag) {
    wakeApplied = false;
    return false;
  }

  try {
    if (want) await activateKeepAwakeAsync(WAKE_TAG);
    else await deactivateKeepAwake(WAKE_TAG);
    wakeApplied = want;
  } catch (err) {
    console.warn('[native] keep-awake toggle failed', err);
  }
  return wakeApplied;
}

/* ------------------------------------------------------------------------ */

export const Native = {
  /**
   * Synchronous and correct from the very first call — Platform.OS is a
   * compile-time constant, there is no plugin to wait for. False on web.
   */
  isNative(): boolean {
    return nativeFlag;
  },

  /** 'android' | 'ios' | 'web'. Useful for platform-specific copy. */
  platform(): 'android' | 'ios' | 'web' {
    const os = Platform.OS;
    return os === 'android' || os === 'ios' ? os : 'web';
  },

  /**
   * Hold the screen on (bedside mode). Releasing is what actually matters for
   * battery, so always pair a keepAwake(true) with a keepAwake(false).
   *
   * @returns whether a wake lock is now held. Always false on web.
   */
  async keepAwake(on: boolean): Promise<boolean> {
    wakeRequests.keepAwake = !!on;
    return reconcileWakeLock();
  },

  /**
   * Background audio protection. In this build the protection itself is the
   * audio stack's `mediaPlayback` foreground service (see the header) — this
   * method no longer creates it. It keeps a wake-lock request slot as a
   * belt-and-braces fallback and reports whether protection is active: true
   * on a native platform while on, false on web, so callers can show honest
   * UI.
   */
  async backgroundMode(on: boolean): Promise<boolean> {
    wakeRequests.backgroundMode = !!on;
    const held = await reconcileWakeLock();

    if (!nativeFlag) return false;
    if (on && !held) {
      console.info(
        '[native] wake-lock fallback not held — audio still protected by the mediaPlayback service',
      );
    }
    return !!on;
  },

  /**
   * Open an external link (the research citations). Uses the in-app browser
   * sheet (Custom Tab / SFSafariViewController), falling back to the system
   * default via Linking. Never throws.
   */
  async openUrl(url: string): Promise<void> {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      console.warn('[native] refusing to open non-http url', url);
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(url);
      return;
    } catch (err) {
      console.warn('[native] openBrowserAsync failed, falling back', err);
    }

    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn('[native] Linking.openURL failed', err);
    }
  },

  /**
   * Android hardware/gesture back button. Call the returned function to
   * unsubscribe. On web this returns a no-op unsubscribe immediately, so the
   * UI can wire it unconditionally.
   *
   * The handler receives { canGoBack } for shape-compatibility with the web
   * build (RN has no equivalent signal, so it is always false). If your
   * handler consumes the event (closed a sheet), return true — we then return
   * true to BackHandler and the event stops. Otherwise we return false and
   * the system default happens: since Android 12 that default, on a root
   * launcher activity, is move-task-to-back rather than destroy — which
   * matches the web app's deliberate minimise-not-exit choice. Someone
   * pressing back at bedtime wants the rain to keep playing.
   */
  onBackButton(handler: (info: { canGoBack: boolean }) => boolean | void): () => void {
    if (typeof handler !== 'function') return () => {};
    if (!nativeFlag) return () => {};

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      let consumed = false;
      try {
        consumed = handler({ canGoBack: false }) === true;
      } catch (err) {
        console.error('[native] backButton handler threw', err);
        consumed = true; // never let a UI bug exit the app mid-sleep
      }
      return consumed;
    });

    return () => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    };
  },

  /**
   * App foreground/background transitions — useful for pausing the scene
   * renderer while backgrounded. Returns an unsubscribe function.
   */
  onAppStateChange(handler: (isActive: boolean) => void): () => void {
    if (typeof handler !== 'function') return () => {};

    const sub = AppState.addEventListener('change', (state) => {
      try {
        handler(state === 'active');
      } catch (err) {
        console.error('[native] appStateChange handler threw', err);
      }
    });

    return () => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    };
  },
};
