/**
 * The modal layer stack (src/ui/layers.ts:49-106). Module-level singleton
 * state, so each `it` here either uses a fresh key or cleans up via
 * `closeAllLayers()` in `afterEach` — otherwise state leaks between tests
 * that share this module registry (see vitest.config.mts's `isolate` note).
 *
 * No mock-was-called assertions anywhere below: every assertion is either a
 * return value or the observable state of the stack (`isLayerOpen` /
 * `anyLayerOpen`), per the task's lead 5.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  anyLayerOpen,
  closeAllLayers,
  closeTopLayer,
  isLayerOpen,
  popLayer,
  pushLayer,
} from '../../src/ui/layers';

afterEach(() => {
  // closeAllLayers is itself under test below; it is also the simplest
  // correct way to guarantee no layer survives into the next test.
  closeAllLayers();
});

describe('pushLayer', () => {
  it('opens a new key', () => {
    expect(pushLayer('a', () => popLayer('a'))).toBe(true);
    expect(isLayerOpen('a')).toBe(true);
  });

  it('a double pushLayer returns false and does not stack the key twice', () => {
    expect(pushLayer('dup', () => {})).toBe(true);
    expect(pushLayer('dup', () => {})).toBe(false);
    // If the second push had wrongly stacked on top, a single pop would
    // leave one more copy open. It does not.
    expect(popLayer('dup')).toBe(true);
    expect(isLayerOpen('dup')).toBe(false);
  });
});

describe('closeTopLayer', () => {
  it('returns false when the stack is empty', () => {
    expect(closeTopLayer()).toBe(false);
  });

  it('force-pops a close() that forgot to call popLayer itself', () => {
    pushLayer('forgetful', () => {
      /* a broken surface that never pops itself */
    });
    expect(isLayerOpen('forgetful')).toBe(true);
    expect(closeTopLayer()).toBe(true);
    expect(isLayerOpen('forgetful')).toBe(false);
  });

  it('closes only the top of the stack, leaving what is underneath open', () => {
    // Push order is bottom-to-top: 'under' first, then 'top' — the stack's
    // top is the *last* pushed key (layers.ts:87).
    pushLayer('under', () => popLayer('under'));
    pushLayer('top', () => popLayer('top'));
    expect(closeTopLayer()).toBe(true);
    expect(isLayerOpen('top')).toBe(false);
    expect(isLayerOpen('under')).toBe(true);
  });
});

describe('closeAllLayers', () => {
  it('empties the stack even when a close() throws partway through', () => {
    pushLayer('a', () => popLayer('a'));
    pushLayer('b', () => {
      throw new Error('boom');
    });
    pushLayer('c', () => popLayer('c'));

    expect(() => closeAllLayers()).not.toThrow();
    expect(anyLayerOpen()).toBe(false);
    expect(isLayerOpen('a')).toBe(false);
    expect(isLayerOpen('b')).toBe(false);
    expect(isLayerOpen('c')).toBe(false);
  });

  it('leaves nothing open when every close() behaves', () => {
    pushLayer('x', () => popLayer('x'));
    pushLayer('y', () => popLayer('y'));
    closeAllLayers();
    expect(anyLayerOpen()).toBe(false);
  });
});
