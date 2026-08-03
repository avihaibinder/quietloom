/**
 * Test map entries #6 (the chunked fill) and #14a (`poissonGap` bounds).
 *
 * `src/audio/scheduler.ts` has no runtime imports, so this is the fake context
 * plus vitest's fake timers and nothing else. Every assertion is on the TIMES
 * the scheduler handed to a task — the value that comes out — never on whether
 * something was called.
 *
 * What is actually at stake: Android throttles background JS timers to roughly
 * one callback a minute with the screen off, so anything discrete has to be
 * pre-scheduled on the audio clock. The 90 s horizon is the safety margin, and
 * the priming ramp is what stopped the play tap building all 90 s of it — ~1,305
 * droplets and ~61,000 JSI crossings — in one synchronous block.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { poissonGap, Scheduler } from '../../src/audio/scheduler';
import { asContext, createFakeContext, type FakeAudioContext } from '../fixtures/fake-audio-context';

/** scheduler.ts module constants, restated as the observable contract. */
const HORIZON = 90;
const PRIME_STEP = 6;
const PRIME_INTERVAL_MS = 60;
const TICK_MS = 5000;
const HARD_EVENT_CAP = 6000;
/** Chunks needed to walk PRIME_STEP up to HORIZON. */
const CHUNKS_TO_FULL = HORIZON / PRIME_STEP - 1;

interface Harness {
  ctx: FakeAudioContext;
  sched: Scheduler;
  times: number[];
  /** Adds a task that fires every `gap` seconds and records the time it was given. */
  task(gap: number, key?: string, opts?: Parameters<Scheduler['add']>[2]): number[];
}

function harness(): Harness {
  const ctx = createFakeContext();
  const sched = new Scheduler(asContext(ctx));
  const times: number[] = [];
  return {
    ctx,
    sched,
    times,
    task(gap, key = 'task', opts) {
      const out = key === 'task' ? times : [];
      sched.add(
        key,
        (t) => {
          out.push(t);
          return gap;
        },
        opts
      );
      return out;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('reaching the horizon in chunks', () => {
  it('adds nothing until it is started', () => {
    const h = harness();
    h.task(0.5);
    expect(h.times).toHaveLength(0);
    expect(h.sched.isRunning()).toBe(false);
  });

  it('fills exactly PRIME_STEP seconds synchronously on start, not the whole horizon', () => {
    const h = harness();
    h.task(0.5);
    h.sched.start();

    // 6 s of depth at a 0.5 s gap is 12 events: 0.0 .. 5.5.
    expect(h.times).toHaveLength(PRIME_STEP / 0.5);
    expect(h.times[0]).toBe(0);
    expect(h.times[h.times.length - 1]).toBe(PRIME_STEP - 0.5);
    // The point of the whole mechanism: the play tap does NOT build 90 s.
    expect(h.times.length).toBeLessThan(HORIZON / 0.5);
    expect(h.sched.isRunning()).toBe(true);
  });

  it('walks out to the full 90 s horizon one 6 s chunk per 60 ms', () => {
    const h = harness();
    h.task(0.5);
    h.sched.start();

    for (let chunk = 1; chunk <= CHUNKS_TO_FULL; chunk++) {
      vi.advanceTimersByTime(PRIME_INTERVAL_MS);
      const depth = PRIME_STEP * (chunk + 1);
      expect(h.times[h.times.length - 1]).toBe(depth - 0.5);
    }

    // Full depth: 90 s at a 0.5 s gap.
    expect(h.times).toHaveLength(HORIZON / 0.5);
    expect(h.times[h.times.length - 1]).toBe(HORIZON - 0.5);

    // 14 chunks at 60 ms is 0.84 s — the window in which the app holds less
    // than the full horizon. Short enough that the screen cannot time out in it.
    expect(CHUNKS_TO_FULL * PRIME_INTERVAL_MS).toBeLessThan(1000);
  });

  it('stops at the horizon and does not creep past it', () => {
    const h = harness();
    h.task(0.5);
    h.sched.start();
    vi.advanceTimersByTime(CHUNKS_TO_FULL * PRIME_INTERVAL_MS);
    const atFull = h.times.length;

    // Several more prime intervals and a full 5 s tick, with the audio clock
    // standing still: nothing further may be scheduled.
    vi.advanceTimersByTime(TICK_MS * 2);
    expect(h.times).toHaveLength(atFull);

    const last = h.times[h.times.length - 1];
    expect(last).toBeGreaterThan(HORIZON - 1);
    expect(last).toBeLessThan(HORIZON);
  });

  it('primes each task from shallow independently, so a 3am layer toggle is gentle too', () => {
    const h = harness();
    h.task(0.5);
    h.sched.start();
    vi.advanceTimersByTime(CHUNKS_TO_FULL * PRIME_INTERVAL_MS);
    expect(h.times).toHaveLength(HORIZON / 0.5);

    // A layer switched on four hours in.
    const late = h.task(0.5, 'late');
    expect(late).toHaveLength(PRIME_STEP / 0.5);
    expect(late[late.length - 1]).toBe(PRIME_STEP - 0.5);
    // ...and the established task is untouched by it.
    expect(h.times).toHaveLength(HORIZON / 0.5);

    vi.advanceTimersByTime(CHUNKS_TO_FULL * PRIME_INTERVAL_MS);
    expect(late).toHaveLength(HORIZON / 0.5);
  });

  it('advances with the audio clock rather than re-firing the past', () => {
    const h = harness();
    h.task(1);
    h.sched.start();
    vi.advanceTimersByTime(CHUNKS_TO_FULL * PRIME_INTERVAL_MS);
    expect(h.times).toHaveLength(HORIZON);

    // 30 s of audio elapses; a tick tops the horizon back up by 30 s of events.
    h.ctx.advance(30);
    vi.advanceTimersByTime(TICK_MS);
    expect(h.times).toHaveLength(HORIZON + 30);
    expect(h.times[h.times.length - 1]).toBe(HORIZON + 30 - 1);
  });
});

describe('surviving a throttled JS clock', () => {
  it('takes the whole horizon at once when a tick arrives far late', () => {
    const h = harness();
    h.task(0.5);
    h.sched.start();
    expect(h.times).toHaveLength(PRIME_STEP / 0.5);

    // Doze: the wall clock moved 20 s but our 5 s interval only just got a
    // callback. Ramping is pointless now — take everything while we have one.
    vi.setSystemTime(Date.now() + 20_000);
    h.sched.pump();

    expect(h.times).toHaveLength(HORIZON / 0.5);
    expect(h.times[h.times.length - 1]).toBe(HORIZON - 0.5);
  });

  it('abandons the ramp when a PRIMING chunk itself comes back late', () => {
    const h = harness();
    h.task(0.5);
    h.sched.start();
    expect(h.times).toHaveLength(PRIME_STEP / 0.5);

    // The 60 ms chunk is armed. Move the wall clock 2 s on BEFORE letting it
    // fire — the timer keeps its relative delay, so when it does run it is 2 s
    // past the due time it recorded, which is what Doze looks like from inside
    // a callback. One chunk, and the scheduler stops ramping and takes all 90 s.
    vi.setSystemTime(Date.now() + 2000);
    vi.advanceTimersByTime(PRIME_INTERVAL_MS);

    expect(h.times).toHaveLength(HORIZON / 0.5);
  });

  it('rejoins the present after a long suspend instead of firing every missed event', () => {
    const h = harness();
    h.task(0.5);
    h.sched.start();
    vi.advanceTimersByTime(CHUNKS_TO_FULL * PRIME_INTERVAL_MS);
    const beforeJump = h.times.length;
    expect(beforeJump).toBe(HORIZON / 0.5);

    // An hour of audio time passes with no pump at all.
    h.ctx.advance(3600);
    h.sched.pump();

    const added = h.times.length - beforeJump;
    // One horizon's worth, not 3600 s worth. This is the difference between a
    // resumed session and 7,200 orphaned nodes.
    expect(added).toBe(HORIZON / 0.5);
    expect(added).toBeLessThan(3600 / 0.5);

    // Nothing was scheduled in the hole, and the first new event rejoins just
    // ahead of now.
    const firstAfter = h.times[beforeJump];
    expect(firstAfter).toBeCloseTo(3600.02, 6);
    expect(h.times[beforeJump - 1]).toBeLessThan(HORIZON);
  });
});

describe('guards against a task that misbehaves', () => {
  it('substitutes a 0.05 s gap for zero, negative and NaN, and terminates', () => {
    for (const bad of [0, -1, NaN, 0.001]) {
      const h = harness();
      h.sched.add('bad', () => {
        h.times.push(0);
        return bad;
      });
      h.sched.start();
      // A returned 0 would be an infinite loop without the guard. The fallback
      // is 0.05 s, so 6 s of depth is 120 events -- or 121, because `next` is
      // accumulated by repeated `+=` and 0.05 is not exactly representable, so
      // after 120 steps the cursor sits ~2e-15 SHORT of 6 and squeezes one more
      // event in. Measured, and bounded on both sides rather than papered over.
      expect(h.times.length).toBeGreaterThanOrEqual(PRIME_STEP / 0.05);
      expect(h.times.length).toBeLessThanOrEqual(PRIME_STEP / 0.05 + 1);
    }
  });

  it('spaces the fallback at 0.05 s rather than merely not hanging', () => {
    const h = harness();
    h.task(0);
    h.sched.start();
    for (let i = 1; i < h.times.length; i++) {
      expect(h.times[i] - h.times[i - 1]).toBeCloseTo(0.05, 9);
    }
  });

  it('caps a pathological rate at HARD_EVENT_CAP events per pump', () => {
    const h = harness();
    h.task(0.003); // 30,000 events would fit in the horizon
    h.sched.start();
    const primed = h.times.length;
    expect(primed).toBe(PRIME_STEP / 0.003);

    vi.setSystemTime(Date.now() + 20_000);
    h.sched.pump();
    expect(h.times.length - primed).toBe(HARD_EVENT_CAP);
  });

  it('honours a per-task maxAhead', () => {
    const h = harness();
    const capped = h.task(0.5, 'capped', { maxAhead: 10 });
    h.sched.start();
    expect(capped).toHaveLength(10); // would be 12 uncapped
  });

  it('drops a throwing task and keeps its siblings running', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const h = harness();
      const good = h.task(0.5, 'good');
      let calls = 0;
      h.sched.add('bad', (t) => {
        calls++;
        if (calls === 3) throw new Error('boom');
        return 0.5;
      });

      expect(() => h.sched.start()).not.toThrow();
      expect(calls).toBe(3);
      expect(good).toHaveLength(PRIME_STEP / 0.5);

      // The bad task is gone for good; the good one keeps filling.
      vi.advanceTimersByTime(CHUNKS_TO_FULL * PRIME_INTERVAL_MS);
      expect(calls).toBe(3);
      expect(good).toHaveLength(HORIZON / 0.5);
    } finally {
      err.mockRestore();
    }
  });
});

describe('start, stop and placement', () => {
  it('stop() clears the tasks and the timers', () => {
    const h = harness();
    h.task(0.5);
    h.sched.start();
    const atStop = h.times.length;

    h.sched.stop();
    expect(h.sched.isRunning()).toBe(false);

    h.ctx.advance(60);
    vi.advanceTimersByTime(TICK_MS * 3);
    expect(h.times).toHaveLength(atStop);
  });

  it('remove() takes one task out and leaves the rest', () => {
    const h = harness();
    const a = h.task(0.5, 'a');
    const b = h.task(0.5, 'b');
    h.sched.start();
    const aAtRemoval = a.length;

    h.sched.remove('a');
    vi.advanceTimersByTime(CHUNKS_TO_FULL * PRIME_INTERVAL_MS);

    expect(a).toHaveLength(aAtRemoval);
    expect(b).toHaveLength(HORIZON / 0.5);
  });

  it('places the first event at startAt, and never in the past', () => {
    const h = harness();
    h.ctx.currentTime = 100;
    const at = h.task(1, 'at', { startAt: 103 });
    const past = h.task(1, 'past', { startAt: 5 });
    const delayed = h.task(1, 'delayed', { startDelay: 2 });
    h.sched.start();

    expect(at[0]).toBe(103);
    // A startAt behind the clock is clamped to now, not replayed.
    expect(past[0]).toBe(100);
    expect(delayed[0]).toBe(102);
  });
});

describe('poissonGap — entry #14a', () => {
  const RATES = [0.5, 4, 25];
  const N = 100_000;

  it('never leaves the clamp, and reaches both ends of it', () => {
    for (const rate of RATES) {
      const floor = 0.12 / rate;
      const ceiling = 3.5 / rate;
      let min = Infinity;
      let max = -Infinity;
      let atFloor = 0;
      let atCeiling = 0;

      for (let i = 0; i < N; i++) {
        const g = poissonGap(rate);
        if (g < min) min = g;
        if (g > max) max = g;
        if (g === floor) atFloor++;
        if (g === ceiling) atCeiling++;
      }

      expect(min).toBe(floor);
      expect(max).toBe(ceiling);

      // Bounds alone are a one-sided-shaped test: a generator stuck at a
      // constant inside the range would pass them. The clamp PROPORTIONS are
      // the two-sided form, and they follow from the exponential itself:
      // P(gap < floor) = 1 - exp(-0.12) = 0.1131, P(gap > ceiling) = exp(-3.5)
      // = 0.0302. Bands are ~+/-15% of those, ~50 sigma at N = 100,000.
      expect(atFloor / N).toBeGreaterThan(0.096);
      expect(atFloor / N).toBeLessThan(0.131);
      expect(atCeiling / N).toBeGreaterThan(0.025);
      expect(atCeiling / N).toBeLessThan(0.036);
    }
  });

  it('has the mean the clamped exponential requires', () => {
    // E[min(max(X, a), b)] for X ~ Exp(1), in units of the unclamped mean 1/r.
    // Derived, not observed, so a change to either multiplier moves it.
    const a = 0.12;
    const b = 3.5;
    const expected =
      a * (1 - Math.exp(-a)) + ((a + 1) * Math.exp(-a) - (b + 1) * Math.exp(-b)) + b * Math.exp(-b);
    expect(expected).toBeCloseTo(0.9767, 4);

    for (const rate of RATES) {
      let sum = 0;
      for (let i = 0; i < N; i++) sum += poissonGap(rate);
      const ratio = sum / N / (1 / rate);
      expect(ratio).toBeGreaterThan(expected - 0.015);
      expect(ratio).toBeLessThan(expected + 0.015);
    }
  });

  it('scales the clamp with the rate, so density changes shape but not character', () => {
    // Ten times the rate is a tenth of every gap, floor and ceiling included.
    const slow = poissonGap(1, 0.5, 0.5);
    const fast = poissonGap(10, 0.5, 0.5);
    expect(slow).toBeCloseTo(0.5, 12);
    expect(fast).toBeCloseTo(0.05, 12);
  });

  it('honours custom multipliers', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 20_000; i++) {
      const g = poissonGap(2, 0.5, 1.5);
      if (g < min) min = g;
      if (g > max) max = g;
    }
    expect(min).toBe(0.25);
    expect(max).toBe(0.75);
  });

  it('clamps a zero or negative rate to 0.001 instead of dividing by zero', () => {
    for (const rate of [0, -5]) {
      for (let i = 0; i < 500; i++) {
        const g = poissonGap(rate);
        expect(Number.isFinite(g)).toBe(true);
        expect(g).toBeGreaterThanOrEqual(0.12 / 0.001);
        expect(g).toBeLessThanOrEqual(3.5 / 0.001);
      }
    }
  });

  it('returns NaN for a NaN rate — which the scheduler guard neutralises', () => {
    // Recorded rather than hidden: Math.max(0.001, NaN) is NaN, so the clamp
    // cannot rescue it. Nothing in src/audio passes NaN today. It is safe only
    // because _pumpTask writes `if (!(gap > 0.002))` and not `gap <= 0.002` —
    // the negation is what catches NaN, and this pins that.
    expect(Number.isNaN(poissonGap(NaN))).toBe(true);

    const h = harness();
    h.sched.add('nan', () => {
      h.times.push(0);
      return poissonGap(NaN);
    });
    h.sched.start();
    expect(h.times.length).toBeGreaterThanOrEqual(PRIME_STEP / 0.05);
    expect(h.times.length).toBeLessThanOrEqual(PRIME_STEP / 0.05 + 1);
  });
});
