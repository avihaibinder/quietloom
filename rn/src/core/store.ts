/**
 * Persistence. Every persisted key in the app lives here so there is one place
 * to look when something does not survive a restart.
 *
 * AsyncStorage is asynchronous, but the whole app was written against a
 * synchronous store (and stays far simpler that way), so this module keeps an
 * in-memory cache: `hydrate()` loads every known key once at boot — App waits
 * for it before rendering — and after that `read` is synchronous from cache
 * while `write` updates the cache synchronously and flushes to AsyncStorage
 * behind it. A lost flush costs one night of state, not a crash.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SceneId } from '../types';

export const KEYS = {
  mixes: 'quietloom.mixes',
  lastMix: 'quietloom.lastMix',
  premium: 'quietloom.premium',
  nightPass: 'quietloom.nightPass',
  lastInterstitialDay: 'quietloom.lastInterstitialDay',
  settings: 'quietloom.settings',
  seenIntro: 'quietloom.seenIntro',
} as const;

export type StoreKey = (typeof KEYS)[keyof typeof KEYS];

const cache = new Map<string, unknown>();
let hydrated = false;

/** Load every known key into the cache. Call once, before the UI mounts. */
export async function hydrate(): Promise<void> {
  if (hydrated) return;
  try {
    const pairs = await AsyncStorage.multiGet(Object.values(KEYS));
    for (const [key, raw] of pairs) {
      if (raw === null || raw === undefined) continue;
      try {
        cache.set(key, JSON.parse(raw));
      } catch {
        /* corrupt entry — treat as absent */
      }
    }
  } catch (err) {
    console.warn('[store] hydrate failed — starting from defaults', err);
  }
  hydrated = true;
}

export function isHydrated(): boolean {
  return hydrated;
}

export function read<T>(key: StoreKey, fallback: T): T {
  if (!hydrated) console.warn('[store] read before hydrate', key);
  return cache.has(key) ? (cache.get(key) as T) : fallback;
}

export function write(key: StoreKey, value: unknown): boolean {
  cache.set(key, value);
  AsyncStorage.setItem(key, JSON.stringify(value)).catch((err) => {
    console.warn('[store] write failed', key, err);
  });
  return true;
}

export function remove(key: StoreKey): void {
  cache.delete(key);
  AsyncStorage.removeItem(key).catch(() => {
    /* ignore */
  });
}

/* ---------------------------------------------------------------- settings */

export type BreathPattern = 'coherence' | '478';

export interface Settings {
  timerMinutes: number;
  timerEnabled: boolean;
  chime: boolean;
  nurserySafe: boolean;
  breathPattern: BreathPattern;
  reduceMotion: boolean;
  scene?: SceneId;
}

export const DEFAULT_SETTINGS: Settings = {
  timerMinutes: 45, // research: we default to turning ourselves off
  timerEnabled: true,
  chime: false,
  nurserySafe: false, // hard-caps master output for use near an infant
  breathPattern: 'coherence', // 6 bpm — the pattern with the stronger evidence
  reduceMotion: false,
};

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.settings, {}) };
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  write(KEYS.settings, next);
  return next;
}
