/**
 * Sheet open/close store (src/ui/sheets.ts:56-81), backed by the layer stack
 * in layers.ts. `closeAllLayers()` in `afterEach` resets both modules between
 * tests, since a sheet's registered `close()` is `closeSheet`, which pops
 * through to layers.ts.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { closeAllLayers } from '../../src/ui/layers';
import { closeSheet, getSheetPayload, isSheetOpen, openSheet } from '../../src/ui/sheets';

afterEach(() => {
  closeAllLayers();
});

describe('openSheet', () => {
  it('opens a sheet that was not open', () => {
    expect(openSheet('timer')).toBe(true);
    expect(isSheetOpen('timer')).toBe(true);
  });

  it('a double openSheet returns false and does not stack it twice', () => {
    expect(openSheet('mixes')).toBe(true);
    expect(openSheet('mixes')).toBe(false);
    // One close should be enough to fully close it if it never stacked.
    expect(closeSheet('mixes')).toBe(true);
    expect(isSheetOpen('mixes')).toBe(false);
  });
});

describe('closeSheet', () => {
  it('returns false for a sheet that was never opened', () => {
    expect(closeSheet('evidence')).toBe(false);
  });
});

describe('payload', () => {
  it('is undefined for a sheet that was never opened', () => {
    expect(getSheetPayload('unlock')).toBeUndefined();
  });

  it('is readable while the sheet is open', () => {
    const payload = { reason: 'locked' as const };
    openSheet('unlock', payload);
    expect(getSheetPayload('unlock')).toBe(payload);
  });

  it('survives a close, so the slide-down animation can still read it', () => {
    const payload = { reason: 'locked' as const };
    openSheet('unlock', payload);
    closeSheet('unlock');
    expect(isSheetOpen('unlock')).toBe(false);
    expect(getSheetPayload('unlock')).toBe(payload);
  });

  it('is replaced (not merged) by the next openSheet call', () => {
    openSheet('unlock', { reason: 'locked' as const });
    closeSheet('unlock');
    openSheet('unlock', { reason: 'trial-ended' as const });
    expect(getSheetPayload('unlock')).toEqual({ reason: 'trial-ended' });
  });
});
