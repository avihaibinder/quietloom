/**
 * React glue for the module-level stores (bus, layers, sheets, settings,
 * scene). These hooks are the ONLY sanctioned re-render paths — the stores
 * themselves stay synchronous and framework-free so services can use them.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { engine } from '../audio/engine';
import { bus } from '../core/bus';
import { getSettings, setSettings } from '../core/store';
import type { Settings } from '../core/store';
import {
  SOUND_IDS,
  type BusEvent,
  type BusEvents,
  type EngineState,
  type LayerState,
  type SceneId,
  type SoundId,
} from '../types';
import { getLayersVersion, subscribeLayers } from './layers';
import { layerEqual } from './mixState';
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

/* --------------------------------------------------------------------- mix */

/*
 * `mix:changed` is the app's only animation-frequency event: the slider fires
 * it on every touch-move, and every emit carries a freshly allocated
 * EngineState (engine.getState() rebuilds 1 + 11 + 11 objects). Handing that
 * whole payload to a component therefore re-renders it ~60 times a second
 * during a drag, whether or not anything it draws actually moved.
 *
 * So this module holds ONE bus subscription, splits the payload per layer and
 * compares by VALUE. A layer's listeners are woken only when that layer's own
 * numbers changed, so dragging rain's level re-renders the rain card and
 * nothing else. Same shape as useSettings above — an external store plus
 * useSyncExternalStore — and the store stays synchronous and framework-free.
 *
 * getState()'s shape and the mix:changed payload are frozen contracts; this
 * only reads them.
 */

/** Returned for an id the engine does not know, so callers never see undefined. */
const EMPTY_LAYER: LayerState = Object.freeze({ enabled: false, volume: 0, params: {} });

let mixState: EngineState | null = null;
let masterSnapshot = 0;
/** Per-layer snapshots, replaced only when that layer's values change. */
const layerSnapshots = new Map<SoundId, LayerState>();
const layerListeners = new Map<SoundId, Set<() => void>>();
const masterListeners = new Set<() => void>();

function notifyAll(set: Set<() => void> | undefined): void {
  if (!set || set.size === 0) return;
  for (const fn of [...set]) {
    try {
      fn();
    } catch (err) {
      console.error('[ui] mix listener threw', err);
    }
  }
}

/**
 * Fold a new EngineState into the snapshots. Eleven value comparisons per
 * emit, in place of the 60–100 component renders the whole-state broadcast
 * used to cost.
 */
function applyMixState(next: EngineState, notify: boolean): void {
  mixState = next;

  if (next.master !== masterSnapshot) {
    masterSnapshot = next.master;
    if (notify) notifyAll(masterListeners);
  }

  for (const id of SOUND_IDS) {
    const nextLayer = next.layers[id] ?? EMPTY_LAYER;
    if (layerEqual(layerSnapshots.get(id), nextLayer)) continue;
    layerSnapshots.set(id, nextLayer);
    if (notify) notifyAll(layerListeners.get(id));
  }
}

/** Seed from the engine on first read — a restored session must not paint zeroes. */
function ensureMixState(): EngineState {
  if (!mixState) applyMixState(engine.getState(), false);
  return mixState as EngineState;
}

// Module-level, like the scene subscription below: the snapshots must stay
// current even when no mixer is mounted (bedside mode has none on screen).
bus.on('mix:changed', (state) => {
  applyMixState(state, true);
});

function subscribeLayer(id: SoundId, fn: () => void): () => void {
  const existing = layerListeners.get(id);
  const set = existing ?? new Set<() => void>();
  if (!existing) layerListeners.set(id, set);
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

function getLayerSnapshot(id: SoundId): LayerState {
  ensureMixState();
  return layerSnapshots.get(id) ?? EMPTY_LAYER;
}

function subscribeMaster(fn: () => void): () => void {
  masterListeners.add(fn);
  return () => {
    masterListeners.delete(fn);
  };
}

function getMasterSnapshot(): number {
  ensureMixState();
  return masterSnapshot;
}

/**
 * One layer's state. Re-renders the caller ONLY when that layer's own
 * enabled / volume / params change — not when any other layer, or the master,
 * or `running` moves. The returned object keeps its identity until one of
 * those values actually changes, so it is safe to use as a dependency.
 */
export function useLayerState(id: SoundId): LayerState {
  const subscribe = useCallback((fn: () => void) => subscribeLayer(id, fn), [id]);
  const snapshot = useCallback(() => getLayerSnapshot(id), [id]);
  return useSyncExternalStore(subscribe, snapshot);
}

/** The master volume (0..1). Re-renders the caller only when it changes. */
export function useMasterVolume(): number {
  return useSyncExternalStore(subscribeMaster, getMasterSnapshot);
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
