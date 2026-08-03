/**
 * `formatClock` (hooks.ts:321-328) is pure, but the module it lives in is
 * Tier 3 on the Team Lead's own map (tasks/tests.md, 22:08:45): `hooks.ts`
 * imports `engine` from `../audio/engine`, which value-imports both
 * `AppState` from 'react-native' AND `AudioContext`/`GainNode`/
 * `WaveShaperNode` from 'react-native-audio-api'.
 *
 * `react-native` is now stubbed for real in this harness (__mocks__/
 * react-native.ts, aliased in vitest.config.mts) and needs nothing extra
 * here. `react-native-audio-api` is still deliberately WALLED
 * (__mocks__/unsupported-in-unit-tier.ts) — its own text says "do not mock
 * your way in, ask for a seam". That guidance is aimed at logic genuinely
 * entangled with native/renderer behaviour, where a wrong mock can launder a
 * false pass (QA's silent-audio-mock trap). `formatClock` is arithmetic on a
 * plain number and never touches AudioContext/GainNode/WaveShaperNode, so
 * the local stub below is inert with respect to what is under test — it
 * exists only to get past an unrelated sibling import, not to fake behaviour
 * this test relies on. `AudioEngine`'s constructor (engine.ts:216-235) only
 * calls `AppState.addEventListener` at module load; `new AudioContext()` is
 * deferred to `_ensureContext()`, called lazily on `start()`, so the classes
 * below are never constructed.
 *
 * Disclosed rather than requested: the durable fix is a seam — move
 * `formatClock` out of hooks.ts (mirroring how S4 moves `layerEqual` into
 * mixState.ts) so it needs no mock at all. That is out of this wave's
 * authorised scope (S4 covers only `layerEqual`), so it is written here for
 * routing rather than made. This vi.mock is local to this test file only —
 * no production file or shared config changed.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-audio-api', () => ({
  AudioContext: class {},
  GainNode: class {},
  WaveShaperNode: class {},
}));

import { formatClock } from '../../src/ui/hooks';

describe('formatClock', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatClock(0)).toBe('0:00');
  });

  it('formats 59 seconds as 0:59, one below the minute rollover', () => {
    expect(formatClock(59)).toBe('0:59');
  });

  it('rolls 60 seconds over to 1:00, not "0:60"', () => {
    expect(formatClock(60)).toBe('1:00');
  });

  it('switches format once an hour is involved: 3600s is 1:00:00, not 60:00', () => {
    expect(formatClock(3600)).toBe('1:00:00');
  });

  it('clamps a negative duration to 0:00 rather than printing a negative time', () => {
    expect(formatClock(-5)).toBe('0:00');
  });
});
