/**
 * React glue for the module-level stores (bus, layers, sheets, settings,
 * scene). These hooks are the ONLY sanctioned re-render paths — the stores
 * themselves stay synchronous and framework-free so services can use them.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { bus } from '../core/bus';
import { getSettings, setSettings } from '../core/store';
import type { Settings } from '../core/store';
import type { BusEvent, BusEvents, SceneId } from '../types';
import { getLayersVersion, subscribeLayers } from './layers';
import { getSheetPayload, getSheetsVersion, isSheetOpen, subscribeSheets } from './sheets';
import type { SheetId } from './sheets';
import { SCENE_ACCENTS } from './theme';
import type { SceneAccent } from './theme';

/* -------------------------------------------------------------------- bus */

/**
 * Subscribe to a bus event for the lifetime of the component.
 *
 * Latest-ref pattern: the subscription is made once per event name, but the
 * handler read at call time is always the freshest render's — so callers can
 * close over props/state without re-subscribing (and without missing events
 * during the gap a re-subscribe would open).
 */
export function useBusEvent<E extends BusEvent>(
  event: E,
  handler: (payload: BusEvents[E]) => void,
): void {
  const saved = useRef(handler);
  useEffect(() => {
    saved.current = handler;
  });
  useEffect(() => {
    return bus.on(event, (payload: BusEvents[E]) => {
      saved.current(payload);
    });
  }, [event]);
}

/* ------------------------------------------------------------------ layers */

/**
 * Re-render whenever the layer stack changes (push or pop). Returns the
 * stack's change counter — useful only as a dependency; read the actual
 * state via `isLayerOpen` / `anyLayerOpen` from layers.ts.
 */
export function useLayersVersion(): number {
  return useSyncExternalStore(subscribeLayers, getLayersVersion);
}

/* ------------------------------------------------------------------ sheets */

/**
 * Track one sheet's open state and payload. Re-renders on every sheet-store
 * change (they are rare enough that per-id granularity isn't worth it).
 */
export function useSheet(id: SheetId): { open: boolean; payload: unknown } {
  useSyncExternalStore(subscribeSheets, getSheetsVersion);
  return { open: isSheetOpen(id), payload: getSheetPayload(id) };
}

/* ---------------------------------------------------------------- settings */

/*
 * Settings have no bus event (same as the web build), so this module keeps
 * its own version counter and the hook is the single re-render path. Any
 * code that writes settings OUTSIDE the hook's setter must call
 * `notifySettingsChanged()` afterwards or the UI will not repaint.
 */
let settingsVersion = 0;
const settingsListeners = new Set<() => void>();

/** Tell every mounted `useSettings()` that settings changed under it. */
export function notifySettingsChanged(): void {
  settingsVersion += 1;
  for (const fn of [...settingsListeners]) {
    try {
      fn();
    } catch (err) {
      console.error('[ui] settings listener threw', err);
    }
  }
}

function subscribeSettings(fn: () => void): () => void {
  settingsListeners.add(fn);
  return () => {
    settingsListeners.delete(fn);
  };
}

function getSettingsVersion(): number {
  return settingsVersion;
}

/**
 * `[settings, patch]` — reads `getSettings()` fresh on every store change.
 * The setter writes through `setSettings(patch)` and then notifies ALL
 * mounted `useSettings()` hooks. The setter identity is stable.
 */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  useSyncExternalStore(subscribeSettings, getSettingsVersion);
  const apply = useCallback((patch: Partial<Settings>) => {
    setSettings(patch);
    notifySettingsChanged();
  }, []);
  return [getSettings(), apply];
}

/* ------------------------------------------------------------------- scene */

/*
 * The current scene, mirrored from bus 'scene:changed'. Default matches the
 * web's restoreSession fallback ('rain'). Module-level so the accent is
 * right even for components mounted before the first scene event.
 */
let currentScene: SceneId = 'rain';
let sceneVersion = 0;
const sceneListeners = new Set<() => void>();

function applyScene(scene: SceneId): void {
  if (scene === currentScene) return;
  currentScene = scene;
  sceneVersion += 1;
  for (const fn of [...sceneListeners]) {
    try {
      fn();
    } catch (err) {
      console.error('[ui] scene listener threw', err);
    }
  }
}

// Module-level subscription: the scene store must track 'scene:changed' even
// while no component is mounted (e.g. during bedside mode).
bus.on('scene:changed', ({ scene }) => {
  applyScene(scene);
});

/**
 * Seed the scene WITHOUT a bus event. The composition root calls this after
 * session restore ('scene:changed' is only emitted on user switches, so a
 * restored session would otherwise paint the default accent).
 */
export function primeSceneAccent(scene: SceneId): void {
  applyScene(scene);
}

function subscribeScene(fn: () => void): () => void {
  sceneListeners.add(fn);
  return () => {
    sceneListeners.delete(fn);
  };
}

function getSceneVersion(): number {
  return sceneVersion;
}

/**
 * The accent palette of the current scene (SCENE_ACCENTS[scene] from theme).
 * Re-renders on 'scene:changed' and on `primeSceneAccent`.
 */
export function useSceneAccent(): SceneAccent {
  useSyncExternalStore(subscribeScene, getSceneVersion);
  return SCENE_ACCENTS[currentScene];
}

/* ------------------------------------------------------------------- clock */

/**
 * Seconds → "m:ss", or "h:mm:ss" once an hour is involved. Ported verbatim
 * from the web timer-ui.js so countdowns look identical.
 */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}
