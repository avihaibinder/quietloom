/**
 * Sheet open/close store — the RN port of the sheet half of src/ui/sheet.js.
 *
 * The web version mounted DOM skeletons; here the <Sheet> component owns its
 * own skeleton, so this module only tracks WHICH sheets are open and what
 * payload they were opened with. Open state itself lives on the layer stack
 * (`sheet:<id>` keys) — exactly like the web build — so a sheet is always
 * back-button dismissable and can never stack on itself.
 *
 * Module-level (not React state) so services and non-React code can query and
 * drive it synchronously. React code re-renders via `subscribeSheets()` —
 * see `useSheet()` in hooks.ts.
 */

import { isLayerOpen, popLayer, pushLayer } from './layers';

/** Every bottom sheet in the app. The content agent renders one <Sheet> per id. */
export type SheetId = 'timer' | 'unlock' | 'evidence' | 'mixes';

/** The layer-stack key for a sheet — same convention as the web build. */
function layerKey(id: SheetId): string {
  return `sheet:${id}`;
}

/**
 * Payload the sheet was last opened with (e.g. the paywall context
 * `{ reason?, lockedIds? }` or an evidence entry). Kept after close so the
 * content can still render it during the slide-down animation; replaced on
 * the next `openSheet`.
 */
const payloads = new Map<SheetId, unknown>();

let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  version += 1;
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (err) {
      console.error('[ui] sheet listener threw', err);
    }
  }
}

/**
 * Open a sheet, optionally with a payload for its content to read via
 * `getSheetPayload` / `useSheet`.
 *
 * Pushes `sheet:<id>` onto the layer stack with a close fn, so scrim taps,
 * Android back and `closeAllLayers()` all funnel through `closeSheet`.
 *
 * @returns false if the sheet is already open — never stack a sheet on itself.
 */
export function openSheet(id: SheetId, payload?: unknown): boolean {
  if (isSheetOpen(id)) return false;
  payloads.set(id, payload);
  pushLayer(layerKey(id), () => {
    closeSheet(id);
  });
  notify();
  return true;
}

/**
 * Close a sheet (pops its layer). The <Sheet> component notices via the store
 * subscription and runs its own slide-down animation.
 * @returns false if the sheet was not open.
 */
export function closeSheet(id: SheetId): boolean {
  if (!isSheetOpen(id)) return false;
  popLayer(layerKey(id));
  notify();
  return true;
}

/** Is this sheet open? (Source of truth is the layer stack, as on the web.) */
export function isSheetOpen(id: SheetId): boolean {
  return isLayerOpen(layerKey(id));
}

/**
 * The payload passed to the most recent `openSheet(id, payload)`.
 * `undefined` if the sheet was never opened or was opened without one.
 * Retained after close (see note on `payloads`).
 */
export function getSheetPayload(id: SheetId): unknown {
  return payloads.get(id);
}

/**
 * Subscribe to every sheet open/close. Returns the unsubscribe function.
 * UI code should prefer `useSheet(id)` from hooks.ts.
 */
export function subscribeSheets(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Monotonic change counter for `useSyncExternalStore` snapshots.
 * (Additive to the spec'd API; safe to ignore.)
 */
export function getSheetsVersion(): number {
  return version;
}
