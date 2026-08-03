/**
 * The modal layer stack — the RN port of the stack half of src/ui/sheet.js.
 *
 * Every modal surface in Quietloom (bottom sheets, bedside, breathing)
 * registers here so that:
 *   - Android back can close exactly one surface at a time (`closeTopLayer`),
 *   - a scrim tap / service can ask "is anything covering the screen?"
 *     synchronously,
 *   - nothing can ever be opened twice and stack on top of itself.
 *
 * Deliberately module-level state, NOT React state: the ad service and the
 * composition root query it synchronously (banner reconciliation, back-button
 * handling) without waiting for a render. React code re-renders through
 * `subscribeLayers()` — see `useLayersVersion()` in hooks.ts.
 */

interface Layer {
  key: string;
  close: () => void;
}

const layers: Layer[] = [];

let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  version += 1;
  // Copy first: a listener may subscribe/unsubscribe while we iterate.
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (err) {
      console.error('[ui] layer listener threw', err);
    }
  }
}

/**
 * Register a surface on the layer stack so the back button (and
 * `closeTopLayer`) can dismiss it.
 *
 * @param key   Unique key for the surface, e.g. `'bedside'` or `'sheet:timer'`.
 * @param close Called when the stack wants this surface gone. It MUST end up
 *              calling `popLayer(key)` (directly or via `closeSheet`).
 * @returns false if the key is already on the stack (never stack a surface
 *          on itself).
 */
export function pushLayer(key: string, close: () => void): boolean {
  if (layers.some((l) => l.key === key)) return false;
  layers.push({ key, close });
  notify();
  return true;
}

/**
 * Remove a surface from the stack (any position, not just the top — a sheet
 * can be closed directly while an overlay sits above it).
 * @returns false if the key was not on the stack.
 */
export function popLayer(key: string): boolean {
  const i = layers.findIndex((l) => l.key === key);
  if (i === -1) return false;
  layers.splice(i, 1);
  notify();
  return true;
}

/** Is this specific surface currently open? */
export function isLayerOpen(key: string): boolean {
  return layers.some((l) => l.key === key);
}

/** Is anything modal covering the screen? (Used for banner reconciliation.) */
export function anyLayerOpen(): boolean {
  return layers.length > 0;
}

/**
 * Close the top-most surface by calling its `close()`. The composition root
 * wires the Android hardware back button to this.
 *
 * @returns false when the stack is empty (back should then leave the app /
 *          do its default thing).
 */
export function closeTopLayer(): boolean {
  const top = layers[layers.length - 1];
  if (!top) return false;
  try {
    top.close();
  } catch (err) {
    console.warn('[ui] layer close failed', err);
    popLayer(top.key);
  }
  // A close() that "succeeded" but forgot to pop would wedge the stack (and
  // loop closeAllLayers forever) — force the pop so the stack stays honest.
  if (layers[layers.length - 1] === top) popLayer(top.key);
  return true;
}

/** Close everything, top-down (e.g. before entering bedside mode). */
export function closeAllLayers(): void {
  while (layers.length) {
    if (!closeTopLayer()) break;
  }
}

/**
 * Subscribe to every push/pop. Returns the unsubscribe function.
 * UI code should prefer `useLayersVersion()` from hooks.ts.
 */
export function subscribeLayers(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Monotonic change counter — bumps on every push/pop. Exists so hooks can use
 * `useSyncExternalStore(subscribeLayers, getLayersVersion)` without tearing.
 * (Additive to the spec'd API; safe to ignore.)
 */
export function getLayersVersion(): number {
  return version;
}
