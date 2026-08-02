/**
 * localStorage wrapper. Every persisted key in the app lives here so there is
 * one place to look when something does not survive a restart.
 */

export const KEYS = {
  mixes: 'drift.mixes',
  lastMix: 'drift.lastMix',
  premium: 'drift.premium',
  nightPass: 'drift.nightPass',
  lastInterstitialDay: 'drift.lastInterstitialDay',
  settings: 'drift.settings',
  seenIntro: 'drift.seenIntro',
};

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('[store] write failed', key, err);
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const DEFAULT_SETTINGS = {
  timerMinutes: 45, // research: we default to turning ourselves off
  timerEnabled: true,
  chime: false,
  nurserySafe: false, // hard-caps master output for use near an infant
  breathPattern: 'coherence', // 'coherence' (6 bpm) | '478'
  reduceMotion: false,
};

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(read(KEYS.settings, {}) || {}) };
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write(KEYS.settings, next);
  return next;
}
